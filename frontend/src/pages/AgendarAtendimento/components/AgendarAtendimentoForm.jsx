import React from 'react';
import { formatDateOption } from '../utils/agendarAtendimentoUtils';

export default function AgendarAtendimentoForm({
  selectedDate,
  selectedTime,
  availableSlots,
  observacoes,
  availableDates,
  isLocked,
  loading,
  onDateChange,
  onTimeChange,
  onObservacoesChange,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit}>
      <label className="block mb-4">
        <span className="text-sm font-medium text-gray-700">Data do Atendimento</span>
        <select
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
          required
        >
          <option value="">Selecione uma data</option>
          {availableDates.map((date) => (
            <option key={date} value={date}>
              {formatDateOption(date)}
            </option>
          ))}
        </select>
      </label>

      {selectedDate && (
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Horário do Atendimento</span>
          <select
            value={selectedTime}
            onChange={(e) => onTimeChange(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
            required
          >
            <option value="">Selecione um horário</option>
            {availableSlots.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          {availableSlots.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Nenhum horário disponível para esta data
            </p>
          )}
        </label>
      )}

      <label className="block mb-4">
        <span className="text-sm font-medium text-gray-700">Observações</span>
        <textarea
          value={observacoes}
          onChange={(e) => onObservacoesChange(e.target.value)}
          rows={4}
          placeholder="Observações sobre o atendimento (opcional)"
          className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
        />
      </label>

      <button
        type="submit"
        disabled={loading || !selectedDate || !selectedTime || isLocked}
        className="w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Agendando...' : 'Agendar Consulta'}
      </button>
    </form>
  );
}
