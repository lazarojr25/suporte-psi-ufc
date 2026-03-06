import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import apiService from '../../../services/api';
import { db } from '../../../services/firebase';
import {
  AGENDA_STATUS,
  buildCalendarErrorMessage,
  buildMeetingData,
  getAvailableDates,
  isLockedStatus,
} from '../utils/agendarAtendimentoUtils';

export default function useAgendarAtendimentoData() {
  const { solicitacaoId } = useParams();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [solicitacao, setSolicitacao] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isLocked = isLockedStatus(solicitacao?.status);
  const availableDates = useMemo(() => getAvailableDates(), []);

  useEffect(() => {
    const fetchSolicitacao = async () => {
      try {
        const docRef = doc(db, 'solicitacoesAtendimento', solicitacaoId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSolicitacao({ id: solicitacaoId, ...docSnap.data() });
        } else {
          setError('Solicitação não encontrada');
        }
      } catch (err) {
        console.error('Erro ao buscar solicitação:', err);
        setError('Erro ao carregar dados da solicitação');
      }
    };

    if (solicitacaoId) {
      fetchSolicitacao();
    }
  }, [solicitacaoId]);

  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!selectedDate) {
        setAvailableSlots([]);
        return;
      }

      try {
        const response = await apiService.getAvailableSlots(selectedDate);
        if (response.success) {
          setAvailableSlots(response.data.availableSlots);
        }
      } catch (err) {
        console.error('Erro ao buscar horários disponíveis:', err);
        setError('Erro ao carregar horários disponíveis');
      }
    };

    fetchAvailableSlots();
  }, [selectedDate]);

  const handleAgendamento = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedDate || !selectedTime) {
      setError('Por favor, selecione data e horário');
      return;
    }
    if (isLocked) {
      setError('Já existe um encontro agendado para esta solicitação.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.createMeeting(
        buildMeetingData({
          solicitacaoId,
          solicitacao,
          selectedDate,
          selectedTime,
          observacoes,
        }),
      );

      if (!response.success) {
        throw new Error(response.message || 'Erro ao agendar consulta');
      }

      const solicitacaoRef = doc(db, 'solicitacoesAtendimento', solicitacaoId);
      await updateDoc(solicitacaoRef, {
        status: AGENDA_STATUS.AGENDADO,
        updatedAt: serverTimestamp(),
      });

      const calendarMessage = buildCalendarErrorMessage(response);
      if (calendarMessage) {
        alert(calendarMessage);
      } else {
        alert('Consulta agendada com sucesso!');
      }

      navigate('/gerenciar-solicitacoes');
    } catch (err) {
      console.error('Erro ao agendar consulta:', err);
      setError(err.message || 'Erro ao agendar consulta');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (value) => {
    setSelectedDate(value);
    setSelectedTime('');
  };

  return {
    selectedDate,
    selectedTime,
    availableSlots,
    observacoes,
    solicitacao,
    loading,
    error,
    isLocked,
    availableDates,
    handleDateChange,
    setSelectedTime,
    setObservacoes,
    handleAgendamento,
    navigateBack: () => navigate('/gerenciar-solicitacoes'),
  };
}
