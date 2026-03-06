import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

const statusLabels = {
  agendada: 'Agendada',
  em_processamento: 'Processando',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const normalizeStatus = (status) =>
  status === 'processando' ? 'em_processamento' : status;

const badgeClass = (status) => {
  const normalized = normalizeStatus(status);
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';
  switch (normalized) {
    case 'concluida':
      return `${base} bg-green-100 text-green-800`;
    case 'em_processamento':
      return `${base} bg-amber-100 text-amber-800`;
    case 'agendada':
      return `${base} bg-blue-100 text-blue-800`;
    case 'cancelada':
      return `${base} bg-red-100 text-red-800`;
    default:
      return `${base} bg-gray-100 text-gray-700`;
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '---';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export default function Sessoes() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [query, setQuery] = useState('');

  const loadMeetings = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      const resp = await apiService.getMeetings(params);
      const list =
        resp?.data?.meetings ||
        resp?.meetings ||
        resp?.data ||
        [];
      setMeetings(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar as sessões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateFilter]);

  const filteredMeetings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meetings
      .filter((m) => {
        const statusNorm = normalizeStatus(m.status);
        if (!q) return true;
        const name = (m.studentName || '').toLowerCase();
        const email = (m.studentEmail || '').toLowerCase();
        const curso = (m.curso || '').toLowerCase();
        const matchStatus = statusFilter ? statusNorm === statusFilter : true;
        return matchStatus && (name.includes(q) || email.includes(q) || curso.includes(q));
      })
      .sort((a, b) => {
        const da = a.dateTime ? new Date(a.dateTime) : new Date(a.createdAt || 0);
        const db = b.dateTime ? new Date(b.dateTime) : new Date(b.createdAt || 0);
        return db - da;
      });
  }, [meetings, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-gray-500">Sessões</p>
          <h1 className="text-2xl font-bold text-gray-900">Lista de sessões</h1>
          <p className="text-sm text-gray-600">Filtre por status, data ou aluno e abra os detalhes.</p>
        </div>
        <button
          type="button"
          onClick={loadMeetings}
          className="px-3 py-2 text-sm font-semibold rounded-md border bg-white hover:bg-gray-50"
        >
          Atualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-[11px] text-gray-600 uppercase">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          >
            <option value="">Todos</option>
            <option value="agendada">Agendadas</option>
            <option value="em_processamento">Processando</option>
            <option value="concluida">Concluídas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </label>

        <label className="text-sm space-y-1">
          <span className="text-[11px] text-gray-600 uppercase">Data</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>

        <label className="text-sm space-y-1 md:col-span-2">
          <span className="text-[11px] text-gray-600 uppercase">Buscar por nome, email ou curso</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: Maria, @ufc.br, Psicologia"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="text-sm text-gray-700">
            {filteredMeetings.length} sessão(ões) encontrada(s)
          </p>
          {loading && <span className="text-xs text-gray-500">Carregando...</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
        <div className="divide-y">
            {filteredMeetings.map((m) => {
              const statusNorm = normalizeStatus(m.status);
              return (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/meetings/${m.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {m.studentName || 'Sessão'}
                  </p>
                  {statusNorm && <span className={badgeClass(statusNorm)}>{statusLabels[statusNorm] || statusNorm}</span>}
                </div>
                <p className="text-xs text-gray-600">
                  {m.scheduledDate || '---'} {m.scheduledTime ? `às ${m.scheduledTime}` : ''}
                  {m.dateTime ? ` • ${formatDate(m.dateTime)}` : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {m.studentEmail || '---'} {m.curso ? `• ${m.curso}` : ''}
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                Criada em: {formatDate(m.createdAt)}
              </div>
            </button>
            );
          })}

          {!loading && !filteredMeetings.length && (
            <div className="px-4 py-6 text-sm text-gray-600">Nenhuma sessão encontrada.</div>
          )}
        </div>
      </div>
    </div>
  );
}
