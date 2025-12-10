import React, { useEffect, useState } from 'react';
import apiService from '../services/api';

export default function ConfigAtendimentos() {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [maxSessions, setMaxSessions] = useState(6);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getAttendanceConfig();
        if (res?.success && res.data) {
          setPeriodStart(res.data.periodStart || '');
          setPeriodEnd(res.data.periodEnd || '');
          setMaxSessions(res.data.maxSessionsPerDiscente ?? 6);
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar configuração de atendimentos.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        maxSessionsPerDiscente: Number(maxSessions) || 0,
      };

      const res = await apiService.updateAttendanceConfig(payload);
      if (res?.success) {
        setSuccess('Configuração salva com sucesso.');
      } else {
        setError('Falha ao salvar configuração.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Configuração de atendimentos e limite de sessões
      </h1>

      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-2">{success}</p>}

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-xl shadow p-4 space-y-4 text-sm"
        >
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

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </form>
      )}
    </div>
  );
}
