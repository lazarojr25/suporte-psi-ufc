import React from 'react';

export default function AttendanceConfigForm({
  loading,
  saving,
  error,
  success,
  periodStart,
  setPeriodStart,
  periodEnd,
  setPeriodEnd,
  maxSessions,
  setMaxSessions,
  onSubmit,
}) {
  return (
    <section className="bg-white rounded-xl shadow p-4">
      <h2 className="text-lg font-semibold mb-3">Configurações de atendimentos</h2>

      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-2">{success}</p>}

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block mb-1 text-gray-700">
                Início do período letivo
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Opcional. Se não for informado, o sistema considera os últimos 6 meses.
              </p>
            </div>

            <div>
              <label className="block mb-1 text-gray-700">
                Fim do período letivo
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Opcional. Se não for informado, o sistema considera a data atual.
              </p>
            </div>

            <div>
              <label className="block mb-1 text-gray-700">
                Limite de sessões por discente no período
              </label>
              <input
                type="number"
                min={0}
                value={maxSessions}
                onChange={(e) => setMaxSessions(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Exemplo: 6 sessões por semestre. Use 0 para não aplicar limite.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </form>
      )}
    </section>
  );
}
