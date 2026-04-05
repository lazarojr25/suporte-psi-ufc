import PDFDocument from 'pdfkit';
import {
  getReportsOverviewCache,
  setReportsOverviewCache,
} from './firestoreService.js';

const MEETINGS_COLLECTION = 'encontros';
const LEGACY_MEETINGS_COLLECTIONS = ['meetings'];

class ReportsService {
  constructor(db, transcriptionService) {
    this.db = db;
    this.transcriptionService = transcriptionService;
    this.monthLabelFormatter = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
    this.overviewCacheTtlMs = 5 * 60 * 1000;
    this.overviewRefreshDebounceMs = 30 * 1000;
    this.overviewRefreshMaxRetries = 3;
    this.overviewRefreshBaseRetryMs = 1000;
    this._overviewRefreshPromise = null;
    this._overviewRefreshTimer = null;
  }

  _makeCacheMetadata({ status, generatedAt, dirty, cache }) {
    return {
      cache: {
        status,
        generatedAt,
        generatedAtRaw: generatedAt,
        dirty,
        pendingUpdates: cache?.pendingUpdates || 0,
      },
    };
  }

  _isFreshCache(cache) {
    if (!cache) return false;
    if (cache.dirty) return false;
    if (!cache.generatedAt) return false;
    const cacheDate = new Date(cache.generatedAt).getTime();
    if (Number.isNaN(cacheDate)) return false;
    return Date.now() - cacheDate <= this.overviewCacheTtlMs;
  }

  _buildDateRange(from, to) {
    const fromDate = this._toDate(from);
    const toDate = this._toDate(to);

    if (fromDate && toDate && toDate < fromDate) {
      return { fromDate: toDate, toDate: fromDate };
    }

    return { fromDate, toDate };
  }

  _normalizeRiskLevel(level) {
    const normalized = String(level || '')
      .toLowerCase()
      .trim();

    if (!normalized) return 'desconhecido';
    if (['alto', 'high'].includes(normalized)) return 'alto';
    if (['medio', 'médio', 'medium'].includes(normalized)) return 'medio';
    if (['baixo', 'low'].includes(normalized)) return 'baixo';
    return 'desconhecido';
  }

  _monthLabelFromPeriod(period) {
    const [year, month] = String(period).split('-');
    if (!year || !month) return period;
    return this.monthLabelFormatter.format(new Date(Number(year), Number(month) - 1, 1));
  }

