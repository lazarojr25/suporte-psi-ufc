import { useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import apiService from '../../../services/api';
import {
  buildMeetingStatus,
  getMeetingDate,
  hasClinicalReportData,
  matchesDiscenteForMeeting,
  parsePeriodBoundary,
} from '../utils/meetingUtils';
import { buildTimelineItems } from '../utils/timelineUtils';

export default function useDiscenteDetalheData(discenteId, options = {}) {
  const { navigate } = options;

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

  const [allMeetings, setAllMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [meetingsLoaded, setMeetingsLoaded] = useState(false);
  const meetingsCacheRef = useRef(null);

  const getMeetingsFromApi = async () => {
    const resp = await apiService.getMeetings(); // GET /api/meetings
    if (resp?.success && resp.data?.meetings) {
      meetingsCacheRef.current = resp.data.meetings;
      setAllMeetings(resp.data.meetings);
    }
  };

  const loadMeetings = async (force = false) => {
    if (!force && meetingsCacheRef.current) {
      setAllMeetings(meetingsCacheRef.current);
      setMeetingsLoaded(true);
      return;
    }

    try {
      setLoadingMeetings(true);
      await getMeetingsFromApi();
      setMeetingsLoaded(true);
    } catch (mErr) {
      console.warn('Falha ao carregar meetings:', mErr);
    } finally {
      setLoadingMeetings(false);
    }
  };

  const refreshScheduleInfo = async (discente) => {
    try {
      const check = await apiService.canScheduleForDiscente(discente.id);
      if (check?.success && check.data) {
        setScheduleInfo(check.data);
      }
    } catch (e) {
      console.warn('Falha ao consultar limite de sessões:', e);
    }
  };

  const loadData = async () => {
    try {
      setError(null);

      const discenteRef = doc(db, 'discentes', discenteId);
      const discenteSnap = await getDoc(discenteRef);
      if (!discenteSnap.exists()) {
        setError('Discente não encontrado');
        return;
      }

      const discenteData = { id: discenteSnap.id, ...discenteSnap.data() };
      setDiscente(discenteData);

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
            ? data.createdAt.toDate()
            : data.createdAt || null,
        };
      });
      setSolicitacoes(lista);

      const rel = await apiService.getReportsByDiscente(discenteId);
      if (rel?.success && rel.data) {
        setRelatorioDiscente(rel.data);
        setTranscricoes(rel.data.transcriptions || []);
      } else if (rel?.data?.transcriptions) {
        setTranscricoes(rel.data.transcriptions);
      }

      try {
        const cfgRef = doc(db, 'semestreLetivo', 'semestreLetivoConfig');
        const cfgSnap = await getDoc(cfgRef);
        if (cfgSnap.exists()) {
          setSemesterConfig(cfgSnap.data());
        }
      } catch (cfgErr) {
        console.warn('Falha ao carregar semestreLetivoConfig:', cfgErr);
      }

      await refreshScheduleInfo(discenteData);
      await loadMeetings();
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar dados do discente.');
    }
  };

  useEffect(() => {
    if (!discenteId) return;
    loadData();
  }, [discenteId]);

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
      dateLabel: t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '---',
      sentiments: t.analysis.sentiments,
    }));

  const historyPatterns = relatorioDiscente?.historyPatterns;

  const now = new Date();
  const meetingsDiscente = allMeetings
    .filter((m) => matchesDiscenteForMeeting(m, discente))
    .map((m) => {
      const date = getMeetingDate(m);
      const isPast = date ? date < now : false;
      return {
        ...m,
        _dateObj: date,
        _isPast: isPast,
        _statusNormalized: buildMeetingStatus(m).normalized,
      };
    })
    .sort((a, b) => {
      if (!a._dateObj || !b._dateObj) return 0;
      return b._dateObj - a._dateObj;
    });

  const clinicalReports = meetingsDiscente.filter((m) => hasClinicalReportData(m));

  const upcomingMeeting =
    meetingsDiscente
      .filter((m) => m._dateObj && m._dateObj >= now)
      .sort((a, b) => a._dateObj - b._dateObj)[0] || null;

  const lastCompletedMeeting =
    meetingsDiscente
      .filter((m) => m._dateObj && m._statusNormalized === 'concluida')
      .sort((a, b) => b._dateObj - a._dateObj)[0] || null;

  const periodStartValue = scheduleInfo?.periodStart ?? semesterConfig?.periodStart ?? null;
  const periodEndValue = scheduleInfo?.periodEnd ?? semesterConfig?.periodEnd ?? null;
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

  const fallbackUsedSessions = scheduleInfo?.used ?? relatorioDiscente?.totalTranscriptions ?? 0;
  const usedSessions =
    meetingsLoaded && !loadingMeetings
      ? (meetingsWithinPeriod.length || concludedMeetings.length || fallbackUsedSessions)
      : fallbackUsedSessions;

  const configuredLimit = scheduleInfo?.limit ?? semesterConfig?.maxSessionsPerDiscente ?? 0;
  const remainingSessions = configuredLimit > 0 ? Math.max(0, configuredLimit - usedSessions) : null;
  const isBlockedByLimit =
    configuredLimit > 0 && remainingSessions !== null && remainingSessions <= 0;

  const timelineItems = buildTimelineItems({
    solicitacoes,
    meetingsDiscente,
    orderedTranscricoes,
  });

  const filteredTimelineItems =
    timelineFilter === 'all' ? timelineItems : timelineItems.filter((item) => item.type === timelineFilter);

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

  const handleDownload = async (downloadFn, message) => {
    if (!discente) return;
    try {
      const { blob, fileName } = await downloadFn(discente.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `relatorio-discente-${discente.studentId || discente.id}.${message}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      if (err?.message?.includes('401')) {
        alert('Sessão expirada ou sem permissão. Faça login novamente.');
      } else {
        alert(message === 'txt' ? 'Não foi possível gerar o relatório do discente.' : 'Não foi possível gerar o relatório do discente em PDF.');
      }
    }
  };

  const handleDownloadDiscenteReport = async () => {
    try {
      setDownloadingDiscenteReport(true);
      await handleDownload(apiService.exportReportByDiscente, 'txt');
    } finally {
      setDownloadingDiscenteReport(false);
    }
  };

  const handleDownloadDiscenteReportPdf = async () => {
    try {
      setDownloadingDiscenteReportPdf(true);
      const { blob, fileName } = await apiService.exportReportByDiscentePdf(discente.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `relatorio-discente-${discente.studentId || discente.id}.pdf`;
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

  const handleMarkMeetingAsConcluded = async (meetingId) => {
    try {
      setLoadingMeetings(true);
      await apiService.updateMeeting(meetingId, { status: 'concluida' });
      await getMeetingsFromApi();
      await refreshScheduleInfo(discente);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoadingMeetings(false);
    }
  };

  return {
    discente,
    solicitacoes,
    relatorioDiscente,
    orderedTranscricoes,
    selectedTranscription,
    setSelectedTranscription,
    lastTranscription,
    sentimentTimeline,
    historyPatterns,
    error,
    downloadingDiscenteReport,
    downloadingDiscenteReportPdf,
    clinicalReports,
    meetingsDiscente,
    upcomingMeeting,
    lastCompletedMeeting,
    usedSessions,
    configuredLimit,
    remainingSessions,
    isBlockedByLimit,
    periodStart: periodStartValue,
    periodEnd: periodEndValue,
    timelineFilter,
    setTimelineFilter,
    filteredTimelineItems,
    hasTranscricoes,
    loadingMeetings,
    handleAgendarNovaSessao,
    handleDownloadDiscenteReport,
    handleDownloadDiscenteReportPdf,
    handleMarkMeetingAsConcluded,
    handleReprocessDiscente,
    reprocessMsg,
    reprocessErr,
    reprocessing,
    creatingSession,
  };
}
