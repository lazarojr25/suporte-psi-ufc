import { useNavigate } from 'react-router-dom';

import useAgendaData from './Agenda/hooks/useAgendaData';
import AgendaHeader from './Agenda/components/AgendaHeader';
import AgendaCalendar from './Agenda/components/AgendaCalendar';
import AgendaSidebar from './Agenda/components/AgendaSidebar';

export default function Agenda() {
  const navigate = useNavigate();

  const {
    monthLabel,
    currentMonth,
    selectedDate,
    loading,
    error,
    selectedEvent,
    typeFilter,
    statusFilter,
    calendarDays,
    eventsByDay,
    selectedDayEvents,
    selectedEvents,
    filteredEvents,
    statusOptions,
    upcomingMeetings,
    changeMonth,
    setTypeFilter,
    setStatusFilter,
    selectDate,
    setSelectedEvent,
  } = useAgendaData();

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <AgendaHeader
        monthLabel={monthLabel}
        currentMonthPrev={() => changeMonth(-1)}
        currentMonthNext={() => changeMonth(1)}
      />

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Carregando agenda...</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <AgendaCalendar
          calendarDays={calendarDays}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          eventsByDay={eventsByDay}
          emptyDayEvents={{ meetings: [], solicitacoesPendentes: [] }}
          onSelectDate={selectDate}
        />

        <AgendaSidebar
          selectedDate={selectedDate}
          selectedDayEvents={selectedDayEvents}
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          statusOptions={statusOptions}
          selectedEvents={selectedEvents}
          filteredEvents={filteredEvents}
          selectedEvent={selectedEvent}
          onTypeFilterChange={setTypeFilter}
          onStatusFilterChange={setStatusFilter}
          onSelectEvent={setSelectedEvent}
          onNavigate={navigate}
          upcomingMeetings={upcomingMeetings}
        />
      </div>
    </div>
  );
}
