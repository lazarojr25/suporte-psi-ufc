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

export const buildCursoOptions = (solicitacoes = [], cursosCatalog = []) => {
  const set = new Set();

  cursosCatalog.forEach((curso) => {
    if (curso.nome) set.add(curso.nome);
    else if (curso.label) set.add(curso.label);
    else if (curso.sigla) set.add(curso.sigla);
  });

  solicitacoes.forEach((s) => {
    if (s.curso) {
      set.add(s.curso);
    }
    if (s.cursoNome) {
      set.add(s.cursoNome);
    }
    if (s.cursoSigla) {
      set.add(s.cursoSigla);
    }
  });

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));
};
