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
    <div className="bg-white rounded-xl shadow">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <p className="text-sm text-gray-700">
          {meetings.length} sessão(ões) encontrada(s)
        </p>
        {loading && <span className="text-xs text-gray-500">Carregando...</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      <div className="divide-y">
        {meetings.map((m) => {
          const statusNorm = normalizeStatus(m.status);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpenMeeting(m.id)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {m.studentName || 'Sessão'}
                  </p>
                  {statusNorm && (
                    <span className={getBadgeClass(statusNorm)}>
                      {STATUS_LABELS[statusNorm] || statusNorm}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">
                  {m.scheduledDate || '---'} {m.scheduledTime ? `às ${m.scheduledTime}` : ''}
                  {m.dateTime ? ` • ${formatDate(m.dateTime)}` : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {m.studentEmail || '---'} {m.curso ? `• ${m.curso}` : ''}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                Criada em: {formatDate(m.createdAt)}
              </div>
            </button>
          );
        })}

        {!loading && !meetings.length && (
          <div className="px-4 py-6 text-sm text-gray-600">
            Nenhuma sessão encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
