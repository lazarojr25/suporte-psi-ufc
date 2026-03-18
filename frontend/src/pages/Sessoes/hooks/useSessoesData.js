import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../../services/api';
import { normalizeStatus } from '../utils/sessoesUtils';

export default function useSessoesData() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [query, setQuery] = useState('');

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      const resp = await apiService.getMeetings(params);
      const list = resp?.data?.meetings || resp?.meetings || resp?.data || [];
      setMeetings(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar as sessões.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const filteredMeetings = useMemo(() => {
    const q = query.trim().toLowerCase();

    return meetings
      .filter((meeting) => {
        const statusNorm = normalizeStatus(meeting.status);
        if (!q) return true;

        const matchStatus = statusFilter ? statusNorm === statusFilter : true;
        const name = (meeting.studentName || '').toLowerCase();
        const email = (meeting.studentEmail || '').toLowerCase();
        const curso = (meeting.curso || '').toLowerCase();

        return matchStatus && (name.includes(q) || email.includes(q) || curso.includes(q));
      })
      .sort((a, b) => {
        const da = a.dateTime ? new Date(a.dateTime) : new Date(a.createdAt || 0);
        const db = b.dateTime ? new Date(b.dateTime) : new Date(b.createdAt || 0);
        return db - da;
      });
  }, [meetings, query, statusFilter]);

  const summary = useMemo(() => {
    const totals = {
      total: filteredMeetings.length,
      agendada: 0,
      emProcessamento: 0,
      concluida: 0,
      cancelada: 0,
      erroTranscricao: 0,
    };

    filteredMeetings.forEach((meeting) => {
      const status = normalizeStatus(meeting.status);
      if (status === 'agendada') totals.agendada += 1;
      else if (status === 'em_processamento') totals.emProcessamento += 1;
      else if (status === 'concluida') totals.concluida += 1;
      else if (status === 'cancelada') totals.cancelada += 1;
      else if (status === 'erro_transcricao') totals.erroTranscricao += 1;
    });

    return totals;
  }, [filteredMeetings]);

  return {
    meetings,
    loading,
    error,
    statusFilter,
    dateFilter,
    query,
    filteredMeetings,
    summary,
    setStatusFilter,
    setDateFilter,
    setQuery,
    loadMeetings,
    openMeeting: (id) => navigate(`/meetings/${id}`),
  };
}
