import { Link } from 'react-router-dom';

import { getStatusBadgeMeta, normalizeStatus } from '../utils/gerenciarSolicitacoesUtils';

export default function GerenciarSolicitacaoItem({
  solicitacao,
  meetingsBySolicitacao,
  onOpenDiscente,
  onOpenMeeting,
  onOpenScheduling,
  onOpenSolicitacao,
  itemClassName,
}) {
  const statusMeta = getStatusBadgeMeta(solicitacao.status);
  const isAgendada = solicitacao.isAgendada === true || normalizeStatus(solicitacao.status) === 'agendada';
  const clampTwoLinesStyle = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };
  
  const handleOpenSolicitacao = () => {
    if (onOpenSolicitacao) {
      onOpenSolicitacao(solicitacao.id);
    }
  };

  const handleOpenDiscente = (event) => {
    if (event) {
      event.stopPropagation();
    }
    if (onOpenDiscente) {
      onOpenDiscente(solicitacao.discenteId);
    }
  };

  const handleOpenMeeting = (event) => {
    if (event) {
      event.stopPropagation();
    }
    if (onOpenMeeting) {
      onOpenMeeting(meetingsBySolicitacao[solicitacao.id]);
    }
  };

  const stopPropagateIfEvent = (event) => {
    event?.stopPropagation();
  };

  return (
    <li
      className={`border rounded-lg p-2 sm:p-2.5 flex flex-col gap-1 ${itemClassName || ''} cursor-pointer transition hover:border-blue-300 hover:bg-blue-50`}
      onClick={handleOpenSolicitacao}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpenSolicitacao();
        }
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 min-w-0">
        <div>
          <p className="font-semibold text-sm sm:text-base text-gray-900 leading-tight break-words">
            {solicitacao.name || 'Aluno sem nome'}
          </p>
          <p className="text-xs text-gray-500 break-words">
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
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <p className="text-[12px] text-gray-700 leading-snug" style={clampTwoLinesStyle}>
        <span className="font-medium text-gray-600">Motivo:</span> {solicitacao.motivation || '---'}
      </p>

      <p className="text-xs text-gray-500">
        Criada em: {solicitacao.createdAtLabel}
      </p>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:justify-end">
        <button
          onClick={handleOpenDiscente}
          disabled={!solicitacao.discenteId}
          className="
            w-full sm:w-auto px-2.5 py-1 text-xs font-medium rounded-md
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
            onClick={handleOpenMeeting}
            className="
              w-full sm:w-auto px-2.5 py-1 text-xs font-medium rounded-md
              text-emerald-700 bg-emerald-50 border border-emerald-200
              hover:bg-emerald-100
              transition
            "
          >
            Abrir sessão
          </button>
        )}

        {!isAgendada && (
          <Link
            to={onOpenScheduling(solicitacao.id)}
            onClick={stopPropagateIfEvent}
            className="
              w-full sm:w-auto px-2.5 py-1 text-xs font-medium rounded-md
              text-blue-600 border border-blue-600
              hover:bg-blue-50
              transition
            "
          >
            Agendar sessão
          </Link>
        )}
      </div>
    </li>
  );
}
