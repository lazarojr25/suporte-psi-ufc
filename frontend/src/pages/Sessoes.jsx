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
    setStatusFilter,
    setDateFilter,
    setQuery,
    loadMeetings,
    openMeeting,
  } = useSessoesData();

  return (
    <div className="h-full w-full flex flex-col min-h-0 gap-4 overflow-hidden">
      <div className="bg-white rounded-xl shadow p-4">
        <SessoesHeader onRefresh={loadMeetings} />
      </div>

      <SessoesFilters
        statusFilter={statusFilter}
        dateFilter={dateFilter}
        query={query}
        onStatusFilterChange={setStatusFilter}
        onDateFilterChange={setDateFilter}
        onQueryChange={setQuery}
      />

      <SessoesList
        meetings={filteredMeetings}
        loading={loading}
        error={error}
        onOpenMeeting={openMeeting}
      />
    </div>
  );
}
