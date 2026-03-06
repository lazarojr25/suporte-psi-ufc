export const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const dateKey = (date) => date.toISOString().slice(0, 10);

export const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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
