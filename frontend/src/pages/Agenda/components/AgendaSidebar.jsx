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
  upcomingMeetings,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase text-gray-500">Dia selecionado</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatSelectedDateLabel(selectedDate)}
          </p>
          <p className="text-xs text-gray-500">
            {getDaySummaryLabel(
              selectedDayEvents.solicitacoesPendentes.length,
              selectedDayEvents.meetings.length
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs w-full sm:w-auto"
          >
            <option value="all">Todos os tipos</option>
            <option value="meeting">Sessões</option>
            <option value="solicitacao">Solicitações</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs w-full sm:w-auto"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'Todos os status' : status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedEvents.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum evento para esta data.</p>
      ) : filteredEvents.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum evento corresponde aos filtros.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
          {filteredEvents.map((evt) => (
            <div
              key={`${evt.type}-${evt.id}`}
              className={`border rounded-lg p-3 bg-gray-50 flex flex-col gap-1 cursor-pointer ${
                selectedEvent?.id === evt.id ? 'ring-2 ring-blue-200 border-blue-400' : ''
              }`}
              onClick={() => onSelectEvent(evt)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${
                    evt.type === 'meeting'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {evt.type === 'meeting' ? 'Sessão' : 'Solicitação'}
                </span>
                {evt.time && (
                  <span className="text-[11px] text-gray-600">{evt.time}</span>
                )}
              </div>
              <p className="text-gray-800 font-medium">{evt.title}</p>
              {evt.status && (
                <p className="text-[11px] text-gray-500">Status: {evt.status}</p>
              )}
              {evt.studentName && (
                <p className="text-[11px] text-gray-500">Discente: {evt.studentName}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t">
        <p className="text-xs uppercase text-gray-500 mb-2">Detalhes</p>
        {!selectedEvent ? (
          <p className="text-sm text-gray-500">Selecione um evento.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-gray-800">{selectedEvent.title}</p>
            <p className="text-xs text-gray-500">
              Tipo: {selectedEvent.type === 'meeting' ? 'Sessão' : 'Solicitação'}{' '}
              {selectedEvent.time && `• ${selectedEvent.time}`}
            </p>
            {selectedEvent.studentName && (
              <p className="text-xs text-gray-500">Discente: {selectedEvent.studentName}</p>
            )}
            {selectedEvent.curso && (
              <p className="text-xs text-gray-500">Curso: {selectedEvent.curso}</p>
            )}
            {selectedEvent.status && (
              <p className="text-xs text-gray-500">Status: {selectedEvent.status}</p>
            )}

            {selectedEvent.type === 'meeting' ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-gray-500">
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
                <p className="text-xs text-gray-500">
                  Abra a solicitação para revisar dados e registrar uma sessão.
                </p>
                {selectedEvent.status && isSolicitacaoComEncontroAgendado(selectedEvent.status) && (
                  <p className="text-xs text-amber-700">
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

      <div className="pt-2 border-t text-sm">
        <p className="text-xs uppercase text-gray-500 mb-2">Próximas sessões</p>
        {upcomingMeetings.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma sessão futura.</p>
        ) : (
          <ul className="space-y-2">
            {upcomingMeetings.map((m) => (
              <li key={m.id} className="border rounded-lg p-2 bg-white">
                <p className="font-semibold text-gray-800">{m.studentName || 'Sessão'}</p>
                <p className="text-xs text-gray-600">
                  {m.scheduledDate} {m.scheduledTime && `às ${m.scheduledTime}`}
                </p>
                <p className="text-[11px] text-gray-500">Status: {m.status}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
