import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../../../services/firebase';
import apiService from '../../../services/api';
import {
  createEmptyClinicalRecord,
  getClinicalRecordFromMeeting,
  getMeetingStatusBadgeMeta,
  getMeetingAudioValidationError,
  resolveSessionDateValue,
} from '../utils/meetingDetalheUtils';

export default function useMeetingDetalheData(meetingId) {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [solicitacao, setSolicitacao] = useState(null);

  const [informalNotes, setInformalNotes] = useState('');
  const [clinicalRecord, setClinicalRecord] = useState(createEmptyClinicalRecord());

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [saveErr, setSaveErr] = useState(null);

  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(45);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState(null);
  const [scheduleErr, setScheduleErr] = useState(null);
  const [scheduleWarn, setScheduleWarn] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [uploadErr, setUploadErr] = useState(null);
  const [selectedTxt, setSelectedTxt] = useState(null);
  const [txtUploading, setTxtUploading] = useState(false);
  const [txtMsg, setTxtMsg] = useState(null);
  const [txtErr, setTxtErr] = useState(null);

  const loadMeeting = async (id) => {
    const resp = await apiService.getMeeting(id);
    if (!resp?.success || !resp.data) {
      throw new Error('Reunião não encontrada');
    }
    const m = resp.data?.data || resp.data;
    setMeeting(m);
    setInformalNotes(m.informalNotes || m.completionNotes || m.notes || '');
    setScheduleDate(m.scheduledDate || '');
    setScheduleTime(m.scheduledTime || '');
    setScheduleDuration(m.duration || 45);
    setClinicalRecord(getClinicalRecordFromMeeting(m));

    setSolicitacao(null);
    if (m.solicitacaoId) {
      const ref = doc(db, 'solicitacoesAtendimento', m.solicitacaoId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setSolicitacao({ id: snap.id, ...snap.data() });
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadMeeting(meetingId);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Falha ao carregar meeting.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [meetingId]);

  const refreshMeeting = async () => {
    if (!meetingId) return;
    const updated = await apiService.getMeeting(meetingId);
    if (updated?.success && updated.data) {
      const m = updated.data?.data || updated.data;
      setMeeting(m);
      return m;
    }
    return null;
  };

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
      const updated = await refreshMeeting();
      if (updated) {
        setMeeting(updated);
      }
    } catch (err) {
      console.error(err);
      setSaveErr('Não foi possível salvar o registro.');
    } finally {
      setSaving(false);
    }
  };

  const handleReschedule = async () => {
    if (!meeting) return;
    setScheduleSaving(true);
    setScheduleMsg(null);
    setScheduleErr(null);
    setScheduleWarn(null);
    try {
      const res = await apiService.updateMeeting(meetingId, {
        scheduledDate: scheduleDate,
        scheduledTime: scheduleTime,
        duration: scheduleDuration,
        status: 'agendada',
      });
      setScheduleMsg('Sessão reagendada.');
      if (res?.calendar?.success === false) {
        setScheduleWarn(
          res?.calendar?.message
            ? `Sessão reagendada, mas não foi possível atualizar o evento no Google Calendar: ${res.calendar.message}`
            : 'Sessão reagendada, mas não foi possível atualizar o evento no Google Calendar.'
        );
      }
      const updated = await refreshMeeting();
      if (updated) {
        setScheduleDate(updated.scheduledDate || '');
        setScheduleTime(updated.scheduledTime || '');
        setScheduleDuration(updated.duration || 45);
      }
    } catch (err) {
      console.error(err);
      setScheduleErr('Não foi possível reagendar.');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleCancelMeeting = async () => {
    if (!meeting) return;
    if (!window.confirm('Deseja cancelar esta sessão?')) return;
    setScheduleSaving(true);
    setScheduleMsg(null);
    setScheduleErr(null);
    setScheduleWarn(null);
    try {
      await apiService.updateMeeting(meetingId, { status: 'cancelada' });
      setScheduleMsg('Sessão cancelada.');
      const updated = await refreshMeeting();
      if (updated) {
        setMeeting(updated);
      }
    } catch (err) {
      console.error(err);
      setScheduleErr('Não foi possível cancelar.');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!meeting || !selectedFile) return;

    const error = getMeetingAudioValidationError(selectedFile);
    if (error) {
      setUploadErr(error);
      return;
    }

    setUploading(true);
    setUploadErr(null);
    setUploadMsg(null);
    try {
      const sessionDate = resolveSessionDateValue(meeting);

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

      setUploadMsg(
        'Arquivo enviado. Processamento em segundo plano; você pode continuar usando o sistema.'
      );
      setSelectedFile(null);
      setMeeting((prev) =>
        prev ? { ...prev, status: 'em_processamento' } : prev
      );
      const updated = await refreshMeeting();
      if (updated) {
        setMeeting(updated);
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
      const sessionDate = resolveSessionDateValue(meeting);
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
      const updated = await refreshMeeting();
      if (updated) {
        setMeeting(updated);
      }
    } catch (err) {
      console.error(err);
      setTxtErr(err?.message || 'Não foi possível processar o TXT.');
    } finally {
      setTxtUploading(false);
    }
  };

  const statusBadgeMeta = useMemo(() => getMeetingStatusBadgeMeta(meeting?.status), [meeting]);

  return {
    meeting,
    loading,
    error,
    solicitacao,

    informalNotes,
    setInformalNotes,
    clinicalRecord,
    setClinicalRecord,

    saving,
    saveMsg,
    saveErr,

    scheduleDate,
    scheduleTime,
    scheduleDuration,
    setScheduleDate,
    setScheduleTime,
    setScheduleDuration,
    scheduleSaving,
    scheduleMsg,
    scheduleErr,
    scheduleWarn,

    selectedFile,
    setSelectedFile,
    uploading,
    uploadMsg,
    uploadErr,
    selectedTxt,
    setSelectedTxt,
    txtUploading,
    txtMsg,
    txtErr,

    statusBadgeMeta,

    handleSave,
    handleReschedule,
    handleCancelMeeting,
    handleUpload,
    handleTxtUpload,
  };
}
