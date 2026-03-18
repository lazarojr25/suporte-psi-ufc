export default function RelatoriosHeader({
  periodPreset,
  periodFrom,
  periodTo,
  onDownloadTxt,
  onDownloadPdf,
  loading,
  downloading,
  downloadingPdf,
  hasData,
  cache,
  onRefreshNow,
}) {
  const formatCacheAge = () => {
    if (!cache?.generatedAt) return 'sem atualização registrada';
    const generated = new Date(cache.generatedAt).getTime();
    if (Number.isNaN(generated)) return 'sem atualização registrada';
    const diff = Math.max(0, Date.now() - generated);
    const minutes = Math.max(1, Math.floor(diff / 60000));
    return `${minutes} min`;
  };

  const periodLabel = periodPreset || 'Todo período';
  const fromLabel = periodFrom ? new Date(periodFrom).toLocaleDateString('pt-BR') : 'Início';
  const toLabel = periodTo ? new Date(periodTo).toLocaleDateString('pt-BR') : 'Atual';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="text-xs uppercase text-gray-500">Relatórios</p>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios gerais de atendimentos</h1>
        <p className="text-sm text-gray-700 mt-1">
          Janela: <span className="font-semibold">{periodLabel}</span>
        </p>
        <p className="text-xs text-gray-500">
          Período: {fromLabel} até {toLabel}
        </p>
        {cache && (
          <p className="text-xs text-gray-500 mt-1">
            Dados em cache, atualizado em {formatCacheAge()}
          </p>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        {onRefreshNow && (
          <button
            onClick={onRefreshNow}
            disabled={loading || !hasData}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black disabled:opacity-60"
          >
            Atualizar agora
          </button>
        )}
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
