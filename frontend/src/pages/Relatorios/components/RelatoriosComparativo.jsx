export default function RelatoriosComparativo({ comparativo, maxComparativo }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 lg:col-span-2">
      <h2 className="text-lg font-semibold mb-3">Solicitações x Atendimentos concluídos</h2>
      {!comparativo.length ? (
        <p className="text-sm text-gray-500">Sem dados para comparação.</p>
      ) : (
        <div className="min-w-full">
          <div className="flex items-end gap-4 h-48">
            {comparativo.map((point) => {
              const solicitHeight = Math.max(6, Math.round((point.solicitacoes / maxComparativo) * 100));
              const atendHeight = Math.max(6, Math.round((point.atendimentosConcluidos / maxComparativo) * 100));
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
  );
}
