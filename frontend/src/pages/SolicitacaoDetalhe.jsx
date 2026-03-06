import React from 'react';
import useSolicitacaoDetalheData from './SolicitacaoDetalhe/hooks/useSolicitacaoDetalheData';
import SolicitacaoDetalheHeader from './SolicitacaoDetalhe/components/SolicitacaoDetalheHeader';
import SolicitacaoDetalheInfo from './SolicitacaoDetalhe/components/SolicitacaoDetalheInfo';
import SolicitacaoDetalheActions from './SolicitacaoDetalhe/components/SolicitacaoDetalheActions';
import SolicitacaoDetalheMeeting from './SolicitacaoDetalhe/components/SolicitacaoDetalheMeeting';

export default function SolicitacaoDetalhe() {
  const {
    solicitacao,
    meeting,
    loading,
    error,
    statusBadge,
    title,
    navigateToAgenda,
    navigateToAgendar,
    navigateToDiscente,
    navigateToMeeting,
  } = useSolicitacaoDetalheData();

  if (loading) return <div className="p-4">Carregando solicitação...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!solicitacao) return <div className="p-4">Solicitação não encontrada.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <SolicitacaoDetalheHeader
        title={title}
        statusBadge={statusBadge}
        onBack={navigateToAgenda}
      />

      <SolicitacaoDetalheInfo solicitacao={solicitacao} />

      <SolicitacaoDetalheActions
        onSchedule={navigateToAgendar}
        onOpenDiscente={navigateToDiscente}
        discenteId={solicitacao.discenteId}
      />

      <SolicitacaoDetalheMeeting meeting={meeting} onOpenMeeting={navigateToMeeting} />
    </div>
  );
}
