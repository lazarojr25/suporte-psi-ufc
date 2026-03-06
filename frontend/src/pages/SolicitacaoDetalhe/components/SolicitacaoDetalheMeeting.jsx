import React from 'react';

export default function SolicitacaoDetalheMeeting({ meeting, onOpenMeeting }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-2">
      <p className="text-xs uppercase text-gray-500">Meeting vinculado</p>
      {meeting ? (
        <div className="text-sm space-y-1">
          <p>
            <strong>Data:</strong> {meeting.scheduledDate}{' '}
            {meeting.scheduledTime && `às ${meeting.scheduledTime}`}
          </p>
          <p><strong>Status:</strong> {meeting.status}</p>
          <button
            type="button"
            onClick={onOpenMeeting}
            className="text-blue-600 text-xs font-semibold hover:underline"
          >
            Abrir sessão
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          Nenhuma sessão criada para esta solicitação.
        </p>
      )}
    </div>
  );
}
