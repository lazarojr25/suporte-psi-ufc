import { useEffect, useMemo, useRef, useState } from 'react';
import apiService from '../services/api';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

const dateKey = (date) => date.toISOString().slice(0, 10);

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export default function Agenda() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [meetings, setMeetings] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(null);
  const [noteSuccess, setNoteSuccess] = useState(null);
  const lastNoteEventIdRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [meetingsResp, solicitacoesSnap] = await Promise.all([
        apiService.getMeetings(),
        getDocs(collection(db, 'solicitacoesAtendimento')),
      ]);

      if (meetingsResp?.success && meetingsResp.data?.meetings) {
        setMeetings(meetingsResp.data.meetings);
      } else {
        setMeetings([]);
      }

      const solicitacoesList = solicitacoesSnap.docs.map((doc) => {
        const data = doc.data();
        const createdAt =
          typeof data.createdAt?.toDate === 'function'
            ? data.createdAt.toDate()
            : parseDate(data.createdAt);
        return {
          id: doc.id,
          ...data,
          createdAt,
        };
      });
      setSolicitacoes(solicitacoesList);
    } catch (err) {
      console.error(err);
      setError('Falha ao carregar agenda.');
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = currentMonth.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const calendarDays = useMemo(() => {
    const days = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0 domingo
    const startDate = new Date(year, month, 1 - startOffset);
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = {};

    meetings.forEach((m) => {
      const key = m.scheduledDate || (m.dateTime && dateKey(new Date(m.dateTime)));
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push({
        type: 'meeting',
        id: m.id,
        title: m.studentName || 'Sessão',
        time: m.scheduledTime || '',
        status: m.status,
        studentName: m.studentName,
        discenteId: m.discenteId,
        studentEmail: m.studentEmail,
        curso: m.curso,
        solicitacaoId: m.solicitacaoId,
        scheduledDate: m.scheduledDate,
        raw: m,
      });
    });

    solicitacoes.forEach((s) => {
      const key = s.createdAt ? dateKey(s.createdAt) : null;
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push({
        type: 'solicitacao',
        id: s.id,
        title: s.motivation || 'Solicitação',
        time: '',
        status: s.status || 'pendente',
        studentName: s.nome || s.studentName,
        curso: s.curso,
        raw: s,
      });
    });

    return map;
  }, [meetings, solicitacoes]);

  const selectedEvents = eventsByDay[selectedDate] || [];

  useEffect(() => {
    if (selectedEvents.length > 0) {
      // Prioriza meetings
      const meeting = selectedEvents.find((e) => e.type === 'meeting');
      setSelectedEvent(meeting || selectedEvents[0]);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedDate, selectedEvents]);

  useEffect(() => {
    const currentId =
      selectedEvent && selectedEvent.type === 'meeting' ? selectedEvent.id : null;

    if (selectedEvent?.type === 'meeting') {
      const raw = selectedEvent.raw || {};
      setNoteText(raw.informalNotes || raw.completionNotes || raw.notes || '');
    } else {
      setNoteText('');
    }
    setNoteError(null);
    if (lastNoteEventIdRef.current !== currentId) {
      setNoteSuccess(null);
    }
    lastNoteEventIdRef.current = currentId;
  }, [selectedEvent]);

  const changeMonth = (delta) => {
    const d = new Date(currentMonth);
    d.setMonth(currentMonth.getMonth() + delta);
    setCurrentMonth(d);
  };

  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    return meetings
      .map((m) => {
        const d = parseDate(m.dateTime) || parseDate(m.scheduledDate);
        return { ...m, _dateObj: d };
      })
      .filter((m) => m._dateObj && m.status !== 'cancelada' && m._dateObj >= now)
      .sort((a, b) => a._dateObj - b._dateObj)
      .slice(0, 5);
  }, [meetings]);

  const handleUpload = async () => {
    if (!selectedEvent || selectedEvent.type !== 'meeting' || !selectedFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const meeting = selectedEvent.raw || {};
      const sessionDate =
        meeting.scheduledDate ||
        (meeting.dateTime ? new Date(meeting.dateTime).toISOString().slice(0, 10) : null) ||
        new Date().toISOString().slice(0, 10);

      await apiService.uploadMedia(selectedFile, {
        meetingId: meeting.id,
        solicitacaoId: meeting.solicitacaoId || '',
        discenteId: meeting.discenteId || '',
        studentName: meeting.studentName || '',
        studentEmail: meeting.studentEmail || '',
        studentId: meeting.studentId || '',
        curso: meeting.curso || '',
        sessionDate,
      });

      try {
        await apiService.updateMeeting(meeting.id, { status: 'concluida' });
      } catch (e) {
        console.warn('Falha ao atualizar status do meeting:', e);
      }

      setUploadSuccess('Transcrição enviada e sessão concluída.');
      setSelectedFile(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setUploadError('Não foi possível enviar a transcrição.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveInformalNotes = async () => {
    if (!selectedEvent || selectedEvent.type !== 'meeting') return;
    setSavingNote(true);
    setNoteError(null);
    setNoteSuccess(null);
    try {
      await apiService.updateMeeting(selectedEvent.id, { informalNotes: noteText });
      setNoteSuccess('Prontuário salvo.');
      await loadData();
    } catch (err) {
      console.error(err);
      setNoteError('Não foi possível salvar as anotações.');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-gray-500">Agenda</p>
          <h1 className="text-2xl font-bold text-gray-900">
            Solicitações e agendamentos
          </h1>
          <p className="text-sm text-gray-500">
            Visualize solicitações e sessões agendadas no calendário.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="px-3 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
          >
            ← Mês anterior
          </button>
          <span className="text-sm font-semibold text-gray-800">
            {monthLabel}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="px-3 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
          >
            Próximo mês →
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Carregando agenda...</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4 xl:col-span-2">
          <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-gray-600 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="text-center py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const inMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = key === dateKey(new Date());
              const hasEvents = (eventsByDay[key] || []).length > 0;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`h-24 rounded-lg border flex flex-col items-start p-2 text-left transition ${
                    inMonth ? 'bg-white' : 'bg-gray-50'
                  } ${selectedDate === key ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'}`}
                >
                  <span
                    className={`text-sm font-semibold ${
                      inMonth ? 'text-gray-900' : 'text-gray-400'
                    } ${isToday ? 'text-blue-600' : ''}`}
                  >
                    {day.getDate()}
                  </span>
                  {hasEvents && (
                    <div className="mt-2 w-full">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                        {(eventsByDay[key] || []).length} eventos
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase text-gray-500">Dia selecionado</p>
              <p className="text-lg font-semibold text-gray-900">
                {selectedDate.split('-').reverse().join('/')}
              </p>
              <p className="text-xs text-gray-500">
                {(eventsByDay[selectedDate] || []).length} eventos
              </p>
            </div>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum evento para esta data.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
              {selectedEvents.map((evt) => (
                <div
                  key={`${evt.type}-${evt.id}`}
                  className={`border rounded-lg p-3 bg-gray-50 flex flex-col gap-1 cursor-pointer ${selectedEvent?.id === evt.id ? 'ring-2 ring-blue-200 border-blue-400' : ''}`}
                  onClick={() => setSelectedEvent(evt)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${
                        evt.type === 'meeting'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {evt.type === 'meeting' ? 'Sessão' : 'Solicitação'}
                    </span>
                    {evt.time && (
                      <span className="text-[11px] text-gray-600">
                        {evt.time}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800 font-medium">{evt.title}</p>
                  {evt.status && (
                    <p className="text-[11px] text-gray-500">Status: {evt.status}</p>
                  )}
                  {evt.studentName && (
                    <p className="text-[11px] text-gray-500">
                      Discente: {evt.studentName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t">
            <p className="text-xs uppercase text-gray-500 mb-2">Detalhes</p>
            {!selectedEvent ? (
              <p className="text-sm text-gray-500">Selecione um evento.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-gray-800">
                  {selectedEvent.title}
                </p>
                <p className="text-xs text-gray-500">
                  Tipo: {selectedEvent.type === 'meeting' ? 'Sessão' : 'Solicitação'}{' '}
                  {selectedEvent.time && `• ${selectedEvent.time}`}
                </p>
                {selectedEvent.studentName && (
                  <p className="text-xs text-gray-500">
                    Discente: {selectedEvent.studentName}
                  </p>
                )}
                {selectedEvent.curso && (
                  <p className="text-xs text-gray-500">Curso: {selectedEvent.curso}</p>
                )}
                {selectedEvent.status && (
                  <p className="text-xs text-gray-500">
                    Status: {selectedEvent.status}
                  </p>
                )}

                {selectedEvent.type === 'meeting' ? (
                  <div className="mt-3 space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs uppercase text-gray-500">Prontuário informal</p>
                      {noteError && (
                        <p className="text-xs text-red-600">{noteError}</p>
                      )}
                      {noteSuccess && (
                        <p className="text-xs text-green-600">{noteSuccess}</p>
                      )}
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={4}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
                        placeholder="Registre impressões ou encaminhamentos desta sessão. Fica visível apenas aqui."
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleSaveInformalNotes}
                          disabled={savingNote}
                          className="px-3 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {savingNote ? 'Salvando...' : 'Salvar anotações'}
                        </button>
                        <p className="text-[11px] text-gray-500 sm:text-right">
                          Campo opcional para notas rápidas, sem alertas ou envios.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 border-t pt-3">
                      <p className="text-xs uppercase text-gray-500">
                        Enviar transcrição desta sessão
                      </p>
                      {uploadError && (
                        <p className="text-xs text-red-600">{uploadError}</p>
                      )}
                      {uploadSuccess && (
                        <p className="text-xs text-green-600">{uploadSuccess}</p>
                      )}
                      <input
                        type="file"
                        accept="audio/*,video/*"
                        onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                        className="text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading || !selectedFile}
                        className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                      >
                        {uploading ? 'Enviando...' : 'Enviar transcrição e concluir sessão'}
                      </button>
                      <p className="text-[11px] text-gray-500">
                        O arquivo será vinculado ao meeting e o status será marcado como concluído.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500">
                      Solicitação pendente ou sem sessão vinculada. Agende uma reunião para habilitar o envio de transcrição.
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Use o fluxo de agendamento para criar um meeting e, em seguida, selecione-o aqui para anexar a transcrição.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 border-t text-sm">
            <p className="text-xs uppercase text-gray-500 mb-2">
              Próximas sessões
            </p>
            {upcomingMeetings.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma sessão futura.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingMeetings.map((m) => (
                  <li key={m.id} className="border rounded-lg p-2 bg-white">
                    <p className="font-semibold text-gray-800">
                      {m.studentName || 'Sessão'}
                    </p>
                    <p className="text-xs text-gray-600">
                      {m.scheduledDate}{' '}
                      {m.scheduledTime && `às ${m.scheduledTime}`}
                    </p>
                    <p className="text-[11px] text-gray-500">Status: {m.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
