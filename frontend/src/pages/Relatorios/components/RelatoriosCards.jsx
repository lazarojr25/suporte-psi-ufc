import { toKilobytes } from '../utils/relatoriosUtils';

export default function RelatoriosCards({ overview, solicitacoes, qualityFlags = {}, riskSignals = {} }) {
  const riskTotal =
    Number(riskSignals?.totals?.alto || 0) +
    Number(riskSignals?.totals?.medio || 0) +
    Number(riskSignals?.totals?.baixo || 0) +
    Number(riskSignals?.totals?.desconhecido || 0);

  const highRiskRate =
    riskTotal > 0 ? Number(((Number(riskSignals?.totals?.alto || 0) / riskTotal) * 100).toFixed(1)) : 0;

  const riskPercent = highRiskRate;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-gray-500 text-sm">Total de transcrições</p>
        <p className="text-2xl font-semibold">{overview.totalTranscriptions}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-gray-500 text-sm">Total de discentes atendidos</p>
        <p className="text-2xl font-semibold">{overview.totalStudents}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-gray-500 text-sm">Tamanho total (KB)</p>
        <p className="text-2xl font-semibold">{toKilobytes(overview.totalSizeBytes)}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-gray-500 text-sm">Tamanho médio (KB)</p>
        <p className="text-2xl font-semibold">{toKilobytes(overview.avgSizeBytes)}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-gray-500 text-sm">Solicitações registradas</p>
        <p className="text-2xl font-semibold">{solicitacoes.total || 0}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-gray-500 text-sm">Confiabilidade da IA</p>
        <p className="text-2xl font-semibold text-amber-700">
          {qualityFlags.lowConfidenceRate || 0}%
        </p>
        <p className="text-[11px] text-gray-500">baixa confiança (&lt; 65%)</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-gray-500 text-sm">Revisões pendentes</p>
        <p className="text-2xl font-semibold text-rose-700">
          {qualityFlags.pendingReviewRate || 0}%
        </p>
        <p className="text-[11px] text-gray-500">humanReviewRequired</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <p className="text-gray-500 text-sm">Risco alto</p>
        <p className="text-2xl font-semibold text-red-700">{riskPercent}%</p>
        <p className="text-[11px] text-gray-500">dos sinais de risco</p>
      </div>
    </div>
  );
}
