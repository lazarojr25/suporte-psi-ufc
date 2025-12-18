import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';

export default function GerenciarSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchName, setSearchName] = useState('');
  const [searchMatricula, setSearchMatricula] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [curso, setCurso] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const fetchSolicitacoes = async () => {
      try {
        setLoading(true);
        setError(null);

        // Busca TODAS as solicitações, ordenadas da mais recente para a mais antiga
        const q = query(
          collection(db, 'solicitacoesAtendimento'),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);

        const solicitacoesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setSolicitacoes(solicitacoesData);
      } catch (err) {
        console.error('Erro ao buscar solicitações:', err);
        setError('Erro ao carregar solicitações de atendimento.');
      } finally {
        setLoading(false);
      }
    };

    fetchSolicitacoes();
  }, []);

  const formatDateTime = (createdAt) => {
    if (!createdAt) return '---';

    // Firestore Timestamp → Date
    const date =
      typeof createdAt.toDate === 'function'
        ? createdAt.toDate()
        : new Date(createdAt);

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const normalizeStatus = (statusRaw) => {
    if (!statusRaw) return 'pendente';
    const normalized = statusRaw
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized.includes('agend')) return 'agendada';
    if (normalized.includes('pend')) return 'pendente';
    if (normalized.includes('concl')) return 'concluida';
    return normalized;
  };

  const renderStatusBadge = (statusRaw) => {
    const status = normalizeStatus(statusRaw);

    let label = status.charAt(0).toUpperCase() + status.slice(1);
    let classes = '';

    if (status === 'pendente') {
      classes = 'bg-amber-50 text-amber-800 border border-amber-200';
    } else if (status === 'agendada') {
      classes = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    } else if (status === 'concluida') {
      classes = 'bg-blue-50 text-blue-800 border border-blue-200';
    } else {
      classes = 'bg-gray-50 text-gray-700 border border-gray-200';
    }

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}
      >
        {label}
      </span>
    );
  };

  // Separa por status
  const filteredSolicitacoes = useMemo(() => {
    const termName = searchName.trim().toLowerCase();
    const termMat = searchMatricula.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    return solicitacoes.filter((s) => {
      const created = toDate(s.createdAt);
      if (start && (!created || created < start)) return false;
      if (end && (!created || created > end)) return false;

      const nameMatch = termName
        ? (s.name || s.studentName || '').toLowerCase().includes(termName)
        : true;
      const matMatch = termMat
        ? (s.studentId || '').toLowerCase().includes(termMat)
        : true;
      const cursoMatch = curso
        ? (s.curso || '').toLowerCase() === curso.toLowerCase()
        : true;
      return nameMatch && matMatch && cursoMatch;
    });
  }, [solicitacoes, searchName, searchMatricula, startDate, endDate, curso]);

  const pendentes = filteredSolicitacoes.filter(
    (s) => normalizeStatus(s.status) === 'pendente'
  );
  const agendadas = filteredSolicitacoes.filter(
    (s) => normalizeStatus(s.status) === 'agendada'
  );

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-6xl mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold">Gerenciar Solicitações</h2>
            <p className="text-sm text-gray-600">
              Visualize as solicitações pendentes e já agendadas.
            </p>
          </div>

          <div className="text-sm text-gray-700 flex flex-wrap gap-3">
            <span>
              Pendentes:{' '}
              <strong className="text-amber-700">{pendentes.length}</strong>
            </span>
            <span>
              Agendadas:{' '}
              <strong className="text-emerald-700">{agendadas.length}</strong>
            </span>
            <span>
              Total filtrado:{' '}
              <strong className="text-gray-900">{filteredSolicitacoes.length}</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-sm">
          <div className="md:col-span-2">
            <label className="block text-xs uppercase text-gray-600 mb-1">
              Nome
            </label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Buscar por nome"
                className="w-full border rounded-lg px-3 py-2"
              />
          </div>
          <div>
            <label className="block text-xs uppercase text-gray-600 mb-1">
              Matrícula
            </label>
            <input
              type="text"
              value={searchMatricula}
              onChange={(e) => setSearchMatricula(e.target.value)}
              placeholder="Buscar por matrícula"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-gray-600 mb-1">
              Curso
            </label>
            <input
              type="text"
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              placeholder="Curso ex: Engenharia de Software"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-gray-600 mb-1">
              Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-gray-600 mb-1">
              Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {loading && (
          <p className="text-sm text-gray-500">Carregando solicitações...</p>
        )}

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        {!loading && !error && filteredSolicitacoes.length === 0 && (
          <p className="text-sm text-gray-500">
            Nenhuma solicitação encontrada com os filtros atuais.
          </p>
        )}

        {/* Lista de pendentes */}
        {pendentes.length > 0 && (
          <section className="mt-4">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              Solicitações pendentes
              <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                {pendentes.length}
              </span>
            </h3>

            <ul className="space-y-3">
              {pendentes.map((solicitacao) => (
                <li
                  key={solicitacao.id}
                  className="border rounded-lg p-4 bg-amber-50/40 flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {solicitacao.name || 'Aluno sem nome'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Matrícula: <strong>{solicitacao.studentId || '---'}</strong>
                        {solicitacao.curso && (
                          <>
                            {' · '}Curso:{' '}
                            <strong>{solicitacao.curso}</strong>
                          </>
                        )}
                      </p>
                    </div>
                    <div>{renderStatusBadge(solicitacao.status)}</div>
                  </div>

                  <div className="text-sm text-gray-800">
                    <p className="font-medium">Motivo da solicitação</p>
                    <p className="text-gray-700">
                      {solicitacao.motivation || '---'}
                    </p>
                  </div>

                  <p className="text-xs text-gray-500">
                    Criada em: {formatDateTime(solicitacao.createdAt)}
                  </p>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() =>
                        navigate(`/discentes/${solicitacao.discenteId}`)
                      }
                      disabled={!solicitacao.discenteId}
                      className={`
                        px-3 py-1.5 text-xs font-medium rounded-md
                        text-white bg-blue-600 
                        hover:bg-blue-700 
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition
                      `}
                    >
                      Ver detalhes do discente
                    </button>

                    <Link
                      to={`/agendar-atendimento/${solicitacao.id}`}
                      className="
                        px-3 py-1.5 text-xs font-medium rounded-md
                        text-blue-600 border border-blue-600
                        hover:bg-blue-50
                        transition
                      "
                    >
                      Agendar sessão
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Lista de agendadas */}
        {agendadas.length > 0 && (
          <section className="mt-8">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              Solicitações com sessão agendada
              <span className="text-xs bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5">
                {agendadas.length}
              </span>
            </h3>

            <ul className="space-y-3">
              {agendadas.map((solicitacao) => (
                <li
                  key={solicitacao.id}
                  className="border rounded-lg p-4 bg-emerald-50/40 flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {solicitacao.name || 'Aluno sem nome'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Matrícula: <strong>{solicitacao.studentId || '---'}</strong>
                        {solicitacao.curso && (
                          <>
                            {' · '}Curso:{' '}
                            <strong>{solicitacao.curso}</strong>
                          </>
                        )}
                      </p>
                    </div>
                    <div>{renderStatusBadge(solicitacao.status)}</div>
                  </div>

                  <div className="text-sm text-gray-800">
                    <p className="font-medium">Motivo da solicitação</p>
                    <p className="text-gray-700">
                      {solicitacao.motivation || '---'}
                    </p>
                  </div>

                  <p className="text-xs text-gray-500">
                    Criada em: {formatDateTime(solicitacao.createdAt)}
                  </p>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() =>
                        navigate(`/discentes/${solicitacao.discenteId}`)
                      }
                      disabled={!solicitacao.discenteId}
                      className={`
                        px-3 py-1.5 text-xs font-medium rounded-md
                        text-white bg-blue-600 
                        hover:bg-blue-700 
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition
                      `}
                    >
                      Ver detalhes do discente
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
