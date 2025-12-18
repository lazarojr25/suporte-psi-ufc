import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import apiService from '../services/api';

export default function Configuracoes() {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [maxSessions, setMaxSessions] = useState(6);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [reprocessMsg, setReprocessMsg] = useState(null);
  const [reprocessErr, setReprocessErr] = useState(null);
  const [reprocessing, setReprocessing] = useState(false);
  const { role } = useOutletContext() || {};

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

  const handleReprocess = async () => {
    setReprocessing(true);
    setReprocessErr(null);
    setReprocessMsg(null);
    try {
      const res = await apiService.reprocessAllTranscriptions(undefined, { force: true });
      if (res?.success) {
        setReprocessMsg(`Reprocessadas ${res.total} transcrições.`);
      } else {
        setReprocessErr(res?.message || 'Falha ao reprocessar.');
      }
    } catch (err) {
      console.error(err);
      setReprocessErr(err.message || 'Erro ao reprocessar.');
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div>
        <p className="text-xs uppercase text-gray-500">Configurações</p>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
      </div>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Configurações de atendimentos</h2>

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-2">{success}</p>}

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <form
            onSubmit={handleSave}
            className="space-y-4 text-sm"
          >
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

      {role === 'admin' && (
        <section className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="text-lg font-semibold mb-1">Configurações de transcrição</h2>
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Reprocessar transcrições</h3>
              {reprocessMsg && <span className="text-[11px] text-green-600">{reprocessMsg}</span>}
              {reprocessErr && <span className="text-[11px] text-red-600">{reprocessErr}</span>}
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Reexecuta a análise de todas as transcrições com o modelo/prompt atual.
            </p>
            <button
              type="button"
              onClick={handleReprocess}
              disabled={reprocessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {reprocessing ? 'Reprocessando...' : 'Reprocessar transcrições'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
