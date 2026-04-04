export const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const dateKey = (date) => date.toISOString().slice(0, 10);

export const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeComparableValue = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const appendOwnershipCandidate = (bucket, value) => {
  if (!value && value !== 0) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => appendOwnershipCandidate(bucket, entry));
    return;
  }
  if (typeof value === 'object') {
    bucket.push(value.uid, value.id, value.email, value.name);
    return;
  }
  bucket.push(value);
};

const getOwnershipCandidates = (eventRaw = {}) => {
  const values = [];

  [
    eventRaw.ownerUid,
    eventRaw.ownerEmail,
    eventRaw.createdByUid,
    eventRaw.createdByEmail,
    eventRaw.userUid,
    eventRaw.userEmail,
    eventRaw.assignedToUid,
    eventRaw.assignedToEmail,
    eventRaw.responsavelUid,
    eventRaw.responsavelEmail,
    eventRaw.psicologoUid,
    eventRaw.psicologoEmail,
    eventRaw.profissionalUid,
    eventRaw.profissionalEmail,
    eventRaw.owner,
    eventRaw.assignedTo,
    eventRaw.responsavel,
    eventRaw.createdBy,
    eventRaw.psicologo,
    eventRaw.profissional,
  ].forEach((value) => appendOwnershipCandidate(values, value));

  return values
    .map((value) => normalizeComparableValue(value))
    .filter(Boolean);
};

const getUserCandidates = (user) =>
  [user?.uid, user?.email, user?.displayName]
    .map((value) => normalizeComparableValue(value))
    .filter(Boolean);

export const isEventRelatedToLoggedUser = (eventRaw, user) => {
  if (!user) return true;

  const ownerCandidates = getOwnershipCandidates(eventRaw);
  if (!ownerCandidates.length) {
    // Mantém compatibilidade com registros antigos sem metadados de responsável.
    return true;
  }

  const userCandidates = getUserCandidates(user);
  if (!userCandidates.length) return false;

  return ownerCandidates.some((candidate) => userCandidates.includes(candidate));
};

export const normalizeStatus = (status) =>
  (status || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const isSolicitacaoAgendada = (status) => {
  const normalized = normalizeStatus(status);
  return normalized.includes('agend');
};

export const isSolicitacaoPendente = (status) => {
  const normalized = normalizeStatus(status);
  if (!normalized) return true;
  return normalized.includes('pend') || normalized === 'nova';
};

export const shouldShowSolicitacaoInAgenda = (status) => {
  if (isSolicitacaoAgendada(status)) return false;
  return isSolicitacaoPendente(status);
};

export const formatSelectedDateLabel = (selectedDate) =>
  selectedDate.split('-').reverse().join('/');

export const isSolicitacaoComEncontroAgendado = (status) => {
  return normalizeStatus(status).includes('encontro agendado');
};

export const getDaySummaryLabel = (pendingCount, meetingsCount) => {
  return `${pendingCount} solicitação${pendingCount === 1 ? '' : 's'} pendente${
    pendingCount === 1 ? '' : 's'
  } • ${meetingsCount} encontro${meetingsCount === 1 ? '' : 's'}`;
};
