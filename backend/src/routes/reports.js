import TranscriptionService from '../services/transcriptionService.js';
import express from 'express';
import PDFDocument from 'pdfkit';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const router = express.Router();

const transcriptionService = new TranscriptionService();

// Firestore (para consultar solicitações)
let db = null;
try {
  initializeApp({
    credential: applicationDefault(),
  });
  db = getFirestore();
} catch (error) {
  if (/already exists/u.test(error.message)) {
    db = getFirestore();
  } else {
    console.error('Erro ao inicializar Firebase Admin em reports:', error);
  }
}
/**
 * Agrupa e ordena frequência de termos (keywords, tópicos, etc.)
 */
function buildFrequencyMap(values = []) {
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

const monthLabelFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

const makeSafe = (value) =>
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const makeSafeSlug = (name, matricula, fallback) => {
  const safeName = makeSafe(name);
  const safeMatricula = makeSafe(matricula);
  return [safeName, safeMatricula].filter(Boolean).join('_') || makeSafe(fallback) || 'discente';
};

async function getDiscenteInfo(discenteId) {
  if (!db || !discenteId) return null;
  try {
    const ref = db.collection('discentes').doc(discenteId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.warn('Falha ao ler discente para relatório:', err?.message);
    return null;
  }
}

async function getFirstSolicitacaoByDiscente(discenteId) {
  if (!db || !discenteId) return null;
  try {
    const snap = await db
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

function buildDiscentePatterns(transcriptions = []) {
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
            ? normalizeString(topic)
            : normalizeString(topic?.term || topic?.topic || topic?.label);
        if (normalized) topics.push(normalized);
      });
    }

    if (Array.isArray(analysis.keywords)) {
      analysis.keywords.forEach((keyword) => {
        const normalized =
          typeof keyword === 'string'
            ? normalizeString(keyword)
            : normalizeString(keyword?.term || keyword?.keyword || keyword?.label);
        if (normalized) keywords.push(normalized);
      });
    }

    if (Array.isArray(analysis.actionableInsights)) {
      analysis.actionableInsights.forEach((insight) => {
        const normalized = normalizeString(insight);
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

  const recurringThemes = buildFrequencyMap(topics)
    .slice(0, 4)
    .map(({ term }) => term);

  const repeatedIdeas = buildFrequencyMap(keywords)
    .slice(0, 6)
    .map(({ term }) => term);

  let commonTriggers = buildFrequencyMap(actionable)
    .slice(0, 4)
    .map(({ term }) => term);
  if (!commonTriggers.length) {
    commonTriggers = buildFrequencyMap(keywords)
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
        `Predomínio de sentimentos ${ranking[0].label} (~${ranking[0].value.toFixed(0)}%)`
      );
    }
    if (ranking[1].value >= 20) {
      emotionalPatterns.push(
        `Presença relevante de sentimentos ${ranking[1].label} (~${ranking[1].value.toFixed(0)}%)`
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

async function loadSolicitacoes() {
  if (!db) return [];
  try {
    const snap = await db.collection('solicitacoesAtendimento').get();
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

async function computeOverviewData() {
  const all = await transcriptionService.listTranscriptionsWithMetadata();
  const solicitacoes = await loadSolicitacoes();

  const totalTranscriptions = all.length;
  const totalSizeBytes = all.reduce((sum, t) => sum + (t.size || 0), 0);
  const avgSizeBytes =
    totalTranscriptions > 0 ? totalSizeBytes / totalTranscriptions : 0;

  const studentsSet = new Set(
    all
      .map((t) => t.metadata?.discenteId)
      .filter(Boolean)
  );
  const totalStudents = studentsSet.size;

  let sentimentsAvg = null;
  let sumPos = 0;
  let sumNeu = 0;
  let sumNeg = 0;
  let countSent = 0;

  for (const t of all) {
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

  for (const t of all) {
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

    const createdAt = t.createdAt ? new Date(t.createdAt) : null;
    if (createdAt && !Number.isNaN(createdAt)) {
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
      analysis.keywords.forEach((kw) => {
        const normalized =
          typeof kw === 'string'
            ? normalizeString(kw)
            : normalizeString(kw?.term || kw?.keyword || kw?.label);
        if (normalized) entry.keywords.push(normalized);
      });
    }

    if (Array.isArray(analysis.topics)) {
      analysis.topics.forEach((topic) => {
        const normalized =
          typeof topic === 'string'
            ? normalizeString(topic)
            : normalizeString(topic?.term || topic?.topic || topic?.label);
        if (normalized) entry.topics.push(normalized);
      });
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
      topKeywords: buildFrequencyMap(c.keywords).slice(0, 4),
      topTopics: buildFrequencyMap(c.topics).slice(0, 4),
    }))
    .sort((a, b) => b.count - a.count);

  const allKeywords = [];
  const allTopics = [];

  for (const t of all) {
    const a = t.analysis || {};

    if (Array.isArray(a.keywords)) {
      a.keywords.forEach((k) => {
        if (!k) return;
        if (typeof k === 'string') {
          allKeywords.push(k);
        } else if (k.term || k.keyword || k.label) {
          allKeywords.push(k.term || k.keyword || k.label);
        }
      });
    }

    if (Array.isArray(a.topics)) {
      a.topics.forEach((topic) => {
        if (!topic) return;
        if (typeof topic === 'string') {
          allTopics.push(topic);
        } else if (topic.term || topic.topic || topic.label) {
          allTopics.push(topic.term || topic.topic || topic.label);
        }
      });
    }
  }

  const topKeywords = buildFrequencyMap(allKeywords).slice(0, 10);
  const topTopics = buildFrequencyMap(allTopics).slice(0, 10);

  // Timeline de solicitações por mês
  const solicTimelineMap = new Map();
  for (const s of solicitacoes) {
    if (!s.createdAt) continue;
    const createdAt = new Date(s.createdAt);
    if (Number.isNaN(createdAt)) continue;
    const year = createdAt.getFullYear();
    const monthIndex = createdAt.getMonth();
    const periodKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (!solicTimelineMap.has(periodKey)) {
      const monthDate = new Date(year, monthIndex, 1);
      solicTimelineMap.set(periodKey, {
        period: periodKey,
        periodLabel: monthLabelFormatter.format(monthDate),
        count: 0,
        sortValue: year * 100 + (monthIndex + 1),
      });
    }
    solicTimelineMap.get(periodKey).count += 1;
  }

  const solicitacoesTimeline = Array.from(solicTimelineMap.values())
    .sort((a, b) => a.sortValue - b.sortValue)
    .map(({ sortValue, ...rest }) => rest);

  const periodWithMostSolic = solicitacoesTimeline.reduce(
    (max, current) => {
      if (!max) return current;
      return current.count > max.count ? current : max;
    },
    null
  );

  const timelineMap = new Map();
  for (const t of all) {
    if (!t.createdAt) continue;
    const createdAt = new Date(t.createdAt);
    if (Number.isNaN(createdAt)) continue;
    const year = createdAt.getFullYear();
    const monthIndex = createdAt.getMonth();
    const periodKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (!timelineMap.has(periodKey)) {
      const monthDate = new Date(year, monthIndex, 1);
      timelineMap.set(periodKey, {
        period: periodKey,
        periodLabel: monthLabelFormatter.format(monthDate),
        count: 0,
        sortValue: year * 100 + (monthIndex + 1),
      });
    }
    timelineMap.get(periodKey).count += 1;
  }

  const timeline = Array.from(timelineMap.values())
    .sort((a, b) => a.sortValue - b.sortValue)
    .map(({ sortValue, ...rest }) => rest);

  const periodWithMostRequests = timeline.reduce(
    (max, current) => {
      if (!max) return current;
      return current.count > max.count ? current : max;
    },
    null
  );

  // Agrupa atendimentos concluídos (via transcrições) por mês
  const atendimentosTimeline = timeline.map((entry) => ({
    ...entry,
    type: 'concluidos',
  }));

  // Alinha períodos para comparação solicitações x atendimentos
  const solicitacoesByPeriod = new Map(solicitacoesTimeline.map((e) => [e.period, e]));
  const atendimentosByPeriod = new Map(atendimentosTimeline.map((e) => [e.period, e]));

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
    timeline,
    periodWithMostRequests,
    solicitacoes: {
      total: solicitacoes.length,
      timeline: solicitacoesTimeline,
      peak: periodWithMostSolic,
    },
    comparativo: comparativoTimeline,
    atendimentosTimeline,
  };
}

/**
 * Define as rotas de relatórios usando express.Router
 */

  // ===== /api/reports/overview =====
  router.get('/overview', async (req, res) => {
    try {
      const data = await computeOverviewData();
      res.json({
        success: true,
        ...data,
      });
    } catch (error) {
      console.error('Erro no overview de relatórios:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao gerar overview de relatórios',
        error: error.message,
      });
    }
  });

  router.get('/overview/export', async (req, res) => {
    try {
      const data = await computeOverviewData();
      const {
        overview,
        byCourse,
        highlights,
        timeline,
        solicitacoes,
        comparativo,
        atendimentosTimeline,
      } = data;

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
        lines.push(
          `  • Positivo: ${(overview.sentimentsAvg.positive * 100).toFixed(1)}%`
        );
        lines.push(
          `  • Neutro: ${(overview.sentimentsAvg.neutral * 100).toFixed(1)}%`
        );
        lines.push(
          `  • Negativo: ${(overview.sentimentsAvg.negative * 100).toFixed(1)}%`
        );
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
            `- ${entry.periodLabel}: ${entry.solicitacoes} solicitações | ${entry.atendimentosConcluidos} atendimentos`
          );
        });
      }

      lines.push('');
      lines.push('> Distribuição por curso');
      if (byCourse.length === 0) {
        lines.push('- Nenhum curso encontrado');
      } else {
        byCourse.forEach((course) => {
          lines.push(
            `- ${course.course}: ${course.count} transcrições | ${course.distinctStudents} discentes | Último registro: ${course.lastTranscriptionAt ? new Date(course.lastTranscriptionAt).toLocaleDateString('pt-BR') : '---'}`
          );
          if (course.sentimentsAvg) {
            lines.push(
              `    Sentimento médio: +${(course.sentimentsAvg.positive * 100).toFixed(1)}% / ~${(course.sentimentsAvg.neutral * 100).toFixed(1)}% / -${(course.sentimentsAvg.negative * 100).toFixed(1)}%`
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

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="relatorio_geral_${Date.now()}.txt"`
      );
      res.send(lines.join('\n'));
    } catch (error) {
      console.error('Erro ao exportar análise geral:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar análise geral',
        error: error.message,
      });
    }
  });

  router.get('/overview/export-pdf', async (req, res) => {
    try {
      const data = await computeOverviewData();
      const {
        overview,
        byCourse,
        highlights,
        timeline,
        solicitacoes,
        comparativo,
        atendimentosTimeline,
      } = data;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="relatorio_geral_${Date.now()}.pdf"`
      );

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      doc.pipe(res);

      doc.fontSize(18).text('Relatório geral de atendimentos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      doc.moveDown();

      doc.fontSize(14).text('Visão geral', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Total de transcrições: ${overview.totalTranscriptions}`);
      doc.text(`Total de discentes atendidos: ${overview.totalStudents}`);
      doc.text(
        `Tamanho total (KB): ${Math.round((overview.totalSizeBytes || 0) / 1024)}`
      );
      doc.text(
        `Tamanho médio por registro (KB): ${Math.round(
          (overview.avgSizeBytes || 0) / 1024
        )}`
      );
      doc.text(`Solicitações registradas: ${solicitacoes?.total ?? 0}`);

      if (overview.sentimentsAvg) {
        doc.moveDown(0.5);
        doc.text('Sentimento médio geral:');
        doc.text(
          `Positivo: ${(overview.sentimentsAvg.positive * 100).toFixed(
            1
          )}% | Neutro: ${(overview.sentimentsAvg.neutral * 100).toFixed(
            1
          )}% | Negativo: ${(overview.sentimentsAvg.negative * 100).toFixed(1)}%`
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
        doc.fontSize(12).text(`Atendimentos concluídos: ${totalAtend}`);
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
          doc.text(
            `${entry.periodLabel}: ${entry.solicitacoes} solicitações | ${entry.atendimentosConcluidos} atendimentos`
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
                  ? new Date(course.lastTranscriptionAt).toLocaleDateString('pt-BR')
                  : '---'
              }`
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

      doc.end();
    } catch (error) {
      console.error('Erro ao exportar análise geral em PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar análise geral em PDF',
        error: error.message,
      });
    }
  });

  // ===== /api/reports/by-course-details =====
  // Detalha temas, sentimentos e alunos por curso
  router.get('/by-course-details', async (req, res) => {
    try {
      const { course: courseFilter } = req.query;
      const all = await transcriptionService.listTranscriptionsWithMetadata();

      // agrupa por curso
      const courseMap = new Map();

      for (const t of all) {
        const course = t.metadata?.curso || 'Não informado';

        // se veio filtro de curso, aplica
        if (courseFilter && course !== courseFilter) continue;

        if (!courseMap.has(course)) {
          courseMap.set(course, {
            course,
            transcriptions: [],
          });
        }
        courseMap.get(course).transcriptions.push(t);
      }

      // monta resumo por curso
      const courses = [];

      for (const [course, data] of courseMap.entries()) {
        const transcriptions = data.transcriptions;
        const totalTranscriptions = transcriptions.length;

        // discentes distintos
        const studentsSet = new Set(
          transcriptions
            .map((t) => t.metadata?.discenteId)
            .filter(Boolean)
        );
        const totalStudents = studentsSet.size;

        // sentimentos médios
        let sentimentsAvg = null;
        let sumPos = 0;
        let sumNeu = 0;
        let sumNeg = 0;
        let countSent = 0;

        const allKeywords = [];
        const allTopics = [];

        for (const t of transcriptions) {
          const a = t.analysis || {};

          // sentimentos
          if (a.sentiments) {
            sumPos += a.sentiments.positive || 0;
            sumNeu += a.sentiments.neutral || 0;
            sumNeg += a.sentiments.negative || 0;
            countSent++;
          }

          // keywords (array de string ou objetos)
          if (Array.isArray(a.keywords)) {
            a.keywords.forEach((k) => {
              if (!k) return;
              if (typeof k === 'string') {
                allKeywords.push(k);
              } else if (k.term || k.keyword || k.label) {
                allKeywords.push(k.term || k.keyword || k.label);
              }
            });
          }

          // topics (array de string ou objetos)
          if (Array.isArray(a.topics)) {
            a.topics.forEach((topic) => {
              if (!topic) return;
              if (typeof topic === 'string') {
                allTopics.push(topic);
              } else if (topic.term || topic.topic || topic.label) {
                allTopics.push(topic.term || topic.topic || topic.label);
              }
            });
          }
        }

        if (countSent > 0) {
          sentimentsAvg = {
            positive: sumPos / countSent,
            neutral: sumNeu / countSent,
            negative: sumNeg / countSent,
          };
        }

        // frequência de termos só naquele curso
        const topKeywords = buildFrequencyMap(allKeywords).slice(0, 10);
        const topTopics = buildFrequencyMap(allTopics).slice(0, 10);

        courses.push({
          course,
          totalTranscriptions,
          totalStudents,
          sentimentsAvg,
          topKeywords,
          topTopics,
        });
      }

      // ordena por quantidade de transcrições (maior primeiro)
      courses.sort((a, b) => b.totalTranscriptions - a.totalTranscriptions);

      res.json({
        success: true,
        data: {
          totalCourses: courses.length,
          courses,
        },
      });
    } catch (error) {
      console.error('Erro em /reports/by-course-details:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao gerar detalhes por curso',
        error: error.message,
      });
    }
  });

  // ===== /api/reports/by-discente/:discenteId =====
  router.get('/by-discente/:discenteId', async (req, res) => { // <--- Alterado: app.get para router.get e rota relativa
    try {
      const { discenteId } = req.params;
      const all = await transcriptionService.listTranscriptionsWithMetadata();

      const filtered = all.filter(
        (t) => t.metadata?.discenteId === discenteId
      );

      const totalTranscriptions = filtered.length;
      const totalSizeBytes = filtered.reduce(
        (sum, t) => sum + (t.size || 0),
        0
      );

      const historyPatterns = buildDiscentePatterns(filtered);

      // média simples de sentimentos, se existir
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
          { positive: 0, neutral: 0, negative: 0 }
        );
        sentimentsAvg = {
          positive: sums.positive / totalTranscriptions,
          neutral: sums.neutral / totalTranscriptions,
          negative: sums.negative / totalTranscriptions,
        };
      }

      res.json({
        success: true,
        data: {
          totalTranscriptions,
          totalSizeBytes,
          sentimentsAvg,
          transcriptions: filtered,
          historyPatterns,
        },
      });
    } catch (error) {
      console.error('Erro em relatório por discente:', error);
      res.status(500).json({
        success: false,
        message: 'Erro em relatório por discente',
        error: error.message,
      });
    }
  });

  // ===== /api/reports/by-discente/:discenteId/export =====
  router.get('/by-discente/:discenteId/export', async (req, res) => {
    try {
      const { discenteId } = req.params;
      const all = await transcriptionService.listTranscriptionsWithMetadata();
      const filtered = all.filter((t) => t.metadata?.discenteId === discenteId);

      const totalTranscriptions = filtered.length;
      const historyPatterns = buildDiscentePatterns(filtered);
      const discenteInfo = await getDiscenteInfo(discenteId);
      const solicitacaoInfo = await getFirstSolicitacaoByDiscente(discenteId);
      const discenteName =
        normalizeString(discenteInfo?.name) ||
        normalizeString(solicitacaoInfo?.name) ||
        filtered.find((t) => normalizeString(t.metadata?.studentName))?.metadata?.studentName ||
        filtered.find((t) => normalizeString(t.metadata?.name))?.metadata?.name ||
        discenteId;
      const discenteMatricula =
        normalizeString(discenteInfo?.matricula || discenteInfo?.studentId) ||
        normalizeString(solicitacaoInfo?.matricula || solicitacaoInfo?.studentId) ||
        filtered.find((t) => normalizeString(t.metadata?.matricula || t.metadata?.studentId))?.metadata?.matricula ||
        filtered.find((t) => normalizeString(t.metadata?.studentId))?.metadata?.studentId ||
        '';
      const safeSlug = makeSafeSlug(discenteName, discenteMatricula, discenteId);

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
          { positive: 0, neutral: 0, negative: 0 }
        );
        sentimentsAvg = {
          positive: sums.positive / totalTranscriptions,
          neutral: sums.neutral / totalTranscriptions,
          negative: sums.negative / totalTranscriptions,
        };
      }

      const formatDate = (value) => {
        if (!value) return '---';
        const d = new Date(value);
        return Number.isNaN(d.getTime())
          ? '---'
          : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      };

      const lines = [];
      lines.push(`Relatório do discente ${discenteName}`);
      lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      lines.push('----------------------------------------');
      lines.push(`Total de transcrições: ${totalTranscriptions}`);

      if (sentimentsAvg) {
        lines.push(
          `Sentimento médio: +${(sentimentsAvg.positive * 100).toFixed(1)}% / ~${(sentimentsAvg.neutral * 100).toFixed(1)}% / -${(sentimentsAvg.negative * 100).toFixed(1)}%`
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
          lines.push(`- Sugestão de ações: ${historyPatterns.commonTriggers.join(', ')}`);
        }
      }

      lines.push('');
      lines.push('Transcrições:');
      if (!filtered.length) {
        lines.push('- Nenhuma transcrição registrada.');
      } else {
        filtered
          .sort((a, b) => {
            const da = a.createdAt ? new Date(a.createdAt) : null;
            const db = b.createdAt ? new Date(b.createdAt) : null;
            if (!da || !db) return 0;
            return db - da;
          })
          .forEach((t) => {
            lines.push(
              `- ${t.fileName || 'Sem nome'} | ${formatDate(t.createdAt)} | ${(t.size || 0) / 1024 >= 1 ? `${Math.round((t.size || 0) / 1024)} KB` : `${t.size || 0} B`}`
            );
            if (t.analysis?.summary) {
              lines.push(`  resumo: ${t.analysis.summary}`);
            }
          });
      }

      const content = lines.join('\n');
      const fileName = `relatorio-discente-${safeSlug}.txt`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(content);
    } catch (error) {
      console.error('Erro ao exportar relatório do discente:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar relatório do discente',
        error: error.message,
      });
    }
  });

  // ===== /api/reports/by-discente/:discenteId/export-pdf =====
  router.get('/by-discente/:discenteId/export-pdf', async (req, res) => {
    try {
      const { discenteId } = req.params;
      const all = await transcriptionService.listTranscriptionsWithMetadata();
      const filtered = all.filter((t) => t.metadata?.discenteId === discenteId);

      const totalTranscriptions = filtered.length;
      const historyPatterns = buildDiscentePatterns(filtered);
      const discenteInfo = await getDiscenteInfo(discenteId);
      const solicitacaoInfo = await getFirstSolicitacaoByDiscente(discenteId);
      const discenteName =
        normalizeString(discenteInfo?.name) ||
        normalizeString(solicitacaoInfo?.name) ||
        filtered.find((t) => normalizeString(t.metadata?.studentName))?.metadata?.studentName ||
        filtered.find((t) => normalizeString(t.metadata?.name))?.metadata?.name ||
        discenteId;
      const discenteMatricula =
        normalizeString(discenteInfo?.matricula || discenteInfo?.studentId) ||
        normalizeString(solicitacaoInfo?.matricula || solicitacaoInfo?.studentId) ||
        filtered.find((t) => normalizeString(t.metadata?.matricula || t.metadata?.studentId))?.metadata?.matricula ||
        filtered.find((t) => normalizeString(t.metadata?.studentId))?.metadata?.studentId ||
        '';
      const safeSlug = makeSafeSlug(discenteName, discenteMatricula, discenteId);

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
          { positive: 0, neutral: 0, negative: 0 }
        );
        sentimentsAvg = {
          positive: sums.positive / totalTranscriptions,
          neutral: sums.neutral / totalTranscriptions,
          negative: sums.negative / totalTranscriptions,
        };
      }

      const formatDate = (value) => {
        if (!value) return '---';
        const d = new Date(value);
        return Number.isNaN(d.getTime())
          ? '---'
          : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      };

      const doc = new PDFDocument({ margin: 50 });
      const fileName = `relatorio-discente-${safeSlug}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      doc.pipe(res);

      doc.fontSize(16).text(`Relatório do discente ${discenteName}`, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('gray').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      doc.fillColor('black');
      doc.moveDown();

      doc.fontSize(12).text('Resumo', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).text(`Total de transcrições: ${totalTranscriptions}`);
      if (sentimentsAvg) {
        doc.text(
          `Sentimento médio: +${(sentimentsAvg.positive * 100).toFixed(1)}% / ~${(sentimentsAvg.neutral * 100).toFixed(1)}% / -${(sentimentsAvg.negative * 100).toFixed(1)}%`
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
        patterns.push(`Gatilhos comuns: ${historyPatterns.commonTriggers.join(', ')}`);
      }
      if (patterns.length === 0) {
        doc.fontSize(10).fillColor('gray').text('Nenhum padrão identificado até o momento.');
        doc.fillColor('black');
      } else {
        patterns.forEach((p) => doc.fontSize(10).text(`• ${p}`));
      }
      doc.moveDown();

      doc.fontSize(12).text('Transcrições', { underline: true });
      doc.moveDown(0.3);
      if (!filtered.length) {
        doc.fontSize(10).fillColor('gray').text('Nenhuma transcrição registrada.');
        doc.fillColor('black');
      } else {
        filtered
          .sort((a, b) => {
            const da = a.createdAt ? new Date(a.createdAt) : null;
            const db = b.createdAt ? new Date(b.createdAt) : null;
            if (!da || !db) return 0;
            return db - da;
          })
          .forEach((t) => {
            doc.fontSize(10).text(`${t.fileName || 'Sem nome'} | ${formatDate(t.createdAt)}`);
            if (t.analysis?.summary) {
              doc.fontSize(9).fillColor('gray').text(`Resumo: ${t.analysis.summary}`);
              doc.fillColor('black');
            }
            if (Array.isArray(t.analysis?.actionableInsights) && t.analysis.actionableInsights.length > 0) {
              doc.fontSize(9).text(`Sugestões: ${t.analysis.actionableInsights.join(' | ')}`);
            }
            doc.moveDown(0.4);
          });
      }

      doc.end();
    } catch (error) {
      console.error('Erro ao exportar relatório do discente em PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar relatório do discente em PDF',
        error: error.message,
      });
    }
  });

  // ===== /api/reports/analytics =====
  router.get('/analytics', async (req, res) => { // <--- Alterado: app.get para router.get e rota relativa
    try {
      const transcriptions = await transcriptionService.listTranscriptions();

      if (transcriptions.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'Nenhuma transcrição disponível para análise',
            analytics: null,
          },
        });
      }

      const analyticsPromises = transcriptions.slice(-10).map(async (t) => {
        const transcription = transcriptionService.getTranscription(t.fileName);
        if (transcription && transcription.content) {
          const analysis =
            await transcriptionService.analyzeTranscription(
              transcription.content
            );
          return {
            fileName: t.fileName,
            createdAt: t.createdAt,
            analysis,
          };
        }
        return null;
      });

      const analyticsResults = await Promise.all(analyticsPromises);
      const validAnalytics = analyticsResults.filter((a) => a !== null);

      let totalPositive = 0,
        totalNeutral = 0,
        totalNegative = 0;
      const allKeywords = [];
      const allTopics = [];

      validAnalytics.forEach((a) => {
        if (a.analysis.sentiments) {
          totalPositive += a.analysis.sentiments.positive || 0;
          totalNeutral += a.analysis.sentiments.neutral || 0;
          totalNegative += a.analysis.sentiments.negative || 0;
        }
        if (a.analysis.keywords) {
          allKeywords.push(...a.analysis.keywords);
        }
        if (a.analysis.topics) {
          allTopics.push(...a.analysis.topics);
        }
      });

      const count = validAnalytics.length;
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

      res.json({
        success: true,
        data: {
          analytics: {
            totalAnalyzed: count,
            averageSentiments: avgSentiments,
            topKeywords,
            topTopics,
            recentAnalytics: validAnalytics.slice(-5),
          },
        },
      });
    } catch (error) {
      console.error('Erro ao gerar analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao gerar analytics',
        error: error.message,
      });
    }
  });

  // ===== /api/reports/export-json =====
  router.get('/export-json', async (req, res) => { // <--- Alterado: app.get para router.get e rota relativa
    try {
      const transcriptions = await transcriptionService.listTranscriptions();

      const exportData = {
        exportedAt: new Date().toISOString(),
        totalTranscriptions: transcriptions.length,
        transcriptions: transcriptions.map((t) => {
          const content = transcriptionService.getTranscription(t.fileName);
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

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="transcriptions_export_${Date.now()}.json"`
      );
      res.json(exportData);
    } catch (error) {
      console.error('Erro ao exportar dados (JSON):', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar dados (JSON)',
        error: error.message,
      });
    }
  });

  // ===== /api/reports/export-text =====
  router.get('/export-text', async (req, res) => {
    try {
      const allTranscriptions = await transcriptionService.listTranscriptionsWithMetadata();
      let reportText = `Relatório de Transcrições - Exportado em: ${new Date().toISOString()}\n\n`;
      reportText += `Total de Transcrições: ${allTranscriptions.length}\n`;
      reportText += '==================================================\n\n';

      for (const t of allTranscriptions) {
        const fullContent = transcriptionService.getTranscription(t.fileName);
        if (!fullContent) continue;

        reportText += `--- Transcrição: ${t.fileName} ---\n`;
        reportText += `Data de Criação: ${new Date(t.createdAt).toLocaleString()}\n`;
        reportText += `Tamanho (bytes): ${t.size}\n`;
        reportText += `\n[Metadados]\n`;
        for (const [key, value] of Object.entries(fullContent.metadata || {})) {
          reportText += `- ${key}: ${value}\n`;
        }
        reportText += `\n[Análise]\n`;
        reportText += `- Resumo: ${fullContent.analysis?.summary || 'N/A'}\n`;
        reportText += `- Sentimentos: Positivo: ${(fullContent.analysis?.sentiments?.positive * 100).toFixed(2)}%, Neutro: ${(fullContent.analysis?.sentiments?.neutral * 100).toFixed(2)}%, Negativo: ${(fullContent.analysis?.sentiments?.negative * 100).toFixed(2)}%\n`;
        reportText += `- Palavras-chave: ${(fullContent.analysis?.keywords || []).join(', ')}\n`;
        reportText += `- Tópicos: ${(fullContent.analysis?.topics || []).join(', ')}\n`;
        reportText += `\n[Insights Acionáveis]\n`;
        (fullContent.analysis?.actionableInsights || []).forEach((insight, index) => {
          reportText += `- ${index + 1}. ${insight}\n`;
        });
        reportText += `\n[Conteúdo da Transcrição]\n`;
        reportText += `${fullContent.content}\n\n`;
        reportText += '--------------------------------------------------\n\n';
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="transcriptions_report_${Date.now()}.txt"`
      );
      res.send(reportText);
    } catch (error) {
      console.error('Erro ao exportar dados (Texto):', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar dados (Texto)',
        error: error.message,
      });
    }
  });

  // ===== /api/reports/search =====
  router.get('/search', async (req, res) => { // <--- Alterado: app.get para router.get e rota relativa
    try {
      const { solicitante, curso, dataInicio, dataFim, palavra } = req.query;

      let transcriptions =
        await transcriptionService.listTranscriptionsWithMetadata();

      if (solicitante) {
        const s = solicitante.toLowerCase();
        transcriptions = transcriptions.filter((t) => {
          const name = t.metadata?.studentName?.toLowerCase() || '';
          const email = t.metadata?.studentEmail?.toLowerCase() || '';
          const ra =
            t.metadata?.matricula?.toLowerCase() ||
            t.metadata?.studentId?.toLowerCase() ||
            '';
          return name.includes(s) || email.includes(s) || ra.includes(s);
        });
      }

      if (curso) {
        const c = curso.toLowerCase();
        transcriptions = transcriptions.filter((t) => {
          const course = t.metadata?.curso?.toLowerCase() || '';
          return course.includes(c);
        });
      }

      if (dataInicio) {
        const dIni = new Date(dataInicio);
        transcriptions = transcriptions.filter(
          (t) => new Date(t.createdAt) >= dIni
        );
      }

      if (dataFim) {
        const dFim = new Date(dataFim);
        transcriptions = transcriptions.filter(
          (t) => new Date(t.createdAt) <= dFim
        );
      }

      if (palavra) {
        const p = palavra.toLowerCase();
        transcriptions = transcriptions.filter((t) => {
          const summary = t.analysis?.summary?.toLowerCase() || '';
          const keywords = (t.analysis?.keywords || []).map((k) =>
            k.toLowerCase()
          );
          return (
            summary.includes(p) ||
            keywords.some((k) => k.includes(p))
          );
        });
      }

      res.json({
        success: true,
        data: transcriptions,
      });
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar relatórios',
        error: error.message,
      });
    }
  });


export default router;
