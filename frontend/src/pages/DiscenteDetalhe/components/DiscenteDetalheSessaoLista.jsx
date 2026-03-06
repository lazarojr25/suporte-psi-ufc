import React, { useState } from 'react';
import { buildMeetingStatus } from '../utils/meetingUtils';

export default function DiscenteDetalheSessaoLista({
  meetingsDiscente,
  loadingMeetings,
  formatMeetingLabel,
  onOpenMeeting,
  onConcludeMeeting,
}) {
  const [finishingMeetingId, setFinishingMeetingId] = useState(null);

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold">Sessões</h2>
        <p className="text-xs text-gray-500">Galeria resumida (mais recentes primeiro).</p>
      </div>

      {loadingMeetings ? (
        <p className="text-sm text-gray-500">Carregando sessões...</p>
      ) : meetingsDiscente.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma sessão registrada para este discente.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
          {meetingsDiscente.map((m) => {
            const summaryText =
              m.clinicalRecord?.analiseCompreensao ||
              m.clinicalRecord?.motivoDemanda ||
              m.notes ||
              m.informalNotes ||
              null;
            const observationsText = m.clinicalRecord?.procedimentos || null;
            const planText = m.clinicalRecord?.planoObjetivos || null;
            const status = buildMeetingStatus(m);
            return (
              <div key={m.id} className="border rounded-lg p-3 bg-gray-50 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{formatMeetingLabel(m)}</p>
                    <p className="text-[11px] text-gray-500">
                      Criada em: {m.createdAt ? new Date(m.createdAt).toLocaleString('pt-BR') : '---'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                    {m._dateObj && (
                      <span className="text-[11px] text-gray-500">
                        {m._isPast ? 'Data passada' : 'Sessão futura'}
                      </span>
                    )}
                  </div>
                </div>

                {summaryText && (
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold text-gray-800">Resumo: </span>
                    {summaryText}
                  </p>
                )}
                {observationsText && (
                  <p className="text-[11px] text-gray-700">
                    <span className="font-semibold text-gray-800">Condutas: </span>
                    {observationsText}
                  </p>
                )}
                {planText && (
                  <p className="text-[11px] text-gray-700">
                    <span className="font-semibold text-gray-800">Próximos passos: </span>
                    {planText}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-auto">
                  <button
                    type="button"
                    onClick={() => onOpenMeeting(m.id)}
                    className="inline-flex items-center px-2 py-1 rounded-md border text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Ver sessão
                  </button>
                  {m._statusNormalized !== 'concluida' && (
                    <button
                      type="button"
                      disabled={finishingMeetingId === m.id || loadingMeetings}
                      onClick={async () => {
                        try {
                          setFinishingMeetingId(m.id);
                          await onConcludeMeeting(m.id);
                        } finally {
                          setFinishingMeetingId(null);
                        }
                      }}
                      className="inline-flex items-center px-2 py-1 rounded-md bg-green-600 text-white text-[11px] font-semibold hover:bg-green-700 disabled:opacity-50"
                    >
                      {finishingMeetingId === m.id ? 'Concluindo...' : 'Marcar como concluída'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
