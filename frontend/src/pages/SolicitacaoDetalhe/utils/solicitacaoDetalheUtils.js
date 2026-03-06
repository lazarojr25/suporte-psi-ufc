const DATE_FORMAT_OPTIONS = { dateStyle: 'short', timeStyle: 'short' };

export const formatDate = (value) => {
  if (!value) return '---';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '---' : date.toLocaleString('pt-BR', DATE_FORMAT_OPTIONS);
};

export const statusBadgeConfig = (statusValue) => {
  if (!statusValue) return null;
  const status = statusValue.toString().toLowerCase();
  const base =
    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';

  if (status.includes('pend')) {
    return { label: 'Pendente', className: `${base} bg-amber-100 text-amber-800` };
  }
  if (status.includes('agend')) {
    return { label: 'Agendada', className: `${base} bg-blue-100 text-blue-800` };
  }
  if (status.includes('concl')) {
    return { label: 'Concluída', className: `${base} bg-green-100 text-green-800` };
  }

  return { label: statusValue, className: `${base} bg-gray-100 text-gray-700` };
};