  _buildPareto(entries = [], coverage = 0.8, total = null) {
    const ordered = entries
      .map((entry) => ({
        ...entry,
        count: Number(entry.count || 0),
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    const totalCount = total != null ? Number(total) : ordered.reduce((sum, entry) => sum + entry.count, 0);
    if (!totalCount) {
      return {
        total: 0,
        selectedCount: 0,
        selectedCoverage: 0,
        selectedItems: [],
        ranking: [],
      };
    }

    const target = totalCount * coverage;
    let accumulated = 0;
    const selectedItems = [];

    for (const entry of ordered) {
      if (accumulated >= target && selectedItems.length > 0) break;
      accumulated += entry.count;
      selectedItems.push(entry);
    }

    return {
      total: totalCount,
      selectedCount: selectedItems.length,
      selectedCoverage: Number(((accumulated / totalCount) * 100).toFixed(1)),
      selectedItems,
      ranking: ordered.slice(0, 6),
    };
  }

  _buildOverviewNarratives({ qualityFlags = {}, riskTotals = {}, conversionTimeline = [], totalTranscriptions = 0 }) {
    const insights = [];
    const chokepoints = [];
    const acoesSugeridas = [];

    const lowConfidenceRate = qualityFlags.lowConfidenceRate || 0;
    const failedRate = qualityFlags.failedAnalysisRate || 0;
    const pendingReviewRate = qualityFlags.pendingReviewRate || 0;

    if (lowConfidenceRate >= 25) {
      insights.push('Muitos registros com baixa confiança no resumo: priorize revisão humana desses casos.');
      acoesSugeridas.push('Revisar transcrições com confiança abaixo de 65% antes do fechamento clínico.');
    }
    if (failedRate >= 12) {
      insights.push('Foram detectadas análises com falha; revisar integrações e qualidade das transcrições.');
      acoesSugeridas.push('Rerodar análises em lote dos casos com falha para reduzir perda de informação.');
    }
    if (pendingReviewRate >= 35) {
      insights.push('Alta proporção de casos marcados para revisão humana.');
      acoesSugeridas.push('Distribuir a revisão por responsável para reduzir acúmulo do backlog de validação.');
    }

    if ((riskTotals.alto || 0) > (riskTotals.baixo || 0) + (riskTotals.medio || 0)) {
      insights.push('Sinais de risco alto estão acima de outros níveis no período.');
      acoesSugeridas.push('Ativar protocolo de resposta prioritária para cursos/episódios com risco alto.');
    }

    if (totalTranscriptions < 4) {
      insights.push('Baixo volume recente; recomenda-se manter monitoramento com base em janelas históricas maiores.');
    }

    conversionTimeline.forEach((point) => {
      if (point.conversionDeltaMoM != null && point.conversionDeltaMoM <= -20) {
        chokepoints.push(`${point.periodLabel}: queda de ${Math.abs(point.conversionDeltaMoM)}% na conversão em relação ao mês anterior.`);
      }
    });

    if (!chokepoints.length && !insights.length) {
      insights.push('Indicadores estáveis no período, sem alertas críticos.');
    }

    return {
      insights: insights.slice(0, 3),
      chokepoints: chokepoints.slice(0, 4),
      acoesSugeridas: [...new Set(acoesSugeridas)].slice(0, 5),
    };
  }

  _buildOverviewAlerts({ qualityFlags = {}, conversionRateTotal = 0, conversionDeltaMoMTotal = null, riskTotals = {}, concentrationStudents = null }) {
    const alerts = [];

    if (conversionRateTotal !== 0 && conversionRateTotal < 20) {
      alerts.push('Conversão baixa no mês (solicitações -> atendimentos concluídos abaixo de 20%).');
    }
    if (conversionDeltaMoMTotal != null && conversionDeltaMoMTotal <= -15) {
      alerts.push(`Queda de conversão de ${Math.abs(conversionDeltaMoMTotal)}% em relação ao mês anterior.`);
    }

    const riskTotal = Number(riskTotals.alto || 0) + Number(riskTotals.medio || 0) + Number(riskTotals.baixo || 0);
    if (riskTotal > 0 && (Number(riskTotals.alto || 0) / riskTotal) * 100 >= 30) {
      alerts.push('Proporção de sinais de risco alto acima de 30%.');
    }

    const failedRate = qualityFlags.failedAnalysisRate || 0;
    if (failedRate >= 12) {
      alerts.push('Taxa de falha na análise >=12%.');
    }
    const lowConfidenceRate = qualityFlags.lowConfidenceRate || 0;
    if (lowConfidenceRate >= 25) {
      alerts.push('Taxa de baixa confiança da IA >=25%.');
    }

    if (concentrationStudents && concentrationStudents.total > 0 && concentrationStudents.selectedCoverage >= 80) {
      alerts.push(`Concentração forte: ${concentrationStudents.selectedCount}/${concentrationStudents.total} discentes concentram ${concentrationStudents.selectedCoverage.toFixed(1)}% do volume.`);
    }

    return alerts.slice(0, 5);
  }

  async _buildOverviewData({ from = null, to = null } = {}) {
    const all = this.transcriptionService.listTranscriptionsWithMetadata();
    const solicitacoes = this._loadSolicitacoes();
    const meetingsPromise = this._loadMeetings();

    const [allTranscriptions, allSolicitacoes, allMeetings] = await Promise.all([
      all,
      solicitacoes,
      meetingsPromise,
    ]);

    const { fromDate, toDate } = this._buildDateRange(from, to);
    const inRange = (itemDate) => {
      if (!itemDate) return false;
      if (fromDate && itemDate < fromDate) return false;
      if (toDate && itemDate > toDate) return false;
      return true;
    };

    const filteredTranscriptions = allTranscriptions.filter((item) =>
      inRange(this._toDate(item?.createdAt)),
    );
    const filteredSolicitacoes = allSolicitacoes.filter((item) =>
      inRange(this._toDate(item?.createdAt)),
    );
    const filteredMeetings = allMeetings.filter((meeting) =>
      inRange(this._meetingDateForRange(meeting)),
    );

    const totalTranscriptions = filteredTranscriptions.length;
    const totalSizeBytes = filteredTranscriptions.reduce(
      (sum, t) => sum + (t.size || 0),
      0,
    );
    const avgSizeBytes =
      totalTranscriptions > 0 ? totalSizeBytes / totalTranscriptions : 0;

    const studentsSet = new Set(
      filteredTranscriptions
        .map((t) => t.metadata?.discenteId)
        .filter(Boolean),
    );
    const totalStudents = studentsSet.size;

    let sentimentsAvg = null;
    let sumPos = 0;
    let sumNeu = 0;
    let sumNeg = 0;
    let countSent = 0;

    const quality = {
      total: totalTranscriptions,
      lowConfidence: 0,
      pendingReview: 0,
      failedAnalysis: 0,
    };

    const riskTotals = {
      alto: 0,
      medio: 0,
      baixo: 0,
      desconhecido: 0,
    };
    const riskByMonth = new Map();
    const riskTriggerMap = new Map();
    const byCourseMap = {};
    const studentCountMap = new Map();
    const courseCountMap = new Map();
    const courseMonthMap = new Map();

    const toMonth = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const demandByMonth = new Map();

    for (const t of filteredTranscriptions) {
      const s = t.analysis?.sentiments;
      const createdAt = this._toDate(t.createdAt);
      const month = createdAt ? toMonth(createdAt) : null;
      const course = t.metadata?.curso || 'Não informado';
      const discenteId = this._safeToString(t.metadata?.discenteId) || 'desconhecido';

      studentCountMap.set(discenteId, (studentCountMap.get(discenteId) || 0) + 1);
      courseCountMap.set(course, (courseCountMap.get(course) || 0) + 1);

      const mapCourseMonth = courseMonthMap.get(course) || {};
      if (month) {
        mapCourseMonth[month] = (mapCourseMonth[month] || 0) + 1;
      }
      courseMonthMap.set(course, mapCourseMonth);

      if (month) {
        const monthDemand = demandByMonth.get(month) || { solicitacoes: 0, atendimentos: 0 };
        monthDemand.atendimentos += 1;
        demandByMonth.set(month, monthDemand);
      }

      if (!byCourseMap[course]) {
        byCourseMap[course] = {
          course,
          count: 0,
          distinctStudents: new Set(),
          lastTranscriptionAt: null,
          sentimentCount: 0,
          sumPos: 0,
          sumNeu: 0,
          sumNeg: 0,
          keywords: [],
          topics: [],
        };
      }

      const entry = byCourseMap[course];
      entry.count += 1;
      if (t.metadata?.discenteId) {
        entry.distinctStudents.add(t.metadata.discenteId);
      }

      if (createdAt) {
        const currentLast = entry.lastTranscriptionAt
          ? new Date(entry.lastTranscriptionAt)
          : null;
        if (!currentLast || createdAt > currentLast) {
          entry.lastTranscriptionAt = createdAt.toISOString();
        }
      }

      if (s) {
        sumPos += s.positive || 0;
        sumNeu += s.neutral || 0;
        sumNeg += s.negative || 0;
        countSent++;
      }

      const riskSignals = Array.isArray(t.analysis?.riskSignals)
        ? t.analysis.riskSignals
        : [];
      for (const signal of riskSignals) {
        const level = this._normalizeRiskLevel(signal?.nivel || signal?.level);
        riskTotals[level] = (riskTotals[level] || 0) + 1;

        if (month) {
          const monthRisk = riskByMonth.get(month) || { alto: 0, medio: 0, baixo: 0, desconhecido: 0 };
          monthRisk[level] = (monthRisk[level] || 0) + 1;
          riskByMonth.set(month, monthRisk);
        }

        const trigger = this._safeToString(signal?.tipo || signal?.type);
        if (trigger) {
          riskTriggerMap.set(trigger, (riskTriggerMap.get(trigger) || 0) + 1);
        }
      }

      const conf = t.analysis?.summaryConfidence;
      if (typeof conf === 'number' && conf < 0.65) {
        quality.lowConfidence += 1;
      }
      if (t.analysis?.humanReviewRequired === true) {
        quality.pendingReview += 1;
      }
      const analysisStatus = String(t.analysisStatus || 'ok').toLowerCase();
      if (analysisStatus !== 'ok') {
        quality.failedAnalysis += 1;
      }

      if (Array.isArray(t.analysis?.keywords)) {
        this._extractTextList(t.analysis.keywords).forEach((kw) => entry.keywords.push(kw));
      }
      if (Array.isArray(t.analysis?.topics)) {
        this._extractTextList(t.analysis.topics).forEach((topic) => entry.topics.push(topic));
      }
    }

    if (countSent > 0) {
      sentimentsAvg = {
        positive: sumPos / countSent,
        neutral: sumNeu / countSent,
        negative: sumNeg / countSent,
      };
    }

    const byCourse = Object.values(byCourseMap)
      .map((c) => ({
        course: c.course,
        count: c.count,
        distinctStudents: c.distinctStudents.size,
        lastTranscriptionAt: c.lastTranscriptionAt,
        sentimentsAvg:
          c.sentimentCount > 0
            ? {
                positive: c.sumPos / c.sentimentCount,
                neutral: c.sumNeu / c.sentimentCount,
                negative: c.sumNeg / c.sentimentCount,
              }
            : null,
        topKeywords: this._buildFrequencyMap(c.keywords).slice(0, 4),
        topTopics: this._buildFrequencyMap(c.topics).slice(0, 4),
      }))
      .sort((a, b) => b.count - a.count);

    const allKeywords = [];
    const allTopics = [];

    for (const t of filteredTranscriptions) {
      if (Array.isArray(t.analysis?.keywords)) {
        allKeywords.push(...this._extractTextList(t.analysis.keywords));
      }
      if (Array.isArray(t.analysis?.topics)) {
        allTopics.push(...this._extractTextList(t.analysis.topics));
      }
    }

    const topKeywords = this._buildFrequencyMap(allKeywords).slice(0, 10);
    const topTopics = this._buildFrequencyMap(allTopics).slice(0, 10);

    const allSolicitacoesFiltered = filteredSolicitacoes.map((item) => ({
      ...item,
      createdAt: item.createdAt
        ? this._toDate(item.createdAt)?.toISOString() || item.createdAt
        : null,
    }));

    for (const item of allSolicitacoesFiltered) {
      const date = this._toDate(item?.createdAt);
      const month = date ? toMonth(date) : null;
      if (!month) continue;
      const demand = demandByMonth.get(month) || {
        solicitacoes: 0,
        atendimentos: 0,
      };
      demand.solicitacoes += 1;
      demandByMonth.set(month, demand);
    }

    const solicitacoesTimelineRaw = this._buildMonthlyTimeline(
      allSolicitacoesFiltered,
      'createdAt',
    );
    const solicitacoesTimeline = solicitacoesTimelineRaw.map(
      ({ sortValue, ...rest }) => rest,
    );

    for (const point of solicitacoesTimeline) {
      if (!point.period) continue;
      const demand = demandByMonth.get(point.period) || {
        solicitacoes: 0,
        atendimentos: 0,
      };
      demand.solicitacoes = point.count;
      demandByMonth.set(point.period, demand);
    }

    const periodWithMostSolic = solicitacoesTimeline.reduce(
      (max, current) => {
        if (!max) return current;
        return current.count > max.count ? current : max;
      },
      null,
    );

    const timelineRaw = this._buildMonthlyTimeline(filteredTranscriptions, 'createdAt');
    const timeline = timelineRaw.map(({ sortValue, ...rest }) => rest);

    const periodWithMostRequests = timeline.reduce(
      (max, current) => {
        if (!max) return current;
        return current.count > max.count ? current : max;
      },
      null,
    );

    const sentimentsTimeline = this._buildMonthlySentimentTimeline(
      filteredTranscriptions,
      'createdAt',
    );

    const atendimentosTimeline = timeline.map((entry) => ({
      ...entry,
      type: 'concluidos',
    }));

    const solicitacoesByPeriod = new Map(
      solicitacoesTimelineRaw.map((e) => [e.period, e]),
    );
    const atendimentosByPeriod = new Map(
      timelineRaw.map((e) => [e.period, { ...e, type: 'concluidos' }]),
    );

    const mergedPeriods = new Set([
      ...solicitacoesTimeline.map((e) => e.period),
      ...atendimentosTimeline.map((e) => e.period),
    ]);

    const comparativoTimeline = Array.from(mergedPeriods)
      .map((period) => {
        const solicit = solicitacoesByPeriod.get(period);
        const atend = atendimentosByPeriod.get(period);
        const sortValue = solicit?.sortValue || atend?.sortValue || 0;
        const atendimentosConcluidos = atend?.count || 0;
        const solicitacoesCount = solicit?.count || 0;
        const conversionRate =
          solicitacoesCount > 0
            ? Number(((atendimentosConcluidos / solicitacoesCount) * 100).toFixed(1))
            : 0;
        return {
          period,
          periodLabel: solicit?.periodLabel || atend?.periodLabel || period,
          solicitacoes: solicitacoesCount,
          atendimentosConcluidos,
          conversionRate,
          sortValue,
        };
      })
      .sort((a, b) => a.sortValue - b.sortValue);

    const comparativoByPeriod = new Map(
      comparativoTimeline.map((entry) => [entry.period, entry]),
    );

    const conversionTimeline = comparativoTimeline.map((point, index, arr) => {
      const prev = arr[index - 1];
      const conversionDeltaMoM = prev
        ? (prev.conversionRate > 0
            ? Number(
                (
                  ((point.conversionRate - prev.conversionRate) /
                    prev.conversionRate) *
                  100
                ).toFixed(1),
              )
            : null)
        : null;
      return {
        period: point.period,
        periodLabel: point.periodLabel,
        conversionRate: point.conversionRate,
        conversionDeltaMoM,
      };
    });

    const lastPoint = comparativoTimeline.at(-1);
    const prevPoint = comparativoTimeline.at(-2);
    const conversionDeltaMoMTotal =
      prevPoint && prevPoint.conversionRate > 0
        ? Number(
            (
              ((lastPoint?.conversionRate || 0) - prevPoint.conversionRate) /
              prevPoint.conversionRate *
              100
            ).toFixed(1),
          )
        : null;
    const conversionRateTotal = conversionTimeline.at(-1)?.conversionRate || 0;

    const periods = Array.from(demandByMonth.keys()).sort();
    const topCourseTrend = (() => {
      if (periods.length < 2) return null;
      const last = periods[periods.length - 1];
      const beforeLast = periods[periods.length - 2];

      const trend = [];
      for (const [course, monthly] of courseMonthMap) {
        const prev = Number(monthly[beforeLast] || 0);
        const curr = Number(monthly[last] || 0);
        if (!prev && !curr) continue;
        const delta = curr - prev;
        const deltaPct = prev > 0 ? Number(((delta / prev) * 100).toFixed(1)) : curr > 0 ? 100 : 0;
        trend.push({
          course,
          currentPeriodCount: curr,
          previousPeriodCount: prev,
          delta,
          deltaPct,
        });
      }

      return {
        referencePeriod: {
          from: beforeLast,
          to: last,
        },
        growth: trend
          .filter((item) => item.deltaPct > 0)
          .sort((a, b) => b.deltaPct - a.deltaPct)
          .slice(0, 4),
        decline: trend
          .filter((item) => item.deltaPct < 0)
          .sort((a, b) => a.deltaPct - b.deltaPct)
          .slice(0, 4),
      };
    })();

    const reportNow = toDate ? new Date(toDate) : new Date();
    const month12Ago = new Date(reportNow.getFullYear(), reportNow.getMonth() - 11, 1);
    const month6Ago = new Date(reportNow.getFullYear(), reportNow.getMonth() - 5, 1);
    const semesterStart = new Date(reportNow.getFullYear(), reportNow.getMonth() >= 6 ? 6 : 0, 1);

    const withinFromPeriod = (period, startDate) => period >= `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const last12Months = timeline.filter((item) => withinFromPeriod(item.period, month12Ago));
    const last6Months = timeline.filter((item) => withinFromPeriod(item.period, month6Ago));
    const currentSemester = timeline.filter((item) => withinFromPeriod(item.period, semesterStart));

    const last30From = new Date(reportNow);
    last30From.setDate(reportNow.getDate() - 29);
    const last90From = new Date(reportNow);
    last90From.setDate(reportNow.getDate() - 89);
    const last30DaysSolic = filteredSolicitacoes.filter((item) =>
      inRange(this._toDate(item?.createdAt)),
    ).filter((item) => this._toDate(item?.createdAt) >= last30From).length;

    const last30DaysAtend = filteredTranscriptions.filter((item) =>
      inRange(this._toDate(item?.createdAt)),
    ).filter((item) => this._toDate(item?.createdAt) >= last30From).length;

    const last90DaysSolic = filteredSolicitacoes.filter((item) =>
      inRange(this._toDate(item?.createdAt)),
    ).filter((item) => this._toDate(item?.createdAt) >= last90From).length;

    const last90DaysAtend = filteredTranscriptions.filter((item) =>
      inRange(this._toDate(item?.createdAt)),
    ).filter((item) => this._toDate(item?.createdAt) >= last90From).length;

    const last30DaysConversion =
      last30DaysSolic > 0
        ? Number(((last30DaysAtend / last30DaysSolic) * 100).toFixed(1))
        : 0;

    const last90DaysConversion =
      last90DaysSolic > 0
        ? Number(((last90DaysAtend / last90DaysSolic) * 100).toFixed(1))
        : 0;

    const buildWindowSummaryFromTimeline = (windowTimeline = [], from, to) => {
      const transcriptions = windowTimeline.reduce(
        (acc, item) => acc + Number(item?.count || 0),
        0,
      );
      const solicitacoes = windowTimeline.reduce((acc, item) => {
        const comparison = comparativoByPeriod.get(item.period) || {};
        return acc + Number(comparison.solicitacoes || 0);
      }, 0);
      return {
        from,
        to,
        transcriptions,
        solicitacoes,
        conversionRate:
          solicitacoes > 0 ? Number(((transcriptions / solicitacoes) * 100).toFixed(1)) : 0,
        timeline: windowTimeline,
      };
    };

    const riskByMonthTimeline = Array.from(riskByMonth, ([period, values]) => ({
      period,
      periodLabel: this._monthLabelFromPeriod(period),
      ...values,
    })).sort((a, b) => a.period.localeCompare(b.period));

    const qualityFlags = {
      total: quality.total,
      lowConfidence: quality.lowConfidence,
      pendingReview: quality.pendingReview,
      failedAnalysis: quality.failedAnalysis,
      lowConfidenceRate:
        quality.total > 0
          ? Number(((quality.lowConfidence / quality.total) * 100).toFixed(1))
          : 0,
      pendingReviewRate:
        quality.total > 0
          ? Number(((quality.pendingReview / quality.total) * 100).toFixed(1))
          : 0,
      failedAnalysisRate:
        quality.total > 0
          ? Number(((quality.failedAnalysis / quality.total) * 100).toFixed(1))
          : 0,
    };

    const concentrationStudents = this._buildPareto(
      Array.from(studentCountMap, ([discenteId, count]) => ({ discenteId, count })),
      0.8,
      totalTranscriptions,
    );
    const concentrationCourses = this._buildPareto(
      Array.from(courseCountMap, ([course, count]) => ({ course, count })),
      0.8,
      totalTranscriptions,
    );

    const attendanceByOwnerMap = new Map();
    filteredMeetings.forEach((meeting) => {
      const owner = this._extractMeetingOwner(meeting);
      const current = attendanceByOwnerMap.get(owner.key) || {
        ...owner,
        scheduledMinutes: 0,
        completedMinutes: 0,
        scheduledSessions: 0,
        completedSessions: 0,
      };
      const status = this._normalizeStatus(meeting.status);
      const durationMinutes = Number(meeting.duration || 45) || 45;

      if (status === 'agendada') {
        current.scheduledMinutes += durationMinutes;
        current.scheduledSessions += 1;
      }

      if (status === 'concluida') {
        current.completedMinutes += durationMinutes;
        current.completedSessions += 1;
      }

      attendanceByOwnerMap.set(owner.key, current);
    });

    const attendanceHoursByUser = Array.from(attendanceByOwnerMap.values())
      .map((entry) => ({
        ...entry,
        scheduledHours: Number((entry.scheduledMinutes / 60).toFixed(2)),
        completedHours: Number((entry.completedMinutes / 60).toFixed(2)),
      }))
      .sort((a, b) => {
        if (b.completedHours !== a.completedHours) {
          return b.completedHours - a.completedHours;
        }
        if (b.scheduledHours !== a.scheduledHours) {
          return b.scheduledHours - a.scheduledHours;
        }
        return (a.label || '').localeCompare(b.label || '');
      });

    const attendanceHoursTotals = attendanceHoursByUser.reduce(
      (acc, item) => ({
        scheduledHours: Number((acc.scheduledHours + item.scheduledHours).toFixed(2)),
        completedHours: Number((acc.completedHours + item.completedHours).toFixed(2)),
        scheduledSessions: acc.scheduledSessions + item.scheduledSessions,
        completedSessions: acc.completedSessions + item.completedSessions,
      }),
      {
        scheduledHours: 0,
        completedHours: 0,
        scheduledSessions: 0,
        completedSessions: 0,
      },
    );

    return {
      overview: {
        totalTranscriptions,
        totalSizeBytes,
        avgSizeBytes,
        totalStudents,
        sentimentsAvg,
        conversionRate: conversionRateTotal,
        conversionDeltaMoM: conversionDeltaMoMTotal,
      },
      attendanceHoursByUser: {
        users: attendanceHoursByUser,
        totals: attendanceHoursTotals,
      },
      qualityFlags,
      riskSignals: {
        totals: riskTotals,
        totalSignals: Object.values(riskTotals).reduce((sum, value) => sum + value, 0),
        topTriggers: Array.from(riskTriggerMap, ([term, count]) => ({ term, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
        byMonth: riskByMonthTimeline,
      },
      concentration: {
        students: concentrationStudents,
        courses: concentrationCourses,
      },
      topCourseTrend,
      timeWindows: {
        last30Days: {
          from: last30From.toISOString(),
          to: reportNow.toISOString(),
          transcriptions: last30DaysAtend,
          solicitacoes: last30DaysSolic,
          conversionRate: last30DaysConversion,
        },
        last6Months: {
          ...buildWindowSummaryFromTimeline(
            last6Months,
            new Date(reportNow.getFullYear(), reportNow.getMonth() - 5, 1).toISOString(),
            reportNow.toISOString(),
          ),
        },
        last12Months: {
          ...buildWindowSummaryFromTimeline(
            last12Months,
            new Date(reportNow.getFullYear(), reportNow.getMonth() - 11, 1).toISOString(),
            reportNow.toISOString(),
          ),
        },
        last90Days: {
          from: last90From.toISOString(),
          to: reportNow.toISOString(),
          transcriptions: last90DaysAtend,
          solicitacoes: last90DaysSolic,
          conversionRate: last90DaysConversion,
        },
        currentSemester: {
          ...buildWindowSummaryFromTimeline(
            currentSemester,
            new Date(reportNow.getFullYear(), reportNow.getMonth() >= 6 ? 6 : 0, 1).toISOString(),
            reportNow.toISOString(),
          ),
        },
      },
      demand: {
        totalSolicitacoes: filteredSolicitacoes.length,
        conversionRate: conversionRateTotal,
        conversionDeltaMoM: conversionDeltaMoMTotal,
        conversionTimeline,
      },
      narratives: this._buildOverviewNarratives({
        qualityFlags,
        riskTotals,
        conversionTimeline,
        totalTranscriptions,
      }),
      alerts: this._buildOverviewAlerts({
        qualityFlags,
        conversionRateTotal,
        conversionDeltaMoMTotal,
        riskTotals,
        concentrationStudents,
      }),
      byCourse,
      highlights: {
        topKeywords,
        topTopics,
      },
      sentimentsTimeline,
      timeline,
      periodWithMostRequests,
      solicitacoes: {
        total: filteredSolicitacoes.length,
        timeline: solicitacoesTimeline,
        peak: periodWithMostSolic,
      },
      comparativo: comparativoTimeline,
      atendimentosTimeline,
    };
  }

  async _refreshOverviewCache() {
    if (this._overviewRefreshPromise) return this._overviewRefreshPromise;

    this._overviewRefreshPromise = (async () => {
      const generatedAt = new Date().toISOString();

      const data = await this._buildOverviewData();
      await setReportsOverviewCache({
        data,
        generatedAt,
        dirty: false,
        pendingUpdates: 0,
        refreshScheduledAt: null,
        refreshState: {
          status: 'success',
          lastAttemptAt: generatedAt,
          lastError: null,
          retries: 0,
        },
        source: 'overview',
      });
      return generatedAt;
    })();

    this._overviewRefreshPromise.finally(() => {
      this._overviewRefreshPromise = null;
    });

    return this._overviewRefreshPromise;
  }

  async _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _scheduleOverviewRefresh({ forceDebounce = false } = {}) {
    if (this._overviewRefreshTimer) {
      clearTimeout(this._overviewRefreshTimer);
    }

    const delay = forceDebounce ? 0 : this.overviewRefreshDebounceMs;
    this._overviewRefreshTimer = setTimeout(() => {
      this._overviewRefreshTimer = null;
      this._runOverviewRefreshWithRetry();
    }, delay);
  }

  async _runOverviewRefreshWithRetry() {
    let attempt = 0;
    let delay = this.overviewRefreshBaseRetryMs;

    while (attempt < this.overviewRefreshMaxRetries) {
      attempt += 1;
      try {
        const generatedAt = await this._refreshOverviewCache();
        await setReportsOverviewCache({
          refreshState: {
            status: 'success',
            lastAttemptAt: new Date().toISOString(),
            lastSuccessAt: generatedAt,
            retries: 0,
          },
        });
        return;
      } catch (error) {
        const lastError = error?.message || 'Erro desconhecido';
        console.warn(
          `Falha no refresh do overview (tentativa ${attempt}/${this.overviewRefreshMaxRetries}):`,
          lastError,
        );

        if (attempt >= this.overviewRefreshMaxRetries) {
          await setReportsOverviewCache({
            refreshState: {
              status: 'failed',
              lastAttemptAt: new Date().toISOString(),
              lastError,
              retries: attempt,
            },
            refreshScheduledAt: null,
          });
          return;
        }

        await setReportsOverviewCache({
          refreshState: {
            status: 'retrying',
            lastAttemptAt: new Date().toISOString(),
            lastError,
            retries: attempt,
          },
        });
        await this._sleep(delay);
        delay = delay * 2;
      }
    }
  }

  _requireDb() {
    if (!this.db) {
      const error = new Error('Firebase Admin não inicializado.');
      error.statusCode = 500;
      throw error;
    }
  }

  _safeToString(value) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str.length ? str : null;
  }

  _makeSafe(value) {
    return (value || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  _makeSafeSlug(name, matricula, fallback) {
    const safeName = this._makeSafe(name);
    const safeMatricula = this._makeSafe(matricula);
    return [safeName, safeMatricula].filter(Boolean).join('_') || this._makeSafe(fallback) || 'discente';
  }

  _buildFrequencyMap(values = []) {
    const freq = new Map();
    for (const v of values) {
      if (!v) continue;
      const key = String(v).trim();
      if (!key) continue;
      freq.set(key, (freq.get(key) || 0) + 1);
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([term, count]) => ({ term, count }));
  }

  _formatDate(value) {
    if (!value) return '---';
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? '---'
      : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  _formatDateRaw(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString('pt-BR');
  }

  _toDate(value) {
    if (!value) return null;
    const parsed =
      value instanceof Date
        ? value
        : value.toDate instanceof Function
          ? value.toDate()
          : new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  _normalizeStatus(status) {
    return (status || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  _meetingDateForRange(meeting = {}) {
    if (meeting.dateTime) {
      const fromDateTime = this._toDate(meeting.dateTime);
      if (fromDateTime) return fromDateTime;
    }
    if (meeting.scheduledDate && meeting.scheduledTime) {
      const fromScheduled = this._toDate(`${meeting.scheduledDate}T${meeting.scheduledTime}:00`);
      if (fromScheduled) return fromScheduled;
    }
    if (meeting.scheduledDate) {
      const fromScheduledDate = this._toDate(`${meeting.scheduledDate}T00:00:00`);
      if (fromScheduledDate) return fromScheduledDate;
    }
    return this._toDate(meeting.createdAt);
  }

  _extractMeetingOwner(meeting = {}) {
    const ownerUid =
      this._safeToString(meeting.ownerUid) ||
      this._safeToString(meeting.owner?.uid) ||
      this._safeToString(meeting.createdByUid);
    const ownerEmail =
      this._safeToString(meeting.ownerEmail) ||
      this._safeToString(meeting.owner?.email) ||
      this._safeToString(meeting.createdByEmail);
    const ownerName =
      this._safeToString(meeting.ownerName) ||
      this._safeToString(meeting.owner?.name) ||
      null;
    const key = ownerUid || ownerEmail || 'sem_proprietario';
    const label = ownerName || ownerEmail || ownerUid || 'Sem proprietário';
    return {
      key,
      label,
      ownerUid: ownerUid || null,
      ownerEmail: ownerEmail || null,
      ownerName: ownerName || null,
    };
  }

  async _loadMeetings() {
    if (!this.db) return [];
    const collections = [MEETINGS_COLLECTION, ...LEGACY_MEETINGS_COLLECTIONS];
    const map = new Map();
    try {
      const snapshots = await Promise.all(
        collections.map((collectionName) => this.db.collection(collectionName).get()),
      );
      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((doc) => {
          if (map.has(doc.id)) return;
          const data = doc.data() || {};
          map.set(doc.id, {
            id: doc.id,
            ...data,
          });
        });
      });
      return Array.from(map.values());
    } catch (err) {
      console.warn('Falha ao carregar encontros para relatório:', err?.message);
      return [];
    }
  }

  _extractTextList(values = []) {
    const normalized = [];
    for (const item of values) {
      const value =
        typeof item === 'string'
          ? item
          : item?.term || item?.keyword || item?.label || item?.topic;
      const safe = this._safeToString(value);
      if (safe) {
        normalized.push(safe);
      }
    }
    return normalized;
  }

  _buildMonthlyTimeline(items = [], dateAccessor) {
    const timelineMap = new Map();

    for (const item of items) {
      const dateValue =
        typeof dateAccessor === 'function'
          ? dateAccessor(item)
          : item?.[dateAccessor];
      const date = this._toDate(dateValue);
      if (!date) continue;

      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!timelineMap.has(period)) {
        timelineMap.set(period, {
          period,
          periodLabel: this.monthLabelFormatter.format(
            new Date(date.getFullYear(), date.getMonth(), 1),
          ),
          count: 0,
          sortValue: date.getFullYear() * 100 + (date.getMonth() + 1),
        });
      }

      timelineMap.get(period).count += 1;
    }

    return Array.from(timelineMap.values()).sort((a, b) => a.sortValue - b.sortValue);
  }

  _buildMonthlySentimentTimeline(items = [], dateAccessor) {
    const timelineMap = new Map();

    for (const item of items) {
      const dateValue =
        typeof dateAccessor === 'function'
          ? dateAccessor(item)
          : item?.[dateAccessor];
      const date = this._toDate(dateValue);
      if (!date) continue;

      const sentiments = item?.analysis?.sentiments;
      if (!sentiments) continue;

      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!timelineMap.has(period)) {
        timelineMap.set(period, {
          period,
          periodLabel: this.monthLabelFormatter.format(
            new Date(date.getFullYear(), date.getMonth(), 1),
          ),
          count: 0,
          totalPositive: 0,
          totalNeutral: 0,
          totalNegative: 0,
          sortValue: date.getFullYear() * 100 + (date.getMonth() + 1),
        });
      }

      const entry = timelineMap.get(period);
      entry.count += 1;
      entry.totalPositive += sentiments.positive || 0;
      entry.totalNeutral += sentiments.neutral || 0;
      entry.totalNegative += sentiments.negative || 0;
    }

    return Array.from(timelineMap.values())
      .map((entry) => ({
        ...entry,
        positive: entry.count > 0 ? entry.totalPositive / entry.count : 0,
        neutral: entry.count > 0 ? entry.totalNeutral / entry.count : 0,
        negative: entry.count > 0 ? entry.totalNegative / entry.count : 0,
      }))
      .map(({ sortValue, ...entry }) => ({
        ...entry,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  _buildPdfBuffer(buildPdf) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({ margin: 40, size: 'A4' });

      const handleError = (error) => {
        if (!doc.destroyed) {
          doc.destroy();
        }
        reject(error);
      };

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', handleError);
      doc.on('end', () => {
        try {
          resolve(Buffer.concat(chunks));
        } catch (error) {
          reject(error);
        }
      });

      try {
        buildPdf(doc);
      } catch (error) {
        handleError(error);
      }

      doc.end();
    });
  }

  async _loadSolicitacoes() {
    if (!this.db) return [];
    try {
      const snap = await this.db.collection('solicitacoesAtendimento').get();
      return snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt || null,
        };
      });
    } catch (err) {
      console.warn('Falha ao carregar solicitações:', err?.message);
      return [];
    }
  }

  async _getDiscenteInfo(discenteId) {
    if (!this.db || !discenteId) return null;
    try {
      const ref = this.db.collection('discentes').doc(discenteId);
      const snap = await ref.get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    } catch (err) {
      console.warn('Falha ao ler discente para relatório:', err?.message);
      return null;
    }
  }

  async _getFirstSolicitacaoByDiscente(discenteId) {
    if (!this.db || !discenteId) return null;
    try {
      const snap = await this.db
        .collection('solicitacoesAtendimento')
        .where('discenteId', '==', discenteId)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (err) {
      console.warn('Falha ao ler solicitação para relatório:', err?.message);
      return null;
    }
  }

  async _getDiscenteExportMetadata(discenteId, transcriptions = []) {
    const discenteInfo = await this._getDiscenteInfo(discenteId);
    const solicitacaoInfo = await this._getFirstSolicitacaoByDiscente(discenteId);

    const firstByMetadata = (extractor) => {
      for (const item of transcriptions) {
        const value = extractor(item);
        if (this._safeToString(value)) return value;
      }
      return null;
    };

    const discenteName =
      this._safeToString(discenteInfo?.name) ||
      this._safeToString(solicitacaoInfo?.name) ||
      this._safeToString(firstByMetadata((t) => t?.metadata?.studentName)) ||
      this._safeToString(firstByMetadata((t) => t?.metadata?.name)) ||
      discenteId;

    const discenteMatricula =
      this._safeToString(discenteInfo?.matricula || discenteInfo?.studentId) ||
      this._safeToString(solicitacaoInfo?.matricula || solicitacaoInfo?.studentId) ||
      this._safeToString(firstByMetadata((t) => t?.metadata?.matricula || t?.metadata?.studentId)) ||
      this._safeToString(firstByMetadata((t) => t?.metadata?.studentId)) ||
      '';

    const safeSlug = this._makeSafeSlug(discenteName, discenteMatricula, discenteId);

    return {
      discenteName,
      discenteMatricula,
      safeSlug,
      fileName: `relatorio-discente-${safeSlug}`,
    };
  }

  _buildDiscentePatterns(transcriptions = []) {
    const topics = [];
    const keywords = [];
    const actionable = [];
    let sentimentsCount = 0;
    let sumPos = 0;
    let sumNeu = 0;
    let sumNeg = 0;

    for (const t of transcriptions) {
      const analysis = t.analysis || {};

      if (Array.isArray(analysis.topics)) {
        analysis.topics.forEach((topic) => {
          const normalized =
            typeof topic === 'string'
              ? this._safeToString(topic)
              : this._safeToString(topic?.term || topic?.topic || topic?.label);
          if (normalized) topics.push(normalized);
        });
      }

      if (Array.isArray(analysis.keywords)) {
        analysis.keywords.forEach((keyword) => {
          const normalized =
            typeof keyword === 'string'
              ? this._safeToString(keyword)
              : this._safeToString(
                  keyword?.term || keyword?.keyword || keyword?.label,
                );
          if (normalized) keywords.push(normalized);
        });
      }

      if (Array.isArray(analysis.actionableInsights)) {
        analysis.actionableInsights.forEach((insight) => {
          const normalized = this._safeToString(insight);
          if (normalized) actionable.push(normalized);
        });
      }

      if (analysis.sentiments) {
        sentimentsCount += 1;
        sumPos += analysis.sentiments.positive || 0;
        sumNeu += analysis.sentiments.neutral || 0;
        sumNeg += analysis.sentiments.negative || 0;
      }
    }

    const recurringThemes = this._buildFrequencyMap(topics)
      .slice(0, 4)
      .map(({ term }) => term);

    const repeatedIdeas = this._buildFrequencyMap(keywords)
      .slice(0, 6)
      .map(({ term }) => term);

    let commonTriggers = this._buildFrequencyMap(actionable)
      .slice(0, 4)
      .map(({ term }) => term);
    if (!commonTriggers.length) {
      commonTriggers = this._buildFrequencyMap(keywords)
        .filter(({ count }) => count > 1)
        .slice(0, 4)
        .map(({ term }) => term);
    }

    const emotionalPatterns = [];
    if (sentimentsCount > 0) {
      const positivePct = (sumPos / sentimentsCount) * 100;
      const neutralPct = (sumNeu / sentimentsCount) * 100;
      const negativePct = (sumNeg / sentimentsCount) * 100;

      const ranking = [
        { label: 'positivos', value: positivePct },
        { label: 'neutros', value: neutralPct },
        { label: 'negativos', value: negativePct },
      ].sort((a, b) => b.value - a.value);

      if (ranking[0].value >= 5) {
        emotionalPatterns.push(
          `Predomínio de sentimentos ${ranking[0].label} (~${ranking[0].value.toFixed(0)}%)`,
        );
      }
      if (ranking[1].value >= 20) {
        emotionalPatterns.push(
          `Presença relevante de sentimentos ${ranking[1].label} (~${ranking[1].value.toFixed(0)}%)`,
        );
      }
    }

    return {
      recurringThemes,
      repeatedIdeas,
      emotionalPatterns,
      commonTriggers,
    };
  }

  async getOverviewData({ forceRefresh = false, from = null, to = null } = {}) {
    this._requireDb();
    const hasDateFilter = !!(from || to);

    if (!forceRefresh) {
      if (!hasDateFilter) {
        const cached = await getReportsOverviewCache();

        if (cached && typeof cached.data === 'object') {
          const cachedData = cached.data;

          if (this._isFreshCache(cached)) {
            return {
              ...cachedData,
              ...this._makeCacheMetadata({
                status: 'fresh',
                generatedAt: cached.generatedAt,
                dirty: false,
                cache: cached,
              }),
            };
          }

          if (!this._overviewRefreshPromise) {
            this._scheduleOverviewRefresh();
          }

          if (cached.dirty) {
            return {
              ...cachedData,
              ...this._makeCacheMetadata({
                status: 'stale',
                generatedAt: cached.generatedAt,
                dirty: true,
                cache: cached,
              }),
            };
          }

          if (cachedData) {
            return {
              ...cachedData,
              ...this._makeCacheMetadata({
                status: 'fallback',
                generatedAt: cached.generatedAt,
                dirty: cached.dirty || false,
                cache: cached,
              }),
            };
          }
        }
      }

    }

    const data = await this._buildOverviewData({ from, to });
    const generatedAt = new Date().toISOString();

    if (!hasDateFilter) {
      await setReportsOverviewCache({
        data,
        generatedAt,
        dirty: false,
        pendingUpdates: 0,
        refreshScheduledAt: null,
        source: 'overview',
        sourceGeneratedAt: generatedAt,
      });
    }

    return {
      ...data,
      ...this._makeCacheMetadata({
        status: 'computed',
        generatedAt,
        dirty: false,
        cache: {
          generatedAt,
          dirty: false,
        },
      }),
    };
  }

  async getOverviewExportText({ from = null, to = null, forceRefresh = false } = {}) {
    const {
      qualityFlags,
      riskSignals,
      timeWindows,
      narratives,
      concentration,
      alerts,
      overview,
      attendanceHoursByUser,
      highlights,
      timeline,
      solicitacoes,
      comparativo,
      byCourse,
      atendimentosTimeline,
    } = await this.getOverviewData({ from, to, forceRefresh });

    const lines = [];
    lines.push('====================================================');
    lines.push(' Relatório geral de atendimentos');
    lines.push('====================================================');
    lines.push('VISÃO EXECUTIVA');
    lines.push('====================================================');
    lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    if (from || to) {
      const interval = [from ? new Date(from).toLocaleDateString('pt-BR') : 'início', to ? new Date(to).toLocaleDateString('pt-BR') : 'agora'];
      lines.push(`Período filtrado: ${interval[0]} até ${interval[1]}`);
    } else {
      lines.push('Período filtrado: todo período');
    }
    lines.push('');
    lines.push('> Painel de qualidade e risco');
    lines.push(`- Baixa confiança (IA): ${qualityFlags.lowConfidenceRate || 0}%`);
    lines.push(`- Revisão humana pendente: ${qualityFlags.pendingReviewRate || 0}%`);
    lines.push(`- Análises com falha: ${qualityFlags.failedAnalysisRate || 0}%`);
    const riskTotal = riskSignals?.totalSignals || 0;
    const highRisk = Number(riskSignals?.totals?.alto || 0);
    const riskRatio = riskTotal > 0 ? Number(((highRisk / riskTotal) * 100).toFixed(1)) : 0;
    lines.push(`- Risco alto total: ${highRisk} sinais (${riskRatio}%)`);
    lines.push('- Ações sugeridas:');
    if ((narratives?.acoesSugeridas?.length || 0) > 0) {
      narratives.acoesSugeridas.forEach((item) => lines.push(`  • ${item}`));
    } else {
      lines.push('  • Nenhuma ação sugerida automática no período.');
    }

    lines.push('');
    lines.push('> Conversão geral');
    const totalSolic = solicitacoes?.total ?? 0;
    const totalAtend = overview.totalTranscriptions;
    const taxaAtendimento =
      totalSolic > 0 ? ((totalAtend / totalSolic) * 100).toFixed(1) : 'N/A';
    lines.push(`- Solicitações recebidas: ${totalSolic}`);
    lines.push(`- Atendimentos concluídos: ${totalAtend}`);
    lines.push(`- Taxa de atendimento: ${taxaAtendimento}%`);

    lines.push('');
    lines.push('> Janela de alerta (tendência)');
    if ((alerts?.length || 0) > 0) {
      alerts.forEach((item) => lines.push(`- ${item}`));
    } else {
      lines.push('- Sem alertas críticos.');
    }

    lines.push('');
    lines.push('> Janela de alto volume por curso');
    if (concentration?.courses?.selectedItems?.length) {
      concentration.courses.selectedItems
        .slice(0, 6)
        .forEach((entry) => lines.push(`- ${entry.course}: ${entry.count}`));
    } else {
      lines.push('- Sem concentração relevante.');
    }

    lines.push('');
    lines.push('====================================================');
    lines.push('ANEXO TÉCNICO');
    lines.push('====================================================');
    lines.push('Métricas gerais');
    lines.push('');
    lines.push(`- Total de transcrições: ${overview.totalTranscriptions}`);
    lines.push(`- Discentes atendidos: ${overview.totalStudents}`);
    lines.push(`- Solicitações registradas: ${solicitacoes?.total ?? 0}`);
    lines.push(`- Tamanho total (KB): ${Math.round((overview.totalSizeBytes || 0) / 1024)}`);
    lines.push(`- Tamanho médio por registro (KB): ${Math.round((overview.avgSizeBytes || 0) / 1024)}`);
    lines.push('');
    lines.push('> Janelas de desempenho');
    const formatWindow = (window, fallback = 'N/A') => {
      if (!window) return fallback;
      const from = window.from ? new Date(window.from).toLocaleDateString('pt-BR') : 'N/A';
      const to = window.to ? new Date(window.to).toLocaleDateString('pt-BR') : 'N/A';
      return `${from} até ${to} | Transcrições: ${window.transcriptions || 0} | Solicitações: ${window.solicitacoes || 0} | Conversão: ${window.conversionRate || 0}%`;
    };
    lines.push(`- Últimos 30 dias: ${formatWindow(timeWindows?.last30Days)}`);
    lines.push(`- Últimos 90 dias: ${formatWindow(timeWindows?.last90Days)}`);
    lines.push(`- Últimos 6 meses: ${formatWindow(timeWindows?.last6Months)}`);
    lines.push(`- Semestre atual: ${formatWindow(timeWindows?.currentSemester)}`);

    if (attendanceHoursByUser?.users?.length) {
      lines.push('');
      lines.push('> Horas de atendimento por usuário (agendadas e concluídas)');
      attendanceHoursByUser.users.forEach((entry) => {
        lines.push(
          `- ${entry.label}: ${entry.scheduledHours}h agendadas (${entry.scheduledSessions} sessão(ões)) | ${entry.completedHours}h concluídas (${entry.completedSessions} sessão(ões))`,
        );
      });
      lines.push(
        `- Total geral: ${attendanceHoursByUser.totals?.scheduledHours || 0}h agendadas | ${attendanceHoursByUser.totals?.completedHours || 0}h concluídas`,
      );
    }

    if (overview.sentimentsAvg) {
      lines.push('- Sentimento médio:');
      lines.push(`  • Positivo: ${(overview.sentimentsAvg.positive * 100).toFixed(1)}%`);
      lines.push(`  • Neutro: ${(overview.sentimentsAvg.neutral * 100).toFixed(1)}%`);
      lines.push(`  • Negativo: ${(overview.sentimentsAvg.negative * 100).toFixed(1)}%`);
    }

    if (comparativo?.length) {
      const totalSolic = solicitacoes?.total ?? 0;
      const totalAtend = overview.totalTranscriptions;
      const taxaAtendimento =
        totalSolic > 0 ? ((totalAtend / totalSolic) * 100).toFixed(1) : 'N/A';
      lines.push('');
      lines.push('> Conversão geral (Solicitações -> Atendimentos concluídos)');
      lines.push(`- Atendimentos concluídos: ${totalAtend}`);
      lines.push(`- Solicitações recebidas: ${totalSolic}`);
      lines.push(`- Taxa de atendimento: ${taxaAtendimento}%`);
    }

    if (timeline.length > 0) {
      lines.push('');
      lines.push('> Atendimentos concluídos por mês (transcrições)');
      timeline.forEach((entry) => {
        lines.push(`- ${entry.periodLabel}: ${entry.count}`);
      });
    }

    if (atendimentosTimeline?.length) {
      lines.push('');
      lines.push('> Atendimentos concluídos (ajustado)');
      atendimentosTimeline.forEach((entry) => {
        lines.push(`- ${entry.periodLabel}: ${entry.count ?? entry.atendimentosConcluidos ?? 0}`);
      });
    }

    if (solicitacoes?.timeline?.length) {
      lines.push('');
      lines.push('> Solicitações por mês');
      solicitacoes.timeline.forEach((entry) => {
        lines.push(`- ${entry.periodLabel}: ${entry.count}`);
      });
    }

    if (comparativo?.length) {
      lines.push('');
      lines.push('> Comparativo Solicitações x Atendimentos');
      comparativo.forEach((entry) => {
        lines.push(
          `- ${entry.periodLabel}: ${entry.solicitacoes} solicitações | ${entry.atendimentosConcluidos} atendimentos`,
        );
      });
    }

    lines.push('');
    lines.push('> Distribuição por curso');
    if (!byCourse.length) {
      lines.push('- Nenhum curso encontrado');
    } else {
      byCourse.forEach((course) => {
        lines.push(
          `- ${course.course}: ${course.count} transcrições | ${course.distinctStudents} discentes | Último registro: ${course.lastTranscriptionAt ? this._formatDateRaw(course.lastTranscriptionAt) : '---'}`,
        );
        if (course.sentimentsAvg) {
          lines.push(
            `    Sentimento médio: +${(course.sentimentsAvg.positive * 100).toFixed(1)}% / ~${(course.sentimentsAvg.neutral * 100).toFixed(1)}% / -${(course.sentimentsAvg.negative * 100).toFixed(1)}%`,
          );
        }
        if ((course.topTopics && course.topTopics.length) || (course.topKeywords && course.topKeywords.length)) {
          const topics = (course.topTopics || []).slice(0, 3).map((t) => t.term).join(', ');
          const keywords = (course.topKeywords || []).slice(0, 3).map((k) => k.term).join(', ');
          if (topics) lines.push(`    Tópicos principais: ${topics}`);
          if (keywords) lines.push(`    Palavras-chave: ${keywords}`);
        }
      });
    }

    lines.push('');
    lines.push('> Principais palavras-chave');
    if (!highlights.topKeywords?.length) {
      lines.push('- Nenhum dado disponível');
    } else {
      highlights.topKeywords.forEach((keyword) => {
        lines.push(`- ${keyword.term}: ${keyword.count} citações`);
      });
    }

    lines.push('');
    lines.push('> Principais tópicos');
    if (!highlights.topTopics?.length) {
      lines.push('- Nenhum dado disponível');
    } else {
      highlights.topTopics.forEach((topic) => {
        lines.push(`- ${topic.term}: ${topic.count} citações`);
      });
    }

    return {
      fileName: `relatorio_geral_${Date.now()}.txt`,
      content: lines.join('\n'),
    };
  }

  async getOverviewExportPdf({ from = null, to = null, forceRefresh = false } = {}) {
    const {
      riskSignals,
      narratives,
      overview,
      attendanceHoursByUser,
      highlights,
      timeline,
      solicitacoes,
      comparativo,
      byCourse,
      atendimentosTimeline,
    } = await this.getOverviewData({ from, to, forceRefresh });

    const content = await this._buildPdfBuffer((doc) => {
      doc.fontSize(18).text('Relatório geral de atendimentos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      doc.moveDown();

      doc.fontSize(14).text('Visão geral', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Total de transcrições: ${overview.totalTranscriptions}`);
      doc.text(`Total de discentes atendidos: ${overview.totalStudents}`);
      doc.text(`Tamanho total (KB): ${Math.round((overview.totalSizeBytes || 0) / 1024)}`);
      doc.text(
        `Tamanho médio por registro (KB): ${Math.round(
          (overview.avgSizeBytes || 0) / 1024,
        )}`,
      );
      doc.text(`Solicitações registradas: ${solicitacoes?.total ?? 0}`);

      if (overview.sentimentsAvg) {
        doc.moveDown(0.5);
        doc.text('Sentimento médio geral:');
        doc.text(
          `Positivo: ${(overview.sentimentsAvg.positive * 100).toFixed(1)}% | Neutro: ${(overview.sentimentsAvg.neutral * 100).toFixed(1)}% | Negativo: ${(overview.sentimentsAvg.negative * 100).toFixed(1)}%`,
        );
      }

      if (comparativo?.length) {
        doc.moveDown();
        doc.fontSize(14).text('Conversão geral', { underline: true });
        const totalSolic = solicitacoes?.total ?? 0;
        const totalAtend = overview.totalTranscriptions;
        const taxaAtendimento =
          totalSolic > 0 ? ((totalAtend / totalSolic) * 100).toFixed(1) : 'N/A';
        doc.moveDown(0.3);
        doc.fontSize(12);
        doc.text(`Atendimentos concluídos: ${totalAtend}`);
        doc.text(`Solicitações recebidas: ${totalSolic}`);
        doc.text(`Taxa de atendimento: ${taxaAtendimento}%`);
      }

      if (atendimentosTimeline?.length) {
        doc.moveDown();
        doc.fontSize(14).text('Atendimentos concluídos por mês', { underline: true });
        doc.moveDown(0.3);
        atendimentosTimeline.forEach((entry) => {
          doc.fontSize(12).text(`${entry.periodLabel}: ${entry.count ?? entry.atendimentosConcluidos ?? 0}`);
        });
      }

      if (solicitacoes?.timeline?.length) {
        doc.moveDown();
        doc.fontSize(14).text('Solicitações por mês', { underline: true });
        doc.moveDown(0.3);
        solicitacoes.timeline.forEach((entry) => {
          doc.fontSize(12).text(`${entry.periodLabel}: ${entry.count} solicitações`);
        });
      }

      if (comparativo?.length) {
        doc.moveDown();
        doc.fontSize(14).text('Comparativo Solicitações x Atendimentos', { underline: true });
        doc.moveDown(0.3);
        comparativo.forEach((entry) => {
          doc.fontSize(12).text(
            `${entry.periodLabel}: ${entry.solicitacoes} solicitações | ${entry.atendimentosConcluidos} atendimentos`,
          );
        });
      }

      if (attendanceHoursByUser?.users?.length) {
        doc.moveDown();
        doc.fontSize(14).text('Horas de atendimento por usuário', { underline: true });
        doc.moveDown(0.3);
        attendanceHoursByUser.users.forEach((entry) => {
          doc.fontSize(12).text(
            `${entry.label}: ${entry.scheduledHours}h agendadas (${entry.scheduledSessions}) | ${entry.completedHours}h concluídas (${entry.completedSessions})`,
          );
        });
        doc.moveDown(0.2);
        doc.fontSize(12).text(
          `Total geral: ${attendanceHoursByUser.totals?.scheduledHours || 0}h agendadas | ${attendanceHoursByUser.totals?.completedHours || 0}h concluídas`,
        );
      }

      doc.moveDown();
      doc.fontSize(14).text('Distribuição por curso', { underline: true });
      doc.moveDown(0.5);
      if (byCourse.length === 0) {
        doc.fontSize(12).text('Nenhum curso encontrado.');
      } else {
        byCourse.forEach((course) => {
          doc
            .fontSize(12)
            .text(
              `${course.course} - ${course.count} transcrições | ${course.distinctStudents} discentes | Último registro: ${
                course.lastTranscriptionAt
                  ? this._formatDateRaw(course.lastTranscriptionAt)
                  : '---'
              }`,
            );
          doc.moveDown(0.2);
        });
      }

      doc.moveDown();
      doc.fontSize(14).text('Principais palavras-chave', { underline: true });
      doc.moveDown(0.5);
      if (!highlights.topKeywords?.length) {
        doc.fontSize(12).text('Nenhum dado disponível.');
      } else {
        highlights.topKeywords.forEach((keyword) => {
          doc.fontSize(12).text(`${keyword.term}: ${keyword.count} citações`);
        });
      }

      doc.moveDown();
      doc.fontSize(14).text('Principais tópicos', { underline: true });
      doc.moveDown(0.5);
      if (!highlights.topTopics?.length) {
        doc.fontSize(12).text('Nenhum dado disponível.');
      } else {
        highlights.topTopics.forEach((topic) => {
          doc.fontSize(12).text(`${topic.term}: ${topic.count} citações`);
        });
      }

    });

    return {
      fileName: `relatorio_geral_${Date.now()}.pdf`,
      content: content,
    };
  }

