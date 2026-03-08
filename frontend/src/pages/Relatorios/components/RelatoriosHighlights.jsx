export default function RelatoriosHighlights({ highlights }) {
  return (
    <div className="bg-white rounded-xl shadow p-3 sm:p-4">
      <h2 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">
        Principais temas gerais identificados
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
        <div>
          <p className="font-medium mb-1.5">Palavras-chave mais frequentes</p>
          {(!highlights.topKeywords || highlights.topKeywords.length === 0) && (
            <p className="text-gray-500 text-xs">Nenhuma palavra-chave disponível.</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {highlights.topKeywords?.map((k) => (
              <span
                key={k.term}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[11px] leading-tight"
              >
                {k.term}
                <span className="ml-1 text-[10px] text-blue-500">({k.count})</span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="font-medium mb-1.5">Tópicos gerais mais frequentes</p>
          {(!highlights.topTopics || highlights.topTopics.length === 0) && (
            <p className="text-gray-500 text-xs">Nenhum tópico disponível.</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {highlights.topTopics?.map((t) => (
              <span
                key={t.term}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-800 text-[11px] leading-tight"
              >
                {t.term}
                <span className="ml-1 text-[10px] text-green-500">({t.count})</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
