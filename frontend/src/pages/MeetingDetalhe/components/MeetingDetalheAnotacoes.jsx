import { formatDateLabel } from '../utils/meetingDetalheUtils';

export default function MeetingDetalheAnotacoes({
  meeting,
  informalNotes,
  onInformalNotesChange,
  onSave,
  saving,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase text-gray-500">Anotações informais</p>
        {meeting.informalNotes && (
          <span className="text-[11px] text-gray-500">
            Última atualização: {formatDateLabel(meeting.updatedAt || meeting.createdAt)}
          </span>
        )}
      </div>
      <textarea
        value={informalNotes}
        onChange={(e) => onInformalNotesChange(e.target.value)}
        rows={3}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
        placeholder="Notas rápidas desta sessão."
      />
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="px-4 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
      >
        {saving ? 'Salvando...' : 'Salvar anotações'}
      </button>
    </div>
  );
}
