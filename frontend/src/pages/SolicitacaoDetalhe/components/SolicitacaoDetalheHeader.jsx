import React from 'react';

export default function SolicitacaoDetalheHeader({
  title,
  statusBadge,
  onBack,
  canSchedule,
  onSchedule,
  onOpenDiscente,
  disabledDiscente,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <p className="text-xs uppercase text-gray-500">Registro de solicitação</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 break-words">{title}</h1>
          {statusBadge && (
            <span className={statusBadge.className}>{statusBadge.label}</span>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Acompanhe os dados do registro e a sessão vinculada a esta solicitação.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {canSchedule && (
          <button
            type="button"
            onClick={onSchedule}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
          >
            Agendar sessão
          </button>
        )}
        <button
          type="button"
          onClick={onOpenDiscente}
          disabled={disabledDiscente}
          className="px-4 py-2 rounded-md text-xs font-semibold border text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Ver discente
        </button>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-md border text-xs text-gray-700 hover:bg-gray-50"
        >
          Voltar para agenda
        </button>
      </div>
    </div>
  );
}
