import fs from 'fs';

export const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const toSafeBase = (name) =>
  name.replace(/[^\w\d\-_.]+/g, '_').replace(/_+/g, '_');

export const isSafeFileName = (name) =>
  typeof name === 'string' &&
  name.length > 0 &&
  /^[A-Za-z0-9._-]+$/.test(name) &&
  !name.includes('..');

export const removeIfExists = (p) => {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
};

export const removeDir = (dir) => {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
};

export const readFileSafe = (p) => {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch (e) {
    return null;
  }
};

// Critério para decidir se vale reprocessar (evita chamadas desnecessárias ao Gemini)
export const shouldReprocessEntry = (entry, force = false) => {
  if (force) return true;
  if (!entry) return false;
  const hasAnalysis = !!entry.analysis;
  const hasSummary = !!entry.analysis?.summary;
  const hasSentiments = !!entry.analysis?.sentiments;
  const hasAnalysisError =
    entry.analysisStatus === 'failed' ||
    !!entry.analysisError;

  // Reprocessa apenas se faltam dados essenciais
  return !hasAnalysis || !hasSummary || !hasSentiments || hasAnalysisError;
};

// Gera um "slug" seguro com nome do aluno + data (YYYY-MM-DD)
export const buildTranscriptBaseName = (extraInfo, fallbackBaseName) => {
  const rawName = extraInfo.studentName || 'discente';
  const rawId = extraInfo.matricula || '';
  const sessionDate =
    extraInfo.sessionDate ||
    new Date().toISOString().slice(0, 10);

  const safeName =
    rawName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    || 'discente';

  const safeId = rawId
    .toString()
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim();

  const safeDate = sessionDate.replace(/[^0-9]/g, '');

  let base = safeName;
  if (safeId) base += `_${safeId}`;
  if (safeDate) base += `_${safeDate}`;
  base += '_sessao';

  return base || fallbackBaseName || 'transcricao';
};

export const enrichExtraInfoFromMeeting = async (
  db,
  meetingId,
  extraInfo,
  contextLabel = 'transcription',
) => {
  if (!db || !meetingId) return extraInfo;

  try {
    const snap = await db.collection('meetings').doc(meetingId).get();
    if (snap.exists) {
      const data = snap.data() || {};
      extraInfo.discenteId = extraInfo.discenteId || data.discenteId || null;
      extraInfo.solicitacaoId = extraInfo.solicitacaoId || data.solicitacaoId || null;
      extraInfo.studentName = extraInfo.studentName || data.studentName || null;
      extraInfo.studentEmail = extraInfo.studentEmail || data.studentEmail || null;
      extraInfo.matricula =
        extraInfo.matricula || data.studentId || data.matricula || null;
      extraInfo.curso = extraInfo.curso || data.curso || null;
      extraInfo.sessionDate =
        extraInfo.sessionDate ||
        data.scheduledDate ||
        (data.dateTime ? new Date(data.dateTime).toISOString().slice(0, 10) : null);
    }
  } catch (error) {
    console.warn(
      `Não foi possível enriquecer metadados a partir do meeting (${contextLabel}):`,
      error?.message,
    );
  }

  return extraInfo;
};
