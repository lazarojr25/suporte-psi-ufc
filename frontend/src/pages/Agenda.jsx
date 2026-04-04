import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import useAgendaData from './Agenda/hooks/useAgendaData';
import AgendaHeader from './Agenda/components/AgendaHeader';
import AgendaCalendar from './Agenda/components/AgendaCalendar';
import AgendaSidebar from './Agenda/components/AgendaSidebar';

export default function Agenda() {
  const navigate = useNavigate();
  const dailyPanelRef = useRef(null);

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
    changeMonth,
    setTypeFilter,
    setStatusFilter,
    selectDate,
    setSelectedEvent,
  } = useAgendaData();

  const handleSelectDate = (dateKey, hasEvents) => {
    selectDate(dateKey);

    if (
      hasEvents &&
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches
    ) {
      window.setTimeout(() => {
        dailyPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <div className="bg-white rounded-xl shadow p-4">
        <AgendaHeader />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Carregando agenda...</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] gap-4 items-stretch flex-1 min-h-0 overflow-y-auto xl:overflow-hidden">
        <div className="min-h-0 xl:h-full">
          <AgendaCalendar
            monthLabel={monthLabel}
            currentMonthPrev={() => changeMonth(-1)}
            currentMonthNext={() => changeMonth(1)}
            calendarDays={calendarDays}
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            eventsByDay={eventsByDay}
            emptyDayEvents={{ meetings: [], solicitacoesPendentes: [] }}
            onSelectDate={handleSelectDate}
          />
        </div>

        <div ref={dailyPanelRef} className="min-h-0 xl:h-full">
          <AgendaSidebar
            isMainView
            emptyMessage="Nenhum evento relacionado ao seu usuário nesta data."
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
          />
        </div>
      </div>
    </div>
  );
}
