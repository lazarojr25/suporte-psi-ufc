import React from 'react';

export default function SolicitacaoDetalheHeader({ title, statusBadge, onBack }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase text-gray-500">Solicitação</p>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {statusBadge && (
          <span className={statusBadge.className}>{statusBadge.label}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="px-3 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
      >
        Voltar para agenda
      </button>
    </div>
  );
}
