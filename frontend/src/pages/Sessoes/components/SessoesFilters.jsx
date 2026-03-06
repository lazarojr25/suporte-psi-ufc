import React from 'react';

export default function SessoesFilters({
  statusFilter,
  dateFilter,
  query,
  onStatusFilterChange,
  onDateFilterChange,
  onQueryChange,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
      <label className="text-sm space-y-1">
        <span className="text-[11px] text-gray-600 uppercase">Status</span>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
        >
          <option value="">Todos</option>
          <option value="agendada">Agendadas</option>
          <option value="em_processamento">Processando</option>
          <option value="concluida">Concluídas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </label>

      <label className="text-sm space-y-1">
        <span className="text-[11px] text-gray-600 uppercase">Data</span>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
        />
      </label>

      <label className="text-sm space-y-1 md:col-span-2">
        <span className="text-[11px] text-gray-600 uppercase">
          Buscar por nome, email ou curso
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Ex.: Maria, @ufc.br, Psicologia"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
        />
      </label>
    </div>
  );
}
