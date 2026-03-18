import React from 'react';

const meetingStatusBadge = (status) => {
  const normalized = (status || '').toString().toLowerCase();
  if (normalized.includes('erro')) {
    return 'bg-rose-100 text-rose-800 border-rose-200';
  }
  if (normalized.includes('concl')) {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  if (normalized.includes('cancel')) {
    return 'bg-red-100 text-red-700 border-red-200';
  }
  if (normalized.includes('process')) {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  if (normalized.includes('agend')) {
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }

  return 'bg-gray-100 text-gray-700 border-gray-200';
};

export default function SolicitacaoDetalheMeeting({ meeting, onOpenMeeting }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <p className="text-xs uppercase text-gray-500 tracking-wide">Sessão vinculada</p>
      {meeting ? (
        <div className="border rounded-xl p-4 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <p className="text-sm font-semibold text-gray-900">
              {meeting.scheduledDate || 'Data não definida'}
            </p>
            {meeting.scheduledTime && (
              <span className="text-sm text-gray-600">às {meeting.scheduledTime}</span>
            )}
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${meetingStatusBadge(
              meeting.status || 'agendada',
            )}`}
          >
            {meeting.status === 'erro_transcricao'
              ? 'Erro de transcrição'
              : meeting.status || 'Status indefinido'}
          </span>
          {meeting.createdAt && (
            <p className="text-xs text-gray-500">
              Registrada em {meeting.createdAt}
            </p>
          )}
          <button
            type="button"
            onClick={onOpenMeeting}
            className="inline-flex text-sm text-blue-700 font-semibold hover:underline"
          >
            Acessar detalhes da sessão
          </button>
        </div>
      ) : (
        <div className="border border-dashed rounded-xl p-4 text-sm text-gray-600">
          Nenhuma sessão ainda vinculada a esta solicitação.
        </div>
      )}
    </div>
  );
}
