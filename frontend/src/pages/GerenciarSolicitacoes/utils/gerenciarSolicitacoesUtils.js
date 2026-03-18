export const formatDateTime = (createdAt) => {
  if (!createdAt) return '---';

  const date =
    typeof createdAt.toDate === 'function'
      ? createdAt.toDate()
      : new Date(createdAt);

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const normalizeStatus = (statusRaw) => {
  if (!statusRaw) return 'pendente';
  const normalized = statusRaw
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('agend')) return 'agendada';
  if (normalized.includes('pend')) return 'pendente';
  if (normalized.includes('concl')) return 'concluida';
  return normalized;
};

export const getStatusBadgeMeta = (statusRaw) => {
  const status = normalizeStatus(statusRaw);

  const label = status.charAt(0).toUpperCase() + status.slice(1);
  let className = '';

  if (status === 'pendente') {
    className = 'bg-amber-50 text-amber-800 border border-amber-200';
  } else if (status === 'agendada') {
    className = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
  } else if (status === 'concluida') {
    className = 'bg-blue-50 text-blue-800 border border-blue-200';
  } else {
    className = 'bg-gray-50 text-gray-700 border border-gray-200';
  }

  return { label, className };
};

const normalize = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const buildCursoOptions = (cursosCatalog = []) => {
  return cursosCatalog
    .filter((curso) => curso && (curso.nome || curso.sigla))
    .map((curso) => {
      const nome = (curso.nome || '').toString().trim();
      const sigla = (curso.sigla || '').toString().trim();
      const label = curso.label || (nome && sigla ? `${nome} (${sigla})` : nome || sigla);
      return {
        id: curso.id,
        nome,
        sigla,
        label,
      };
    })
    .filter((curso) => curso.label)
    .sort((a, b) => normalize(a.label).localeCompare(normalize(b.label), 'pt', {
      sensitivity: 'base',
    }));
};
