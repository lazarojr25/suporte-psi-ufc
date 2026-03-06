import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import apiService from '../../../services/api';
import { CONFIG_DEFAULTS, buildAttendancePayload } from '../utils/configuracoesUtils';

export default function useConfiguracoesData() {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [maxSessions, setMaxSessions] = useState(CONFIG_DEFAULTS.MAX_SESSIONS);

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
          setMaxSessions(res.data.maxSessionsPerDiscente ?? CONFIG_DEFAULTS.MAX_SESSIONS);
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
      const payload = buildAttendancePayload({ periodStart, periodEnd, maxSessions });
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

  return {
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    maxSessions,
    setMaxSessions,
    loading,
    saving,
    error,
    success,
    role,
    reprocessMsg,
    reprocessErr,
    reprocessing,
    handleSave,
    handleReprocess,
  };
}
