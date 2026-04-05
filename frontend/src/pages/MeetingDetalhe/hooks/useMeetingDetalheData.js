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

  const [clinicalSaving, setClinicalSaving] = useState(false);
  const [clinicalSaveMsg, setClinicalSaveMsg] = useState(null);
  const [clinicalSaveErr, setClinicalSaveErr] = useState(null);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaveMsg, setNotesSaveMsg] = useState(null);
  const [notesSaveErr, setNotesSaveErr] = useState(null);
  const [transcriptionAnalysis, setTranscriptionAnalysis] = useState(null);
  const [transcriptionReview, setTranscriptionReview] = useState({
    requiredByModel: false,
    sourceSummary: '',
    summaryDraft: '',
    reviewNotes: '',
    checklist: {},
    reviewedBy: '',
    reviewedAt: '',
    status: 'pendente',
  });
  const [reviewChecklistMissing, setReviewChecklistMissing] = useState(null);

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

  const reviewChecklistTemplate = useMemo(
    () => [
      {
        key: 'resumoConferido',
        label: 'Conferi se o resumo automático condiz com a sessão.',
      },
      {
        key: 'sinaisConfiaveis',
        label: 'Avaliei os sinais de risco e os registrei quando necessário.',
      },
      {
        key: 'textoRelevante',
        label: 'Revisarei os pontos clínicos críticos antes de inserir no relatório final.',
      },
    ],
    [],
  );

  const buildReviewChecklist = (existing = null) => {
    const base = {};
    reviewChecklistTemplate.forEach((item) => {
      base[item.key] = Boolean(existing?.[item.key]);
    });
    return base;
  };

  const buildTranscriptionReview = (analysis = null, persisted = null) => {
    const checklist = buildReviewChecklist(persisted?.checklist);
    return {
      requiredByModel:
        persisted?.requiredByModel ??
        Boolean(analysis?.humanReviewRequired),
      sourceSummary: analysis?.summary || '',
      summaryDraft: persisted?.summaryDraft ?? analysis?.summary ?? '',
      reviewNotes: persisted?.reviewNotes || persisted?.notes || '',
      checklist,
      reviewedBy: persisted?.reviewedBy || '',
      reviewedAt: persisted?.reviewedAt || '',
      status: persisted?.status || 'pendente',
    };
  };

  const loadTranscriptionReviewData = async (meetingData) => {
    setTranscriptionAnalysis(null);
    setReviewChecklistMissing(null);
    const fileName = meetingData?.transcriptionFileName;
    if (!fileName) {
      const nextReview = buildTranscriptionReview(null, meetingData?.transcriptionReview || null);
      setTranscriptionReview(nextReview);
      updateReviewChecklistMissing(nextReview);
      return;
    }
    try {
      const transcriptionRes = await apiService.getTranscription(fileName);
      const analysis = transcriptionRes?.data?.analysis || null;
      setTranscriptionAnalysis(analysis || null);
      const persistedReview =
        meetingData?.transcriptionReview && typeof meetingData.transcriptionReview === 'object'
          ? meetingData.transcriptionReview
          : null;
      const nextReview = buildTranscriptionReview(analysis, persistedReview);
      setTranscriptionReview(nextReview);
      updateReviewChecklistMissing(nextReview);
    } catch (err) {
      console.error('Erro ao carregar análise de transcrição:', err);
      setTranscriptionAnalysis(null);
      const nextReview = buildTranscriptionReview(meetingData?.analysisHint || null, null);
      setTranscriptionReview(nextReview);
      updateReviewChecklistMissing(nextReview);
    }
  };

  const updateReviewChecklistMissing = (nextReview) => {
    const required = Boolean(nextReview.requiredByModel);
    if (!required) {
      setReviewChecklistMissing(null);
      return;
    }

    const notChecked = reviewChecklistTemplate.filter(
      (item) => !nextReview?.checklist?.[item.key],
    );
    setReviewChecklistMissing(notChecked.length ? notChecked.map((item) => item.label) : null);
  };

  const isReviewRequired = useMemo(
    () =>
      Boolean(
        transcriptionReview.requiredByModel ||
          transcriptionAnalysis?.humanReviewRequired ||
          (transcriptionAnalysis?.summaryConfidence !== null &&
            transcriptionAnalysis?.summaryConfidence < 0.65),
      ),
    [transcriptionReview.requiredByModel, transcriptionAnalysis],
  );

  const isClinicalSaveBlocked = useMemo(() => {
    if (!isReviewRequired) return false;
    const notChecked = reviewChecklistTemplate.some((item) => !transcriptionReview.checklist?.[item.key]);
    return (
      notChecked ||
      !transcriptionReview.summaryDraft ||
      !transcriptionReview.summaryDraft.trim()
    );
  }, [isReviewRequired, reviewChecklistTemplate, transcriptionReview]);

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
    await loadTranscriptionReviewData(m);

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
      await loadTranscriptionReviewData(m);
      return m;
    }
    return null;
  };

  const setReviewField = (field, value) => {
    setTranscriptionReview((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };
      if (field === 'checklist' || field === 'summaryDraft' || field === 'reviewNotes') {
        updateReviewChecklistMissing(next);
      }
      return next;
    });
  };

  const setReviewChecklistItem = (key, value) => {
    setTranscriptionReview((prev) => {
      const next = {
        ...prev,
        checklist: {
          ...(prev.checklist || {}),
          [key]: Boolean(value),
        },
      };
      updateReviewChecklistMissing(next);
      return next;
    });
  };

  const applyAiSummaryToClinical = () => {
    const source = transcriptionReview.sourceSummary || '';
    setClinicalRecord((prev) => ({
      ...prev,
      analiseCompreensao: source,
    }));
    setReviewField('summaryDraft', source);
  };

  const handleClinicalSave = async () => {
    if (!meeting) return;
    updateReviewChecklistMissing(transcriptionReview);
    if (isClinicalSaveBlocked) {
      setClinicalSaveErr('Conclusão de revisão pendente para salvar o registro clínico.');
      return;
    }

    setClinicalSaving(true);
    setClinicalSaveErr(null);
    setClinicalSaveMsg(null);
    try {
      const payload = {
        clinicalRecord: {
          ...clinicalRecord,
          updatedAt: new Date().toISOString(),
        },
        transcriptionReview: {
          ...transcriptionReview,
          status: isReviewRequired ? 'aprovado' : 'naoExigido',
          reviewedAt: new Date().toISOString(),
          analysisSnapshot: {
            humanReviewRequired: transcriptionAnalysis?.humanReviewRequired || false,
            summaryConfidence: transcriptionAnalysis?.summaryConfidence ?? null,
            uncertainty:
              transcriptionAnalysis?.uncertainty?.nivel ||
              transcriptionAnalysis?.uncertainty?.level ||
              null,
          },
          requiredByModel:
            transcriptionReview.requiredByModel || transcriptionAnalysis?.humanReviewRequired || false,
          checklist: transcriptionReview.checklist || {},
        },
      };
      await apiService.updateMeeting(meetingId, {
        ...payload,
      });
      setClinicalSaveMsg('Registro e revisão salvos com sucesso.');
      const updated = await refreshMeeting();
      if (updated) {
        setMeeting(updated);
        await loadTranscriptionReviewData(updated);
      }
    } catch (err) {
      console.error(err);
      setClinicalSaveErr('Não foi possível salvar o registro.');
    } finally {
      setClinicalSaving(false);
    }
  };

  const handleNotesSave = async () => {
    if (!meeting) return;
    setNotesSaving(true);
    setNotesSaveErr(null);
    setNotesSaveMsg(null);
    try {
      await apiService.updateMeeting(meetingId, {
        informalNotes,
      });
      setNotesSaveMsg('Anotações salvas com sucesso.');
      const updated = await refreshMeeting();
      if (updated) setMeeting(updated);
    } catch (err) {
      console.error(err);
      setNotesSaveErr('Não foi possível salvar anotações.');
    } finally {
      setNotesSaving(false);
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
        await loadTranscriptionReviewData(updated);
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
        studentName: meeting.studentName || meeting.groupTheme || meeting.title || '',
        studentEmail: meeting.studentEmail || meeting.participants?.[0]?.email || '',
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
        await loadTranscriptionReviewData(updated);
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
        studentName: meeting.studentName || meeting.groupTheme || meeting.title || '',
        studentEmail: meeting.studentEmail || meeting.participants?.[0]?.email || '',
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
        await loadTranscriptionReviewData(updated);
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

    clinicalSaving,
    clinicalSaveMsg,
    clinicalSaveErr,
    notesSaving,
    notesSaveMsg,
    notesSaveErr,
    isClinicalSaveBlocked,
    transcriptionAnalysis,
    transcriptionReview,
    setReviewField,
    setReviewChecklistItem,
    applyAiSummaryToClinical,
    reviewChecklistMissing,
    reviewChecklistTemplate,
    isReviewRequired,

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

    handleClinicalSave,
    handleNotesSave,
    handleReschedule,
    handleCancelMeeting,
    handleUpload,
    handleTxtUpload,
  };
}
