import {
  saveTranscriptionMetadata,
  getAllTranscriptionsMetadata,
  deleteTranscriptionMetadata,
  getTranscriptionsByDiscenteId,
} from '../../firestoreService.js';

export default class TranscriptionMetadataRepository {
  constructor(storage) {
    this.storage = storage;
  }

  async list(filters = {}) {
    const { discenteId } = filters;
    try {
      let firestoreMetadata = [];
      if (discenteId) {
        firestoreMetadata = await getTranscriptionsByDiscenteId(discenteId);
      } else {
        firestoreMetadata = await getAllTranscriptionsMetadata();
      }
      if (Array.isArray(firestoreMetadata) && firestoreMetadata.length > 0) {
        return firestoreMetadata;
      }
    } catch (error) {
      console.warn(
        'Falha ao carregar metadados do Firestore, usando fallback local.',
        error?.message,
      );
    }

    return Object.values(this.storage.loadMetadata());
  }

  async saveCombinedMetadata(fileName, content, extraInfo, analysis, analysisStatus = 'ok', analysisError = null) {
    const analysisMetadata = arguments[6] || {};

    const entry = {
      fileName,
      size: content.length,
      createdAt: new Date().toISOString(),
      metadata: extraInfo,
      analysis,
      analysisStatus,
      analysisError,
      analysisMetadata: {
        ...(analysisMetadata.model ? { model: analysisMetadata.model } : {}),
        ...(analysisMetadata.promptVersion
          ? { promptVersion: analysisMetadata.promptVersion }
          : {}),
        analyzedAt: new Date().toISOString(),
      },
    };

    try {
      const firestoreId = await saveTranscriptionMetadata(entry);
      if (firestoreId) {
        entry.firestoreId = firestoreId;
      }
    } catch (error) {
      console.warn(
        'Não foi possível salvar metadados no Firestore, usando fallback local.',
        error?.message,
      );
    }

    const metadata = this.storage.loadMetadata();
    metadata[fileName] = entry;
    this.storage.saveMetadata(metadata);

    return entry;
  }

  async delete(fileName) {
    const metadata = this.storage.loadMetadata();
    if (metadata[fileName]) {
      delete metadata[fileName];
      this.storage.saveMetadata(metadata);
    }

    try {
      await deleteTranscriptionMetadata(fileName);
    } catch (error) {
      console.warn('Falha ao remover metadados no Firestore:', error?.message);
    }
  }
}
