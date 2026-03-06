import { toKilobytes } from '../utils/relatoriosUtils';

export default function RelatoriosCards({ overview, solicitacoes }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
    </div>
  );
}
