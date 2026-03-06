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
    <div className="bg-white rounded-xl shadow p-4 text-sm">
      <p className="font-semibold mb-3">Sentimento médio geral</p>
      <div className="space-y-2">
        {sentimentoMeta.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-700">{item.label}</span>
              <span className="text-gray-900 font-semibold">
                {(sentimentsAvg[item.key] * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`${item.color} h-2.5 rounded-full transition-all`}
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
