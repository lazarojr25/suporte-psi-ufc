import { useEffect, useMemo, useState, useCallback } from 'react';

import apiService from '../../../services/api';
import { getMaxFromPair, getMaxTimeline } from '../utils/relatoriosUtils';

export default function useRelatoriosData({ from = null, to = null } = {}) {
  const [overview, setOverview] = useState(null);
  const [byCourse, setByCourse] = useState([]);
  const [highlights, setHighlights] = useState({ topKeywords: [], topTopics: [] });
  const [timeline, setTimeline] = useState([]);
  const [sentimentsTimeline, setSentimentsTimeline] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState({ total: 0, timeline: [], peak: null });
  const [comparativo, setComparativo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [cache, setCache] = useState(null);
  const [qualityFlags, setQualityFlags] = useState({
    lowConfidenceRate: 0,
    pendingReviewRate: 0,
    failedAnalysisRate: 0,
  });
  const [riskSignals, setRiskSignals] = useState({ totals: {}, topTriggers: [] });
  const [timeWindows, setTimeWindows] = useState({});
  const [topCourseTrend, setTopCourseTrend] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [narratives, setNarratives] = useState(null);
  const [attendanceHoursByUser, setAttendanceHoursByUser] = useState({
    users: [],
    totals: {
      scheduledHours: 0,
      completedHours: 0,
      scheduledSessions: 0,
      completedSessions: 0,
    },
  });

  const toIso = useCallback((value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }, []);

  const load = useCallback(
    async ({ forceRefresh = false } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const query = {
          ...(toIso(from) ? { from: toIso(from) } : {}),
          ...(toIso(to) ? { to: toIso(to) } : {}),
          ...(forceRefresh ? { forceRefresh: true } : {}),
        };
        const res = await apiService.getReportsOverview(query);
        if (res?.success) {
          setOverview(res.overview);
          setByCourse(res.byCourse || []);
          setHighlights(res.highlights || { topKeywords: [], topTopics: [] });
          setSentimentsTimeline(res.sentimentsTimeline || []);
          setTimeline(res.timeline || []);
          setSolicitacoes(res.solicitacoes || { total: 0, timeline: [], peak: null });
          setComparativo(res.comparativo || []);
          setCache(res.cache || null);
          setQualityFlags(res.qualityFlags || { lowConfidenceRate: 0, pendingReviewRate: 0, failedAnalysisRate: 0 });
          setRiskSignals(res.riskSignals || { totals: {}, topTriggers: [] });
          setTimeWindows(res.timeWindows || {});
          setTopCourseTrend(res.topCourseTrend || null);
          setAlerts(res.alerts || []);
          setNarratives(res.narratives || null);
          setAttendanceHoursByUser(
            res.attendanceHoursByUser || {
              users: [],
              totals: {
                scheduledHours: 0,
                completedHours: 0,
                scheduledSessions: 0,
                completedSessions: 0,
              },
            },
          );
        } else {
          setError('Falha ao carregar relatórios.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar relatórios.');
      } finally {
        setLoading(false);
      }
    },
    [from, to, toIso],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRefreshNow = useCallback(() => {
    load({ forceRefresh: true });
  }, [load]);

  const hasData = useMemo(
    () =>
      !!overview &&
      ((overview.totalTranscriptions || 0) > 0 ||
        (overview.totalStudents || 0) > 0 ||
        (solicitacoes.total || 0) > 0 ||
        (sentimentsTimeline.length || 0) > 0 ||
        (timeline?.length || 0) > 0 ||
        (byCourse?.length || 0) > 0),
    [overview, solicitacoes.total, sentimentsTimeline.length, timeline.length, byCourse.length],
  );

  const maxCourseCount = useMemo(
    () => getMaxTimeline(byCourse, 'count'),
    [byCourse]
  );
  const maxComparativo = useMemo(
    () => getMaxFromPair(comparativo),
    [comparativo]
  );

  const handleDownloadOverview = async () => {
    try {
      setDownloading(true);
      const { blob, fileName } = await apiService.exportReportsOverview({
        ...(toIso(from) ? { from: toIso(from) } : {}),
        ...(toIso(to) ? { to: toIso(to) } : {}),
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `relatorio-geral-${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Não foi possível fazer o download.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadOverviewPdf = async () => {
    try {
      setDownloadingPdf(true);
      const { blob, fileName } = await apiService.exportReportsOverviewPdf({
        ...(toIso(from) ? { from: toIso(from) } : {}),
        ...(toIso(to) ? { to: toIso(to) } : {}),
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `relatorio-geral-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Não foi possível fazer o download em PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return {
    overview,
    byCourse,
    highlights,
    solicitacoes,
    comparativo,
    loading,
    error,
    downloading,
    downloadingPdf,
    hasData,
    maxCourseCount,
    maxComparativo,
    handleDownloadOverview,
    handleDownloadOverviewPdf,
    cache,
    qualityFlags,
    riskSignals,
    timeWindows,
    topCourseTrend,
    alerts,
    narratives,
    sentimentsTimeline,
    handleRefreshNow,
    attendanceHoursByUser,
  };
}
