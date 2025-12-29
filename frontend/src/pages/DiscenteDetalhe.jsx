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
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [selectedTranscription, setSelectedTranscription] = useState(null);
  const [downloadingDiscenteReport, setDownloadingDiscenteReport] = useState(false);
  const [downloadingDiscenteReportPdf, setDownloadingDiscenteReportPdf] = useState(false);

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
  const hasTranscricoes = orderedTranscricoes.length > 0;
  const lastTranscription = orderedTranscricoes[0] || null;
  const sentimentTimeline = orderedTranscricoes
    .filter((t) => t.analysis?.sentiments)
    .map((t) => ({
      dateLabel: t.createdAt
        ? new Date(t.createdAt).toLocaleDateString('pt-BR')
        : '---',
      sentiments: t.analysis.sentiments,
    }));

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

  const handleDownloadDiscenteReport = async () => {
    if (!discente) return;
    try {
      setDownloadingDiscenteReport(true);
      const { blob, fileName } = await apiService.exportReportByDiscente(discente.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `relatorio-discente-${discente.id}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      if (err?.message?.includes('401')) {
        alert('Sessão expirada ou sem permissão. Faça login novamente.');
      } else {
        alert('Não foi possível gerar o relatório do discente.');
      }
    } finally {
      setDownloadingDiscenteReport(false);
    }
  };

  const handleDownloadDiscenteReportPdf = async () => {
    if (!discente) return;
    try {
      setDownloadingDiscenteReportPdf(true);
      const { blob, fileName } = await apiService.exportReportByDiscentePdf(discente.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `relatorio-discente-${discente.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      if (err?.message?.includes('401')) {
        alert('Sessão expirada ou sem permissão. Faça login novamente.');
      } else {
        alert('Não foi possível gerar o relatório do discente em PDF.');
      }
    } finally {
      setDownloadingDiscenteReportPdf(false);
    }
  };
  const historyListSections = [
    { key: 'recurringThemes', label: 'Temas recorrentes' },
    { key: 'repeatedIdeas', label: 'Ideias repetidas' },
    { key: 'emotionalPatterns', label: 'Padrões emocionais' },
    { key: 'commonTriggers', label: 'Sugestão de ações' },
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

  const clinicalReports = meetingsDiscente.filter((m) => {
    const cr = m.clinicalRecord || {};
    return (
      cr.identificacaoServico ||
      cr.identificacaoProfissional ||
      cr.motivoDemanda ||
      cr.procedimentos ||
      cr.analiseCompreensao ||
      cr.encaminhamentosRecomendacoes ||
      cr.limitesDocumento ||
      cr.planoObjetivos ||
      cr.planoEstrategias ||
      cr.planoAcordos ||
      cr.planoEncaminhamentos ||
      cr.planoCriterios
    );
  });

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
    } else if (m._statusNormalized.includes('process')) {
      label = 'Processando';
      className = 'bg-amber-100 text-amber-800 border border-amber-200';
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

  const timelineTypeStyles = {
    solicitacao: 'bg-amber-50 text-amber-800 border border-amber-200',
    sessao: 'bg-blue-50 text-blue-800 border border-blue-200',
    transcricao: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  };
  const timelineTypeLabels = {
    solicitacao: 'Solicitação',
    sessao: 'Sessão',
    transcricao: 'Transcrição',
  };

  const timelineItems = (() => {
    const items = [];

    solicitacoes.forEach((s) => {
      const date = s.createdAt ? new Date(s.createdAt) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      items.push({
        type: 'solicitacao',
        title: 'Solicitação de atendimento',
        description: s.motivation || 'Solicitação registrada',
        status: s.status,
        date,
      });
    });

    meetingsDiscente.forEach((m) => {
      const date = m._dateObj || getMeetingDate(m);
      if (!date || Number.isNaN(date.getTime())) return;
      items.push({
        type: 'sessao',
        title: 'Sessão agendada/registrada',
        description:
          m.notes ||
          m.clinicalRecord?.analiseCompreensao ||
          m.clinicalRecord?.motivoDemanda ||
          'Sessão criada',
        status: m.status,
        date,
      });
    });

    orderedTranscricoes.forEach((t) => {
      const date = t.createdAt ? new Date(t.createdAt) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      items.push({
        type: 'transcricao',
        title: t.fileName || 'Transcrição',
        description: t.analysis?.summary || 'Transcrição registrada',
        status: t.analysis?.sentiments ? 'Com análise' : 'Sem análise',
        date,
      });
    });

    return items
      .filter((item) => item.date)
      .sort((a, b) => b.date - a.date)
      .slice(0, 30);
  })();

  const filteredTimelineItems =
    timelineFilter === 'all'
      ? timelineItems
      : timelineItems.filter((item) => item.type === timelineFilter);

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
                disabled={reprocessing || !hasTranscricoes}
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
      <div
        className={`rounded-xl border shadow-sm p-4 ${
          isBlockedByLimit
            ? 'bg-red-50 border-red-100'
            : 'bg-blue-50 border-blue-100'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          <div className="rounded-lg p-3 space-y-3 h-full flex flex-col">
            <p className="text-xs uppercase text-gray-600 tracking-wide">
              Controle de sessões
            </p>
            <p className="text-3xl font-bold text-gray-900">
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
              <div className="mt-2 pt-2 border-t border-white/60 text-xs text-gray-700">
                Período considerado: {periodStart || '---'} a {periodEnd || '---'}
              </div>
            )}
          </div>

          <div className="rounded-lg p-3 space-y-3 h-full flex flex-col">
            <div className="space-y-1">
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
            <div className="space-y-1">
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
            <div className="space-y-1">
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
        </div>
      </div>

            {/* Analise e transcrições do discente */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h2 className="text-lg font-semibold">Transcrições e análise desse discente</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadDiscenteReport}
              disabled={downloadingDiscenteReport || downloadingDiscenteReportPdf || !hasTranscricoes}
              className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {downloadingDiscenteReport ? 'Gerando...' : 'Baixar TXT'}
            </button>
            <button
              type="button"
              onClick={handleDownloadDiscenteReportPdf}
              disabled={downloadingDiscenteReport || downloadingDiscenteReportPdf || !hasTranscricoes}
              className="px-3 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {downloadingDiscenteReportPdf ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
          </div>
        </div>

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

            {/* Único bloco de padrões percebidos */}
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
              <div className="mb-4 border rounded-lg p-4 bg-white text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Linha do tempo de sentimentos</h3>
                  <span className="text-[11px] text-gray-500">
                    Distribuição de positivo / neutro / negativo
                  </span>
                </div>
                <ul className="space-y-2">
                  {sentimentTimeline.map((item, idx) => {
                    const pos = Math.round((item.sentiments.positive || 0) * 100);
                    const neu = Math.round((item.sentiments.neutral || 0) * 100);
                    const neg = Math.round((item.sentiments.negative || 0) * 100);
                    return (
                      <li
                        key={`${item.dateLabel}-${idx}`}
                        className="space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span className="font-semibold text-gray-800">{item.dateLabel}</span>
                          <span>
                            +{pos}% / ~{neu}% / -{neg}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full"
                            style={{ width: `${pos}%` }}
                            title={`Positivo ${pos}%`}
                          />
                          <div
                            className="bg-gray-400 h-full"
                            style={{ width: `${neu}%` }}
                            title={`Neutro ${neu}%`}
                          />
                          <div
                            className="bg-red-400 h-full"
                            style={{ width: `${neg}%` }}
                            title={`Negativo ${neg}%`}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Lista de transcrições enxuta */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Transcrições</h3>
                {selectedTranscription && (
                  <button
                    type="button"
                    onClick={() => setSelectedTranscription(null)}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Fechar detalhes
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {orderedTranscricoes.map((t) => (
                  <button
                    key={t.fileName}
                    type="button"
                    onClick={() => setSelectedTranscription(t)}
                    className={`border rounded-lg p-3 text-left bg-white shadow-sm hover:border-blue-400 transition ${
                      selectedTranscription?.fileName === t.fileName ? 'ring-2 ring-blue-200' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900 line-clamp-1">{t.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {t.createdAt
                        ? new Date(t.createdAt).toLocaleString('pt-BR')
                        : '---'}
                    </p>
                    {t.analysis?.sentiments && (
                      <p className="text-[11px] text-gray-600 mt-1">
                        Sentimento: +
                        {(t.analysis.sentiments.positive * 100).toFixed(0)}% /
                        {(t.analysis.sentiments.neutral * 100).toFixed(0)}% /
                        {(t.analysis.sentiments.negative * 100).toFixed(0)}%
                      </p>
                    )}
                    {!t.analysis && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        Análise pendente.
                      </p>
                    )}
                  </button>
                ))}
              </div>

              {selectedTranscription && (
                <div className="mt-3 border rounded-lg p-4 bg-gray-50 text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedTranscription.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedTranscription.createdAt
                          ? new Date(selectedTranscription.createdAt).toLocaleString('pt-BR')
                          : '---'}
                      </p>
                    </div>
                    {selectedTranscription.analysis?.sentiments && (
                      <div className="text-[11px] text-gray-600 bg-white px-2 py-1 rounded-md border">
                        Sentimento: +
                        {(selectedTranscription.analysis.sentiments.positive * 100).toFixed(0)}% /
                        {(selectedTranscription.analysis.sentiments.neutral * 100).toFixed(0)}% /
                        {(selectedTranscription.analysis.sentiments.negative * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  {selectedTranscription.analysis?.summary && (
                    <p className="text-gray-700 mb-2">
                      {selectedTranscription.analysis.summary}
                    </p>
                  )}

                  {Array.isArray(selectedTranscription.analysis?.keywords) && (
                    <div className="flex flex-wrap gap-2 text-[11px] text-gray-700 mb-2">
                      {selectedTranscription.analysis.keywords.map((kw) => (
                        <span
                          key={`${selectedTranscription.fileName}-kw-${kw}`}
                          className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {Array.isArray(selectedTranscription.analysis?.topics) && (
                    <div className="flex flex-wrap gap-2 text-[11px] text-gray-700 mb-2">
                      {selectedTranscription.analysis.topics.map((topic) => (
                        <span
                          key={`${selectedTranscription.fileName}-topic-${topic}`}
                          className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}

                  {Array.isArray(selectedTranscription.analysis?.actionableInsights) &&
                    selectedTranscription.analysis.actionableInsights.length > 0 && (
                      <div className="mt-2 bg-white border rounded-lg p-2">
                        <p className="text-xs font-semibold text-gray-700 mb-1">
                          Sugestões desta sessão
                        </p>
                        <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                          {selectedTranscription.analysis.actionableInsights.map((insight, idx) => (
                            <li key={`${selectedTranscription.fileName}-insight-${idx}`}>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Relatórios psicológicos (CFP) */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div>
            <h2 className="text-lg font-semibold">Relatórios psicológicos</h2>
            <p className="text-xs text-gray-500">Registros por sessão, alinhados ao manual do CFP.</p>
          </div>
        </div>

        {loadingMeetings ? (
          <p className="text-sm text-gray-500">Carregando relatórios...</p>
        ) : clinicalReports.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum relatório registrado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
            {clinicalReports.map((m) => {
              const cr = m.clinicalRecord || {};
              return (
                <div
                  key={`report-${m.id}`}
                  className="border rounded-lg p-3 bg-gray-50 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Sessão: {formatMeetingLabel(m)}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Status: {m.status || '---'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {renderMeetingStatusBadge(m)}
                      {m._dateObj && (
                        <span className="text-[11px] text-gray-500">
                          {m._isPast ? 'Data passada' : 'Sessão futura'}
                        </span>
                      )}
                    </div>
                  </div>

                  {cr.motivoDemanda && (
                    <p className="text-xs text-gray-700">
                      <span className="font-semibold text-gray-800">Motivo: </span>
                      {cr.motivoDemanda}
                    </p>
                  )}
                  {cr.procedimentos && (
                    <p className="text-[11px] text-gray-700">
                      <span className="font-semibold text-gray-800">Procedimentos: </span>
                      {cr.procedimentos}
                    </p>
                  )}
                  {cr.analiseCompreensao && (
                    <p className="text-xs text-gray-700">
                      <span className="font-semibold text-gray-800">Análise: </span>
                      {cr.analiseCompreensao}
                    </p>
                  )}
                  {cr.encaminhamentosRecomendacoes && (
                    <p className="text-[11px] text-gray-700">
                      <span className="font-semibold text-gray-800">Encaminhamentos/Recomendações: </span>
                      {cr.encaminhamentosRecomendacoes}
                    </p>
                  )}
                  {cr.limitesDocumento && (
                    <p className="text-[11px] text-gray-700">
                      <span className="font-semibold text-gray-800">Limites do documento: </span>
                      {cr.limitesDocumento}
                    </p>
                  )}

                  {(cr.planoObjetivos ||
                    cr.planoEstrategias ||
                    cr.planoAcordos ||
                    cr.planoEncaminhamentos ||
                    cr.planoCriterios) && (
                    <div className="border-t pt-2 mt-1 space-y-1 text-[11px] text-gray-700">
                      <p className="font-semibold text-gray-800 text-xs">Plano de ação</p>
                      {cr.planoObjetivos && (
                        <p>
                          <span className="font-semibold">Objetivos: </span>
                          {cr.planoObjetivos}
                        </p>
                      )}
                      {cr.planoEstrategias && (
                        <p>
                          <span className="font-semibold">Estratégias: </span>
                          {cr.planoEstrategias}
                        </p>
                      )}
                      {cr.planoAcordos && (
                        <p>
                          <span className="font-semibold">Acordos: </span>
                          {cr.planoAcordos}
                        </p>
                      )}
                      {cr.planoEncaminhamentos && (
                        <p>
                          <span className="font-semibold">Encaminhamentos: </span>
                          {cr.planoEncaminhamentos}
                        </p>
                      )}
                      {cr.planoCriterios && (
                        <p>
                          <span className="font-semibold">Critérios: </span>
                          {cr.planoCriterios}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-auto">
                    <button
                      type="button"
                      onClick={() => navigate(`/meetings/${m.id}`)}
                      className="inline-flex items-center px-2 py-1 rounded-md border text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      Ver sessão
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico de sessões (meetings) */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h2 className="text-lg font-semibold">Sessões</h2>
          <p className="text-xs text-gray-500">
            Galeria resumida (mais recentes primeiro).
          </p>
        </div>

        {loadingMeetings ? (
          <p className="text-sm text-gray-500">Carregando sessões...</p>
        ) : meetingsDiscente.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma sessão registrada para este discente.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
            {meetingsDiscente.map((m) => {
              const summaryText =
                m.clinicalRecord?.analiseCompreensao ||
                m.clinicalRecord?.motivoDemanda ||
                m.notes ||
                m.informalNotes ||
                null;
              const observationsText = m.clinicalRecord?.procedimentos || null;
              const planText = m.clinicalRecord?.planoObjetivos || null;

              return (
                <div
                  key={m.id}
                  className="border rounded-lg p-3 bg-gray-50 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatMeetingLabel(m)}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Criada em:{' '}
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleString('pt-BR')
                          : '---'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {renderMeetingStatusBadge(m)}
                      {m._dateObj && (
                        <span className="text-[11px] text-gray-500">
                          {m._isPast ? 'Data passada' : 'Sessão futura'}
                        </span>
                      )}
                    </div>
                  </div>

                  {summaryText && (
                    <p className="text-xs text-gray-700">
                      <span className="font-semibold text-gray-800">Resumo: </span>
                      {summaryText}
                    </p>
                  )}
                  {observationsText && (
                    <p className="text-[11px] text-gray-700">
                      <span className="font-semibold text-gray-800">Condutas: </span>
                      {observationsText}
                    </p>
                  )}
                  {planText && (
                    <p className="text-[11px] text-gray-700">
                      <span className="font-semibold text-gray-800">Próximos passos: </span>
                      {planText}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-auto">
                    <button
                      type="button"
                      onClick={() => navigate(`/meetings/${m.id}`)}
                      className="inline-flex items-center px-2 py-1 rounded-md border text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
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
                        className="inline-flex items-center px-2 py-1 rounded-md bg-green-600 text-white text-[11px] font-semibold hover:bg-green-700"
                      >
                        Marcar como concluída
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Linha do tempo do discente */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-lg font-semibold">Linha do tempo do discente</h2>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-gray-500">Filtrar:</label>
            <select
              value={timelineFilter}
              onChange={(e) => setTimelineFilter(e.target.value)}
              className="border rounded-md px-2 py-1 text-xs"
            >
              <option value="all">Todos</option>
              <option value="solicitacao">Solicitações</option>
              <option value="sessao">Sessões</option>
              <option value="transcricao">Transcrições</option>
            </select>
          </div>
        </div>

        {filteredTimelineItems.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">Nenhum evento registrado.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {filteredTimelineItems.map((item, idx) => (
              <div
                key={`${item.type}-${idx}-${item.title}`}
                className="border rounded-lg p-3 bg-gray-50"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                        timelineTypeStyles[item.type] ||
                        'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {timelineTypeLabels[item.type] || item.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.date.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {item.status || 'Sem status'}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {item.title}
                </p>
                <p className="text-xs text-gray-700">{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
