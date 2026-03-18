export const STATUS_LABELS = {
  agendada: 'Agendada',
  em_processamento: 'Processando',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  erro_transcricao: 'Erro de transcrição',
};

export const normalizeStatus = (status) =>
  status === 'processando' ? 'em_processamento' : String(status || '').toLowerCase().trim();

export const getBadgeClass = (status) => {
  const normalized = normalizeStatus(status);
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';

  switch (normalized) {
    case 'concluida':
      return `${base} bg-green-100 text-green-800`;
    case 'em_processamento':
      return `${base} bg-amber-100 text-amber-800`;
    case 'agendada':
      return `${base} bg-blue-100 text-blue-800`;
    case 'cancelada':
      return `${base} bg-red-100 text-red-800`;
    case 'erro_transcricao':
      return `${base} bg-rose-100 text-rose-800`;
    default:
      return `${base} bg-gray-100 text-gray-700`;
  }
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '---';

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;

  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
