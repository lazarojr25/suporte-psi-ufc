import { clampPercent } from '../utils/relatoriosUtils';

const sentimentoMeta = [
  {
    label: 'Positivo',
    color: 'bg-emerald-500',
    key: 'positive',
  },
  {
    label: 'Neutro',
    color: 'bg-amber-400',
    key: 'neutral',
  },
  {
    label: 'Negativo',
    color: 'bg-rose-500',
    key: 'negative',
  },
];

export default function RelatoriosSentimento({ sentimentsAvg }) {
  if (!sentimentsAvg) return null;

  return (
    <div className="bg-white rounded-xl shadow p-3 text-[11px] sm:text-[12px]">
      <p className="font-semibold mb-2 text-xs sm:text-sm">Sentimento médio geral</p>
      <div className="space-y-1.5">
        {sentimentoMeta.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-gray-700 text-xs sm:text-[12px]">{item.label}</span>
              <span className="text-gray-900 font-semibold text-[11px] sm:text-xs">
                {(sentimentsAvg[item.key] * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`${item.color} h-2 rounded-full transition-all`}
                style={{
                  width: `${clampPercent((sentimentsAvg[item.key] || 0) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
