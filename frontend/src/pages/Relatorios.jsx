import useRelatoriosData from './Relatorios/hooks/useRelatoriosData';
import RelatoriosHeader from './Relatorios/components/RelatoriosHeader';
import RelatoriosCards from './Relatorios/components/RelatoriosCards';
import RelatoriosSentimento from './Relatorios/components/RelatoriosSentimento';
import RelatoriosEvolucaoSentimento from './Relatorios/components/RelatoriosEvolucaoSentimento';
import RelatoriosComparativo from './Relatorios/components/RelatoriosComparativo';
import RelatoriosCursoTable from './Relatorios/components/RelatoriosCursoTable';
import RelatoriosHighlights from './Relatorios/components/RelatoriosHighlights';

export default function Relatorios() {
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
  } = useRelatoriosData();

  return (
    <div className="h-full w-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <div className="bg-white rounded-xl shadow p-4">
        <RelatoriosHeader
          onDownloadTxt={handleDownloadOverview}
          onDownloadPdf={handleDownloadOverviewPdf}
          loading={loading}
          downloading={downloading}
          downloadingPdf={downloadingPdf}
          hasData={hasData}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {loading ? (
          <p>Carregando...</p>
        ) : !overview ? (
          <p>Nenhum dado disponível.</p>
        ) : (
          <div className="space-y-4 pb-2">
            <RelatoriosCards overview={overview} solicitacoes={solicitacoes} />

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
