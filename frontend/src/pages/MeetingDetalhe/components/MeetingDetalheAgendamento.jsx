export default function MeetingDetalheAgendamento({
  scheduleDate,
  scheduleTime,
  scheduleDuration,
  onScheduleDateChange,
  onScheduleTimeChange,
  onScheduleDurationChange,
  onReschedule,
  onCancelMeeting,
  scheduleSaving,
  scheduleMsg,
  scheduleErr,
  scheduleWarn,
  meetingLink,
  isEditable,
  containerClassName = '',
}) {
  if (!isEditable) return null;

  return (
    <div className={`bg-white rounded-xl shadow p-4 space-y-3 ${containerClassName}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase text-gray-500">Agendamento</p>
        {scheduleMsg && <span className="text-[11px] text-green-600">{scheduleMsg}</span>}
        {scheduleErr && <span className="text-[11px] text-red-600">{scheduleErr}</span>}
      </div>
      {scheduleWarn && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          {scheduleWarn}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-[11px] text-gray-600 uppercase">Data</span>
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => onScheduleDateChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-[11px] text-gray-600 uppercase">Hora</span>
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => onScheduleTimeChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-[11px] text-gray-600 uppercase">Duração (min)</span>
          <input
            type="number"
            min={15}
            step={5}
            value={scheduleDuration}
            onChange={(e) => onScheduleDurationChange(Number(e.target.value))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReschedule}
          disabled={scheduleSaving || !scheduleDate || !scheduleTime}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {scheduleSaving ? 'Salvando...' : 'reagendar'}
        </button>
        <button
          type="button"
          onClick={onCancelMeeting}
          disabled={scheduleSaving}
          className="px-4 py-2 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60"
        >
          {scheduleSaving ? 'Processando...' : 'Cancelar sessão'}
        </button>
        {meetingLink && (
          <a
            href={meetingLink}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Abrir link da sessão
          </a>
        )}
      </div>
    </div>
  );
}
