import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';

import useMeetingDetalheData from './MeetingDetalhe/hooks/useMeetingDetalheData';
import MeetingDetalheHeader from './MeetingDetalhe/components/MeetingDetalheHeader';
import MeetingDetalheInfoCard from './MeetingDetalhe/components/MeetingDetalheInfoCard';
import MeetingDetalheAgendamento from './MeetingDetalhe/components/MeetingDetalheAgendamento';
import MeetingDetalheRelatorio from './MeetingDetalhe/components/MeetingDetalheRelatorio';
import MeetingDetalheRelatorioModal from './MeetingDetalhe/components/MeetingDetalheRelatorioModal';
import MeetingDetalheAnotacoes from './MeetingDetalhe/components/MeetingDetalheAnotacoes';
import MeetingDetalheTranscricao from './MeetingDetalhe/components/MeetingDetalheTranscricao';

export default function MeetingDetalhe() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [showClinicalModal, setShowClinicalModal] = useState(false);
  const [openSections, setOpenSections] = useState({
    info: true,
    agendamento: true,
    relatorio: true,
    anotacoes: false,
    transcricao: false,
  });

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

  const hasClinicalRecord = (() => {
    return Object.values(clinicalRecord || {}).some((value) => {
      if (typeof value !== 'string') return false;
      return value.trim().length > 0;
    });
  })();

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getReportSummary = hasClinicalRecord ? 'Preenchido' : 'Não preenchido';
  const getNotesSummary = informalNotes ? 'Com conteúdo' : 'Sem anotação';
  const getTranscricaoSummary = meeting?.transcriptionFileName
    ? 'Arquivo enviado'
    : 'Sem arquivo';
  const getAgendamentoSummary = meeting?.status
    ? `Status atual: ${meeting.status}`
    : 'Sem agendamento';

  const collapsibleSections = [
    {
      key: 'info',
      title: 'Informações da sessão',
      subtitle: 'Dados do registro e vínculo com discente/solicitação',
      summary: meeting?.id ? `Sessão ${meeting.id.slice(0, 8)}...` : 'Carregando',
      content: (
        <MeetingDetalheInfoCard
          meeting={meeting}
          solicitacao={solicitacao}
          onOpenDiscente={() => {
            const discenteId = meeting?.discenteId || solicitacao?.discenteId;
            if (discenteId) navigate(`/discentes/${discenteId}`);
          }}
          onOpenSolicitacao={() => {
            if (solicitacao?.id) navigate(`/solicitacoes/${solicitacao.id}`);
          }}
          containerClassName="bg-transparent rounded-none shadow-none p-0"
        />
      ),
    },
    {
      key: 'agendamento',
      title: 'Agendamento',
      subtitle: 'Reagendar, cancelar e controlar status',
      summary: getAgendamentoSummary,
      content: (
        <MeetingDetalheAgendamento
          scheduleDate={scheduleDate}
          scheduleTime={scheduleTime}
          scheduleDuration={scheduleDuration}
          containerClassName="bg-transparent rounded-none shadow-none p-0"
          onScheduleDateChange={setScheduleDate}
          onScheduleTimeChange={setScheduleTime}
          onScheduleDurationChange={setScheduleDuration}
          onReschedule={handleReschedule}
          onCancelMeeting={handleCancelMeeting}
          scheduleSaving={scheduleSaving}
          scheduleMsg={scheduleMsg}
          scheduleErr={scheduleErr}
          scheduleWarn={scheduleWarn}
          meetingLink={meeting?.meetLink}
          isEditable={meeting?.status !== 'concluida' && meeting?.status !== 'cancelada'}
        />
      ),
    },
    {
      key: 'relatorio',
      title: 'Relatório psicológico',
      subtitle: 'Registro técnico da sessão (exibição resumida)',
      summary: getReportSummary,
      content: (
        <MeetingDetalheRelatorio
          clinicalRecord={clinicalRecord}
          containerClassName="bg-transparent rounded-none shadow-none p-0 sm:p-0"
          onOpenModal={() => setShowClinicalModal(true)}
          saving={clinicalSaving}
          saveMsg={clinicalSaveMsg}
          saveErr={clinicalSaveErr}
          transcriptionAnalysis={transcriptionAnalysis}
          transcriptionReview={transcriptionReview}
          hasClinicalRecord={hasClinicalRecord}
        />
      ),
    },
    {
      key: 'anotacoes',
      title: 'Anotações',
      subtitle: 'Notas rápidas da sessão',
      summary: getNotesSummary,
      content: (
        <MeetingDetalheAnotacoes
          meeting={meeting}
          informalNotes={informalNotes}
          onInformalNotesChange={setInformalNotes}
          onSave={handleNotesSave}
          saving={notesSaving}
          saveMsg={notesSaveMsg}
          saveErr={notesSaveErr}
          containerClassName="bg-transparent rounded-none shadow-none p-0"
        />
      ),
    },
    {
      key: 'transcricao',
      title: 'Transcrição',
      subtitle: 'Upload de áudio/vídeo e TXT',
      summary: getTranscricaoSummary,
      content: (
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
          isConcluida={meeting?.status === 'concluida'}
          containerClassName="bg-transparent rounded-none shadow-none p-0"
        />
      ),
    },
  ];

  if (loading) return <div className="p-4">Carregando reunião...</div>;
  if (!meetingId) return <div className="p-4 text-red-600">ID da sessão não informado.</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!meeting) return <div className="p-4">Meeting não encontrado.</div>;

  return (
    <div className="h-full w-full min-h-0 flex flex-col overflow-hidden">
      <div className="max-w-4xl mx-auto w-full p-4 pb-0 space-y-4 flex-1 min-h-0 overflow-y-auto">
        <MeetingDetalheHeader
          meeting={meeting}
          statusBadgeMeta={statusBadgeMeta}
          onBack={() => navigate('/agenda')}
        />

        <div className="space-y-3">
          {collapsibleSections.map((section) => {
            const isOpen = openSections[section.key];
            return (
              <section
                key={section.key}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  className="w-full px-4 py-3 bg-white text-left flex items-start justify-between gap-3 sm:items-center"
                  onClick={() => toggleSection(section.key)}
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase text-gray-500 tracking-wide">{section.title}</p>
                    <h2 className="text-sm font-semibold text-gray-900 break-words">
                      {section.subtitle}
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">Resumo: {section.summary}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 shrink-0">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 sm:px-4 sm:pb-4 border-t border-gray-100">
                    {section.content}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <MeetingDetalheRelatorioModal
        open={showClinicalModal}
        clinicalRecord={clinicalRecord}
        onClose={() => setShowClinicalModal(false)}
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
    </div>
  );
}
