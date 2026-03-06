import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import apiService from '../services/api';

const formatDate = (value) => {
  if (!value) return '---';
  const d =
    typeof value.toDate === 'function'
      ? value.toDate()
      : new Date(value);
  return Number.isNaN(d.getTime())
    ? '---'
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export default function SolicitacaoDetalhe() {
  const { solicitacaoId } = useParams();
  const navigate = useNavigate();

  const [solicitacao, setSolicitacao] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const ref = doc(db, 'solicitacoesAtendimento', solicitacaoId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          throw new Error('Solicitação não encontrada.');
        }
        const data = snap.data();
        setSolicitacao({ id: snap.id, ...data });

        const meetingsResp = await apiService.getMeetings();
        const found =
          meetingsResp?.success &&
          Array.isArray(meetingsResp.data?.meetings)
            ? meetingsResp.data.meetings.find(
                (m) => m.solicitacaoId === solicitacaoId
              )
            : null;
        setMeeting(found || null);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Falha ao carregar solicitação.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [solicitacaoId]);

  const statusBadge = useMemo(() => {
    if (!solicitacao?.status) return null;
    const base =
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';
    const status = solicitacao.status.toString().toLowerCase();
    if (status.includes('pend')) {
      return <span className={`${base} bg-amber-100 text-amber-800`}>Pendente</span>;
    }
    if (status.includes('agend')) {
      return <span className={`${base} bg-blue-100 text-blue-800`}>Agendada</span>;
    }
    if (status.includes('concl')) {
      return <span className={`${base} bg-green-100 text-green-800`}>Concluída</span>;
    }
    return <span className={`${base} bg-gray-100 text-gray-700`}>{solicitacao.status}</span>;
  }, [solicitacao]);

  if (loading) return <div className="p-4">Carregando solicitação...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!solicitacao) return <div className="p-4">Solicitação não encontrada.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-gray-500">Solicitação</p>
          <h1 className="text-2xl font-bold text-gray-900">
            {solicitacao.name || solicitacao.studentName || 'Solicitação'}
          </h1>
          {statusBadge}
        </div>
        <button
          type="button"
          onClick={() => navigate('/agenda')}
          className="px-3 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
        >
          Voltar para agenda
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-2 text-sm">
        <p><strong>Matrícula:</strong> {solicitacao.studentId || '---'}</p>
        <p><strong>Email:</strong> {solicitacao.email || solicitacao.studentEmail || '---'}</p>
        <p><strong>Curso:</strong> {solicitacao.curso || '---'}</p>
        <p><strong>Motivação:</strong> {solicitacao.motivation || '---'}</p>
        <p><strong>Criada em:</strong> {formatDate(solicitacao.createdAt)}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <p className="text-xs uppercase text-gray-500">Ações</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/agendar-atendimento/${solicitacao.id}`)}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
          >
            Agendar sessão
          </button>
          <button
            type="button"
            onClick={() => navigate(`/discentes/${solicitacao.discenteId}`)}
            className="px-4 py-2 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
            disabled={!solicitacao.discenteId}
          >
            Ver discente
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <p className="text-xs uppercase text-gray-500">Meeting vinculado</p>
        {meeting ? (
          <div className="text-sm space-y-1">
            <p><strong>Data:</strong> {meeting.scheduledDate} {meeting.scheduledTime && `às ${meeting.scheduledTime}`}</p>
            <p><strong>Status:</strong> {meeting.status}</p>
            <button
              type="button"
              onClick={() => navigate(`/meetings/${meeting.id}`)}
              className="text-blue-600 text-xs font-semibold hover:underline"
            >
              Abrir sessão
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Nenhuma sessão criada para esta solicitação.</p>
        )}
      </div>
    </div>
  );
}
