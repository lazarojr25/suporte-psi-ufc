import {
  saveTranscriptionMetadata,
  getAllTranscriptionsMetadata,
  deleteTranscriptionMetadata,
} from '../../firestoreService.js';

export default class TranscriptionMetadataRepository {
  constructor(storage) {
    this.storage = storage;
  }

  async list() {
    try {
      const firestoreMetadata = await getAllTranscriptionsMetadata();
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
    const entry = {
      fileName,
      size: content.length,
      createdAt: new Date().toISOString(),
      metadata: extraInfo,
      analysis,
      analysisStatus,
      analysisError,
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