  async getByCourseDetails({ courseFilter } = {}) {
    const all = await this.transcriptionService.listTranscriptionsWithMetadata();
    const filteredCourse =
      typeof courseFilter === 'string' ? courseFilter.trim() : null;

    const courseMap = new Map();

    for (const t of all) {
      const course = t.metadata?.curso || 'Não informado';

      if (filteredCourse && course !== filteredCourse) {
        continue;
      }

      if (!courseMap.has(course)) {
        courseMap.set(course, {
          course,
          transcriptions: [],
        });
      }

      courseMap.get(course).transcriptions.push(t);
    }

    const courses = [];

    for (const { transcriptions, course } of courseMap.values()) {
      const totalTranscriptions = transcriptions.length;

      const studentsSet = new Set(
        transcriptions
          .map((t) => t.metadata?.discenteId)
          .filter(Boolean),
      );
      const totalStudents = studentsSet.size;

      let sentimentsAvg = null;
      let sumPos = 0;
      let sumNeu = 0;
      let sumNeg = 0;
      let countSent = 0;

      const allKeywords = [];
      const allTopics = [];

      for (const t of transcriptions) {
        const a = t.analysis || {};

        if (a.sentiments) {
          sumPos += a.sentiments.positive || 0;
          sumNeu += a.sentiments.neutral || 0;
          sumNeg += a.sentiments.negative || 0;
          countSent++;
        }

        if (Array.isArray(a.keywords)) {
          allKeywords.push(...this._extractTextList(a.keywords));
        }
        if (Array.isArray(a.topics)) {
          allTopics.push(...this._extractTextList(a.topics));
        }
      }

      if (countSent > 0) {
        sentimentsAvg = {
          positive: sumPos / countSent,
          neutral: sumNeu / countSent,
          negative: sumNeg / countSent,
        };
      }

      const topKeywords = this._buildFrequencyMap(allKeywords).slice(0, 10);
      const topTopics = this._buildFrequencyMap(allTopics).slice(0, 10);

      courses.push({
        course,
        totalTranscriptions,
        totalStudents,
        sentimentsAvg,
        topKeywords,
        topTopics,
      });
    }

    courses.sort((a, b) => b.totalTranscriptions - a.totalTranscriptions);

    return {
      totalCourses: courses.length,
      courses,
    };
  }

