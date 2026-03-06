import { getMeetingDate } from './meetingUtils';

export const timelineTypeStyles = {
  solicitacao: 'bg-amber-50 text-amber-800 border border-amber-200',
  sessao: 'bg-blue-50 text-blue-800 border border-blue-200',
  transcricao: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
};

export const timelineTypeLabels = {
  solicitacao: 'Solicitação',
  sessao: 'Sessão',
  transcricao: 'Transcrição',
};

export const buildTimelineItems = ({
  solicitacoes = [],
  meetingsDiscente = [],
  orderedTranscricoes = [],
}) => {
  const items = [];

  solicitacoes.forEach((s) => {
    const date = s.createdAt ? new Date(s.createdAt) : null;
    if (!date || Number.isNaN(date.getTime())) return;
    items.push({
      type: 'solicitacao',
      title: 'Solicitação de atendimento',
      description: s.motivation || 'Solicitação registrada',
      status: s.status,
      date,
    });
  });

  meetingsDiscente.forEach((m) => {
    const date = m._dateObj || getMeetingDate(m);
    if (!date || Number.isNaN(date.getTime())) return;
    items.push({
      type: 'sessao',
      title: 'Sessão agendada/registrada',
      description: m.notes || m.clinicalRecord?.analiseCompreensao || m.clinicalRecord?.motivoDemanda || 'Sessão criada',
      status: m.status,
      date,
    });
  });

  orderedTranscricoes.forEach((t) => {
    const date = t.createdAt ? new Date(t.createdAt) : null;
    if (!date || Number.isNaN(date.getTime())) return;
    items.push({
      type: 'transcricao',
      title: t.fileName || 'Transcrição',
      description: t.analysis?.summary || 'Transcrição registrada',
      status: t.analysis?.sentiments ? 'Com análise' : 'Sem análise',
      date,
    });
  });

  return items
    .filter((item) => item.date)
    .sort((a, b) => b.date - a.date)
    .slice(0, 30);
};
