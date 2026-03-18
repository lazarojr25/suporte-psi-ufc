import { getAdminDb } from '../firebaseAdmin.js';

const db = getAdminDb();

const TRANSCRIPTION_METADATA_COLLECTION = 'metadados_transcricoes';
const TRANSCRIPTION_PROCESSING_ERRORS_COLLECTION = 'transcription_processing_errors';
const OVERVIEW_CACHE_COLLECTION = 'relatorio_geral_cache';

const normalizeDiscenteId = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).trim();
};

const fetchSnapshots = async (queryBuilder) => {
  const ref = queryBuilder(db.collection(TRANSCRIPTION_METADATA_COLLECTION));
  return ref.get();
};

const fetchErrorSnapshots = async (queryBuilder) => {
  const ref = queryBuilder(
    db.collection(TRANSCRIPTION_PROCESSING_ERRORS_COLLECTION),
  );
  return ref.get();
};

const readTranscriptionMetadata = async (queryBuilder) => {
  try {
    const snapshot = await fetchSnapshots(queryBuilder);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};

const readTranscriptionProcessingErrors = async (queryBuilder) => {
  try {
    const snapshot = await fetchErrorSnapshots(queryBuilder);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};

const normalizeText = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeErrorPayload = (rawError) => {
  const error = rawError || {};
  const message = typeof error.message === 'string' ? error.message : String(error || '');
  return {
    name: typeof error.name === 'string' ? error.name : null,
    code: error.code || null,
    message: normalizeText(message) || 'Erro durante processamento de transcrição.',
    stack: typeof error.stack === 'string' ? error.stack : null,
  };
};

export async function logTranscriptionProcessingError(payload = {}) {
  try {
    const error = normalizeErrorPayload(payload.error || payload);
    const docPayload = {
      kind: 'transcription_processing_error',
      source: normalizeText(payload.source) || 'backend',
      stage: normalizeText(payload.stage) || 'pipeline',
      errorType: normalizeText(payload.errorType) || 'pipeline',
      status: normalizeText(payload.status) || 'failed',
      message: error.message,
      retryable: Boolean(payload.retryable),
      attempt: normalizeNumber(payload.attempt),
      maxAttempts: normalizeNumber(payload.maxAttempts),
      isTerminal: payload.isTerminal !== undefined ? Boolean(payload.isTerminal) : null,
      meetingId: normalizeText(payload.meetingId),
      discenteId: normalizeText(payload.discenteId),
      solicitacaoId: normalizeText(payload.solicitacaoId),
      transcriptFileName:
        normalizeText(payload.transcriptFileName || payload.fileName) || null,
      jobId: normalizeText(payload.jobId),
      transcriptionId: normalizeText(payload.transcriptionId),
      batchId: normalizeText(payload.batchId),
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : null,
      errorPayload: error,
      provider: normalizeText(payload.provider) || 'gemini',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolved: false,
    };

    const docRef = await db
      .collection(TRANSCRIPTION_PROCESSING_ERRORS_COLLECTION)
      .add(docPayload);
    return docRef.id;
  } catch (error) {
    console.error(
      'ERRO ao registrar log de erro de processamento de transcrição.',
      error,
    );
    return null;
  }
}

export async function listTranscriptionProcessingErrors(filters = {}) {
  try {
    const sourceFilter = normalizeText(filters.source);
    const stageFilter = normalizeText(filters.stage);
    const meetingId = normalizeText(filters.meetingId);
    const discenteId = normalizeText(filters.discenteId);
    const solicitacaoId = normalizeText(filters.solicitacaoId);
    const transcriptFileName = normalizeText(
      filters.transcriptFileName || filters.fileName,
    );
    const jobId = normalizeText(filters.jobId);
    const statusFilter = normalizeText(filters.status);
    const requestedLimit = normalizeNumber(filters.limit);
    const maxItems = Math.min(Math.max(requestedLimit || 100, 1), 500);

    const queryFilter = (docs) => {
      return docs.filter((docItem) => {
        if (sourceFilter && docItem.source !== sourceFilter) return false;
        if (stageFilter && docItem.stage !== stageFilter) return false;
        if (meetingId && docItem.meetingId !== meetingId) return false;
        if (discenteId && docItem.discenteId !== discenteId) return false;
        if (solicitacaoId && docItem.solicitacaoId !== solicitacaoId) return false;
        if (transcriptFileName && docItem.transcriptFileName !== transcriptFileName)
          return false;
        if (jobId && docItem.jobId !== jobId) return false;
        if (statusFilter && docItem.status !== statusFilter) return false;
        return true;
      });
    };

    const runQuery = async (queryBuilder) =>
      queryFilter(await readTranscriptionProcessingErrors(queryBuilder));

    const docs = await runQuery((ref) => {
      let query = ref;
      if (sourceFilter) query = query.where('source', '==', sourceFilter);
      if (stageFilter) query = query.where('stage', '==', stageFilter);
      if (meetingId) query = query.where('meetingId', '==', meetingId);
      if (discenteId) query = query.where('discenteId', '==', discenteId);
      if (solicitacaoId) query = query.where('solicitacaoId', '==', solicitacaoId);
      if (transcriptFileName) query = query.where('transcriptFileName', '==', transcriptFileName);
      if (jobId) query = query.where('jobId', '==', jobId);
      if (statusFilter) query = query.where('status', '==', statusFilter);
      return query;
    });

    return docs
      .sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      )
      .slice(0, maxItems);
  } catch (error) {
    if (String(error?.code || '').toLowerCase() !== 'failed-precondition' && error?.code !== 9) {
      console.error('ERRO ao listar logs de erro de processamento.', error);
      return [];
    }

    try {
      const docs = await readTranscriptionProcessingErrors((ref) => ref);
      const filtered = docs.filter((docItem) => {
        const sourceFilterValue = sourceFilter;
        const stageFilterValue = stageFilter;
        const meetingIdValue = meetingId;
        const discenteIdValue = discenteId;
        const solicitacaoIdValue = solicitacaoId;
        const transcriptFileNameValue = transcriptFileName;
        const jobIdValue = jobId;
        const statusFilterValue = statusFilter;

        if (sourceFilterValue && docItem.source !== sourceFilterValue) return false;
        if (stageFilterValue && docItem.stage !== stageFilterValue) return false;
        if (meetingIdValue && docItem.meetingId !== meetingIdValue) return false;
        if (discenteIdValue && docItem.discenteId !== discenteIdValue) return false;
        if (solicitacaoIdValue && docItem.solicitacaoId !== solicitacaoIdValue) return false;
        if (transcriptFileNameValue && docItem.transcriptFileName !== transcriptFileNameValue)
          return false;
        if (jobIdValue && docItem.jobId !== jobIdValue) return false;
        if (statusFilterValue && docItem.status !== statusFilterValue) return false;
        return true;
      });

      return filtered
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        )
        .slice(0, maxItems);
    } catch (fallbackError) {
      console.error('ERRO ao listar logs de erro de processamento (fallback).', fallbackError);
      return [];
    }
  }
}

