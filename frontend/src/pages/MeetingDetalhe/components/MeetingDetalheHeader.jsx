export default function MeetingDetalheHeader({ meeting, statusBadgeMeta, onBack }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase text-gray-500">Sessão</p>
        <h1 className="text-2xl font-bold text-gray-900">
          {meeting.studentName || 'Sessão'}
        </h1>
        <p className="text-sm text-gray-600">
          {meeting.scheduledDate} {meeting.scheduledTime && `às ${meeting.scheduledTime}`}
        </p>
        {statusBadgeMeta && (
          <span className={statusBadgeMeta.className}>{statusBadgeMeta.text}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="px-3 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
      >
        Voltar para agenda
      </button>
    </div>
  );
}
