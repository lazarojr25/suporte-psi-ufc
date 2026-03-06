export default function AgendaHeader({ monthLabel, currentMonthPrev, currentMonthNext }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="text-xs uppercase text-gray-500">Agenda</p>
        <h1 className="text-2xl font-bold text-gray-900">Solicitações e agendamentos</h1>
        <p className="text-sm text-gray-500">
          Visualize solicitações e sessões agendadas no calendário.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={currentMonthPrev}
          className="px-3 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
        >
          ← Mês anterior
        </button>
        <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
        <button
          onClick={currentMonthNext}
          className="px-3 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
        >
          Próximo mês →
        </button>
      </div>
    </div>
  );
}
