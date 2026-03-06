import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import useGerenciarSolicitacoesData from './GerenciarSolicitacoes/hooks/useGerenciarSolicitacoesData';
import {
  formatDateTime,
  normalizeStatus,
} from './GerenciarSolicitacoes/utils/gerenciarSolicitacoesUtils';
import GerenciarSolicitacoesHeader from './GerenciarSolicitacoes/components/GerenciarSolicitacoesHeader';
import GerenciarSolicitacoesFilters from './GerenciarSolicitacoes/components/GerenciarSolicitacoesFilters';
import GerenciarSolicitacaoSection from './GerenciarSolicitacoes/components/GerenciarSolicitacaoSection';

export default function GerenciarSolicitacoes() {
  const navigate = useNavigate();

  const {
    solicitacoes,
    meetingsBySolicitacao,
    loading,
    error,
    searchName,
    setSearchName,
    searchMatricula,
    setSearchMatricula,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    curso,
    setCurso,
    cursoOptions,
    pendentes,
    agendadas,
  } = useGerenciarSolicitacoesData();

  const normalizedPendentes = useMemo(
    () =>
      pendentes.map((s) => ({
        ...s,
        createdAtLabel: formatDateTime(s.createdAt),
        isAgendada: normalizeStatus(s.status) === 'agendada',
      })),
    [pendentes]
  );

  const normalizedAgendadas = useMemo(
    () =>
      agendadas.map((s) => ({
        ...s,
        createdAtLabel: formatDateTime(s.createdAt),
        isAgendada: normalizeStatus(s.status) === 'agendada',
      })),
    [agendadas]
  );

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-6xl mx-auto p-6">
        <GerenciarSolicitacoesHeader
          pendentesLength={pendentes.length}
          agendadasLength={agendadas.length}
          totalLength={solicitacoes.length}
        />

        <GerenciarSolicitacoesFilters
          searchName={searchName}
          setSearchName={setSearchName}
          searchMatricula={searchMatricula}
          setSearchMatricula={setSearchMatricula}
          curso={curso}
          setCurso={setCurso}
          cursoOptions={cursoOptions}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />

        {loading && <p className="text-sm text-gray-500">Carregando solicitações...</p>}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {!loading && !error && solicitacoes.length === 0 && (
          <p className="text-sm text-gray-500">
            Nenhuma solicitação encontrada com os filtros atuais.
          </p>
        )}

        <GerenciarSolicitacaoSection
          title="Solicitações pendentes"
          count={normalizedPendentes.length}
          countClass="text-xs bg-amber-100 text-amber-800"
          itemClassName="bg-amber-50/40"
          items={normalizedPendentes}
          sectionClass="mt-4"
          meetingsBySolicitacao={meetingsBySolicitacao}
          onOpenDiscente={(id) => id && navigate(`/discentes/${id}`)}
          onOpenMeeting={(meetingId) => navigate(`/meetings/${meetingId}`)}
          onOpenScheduling={(id) => `/agendar-atendimento/${id}`}
        />

        <GerenciarSolicitacaoSection
          title="Solicitações com sessão agendada"
          count={normalizedAgendadas.length}
          countClass="text-xs bg-emerald-100 text-emerald-800"
          itemClassName="bg-emerald-50/40"
          items={normalizedAgendadas}
          sectionClass="mt-8"
          meetingsBySolicitacao={meetingsBySolicitacao}
          onOpenDiscente={(id) => id && navigate(`/discentes/${id}`)}
          onOpenMeeting={(meetingId) => navigate(`/meetings/${meetingId}`)}
          onOpenScheduling={(id) => `/agendar-atendimento/${id}`}
        />
      </div>
    </div>
  );
}
