export const normalizeStatus = (status = '') =>
  status
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const buildMeetingStatus = (meeting = {}) => {
  const statusNormalized = normalizeStatus(meeting.status || meeting._statusNormalized || '');
  let label = '';
  let className = '';

  if (meeting.status === 'cancelada') {
    label = 'Cancelada';
    className = 'bg-red-100 text-red-800 border border-red-200';
  } else if (statusNormalized === 'concluida') {
    label = 'Concluída';
    className = 'bg-green-100 text-green-800 border border-green-200';
  } else if (statusNormalized === 'erro_transcricao') {
    label = 'Erro de transcrição';
    className = 'bg-rose-100 text-rose-800 border border-rose-200';
  } else if (statusNormalized.includes('process')) {
    label = 'Processando';
    className = 'bg-amber-100 text-amber-800 border border-amber-200';
  } else if (statusNormalized === 'agendada') {
    label = meeting._isPast ? 'Agendada (data já passou)' : 'Agendada';
    className = 'bg-blue-100 text-blue-800 border border-blue-200';
  } else {
    label = meeting.status || 'Desconhecido';
    className = 'bg-gray-100 text-gray-800 border border-gray-200';
  }

  return { label, className, normalized: statusNormalized };
};

export const getMeetingDate = (meeting = {}) => {
  if (meeting.dateTime) return new Date(meeting.dateTime);
  if (meeting.scheduledDate && meeting.scheduledTime) {
    return new Date(`${meeting.scheduledDate}T${meeting.scheduledTime}:00`);
  }
  if (meeting.scheduledDate) return new Date(`${meeting.scheduledDate}T00:00:00`);
  if (meeting.createdAt) return new Date(meeting.createdAt);
  return null;
};

export const getMeetingDateLabel = (meeting) => {
  if (!meeting) return 'Nenhuma sessão registrada';
  if (meeting._dateObj) {
    return meeting._dateObj.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: meeting.scheduledTime ? 'short' : undefined,
    });
  }
  if (meeting.scheduledDate) {
    return meeting.scheduledTime
      ? `${meeting.scheduledDate} ${meeting.scheduledTime}`
      : meeting.scheduledDate;
  }
  return '---';
};

export const matchesDiscenteForMeeting = (meeting = {}, discente = null) => {
  if (!meeting || !discente) return false;

  const meetingDiscenteId =
    typeof meeting.discenteId === 'string'
      ? meeting.discenteId.trim()
      : '';
  const discenteId =
    typeof discente.id === 'string' ? discente.id.trim() : '';

  return !!meetingDiscenteId && !!discenteId && meetingDiscenteId === discenteId;
};

export const parsePeriodBoundary = (value, isEnd = false) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const hour = isEnd ? '23:59:59.999' : '00:00:00.000';
    const date = new Date(`${value}T${hour}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const hasClinicalReportData = (meeting = {}) => {
  const cr = meeting.clinicalRecord || {};
  return (
    cr.identificacaoServico ||
    cr.identificacaoProfissional ||
    cr.motivoDemanda ||
    cr.procedimentos ||
    cr.analiseCompreensao ||
    cr.encaminhamentosRecomendacoes ||
    cr.limitesDocumento ||
    cr.planoObjetivos ||
    cr.planoEstrategias ||
    cr.planoAcordos ||
    cr.planoEncaminhamentos ||
    cr.planoCriterios
  );
};
