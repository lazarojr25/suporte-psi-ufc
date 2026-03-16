import React from 'react';
import useConfiguracoesData from './Configuracoes/hooks/useConfiguracoesData';
import ConfiguracoesHeader from './Configuracoes/components/ConfiguracoesHeader';
import AttendanceConfigForm from './Configuracoes/components/AttendanceConfigForm';
import TranscricaoReprocessSection from './Configuracoes/components/TranscricaoReprocessSection';

export default function Configuracoes() {
  const {
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
    activeConfigId,
    activating,
    loading,
    saving,
    error,
    success,
    role,
    handleActivateExisting,
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
        activeConfigId={activeConfigId}
        loading={loading}
        saving={saving}
        error={error}
        success={success}
        periodName={periodName}
        setPeriodName={setPeriodName}
        periodStart={periodStart}
        setPeriodStart={setPeriodStart}
        periodEnd={periodEnd}
        setPeriodEnd={setPeriodEnd}
        maxSessions={maxSessions}
        setMaxSessions={setMaxSessions}
        configList={configList}
        selectedConfigId={selectedConfigId}
        setSelectedConfigId={setSelectedConfigId}
        activating={activating}
        onActivateExisting={handleActivateExisting}
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
