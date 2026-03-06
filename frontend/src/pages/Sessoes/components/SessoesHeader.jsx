import React from 'react';

export default function SessoesHeader({ onRefresh }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="text-xs uppercase text-gray-500">Sessões</p>
        <h1 className="text-2xl font-bold text-gray-900">Lista de sessões</h1>
        <p className="text-sm text-gray-600">
          Filtre por status, data ou aluno e abra os detalhes.
        </p>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        className="px-3 py-2 text-sm font-semibold rounded-md border bg-white hover:bg-gray-50"
      >
        Atualizar
      </button>
    </div>
  );
}
