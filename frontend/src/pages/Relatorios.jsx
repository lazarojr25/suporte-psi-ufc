import { useMemo, useState } from 'react';
import useRelatoriosData from './Relatorios/hooks/useRelatoriosData';
import RelatoriosHeader from './Relatorios/components/RelatoriosHeader';
import RelatoriosCards from './Relatorios/components/RelatoriosCards';
import RelatoriosSentimento from './Relatorios/components/RelatoriosSentimento';
import RelatoriosEvolucaoSentimento from './Relatorios/components/RelatoriosEvolucaoSentimento';
import RelatoriosComparativo from './Relatorios/components/RelatoriosComparativo';
import RelatoriosCursoTable from './Relatorios/components/RelatoriosCursoTable';
import RelatoriosHighlights from './Relatorios/components/RelatoriosHighlights';

const quickRanges = [
  { key: 'all', label: 'Todo período' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'semester', label: 'Semestre atual' },
];

export default function Relatorios() {
  const [periodPreset, setPeriodPreset] = useState('all');

  const periodRange = useMemo(() => {
    if (periodPreset === 'all') return { from: null, to: null };
    const now = new Date();
    const startOfSemester = new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1);
    const daysRange = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };

    if (daysRange[periodPreset]) {
      const from = new Date(now);
      from.setDate(now.getDate() - (daysRange[periodPreset] - 1));
      return { from, to: now };
    }

    if (periodPreset === 'semester') {
      return { from: startOfSemester, to: now };
    }

    return { from: null, to: null };
  }, [periodPreset]);

  const {
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
    handleRefreshNow,
    qualityFlags,
    riskSignals,
    topCourseTrend,
    alerts,
    narratives,
    cache,
    timeWindows,
  } = useRelatoriosData({
    from: periodRange.from,
    to: periodRange.to,
  });

  const formatDateLabel = useMemo(() => (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('pt-BR');
  }, []);

  const periodLabel = useMemo(() => {
    const current = quickRanges.find((item) => item.key === periodPreset);
    return current?.label || 'Todo período';
  }, [periodPreset]);

  const windowsData = useMemo(() => ([
    {
      key: 'last30Days',
      label: 'Últimos 30 dias',
      data: timeWindows?.last30Days || {},
    },
    {
      key: 'last90Days',
      label: 'Últimos 90 dias',
      data: timeWindows?.last90Days || {},
    },
    {
      key: 'last6Months',
      label: 'Últimos 6 meses',
      data: timeWindows?.last6Months || {},
    },
    {
      key: 'currentSemester',
      label: 'Semestre atual',
      data: timeWindows?.currentSemester || {},
    },
  ]), [timeWindows]);

  const renderWindowText = (window) => {
    if (!window || (!window.transcriptions && !window.solicitacoes && !window.timeline?.length)) {
      return {
        from: 'N/A',
        to: 'N/A',
        transcriptions: 0,
        solicitacoes: 0,
        conversionRate: 0,
      };
    }

    return {
      from: formatDateLabel(window.from),
      to: formatDateLabel(window.to),
      transcriptions: window.transcriptions || 0,
      solicitacoes: window.solicitacoes || 0,
      conversionRate: window.conversionRate || 0,
    };
  };

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <div className="bg-white rounded-xl shadow p-4">
        <RelatoriosHeader
          periodPreset={periodLabel}
          periodFrom={periodRange.from}
          periodTo={periodRange.to}
          onDownloadTxt={handleDownloadOverview}
          onDownloadPdf={handleDownloadOverviewPdf}
          loading={loading}
          downloading={downloading}
          downloadingPdf={downloadingPdf}
          hasData={hasData}
          cache={cache}
          onRefreshNow={handleRefreshNow}
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-gray-500">Período:</span>
          {quickRanges.map((range) => (
            <button
              key={range.key}
              className={`px-2.5 py-1.5 rounded-full text-xs font-medium ${
                periodPreset === range.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 border border-blue-100'
              }`}
              onClick={() => setPeriodPreset(range.key)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {loading ? (
          <p>Carregando...</p>
        ) : !overview ? (
          <p>Nenhum dado disponível.</p>
        ) : (
          <div className="space-y-4 pb-2">
            {alerts?.length > 0 && (
              <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-1.5">
                <p className="font-semibold">Dashboard de alertas</p>
                <ul className="space-y-1 list-disc ml-5">
                  {alerts.slice(0, 5).map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              </section>
            )}

            <RelatoriosCards
              overview={overview}
              solicitacoes={solicitacoes}
              qualityFlags={qualityFlags}
              riskSignals={riskSignals}
            />

            {!!timeWindows && (
              <section className="bg-white rounded-xl shadow p-4">
                <p className="text-sm font-semibold mb-2">Desempenho por janela</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {windowsData.map((window) => {
                    const summary = renderWindowText(window.data);
                    return (
                      <div key={window.key} className="rounded-lg border p-3">
                        <p className="text-xs text-gray-500 mb-1">{window.label}</p>
                        <p className="text-[11px] text-gray-500 mb-1">
                          {summary.from} até {summary.to}
                        </p>
                        <p className="text-sm">
                          Concluídas: <span className="font-semibold">{summary.transcriptions}</span>
                        </p>
                        <p className="text-sm">
                          Solicitações: <span className="font-semibold">{summary.solicitacoes}</span>
                        </p>
                        <p className="text-sm">
                          Conversão: <span className="font-semibold">{summary.conversionRate}%</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {(topCourseTrend || narratives) && (
              <section className="grid grid-cols-1 gap-4">
                {topCourseTrend &&
                  ((topCourseTrend.growth?.length || 0) > 0 ||
                    (topCourseTrend.decline?.length || 0) > 0) && (
                    <div className="bg-white rounded-xl shadow p-4">
                      <h2 className="text-sm font-semibold mb-2">
                        Comparativo de cursos (últimos 2 períodos)
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Maior crescimento</p>
                          <ul className="list-disc ml-5 space-y-1">
                            {topCourseTrend.growth?.slice(0, 3).map((item) => (
                              <li key={`g-${item.course}`}>
                                {item.course}: +{item.deltaPct}% ({item.previousPeriodCount} → {item.currentPeriodCount})
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Queda mais acentuada</p>
                          <ul className="list-disc ml-5 space-y-1">
                            {topCourseTrend.decline?.slice(0, 3).map((item) => (
                              <li key={`d-${item.course}`}>
                                {item.course}: {item.deltaPct}% ({item.previousPeriodCount} → {item.currentPeriodCount})
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                {narratives && (
                  <div className="bg-white rounded-xl shadow p-4">
                    <h2 className="text-sm font-semibold mb-2">Narrativas de destaque</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="font-medium text-xs text-gray-600 mb-1">Insights</p>
                        <ul className="list-disc ml-5 space-y-1">
                          {(narratives.insights || []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-xs text-gray-600 mb-1">Chokepoints</p>
                        <ul className="list-disc ml-5 space-y-1">
                          {(narratives.chokepoints || []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-xs text-gray-600 mb-1">Ações sugeridas</p>
                        <ul className="list-disc ml-5 space-y-1">
                          {(narratives.acoesSugeridas || []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            <RelatoriosSentimento sentimentsAvg={overview.sentimentsAvg} />

            <RelatoriosEvolucaoSentimento sentimentsTimeline={sentimentsTimeline} />

            <RelatoriosComparativo comparativo={comparativo} maxComparativo={maxComparativo} />

            <RelatoriosCursoTable byCourse={byCourse} maxCourseCount={maxCourseCount} />

            <RelatoriosHighlights highlights={highlights} />
          </div>
        )}
      </div>
    </div>
  );
}
