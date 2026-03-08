import React from 'react';

export default function DiscenteDetalhePainelSessoes({
  isBlockedByLimit,
  usedSessions,
  configuredLimit,
  remainingSessions,
  periodStart,
  periodEnd,
  upcomingMeeting,
  lastCompletedMeeting,
  lastTranscription,
  formatMeetingLabel,
}) {
  return (
    <div
      className={`rounded-xl border shadow-sm p-3 text-[11px] sm:text-[12px] ${
        isBlockedByLimit ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        <div className="rounded-lg p-2.5 space-y-2 h-full flex flex-col">
          <p className="text-xs uppercase text-gray-600 tracking-wide">Controle de sessões</p>
          <p className="text-2xl font-bold text-gray-900">
            {usedSessions}
            {configuredLimit > 0 && <span className="text-lg text-gray-600"> / {configuredLimit}</span>}
          </p>
          <p className="text-gray-700">
            {configuredLimit > 0 ? `Restantes: ${remainingSessions}` : 'Sem limite configurado'}
          </p>
          {isBlockedByLimit && (
            <p className="text-[11px] text-red-700 mt-1">
              Este discente atingiu o limite definido para o período.
            </p>
          )}
          {(periodStart || periodEnd) && (
            <div className="mt-1 pt-1.5 border-t border-white/60 text-[11px] text-gray-700">
              Período considerado: {periodStart || '---'} a {periodEnd || '---'}
            </div>
          )}
        </div>

        <div className="rounded-lg p-2.5 space-y-2 h-full flex flex-col">
          <div className="space-y-1">
            <p className="text-xs uppercase text-gray-500 tracking-wide">Próxima sessão agendada</p>
            <p className="text-sm font-semibold text-gray-900">
              {upcomingMeeting ? formatMeetingLabel(upcomingMeeting) : 'Nenhuma sessão registrada'}
            </p>
            <p className="text-[11px] text-gray-500">
              {upcomingMeeting ? `Status: ${upcomingMeeting.status}` : 'Atualize a agenda quando houver uma nova data.'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase text-gray-500 tracking-wide">Última sessão concluída</p>
            <p className="text-sm font-semibold text-gray-900">
              {lastCompletedMeeting ? formatMeetingLabel(lastCompletedMeeting) : 'Ainda não realizada'}
            </p>
            {lastCompletedMeeting && (
              <p className="text-[11px] text-gray-500">Status: {lastCompletedMeeting.status}</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase text-gray-500 tracking-wide">Última transcrição</p>
            <p className="text-sm font-semibold text-gray-900">
              {lastTranscription?.createdAt
                ? new Date(lastTranscription.createdAt).toLocaleString('pt-BR')
                : 'Sem registros'}
            </p>
            {lastTranscription && <p className="text-[11px] text-gray-500">{lastTranscription.fileName}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
