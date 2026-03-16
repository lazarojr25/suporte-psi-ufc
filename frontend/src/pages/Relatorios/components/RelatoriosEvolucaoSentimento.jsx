import { clampPercent } from '../utils/relatoriosUtils';

export default function RelatoriosEvolucaoSentimento({ sentimentsTimeline }) {
  if (!sentimentsTimeline?.length) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow p-3 sm:p-4">
      <h2 className="text-base sm:text-lg font-semibold mb-3">Evolução mensal dos sentimentos</h2>

      <div className="space-y-2">
        {sentimentsTimeline.map((point) => {
          const positive = Math.round((point.positive || 0) * 100);
          const neutral = Math.round((point.neutral || 0) * 100);
          const negative = Math.round((point.negative || 0) * 100);

          return (
            <div key={point.period} className="space-y-1">
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-700">
                <span className="font-medium">{point.periodLabel}</span>
                <span>
                  {positive > 0 || neutral > 0 || negative > 0
                    ? `${positive}% / ${neutral}% / ${negative}%`
                    : 'Sem análise nesta data'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${clampPercent(positive)}%` }} />
                <div className="bg-amber-400 h-full" style={{ width: `${clampPercent(neutral)}%` }} />
                <div className="bg-rose-500 h-full" style={{ width: `${clampPercent(negative)}%` }} />
              </div>
              <p className="text-[11px] text-gray-500">Base de transcrições: {point.count}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
