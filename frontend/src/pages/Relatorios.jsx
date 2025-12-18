// front/src/pages/Relatorios.jsx
import React, { useEffect, useState } from 'react';
import apiService from '../services/api';

export default function Relatorios() {
  const [overview, setOverview] = useState(null);
  const [byCourse, setByCourse] = useState([]);
  const [highlights, setHighlights] = useState({ topKeywords: [], topTopics: [] });
  const [timeline, setTimeline] = useState([]);
  const [bestPeriod, setBestPeriod] = useState(null);
  const [solicitacoes, setSolicitacoes] = useState({ total: 0, timeline: [], peak: null });
  const [comparativo, setComparativo] = useState([]);
  const [atendimentosTimeline, setAtendimentosTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const maxTimeline = Math.max(
    1,
    ...timeline.map((t) => t.count || 0)
  );
  const maxCourseCount = Math.max(
    1,
    ...byCourse.map((c) => c.count || 0)
  );
  const maxSolicTimeline = Math.max(
    1,
    ...solicitacoes.timeline.map((t) => t.count || 0)
  );
  const maxAtendimentosTimeline = Math.max(
    1,
    ...atendimentosTimeline.map((t) => t.count || t.atendimentosConcluidos || 0)
  );
  const maxComparativo = Math.max(
    1,
    ...comparativo.map((t) => Math.max(t.solicitacoes || 0, t.atendimentosConcluidos || 0))
  );

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
          setTimeline(res.timeline || []);
          setBestPeriod(res.periodWithMostRequests || null);
          setSolicitacoes(res.solicitacoes || { total: 0, timeline: [], peak: null });
          setComparativo(res.comparativo || []);
          setAtendimentosTimeline(res.atendimentosTimeline || []);
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

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Relatórios gerais de atendimentos</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={handleDownloadOverview}
            disabled={loading || downloading}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
          >
            {downloading ? 'Gerando...' : 'Baixar análise (TXT)'}
          </button>
          <button
            onClick={handleDownloadOverviewPdf}
            disabled={loading || downloadingPdf}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {downloadingPdf ? 'Gerando...' : 'Baixar PDF'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p>Carregando...</p>
      ) : !overview ? (
        <p>Nenhum dado disponível.</p>
      ) : (
        <>
          {/* Cards gerais */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-gray-500 text-sm">Total de transcrições</p>
              <p className="text-2xl font-semibold">
                {overview.totalTranscriptions}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-gray-500 text-sm">Total de discentes atendidos</p>
              <p className="text-2xl font-semibold">
                {overview.totalStudents}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-gray-500 text-sm">Tamanho total (KB)</p>
              <p className="text-2xl font-semibold">
                {Math.round((overview.totalSizeBytes || 0) / 1024)}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-gray-500 text-sm">Tamanho médio (KB)</p>
              <p className="text-2xl font-semibold">
                {Math.round((overview.avgSizeBytes || 0) / 1024)}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-gray-500 text-sm">Solicitações registradas</p>
              <p className="text-2xl font-semibold">
                {solicitacoes.total || 0}
              </p>
            </div>
          </div>

          {/* Sentimento médio geral, se existir */}
          {overview.sentimentsAvg && (
            <div className="bg-white rounded-xl shadow p-4 text-sm">
              <p className="font-semibold mb-3">Sentimento médio geral</p>
              <div className="space-y-2">
                {[
                  { label: 'Positivo', value: overview.sentimentsAvg.positive, color: 'bg-emerald-500' },
                  { label: 'Neutro', value: overview.sentimentsAvg.neutral, color: 'bg-amber-400' },
                  { label: 'Negativo', value: overview.sentimentsAvg.negative, color: 'bg-rose-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700">{item.label}</span>
                      <span className="text-gray-900 font-semibold">
                        {(item.value * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`${item.color} h-2.5 rounded-full transition-all`}
                        style={{ width: `${Math.min(100, Math.max(0, item.value * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solicitações por mês */}
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold">Solicitações por mês</h2>
              {solicitacoes.peak && (
                <span className="text-sm text-gray-600">
                  Pico: {solicitacoes.peak.periodLabel} ({solicitacoes.peak.count})
                </span>
              )}
            </div>
            {!solicitacoes.timeline.length ? (
              <p className="text-sm text-gray-500">Sem solicitações registradas.</p>
            ) : (
              <div className="min-w-full">
                <div className="flex items-end gap-3 h-40">
                  {solicitacoes.timeline.map((point) => {
                    const heightPct = Math.max(
                      6,
                      Math.round((point.count / maxSolicTimeline) * 100)
                    );
                    return (
                      <div key={point.period} className="flex flex-col items-center flex-1 min-w-[60px]">
                        <div
                          className="w-full max-w-[32px] bg-purple-100 rounded-t-md flex items-end justify-center"
                          style={{ height: `${heightPct}%` }}
                        >
                          <span className="text-[11px] font-semibold text-purple-800 pb-1">
                            {point.count}
                          </span>
                        </div>
                        <span className="mt-2 text-[11px] text-gray-600 text-center leading-tight">
                          {point.periodLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Atendimentos concluídos por mês */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold mb-3">Atendimentos concluídos por mês</h2>
            {!atendimentosTimeline.length ? (
              <p className="text-sm text-gray-500">Sem atendimentos concluídos registrados.</p>
            ) : (
              <div className="min-w-full">
                <div className="flex items-end gap-3 h-40">
                  {atendimentosTimeline.map((point) => {
                    const count = point.count ?? point.atendimentosConcluidos ?? 0;
                    const heightPct = Math.max(
                      6,
                      Math.round((count / maxAtendimentosTimeline) * 100)
                    );
                    return (
                      <div key={point.period} className="flex flex-col items-center flex-1 min-w-[60px]">
                        <div
                          className="w-full max-w-[32px] bg-sky-100 rounded-t-md flex items-end justify-center"
                          style={{ height: `${heightPct}%` }}
                        >
                          <span className="text-[11px] font-semibold text-sky-800 pb-1">
                            {count}
                          </span>
                        </div>
                        <span className="mt-2 text-[11px] text-gray-600 text-center leading-tight">
                          {point.periodLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Comparativo solicitações x atendimentos concluídos */}
          <div className="bg-white rounded-xl shadow p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-3">Solicitações x Atendimentos concluídos</h2>
            {!comparativo.length ? (
              <p className="text-sm text-gray-500">Sem dados para comparação.</p>
            ) : (
              <div className="min-w-full">
                <div className="flex items-end gap-4 h-48">
                  {comparativo.map((point) => {
                    const solicitHeight = Math.max(
                      6,
                      Math.round((point.solicitacoes / maxComparativo) * 100)
                    );
                    const atendHeight = Math.max(
                      6,
                      Math.round((point.atendimentosConcluidos / maxComparativo) * 100)
                    );
                    return (
                      <div
                        key={point.period}
                        className="flex flex-col items-center flex-1 min-w-[70px] gap-2"
                      >
                        <div className="flex items-end gap-1 w-full">
                          <div
                            className="flex-1 max-w-[32px] bg-purple-200 rounded-t-md flex items-end justify-center"
                            style={{ height: `${solicitHeight}%` }}
                          >
                            <span className="text-[10px] font-semibold text-purple-800 pb-1">
                              {point.solicitacoes}
                            </span>
                          </div>
                          <div
                            className="flex-1 max-w-[32px] bg-sky-200 rounded-t-md flex items-end justify-center"
                            style={{ height: `${atendHeight}%` }}
                          >
                            <span className="text-[10px] font-semibold text-sky-800 pb-1">
                              {point.atendimentosConcluidos}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] text-gray-600 text-center leading-tight">
                          {point.periodLabel}
                        </span>
                        <span className="text-[10px] text-gray-500 text-center">
                          Solicitações vs. Concluídos
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-purple-200 border border-purple-300" /> Solicitações
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-sky-200 border border-sky-300" /> Atendimentos concluídos
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tabela por curso */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="text-lg font-semibold">Distribuição por curso</h2>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Curso
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Qtde. transcrições
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Discentes atendidos
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Última transcrição
                  </th>
                </tr>
              </thead>
              <tbody>
                {byCourse.map((c) => (
                  <tr key={c.course} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{c.course}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800 font-medium">{c.count}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((c.count / maxCourseCount) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">{c.distinctStudents}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {c.lastTranscriptionAt
                        ? new Date(c.lastTranscriptionAt).toLocaleString(
                            'pt-BR'
                          )
                        : '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Principais temas gerais */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold mb-3">
              Principais temas gerais identificados
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-2">Palavras-chave mais frequentes</p>
                {(!highlights.topKeywords ||
                  highlights.topKeywords.length === 0) && (
                  <p className="text-gray-500 text-xs">
                    Nenhuma palavra-chave disponível.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {highlights.topKeywords?.map((k) => (
                    <span
                      key={k.term}
                      className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-800 text-xs"
                    >
                      {k.term}
                      <span className="ml-1 text-[10px] text-blue-500">
                        ({k.count})
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-medium mb-2">Tópicos gerais mais frequentes</p>
                {(!highlights.topTopics ||
                  highlights.topTopics.length === 0) && (
                  <p className="text-gray-500 text-xs">
                    Nenhum tópico disponível.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {highlights.topTopics?.map((t) => (
                    <span
                      key={t.term}
                      className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-800 text-xs"
                    >
                      {t.term}
                      <span className="ml-1 text-[10px] text-green-500">
                        ({t.count})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
