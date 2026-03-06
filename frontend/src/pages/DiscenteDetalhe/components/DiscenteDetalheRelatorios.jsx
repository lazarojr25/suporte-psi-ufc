import React from 'react';

export default function DiscenteDetalheRelatorios({
  relatorioDiscente,
  orderedTranscricoes,
  hasTranscricoes,
  selectedTranscription,
  setSelectedTranscription,
  sentimentTimeline,
  historyPatterns,
  downloadingDiscenteReport,
  downloadingDiscenteReportPdf,
  onDownloadTxt,
  onDownloadPdf,
}) {
  const historyListSections = [
    { key: 'recurringThemes', label: 'Temas recorrentes' },
    { key: 'repeatedIdeas', label: 'Ideias repetidas' },
    { key: 'emotionalPatterns', label: 'Padrões emocionais' },
    { key: 'commonTriggers', label: 'Próximos passos sugeridos' },
  ];

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold">Transcrições e análise desse discente</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDownloadTxt}
            disabled={downloadingDiscenteReport || downloadingDiscenteReportPdf || !hasTranscricoes}
            className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {downloadingDiscenteReport ? 'Gerando...' : 'Baixar TXT'}
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={downloadingDiscenteReport || downloadingDiscenteReportPdf || !hasTranscricoes}
            className="px-3 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {downloadingDiscenteReportPdf ? 'Gerando PDF...' : 'Baixar PDF'}
          </button>
        </div>
      </div>

      {!relatorioDiscente && orderedTranscricoes.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhuma transcrição vinculada a este discente.</p>
      ) : (
        <>
          {relatorioDiscente && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Total de transcrições</p>
                <p className="text-xl font-semibold">{relatorioDiscente.totalTranscriptions}</p>
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
                    Positivo: {(relatorioDiscente.sentimentsAvg.positive * 100).toFixed(1)}%
                    <br />
                    Neutro: {(relatorioDiscente.sentimentsAvg.neutral * 100).toFixed(1)}%
                    <br />
                    Negativo: {(relatorioDiscente.sentimentsAvg.negative * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {historyPatterns && (
            <div className="mb-4 border rounded-lg p-4 bg-gray-50 text-sm">
              <h3 className="font-semibold mb-3 text-gray-800">Padrões percebidos ao longo das sessões</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {historyListSections.map((section) => {
                  const entries = historyPatterns?.[section.key];
                  if (!Array.isArray(entries) || entries.length === 0) return null;

                  return (
                    <div key={section.key} className="bg-white rounded-lg p-3 shadow-inner">
                      <p className="text-xs uppercase text-gray-500 font-semibold mb-1">{section.label}</p>
                      <p className="text-gray-700">{entries.join(', ')}</p>
                    </div>
                  );
                })}
              </div>
              {!historyListSections.some(
                (section) =>
                  Array.isArray(historyPatterns?.[section.key]) &&
                  historyPatterns[section.key].length > 0,
              ) && <p className="text-gray-500">Nenhum padrão identificado até o momento.</p>}
            </div>
          )}

          {sentimentTimeline.length > 0 && (
            <div className="mb-4 border rounded-lg p-4 bg-white text-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Linha do tempo de sentimentos</h3>
                <span className="text-[11px] text-gray-500">Distribuição de positivo / neutro / negativo</span>
              </div>
              <ul className="space-y-2">
                {sentimentTimeline.map((item, idx) => {
                  const pos = Math.round((item.sentiments.positive || 0) * 100);
                  const neu = Math.round((item.sentiments.neutral || 0) * 100);
                  const neg = Math.round((item.sentiments.negative || 0) * 100);
                  return (
                    <li key={`${item.dateLabel}-${idx}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="font-semibold text-gray-800">{item.dateLabel}</span>
                        <span>+{pos}% / ~{neu}% / -{neg}%</span>
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
                    {t.createdAt ? new Date(t.createdAt).toLocaleString('pt-BR') : '---'}
                  </p>
                  {t.analysis?.sentiments && (
                    <p className="text-[11px] text-gray-600 mt-1">
                      Sentimento: +{(t.analysis.sentiments.positive * 100).toFixed(0)}% /
                      {(t.analysis.sentiments.neutral * 100).toFixed(0)}% /
                      {(t.analysis.sentiments.negative * 100).toFixed(0)}%
                    </p>
                  )}
                  {!t.analysis && <p className="text-[11px] text-amber-600 mt-1">Análise pendente.</p>}
                </button>
              ))}
            </div>

            {selectedTranscription && (
              <div className="mt-3 border rounded-lg p-4 bg-gray-50 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{selectedTranscription.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {selectedTranscription.createdAt
                        ? new Date(selectedTranscription.createdAt).toLocaleString('pt-BR')
                        : '---'}
                    </p>
                  </div>
                  {selectedTranscription.analysis?.sentiments && (
                    <div className="text-[11px] text-gray-600 bg-white px-2 py-1 rounded-md border">
                      Sentimento: +{(selectedTranscription.analysis.sentiments.positive * 100).toFixed(0)}% /
                      {(selectedTranscription.analysis.sentiments.neutral * 100).toFixed(0)}% /
                      {(selectedTranscription.analysis.sentiments.negative * 100).toFixed(0)}%
                    </div>
                  )}
                </div>

                {selectedTranscription.analysis?.summary && (
                  <p className="text-gray-700 mb-2">{selectedTranscription.analysis.summary}</p>
                )}

                {Array.isArray(selectedTranscription.analysis?.keywords) && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-700 mb-2">
                    {selectedTranscription.analysis.keywords.map((kw) => (
                      <span key={`${selectedTranscription.fileName}-kw-${kw}`} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {Array.isArray(selectedTranscription.analysis?.topics) && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-700 mb-2">
                    {selectedTranscription.analysis.topics.map((topic) => (
                      <span key={`${selectedTranscription.fileName}-topic-${topic}`} className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}

                {Array.isArray(selectedTranscription.analysis?.actionableInsights) &&
                  selectedTranscription.analysis.actionableInsights.length > 0 && (
                    <div className="mt-2 bg-white border rounded-lg p-2">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Sugestões desta sessão</p>
                      <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                        {selectedTranscription.analysis.actionableInsights.map((insight, idx) => (
                          <li key={`${selectedTranscription.fileName}-insight-${idx}`}>{insight}</li>
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
  );
}
