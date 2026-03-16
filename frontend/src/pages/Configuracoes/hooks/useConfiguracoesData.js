import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import apiService from '../../../services/api';
import { CONFIG_DEFAULTS, buildAttendancePayload } from '../utils/configuracoesUtils';

export default function useConfiguracoesData() {
  const [periodName, setPeriodName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [maxSessions, setMaxSessions] = useState(CONFIG_DEFAULTS.MAX_SESSIONS);
  const [configList, setConfigList] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [activeConfigId, setActiveConfigId] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
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
          const active = res.data.active || res.data;
          const configs = res.data.configs || [];

          setPeriodName(active.name || '');
          setPeriodStart(active.periodStart || '');
          setPeriodEnd(active.periodEnd || '');
          setMaxSessions(active.maxSessionsPerDiscente ?? CONFIG_DEFAULTS.MAX_SESSIONS);

          setConfigList(configs);
          setActiveConfigId(active.sourceConfigId || '');
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

  const loadAttendanceConfig = async () => {
    try {
      const res = await apiService.getAttendanceConfig();
      if (!res?.success || !res.data) return;

      const active = res.data.active || res.data;
      const configs = res.data.configs || [];

      setPeriodName(active.name || '');
      setPeriodStart(active.periodStart || '');
      setPeriodEnd(active.periodEnd || '');
      setMaxSessions(active.maxSessionsPerDiscente ?? CONFIG_DEFAULTS.MAX_SESSIONS);

      setConfigList(configs);
      setActiveConfigId(active.sourceConfigId || '');
      setSelectedConfigId('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = buildAttendancePayload({
        periodName,
        periodStart,
        periodEnd,
        maxSessions,
        createNew: true,
      });
      const res = await apiService.updateAttendanceConfig(payload);

      if (res?.success) {
        setSuccess('Configuração salva com sucesso.');
        await loadAttendanceConfig();
      } else {
        setError('Falha ao salvar nova configuração.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar nova configuração.');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateExisting = async (e) => {
    e.preventDefault();

    if (!selectedConfigId) {
      setError('Selecione uma configuração existente.');
      return;
    }

    setActivating(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiService.activateAttendanceConfig(selectedConfigId);
      if (res?.success) {
        setSuccess('Configuração selecionada aplicada com sucesso.');
        await loadAttendanceConfig();
      } else {
        setError('Falha ao aplicar configuração existente.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao aplicar configuração existente.');
    } finally {
      setActivating(false);
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
    periodName,
    setPeriodName,
    configList,
    selectedConfigId,
    setSelectedConfigId,
    activeConfigId,
    activating,
    role,
    reprocessMsg,
    reprocessErr,
    reprocessing,
    handleSave,
    handleActivateExisting,
    handleReprocess,
  };
}
