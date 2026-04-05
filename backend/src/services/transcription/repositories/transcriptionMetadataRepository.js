import {
  saveTranscriptionMetadata,
  getAllTranscriptionsMetadata,
  deleteTranscriptionMetadata,
  getTranscriptionsByDiscenteId,
  getTranscriptionMetadataByFileName,
  markReportsOverviewCacheDirty,
} from '../../firestoreService.js';

const normalizeDiscenteId = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).trim();
};

export default class TranscriptionMetadataRepository {
  async list(filters = {}) {
    const { discenteId } = filters;
    const normalizedDiscenteId = normalizeDiscenteId(discenteId);
    let firestoreMetadata = [];

    if (discenteId) {
      firestoreMetadata = await getTranscriptionsByDiscenteId(discenteId);
    } else {
      firestoreMetadata = await getAllTranscriptionsMetadata();
    }

    if (!normalizedDiscenteId) {
      return Array.isArray(firestoreMetadata) ? firestoreMetadata : [];
    }

    return (Array.isArray(firestoreMetadata) ? firestoreMetadata : []).filter(
      (entry) =>
        normalizeDiscenteId(entry?.discenteId || entry?.metadata?.discenteId) ===
        normalizedDiscenteId,
    );
  }

  async getByFileName(fileName) {
    if (!fileName) return null;

    const firestoreEntry = await getTranscriptionMetadataByFileName(fileName);
    return firestoreEntry || null;
  }

  async saveCombinedMetadata(
    fileName,
    content,
    extraInfo,
    analysis,
    analysisStatus = 'ok',
    analysisError = null,
    analysisMetadata = {},
    storageInfo = null,
  ) {
    const existingEntry = await this.getByFileName(fileName);
    const nowIso = new Date().toISOString();
    const discenteId = normalizeDiscenteId(extraInfo?.discenteId);
    const meetingId = normalizeDiscenteId(extraInfo?.meetingId);
    const solicitacaoId = normalizeDiscenteId(extraInfo?.solicitacaoId);
    const storagePayload =
      storageInfo && typeof storageInfo === 'object'
        ? {
            provider: storageInfo.provider || 'firebase-storage',
            bucket: storageInfo.bucket || null,
            path: storageInfo.path || null,
          }
        : null;

    const entry = {
      fileName,
      size:
        typeof storageInfo?.size === 'number'
          ? storageInfo.size
          : Buffer.byteLength(content || '', 'utf-8'),
      createdAt: existingEntry?.createdAt || nowIso,
      updatedAt: nowIso,
      transcriptionId: fileName,
      discenteId,
      meetingId,
      solicitacaoId,
      metadata: extraInfo,
      analysis,
      analysisStatus,
      analysisError,
      storage: storagePayload,
      analysisMetadata: {
        ...(analysisMetadata.model ? { model: analysisMetadata.model } : {}),
        ...(analysisMetadata.promptVersion
          ? { promptVersion: analysisMetadata.promptVersion }
          : {}),
        analyzedAt: nowIso,
      },
    };

    const firestoreId = await saveTranscriptionMetadata(entry);
    if (firestoreId) {
      entry.firestoreId = firestoreId;
    }

    markReportsOverviewCacheDirty();

    return entry;
  }

  async delete(fileName) {
    await deleteTranscriptionMetadata(fileName);
  }
}
