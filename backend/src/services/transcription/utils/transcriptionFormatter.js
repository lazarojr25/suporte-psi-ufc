import { TRANSCRIPTION_SUMMARY_SEPARATOR } from '../constants/transcriptionConstants.js';

export const formatTranscriptionDocument = (
  transcription,
  extraInfo = {},
  analysis = {},
) => {
  const headerLines = [];
  headerLines.push('=== Dados da sessão ===');
  if (extraInfo.studentName) headerLines.push(`Discente: ${extraInfo.studentName}`);
  if (extraInfo.matricula) headerLines.push(`Matrícula: ${extraInfo.matricula}`);
  if (extraInfo.curso) headerLines.push(`Curso: ${extraInfo.curso}`);
  if (extraInfo.sessionDate) headerLines.push(`Data da sessão: ${extraInfo.sessionDate}`);
  if (extraInfo.meetingId) headerLines.push(`Meeting ID: ${extraInfo.meetingId}`);
  if (extraInfo.solicitacaoId) headerLines.push(`Solicitação ID: ${extraInfo.solicitacaoId}`);

  const summaryBlock = [];
  summaryBlock.push('=== Resumo automático ===');
  if (analysis.summary) summaryBlock.push(`Resumo: ${analysis.summary}`);
  if (analysis.sentiments) {
    const sentiments = analysis.sentiments;
    summaryBlock.push(
      `Sentimentos: +${((sentiments.positive || 0) * 100).toFixed(1)}% / ~${(
        (sentiments.neutral || 0) * 100
      ).toFixed(1)}% / -${((sentiments.negative || 0) * 100).toFixed(1)}%`
    );
  }

  if (Array.isArray(analysis.keywords) && analysis.keywords.length) {
    summaryBlock.push(`Palavras-chave: ${analysis.keywords.join(', ')}`);
  }
  if (Array.isArray(analysis.topics) && analysis.topics.length) {
    summaryBlock.push(`Tópicos: ${analysis.topics.join(', ')}`);
  }
  if (Array.isArray(analysis.riskSignals) && analysis.riskSignals.length) {
    summaryBlock.push('Sinais de atenção:');
    analysis.riskSignals.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const nivel = item.nivel || item.level || 'médio';
      const tipo = item.tipo || item.type || 'sinal';
      const evidencia = item.evidencia || item.evidence || '';
      summaryBlock.push(
        `  ${index + 1}. [${nivel.toString().toLowerCase()}] ${tipo}${
          evidencia ? ` — ${evidencia}` : ''
        }`,
      );
    });
  }
  if (analysis.uncertainty) {
    const nivel = analysis.uncertainty.nivel || analysis.uncertainty.level;
    if (nivel || analysis.uncertainty.motivos) {
      summaryBlock.push(`Incerteza: ${nivel || 'média'}`);
      if (Array.isArray(analysis.uncertainty.motivos)) {
        summaryBlock.push(`  Motivos: ${analysis.uncertainty.motivos.join('; ')}`);
      }
    }
  }
  if (typeof analysis.summaryConfidence === 'number') {
    summaryBlock.push(`Confiança do resumo: ${(analysis.summaryConfidence * 100).toFixed(1)}%`);
  }
  if (analysis.humanReviewRequired) {
    summaryBlock.push('Revisão humana obrigatória recomendada.');
  }
  if (Array.isArray(analysis.actionableInsights) && analysis.actionableInsights.length) {
    summaryBlock.push('Insights acionáveis:');
    analysis.actionableInsights.forEach((insight, index) => {
      summaryBlock.push(`  ${index + 1}. ${insight}`);
    });
  }

  return [
    headerLines.join('\n'),
    '',
    summaryBlock.join('\n'),
    '',
    TRANSCRIPTION_SUMMARY_SEPARATOR,
    transcription,
  ].join('\n');
};
