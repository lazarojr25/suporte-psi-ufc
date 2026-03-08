import React from 'react';
import { buildMeetingStatus } from '../utils/meetingUtils';

export default function DiscenteDetalheRelatoriosPsicologicos({
  clinicalReports,
  loadingMeetings,
  formatMeetingLabel,
  onOpenMeeting,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Relatórios psicológicos</h2>
          <p className="text-[11px] sm:text-xs text-gray-500">
            Registros por sessão, alinhados ao manual do CFP.
          </p>
        </div>
      </div>

      {loadingMeetings ? (
        <p className="text-sm text-gray-500">Carregando relatórios...</p>
      ) : clinicalReports.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum relatório registrado.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 text-xs sm:text-sm">
          {clinicalReports.map((m) => {
            const cr = m.clinicalRecord || {};
            const status = buildMeetingStatus(m);
            return (
              <div
                key={`report-${m.id}`}
                className="border rounded-lg p-2.5 sm:p-3 bg-gray-50 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Sessão: {formatMeetingLabel(m)}</p>
                    <p className="text-[11px] text-gray-500">Status: {m.status || '---'}</p>
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

                {cr.motivoDemanda && (
                  <p className="text-xs text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-800">Motivo: </span>
                    {cr.motivoDemanda}
                  </p>
                )}
                {cr.procedimentos && (
                  <p className="text-[11px] text-gray-700">
                    <span className="font-semibold text-gray-800">Procedimentos: </span>
                    {cr.procedimentos}
                  </p>
                )}
                {cr.analiseCompreensao && (
                  <p className="text-xs text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-800">Análise: </span>
                    {cr.analiseCompreensao}
                  </p>
                )}
                {cr.encaminhamentosRecomendacoes && (
                  <p className="text-[11px] text-gray-700">
                    <span className="font-semibold text-gray-800">Encaminhamentos/Recomendações: </span>
                    {cr.encaminhamentosRecomendacoes}
                  </p>
                )}
                {cr.limitesDocumento && (
                  <p className="text-[11px] text-gray-700">
                    <span className="font-semibold text-gray-800">Limites do documento: </span>
                    {cr.limitesDocumento}
                  </p>
                )}

                {(cr.planoObjetivos ||
                  cr.planoEstrategias ||
                  cr.planoAcordos ||
                  cr.planoEncaminhamentos ||
                  cr.planoCriterios) && (
                  <div className="border-t pt-2 mt-1 space-y-1 text-[11px] text-gray-700">
                    <p className="font-semibold text-gray-800 text-[11px]">Plano de ação</p>
                    {cr.planoObjetivos && (
                      <p>
                        <span className="font-semibold">Objetivos: </span>
                        {cr.planoObjetivos}
                      </p>
                    )}
                    {cr.planoEstrategias && (
                      <p>
                        <span className="font-semibold">Estratégias: </span>
                        {cr.planoEstrategias}
                      </p>
                    )}
                    {cr.planoAcordos && (
                      <p>
                        <span className="font-semibold">Acordos: </span>
                        {cr.planoAcordos}
                      </p>
                    )}
                    {cr.planoEncaminhamentos && (
                      <p>
                        <span className="font-semibold">Encaminhamentos: </span>
                        {cr.planoEncaminhamentos}
                      </p>
                    )}
                    {cr.planoCriterios && (
                      <p>
                        <span className="font-semibold">Critérios: </span>
                        {cr.planoCriterios}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-auto">
                  <button
                    type="button"
                    onClick={() => onOpenMeeting(m.id)}
                    className="inline-flex items-center px-2 py-1 rounded-md border text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Ver sessão
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