  async getByDiscenteData(discenteId) {
    const normalizedDiscenteId = this._safeToString(discenteId);
    if (!normalizedDiscenteId) {
      return {
        totalTranscriptions: 0,
        totalSizeBytes: 0,
        sentimentsAvg: null,
        transcriptions: [],
        historyPatterns: {},
        monthlySentimentTimeline: [],
      };
    }

    const list = await this.transcriptionService.listTranscriptionsWithMetadata({
      discenteId,
    });

    const filtered = list.filter((entry) =>
      this._safeToString(entry?.metadata?.discenteId) === normalizedDiscenteId,
    );

    const orderedTranscriptions = [...filtered].sort((a, b) => {
      const dateA = this._toDate(a?.createdAt)?.getTime() || 0;
      const dateB = this._toDate(b?.createdAt)?.getTime() || 0;
      return dateB - dateA;
    });

    const totalTranscriptions = filtered.length;
    const totalSizeBytes = filtered.reduce(
      (sum, t) => sum + (t.size || 0),
      0,
    );

    const historyPatterns = this._buildDiscentePatterns(filtered);

    let sentimentsAvg = null;
    if (totalTranscriptions > 0) {
      const sums = filtered.reduce(
        (acc, t) => {
          const s = t.analysis?.sentiments || {};
          return {
            positive: acc.positive + (s.positive || 0),
            neutral: acc.neutral + (s.neutral || 0),
            negative: acc.negative + (s.negative || 0),
          };
        },
        { positive: 0, neutral: 0, negative: 0 },
      );
      sentimentsAvg = {
        positive: sums.positive / totalTranscriptions,
        neutral: sums.neutral / totalTranscriptions,
        negative: sums.negative / totalTranscriptions,
      };
    }

    const monthlySentimentTimeline = this._buildMonthlySentimentTimeline(
      filtered,
      'createdAt',
    );

    return {
      totalTranscriptions,
      totalSizeBytes,
      sentimentsAvg,
      transcriptions: orderedTranscriptions,
      historyPatterns,
      monthlySentimentTimeline,
    };
  }

