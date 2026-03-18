import React from 'react';
import {
  STATUS_LABELS,
  getBadgeClass,
  formatDate,
  normalizeStatus,
} from '../utils/sessoesUtils';

export default function SessoesList({
  meetings,
  loading,
  error,
  onOpenMeeting,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b flex items-center justify-between flex-none">
        <p className="text-sm text-gray-700">
          {meetings.length} sessão(ões) encontrada(s)
        </p>
        {loading && <span className="text-xs text-gray-500">Carregando...</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      <div className="divide-y flex-1 min-h-0 overflow-y-auto">
        {meetings.map((m) => {
          const statusNorm = normalizeStatus(m.status);
          const statusLabel = STATUS_LABELS[statusNorm] || statusNorm;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpenMeeting(m.id)}
              className="w-full text-left px-3 py-3 sm:px-4 sm:py-3 hover:bg-gray-50 focus:bg-gray-50 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                    {(m.studentName || 'S').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">
                      {m.studentName || 'Sessão sem nome'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {m.scheduledDate || '---'} {m.scheduledTime ? `às ${m.scheduledTime}` : ''}
                      {m.dateTime ? ` • ${formatDate(m.dateTime)}` : ''}
                    </p>
                  </div>
                </div>

                <div className="pl-12 sm:pl-0 sm:ml-[2.6rem] space-y-0.5">
                  <p className="text-xs text-gray-700 break-words">
                    {m.studentEmail || 'Email não informado'}
                    {m.curso ? ` • ${m.curso}` : ''}
                  </p>
                  <p className="text-[11px] text-gray-500">ID: {m.id}</p>
                </div>
              </div>
              <div className="flex-shrink-0 ml-auto text-right">
                <div className="flex flex-col items-end gap-1">
                  <span className={getBadgeClass(statusNorm)}>{statusLabel}</span>
                  <p className="text-[11px] sm:text-xs text-gray-500">
                    Criada em: {formatDate(m.createdAt)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}

        {!loading && !meetings.length && (
          <div className="px-3 py-4 sm:px-4 sm:py-6 text-sm text-gray-600">
            Nenhuma sessão encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
