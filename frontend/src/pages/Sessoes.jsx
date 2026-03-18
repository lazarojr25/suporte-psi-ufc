import React from 'react';
import useSessoesData from './Sessoes/hooks/useSessoesData';
import SessoesHeader from './Sessoes/components/SessoesHeader';
import SessoesFilters from './Sessoes/components/SessoesFilters';
import SessoesList from './Sessoes/components/SessoesList';

export default function Sessoes() {
  const {
    statusFilter,
    dateFilter,
    query,
    filteredMeetings,
    loading,
    error,
    summary,
    setStatusFilter,
    setDateFilter,
    setQuery,
    openMeeting,
  } = useSessoesData();

  return (
    <div className="h-full w-full flex flex-col min-h-0 gap-4 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-md w-full p-4 sm:p-6 flex-none">
        <SessoesHeader summary={summary} />
      </div>

      <div className="bg-white rounded-2xl shadow-md w-full flex-1 min-h-0 p-4 sm:p-6 flex flex-col gap-4 overflow-hidden">
        <div className="flex-none">
          <SessoesFilters
            statusFilter={statusFilter}
            dateFilter={dateFilter}
            query={query}
            onStatusFilterChange={setStatusFilter}
            onDateFilterChange={setDateFilter}
            onQueryChange={setQuery}
          />
        </div>

        <SessoesList
          meetings={filteredMeetings}
          loading={loading}
          error={error}
          onOpenMeeting={openMeeting}
        />
      </div>
    </div>
  );
}
