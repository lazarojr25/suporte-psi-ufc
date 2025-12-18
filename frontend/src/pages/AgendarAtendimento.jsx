import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import apiService from '../services/api';

export default function AgendarAtendimento() {
  const { solicitacaoId } = useParams();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [solicitacao, setSolicitacao] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isLocked =
    solicitacao?.status &&
    solicitacao.status.toString().toLowerCase() === 'encontro agendado';
  const navigate = useNavigate();

  // Recupera as informações da solicitação do Firebase
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

  // Busca horários disponíveis quando uma data é selecionada
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (selectedDate) {
        try {
          const response = await apiService.getAvailableSlots(selectedDate);
          if (response.success) {
            setAvailableSlots(response.data.availableSlots);
          }
        } catch (err) {
          console.error('Erro ao buscar horários disponíveis:', err);
          setError('Erro ao carregar horários disponíveis');
        }
      }
    };

    fetchAvailableSlots();
  }, [selectedDate]);

  // Função para agendar a consulta
  const handleAgendamento = async (e) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime) {
      setError('Por favor, selecione data e horário');
      return;
    }
    if (isLocked) {
      setError('Já existe um encontro agendado para esta solicitação.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Criar reunião no backend Node.js
      const meetingData = {
        solicitacaoId: solicitacaoId,
        studentName: solicitacao.name,
        studentEmail: solicitacao.email,
        discenteId: solicitacao.discenteId || null,
        curso: solicitacao.curso || null,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        duration: 45, // padrão de sessão: 45 minutos
        notes: observacoes
      };

      const response = await apiService.createMeeting(meetingData);
      
      if (!response.success) {
        throw new Error(response.message || 'Erro ao agendar consulta');
      }

      // Atualiza status da solicitação no Firestore
      const solicitacaoRef = doc(db, 'solicitacoesAtendimento', solicitacaoId);
      await updateDoc(solicitacaoRef, {
        status: 'encontro agendado',
        updatedAt: serverTimestamp() // opcional, pra ter histórico
      });

      alert('Consulta agendada com sucesso!');
      navigate('/gerenciar-solicitacoes');
    } catch (err) {
      console.error('Erro ao agendar consulta:', err);
      setError(err.message || 'Erro ao agendar consulta');
    } finally {
      setLoading(false);
    }
  };

  // Gerar datas disponíveis (próximos 30 dias, apenas dias úteis)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Apenas dias úteis (segunda a sexta)
      if (date.getDay() >= 1 && date.getDay() <= 5) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    
    return dates;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md w-full max-w-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Agendar Atendimento</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {solicitacao ? (
          <>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p><strong>Aluno:</strong> {solicitacao.name}</p>
              <p><strong>Email:</strong> {solicitacao.email}</p>
              <p><strong>Matrícula:</strong> {solicitacao.studentId}</p>
              <p><strong>Motivo:</strong> {solicitacao.motivation}</p>
              {isLocked && (
                <p className="text-sm text-amber-700 mt-2">
                  Já existe um encontro agendado para esta solicitação. Não é possível agendar outro.
                </p>
              )}
            </div>

            <form onSubmit={handleAgendamento}>
              <label className="block mb-4">
                <span className="text-sm font-medium text-gray-700">Data do Atendimento</span>
                <select
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedTime(''); // Reset time when date changes
                  }}
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                  required
                >
                  <option value="">Selecione uma data</option>
                  {getAvailableDates().map(date => (
                    <option key={date} value={date}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </option>
                  ))}
                </select>
              </label>

              {selectedDate && (
                <label className="block mb-4">
                  <span className="text-sm font-medium text-gray-700">Horário do Atendimento</span>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                    required
                  >
                    <option value="">Selecione um horário</option>
                    {availableSlots.map(time => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                  {availableSlots.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Nenhum horário disponível para esta data
                    </p>
                  )}
                </label>
              )}

              <label className="block mb-4">
                <span className="text-sm font-medium text-gray-700">Observações</span>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={4}
                  placeholder="Observações sobre o atendimento (opcional)"
                  className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring"
                />
              </label>

              <button
                type="submit"
                disabled={loading || !selectedDate || !selectedTime || isLocked}
                className="w-full py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Agendando...' : 'Agendar Consulta'}
              </button>
            </form>

            <div className="mt-4">
              <button
                onClick={() => navigate('/gerenciar-solicitacoes')}
                className="w-full py-2 rounded-xl bg-gray-600 text-white font-semibold hover:bg-gray-700"
              >
                Voltar para Solicitações
              </button>
            </div>
          </>
        ) : (
          <p>Carregando dados da solicitação...</p>
        )}
      </div>
    </div>
  );
}
