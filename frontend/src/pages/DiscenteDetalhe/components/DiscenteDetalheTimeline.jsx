import React from 'react';

export default function DiscenteDetalheTimeline({
  timelineFilter,
  setTimelineFilter,
  filteredTimelineItems,
  timelineTypeStyles,
  timelineTypeLabels,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-base sm:text-lg font-semibold">Linha do tempo do discente</h2>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-gray-500">Filtrar:</label>
          <select
            value={timelineFilter}
            onChange={(e) => setTimelineFilter(e.target.value)}
            className="border rounded-md px-2 py-1 text-[11px]"
          >
            <option value="all">Todos</option>
            <option value="solicitacao">Solicitações</option>
            <option value="sessao">Sessões</option>
            <option value="transcricao">Transcrições</option>
          </select>
        </div>
      </div>

      {filteredTimelineItems.length === 0 ? (
        <p className="text-sm text-gray-500 mt-2">Nenhum evento registrado.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {filteredTimelineItems.map((item, idx) => (
            <div key={`${item.type}-${idx}-${item.title}`} className="border rounded-lg p-2.5 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold ${
                      timelineTypeStyles[item.type] || 'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}
                  >
                    {timelineTypeLabels[item.type] || item.type}
                  </span>
                  <span className="text-[11px] text-gray-500">{item.date.toLocaleString('pt-BR')}</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-gray-500">{item.status || 'Sem status'}</span>
              </div>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-gray-900">{item.title}</p>
              <p className="text-[11px] leading-relaxed text-gray-700">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
