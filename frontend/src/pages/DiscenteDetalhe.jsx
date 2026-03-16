import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useDiscenteDetalheData from './DiscenteDetalhe/hooks/useDiscenteDetalheData';
import { getMeetingDateLabel } from './DiscenteDetalhe/utils/meetingUtils';
import { timelineTypeLabels, timelineTypeStyles } from './DiscenteDetalhe/utils/timelineUtils';
import DiscenteDetalheHeader from './DiscenteDetalhe/components/DiscenteDetalheHeader';
import DiscenteDetalhePainelSessoes from './DiscenteDetalhe/components/DiscenteDetalhePainelSessoes';
import DiscenteDetalheRelatorios from './DiscenteDetalhe/components/DiscenteDetalheRelatorios';
import DiscenteDetalheRelatoriosPsicologicos from './DiscenteDetalhe/components/DiscenteDetalheRelatoriosPsicologicos';
import DiscenteDetalheSessaoLista from './DiscenteDetalhe/components/DiscenteDetalheSessaoLista';
import DiscenteDetalheTimeline from './DiscenteDetalhe/components/DiscenteDetalheTimeline';

export default function DiscenteDetalhe() {
  const { discenteId } = useParams();
  const navigate = useNavigate();

  const {
    discente,
    solicitacoes,
    relatorioDiscente,
    orderedTranscricoes,
    selectedTranscription,
    setSelectedTranscription,
    lastTranscription,
    sentimentTimeline,
    historyPatterns,
    monthlySentimentTimeline,
    error,
    downloadingDiscenteReport,
    downloadingDiscenteReportPdf,
    clinicalReports,
    meetingsDiscente,
    upcomingMeeting,
    lastCompletedMeeting,
    usedSessions,
    configuredLimit,
    remainingSessions,
    isBlockedByLimit,
    periodStart,
    periodEnd,
    timelineFilter,
    setTimelineFilter,
    filteredTimelineItems,
    hasTranscricoes,
    loadingMeetings,
    handleAgendarNovaSessao,
    handleDownloadDiscenteReport,
    handleDownloadDiscenteReportPdf,
    handleMarkMeetingAsConcluded,
    handleReprocessDiscente,
    reprocessMsg,
    reprocessErr,
    reprocessing,
    creatingSession,
  } = useDiscenteDetalheData(discenteId, { navigate });

  if (error && !discente) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (!discente) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <DiscenteDetalheHeader
        discente={discente}
        solicitacoes={solicitacoes}
        relatorioDiscente={relatorioDiscente}
        orderedTranscricoes={orderedTranscricoes}
        lastTranscription={lastTranscription}
        hasTranscricoes={hasTranscricoes}
        onAgendarNovaSessao={handleAgendarNovaSessao}
        creatingSession={creatingSession}
        isBlockedByLimit={isBlockedByLimit}
        onReprocessDiscente={handleReprocessDiscente}
        reprocessing={reprocessing}
        reprocessMsg={reprocessMsg}
        reprocessErr={reprocessErr}
      />

      <DiscenteDetalhePainelSessoes
        isBlockedByLimit={isBlockedByLimit}
        usedSessions={usedSessions}
        configuredLimit={configuredLimit}
        remainingSessions={remainingSessions}
        periodStart={periodStart}
        periodEnd={periodEnd}
        upcomingMeeting={upcomingMeeting}
        lastCompletedMeeting={lastCompletedMeeting}
        lastTranscription={lastTranscription}
        formatMeetingLabel={getMeetingDateLabel}
      />

      <DiscenteDetalheRelatorios
        relatorioDiscente={relatorioDiscente}
        orderedTranscricoes={orderedTranscricoes}
        hasTranscricoes={hasTranscricoes}
        selectedTranscription={selectedTranscription}
        setSelectedTranscription={setSelectedTranscription}
        sentimentTimeline={sentimentTimeline}
        historyPatterns={historyPatterns}
        monthlySentimentTimeline={monthlySentimentTimeline}
        downloadingDiscenteReport={downloadingDiscenteReport}
        downloadingDiscenteReportPdf={downloadingDiscenteReportPdf}
        onDownloadTxt={handleDownloadDiscenteReport}
        onDownloadPdf={handleDownloadDiscenteReportPdf}
      />

      <DiscenteDetalheRelatoriosPsicologicos
        clinicalReports={clinicalReports}
        loadingMeetings={loadingMeetings}
        formatMeetingLabel={getMeetingDateLabel}
        onOpenMeeting={(meetingId) => navigate(`/meetings/${meetingId}`)}
      />

      <DiscenteDetalheSessaoLista
        meetingsDiscente={meetingsDiscente}
        loadingMeetings={loadingMeetings}
        formatMeetingLabel={getMeetingDateLabel}
        onOpenMeeting={(meetingId) => navigate(`/meetings/${meetingId}`)}
        onConcludeMeeting={async (meetingId) => {
          try {
            await handleMarkMeetingAsConcluded(meetingId);
          } catch {
            alert('Não foi possível concluir a sessão.');
          }
        }}
      />

      <DiscenteDetalheTimeline
        timelineFilter={timelineFilter}
        setTimelineFilter={setTimelineFilter}
        filteredTimelineItems={filteredTimelineItems}
        timelineTypeStyles={timelineTypeStyles}
        timelineTypeLabels={timelineTypeLabels}
      />
    </div>
  );
}
