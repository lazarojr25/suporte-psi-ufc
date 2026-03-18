export const MEETING_AUDIO_MAX_BYTES = 500 * 1024 * 1024;

export const ALLOWED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
];

export const formatDateLabel = (dateStr) => {
  if (!dateStr) return '---';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const normalizeMeetingStatus = (status = '') =>
  status === 'processando'
    ? 'em_processamento'
    : String(status || '').toLowerCase().trim();

export const getMeetingStatusBadgeMeta = (status = '') => {
  const normalizedStatus = normalizeMeetingStatus(status);
  if (!normalizedStatus) return null;

  const base =
    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';

  if (normalizedStatus === 'concluida') {
    return {
      text: 'Concluída',
      className: `${base} bg-green-100 text-green-800`,
    };
  }

  if (normalizedStatus === 'em_processamento') {
    return {
      text: 'Processando',
      className: `${base} bg-amber-100 text-amber-800`,
    };
  }

  if (normalizedStatus === 'agendada') {
    return {
      text: 'Agendada',
      className: `${base} bg-blue-100 text-blue-800`,
    };
  }

  if (normalizedStatus === 'cancelada') {
    return {
      text: 'Cancelada',
      className: `${base} bg-red-100 text-red-800`,
    };
  }

  if (normalizedStatus === 'erro_transcricao') {
    return {
      text: 'Erro de transcrição',
      className: `${base} bg-rose-100 text-rose-800`,
    };
  }

  return {
    text: normalizedStatus,
    className: `${base} bg-gray-100 text-gray-700`,
  };
};

export const resolveSessionDateValue = (meeting = {}) =>
  meeting.scheduledDate ||
  (meeting.dateTime ? new Date(meeting.dateTime).toISOString().slice(0, 10) : null) ||
  new Date().toISOString().slice(0, 10);

export const getMeetingAudioValidationError = (file) => {
  if (!file) return 'Selecione um arquivo.';

  const maxSize = MEETING_AUDIO_MAX_BYTES;
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  const unsupported = !ALLOWED_AUDIO_EXTENSIONS.includes(ext);
  if (unsupported) {
    return 'Formato não suportado. Use: MP3, WAV, M4A, OGG, MP4, MOV, WEBM, MKV ou AVI.';
  }
  if (file.size > maxSize) {
    return `Arquivo muito grande (${(file.size / (1024 * 1024)).toFixed(
      1
    )}MB). Limite: ${maxSize / (1024 * 1024)}MB.`;
  }

  return null;
};

export const createEmptyClinicalRecord = () => ({
  identificacaoServico: '',
  identificacaoProfissional: '',
  motivoDemanda: '',
  procedimentos: '',
  analiseCompreensao: '',
  encaminhamentosRecomendacoes: '',
  limitesDocumento: '',
  planoObjetivos: '',
  planoEstrategias: '',
  planoAcordos: '',
  planoEncaminhamentos: '',
  planoCriterios: '',
});

export const getClinicalRecordFromMeeting = (meeting = {}) => {
  const clinicalRecord = meeting.clinicalRecord || {};
  return {
    identificacaoServico: clinicalRecord.identificacaoServico || '',
    identificacaoProfissional: clinicalRecord.identificacaoProfissional || '',
    motivoDemanda: clinicalRecord.motivoDemanda || '',
    procedimentos: clinicalRecord.procedimentos || '',
    analiseCompreensao: clinicalRecord.analiseCompreensao || '',
    encaminhamentosRecomendacoes: clinicalRecord.encaminhamentosRecomendacoes || '',
    limitesDocumento: clinicalRecord.limitesDocumento || '',
    planoObjetivos: clinicalRecord.planoObjetivos || '',
    planoEstrategias: clinicalRecord.planoEstrategias || '',
    planoAcordos: clinicalRecord.planoAcordos || '',
    planoEncaminhamentos: clinicalRecord.planoEncaminhamentos || '',
    planoCriterios: clinicalRecord.planoCriterios || '',
  };
};
