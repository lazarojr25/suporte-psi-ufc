export default function RelatoriosHeader({
  onDownloadTxt,
  onDownloadPdf,
  loading,
  downloading,
  downloadingPdf,
  hasData,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h1 className="text-2xl font-bold">Relatórios gerais de atendimentos</h1>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={onDownloadTxt}
          disabled={loading || downloading || !hasData}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
        >
          {downloading ? 'Gerando...' : 'Baixar análise (TXT)'}
        </button>
        <button
          onClick={onDownloadPdf}
          disabled={loading || downloadingPdf || !hasData}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {downloadingPdf ? 'Gerando...' : 'Baixar PDF'}
        </button>
      </div>
    </div>
  );
}
