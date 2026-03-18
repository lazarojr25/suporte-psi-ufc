export default function MeetingDetalheHeader({ meeting, statusBadgeMeta, onBack }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3 sm:flex sm:items-start sm:justify-between sm:gap-3 sm:space-y-0">
      <div className="min-w-0 space-y-1">
        <p className="text-xs uppercase tracking-wide text-gray-500">Sessão</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 break-words">
            {meeting.studentName || 'Sessão sem nome'}
          </h1>
          {statusBadgeMeta && (
            <span className={statusBadgeMeta.className}>{statusBadgeMeta.text}</span>
          )}
        </div>
        <p className="text-sm text-gray-600">
          {meeting.scheduledDate} {meeting.scheduledTime && `às ${meeting.scheduledTime}`}
        </p>
        <p className="text-xs text-gray-500">
          ID: {meeting.id}
        </p>
      </div>
      <div className="flex sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Voltar para agenda
        </button>
      </div>
    </div>
  );
}
