import React from 'react';

export default function SolicitacaoDetalheActions({
  onSchedule,
  onOpenDiscente,
  discenteId,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <p className="text-xs uppercase text-gray-500">Ações</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSchedule}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
        >
          Agendar sessão
        </button>
        <button
          type="button"
          onClick={onOpenDiscente}
          className="px-4 py-2 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
          disabled={!discenteId}
        >
          Ver discente
        </button>
      </div>
    </div>
  );
}
