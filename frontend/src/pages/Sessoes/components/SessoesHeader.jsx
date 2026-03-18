import React from 'react';

export default function SessoesHeader({ summary }) {
  const {
    total = 0,
    agendada = 0,
    emProcessamento = 0,
    concluida = 0,
    cancelada = 0,
  } = summary || {};

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-gray-500">Sessões</p>
        <h1 className="text-2xl font-bold text-gray-900">Lista de sessões</h1>
        <p className="text-sm text-gray-600">
          Visualize, filtre e acesse rapidamente os registros de atendimento.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
          <p className="text-[11px] uppercase text-gray-500">Total</p>
          <p className="text-xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
          <p className="text-[11px] uppercase text-blue-700">Agendadas</p>
          <p className="text-xl font-bold text-blue-900">{agendada}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-[11px] uppercase text-amber-700">Processando</p>
          <p className="text-xl font-bold text-amber-900">{emProcessamento}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <p className="text-[11px] uppercase text-emerald-700">Concluídas</p>
          <p className="text-xl font-bold text-emerald-900">{concluida}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-[11px] uppercase text-red-700">Canceladas</p>
          <p className="text-xl font-bold text-red-900">{cancelada}</p>
        </div>
      </div>
    </div>
  );
}