  async getByDiscenteExportText(discenteId) {
    const data = await this.getByDiscenteData(discenteId);
    const { totalTranscriptions, sentimentsAvg, transcriptions, historyPatterns } = data;
    const metadata = await this._getDiscenteExportMetadata(discenteId, transcriptions);

    const lines = [];
    lines.push(`Relatório do discente ${metadata.discenteName}`);
    lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    lines.push('----------------------------------------');
    lines.push(`Total de transcrições: ${totalTranscriptions}`);

    if (sentimentsAvg) {
      lines.push(
        `Sentimento médio: +${(sentimentsAvg.positive * 100).toFixed(1)}% / ~${(sentimentsAvg.neutral * 100).toFixed(1)}% / -${(sentimentsAvg.negative * 100).toFixed(1)}%`,
      );
    }

    lines.push('');
    lines.push('Padrões percebidos:');
    if (
      !historyPatterns ||
      (!historyPatterns.recurringThemes?.length &&
        !historyPatterns.repeatedIdeas?.length &&
        !historyPatterns.emotionalPatterns?.length &&
        !historyPatterns.commonTriggers?.length)
    ) {
      lines.push('- Nenhum padrão identificado até o momento.');
    } else {
      if (historyPatterns.recurringThemes?.length) {
        lines.push(`- Temas recorrentes: ${historyPatterns.recurringThemes.join(', ')}`);
      }
      if (historyPatterns.repeatedIdeas?.length) {
        lines.push(`- Ideias repetidas: ${historyPatterns.repeatedIdeas.join(', ')}`);
      }
      if (historyPatterns.emotionalPatterns?.length) {
        lines.push(`- Padrões emocionais: ${historyPatterns.emotionalPatterns.join(', ')}`);
      }
      if (historyPatterns.commonTriggers?.length) {
        lines.push(`- Próximos passos sugeridos: ${historyPatterns.commonTriggers.join(', ')}`);
      }
    }

    lines.push('');
    lines.push('Transcrições:');
    if (!transcriptions.length) {
      lines.push('- Nenhuma transcrição registrada.');
    } else {
      transcriptions
        .sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt) : null;
          const db = b.createdAt ? new Date(b.createdAt) : null;
          if (!da || !db) return 0;
          return db - da;
        })
        .forEach((t) => {
          lines.push(
            `- ${t.fileName || 'Sem nome'} | ${this._formatDate(t.createdAt)} | ${(t.size || 0) / 1024 >= 1 ? `${Math.round((t.size || 0) / 1024)} KB` : `${t.size || 0} B`}`,
          );
          if (t.analysis?.summary) {
            lines.push(`  resumo: ${t.analysis.summary}`);
          }
        });
    }

    return {
      fileName: `${metadata.fileName}.txt`,
      content: lines.join('\n'),
    };
  }

  async getByDiscenteExportPdf(discenteId) {
    const data = await this.getByDiscenteData(discenteId);
    const { totalTranscriptions, sentimentsAvg, transcriptions, historyPatterns } = data;
    const metadata = await this._getDiscenteExportMetadata(discenteId, transcriptions);

    const sorted = [...transcriptions].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : null;
      const db = b.createdAt ? new Date(b.createdAt) : null;
      if (!da || !db) return 0;
      return db - da;
    });

    const content = await this._buildPdfBuffer((doc) => {
      doc.fontSize(16).text(`Relatório do discente ${metadata.discenteName}`, {
        underline: true,
      });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('gray').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      doc.fillColor('black');
      doc.moveDown();

      doc.fontSize(12).text('Resumo', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).text(`Total de transcrições: ${totalTranscriptions}`);
      if (sentimentsAvg) {
        doc.text(
          `Sentimento médio: +${(sentimentsAvg.positive * 100).toFixed(1)}% / ~${(sentimentsAvg.neutral * 100).toFixed(1)}% / -${(sentimentsAvg.negative * 100).toFixed(1)}%`,
        );
      }

      doc.moveDown();
      doc.fontSize(12).text('Padrões percebidos', { underline: true });
      doc.moveDown(0.3);
      const patterns = [];
      if (historyPatterns?.recurringThemes?.length) {
        patterns.push(`Temas recorrentes: ${historyPatterns.recurringThemes.join(', ')}`);
      }
      if (historyPatterns?.repeatedIdeas?.length) {
        patterns.push(`Ideias repetidas: ${historyPatterns.repeatedIdeas.join(', ')}`);
      }
      if (historyPatterns?.emotionalPatterns?.length) {
        patterns.push(`Padrões emocionais: ${historyPatterns.emotionalPatterns.join(', ')}`);
      }
      if (historyPatterns?.commonTriggers?.length) {
        patterns.push(`Próximos passos sugeridos: ${historyPatterns.commonTriggers.join(', ')}`);
      }
      if (patterns.length === 0) {
        doc.fontSize(10).fillColor('gray').text('Nenhum padrão identificado até o momento.');
        doc.fillColor('black');
      } else {
        patterns.forEach((p) => {
          doc.fontSize(10).text(`• ${p}`);
        });
      }

      doc.moveDown();
      doc.fontSize(12).text('Transcrições', { underline: true });
      doc.moveDown(0.3);
      if (!sorted.length) {
        doc.fontSize(10).fillColor('gray').text('Nenhuma transcrição registrada.');
        doc.fillColor('black');
      } else {
        sorted.forEach((t) => {
          doc.fontSize(10).text(`${t.fileName || 'Sem nome'} | ${this._formatDate(t.createdAt)}`);
          if (t.analysis?.summary) {
            doc.fontSize(9).fillColor('gray').text(`Resumo: ${t.analysis.summary}`);
            doc.fillColor('black');
          }
          doc.moveDown(0.4);
        });
      }

    });

    return {
      fileName: `${metadata.fileName}.pdf`,
      content,
    };
  }

  async getAnalytics() {
    const transcriptions = await this.transcriptionService.listTranscriptionsWithMetadata();

    const withAnalysis = transcriptions.filter(
      (t) => t?.analysis?.sentiments || t?.analysis?.keywords || t?.analysis?.topics,
    );

    if (transcriptions.length === 0 || withAnalysis.length === 0) {
      return {
        analytics: null,
        message: 'Nenhuma transcrição com análise disponível para análise automática',
      };
    }

    const sortedAnalysis = [...withAnalysis].sort((a, b) => {
      const dateA = this._toDate(a?.createdAt)?.getTime() || 0;
      const dateB = this._toDate(b?.createdAt)?.getTime() || 0;
      return dateA - dateB;
    });

    const validAnalytics = sortedAnalysis.map((item) => ({
      fileName: item.fileName,
      createdAt: item.createdAt,
      analysis: item.analysis,
    }));

    let totalPositive = 0;
    let totalNeutral = 0;
    let totalNegative = 0;
    const allKeywords = [];
    const allTopics = [];

    const validForSentiment = validAnalytics.filter((a) => a.analysis?.sentiments);

    validAnalytics.forEach((a) => {
      if (a.analysis?.sentiments) {
        totalPositive += a.analysis.sentiments.positive || 0;
        totalNeutral += a.analysis.sentiments.neutral || 0;
        totalNegative += a.analysis.sentiments.negative || 0;
      }

      if (a.analysis?.keywords) {
        const normalizedKeywords = Array.isArray(a.analysis.keywords)
          ? a.analysis.keywords
          : [];
        normalizedKeywords.forEach((keyword) => {
          const value =
            typeof keyword === 'string'
              ? keyword
              : keyword?.term || keyword?.keyword || keyword?.label;
          if (value) allKeywords.push(value);
        });
      }

      if (a.analysis?.topics) {
        const normalizedTopics = Array.isArray(a.analysis.topics)
          ? a.analysis.topics
          : [];
        normalizedTopics.forEach((topic) => {
          const value =
            typeof topic === 'string'
              ? topic
              : topic?.term || topic?.topic || topic?.label;
          if (value) allTopics.push(value);
        });
      }
    });

    const count = validForSentiment.length;
    const avgSentiments =
      count > 0
        ? {
            positive: (totalPositive / count).toFixed(2),
            neutral: (totalNeutral / count).toFixed(2),
            negative: (totalNegative / count).toFixed(2),
          }
        : { positive: 0, neutral: 0, negative: 0 };

    const keywordFreq = {};
    allKeywords.forEach((keyword) => {
      keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
    });

    const topKeywords = Object.entries(keywordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    const topicFreq = {};
    allTopics.forEach((topic) => {
      topicFreq[topic] = (topicFreq[topic] || 0) + 1;
    });

    const topTopics = Object.entries(topicFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    return {
      analytics: {
        totalAnalyzed: count,
        averageSentiments: avgSentiments,
        topKeywords,
        topTopics,
        recentAnalytics: validAnalytics.slice(-5),
        sentimentTimeline: this._buildMonthlySentimentTimeline(
          validAnalytics,
          'createdAt',
        ),
      },
    };
  }

  async getExportJsonData() {
    const transcriptions = await this.transcriptionService.listTranscriptions();

    return {
      exportedAt: new Date().toISOString(),
      totalTranscriptions: transcriptions.length,
      transcriptions: transcriptions.map((t) => {
        const content = this.transcriptionService.getTranscription(t.fileName);
        return {
          fileName: t.fileName,
          createdAt: t.createdAt,
          size: t.size,
          content: content ? content.content : null,
          metadata: content ? content.metadata : null,
          analysis: content ? content.analysis : null,
        };
      }),
    };
  }

  async getExportText() {
    const allTranscriptions =
      await this.transcriptionService.listTranscriptionsWithMetadata();
    let reportText = `Relatório de Transcrições - Exportado em: ${new Date().toISOString()}\n\n`;
    reportText += `Total de Transcrições: ${allTranscriptions.length}\n`;
    reportText += '==================================================\n\n';

    for (const t of allTranscriptions) {
      const fullContent = this.transcriptionService.getTranscription(t.fileName);
      if (!fullContent) continue;

      reportText += `--- Transcrição: ${t.fileName} ---\n`;
      reportText += `Data de Criação: ${new Date(t.createdAt).toLocaleString()}\n`;
      reportText += `Tamanho (bytes): ${t.size}\n`;
      reportText += '\n[Metadados]\n';
      for (const [key, value] of Object.entries(fullContent.metadata || {})) {
        reportText += `- ${key}: ${value}\n`;
      }
      reportText += '\n[Análise]\n';
      const sentiments = fullContent.analysis?.sentiments || {};
      reportText += `- Resumo: ${fullContent.analysis?.summary || 'N/A'}\n`;
      reportText += `- Sentimentos: Positivo: ${((sentiments.positive || 0) * 100).toFixed(2)}%, Neutro: ${((sentiments.neutral || 0) * 100).toFixed(2)}%, Negativo: ${((sentiments.negative || 0) * 100).toFixed(2)}%\n`;
      const keywords = Array.isArray(fullContent.analysis?.keywords)
        ? fullContent.analysis.keywords.map((item) =>
            typeof item === 'string' ? item : item?.term || item?.keyword || item?.label,
          )
        : [];
      const topics = Array.isArray(fullContent.analysis?.topics)
        ? fullContent.analysis.topics.map((item) =>
            typeof item === 'string' ? item : item?.term || item?.topic || item?.label,
          )
        : [];
      reportText += `- Palavras-chave: ${keywords.join(', ')}\n`;
      reportText += `- Tópicos: ${topics.join(', ')}\n`;
      reportText += '\n[Insights Acionáveis]\n';
      (fullContent.analysis?.actionableInsights || []).forEach((insight, index) => {
        reportText += `- ${index + 1}. ${insight}\n`;
      });
      reportText += `\n[Conteúdo da Transcrição]\n`;
      reportText += `${fullContent.content}\n\n`;
      reportText += '--------------------------------------------------\n\n';
    }

    return {
      fileName: `transcriptions_report_${Date.now()}.txt`,
      content: reportText,
    };
  }

  async searchTranscriptions({ solicitante, curso, dataInicio, dataFim, palavra } = {}) {
    let transcriptions = await this.transcriptionService.listTranscriptionsWithMetadata();

    if (solicitante) {
      const s = this._safeToString(solicitante)?.toLowerCase();
      if (s) {
        transcriptions = transcriptions.filter((t) => {
          const name = this._safeToString(t.metadata?.studentName)?.toLowerCase() || '';
          const email = this._safeToString(t.metadata?.studentEmail)?.toLowerCase() || '';
          const ra =
            this._safeToString(t.metadata?.matricula)?.toLowerCase() ||
            this._safeToString(t.metadata?.studentId)?.toLowerCase() ||
            '';
          return name.includes(s) || email.includes(s) || ra.includes(s);
        });
      }
    }

    if (curso) {
      const c = this._safeToString(curso)?.toLowerCase();
      if (c) {
        transcriptions = transcriptions.filter((t) => {
          const course = this._safeToString(t.metadata?.curso)?.toLowerCase() || '';
          return course.includes(c);
        });
      }
    }

    if (dataInicio) {
      const dIni = this._toDate(dataInicio);
      if (dIni) {
        transcriptions = transcriptions.filter((t) => {
          const createdAt = this._toDate(t.createdAt);
          return createdAt && createdAt >= dIni;
        });
      }
    }

    if (dataFim) {
      const dFim = this._toDate(dataFim);
      if (dFim) {
        const endOfDay = new Date(dFim);
        endOfDay.setHours(23, 59, 59, 999);
        transcriptions = transcriptions.filter((t) => {
          const createdAt = this._toDate(t.createdAt);
          return createdAt && createdAt <= endOfDay;
        });
      }
    }

    if (palavra) {
      const p = this._safeToString(palavra)?.toLowerCase();
      if (p) {
        transcriptions = transcriptions.filter((t) => {
          const summary = this._safeToString(t.analysis?.summary)?.toLowerCase() || '';
          const keywords = this._extractTextList(t.analysis?.keywords || []).map((k) =>
            k.toLowerCase(),
          );
          return summary.includes(p) || keywords.some((k) => k.includes(p));
        });
      }
    }

    return transcriptions;
  }
}

export default ReportsService;
