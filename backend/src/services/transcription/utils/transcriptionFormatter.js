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
