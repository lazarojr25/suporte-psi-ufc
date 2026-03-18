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
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <p className="text-xs uppercase text-gray-500">Sessões</p>
        <h1 className="text-2xl font-bold text-gray-900">Lista de sessões</h1>
        <p className="text-sm text-gray-600">
          Filtre por status, data ou aluno e abra os detalhes.
        </p>
      </div>

      <div className="text-xs sm:text-sm text-gray-700 flex flex-wrap gap-3">
        <span>
          Total filtradas: <strong className="text-gray-900">{total}</strong>
        </span>
        <span>
          Agendadas: <strong className="text-blue-700">{agendada}</strong>
        </span>
        <span>
          Em processamento: <strong className="text-amber-700">{emProcessamento}</strong>
        </span>
        <span>
          Concluídas: <strong className="text-emerald-700">{concluida}</strong>
        </span>
        <span>
          Canceladas: <strong className="text-red-700">{cancelada}</strong>
        </span>
      </div>
    </div>
  );
}
