import React from 'react';

export default function AttendanceConfigForm({
  activeConfigId,
  loading,
  saving,
  error,
  success,
  periodName,
  setPeriodName,
  periodStart,
  setPeriodStart,
  periodEnd,
  setPeriodEnd,
  maxSessions,
  setMaxSessions,
  configList,
  selectedConfigId,
  setSelectedConfigId,
  activating,
  onActivateExisting,
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
        <>
          <form onSubmit={onSubmit} className="space-y-4 text-sm border-b pb-4 mb-4">
            <h3 className="font-semibold text-gray-800">Nova configuração de semestre</h3>

            <div>
              <label className="block mb-1 text-gray-700">Nome da configuração</label>
              <input
                type="text"
                value={periodName}
                onChange={(e) => setPeriodName(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Ex.: Semestre 2026.1"
              />
            </div>

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
              {saving ? 'Salvando nova configuração...' : 'Criar nova configuração'}
            </button>
          </form>

          <form onSubmit={onActivateExisting} className="space-y-3 text-sm">
            <h3 className="font-semibold text-gray-800">Configuração existente</h3>
            <p className="text-xs text-gray-500">
              Selecione um semestre já cadastrado e ative para uso no controle de limite.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block mb-1 text-gray-700">Semestre letivo</label>
                <select
                  value={selectedConfigId}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">Selecione</option>
                  {configList.map((config) => (
                    <option value={config.id} key={config.id}>
                      {config.name} ({config.periodStart || '---'} a {config.periodEnd || '---'}) •
                      {config.maxSessionsPerDiscente ?? 0} sessão(ões)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={activating}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {activating ? 'Ativando...' : 'Usar esta configuração'}
                </button>
              </div>
            </div>

            {activeConfigId && (
              <p className="text-xs text-green-700">
                Configuração ativa no momento: ID {activeConfigId}
              </p>
            )}
          </form>
        </>
      )}
    </section>
  );
}
