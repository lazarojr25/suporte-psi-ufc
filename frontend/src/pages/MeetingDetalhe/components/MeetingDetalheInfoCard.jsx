import { formatDateLabel } from '../utils/meetingDetalheUtils';

export default function MeetingDetalheInfoCard({
  meeting,
  solicitacao,
  onOpenDiscente,
  onOpenSolicitacao,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-2 text-sm">
      <p>
        <strong>Discente:</strong> {meeting.studentName || '---'}
      </p>
      <p>
        <strong>Email:</strong> {meeting.studentEmail || '---'}
      </p>
      <p>
        <strong>Curso:</strong> {meeting.curso || '---'}
      </p>
      <p>
        <strong>Duração:</strong> {meeting.duration || 0} min
      </p>
      <p>
        <strong>Criada em:</strong> {formatDateLabel(meeting.createdAt)}
      </p>
      <div className="flex flex-wrap gap-2 mt-2">
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
