import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import apiService from '../services/api';

const dateLabel = (dateStr) => {
  if (!dateStr) return '---';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export default function MeetingDetalhe() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [solicitacao, setSolicitacao] = useState(null);

  const [informalNotes, setInformalNotes] = useState('');
  const [clinicalRecord, setClinicalRecord] = useState({
    summary: '',
    observations: '',
    plan: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [saveErr, setSaveErr] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [uploadErr, setUploadErr] = useState(null);
  const [selectedTxt, setSelectedTxt] = useState(null);
  const [txtUploading, setTxtUploading] = useState(false);
  const [txtMsg, setTxtMsg] = useState(null);
  const [txtErr, setTxtErr] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await apiService.getMeeting(meetingId);
        if (!resp?.success || !resp.data) {
          throw new Error('Reunião não encontrada');
        }
        const m = resp.data?.data || resp.data;
        setMeeting(m);
        setInformalNotes(
          m.informalNotes || m.completionNotes || m.notes || ''
        );
        setClinicalRecord({
          summary: m.clinicalRecord?.summary || '',
          observations: m.clinicalRecord?.observations || '',
          plan: m.clinicalRecord?.plan || '',
        });

        if (m.solicitacaoId) {
          const ref = doc(db, 'solicitacoesAtendimento', m.solicitacaoId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setSolicitacao({ id: snap.id, ...snap.data() });
          }
        }
      } catch (err) {
        console.error(err);
        setError(err.message || 'Falha ao carregar meeting.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [meetingId]);

  const handleSave = async () => {
    if (!meeting) return;
    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);
    try {
      await apiService.updateMeeting(meetingId, {
        informalNotes,
        clinicalRecord: {
          ...clinicalRecord,
          updatedAt: new Date().toISOString(),
        },
      });
      setSaveMsg('Registro salvo com sucesso.');
      const updated = await apiService.getMeeting(meetingId);
      if (updated?.success && updated.data) {
        setMeeting(updated.data?.data || updated.data);
      }
    } catch (err) {
      console.error(err);
      setSaveErr('Não foi possível salvar o registro.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!meeting || !selectedFile) return;

    const allowedExts = ['.mp3', '.wav', '.m4a', '.ogg', '.mp4', '.mov', '.webm', '.mkv', '.avi'];
    const maxSize = 500 * 1024 * 1024; // 500MB (limite do backend)
    const ext = selectedFile.name
      .toLowerCase()
      .slice(selectedFile.name.lastIndexOf('.'));

    if (!allowedExts.includes(ext)) {
      setUploadErr('Formato não suportado. Use: MP3, WAV, M4A, OGG, MP4, MOV, WEBM, MKV ou AVI.');
      return;
    }
    if (selectedFile.size > maxSize) {
      setUploadErr(
        `Arquivo muito grande (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB). Limite: ${maxSize / (1024 * 1024)}MB.`
      );
      return;
    }
    setUploading(true);
    setUploadErr(null);
    setUploadMsg(null);
    try {
      const sessionDate =
        meeting.scheduledDate ||
        (meeting.dateTime
          ? new Date(meeting.dateTime).toISOString().slice(0, 10)
          : null) ||
        new Date().toISOString().slice(0, 10);

      await apiService.uploadMedia(selectedFile, {
        meetingId,
        solicitacaoId: meeting.solicitacaoId || '',
        discenteId: meeting.discenteId || '',
        studentName: meeting.studentName || '',
        studentEmail: meeting.studentEmail || '',
        studentId: meeting.studentId || '',
        curso: meeting.curso || '',
        sessionDate,
      });

      try {
        await apiService.updateMeeting(meetingId, { status: 'concluida' });
      } catch (e) {
        console.warn('Falha ao atualizar status após upload:', e);
      }

      setUploadMsg('Transcrição enviada e sessão marcada como concluída.');
      setSelectedFile(null);
      const updated = await apiService.getMeeting(meetingId);
      if (updated?.success && updated.data) {
        setMeeting(updated.data?.data || updated.data);
      }
    } catch (err) {
      console.error(err);
      setUploadErr('Não foi possível enviar a transcrição.');
    } finally {
      setUploading(false);
    }
  };

  const handleTxtUpload = async () => {
    if (!meeting || !selectedTxt) return;
    setTxtUploading(true);
    setTxtErr(null);
    setTxtMsg(null);

    try {
      const sessionDate =
        meeting.scheduledDate ||
        (meeting.dateTime
          ? new Date(meeting.dateTime).toISOString().slice(0, 10)
          : null) ||
        new Date().toISOString().slice(0, 10);

      const extra = {
        meetingId,
        solicitacaoId: meeting.solicitacaoId || '',
        discenteId: meeting.discenteId || '',
        studentName: meeting.studentName || '',
        studentEmail: meeting.studentEmail || '',
        studentId: meeting.studentId || '',
        curso: meeting.curso || '',
        sessionDate,
      };

      const res = await apiService.uploadTranscriptText(selectedTxt, extra);

      if (!res?.success) {
        throw new Error(res?.message || 'Falha ao processar TXT.');
      }

      try {
        await apiService.updateMeeting(meetingId, { status: 'concluida' });
      } catch (e) {
        console.warn('Falha ao atualizar status após upload TXT:', e);
      }

      setTxtMsg('Transcrição pronta analisada e sessão marcada como concluída.');
      setSelectedTxt(null);
      const input = document.getElementById('txtTranscriptionFile');
      if (input) input.value = '';
      const updated = await apiService.getMeeting(meetingId);
      if (updated?.success && updated.data) {
        setMeeting(updated.data?.data || updated.data);
      }
    } catch (err) {
      console.error(err);
      setTxtErr(err?.message || 'Não foi possível processar o TXT.');
    } finally {
      setTxtUploading(false);
    }
  };

  const statusBadge = useMemo(() => {
    if (!meeting?.status) return null;
    const base =
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';
    switch (meeting.status) {
      case 'concluida':
        return <span className={`${base} bg-green-100 text-green-800`}>Concluída</span>;
      case 'agendada':
        return <span className={`${base} bg-blue-100 text-blue-800`}>Agendada</span>;
      case 'cancelada':
        return <span className={`${base} bg-red-100 text-red-800`}>Cancelada</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-700`}>{meeting.status}</span>;
    }
  }, [meeting]);

  if (loading) return <div className="p-4">Carregando reunião...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!meeting) return <div className="p-4">Meeting não encontrado.</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-gray-500">Sessão</p>
          <h1 className="text-2xl font-bold text-gray-900">{meeting.studentName || 'Sessão'}</h1>
          <p className="text-sm text-gray-600">
            {meeting.scheduledDate}{' '}
            {meeting.scheduledTime && `às ${meeting.scheduledTime}`}
          </p>
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
        <p><strong>Discente:</strong> {meeting.studentName || '---'}</p>
        <p><strong>Email:</strong> {meeting.studentEmail || '---'}</p>
        <p><strong>Curso:</strong> {meeting.curso || '---'}</p>
        <p><strong>Duração:</strong> {meeting.duration || 0} min</p>
        <p><strong>Criada em:</strong> {dateLabel(meeting.createdAt)}</p>
        {meeting.meetLink && (
          <p className="break-all">
            <strong>Link:</strong> {meeting.meetLink}
          </p>
        )}
        {solicitacao && (
          <button
            type="button"
            onClick={() => navigate(`/solicitacoes/${solicitacao.id}`)}
            className="text-blue-600 text-xs font-semibold hover:underline"
          >
            Ver solicitação vinculada
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase text-gray-500">Registro clínico</p>
          {saveMsg && <span className="text-[11px] text-green-600">{saveMsg}</span>}
          {saveErr && <span className="text-[11px] text-red-600">{saveErr}</span>}
        </div>
        <label className="text-sm space-y-1 block">
          <span className="text-[11px] text-gray-600">Síntese / queixa principal</span>
          <textarea
            value={clinicalRecord.summary}
            onChange={(e) =>
              setClinicalRecord((prev) => ({ ...prev, summary: e.target.value }))
            }
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>
        <label className="text-sm space-y-1 block">
          <span className="text-[11px] text-gray-600">Intervenções / condutas</span>
          <textarea
            value={clinicalRecord.observations}
            onChange={(e) =>
              setClinicalRecord((prev) => ({ ...prev, observations: e.target.value }))
            }
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>
        <label className="text-sm space-y-1 block">
          <span className="text-[11px] text-gray-600">Próximos passos / encaminhamentos</span>
          <textarea
            value={clinicalRecord.plan}
            onChange={(e) =>
              setClinicalRecord((prev) => ({ ...prev, plan: e.target.value }))
            }
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          />
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar registro'}
          </button>
          <p className="text-[11px] text-gray-500">
            Evite dados sensíveis desnecessários; este registro fica associado ao meeting.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase text-gray-500">Anotações informais</p>
          {meeting.informalNotes && (
            <span className="text-[11px] text-gray-500">
              Última atualização: {dateLabel(meeting.updatedAt || meeting.createdAt)}
            </span>
          )}
        </div>
        <textarea
          value={informalNotes}
          onChange={(e) => setInformalNotes(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:border-blue-300"
          placeholder="Notas rápidas desta sessão."
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar anotações'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase text-gray-500">Transcrição</p>
          {uploadMsg && <span className="text-[11px] text-green-600">{uploadMsg}</span>}
          {uploadErr && <span className="text-[11px] text-red-600">{uploadErr}</span>}
          {txtMsg && <span className="text-[11px] text-green-600">{txtMsg}</span>}
          {txtErr && <span className="text-[11px] text-red-600">{txtErr}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[11px] text-gray-600 uppercase">Áudio/Vídeo</p>
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              className="text-sm"
            />
            <p className="text-[11px] text-gray-500">
              Formatos: MP3, WAV, M4A, OGG, MP4, MOV, WEBM, MKV, AVI. Limite: 500MB.
            </p>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? 'Enviando...' : 'Enviar e transcrever'}
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-gray-600 uppercase">Transcrição pronta (.txt)</p>
            <input
              id="txtTranscriptionFile"
              type="file"
              accept=".txt,text/plain"
              onChange={(e) => setSelectedTxt(e.target.files[0] || null)}
              className="text-sm"
            />
            <p className="text-[11px] text-gray-500">
              Envie o .txt exportado pelo Meet; faremos apenas a análise e vínculo.
            </p>
            <button
              type="button"
              onClick={handleTxtUpload}
              disabled={txtUploading || !selectedTxt}
              className="px-4 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
            >
              {txtUploading ? 'Processando...' : 'Enviar TXT e analisar'}
            </button>
          </div>
        </div>
        {meeting.status === 'concluida' && (
          <p className="text-[11px] text-gray-500">
            Esta sessão está marcada como concluída.
          </p>
        )}
      </div>
    </div>
  );
}
