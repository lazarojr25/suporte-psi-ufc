import { useEffect, useMemo, useState } from 'react';
import apiService from '../../../services/api';
import { formatSelectedDateLabel, isDateOnOrAfterToday } from '../utils/agendaUtils';

const MAX_GROUP_MEMBERS = 15;

export default function AgendaScheduleModal({
  open,
  selectedDate,
  discentes = [],
  pendingSolicitacoes = [],
  onClose,
  onSchedule,
}) {
  const [sessionType, setSessionType] = useState('individual');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(45);
  const [notes, setNotes] = useState('');
  const [selectedSolicitacaoId, setSelectedSolicitacaoId] = useState('');
  const [selectedDiscenteId, setSelectedDiscenteId] = useState('');
  const [groupTheme, setGroupTheme] = useState('');
  const [groupParticipantIds, setGroupParticipantIds] = useState([]);
  const [query, setQuery] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const selectedSolicitacao = useMemo(
    () => pendingSolicitacoes.find((item) => item.id === selectedSolicitacaoId) || null,
    [pendingSolicitacoes, selectedSolicitacaoId],
  );

  const selectedDiscente = useMemo(
    () => discentes.find((item) => item.id === selectedDiscenteId) || null,
    [discentes, selectedDiscenteId],
  );

  const filteredDiscentes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return discentes;
    return discentes.filter((discente) => {
      const name = (discente.name || '').toLowerCase();
      const email = (discente.email || '').toLowerCase();
      const studentId = (discente.studentId || '').toLowerCase();
      return name.includes(term) || email.includes(term) || studentId.includes(term);
    });
  }, [discentes, query]);

  const selectedGroupParticipants = useMemo(
    () => discentes.filter((discente) => groupParticipantIds.includes(discente.id)),
    [discentes, groupParticipantIds],
  );

  useEffect(() => {
    if (!open || !selectedDate) return;
    if (!isDateOnOrAfterToday(selectedDate)) {
      setAvailableSlots([]);
      return;
    }

    const loadSlots = async () => {
      setLoadingSlots(true);
      setError(null);
      try {
        const response = await apiService.getAvailableSlots(selectedDate);
        if (response?.success && response?.data?.availableSlots) {
          setAvailableSlots(response.data.availableSlots);
        } else {
          setAvailableSlots([]);
        }
      } catch (err) {
        console.error(err);
        setAvailableSlots([]);
        setError('Não foi possível carregar horários para a data selecionada.');
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSessionType('individual');
    setSelectedTime('');
    setDuration(45);
    setNotes('');
    setSelectedSolicitacaoId('');
    setSelectedDiscenteId('');
    setGroupTheme('');
    setGroupParticipantIds([]);
    setQuery('');
  }, [open, selectedDate]);

  useEffect(() => {
    if (!selectedSolicitacao?.discenteId) return;
    setSelectedDiscenteId((current) => current || selectedSolicitacao.discenteId);
  }, [selectedSolicitacao]);

  if (!open) return null;

  const handleToggleParticipant = (discenteId) => {
    setGroupParticipantIds((current) => {
      if (current.includes(discenteId)) {
        return current.filter((id) => id !== discenteId);
      }
      if (current.length >= MAX_GROUP_MEMBERS) {
        setError(`A sessão em grupo permite no máximo ${MAX_GROUP_MEMBERS} integrantes.`);
        return current;
      }
      return [...current, discenteId];
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!selectedDate || !isDateOnOrAfterToday(selectedDate)) {
      setError('Só é permitido agendar para hoje ou datas futuras.');
      return;
    }

    if (!selectedTime) {
      setError('Selecione um horário.');
      return;
    }

    let payload = {
      sessionType,
      scheduledDate: selectedDate,
      scheduledTime: selectedTime,
      duration: Number(duration) || 45,
      notes,
    };

    if (sessionType === 'grupo') {
      if (!groupTheme.trim()) {
        setError('Informe um tema para a sessão em grupo.');
        return;
      }
      if (!selectedGroupParticipants.length) {
        setError('Selecione ao menos um integrante para a sessão em grupo.');
        return;
      }
      if (selectedGroupParticipants.length > MAX_GROUP_MEMBERS) {
        setError(`A sessão em grupo permite no máximo ${MAX_GROUP_MEMBERS} integrantes.`);
        return;
      }

      payload = {
        ...payload,
        groupTheme: groupTheme.trim(),
        studentName: groupTheme.trim(),
        participants: selectedGroupParticipants.map((item) => ({
          discenteId: item.id,
          name: item.name || '',
          email: item.email || '',
          studentId: item.studentId || '',
          curso: item.curso || item.cursoNome || item.cursoSigla || '',
        })),
      };
    } else {
      const fallbackDiscente = selectedDiscente;
      const resolvedName = selectedSolicitacao?.name || fallbackDiscente?.name || '';
      const resolvedEmail = selectedSolicitacao?.email || fallbackDiscente?.email || '';
      const resolvedDiscenteId = selectedSolicitacao?.discenteId || fallbackDiscente?.id || null;
      const resolvedCourse = selectedSolicitacao?.curso || fallbackDiscente?.curso || fallbackDiscente?.cursoNome || null;

      if (!resolvedName) {
        setError('Selecione uma solicitação pendente ou um discente para agendar.');
        return;
      }

      payload = {
        ...payload,
        solicitacaoId: selectedSolicitacao?.id || null,
        studentName: resolvedName,
        studentEmail: resolvedEmail || null,
        discenteId: resolvedDiscenteId,
        curso: resolvedCourse,
        participants: [
          {
            discenteId: resolvedDiscenteId,
            name: resolvedName,
            email: resolvedEmail || null,
            studentId: fallbackDiscente?.studentId || null,
            curso: resolvedCourse,
          },
        ],
      };
    }

    setSubmitting(true);
    try {
      await onSchedule(payload);
      onClose();
      setSelectedTime('');
      setSelectedSolicitacaoId('');
      setSelectedDiscenteId('');
      setGroupTheme('');
      setGroupParticipantIds([]);
      setNotes('');
      setQuery('');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Não foi possível concluir o agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 px-3 py-4 sm:p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-xl">
        <div className="p-4 sm:p-5 border-b flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Novo agendamento</p>
            <h2 className="text-xl font-semibold text-gray-900">
              Agendar sessão em {formatSelectedDateLabel(selectedDate)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {!isDateOnOrAfterToday(selectedDate) && (
            <p className="text-sm text-red-600">
              Só é permitido agendar para hoje ou datas futuras.
            </p>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700 font-medium">Tipo</span>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="border rounded-md px-2 py-2"
              >
                <option value="individual">Individual</option>
                <option value="grupo">Grupo</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700 font-medium">Horário</span>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="border rounded-md px-2 py-2"
                disabled={loadingSlots}
              >
                <option value="">
                  {loadingSlots ? 'Carregando...' : 'Selecione'}
                </option>
                {availableSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-700 font-medium">Duração (min)</span>
              <input
                type="number"
                min={15}
                step={15}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="border rounded-md px-2 py-2"
              />
            </label>
          </div>

          {sessionType === 'grupo' ? (
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-700 font-medium">Tema da sessão em grupo</span>
                <input
                  type="text"
                  value={groupTheme}
                  onChange={(e) => setGroupTheme(e.target.value)}
                  className="border rounded-md px-2 py-2"
                  placeholder="Ex.: Gestão de ansiedade na rotina acadêmica"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-700 font-medium">Buscar integrantes</span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="border rounded-md px-2 py-2"
                  placeholder="Nome, e-mail ou matrícula"
                />
              </label>
              <p className="text-xs text-gray-500">
                Integrantes selecionados: {selectedGroupParticipants.length}/{MAX_GROUP_MEMBERS}
              </p>
              <div className="max-h-52 overflow-y-auto border rounded-md divide-y">
                {filteredDiscentes.map((discente) => {
                  const checked = groupParticipantIds.includes(discente.id);
                  return (
                    <label
                      key={discente.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleParticipant(discente.id)}
                      />
                      <span className="font-medium text-gray-800">{discente.name || 'Sem nome'}</span>
                      <span className="text-gray-500 text-xs">{discente.email || 'Sem e-mail'}</span>
                    </label>
                  );
                })}
                {!filteredDiscentes.length && (
                  <p className="px-3 py-2 text-sm text-gray-500">Nenhum discente encontrado.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-700 font-medium">Solicitações pendentes</span>
                <select
                  value={selectedSolicitacaoId}
                  onChange={(e) => setSelectedSolicitacaoId(e.target.value)}
                  className="border rounded-md px-2 py-2"
                >
                  <option value="">Sem solicitação</option>
                  {pendingSolicitacoes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.curso ? `• ${item.curso}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-700 font-medium">Selecionar discente</span>
                <select
                  value={selectedDiscenteId}
                  onChange={(e) => setSelectedDiscenteId(e.target.value)}
                  className="border rounded-md px-2 py-2"
                >
                  <option value="">Selecione</option>
                  {discentes.map((discente) => (
                    <option key={discente.id} value={discente.id}>
                      {discente.name || 'Sem nome'} {discente.studentId ? `• ${discente.studentId}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Observações</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="border rounded-md px-2 py-2"
              placeholder="Observações opcionais"
            />
          </label>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !isDateOnOrAfterToday(selectedDate)}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-400"
            >
              {submitting ? 'Agendando...' : 'Agendar sessão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
