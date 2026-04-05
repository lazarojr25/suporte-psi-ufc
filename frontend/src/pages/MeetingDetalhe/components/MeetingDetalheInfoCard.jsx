import { formatDateLabel } from '../utils/meetingDetalheUtils';

export default function MeetingDetalheInfoCard({
  meeting,
  solicitacao,
  onOpenDiscente,
  onOpenSolicitacao,
  containerClassName = '',
}) {
  const isGroupSession = meeting.sessionType === 'grupo';
  const title = isGroupSession
    ? meeting.groupTheme || meeting.title || 'Sessão em grupo'
    : meeting.studentName || '---';
  const contact = isGroupSession
    ? `${meeting.participants?.length || meeting.groupSize || 0} integrante(s)`
    : meeting.studentEmail || '---';

  return (
    <div className={`bg-white rounded-xl shadow p-4 sm:p-5 ${containerClassName}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Registro vinculado</p>
        <span className="text-xs text-gray-500">
          {formatDateLabel(meeting.createdAt)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-sm">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase">
            {isGroupSession ? 'Sessão em grupo' : 'Discente'}
          </p>
          <p className="text-base font-semibold text-gray-900 break-words">
            {title}
          </p>
          <p className="text-sm text-gray-700 break-words">
            {contact}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase">Curso</p>
          <p className="text-sm text-gray-800 break-words">{meeting.curso || '---'}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase">Duração</p>
          <p className="text-sm text-gray-800">{meeting.duration || 0} min</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase">Solicitação</p>
          <p className="text-sm text-gray-800 break-words">
            {solicitacao?.status ? `Status: ${solicitacao.status}` : 'Sem solicitação vinculada'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(meeting.discenteId || solicitacao?.discenteId) && (
          <button
            type="button"
            onClick={onOpenDiscente}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
          >
            Ver perfil do discente
          </button>
        )}
        {solicitacao && (
          <button
            type="button"
            onClick={onOpenSolicitacao}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100"
          >
            Ver solicitação vinculada
          </button>
        )}
      </div>
    </div>
  );
}
