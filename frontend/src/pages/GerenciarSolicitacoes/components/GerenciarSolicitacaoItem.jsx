import { Link } from 'react-router-dom';

import { getStatusBadgeMeta } from '../utils/gerenciarSolicitacoesUtils';

export default function GerenciarSolicitacaoItem({
  solicitacao,
  meetingsBySolicitacao,
  onOpenDiscente,
  onOpenMeeting,
  onOpenScheduling,
  itemClassName,
}) {
  const statusMeta = getStatusBadgeMeta(solicitacao.status);
  
  return (
    <li className={`border rounded-lg p-4 flex flex-col gap-3 ${itemClassName || ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">
            {solicitacao.name || 'Aluno sem nome'}
          </p>
          <p className="text-xs text-gray-500">
            Matrícula: <strong>{solicitacao.studentId || '---'}</strong>
            {solicitacao.curso && (
              <>
                {' · '}Curso:{' '}
                <strong>{solicitacao.curso}</strong>
              </>
            )}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="text-sm text-gray-800">
        <p className="font-medium">Motivo da solicitação</p>
        <p className="text-gray-700">{solicitacao.motivation || '---'}</p>
      </div>

      <p className="text-xs text-gray-500">
        Criada em: {solicitacao.createdAtLabel}
      </p>

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          onClick={() => onOpenDiscente(solicitacao.discenteId)}
          disabled={!solicitacao.discenteId}
          className="
            px-3 py-1.5 text-xs font-medium rounded-md
            text-white bg-blue-600 
            hover:bg-blue-700 
            disabled:opacity-40 disabled:cursor-not-allowed
            transition
          "
        >
          Ver detalhes do discente
        </button>

        {solicitacao.isAgendada && meetingsBySolicitacao[solicitacao.id] && (
          <button
            type="button"
            onClick={() =>
              onOpenMeeting(meetingsBySolicitacao[solicitacao.id])
            }
            className="
              px-3 py-1.5 text-xs font-medium rounded-md
              text-emerald-700 bg-emerald-50 border border-emerald-200
              hover:bg-emerald-100
              transition
            "
          >
            Abrir sessão
          </button>
        )}

        <Link
          to={onOpenScheduling(solicitacao.id)}
          className="
            px-3 py-1.5 text-xs font-medium rounded-md
            text-blue-600 border border-blue-600
            hover:bg-blue-50
            transition
          "
        >
          Agendar sessão
        </Link>
      </div>
    </li>
  );
}
