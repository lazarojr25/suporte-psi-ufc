import React from 'react';
import useAgendarAtendimentoData from './AgendarAtendimento/hooks/useAgendarAtendimentoData';
import AgendarAtendimentoForm from './AgendarAtendimento/components/AgendarAtendimentoForm';
import AgendarAtendimentoResumo from './AgendarAtendimento/components/AgendarAtendimentoResumo';

export default function AgendarAtendimento() {
  const {
    selectedDate,
    selectedTime,
    availableSlots,
    observacoes,
    solicitacao,
    loading,
    error,
    isLocked,
    availableDates,
    handleDateChange,
    setSelectedTime,
    setObservacoes,
    handleAgendamento,
    navigateBack,
  } = useAgendarAtendimentoData();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md w-full max-w-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Agendar Atendimento</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {solicitacao ? (
          <>
            <AgendarAtendimentoResumo solicitacao={solicitacao} isLocked={isLocked} />

            <AgendarAtendimentoForm
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              availableSlots={availableSlots}
              observacoes={observacoes}
              availableDates={availableDates}
              isLocked={isLocked}
              loading={loading}
              onDateChange={handleDateChange}
              onTimeChange={setSelectedTime}
              onObservacoesChange={setObservacoes}
              onSubmit={handleAgendamento}
            />

            <div className="mt-4">
              <button
                onClick={navigateBack}
                className="w-full py-2 rounded-xl bg-gray-600 text-white font-semibold hover:bg-gray-700"
              >
                Voltar para Solicitações
              </button>
            </div>
          </>
        ) : (
          <p>Carregando dados da solicitação...</p>
        )}
      </div>
    </div>
  );
}
