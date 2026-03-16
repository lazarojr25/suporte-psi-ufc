import PDFDocument from 'pdfkit';

class ReportsService {
  constructor(db, transcriptionService) {
    this.db = db;
    this.transcriptionService = transcriptionService;
    this.monthLabelFormatter = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
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

  async getOverviewData() {
    this._requireDb();
    const all = this.transcriptionService.listTranscriptionsWithMetadata();
    const solicitacoes = this._loadSolicitacoes();

    const [allTranscriptions, allSolicitacoes] = await Promise.all([
      all,
      solicitacoes,
    ]);

    const totalTranscriptions = allTranscriptions.length;
    const totalSizeBytes = allTranscriptions.reduce(
      (sum, t) => sum + (t.size || 0),
      0,
    );
    const avgSizeBytes =
      totalTranscriptions > 0 ? totalSizeBytes / totalTranscriptions : 0;

    const studentsSet = new Set(
      allTranscriptions
        .map((t) => t.metadata?.discenteId)
        .filter(Boolean),
    );
    const totalStudents = studentsSet.size;

    let sentimentsAvg = null;
    let sumPos = 0;
    let sumNeu = 0;
    let sumNeg = 0;
    let countSent = 0;

    for (const t of allTranscriptions) {
      const s = t.analysis?.sentiments;
      if (!s) continue;
      sumPos += s.positive || 0;
      sumNeu += s.neutral || 0;
      sumNeg += s.negative || 0;
      countSent++;
    }

    if (countSent > 0) {
      sentimentsAvg = {
        positive: sumPos / countSent,
        neutral: sumNeu / countSent,
        negative: sumNeg / countSent,
      };
    }

    const byCourseMap = {};

    for (const t of allTranscriptions) {
      const course = t.metadata?.curso || 'Não informado';
      const analysis = t.analysis || {};

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

      const createdAt = this._toDate(t.createdAt);
      if (createdAt) {
        const currentLast = entry.lastTranscriptionAt
          ? new Date(entry.lastTranscriptionAt)
          : null;

        if (!currentLast || createdAt > currentLast) {
          entry.lastTranscriptionAt = createdAt.toISOString();
        }
      }

      if (analysis.sentiments) {
        entry.sentimentCount += 1;
        entry.sumPos += analysis.sentiments.positive || 0;
        entry.sumNeu += analysis.sentiments.neutral || 0;
        entry.sumNeg += analysis.sentiments.negative || 0;
      }

      if (Array.isArray(analysis.keywords)) {
        this._extractTextList(analysis.keywords).forEach((kw) => entry.keywords.push(kw));
      }

      if (Array.isArray(analysis.topics)) {
        this._extractTextList(analysis.topics).forEach((topic) =>
          entry.topics.push(topic),
        );
      }
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

    for (const t of allTranscriptions) {
      const a = t.analysis || {};
      if (Array.isArray(a.keywords)) {
        allKeywords.push(...this._extractTextList(a.keywords));
      }
      if (Array.isArray(a.topics)) {
        allTopics.push(...this._extractTextList(a.topics));
      }
    }

    const topKeywords = this._buildFrequencyMap(allKeywords).slice(0, 10);
    const topTopics = this._buildFrequencyMap(allTopics).slice(0, 10);

    const solicitacoesTimelineRaw = this._buildMonthlyTimeline(
      allSolicitacoes,
      'createdAt',
    );
    const solicitacoesTimeline = solicitacoesTimelineRaw.map(
      ({ sortValue, ...rest }) => rest,
    );

    const periodWithMostSolic = solicitacoesTimeline.reduce(
      (max, current) => {
        if (!max) return current;
        return current.count > max.count ? current : max;
      },
      null,
    );

    const timelineRaw = this._buildMonthlyTimeline(allTranscriptions, 'createdAt');
    const timeline = timelineRaw.map(({ sortValue, ...rest }) => rest);

    const periodWithMostRequests = timeline.reduce(
      (max, current) => {
        if (!max) return current;
        return current.count > max.count ? current : max;
      },
      null,
    );

    const sentimentsTimeline = this._buildMonthlySentimentTimeline(
      allTranscriptions,
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
        return {
          period,
          periodLabel: solicit?.periodLabel || atend?.periodLabel || period,
          solicitacoes: solicit?.count || 0,
          atendimentosConcluidos: atend?.count || 0,
          sortValue,
        };
      })
      .sort((a, b) => a.sortValue - b.sortValue);

    return {
      overview: {
        totalTranscriptions,
        totalSizeBytes,
        avgSizeBytes,
        totalStudents,
        sentimentsAvg,
      },
      byCourse,
      highlights: {
        topKeywords,
        topTopics,
      },
      sentimentsTimeline,
      timeline,
      periodWithMostRequests,
      solicitacoes: {
        total: allSolicitacoes.length,
        timeline: solicitacoesTimeline,
        peak: periodWithMostSolic,
      },
      comparativo: comparativoTimeline,
      atendimentosTimeline,
    };
  }

  async getOverviewExportText() {
    const {
      overview,
      highlights,
      timeline,
      solicitacoes,
      comparativo,
      byCourse,
      atendimentosTimeline,
    } = await this.getOverviewData();

    const lines = [];
    lines.push('====================================================');
    lines.push(' Relatório geral de atendimentos');
    lines.push('====================================================');
    lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    lines.push('');
    lines.push('> Visão geral');
    lines.push(`- Total de transcrições: ${overview.totalTranscriptions}`);
    lines.push(`- Discentes atendidos: ${overview.totalStudents}`);
    lines.push(`- Solicitações registradas: ${solicitacoes?.total ?? 0}`);
    lines.push(`- Tamanho total (KB): ${Math.round((overview.totalSizeBytes || 0) / 1024)}`);
    lines.push(`- Tamanho médio por registro (KB): ${Math.round((overview.avgSizeBytes || 0) / 1024)}`);

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

  async getOverviewExportPdf() {
    const {
      overview,
      highlights,
      timeline,
      solicitacoes,
      comparativo,
      byCourse,
      atendimentosTimeline,
    } = await this.getOverviewData();

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
    const filtered = await this.transcriptionService.listTranscriptionsWithMetadata({
      discenteId,
    });
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
