import { WEEK_DAYS } from '../utils/agendaUtils';

export default function AgendaCalendar({
  calendarDays,
  currentMonth,
  selectedDate,
  eventsByDay,
  emptyDayEvents,
  onSelectDate,
}) {
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-xl shadow p-4 xl:col-span-2">
      <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-gray-600 mb-2">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-center py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const inMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = key === todayKey;
          const dayEvents = eventsByDay[key] || emptyDayEvents;
          const pendingCount = dayEvents.solicitacoesPendentes.length;
          const meetingsCount = dayEvents.meetings.length;
          const hasEvents = pendingCount + meetingsCount > 0;

          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelectDate(key)}
              className={`h-24 rounded-lg border flex flex-col items-start p-2 text-left transition ${
                inMonth ? 'bg-white' : 'bg-gray-50'
              } ${isToday ? 'border-blue-300 bg-blue-50' : ''} ${
                selectedDate === key ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'
              }`}
            >
              <span
                className={`text-sm font-semibold ${
                  inMonth ? 'text-gray-900' : 'text-gray-400'
                } ${isToday ? 'text-blue-600' : ''}`}
              >
                {day.getDate()}
              </span>
              {hasEvents && (
                <div className="mt-2 w-full flex flex-col gap-1">
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold">
                      {pendingCount} solicitação{pendingCount > 1 ? 's' : ''} pendente
                      {pendingCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {meetingsCount > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-800 text-[11px] font-semibold">
                      {meetingsCount} encontro{meetingsCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
