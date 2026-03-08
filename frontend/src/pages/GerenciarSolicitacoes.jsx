import { useMemo, useState } from 'react';
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
  } = useGerenciarSolicitacoesData();

  const [activeSection, setActiveSection] = useState('pendentes');

  const historico = useMemo(
    () => solicitacoes.filter((s) => normalizeStatus(s.status) !== 'pendente'),
    [solicitacoes]
  );

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
      historico.map((s) => ({
        ...s,
        createdAtLabel: formatDateTime(s.createdAt),
        isAgendada: normalizeStatus(s.status) === 'agendada',
      })),
    [historico]
  );

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-3 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-md w-full p-4 sm:p-6 flex-none">
        <GerenciarSolicitacoesHeader
          pendentesLength={pendentes.length}
          agendadasLength={historico.length}
          totalLength={solicitacoes.length}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-md w-full flex-1 min-h-0 p-4 sm:p-6 flex flex-col overflow-hidden">
        <div className="flex-none pb-3">
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
        </div>

        <div className="flex-none mb-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('pendentes')}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold text-left transition ${
                activeSection === 'pendentes'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Solicitações pendentes
                <span className="text-xs rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">
                  {normalizedPendentes.length}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('historico')}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold text-left transition ${
                activeSection === 'historico'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Histórico
                <span className="text-xs rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800">
                  {normalizedAgendadas.length}
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-3">

          {activeSection === 'pendentes' ? (
            normalizedPendentes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma solicitação pendente encontrada.</p>
            ) : (
              <GerenciarSolicitacaoSection
                title="Solicitações pendentes"
                count={normalizedPendentes.length}
                countClass="text-xs bg-amber-100 text-amber-800"
                itemClassName="bg-amber-50/40"
                items={normalizedPendentes}
                sectionClass="mb-1"
                sectionListClassName="pb-1"
                hideHeader
                meetingsBySolicitacao={meetingsBySolicitacao}
                onOpenDiscente={(id) => id && navigate(`/discentes/${id}`)}
                onOpenMeeting={(meetingId) => navigate(`/meetings/${meetingId}`)}
                onOpenScheduling={(id) => `/agendar-atendimento/${id}`}
              />
            )
          ) : normalizedAgendadas.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma solicitação no histórico encontrada.</p>
          ) : (
            <GerenciarSolicitacaoSection
              title="Histórico"
              count={normalizedAgendadas.length}
              countClass="text-xs bg-emerald-100 text-emerald-800"
              itemClassName="bg-emerald-50/40"
              items={normalizedAgendadas}
              sectionClass="mb-1"
              sectionListClassName="pb-1"
              hideHeader
              meetingsBySolicitacao={meetingsBySolicitacao}
              onOpenDiscente={(id) => id && navigate(`/discentes/${id}`)}
              onOpenMeeting={(meetingId) => navigate(`/meetings/${meetingId}`)}
              onOpenScheduling={(id) => `/agendar-atendimento/${id}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
