import React from 'react';
import useConfiguracoesData from './Configuracoes/hooks/useConfiguracoesData';
import ConfiguracoesHeader from './Configuracoes/components/ConfiguracoesHeader';
import AttendanceConfigForm from './Configuracoes/components/AttendanceConfigForm';
import TranscricaoReprocessSection from './Configuracoes/components/TranscricaoReprocessSection';

export default function Configuracoes() {
  const {
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
  } = useConfiguracoesData();

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <ConfiguracoesHeader />

      <AttendanceConfigForm
        loading={loading}
        saving={saving}
        error={error}
        success={success}
        periodStart={periodStart}
        setPeriodStart={setPeriodStart}
        periodEnd={periodEnd}
        setPeriodEnd={setPeriodEnd}
        maxSessions={maxSessions}
        setMaxSessions={setMaxSessions}
        onSubmit={handleSave}
      />

      {role === 'admin' && (
        <TranscricaoReprocessSection
          reprocessMsg={reprocessMsg}
          reprocessErr={reprocessErr}
          reprocessing={reprocessing}
          onReprocess={handleReprocess}
        />
      )}
    </div>
  );
}
