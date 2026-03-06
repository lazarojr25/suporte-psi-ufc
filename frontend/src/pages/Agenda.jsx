import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

const dateKey = (date) => date.toISOString().slice(0, 10);

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeSolicitacaoStatus = (status) =>
  (status || '').toString().trim().toLowerCase();

const isSolicitacaoAgendada = (status) => {
  const normalized = normalizeSolicitacaoStatus(status);
  return normalized.includes('agend');
};

const isSolicitacaoPendente = (status) => {
  const normalized = normalizeSolicitacaoStatus(status);
  if (!normalized) return true;
  return normalized.includes('pend') || normalized === 'nova';
};

const shouldShowSolicitacaoInAgenda = (status) => {
  if (isSolicitacaoAgendada(status)) return false;
  return isSolicitacaoPendente(status);
};

export default function Agenda() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [meetings, setMeetings] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

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
    const ensureDay = (key) => {
      if (!map[key]) {
        map[key] = { meetings: [], solicitacoesPendentes: [] };
      }
      return map[key];
    };

    meetings.forEach((m) => {
      const key = m.scheduledDate || (m.dateTime && dateKey(new Date(m.dateTime)));
      if (!key) return;
      const day = ensureDay(key);
      day.meetings.push({
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
      if (!shouldShowSolicitacaoInAgenda(s.status)) return;
      const day = ensureDay(key);
      day.solicitacoesPendentes.push({
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

  const emptyDayEvents = { meetings: [], solicitacoesPendentes: [] };
  const selectedDayEvents = eventsByDay[selectedDate] || emptyDayEvents;
  const selectedEvents = [
    ...selectedDayEvents.meetings,
    ...selectedDayEvents.solicitacoesPendentes,
  ];

  const statusOptions = useMemo(() => {
    const set = new Set();
    meetings.forEach((m) => m.status && set.add(m.status));
    solicitacoes.forEach((s) => {
      if (!shouldShowSolicitacaoInAgenda(s.status)) return;
      if (s.status) set.add(s.status);
    });
    return ['all', ...Array.from(set)];
  }, [meetings, solicitacoes]);

  const filteredEvents = useMemo(() => {
    return selectedEvents.filter((evt) => {
      const matchType = typeFilter === 'all' || evt.type === typeFilter;
      const matchStatus = statusFilter === 'all' || evt.status === statusFilter;
      return matchType && matchStatus;
    });
  }, [selectedEvents, typeFilter, statusFilter]);

  useEffect(() => {
    if (filteredEvents.length > 0) {
      // Prioriza meetings
      const meeting = filteredEvents.find((e) => e.type === 'meeting');
      setSelectedEvent(meeting || filteredEvents[0]);
    } else {
      setSelectedEvent(null);
    }
  }, [filteredEvents]);

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
              const dayEvents = eventsByDay[key] || emptyDayEvents;
              const pendingCount = dayEvents.solicitacoesPendentes.length;
              const meetingsCount = dayEvents.meetings.length;
              const hasEvents = pendingCount + meetingsCount > 0;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`h-24 rounded-lg border flex flex-col items-start p-2 text-left transition ${
                    inMonth ? 'bg-white' : 'bg-gray-50'
                  } ${isToday ? 'border-blue-300 bg-blue-50' : ''} ${
                    selectedDate === key ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'
                  }`}
                >
                  <span
                    className={`text-sm font-semibold ${
                      inMonth ? 'text-gray-900' : 'text-gray-400'
                    } ${isToday ? 'text-blue-600' : ''}`}
                  >
                    {day.getDate()}
                  </span>
                  {hasEvents && (
                    <div className="mt-2 w-full flex flex-col gap-1">
                      {pendingCount > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold">
                          {pendingCount} solicitação{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {meetingsCount > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-800 text-[11px] font-semibold">
                          {meetingsCount} encontro{meetingsCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase text-gray-500">Dia selecionado</p>
              <p className="text-lg font-semibold text-gray-900">
                {selectedDate.split('-').reverse().join('/')}
              </p>
              <p className="text-xs text-gray-500">
                {selectedDayEvents.solicitacoesPendentes.length} solicitação
                {selectedDayEvents.solicitacoesPendentes.length === 1 ? '' : 's'} pendente
                {selectedDayEvents.solicitacoesPendentes.length === 1 ? '' : 's'} •{' '}
                {selectedDayEvents.meetings.length} encontro
                {selectedDayEvents.meetings.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border rounded-md px-2 py-1 text-xs w-full sm:w-auto"
              >
                <option value="all">Todos os tipos</option>
                <option value="meeting">Sessões</option>
                <option value="solicitacao">Solicitações</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-md px-2 py-1 text-xs w-full sm:w-auto"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'Todos os status' : status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum evento para esta data.
            </p>
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum evento corresponde aos filtros.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredEvents.map((evt) => (
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
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-gray-500">
                      Abra a sessão para registrar prontuário, notas e transcrição.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/meetings/${selectedEvent.id}`)}
                        className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        Abrir sessão
                      </button>
                      {selectedEvent.solicitacaoId && (
                        <button
                          type="button"
                          onClick={() => navigate(`/solicitacoes/${selectedEvent.solicitacaoId}`)}
                          className="px-3 py-2 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Ver solicitação vinculada
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-gray-500">
                      Abra a solicitação para revisar dados e registrar uma sessão.
                    </p>
                    {selectedEvent.status &&
                      selectedEvent.status
                        .toString()
                        .toLowerCase()
                        .includes('encontro agendado') && (
                        <p className="text-xs text-amber-700">
                          Esta solicitação já possui um encontro agendado.
                        </p>
                      )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/solicitacoes/${selectedEvent.id}`)}
                        className="px-3 py-2 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
                      >
                        Ver solicitação
                      </button>
                      {!(
                        selectedEvent.status &&
                        selectedEvent.status
                          .toString()
                          .toLowerCase()
                          .includes('encontro agendado')
                      ) && (
                        <button
                          type="button"
                          onClick={() => navigate(`/agendar-atendimento/${selectedEvent.id}`)}
                          className="px-3 py-2 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Agendar sessão
                        </button>
                      )}
                    </div>
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
