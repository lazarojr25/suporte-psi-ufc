import useRelatoriosData from './Relatorios/hooks/useRelatoriosData';
import RelatoriosHeader from './Relatorios/components/RelatoriosHeader';
import RelatoriosCards from './Relatorios/components/RelatoriosCards';
import RelatoriosSentimento from './Relatorios/components/RelatoriosSentimento';
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
  } = useRelatoriosData();

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <RelatoriosHeader
        onDownloadTxt={handleDownloadOverview}
        onDownloadPdf={handleDownloadOverviewPdf}
        loading={loading}
        downloading={downloading}
        downloadingPdf={downloadingPdf}
        hasData={hasData}
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p>Carregando...</p>
      ) : !overview ? (
        <p>Nenhum dado disponível.</p>
      ) : (
        <>
          <RelatoriosCards overview={overview} solicitacoes={solicitacoes} />

          <RelatoriosSentimento sentimentsAvg={overview.sentimentsAvg} />

          <RelatoriosComparativo comparativo={comparativo} maxComparativo={maxComparativo} />

          <RelatoriosCursoTable byCourse={byCourse} maxCourseCount={maxCourseCount} />

          <RelatoriosHighlights highlights={highlights} />
        </>
      )}
    </div>
  );
}