export async function getTranscriptionProcessingErrorById(logId) {
  if (!logId) return null;
  try {
    const docRef = await db
      .collection(TRANSCRIPTION_PROCESSING_ERRORS_COLLECTION)
      .doc(logId)
      .get();
    if (!docRef.exists) return null;
    return { id: docRef.id, ...docRef.data() };
  } catch (error) {
    console.error('ERRO ao listar logs de erro de processamento.', error);
    return null;
  }
}

/**
 * Salva os metadados e a análise de uma transcrição no Firestore.
 * @param {object} data - Os dados a serem salvos.
 * @returns {Promise<string>} O ID do documento criado.
 */
export async function saveTranscriptionMetadata(data) {
  // Estrutura de dados a ser salva:
  // - fileName: string
  // - createdAt: string (ISO date)
  // - size: number (tamanho do texto da transcrição)
  // - metadata: object (extraInfo do upload)
  // - analysis: object (resultado da análise do Gemini)

  try {
    if (data?.fileName) {
      const safeId = data.fileName.replace(/[\/#?]+/g, '_');
      await db
        .collection(TRANSCRIPTION_METADATA_COLLECTION)
        .doc(safeId)
        .set(data, { merge: true });

      console.log(
        `Metadados de transcrição salvos no Firestore com ID: ${safeId}`,
      );
      return safeId;
    }

    const docRef = await db.collection(TRANSCRIPTION_METADATA_COLLECTION).add(data);
    console.log(`Metadados de transcrição salvos no Firestore com ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error(
      'ERRO ao salvar metadados no Firestore. Verifique a inicialização do Firebase Admin SDK.',
      error,
    );
    // Em caso de falha, retorna um ID simulado para não quebrar o fluxo
    return `simulated-id-${Date.now()}`;
  }
}

/**
 * Busca metadados de transcrição por ID do discente.
 * @param {string} discenteId - O ID do discente.
 * @returns {Promise<Array<object>>} Lista de metadados.
 */
export async function getTranscriptionsByDiscenteId(discenteId) {
  const normalizedDiscenteId = normalizeDiscenteId(discenteId);
  if (!normalizedDiscenteId) return [];

  try {
    const queryBuilder = (ref) =>
      ref.where('metadata.discenteId', '==', normalizedDiscenteId);
    const docs = await readTranscriptionMetadata(queryBuilder);
    if (docs.length > 0) {
      return docs.filter(
        (doc) => normalizeDiscenteId(doc?.metadata?.discenteId) === normalizedDiscenteId,
      );
    }

    // Fallback para casos legados com espaços/sufixos no ID (sem depender de índice composto).
    const allDocs = await readTranscriptionMetadata((ref) => ref);
    return allDocs.filter(
      (doc) => normalizeDiscenteId(doc?.metadata?.discenteId) === normalizedDiscenteId,
    );
  } catch (error) {
    console.error('ERRO ao buscar metadados no Firestore.', error);
    return [];
  }
}

/**
 * Busca todos os metadados de transcrição.
 * @returns {Promise<Array<object>>} Lista de todos os metadados.
 */
export async function getAllTranscriptionsMetadata() {
  try {
    const queryBuilder = (ref) => ref;
    return await readTranscriptionMetadata(queryBuilder);
  } catch (error) {
    console.error('ERRO ao buscar todos os metadados no Firestore.', error);
    return [];
  }
}

export async function getReportsOverviewCache() {
  try {
    const doc = await db
      .collection(OVERVIEW_CACHE_COLLECTION)
      .doc('current')
      .get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (error) {
    console.error('ERRO ao buscar cache do overview de relatórios.', error);
    return null;
  }
}

export async function setReportsOverviewCache(payload = {}) {
  try {
    await db.collection(OVERVIEW_CACHE_COLLECTION).doc('current').set(
      {
        ...(payload || {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('ERRO ao salvar cache do overview de relatórios.', error);
  }
}

/**
 * Remove metadados de uma transcrição pelo fileName (docId seguro).
 * @param {string} fileName
 */
export async function deleteTranscriptionMetadata(fileName) {
  if (!fileName) return;
  const safeId = fileName.replace(/[\/#?]+/g, '_');

  try {
    await db.collection(TRANSCRIPTION_METADATA_COLLECTION).doc(safeId).delete();

    console.log(`Metadados de transcrição removidos do Firestore: ${safeId}`);
  } catch (error) {
    console.error('ERRO ao remover metadados no Firestore.', error);
  }
}

export async function markReportsOverviewCacheDirty() {
  try {
    const doc = await db
      .collection(OVERVIEW_CACHE_COLLECTION)
      .doc('current')
      .get();

    const base = doc.exists ? doc.data() : {};
    const currentCount = Number(base?.pendingUpdates || 0) || 0;
    await db
      .collection(OVERVIEW_CACHE_COLLECTION)
      .doc('current')
      .set(
        {
          ...(base || {}),
          pendingUpdates: currentCount + 1,
          dirty: true,
          dirtySince: new Date().toISOString(),
          lastEventAt: new Date().toISOString(),
          updatedAt: base?.updatedAt || new Date().toISOString(),
          refreshScheduledAt: base?.refreshScheduledAt || null,
        },
        { merge: true },
      );
  } catch (error) {
    console.warn('Falha ao marcar cache do overview como stale:', error?.message);
  }
}
