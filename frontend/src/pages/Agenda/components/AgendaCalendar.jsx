import { WEEK_DAYS, dateKey, isDateOnOrAfterToday } from '../utils/agendaUtils';

export default function AgendaCalendar({
  monthLabel,
  currentMonthPrev,
  currentMonthNext,
  calendarDays,
  currentMonth,
  selectedDate,
  eventsByDay,
  emptyDayEvents,
  onSelectDate,
  canScheduleSelectedDate = false,
  onOpenScheduleModal = null,
}) {
  const todayKey = dateKey(new Date());

  return (
    <div className="bg-white rounded-xl shadow p-3 sm:p-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={currentMonthPrev}
          className="px-3 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
        >
          ← Mês anterior
        </button>
        <span className="text-sm font-semibold text-gray-800 text-center">{monthLabel}</span>
        <button
          type="button"
          onClick={currentMonthNext}
          className="px-3 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
        >
          Próximo mês →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-gray-600 mb-2">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-center py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1 min-h-0 auto-rows-fr">
        {calendarDays.map((day) => {
          const key = dateKey(day);
          const inMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = key === todayKey;
          const canScheduleDay = isDateOnOrAfterToday(key);
          const dayEvents = eventsByDay[key] || emptyDayEvents;
          const pendingCount = dayEvents.solicitacoesPendentes.length;
          const meetingsCount = dayEvents.meetings.length;
          const hasEvents = pendingCount + meetingsCount > 0;

          const isSelected = selectedDate === key;
          return (
            <div key={key} className="relative h-full">
              <button
                type="button"
                onClick={() => onSelectDate(key, hasEvents)}
                onDoubleClick={() => {
                  onSelectDate(key, hasEvents);
                  if (canScheduleDay && onOpenScheduleModal) {
                    onOpenScheduleModal(key);
                  }
                }}
                className={`h-full w-full min-h-[40px] sm:min-h-[44px] rounded-lg border flex flex-col items-start p-1.5 text-left transition ${
                  inMonth ? 'bg-white' : 'bg-gray-50'
                } ${isToday ? 'border-blue-300 bg-blue-50' : ''} ${
                  isSelected ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <span
                  className={`text-xs sm:text-sm font-semibold ${
                    inMonth ? 'text-gray-900' : 'text-gray-400'
                  } ${isToday ? 'text-blue-600' : ''}`}
                >
                  {day.getDate()}
                </span>
                {hasEvents && (
                  <div className="mt-1 w-full flex flex-col gap-0.5">
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] leading-none font-semibold truncate">
                        {pendingCount} solicit.
                      </span>
                    )}
                    {meetingsCount > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] leading-none font-semibold truncate">
                        {meetingsCount} sessões
                      </span>
                    )}
                  </div>
                )}
              </button>

              {isSelected && canScheduleSelectedDate && onOpenScheduleModal && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenScheduleModal(key);
                  }}
                  aria-label="Agendar sessão"
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-blue-600 text-white text-xs font-bold leading-none hover:bg-blue-700"
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
