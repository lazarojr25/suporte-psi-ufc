import TranscriptionService from '../services/transcriptionService.js';
import express from 'express';

const router = express.Router();

const transcriptionService = new TranscriptionService();
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

/**
 * Define as rotas de relatórios usando express.Router
 */

  // ===== /api/reports/overview =====
  router.get('/overview', (req, res) => { // <--- Alterado: app.get para router.get e rota relativa
    try {
      const all = transcriptionService.listTranscriptionsWithMetadata();

      const totalTranscriptions = all.length;
      const totalSizeBytes = all.reduce((sum, t) => sum + (t.size || 0), 0);
      const avgSizeBytes =
        totalTranscriptions > 0 ? totalSizeBytes / totalTranscriptions : 0;

      // agregação por curso
      const byCourseMap = {};
      for (const t of all) {
        const course = t.metadata?.curso || 'Não informado';
        if (!byCourseMap[course]) {
          byCourseMap[course] = {
            course,
            count: 0,
            lastTranscriptionAt: null,
          };
        }
        byCourseMap[course].count += 1;

        const createdAt = t.createdAt ? new Date(t.createdAt) : null;
        if (createdAt) {
          const currentLast = byCourseMap[course].lastTranscriptionAt
            ? new Date(byCourseMap[course].lastTranscriptionAt)
            : null;
          if (!currentLast || createdAt > currentLast) {
            byCourseMap[course].lastTranscriptionAt = createdAt.toISOString();
          }
        }
      }

      const byCourse = Object.values(byCourseMap);

      res.json({
        success: true,
        overview: {
          totalTranscriptions,
          totalSizeBytes,
          avgSizeBytes,
        },
        byCourse,
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

  // ===== /api/reports/by-discente/:discenteId =====
  router.get('/by-discente/:discenteId', (req, res) => { // <--- Alterado: app.get para router.get e rota relativa
    try {
      const { discenteId } = req.params;
      const all = transcriptionService.listTranscriptionsWithMetadata();

      const filtered = all.filter(
        (t) => t.metadata?.discenteId === discenteId
      );

      const totalTranscriptions = filtered.length;
      const totalSizeBytes = filtered.reduce(
        (sum, t) => sum + (t.size || 0),
        0
      );

      // Carrega o texto completo de todas as transcrições desse discente
      const fullEntries = filtered
        .map((t) => transcriptionService.getTranscription(t.fileName))
        .filter((t) => t && t.content);

      const fullHistoryText = fullEntries.map((t) => t.content).join('\n\n');

      let historyPatterns = null;
      if (fullHistoryText.trim().length > 0) {
        try {
          // se ainda não existir esse método, depois criamos no service
          historyPatterns = transcriptionService.analyzeDiscenteHistory(
            fullHistoryText
          );
        } catch (e) {
          console.warn(
            'Falha ao analisar padrões históricos do discente:',
            e?.message
          );
        }
      }

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
          // Adicionando os novos campos da análise histórica
          longTermSummary: historyPatterns?.longTermSummary || null,
          riskAssessment: historyPatterns?.riskAssessment || null,
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

  // ===== /api/reports/analytics =====
  router.get('/analytics', async (req, res) => { // <--- Alterado: app.get para router.get e rota relativa
    try {
      const transcriptions = transcriptionService.listTranscriptions();

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
  router.get('/export-json', (req, res) => { // <--- Alterado: app.get para router.get e rota relativa
    try {
      const transcriptions = transcriptionService.listTranscriptions();

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
  router.get('/export-text', (req, res) => {
    try {
      const allTranscriptions = transcriptionService.listTranscriptionsWithMetadata();
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
  router.get('/search', (req, res) => { // <--- Alterado: app.get para router.get e rota relativa
    try {
      const { solicitante, curso, dataInicio, dataFim, palavra } = req.query;

      let transcriptions =
        transcriptionService.listTranscriptionsWithMetadata();

      if (solicitante) {
        const s = solicitante.toLowerCase();
        transcriptions = transcriptions.filter((t) => {
          const name = t.metadata?.studentName?.toLowerCase() || '';
          const email = t.metadata?.studentEmail?.toLowerCase() || '';
          const ra = t.metadata?.studentId?.toLowerCase() || '';
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