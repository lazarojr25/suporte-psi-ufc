import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import apiService from '../services/api';

export default function DiscenteDetalhe() {
  const { discenteId } = useParams();
  const navigate = useNavigate();

  const [discente, setDiscente] = useState(null);
  const [solicitacoes, setSolicitacoes] = useState([]);

  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [semesterConfig, setSemesterConfig] = useState(null);

  const [transcricoes, setTranscricoes] = useState([]);
  const [relatorioDiscente, setRelatorioDiscente] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().slice(0, 10) // hoje, YYYY-MM-DD
  );

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // ⭐ Meetings do sistema (vamos filtrar por discente depois)
  const [allMeetings, setAllMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);

        // 1) Dados do discente
        const discenteRef = doc(db, 'discentes', discenteId);
        const discenteSnap = await getDoc(discenteRef);
        if (!discenteSnap.exists()) {
          setError('Discente não encontrado');
          return;
        }
        const discenteData = { id: discenteSnap.id, ...discenteSnap.data() };
        setDiscente(discenteData);

        // 2) Solicitações vinculadas
        const q = query(
          collection(db, 'solicitacoesAtendimento'),
          where('discenteId', '==', discenteId)
        );
        const solicitacoesSnap = await getDocs(q);
        const lista = solicitacoesSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate() // vira um Date de verdade
              : data.createdAt || null,
          };
        });
        setSolicitacoes(lista);

        // 3) Relatório + transcrições desse discente
        const rel = await apiService.getReportsByDiscente(discenteId);
        if (rel?.success && rel.data) {
          setRelatorioDiscente(rel.data);
          setTranscricoes(rel.data.transcriptions || []);
        } else if (rel?.data?.transcriptions) {
          setTranscricoes(rel.data.transcriptions);
        }

        // 4) Configuração do semestre (Firestore)
        try {
          const cfgRef = doc(db, 'semestreLetivo', 'semestreLetivoConfig');
          const cfgSnap = await getDoc(cfgRef);
          if (cfgSnap.exists()) {
            setSemesterConfig(cfgSnap.data());
          }
        } catch (cfgErr) {
          console.warn('Falha ao carregar semestreLetivoConfig:', cfgErr);
        }

        // 5) Limite de sessões no período para este discente (backend)
        try {
          const check = await apiService.canScheduleForDiscente(discenteData.id);
          if (check?.success && check.data) {
            setScheduleInfo(check.data);
          }
        } catch (e) {
          console.warn('Falha ao consultar limite de sessões:', e);
        }

        // 6) Meetings (todas; filtramos no front por discenteId)
        try {
          setLoadingMeetings(true);
          const resp = await apiService.getMeetings(); // GET /api/meetings
          if (resp?.success && resp.data?.meetings) {
            setAllMeetings(resp.data.meetings);
          }
        } catch (mErr) {
          console.warn('Falha ao carregar meetings:', mErr);
        } finally {
          setLoadingMeetings(false);
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar dados do discente.');
      }
    };

    loadData();
  }, [discenteId]);

  const handleUpload = async () => {
    if (!selectedFile || !discente) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1) Verifica limite de sessões no período (backend)
      const check = await apiService.canScheduleForDiscente(discente.id);
      console.log('Check limite antes do upload:', check);
      if (check?.success && check.data) {
        setScheduleInfo(check.data); // atualiza card
        if (!check.data.allowed) {
          setError(
            `Limite de sessões atingido para o período ${check.data.periodStart} a ${check.data.periodEnd}.`
          );
          setUploading(false);
          return;
        }
      }

      // 2) Envia mídia + metadados
      await apiService.uploadMedia(selectedFile, {
        discenteId: discente.id,
        studentName: discente.name || '',
        studentEmail: discente.email || '',
        studentId: discente.studentId || '',
        curso: discente.curso || '',
        sessionDate, // data da sessão, usada no nome do arquivo e metadados
      });

      setSuccess('Transcrição enviada e processada com sucesso!');
      setSelectedFile(null);

      // 3) Recarrega relatório/transcrições do discente
      const rel = await apiService.getReportsByDiscente(discenteId);
      if (rel?.success && rel.data) {
        setRelatorioDiscente(rel.data);
        setTranscricoes(rel.data.transcriptions || []);
      }

      // 4) Recalcula limite após novo atendimento registrado
      try {
        const newCheck = await apiService.canScheduleForDiscente(discente.id);
        if (newCheck?.success && newCheck.data) {
          setScheduleInfo(newCheck.data);
        }
      } catch (e) {
        console.warn('Falha ao atualizar limite de sessões:', e);
      }

      // 5) Recarregar meetings após nova sessão
      try {
        const resp = await apiService.getMeetings();
        if (resp?.success && resp.data?.meetings) {
          setAllMeetings(resp.data.meetings);
        }
      } catch (mErr) {
        console.warn('Falha ao recarregar meetings:', mErr);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao enviar transcrição.');
    } finally {
      setUploading(false);
    }
  };

  if (error && !discente) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (!discente) {
    return <div className="p-4">Carregando...</div>;
  }

  const historyPatterns = relatorioDiscente?.historyPatterns;

  // ----- Cálculo dos limites usando Firestore + backend -----

  const usedSessions =
    scheduleInfo?.used ??
    relatorioDiscente?.totalTranscriptions ??
    0;

  const configuredLimit =
    semesterConfig?.maxSessionsPerDiscente ??
    scheduleInfo?.limit ??
    0;

  const remainingSessions =
    configuredLimit > 0
      ? Math.max(0, configuredLimit - usedSessions)
      : null;

  const periodStart =
    scheduleInfo?.periodStart ?? semesterConfig?.periodStart ?? null;
  const periodEnd =
    scheduleInfo?.periodEnd ?? semesterConfig?.periodEnd ?? null;

  const isBlockedByLimit =
    configuredLimit > 0 && remainingSessions !== null && remainingSessions <= 0;

  // ----- Histórico de sessões (meetings) -----

  const now = new Date();

  const getMeetingDate = (m) => {
    if (m.dateTime) return new Date(m.dateTime);
    if (m.scheduledDate && m.scheduledTime) {
      return new Date(`${m.scheduledDate}T${m.scheduledTime}:00`);
    }
    if (m.scheduledDate) return new Date(`${m.scheduledDate}T00:00:00`);
    if (m.createdAt) return new Date(m.createdAt);
    return null;
  };

  const meetingsDiscente = allMeetings
    .filter((m) => m.discenteId === discente.id)
    .map((m) => {
      const d = getMeetingDate(m);
      const isPast = d ? d < now : false;
      return { ...m, _dateObj: d, _isPast: isPast };
    })
    .sort((a, b) => {
      if (!a._dateObj || !b._dateObj) return 0;
      return b._dateObj - a._dateObj; // mais recente primeiro
    });

  const renderMeetingStatusBadge = (m) => {
    let label = '';
    let className = '';

    if (m.status === 'cancelada') {
      label = 'Cancelada';
      className = 'bg-red-100 text-red-800 border border-red-200';
    } else if (m.status === 'concluida') {
      label = 'Concluída';
      className = 'bg-green-100 text-green-800 border border-green-200';
    } else if (m.status === 'agendada') {
      if (m._isPast) {
        label = 'Agendada (data já passou)';
        className = 'bg-amber-100 text-amber-800 border border-amber-200';
      } else {
        label = 'Agendada';
        className = 'bg-blue-100 text-blue-800 border border-blue-200';
      }
    } else {
      label = m.status || 'Desconhecido';
      className = 'bg-gray-100 text-gray-800 border border-gray-200';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {label}
      </span>
    );
  };

  const renderSolicitacaoStatusBadge = (status) => {
    let label = '';
    let className = '';

    switch (status) {
      case 'nova':
      case 'pendente':
        label = 'Pendente';
        className = 'bg-yellow-50 text-yellow-800 border border-yellow-200';
        break;
      case 'em_atendimento':
        label = 'Em atendimento';
        className = 'bg-blue-50 text-blue-800 border border-blue-200';
        break;
      case 'concluida':
        label = 'Concluída';
        className = 'bg-green-50 text-green-800 border border-green-200';
        break;
      case 'cancelada':
        label = 'Cancelada';
        className = 'bg-red-50 text-red-800 border-red-200';
        break;
      default:
        label = status || 'Pendente';
        className = 'bg-gray-50 text-gray-800 border-gray-200';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {label}
      </span>
    );
  };

  // Solicitações + meeting vinculada
  const solicitacoesEnriquecidas = solicitacoes
    .map((s) => {
      const relatedMeeting =
        meetingsDiscente.find((m) => m.solicitacaoId === s.id) || null;
      return { ...s, relatedMeeting };
    })
    .sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : null;
      const db = b.createdAt ? new Date(b.createdAt) : null;
      if (!da || !db) return 0;
      return db - da; // mais recente primeiro
    });

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">

      {/* Dados do discente */}
      <div className="bg-white rounded-xl shadow p-4">
        <h1 className="text-2xl font-bold mb-2">Detalhes do Discente</h1>
        <p><strong>Nome:</strong> {discente.name}</p>
        <p><strong>Email:</strong> {discente.email}</p>
        <p><strong>Matrícula:</strong> {discente.studentId}</p>
        <p><strong>Curso:</strong> {discente.curso}</p>

        {(scheduleInfo || semesterConfig) && (
          <div className={`mt-3 border rounded-xl p-3 text-sm ${
            isBlockedByLimit
              ? 'bg-red-50 border-red-100 text-red-800'
              : 'bg-blue-50 border-blue-100 text-blue-800'
          }`}>
            <p className="font-semibold">
              Limite de sessões neste período
            </p>

            {configuredLimit > 0 ? (
              <>
                <p>
                  Utilizadas: <strong>{usedSessions}</strong> de{' '}
                  <strong>{configuredLimit}</strong> &nbsp;– Restantes:{' '}
                  <strong>{remainingSessions}</strong>
                </p>
                {isBlockedByLimit && (
                  <p className="text-xs mt-1">
                    Este discente atingiu o limite de sessões configurado para o período.
                  </p>
                )}
              </>
            ) : (
              <p>
                Sessões registradas neste período:{' '}
                <strong>{usedSessions}</strong> (sem limite configurado)
              </p>
            )}

            {(periodStart || periodEnd) && (
              <p className="text-xs mt-1">
                Período considerado:&nbsp;
                {periodStart || '---'} até {periodEnd || '---'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Histórico de sessões (meetings) */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Histórico de sessões</h2>

        {loadingMeetings ? (
          <p className="text-sm text-gray-500">Carregando sessões...</p>
        ) : meetingsDiscente.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma sessão registrada para este discente.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {meetingsDiscente.map((m) => (
              <li
                key={m.id}
                className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <p className="font-medium text-gray-800">
                    {m.scheduledDate}{' '}
                    {m.scheduledTime && (
                      <span>às {m.scheduledTime}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Criada em:{' '}
                    {m.createdAt
                      ? new Date(m.createdAt).toLocaleString('pt-BR')
                      : '---'}
                  </p>
                  {m.notes && (
                    <p className="text-xs text-gray-700 mt-1">
                      <strong>Observações:</strong> {m.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-start sm:items-end gap-1">
                  {renderMeetingStatusBadge(m)}
                  {m._dateObj && (
                    <p className="text-[11px] text-gray-500">
                      {m._isPast
                        ? 'Sessão em data já passada'
                        : 'Sessão futura'}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Solicitações */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Solicitações desse discente</h2>

        {solicitacoesEnriquecidas.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma solicitação encontrada.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {solicitacoesEnriquecidas.map((s) => {
              const m = s.relatedMeeting;
              const hasMeeting = !!m;

              // cálculo se a sessão é passada/hoje/futura
              let temporalLabel = null;
              let temporalClasses = '';
              if (hasMeeting) {
                const dateTimeStr =
                  m.dateTime ||
                  (m.scheduledDate
                    ? `${m.scheduledDate}T${(m.scheduledTime || '00:00')}:00`
                    : null);

                const dt = dateTimeStr ? new Date(dateTimeStr) : null;

                if (dt && !isNaN(dt.getTime())) {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const meetingDateStr = dt.toISOString().slice(0, 10);

                  if (meetingDateStr < todayStr) {
                    temporalLabel = 'Sessão já realizada';
                    temporalClasses =
                      'bg-gray-100 text-gray-700 border border-gray-200';
                  } else if (meetingDateStr === todayStr) {
                    temporalLabel = 'Sessão hoje';
                    temporalClasses =
                      'bg-yellow-50 text-yellow-800 border border-yellow-200';
                  } else {
                    temporalLabel = 'Sessão futura';
                    temporalClasses =
                      'bg-emerald-50 text-emerald-800 border border-emerald-200';
                  }
                }
              }

              return (
                <li
                  key={s.id}
                  className="border rounded-lg p-3 flex flex-col gap-2 bg-gray-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-800">
                        Motivo: {s.motivation}
                      </p>
                      <p className="text-xs text-gray-500">
                        Criada em:{' '}
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleString('pt-BR')
                          : '---'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderSolicitacaoStatusBadge(s.status)}
                    </div>
                  </div>

                  <div className="mt-1 border-t pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-xs text-gray-700">
                      {hasMeeting ? (
                        <>
                          <p className="font-semibold mb-0.5">
                            Sessão vinculada:
                          </p>
                          <p>
                            {m.scheduledDate}{' '}
                            {m.scheduledTime && `às ${m.scheduledTime}`}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {renderMeetingStatusBadge(m)}

                            {temporalLabel && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${temporalClasses}`}
                              >
                                {temporalLabel}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-600">
                          Nenhuma sessão agendada para esta solicitação.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end">
                      {!hasMeeting && !isBlockedByLimit && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/agendar-atendimento/${s.id}`)
                          }
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                        >
                          Agendar sessão
                        </button>
                      )}

                      {hasMeeting && (
                        <span className="text-[11px] text-gray-500">
                          ID reunião: {m.id}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Relatório e transcrições do discente */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Transcrições e análise desse discente</h2>

        {!relatorioDiscente && transcricoes.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Nenhuma transcrição vinculada a este discente.
          </p>
        ) : (
          <>
            {/* Mini cards de resumo */}
            {relatorioDiscente && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Total de transcrições</p>
                  <p className="text-xl font-semibold">
                    {relatorioDiscente.totalTranscriptions}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Tamanho total (KB)</p>
                  <p className="text-xl font-semibold">
                    {Math.round((relatorioDiscente.totalSizeBytes || 0) / 1024)}
                  </p>
                </div>
                {relatorioDiscente.sentimentsAvg && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500">Sentimento médio</p>
                    <p className="text-xs text-gray-700">
                      Positivo:{' '}
                      {(relatorioDiscente.sentimentsAvg.positive * 100).toFixed(1)}%
                      <br />
                      Neutro:{' '}
                      {(relatorioDiscente.sentimentsAvg.neutral * 100).toFixed(1)}%
                      <br />
                      Negativo:{' '}
                      {(relatorioDiscente.sentimentsAvg.negative * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Padrões históricos (IA) */}
            {historyPatterns && (
              <div className="mb-4 border rounded-lg p-3 bg-gray-50 text-sm">
                <h3 className="font-semibold mb-1">Padrões ao longo das sessões</h3>
                {Array.isArray(historyPatterns.recurringThemes) && (
                  <p className="text-gray-700">
                    <strong>Temas recorrentes:</strong>{' '}
                    {historyPatterns.recurringThemes.join(', ')}
                  </p>
                )}
                {Array.isArray(historyPatterns.repeatedIdeas) && (
                  <p className="text-gray-700">
                    <strong>Ideias repetidas:</strong>{' '}
                    {historyPatterns.repeatedIdeas.join(', ')}
                  </p>
                )}
                {Array.isArray(historyPatterns.emotionalPatterns) && (
                  <p className="text-gray-700">
                    <strong>Padrões emocionais:</strong>{' '}
                    {historyPatterns.emotionalPatterns.join(', ')}
                  </p>
                )}
                {Array.isArray(historyPatterns.commonTriggers) && (
                  <p className="text-gray-700">
                    <strong>Gatilhos comuns:</strong>{' '}
                    {historyPatterns.commonTriggers.join(', ')}
                  </p>
                )}
                {historyPatterns.overallSummary && (
                  <p className="text-gray-800 mt-1">
                    <strong>Resumo geral:</strong> {historyPatterns.overallSummary}
                  </p>
                )}
              </div>
            )}

            {/* Lista de transcrições */}
            <ul className="space-y-2 text-sm">
              {transcricoes.map((t) => (
                <li key={t.fileName} className="border rounded-lg p-2">
                  <p className="font-medium text-gray-800">{t.fileName}</p>
                  <p className="text-xs text-gray-500">
                    Criado em:{' '}
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleString('pt-BR')
                      : '---'}
                  </p>
                  {t.analysis?.summary && (
                    <p className="mt-1 text-xs text-gray-700">
                      <strong>Resumo:</strong> {t.analysis.summary}
                    </p>
                  )}
                  {Array.isArray(t.analysis?.keywords) &&
                    t.analysis.keywords.length > 0 && (
                      <p className="mt-1 text-xs text-gray-600">
                        <strong>Palavras-chave:</strong>{' '}
                        {t.analysis.keywords.join(', ')}
                      </p>
                    )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Upload de transcrição */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Upload de transcrição</h2>

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-2">{success}</p>}

        {isBlockedByLimit && (
          <p className="text-sm text-red-600 mb-3">
            Este discente atingiu o limite de sessões para o período atual.  
            Novas transcrições não podem ser registradas.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-3 text-sm">
          <div>
            <label className="block mb-1 text-gray-700">
              Data da sessão
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1 text-gray-700">
              Arquivo de áudio/vídeo
            </label>
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              className="block"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !selectedFile || isBlockedByLimit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm"
        >
          {uploading ? 'Enviando...' : 'Enviar transcrição'}
        </button>
      </div>
    </div>
  );
}
