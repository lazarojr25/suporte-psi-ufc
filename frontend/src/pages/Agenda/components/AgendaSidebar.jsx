import {
  formatSelectedDateLabel,
  getDaySummaryLabel,
  isSolicitacaoComEncontroAgendado,
} from '../utils/agendaUtils';

export default function AgendaSidebar({
  selectedDate,
  selectedDayEvents,
  typeFilter,
  statusFilter,
  statusOptions,
  filteredEvents,
  selectedEvents,
  selectedEvent,
  onTypeFilterChange,
  onStatusFilterChange,
  onSelectEvent,
  onNavigate,
}) {
  const getTypeClass = (type) =>
    type === 'meeting'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-amber-100 text-amber-800 border-amber-200';

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3 min-h-0 h-full flex flex-col overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase text-gray-500">Dia selecionado</p>
          <p className="text-base sm:text-lg font-semibold text-gray-900">
            {formatSelectedDateLabel(selectedDate)}
          </p>
          <p className="text-[11px] sm:text-xs text-gray-500">
            {getDaySummaryLabel(
              selectedDayEvents.solicitacoesPendentes.length,
              selectedDayEvents.meetings.length
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 text-[11px] sm:text-xs w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            className="border rounded-md px-2 py-1 w-full sm:w-auto"
          >
            <option value="all">Todos os tipos</option>
            <option value="meeting">Sessões</option>
            <option value="solicitacao">Solicitações</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="border rounded-md px-2 py-1 w-full sm:w-auto"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'Todos os status' : status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 max-h-[52vh] md:max-h-none overflow-y-auto pr-1 pb-3 space-y-2.5">
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento para esta data.</p>
        ) : filteredEvents.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento corresponde aos filtros.</p>
        ) : (
          filteredEvents.map((evt) => (
            <button
              type="button"
              key={`${evt.type}-${evt.id}`}
              onClick={() => onSelectEvent(evt)}
              className={`w-full min-h-[96px] text-left rounded-lg border bg-white px-3 py-2.5 flex flex-col gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 cursor-pointer ${
                (selectedEvent?.id === evt.id && selectedEvent?.type === evt.type)
                  ? 'ring-2 ring-blue-200 border-blue-400 bg-blue-50/50'
                  : 'hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-semibold ${getTypeClass(
                    evt.type
                  )}`}
                >
                  {evt.type === 'meeting' ? 'Sessão' : 'Solicitação'}
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {evt.time || 'Sem horário'}
                </span>
              </div>

              <p className="text-gray-900 font-semibold text-sm sm:text-[15px] leading-tight break-words">
                {evt.title}
              </p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                {(evt.curso || evt.status) && (
                  <p className="break-words">
                    {evt.curso && <span>Curso: {evt.curso}</span>}
                    {evt.curso && evt.status ? <span className="text-gray-500"> • </span> : null}
                    {evt.status && (
                      <span>
                        Status: <span className="text-gray-700 font-semibold">{evt.status}</span>
                      </span>
                    )}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
      

      <div className="pt-3 border-t shrink-0">
        <p className="text-[11px] uppercase text-gray-500 mb-2">Detalhes</p>
        {!selectedEvent ? (
          <p className="text-sm text-gray-500">Selecione um evento.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-gray-800">{selectedEvent.title}</p>
            <p className="text-[11px] text-gray-500">
              Tipo: {selectedEvent.type === 'meeting' ? 'Sessão' : 'Solicitação'}{' '}
              {selectedEvent.time && `• ${selectedEvent.time}`}
            </p>
            {selectedEvent.studentName && (
              <p className="text-[11px] text-gray-500">Discente: {selectedEvent.studentName}</p>
            )}
            {selectedEvent.curso && (
              <p className="text-[11px] text-gray-500">Curso: {selectedEvent.curso}</p>
            )}
            {selectedEvent.status && (
              <p className="text-[11px] text-gray-500">Status: {selectedEvent.status}</p>
            )}

            {selectedEvent.type === 'meeting' ? (
              <div className="mt-3 space-y-3">
                <p className="text-[11px] text-gray-500">
                  Abra a sessão para registrar prontuário, notas e transcrição.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/meetings/${selectedEvent.id}`)}
                    className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    Abrir sessão
                  </button>
                  {selectedEvent.solicitacaoId && (
                    <button
                      type="button"
                      onClick={() => onNavigate(`/solicitacoes/${selectedEvent.solicitacaoId}`)}
                      className="px-3 py-2 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Ver solicitação vinculada
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-[11px] text-gray-500">
                  Abra a solicitação para revisar dados e registrar uma sessão.
                </p>
                {selectedEvent.status && isSolicitacaoComEncontroAgendado(selectedEvent.status) && (
                  <p className="text-[11px] text-amber-700">
                    Esta solicitação já possui um encontro agendado.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/solicitacoes/${selectedEvent.id}`)}
                    className="px-3 py-2 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
                  >
                    Ver solicitação
                  </button>
                  {!selectedEvent.status ||
                  !isSolicitacaoComEncontroAgendado(selectedEvent.status) ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(`/agendar-atendimento/${selectedEvent.id}`)}
                      className="px-3 py-2 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Agendar sessão
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
