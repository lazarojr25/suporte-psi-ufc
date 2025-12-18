import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import apiService from '../services/api';

export default function DiscenteDetalhe() {
  const { discenteId } = useParams();
  const navigate = useNavigate();
  const { role } = useOutletContext() || {};

  const [discente, setDiscente] = useState(null);
  const [solicitacoes, setSolicitacoes] = useState([]);

  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [semesterConfig, setSemesterConfig] = useState(null);

  const [transcricoes, setTranscricoes] = useState([]);
  const [relatorioDiscente, setRelatorioDiscente] = useState(null);

  const [error, setError] = useState(null);
  const [reprocessMsg, setReprocessMsg] = useState(null);
  const [reprocessErr, setReprocessErr] = useState(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

  // ⭐ Meetings do sistema (vamos filtrar por discente depois)
  const [allMeetings, setAllMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [meetingsLoaded, setMeetingsLoaded] = useState(false);
  const meetingsCacheRef = useRef(null);

  useEffect(() => {
    const loadMeetings = async () => {
      if (meetingsCacheRef.current) {
        setAllMeetings(meetingsCacheRef.current);
        setMeetingsLoaded(true);
        return;
      }
      try {
        setLoadingMeetings(true);
        const resp = await apiService.getMeetings(); // GET /api/meetings
        if (resp?.success && resp.data?.meetings) {
          meetingsCacheRef.current = resp.data.meetings;
          setAllMeetings(resp.data.meetings);
        }
        setMeetingsLoaded(true);
      } catch (mErr) {
        console.warn('Falha ao carregar meetings:', mErr);
      } finally {
        setLoadingMeetings(false);
      }
    };

    const loadData = async () => {
      try {
        setError(null);

        // 1) Dados do discente
        const discenteRef = doc(db, 'discentes', discenteId);
        const discenteSnap = await getDoc(discenteRef);
        if (!discenteSnap.exists()) {
          setError('Discente não encontrado');
          return;
        }
        const discenteData = { id: discenteSnap.id, ...discenteSnap.data() };
        setDiscente(discenteData);

        // 2) Solicitações vinculadas
        const q = query(
          collection(db, 'solicitacoesAtendimento'),
          where('discenteId', '==', discenteId)
        );
        const solicitacoesSnap = await getDocs(q);
        const lista = solicitacoesSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate() // vira um Date de verdade
              : data.createdAt || null,
          };
        });
        setSolicitacoes(lista);

        // 3) Relatório + transcrições desse discente
        const rel = await apiService.getReportsByDiscente(discenteId);
        if (rel?.success && rel.data) {
          setRelatorioDiscente(rel.data);
          setTranscricoes(rel.data.transcriptions || []);
        } else if (rel?.data?.transcriptions) {
          setTranscricoes(rel.data.transcriptions);
        }

        // 4) Configuração do semestre (Firestore)
        try {
          const cfgRef = doc(db, 'semestreLetivo', 'semestreLetivoConfig');
          const cfgSnap = await getDoc(cfgRef);
          if (cfgSnap.exists()) {
            setSemesterConfig(cfgSnap.data());
          }
        } catch (cfgErr) {
          console.warn('Falha ao carregar semestreLetivoConfig:', cfgErr);
        }

        // 5) Limite de sessões no período para este discente (backend)
        try {
          const check = await apiService.canScheduleForDiscente(discenteData.id);
          if (check?.success && check.data) {
            setScheduleInfo(check.data);
          }
        } catch (e) {
          console.warn('Falha ao consultar limite de sessões:', e);
        }

        // 6) Meetings (todas; filtramos no front por discenteId)
        await loadMeetings();
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar dados do discente.');
      }
    };

    loadData();
  }, [discenteId]);
  if (error && !discente) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (!discente) {
    return <div className="p-4">Carregando...</div>;
  }

  const historyPatterns = relatorioDiscente?.historyPatterns;
  const orderedTranscricoes = [...transcricoes].sort((a, b) => {
    const dateA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
  const lastTranscription = orderedTranscricoes[0] || null;
  const aggregatedInsights = orderedTranscricoes
    .flatMap((t) =>
      (t.analysis?.actionableInsights || []).map((insight) => ({
        insight,
        fileName: t.fileName,
        createdAt: t.createdAt,
      }))
    )
    .slice(0, 6);
  const insightsHighlight = aggregatedInsights.slice(0, 2);
  const sentimentTimeline = orderedTranscricoes
    .filter((t) => t.analysis?.sentiments)
    .map((t) => ({
      dateLabel: t.createdAt
        ? new Date(t.createdAt).toLocaleDateString('pt-BR')
        : '---',
      sentiments: t.analysis.sentiments,
    }));

  const negativeTrendAlert = (() => {
    if (sentimentTimeline.length < 2) return null;
    const last = sentimentTimeline[0].sentiments;
    const prevAvg = sentimentTimeline
      .slice(1, 4)
      .reduce(
        (acc, s, idx, arr) => {
          acc.positive += s.sentiments.positive || 0;
          acc.negative += s.sentiments.negative || 0;
          return idx === arr.length - 1 ? acc : acc;
        },
        { positive: 0, negative: 0 }
      );
    const prevCount = Math.min(3, sentimentTimeline.length - 1);
    if (prevCount > 0) {
      prevAvg.positive /= prevCount;
      prevAvg.negative /= prevCount;
    }
    const negDiff = (last.negative || 0) - (prevAvg.negative || 0);
    const posDiff = (last.positive || 0) - (prevAvg.positive || 0);
    if (negDiff >= 0.15 || posDiff <= -0.15) {
      return 'Tendência de piora nos sentimentos recentes.';
    }
    return null;
  })();

  const dedupInsights = (() => {
    const map = new Map();
    orderedTranscricoes.forEach((t) => {
      (t.analysis?.actionableInsights || []).forEach((insight) => {
        if (!insight) return;
        map.set(insight, (map.get(insight) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([text, count]) => ({ text, count }));
  })();

  const handleReprocessDiscente = async () => {
    setReprocessing(true);
    setReprocessErr(null);
    setReprocessMsg(null);
    try {
      const res = await apiService.reprocessAllTranscriptions(discente.id, { force: true });
      if (res?.success) {
        setReprocessMsg(`Reprocessadas ${res.total} transcrições deste discente.`);
        const rel = await apiService.getReportsByDiscente(discenteId);
        if (rel?.success && rel.data) {
          setRelatorioDiscente(rel.data);
          setTranscricoes(rel.data.transcriptions || []);
        }
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

  const handleAgendarNovaSessao = async () => {
    if (!discente) return;
    try {
      setCreatingSession(true);
      setError(null);
      const payload = {
        discenteId: discente.id,
        motivation: 'Sessão adicional iniciada pela equipe',
        status: 'pendente',
        createdAt: serverTimestamp(),
        name: discente.name || '',
        email: discente.email || '',
        studentId: discente.studentId || '',
        curso: discente.curso || '',
      };
      const docRef = await addDoc(collection(db, 'solicitacoesAtendimento'), payload);
      navigate(`/agendar-atendimento/${docRef.id}`);
    } catch (err) {
      console.error(err);
      setError('Não foi possível criar nova solicitação para agendamento.');
    } finally {
      setCreatingSession(false);
    }
  };
  const historyListSections = [
    { key: 'recurringThemes', label: 'Temas recorrentes' },
    { key: 'repeatedIdeas', label: 'Ideias repetidas' },
    { key: 'emotionalPatterns', label: 'Padrões emocionais' },
    { key: 'commonTriggers', label: 'Gatilhos comuns' },
  ];

  const periodStartValue =
    scheduleInfo?.periodStart ?? semesterConfig?.periodStart ?? null;
  const periodEndValue =
    scheduleInfo?.periodEnd ?? semesterConfig?.periodEnd ?? null;

  // ----- Histórico de sessões (meetings) -----

  const now = new Date();

  const getMeetingDate = (m) => {
    if (m.dateTime) return new Date(m.dateTime);
    if (m.scheduledDate && m.scheduledTime) {
      return new Date(`${m.scheduledDate}T${m.scheduledTime}:00`);
    }
    if (m.scheduledDate) return new Date(`${m.scheduledDate}T00:00:00`);
    if (m.createdAt) return new Date(m.createdAt);
    return null;
  };

  const meetingsDiscente = allMeetings
    .filter((m) => {
      const matchById = m.discenteId && discente.id && m.discenteId === discente.id;
      const matchByEmail =
        !m.discenteId &&
        discente.email &&
        m.studentEmail &&
        m.studentEmail.toLowerCase() === discente.email.toLowerCase();
      const matchByName =
        !m.discenteId &&
        discente.name &&
        m.studentName &&
        m.studentName.toLowerCase() === discente.name.toLowerCase();
      return matchById || matchByEmail || matchByName;
    })
    .map((m) => {
      const d = getMeetingDate(m);
      const isPast = d ? d < now : false;
      const normalizedStatus = (m.status || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return { ...m, _dateObj: d, _isPast: isPast, _statusNormalized: normalizedStatus };
    })
    .sort((a, b) => {
      if (!a._dateObj || !b._dateObj) return 0;
      return b._dateObj - a._dateObj; // mais recente primeiro
    });

  console.log('meetingsDiscente ',JSON.stringify(meetingsDiscente));

  const upcomingMeeting = meetingsDiscente
    .filter((m) => m._dateObj && m._dateObj >= now)
    .sort((a, b) => a._dateObj - b._dateObj)[0] || null;

  const lastCompletedMeeting =
    meetingsDiscente
      .filter((m) => m._dateObj && m._statusNormalized === 'concluida')
      .sort((a, b) => b._dateObj - a._dateObj)[0] || null;

  const formatMeetingLabel = (meeting) => {
    if (!meeting) return 'Nenhuma sessão registrada';
    if (meeting._dateObj) {
      return meeting._dateObj.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: meeting.scheduledTime ? 'short' : undefined,
      });
    }
    if (meeting.scheduledDate) {
      return meeting.scheduledTime
        ? `${meeting.scheduledDate} ${meeting.scheduledTime}`
        : meeting.scheduledDate;
    }
    return '---';
  };

  const parsePeriodBoundary = (value, isEnd = false) => {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      // usa horário local para alinhar com getMeetingDate (também local)
      const hour = isEnd ? '23:59:59.999' : '00:00:00.000';
      const date = new Date(`${value}T${hour}`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const periodStartDate = parsePeriodBoundary(periodStartValue, false);
  const periodEndDate = parsePeriodBoundary(periodEndValue, true);

  const concludedMeetings = meetingsDiscente.filter(
    (meeting) => meeting._dateObj && meeting._statusNormalized === 'concluida'
  );

  const meetingsWithinPeriod = concludedMeetings.filter((meeting) => {
    const meetingTime = meeting._dateObj.getTime();
    if (periodStartDate && meetingTime < periodStartDate.getTime()) return false;
    if (periodEndDate && meetingTime > periodEndDate.getTime()) return false;
    return true;
  });

  const fallbackUsedSessions =
    scheduleInfo?.used ??
    relatorioDiscente?.totalTranscriptions ??
    0;

  // usa meetings somente depois do primeiro carregamento completo
  const usedSessions =
    meetingsLoaded && !loadingMeetings
      ? (meetingsWithinPeriod.length || concludedMeetings.length || fallbackUsedSessions)
      : fallbackUsedSessions;

  console.log('meetingsLoaded ',meetingsLoaded);
  console.log('loadingMeetings ',loadingMeetings);
  console.log('meetingsWithinPeriod ',meetingsWithinPeriod);
  console.log('usedSessions ',usedSessions);

  const configuredLimit =
    scheduleInfo?.limit ??
    semesterConfig?.maxSessionsPerDiscente ??
    0;

  const remainingSessions =
    configuredLimit > 0 ? Math.max(0, configuredLimit - usedSessions) : null;

  const periodStart = periodStartValue;
  const periodEnd = periodEndValue;

  const isBlockedByLimit =
    configuredLimit > 0 && remainingSessions !== null && remainingSessions <= 0;

  const renderMeetingStatusBadge = (m) => {
    let label = '';
    let className = '';

    if (m.status === 'cancelada') {
      label = 'Cancelada';
      className = 'bg-red-100 text-red-800 border border-red-200';
    } else if (m._statusNormalized === 'concluida') {
      label = 'Concluída';
      className = 'bg-green-100 text-green-800 border border-green-200';
    } else if (m._statusNormalized === 'agendada') {
      if (m._isPast) {
        label = 'Agendada (data já passou)';
        className = 'bg-amber-100 text-amber-800 border border-amber-200';
      } else {
        label = 'Agendada';
        className = 'bg-blue-100 text-blue-800 border border-blue-200';
      }
    } else {
      label = m.status || 'Desconhecido';
      className = 'bg-gray-100 text-gray-800 border border-gray-200';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {label}
      </span>
    );
  };

  const renderSolicitacaoStatusBadge = (status) => {
    let label = '';
    let className = '';

    switch (status) {
      case 'nova':
      case 'pendente':
        label = 'Pendente';
        className = 'bg-yellow-50 text-yellow-800 border border-yellow-200';
        break;
      case 'em_atendimento':
        label = 'Em atendimento';
        className = 'bg-blue-50 text-blue-800 border border-blue-200';
        break;
      case 'concluida':
        label = 'Concluída';
        className = 'bg-green-50 text-green-800 border border-green-200';
        break;
      case 'cancelada':
        label = 'Cancelada';
        className = 'bg-red-50 text-red-800 border-red-200';
        break;
      default:
        label = status || 'Pendente';
        className = 'bg-gray-50 text-gray-800 border-gray-200';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {label}
      </span>
    );
  };

  // Solicitações + meeting vinculada
  const solicitacoesEnriquecidas = solicitacoes
    .map((s) => {
      const relatedMeeting =
        meetingsDiscente.find((m) => m.solicitacaoId === s.id) || null;
      return { ...s, relatedMeeting };
    })
    .sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : null;
      const db = b.createdAt ? new Date(b.createdAt) : null;
      if (!da || !db) return 0;
      return db - da; // mais recente primeiro
    });

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">

      {/* Dados do discente */}
      <div className="bg-white rounded-xl shadow p-5 space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Discente
            </p>
            <h1 className="text-3xl font-bold text-gray-900">{discente.name}</h1>
            <p className="text-sm text-gray-500">
              Matrícula: <span className="font-semibold text-gray-700">{discente.studentId || '---'}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm w-full md:w-auto">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs uppercase text-gray-500">Transcrições</p>
              <p className="text-2xl font-semibold text-gray-900">
                {relatorioDiscente?.totalTranscriptions ?? orderedTranscricoes.length}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs uppercase text-gray-500">Solicitações</p>
              <p className="text-2xl font-semibold text-gray-900">
                {solicitacoes.length}
              </p>
            </div>
            <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
              <button
                type="button"
                onClick={handleAgendarNovaSessao}
                disabled={creatingSession || isBlockedByLimit}
                className="px-3 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {creatingSession ? 'Criando...' : 'Agendar nova sessão'}
              </button>
              <button
                type="button"
                onClick={handleReprocessDiscente}
                disabled={reprocessing}
                className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {reprocessing ? 'Reprocessando...' : 'Reprocessar transcrições'}
              </button>
              {(reprocessMsg || reprocessErr) && (
                <span className="text-[11px] text-gray-600">
                  {reprocessMsg && <span className="text-green-600">{reprocessMsg}</span>}
                  {reprocessErr && <span className="text-red-600">{reprocessErr}</span>}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <dt className="text-xs uppercase text-gray-500">Curso</dt>
            <dd className="text-gray-900">{discente.curso || '---'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">E-mail</dt>
            <dd>
              {discente.email ? (
                <a
                  href={`mailto:${discente.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {discente.email}
                </a>
              ) : (
                '---'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">ID no sistema</dt>
            <dd className="text-gray-900 break-all">{discente.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">Última atualização</dt>
            <dd className="text-gray-900">
              {lastTranscription?.createdAt
                ? new Date(lastTranscription.createdAt).toLocaleString('pt-BR')
                : 'Sem transcrições registradas'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Panorama rápido */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div
          className={`rounded-xl border shadow-sm p-4 ${
            isBlockedByLimit
              ? 'bg-red-50 border-red-100'
              : 'bg-blue-50 border-blue-100'
          }`}
        >
          <p className="text-xs uppercase text-gray-600 tracking-wide">
            Controle de sessões
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {usedSessions}
            {configuredLimit > 0 && (
              <span className="text-lg text-gray-600"> / {configuredLimit}</span>
            )}
          </p>
          <p className="text-sm text-gray-700">
            {configuredLimit > 0
              ? `Restantes: ${remainingSessions}`
              : 'Sem limite configurado'}
          </p>
          {isBlockedByLimit && (
            <p className="text-xs text-red-700 mt-1">
              Este discente atingiu o limite definido para o período.
            </p>
          )}
          {(periodStart || periodEnd) && (
            <div className="mt-3 pt-2 border-t border-white/60 text-xs text-gray-700">
              Período considerado: {periodStart || '---'} a {periodEnd || '---'}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-4 space-y-4">
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">
              Próxima sessão agendada
            </p>
            <p className="text-base font-semibold text-gray-900">
              {upcomingMeeting ? formatMeetingLabel(upcomingMeeting) : 'Nenhuma sessão registrada'}
            </p>
            <p className="text-xs text-gray-500">
              {upcomingMeeting ? `Status: ${upcomingMeeting.status}` : 'Atualize a agenda quando houver uma nova data.'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">
              Última sessão concluída
            </p>
            <p className="text-base font-semibold text-gray-900">
              {lastCompletedMeeting ? formatMeetingLabel(lastCompletedMeeting) : 'Ainda não realizada'}
            </p>
            {lastCompletedMeeting && (
              <p className="text-xs text-gray-500">Status: {lastCompletedMeeting.status}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">
              Última transcrição
            </p>
            <p className="text-base font-semibold text-gray-900">
              {lastTranscription?.createdAt
                ? new Date(lastTranscription.createdAt).toLocaleString('pt-BR')
                : 'Sem registros'}
            </p>
            {lastTranscription && (
              <p className="text-xs text-gray-500">{lastTranscription.fileName}</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <p className="text-xs uppercase text-gray-500 tracking-wide">
            Insights em foco
          </p>
          {negativeTrendAlert && (
            <p className="text-xs text-red-600">
              {negativeTrendAlert}
            </p>
          )}
          {insightsHighlight.length > 0 ? (
            <ul className="space-y-2">
              {insightsHighlight.map((item, idx) => (
                <li
                  key={`${item.fileName}-${idx}`}
                  className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2"
                >
                  {item.insight}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              Sem recomendações recentes. As próximas transcrições alimentarão este painel automaticamente.
            </p>
          )}
          {historyPatterns?.recurringThemes?.length > 0 && (
            <p className="text-xs text-gray-500">
              Temas recorrentes:&nbsp;
              <span className="text-gray-800">
                {historyPatterns.recurringThemes.join(', ')}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Histórico de sessões (meetings) */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Histórico de sessões</h2>

        {loadingMeetings ? (
          <p className="text-sm text-gray-500">Carregando sessões...</p>
        ) : meetingsDiscente.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma sessão registrada para este discente.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {meetingsDiscente.map((m) => (
              <li
                key={m.id}
                className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <p className="font-medium text-gray-800">
                    {m.scheduledDate}{' '}
                    {m.scheduledTime && (
                      <span>às {m.scheduledTime}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Criada em:{' '}
                    {m.createdAt
                      ? new Date(m.createdAt).toLocaleString('pt-BR')
                      : '---'}
                  </p>
                  {m.notes && (
                    <p className="text-xs text-gray-700 mt-1">
                      <strong>Observações:</strong> {m.notes}
                    </p>
                  )}
                  {m.clinicalRecord &&
                    (m.clinicalRecord.summary ||
                      m.clinicalRecord.observations ||
                      m.clinicalRecord.plan) && (
                      <div className="text-xs text-gray-700 mt-1 space-y-0.5">
                        <p className="font-semibold text-gray-800">
                          Registro clínico
                        </p>
                        {m.clinicalRecord.summary && (
                          <p>• Síntese: {m.clinicalRecord.summary}</p>
                        )}
                        {m.clinicalRecord.observations && (
                          <p>• Condutas: {m.clinicalRecord.observations}</p>
                        )}
                        {m.clinicalRecord.plan && (
                          <p>• Próximos passos: {m.clinicalRecord.plan}</p>
                        )}
                      </div>
                    )}
                  {m.informalNotes && (
                    <p className="text-xs text-gray-700 mt-1">
                      <strong>Prontuário informal:</strong> {m.informalNotes}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-start sm:items-end gap-1">
                  {renderMeetingStatusBadge(m)}
                  {m._dateObj && (
                    <p className="text-[11px] text-gray-500">
                      {m._isPast
                        ? 'Sessão em data já passada'
                        : 'Sessão futura'}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/meetings/${m.id}`)}
                    className="inline-flex items-center px-2 py-1 rounded-md border text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Ver sessão
                  </button>
                  {m._statusNormalized !== 'concluida' && (
                    <button
                      type="button"
                      onClick={async () => {
                        setLoadingMeetings(true);
                        try {
                          await apiService.updateMeeting(m.id, { status: 'concluida' });
                          const resp = await apiService.getMeetings();
                          if (resp?.success && resp.data?.meetings) {
                            meetingsCacheRef.current = resp.data.meetings;
                            setAllMeetings(resp.data.meetings);
                            try {
                              const check = await apiService.canScheduleForDiscente(discente.id);
                              if (check?.success && check.data) {
                                setScheduleInfo(check.data);
                              }
                            } catch (e) {
                              console.warn('Falha ao atualizar limite de sessões:', e);
                            }
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Não foi possível concluir a sessão.');
                        } finally {
                          setLoadingMeetings(false);
                        }
                      }}
                      className="mt-1 inline-flex items-center px-2 py-1 rounded-md bg-green-600 text-white text-[11px] font-semibold hover:bg-green-700"
                    >
                      Marcar como concluída
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Solicitações */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Solicitações desse discente</h2>

        {solicitacoesEnriquecidas.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma solicitação encontrada.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {solicitacoesEnriquecidas.map((s) => {
              const m = s.relatedMeeting;
              const hasMeeting = !!m;

              // cálculo se a sessão é passada/hoje/futura
              let temporalLabel = null;
              let temporalClasses = '';
              if (hasMeeting) {
                const dateTimeStr =
                  m.dateTime ||
                  (m.scheduledDate
                    ? `${m.scheduledDate}T${(m.scheduledTime || '00:00')}:00`
                    : null);

                const dt = dateTimeStr ? new Date(dateTimeStr) : null;

                if (dt && !isNaN(dt.getTime())) {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const meetingDateStr = dt.toISOString().slice(0, 10);

                  if (meetingDateStr < todayStr) {
                    temporalLabel = 'Sessão já realizada';
                    temporalClasses =
                      'bg-gray-100 text-gray-700 border border-gray-200';
                  } else if (meetingDateStr === todayStr) {
                    temporalLabel = 'Sessão hoje';
                    temporalClasses =
                      'bg-yellow-50 text-yellow-800 border border-yellow-200';
                  } else {
                    temporalLabel = 'Sessão futura';
                    temporalClasses =
                      'bg-emerald-50 text-emerald-800 border border-emerald-200';
                  }
                }
              }

              return (
                <li
                  key={s.id}
                  className="border rounded-lg p-3 flex flex-col gap-2 bg-gray-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-800">
                        Motivo: {s.motivation}
                      </p>
                      <p className="text-xs text-gray-500">
                        Criada em:{' '}
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleString('pt-BR')
                          : '---'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderSolicitacaoStatusBadge(s.status)}
                    </div>
                  </div>

                  <div className="mt-1 border-t pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-xs text-gray-700">
                      {hasMeeting ? (
                        <>
                          <p className="font-semibold mb-0.5">
                            Sessão vinculada:
                          </p>
                          <p>
                            {m.scheduledDate}{' '}
                            {m.scheduledTime && `às ${m.scheduledTime}`}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {renderMeetingStatusBadge(m)}

                            {temporalLabel && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${temporalClasses}`}
                              >
                                {temporalLabel}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-600">
                          Nenhuma sessão agendada para esta solicitação.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => navigate(`/solicitacoes/${s.id}`)}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Ver solicitação
                      </button>
                      {!hasMeeting && !isBlockedByLimit && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/agendar-atendimento/${s.id}`)
                          }
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                        >
                          Agendar sessão
                        </button>
                      )}

                      {hasMeeting && (
                        <span className="text-[11px] text-gray-500">
                          ID reunião: {m.id}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Relatório e transcrições do discente */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Transcrições e análise desse discente</h2>

        {!relatorioDiscente && orderedTranscricoes.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Nenhuma transcrição vinculada a este discente.
          </p>
        ) : (
          <>
            {/* Mini cards de resumo */}
            {relatorioDiscente && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Total de transcrições</p>
                  <p className="text-xl font-semibold">
                    {relatorioDiscente.totalTranscriptions}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Tamanho total (KB)</p>
                  <p className="text-xl font-semibold">
                    {Math.round((relatorioDiscente.totalSizeBytes || 0) / 1024)}
                  </p>
                </div>
                {relatorioDiscente.sentimentsAvg && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500">Sentimento médio</p>
                    <p className="text-xs text-gray-700">
                      Positivo:{' '}
                      {(relatorioDiscente.sentimentsAvg.positive * 100).toFixed(1)}%
                      <br />
                      Neutro:{' '}
                      {(relatorioDiscente.sentimentsAvg.neutral * 100).toFixed(1)}%
                      <br />
                      Negativo:{' '}
                      {(relatorioDiscente.sentimentsAvg.negative * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {Boolean(aggregatedInsights.length) && (
              <div className="mb-4 border rounded-lg p-4 bg-white text-sm shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">
                    Insights acionáveis recomendados
                  </h3>
                  <span className="text-xs text-gray-500">
                    {aggregatedInsights.length} sugest{aggregatedInsights.length > 1 ? 'ões' : 'ão'} recentes
                  </span>
                </div>
                <ul className="space-y-2">
                  {aggregatedInsights.map((item, index) => (
                    <li
                      key={`${item.fileName}-${index}`}
                      className="border rounded-lg p-3 bg-gray-50"
                    >
                      <p className="text-gray-800">{item.insight}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Extraído de{' '}
                        <span className="font-semibold">{item.fileName}</span>{' '}
                        {item.createdAt &&
                          `(${new Date(item.createdAt).toLocaleDateString('pt-BR')})`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Padrões históricos (IA) */}
            {historyPatterns && (
              <div className="mb-4 border rounded-lg p-4 bg-gray-50 text-sm">
                <h3 className="font-semibold mb-3 text-gray-800">
                  Padrões percebidos ao longo das sessões
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {historyListSections.map((section) => {
                    const entries = historyPatterns?.[section.key];
                    if (!Array.isArray(entries) || entries.length === 0) {
                      return null;
                    }
                    return (
                      <div key={section.key} className="bg-white rounded-lg p-3 shadow-inner">
                        <p className="text-xs uppercase text-gray-500 font-semibold mb-1">
                          {section.label}
                        </p>
                        <p className="text-gray-700">{entries.join(', ')}</p>
                      </div>
                    );
                  })}
                </div>
            {!historyListSections.some(
              (section) =>
                Array.isArray(historyPatterns?.[section.key]) &&
                historyPatterns[section.key].length > 0
            ) && (
              <p className="text-gray-500">Nenhum padrão identificado até o momento.</p>
            )}
          </div>
        )}

        {sentimentTimeline.length > 0 && (
          <div className="mb-4 border rounded-lg p-4 bg-white text-sm">
            <h3 className="font-semibold mb-2 text-gray-800">Linha do tempo de sentimentos</h3>
            <ul className="space-y-1">
              {sentimentTimeline.map((item, idx) => (
                <li key={`${item.dateLabel}-${idx}`} className="flex flex-wrap justify-between">
                  <span className="text-gray-700">{item.dateLabel}</span>
                  <span className="text-[11px] text-gray-600">
                    +{((item.sentiments.positive || 0) * 100).toFixed(0)}% /
                    ~{((item.sentiments.neutral || 0) * 100).toFixed(0)}% /
                    -{((item.sentiments.negative || 0) * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {dedupInsights.length > 0 && (
          <div className="mb-4 border rounded-lg p-4 bg-white text-sm">
            <h3 className="font-semibold mb-2 text-gray-800">Insights recorrentes</h3>
            <ul className="space-y-1">
              {dedupInsights.map((item) => (
                <li key={item.text} className="flex justify-between gap-2">
                  <span className="text-gray-700">{item.text}</span>
                  <span className="text-[11px] text-gray-500">{item.count}x</span>
                </li>
              ))}
            </ul>
          </div>
        )}

            {/* Lista de transcrições */}
            <ul className="space-y-2 text-sm">
              {orderedTranscricoes.map((t) => (
                <li key={t.fileName} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{t.fileName}</p>
                      <p className="text-xs text-gray-500">
                        Registrada em{' '}
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleString('pt-BR')
                          : '---'}
                      </p>
                    </div>
                    {t.analysis?.sentiments && (
                      <div className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        Sentimento:{' '}
                        <span className="text-green-600">
                          {(t.analysis.sentiments.positive * 100).toFixed(0)}%+
                        </span>{' '}
                        /{' '}
                        <span className="text-yellow-600">
                          {(t.analysis.sentiments.neutral * 100).toFixed(0)}%º
                        </span>{' '}
                        /{' '}
                        <span className="text-red-500">
                          {(t.analysis.sentiments.negative * 100).toFixed(0)}%-
                        </span>
                      </div>
                    )}
                  </div>
                  {t.analysis?.summary && (
                    <p className="mt-2 text-gray-700 text-sm leading-relaxed">
                      {t.analysis.summary}
                    </p>
                  )}
                  {!t.analysis && (
                    <p className="mt-2 text-xs text-amber-600">
                      Análise pendente ou indisponível para esta transcrição.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {Array.isArray(t.analysis?.keywords) &&
                      t.analysis.keywords.map((kw) => (
                        <span
                          key={`${t.fileName}-kw-${kw}`}
                          className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full"
                        >
                          {kw}
                        </span>
                      ))}
                    {Array.isArray(t.analysis?.topics) &&
                      t.analysis.topics.map((topic) => (
                        <span
                          key={`${t.fileName}-topic-${topic}`}
                          className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full"
                        >
                          {topic}
                        </span>
                      ))}
                  </div>
                  {Array.isArray(t.analysis?.actionableInsights) &&
                    t.analysis.actionableInsights.length > 0 && (
                      <div className="mt-3 bg-gray-50 border rounded-lg p-2">
                        <p className="text-xs font-semibold text-gray-700 mb-1">
                          Sugestões desta sessão
                        </p>
                        <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                          {t.analysis.actionableInsights.map((insight, idx) => (
                            <li key={`${t.fileName}-insight-${idx}`}>{insight}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

    </div>
  );
}
