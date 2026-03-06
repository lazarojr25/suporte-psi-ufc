export default function GerenciarSolicitacoesHeader({ pendentesLength, agendadasLength, totalLength }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div>
        <h2 className="text-2xl font-bold">Gerenciar Solicitações</h2>
        <p className="text-sm text-gray-600">
          Visualize as solicitações pendentes e já agendadas.
        </p>
      </div>

      <div className="text-sm text-gray-700 flex flex-wrap gap-3">
        <span>
          Pendentes:{' '}
          <strong className="text-amber-700">{pendentesLength}</strong>
        </span>
        <span>
          Agendadas:{' '}
          <strong className="text-emerald-700">{agendadasLength}</strong>
        </span>
        <span>
          Total filtrado:{' '}
          <strong className="text-gray-900">{totalLength}</strong>
        </span>
      </div>
    </div>
  );
}
