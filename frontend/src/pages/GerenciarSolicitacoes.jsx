import React, { useState, useEffect } from 'react';
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

  const renderStatusBadge = (statusRaw) => {
    const status = statusRaw || 'Pendente';

    let label = status;
    let classes = '';

    if (status === 'Pendente') {
      label = 'Pendente';
      classes = 'bg-amber-50 text-amber-800 border border-amber-200';
    } else if (status === 'Agendada') {
      label = 'Agendada';
      classes = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
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
  const pendentes = solicitacoes.filter(
    (s) => (s.status || 'Pendente') === 'Pendente'
  );
  const agendadas = solicitacoes.filter((s) => s.status === 'Agendada');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-5xl p-6">
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
              Total:{' '}
              <strong className="text-gray-900">{solicitacoes.length}</strong>
            </span>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-gray-500">Carregando solicitações...</p>
        )}

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        {!loading && !error && solicitacoes.length === 0 && (
          <p className="text-sm text-gray-500">
            Não há solicitações cadastradas no momento.
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
