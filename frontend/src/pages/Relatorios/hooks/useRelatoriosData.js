import { useEffect, useMemo, useState } from 'react';

import apiService from '../../../services/api';
import { getMaxFromPair, getMaxTimeline } from '../utils/relatoriosUtils';

export default function useRelatoriosData() {
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getReportsOverview();
        if (res?.success) {
          setOverview(res.overview);
          setByCourse(res.byCourse || []);
          setHighlights(res.highlights || { topKeywords: [], topTopics: [] });
          setSentimentsTimeline(res.sentimentsTimeline || []);
          setTimeline(res.timeline || []);
          setSolicitacoes(res.solicitacoes || { total: 0, timeline: [], peak: null });
          setComparativo(res.comparativo || []);
        } else {
          setError('Falha ao carregar relatórios.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar relatórios.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

    const hasData = useMemo(() => {
      return (
        !!overview &&
        ((overview.totalTranscriptions || 0) > 0 ||
          (overview.totalStudents || 0) > 0 ||
          (solicitacoes.total || 0) > 0 ||
          (sentimentsTimeline.length || 0) > 0 ||
          (timeline?.length || 0) > 0 ||
          (byCourse?.length || 0) > 0)
      );
    }, [overview, solicitacoes.total, sentimentsTimeline.length, timeline.length, byCourse.length]);

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
      const { blob, fileName } = await apiService.exportReportsOverview();
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
      const { blob, fileName } = await apiService.exportReportsOverviewPdf();
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
    sentimentsTimeline,
  };
}
