import { useNavigate, useParams } from 'react-router-dom';

import useMeetingDetalheData from './MeetingDetalhe/hooks/useMeetingDetalheData';
import MeetingDetalheHeader from './MeetingDetalhe/components/MeetingDetalheHeader';
import MeetingDetalheInfoCard from './MeetingDetalhe/components/MeetingDetalheInfoCard';
import MeetingDetalheAgendamento from './MeetingDetalhe/components/MeetingDetalheAgendamento';
import MeetingDetalheRelatorio from './MeetingDetalhe/components/MeetingDetalheRelatorio';
import MeetingDetalheAnotacoes from './MeetingDetalhe/components/MeetingDetalheAnotacoes';
import MeetingDetalheTranscricao from './MeetingDetalhe/components/MeetingDetalheTranscricao';

export default function MeetingDetalhe() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const {
    meeting,
    loading,
    error,
    solicitacao,

    informalNotes,
    setInformalNotes,
    clinicalRecord,
    setClinicalRecord,

    clinicalSaving,
    clinicalSaveMsg,
    clinicalSaveErr,
    notesSaving,
    notesSaveMsg,
    notesSaveErr,
    transcriptionAnalysis,
    transcriptionReview,
    setReviewField,
    setReviewChecklistItem,
    applyAiSummaryToClinical,
    reviewChecklistMissing,
    reviewChecklistTemplate,
    isClinicalSaveBlocked,
    isReviewRequired,

    scheduleDate,
    scheduleTime,
    scheduleDuration,
    setScheduleDate,
    setScheduleTime,
    setScheduleDuration,
    scheduleSaving,
    scheduleMsg,
    scheduleErr,
    scheduleWarn,

    selectedFile,
    setSelectedFile,
    uploading,
    uploadMsg,
    uploadErr,
    selectedTxt,
    setSelectedTxt,
    txtUploading,
    txtMsg,
    txtErr,

    statusBadgeMeta,

    handleReschedule,
    handleCancelMeeting,
    handleUpload,
    handleTxtUpload,
    handleClinicalSave,
    handleNotesSave,
  } = useMeetingDetalheData(meetingId);

  const handleClinicalRecordChange = (key, value) => {
    setClinicalRecord((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="p-4">Carregando reunião...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!meeting) return <div className="p-4">Meeting não encontrado.</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <MeetingDetalheHeader
        meeting={meeting}
        statusBadgeMeta={statusBadgeMeta}
        onBack={() => navigate('/agenda')}
      />

      <MeetingDetalheInfoCard
        meeting={meeting}
        solicitacao={solicitacao}
        onOpenDiscente={() =>
          navigate(`/discentes/${meeting.discenteId || solicitacao?.discenteId}`)
        }
        onOpenSolicitacao={() => navigate(`/solicitacoes/${solicitacao.id}`)}
      />

      <MeetingDetalheAgendamento
        scheduleDate={scheduleDate}
        scheduleTime={scheduleTime}
        scheduleDuration={scheduleDuration}
        onScheduleDateChange={setScheduleDate}
        onScheduleTimeChange={setScheduleTime}
        onScheduleDurationChange={setScheduleDuration}
        onReschedule={handleReschedule}
        onCancelMeeting={handleCancelMeeting}
        scheduleSaving={scheduleSaving}
        scheduleMsg={scheduleMsg}
        scheduleErr={scheduleErr}
        scheduleWarn={scheduleWarn}
        meetingLink={meeting.meetLink}
        isEditable={meeting.status !== 'concluida' && meeting.status !== 'cancelada'}
      />

      <MeetingDetalheRelatorio
        clinicalRecord={clinicalRecord}
        onClinicalRecordChange={handleClinicalRecordChange}
        onSave={handleClinicalSave}
        saving={clinicalSaving}
        saveMsg={clinicalSaveMsg}
        saveErr={clinicalSaveErr}
        transcriptionAnalysis={transcriptionAnalysis}
        transcriptionReview={transcriptionReview}
        onReviewFieldChange={setReviewField}
        onReviewChecklistChange={setReviewChecklistItem}
        onUseAiSummary={applyAiSummaryToClinical}
        saveBlockedMessage={
          isClinicalSaveBlocked ? 'Revisão humana pendente para salvar o relatório.' : null
        }
        checklistTemplate={reviewChecklistTemplate}
        isReviewRequired={isReviewRequired}
        missingChecklistItems={reviewChecklistMissing}
      />

      <MeetingDetalheAnotacoes
        meeting={meeting}
        informalNotes={informalNotes}
        onInformalNotesChange={setInformalNotes}
        onSave={handleNotesSave}
        saving={notesSaving}
        saveMsg={notesSaveMsg}
        saveErr={notesSaveErr}
      />

      <MeetingDetalheTranscricao
        selectedFile={selectedFile}
        onAudioFileChange={setSelectedFile}
        onUpload={handleUpload}
        uploading={uploading}
        uploadMsg={uploadMsg}
        uploadErr={uploadErr}
        selectedTxt={selectedTxt}
        onTxtFileChange={setSelectedTxt}
        onTxtUpload={handleTxtUpload}
        txtUploading={txtUploading}
        txtMsg={txtMsg}
        txtErr={txtErr}
        isConcluida={meeting.status === 'concluida'}
      />
    </div>
  );
}
