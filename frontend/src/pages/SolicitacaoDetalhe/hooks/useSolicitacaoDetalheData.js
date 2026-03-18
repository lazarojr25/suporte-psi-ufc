import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import apiService from '../../../services/api';
import { statusBadgeConfig } from '../utils/solicitacaoDetalheUtils';

export default function useSolicitacaoDetalheData() {
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
          meetingsResp?.success && Array.isArray(meetingsResp.data?.meetings)
            ? meetingsResp.data.meetings.find((m) => m.solicitacaoId === solicitacaoId)
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

  const statusBadge = useMemo(
    () => statusBadgeConfig(solicitacao?.status),
    [solicitacao?.status],
  );

  const title = solicitacao?.name || solicitacao?.studentName || 'Solicitação';
  const canSchedule = useMemo(() => {
    const status = (solicitacao?.status || '').toString().toLowerCase();
    return !status.includes('agend');
  }, [solicitacao?.status]);

  return {
    solicitacao,
    meeting,
    loading,
    error,
    statusBadge,
    title,
    canSchedule,
    navigateToAgenda: () => navigate('/agenda'),
    navigateToAgendar: () => navigate(`/agendar-atendimento/${solicitacaoId}`),
    navigateToDiscente: () => navigate(`/discentes/${solicitacao.discenteId}`),
    navigateToMeeting: () => navigate(`/meetings/${meeting?.id}`),
  };
}
