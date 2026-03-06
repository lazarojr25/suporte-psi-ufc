import { useEffect, useMemo, useState } from 'react';

import apiService from '../../../services/api';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import {
  dateKey,
  parseDate,
  shouldShowSolicitacaoInAgenda,
} from '../utils/agendaUtils';

const buildEmptyDay = () => ({ meetings: [], solicitacoesPendentes: [] });

export default function useAgendaData() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [meetings, setMeetings] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

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

  useEffect(() => {
    loadData();
  }, []);

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
        map[key] = buildEmptyDay();
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

  const emptyDayEvents = buildEmptyDay();
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
      const meeting = filteredEvents.find((e) => e.type === 'meeting');
      setSelectedEvent(meeting || filteredEvents[0]);
    } else {
      setSelectedEvent(null);
    }
  }, [filteredEvents]);

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

  const changeMonth = (delta) => {
    const d = new Date(currentMonth);
    d.setMonth(currentMonth.getMonth() + delta);
    setCurrentMonth(d);
  };

  const selectDate = (date) => setSelectedDate(date);

  return {
    currentMonth,
    monthLabel,
    selectedDate,
    setCurrentMonth,
    selectDate,
    loading,
    error,
    selectedEvent,
    setSelectedEvent,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    calendarDays,
    eventsByDay,
    selectedDayEvents,
    selectedEvents,
    filteredEvents,
    statusOptions,
    upcomingMeetings,
    changeMonth,
    loadingMessage: 'Carregando agenda...',
  };
}
