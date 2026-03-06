import React from 'react';

export default function TranscricaoReprocessSection({
  reprocessMsg,
  reprocessErr,
  reprocessing,
  onReprocess,
}) {
  return (
    <section className="bg-white rounded-xl shadow p-4 space-y-3">
      <h2 className="text-lg font-semibold mb-1">Configurações de transcrição</h2>
      <div className="pt-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">
            Reprocessar transcrições
          </h3>
          {reprocessMsg && <span className="text-[11px] text-green-600">{reprocessMsg}</span>}
          {reprocessErr && <span className="text-[11px] text-red-600">{reprocessErr}</span>}
        </div>
        <p className="text-xs text-gray-600 mb-2">
          Reexecuta a análise de todas as transcrições com o modelo/prompt atual.
        </p>
        <button
          type="button"
          onClick={onReprocess}
          disabled={reprocessing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {reprocessing ? 'Reprocessando...' : 'Reprocessar transcrições'}
        </button>
      </div>
    </section>
  );
}
