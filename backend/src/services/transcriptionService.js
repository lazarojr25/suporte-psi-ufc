import dotenv from 'dotenv';
import {
  ANALYSIS_STATUS,
  DEFAULT_MODEL,
  TRANSCRIPTION_SUMMARY_SEPARATOR,
} from './transcription/constants/transcriptionConstants.js';
import { formatTranscriptionDocument } from './transcription/utils/transcriptionFormatter.js';
import TranscriptionStorage from './transcription/storage/transcriptionStorage.js';
import TranscriptionAiClient from './transcription/clients/transcriptionAiClient.js';
import TranscriptionMetadataRepository from './transcription/repositories/transcriptionMetadataRepository.js';
import { TRANSCRIPTION_ANALYSIS_PROMPT_VERSION } from './transcription/utils/transcriptionPrompt.js';
import { logTranscriptionProcessingError } from './firestoreService.js';

dotenv.config();

class TranscriptionService {
  constructor() {
    this.storage = new TranscriptionStorage();
    this.metadataRepository = new TranscriptionMetadataRepository();
    this.modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    this.aiClient = null;
  }

  _getAiClient() {
    if (!this.aiClient) {
      this.aiClient = new TranscriptionAiClient({
        modelName: this.modelName,
      });
    }
    return this.aiClient;
  }

  _normalizeAnalysis(analysis = null, fallbackError = null) {
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
      return fallbackError
        ? {
            schemaVersion: TRANSCRIPTION_ANALYSIS_PROMPT_VERSION,
            model: this.modelName,
            summary: `Falha ao gerar análise automática: ${fallbackError}`,
            sentiments: {
              positive: 0,
              neutral: 1,
              negative: 0,
            },
            summaryConfidence: 0,
            keywords: [],
            topics: [],
            actionableInsights: [],
            riskSignals: [],
            uncertainty: {
              nivel: 'alto',
              motivos: ['Falha durante análise automática'],
            },
            humanReviewRequired: true,
          }
        : null;
    }

    return {
      schemaVersion: analysis.schemaVersion || TRANSCRIPTION_ANALYSIS_PROMPT_VERSION,
      model: analysis.model || this.modelName,
      summary: analysis.summary || '',
      sentiments: analysis.sentiments || { positive: 0, neutral: 0, negative: 0 },
      summaryConfidence:
        typeof analysis.summaryConfidence === 'number' ? analysis.summaryConfidence : null,
      keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
      topics: Array.isArray(analysis.topics) ? analysis.topics : [],
      actionableInsights: Array.isArray(analysis.actionableInsights)
        ? analysis.actionableInsights
        : [],
      riskSignals: Array.isArray(analysis.riskSignals) ? analysis.riskSignals : [],
      uncertainty: analysis.uncertainty || null,
      humanReviewRequired: Boolean(analysis.humanReviewRequired),
      ...analysis,
    };
  }

  async deleteTranscription(fileName) {
    if (!fileName) {
      return { success: false, message: 'fileName é obrigatório' };
    }

    const metadataEntry = await this.metadataRepository.getByFileName(fileName);
    const storagePath = metadataEntry?.storage?.path || null;

    try {
      await this.storage.deleteFile(fileName, { storagePath });
    } catch (error) {
      console.warn('Falha ao remover arquivo de transcrição no storage:', error?.message);
    }

    await this.metadataRepository.delete(fileName);

    return { success: true };
  }

  async transcribeAudio(audioPath, outputFileName, extraInfo = {}) {
    let transcriptionText = '';
    let analysis = null;
    let analysisStatus = ANALYSIS_STATUS.OK;
    let transcriptionStatus = ANALYSIS_STATUS.OK;
    let analysisError = null;

    try {
      const aiClient = this._getAiClient();
      transcriptionText = await aiClient.transcribeAudio(audioPath);
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para transcrição:', error);
      analysisStatus = ANALYSIS_STATUS.FAILED;
      transcriptionStatus = ANALYSIS_STATUS.FAILED;
      analysisError = error?.message || 'Falha ao transcrever áudio.';
      transcriptionText = '';
    }

    if (outputFileName === null) {
      return {
        success: transcriptionStatus !== ANALYSIS_STATUS.FAILED,
        transcription: transcriptionText,
        analysis: null,
        analysisStatus:
          transcriptionStatus === ANALYSIS_STATUS.FAILED
            ? ANALYSIS_STATUS.FAILED
            : ANALYSIS_STATUS.SKIPPED,
        analysisError,
        metadata: null,
        fileName: null,
      };
    }

    if (analysisStatus === ANALYSIS_STATUS.FAILED) {
      return {
        success: false,
        error: analysisError,
        transcription: transcriptionText,
        analysis: null,
        analysisStatus,
        analysisError,
        metadata: null,
        fileName: outputFileName,
      };
    }

    try {
      const aiClient = this._getAiClient();
      analysis = await aiClient.analyzeText(transcriptionText);
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para análise:', error);
      analysisStatus = ANALYSIS_STATUS.FAILED;
      analysisError = error?.message || 'Falha ao analisar transcrição.';
    }
    const normalizedAnalysis =
      analysisStatus === ANALYSIS_STATUS.OK
        ? this._normalizeAnalysis(analysis)
        : null;

    const formatted = formatTranscriptionDocument(
      transcriptionText,
      extraInfo,
      normalizedAnalysis || {},
    );
    const storageInfo = await this.storage.writeText(outputFileName, formatted);
    const metadata = await this.metadataRepository.saveCombinedMetadata(
      outputFileName,
      formatted,
      extraInfo,
      normalizedAnalysis,
      analysisStatus,
      analysisError,
      {
        model: this.modelName,
        promptVersion: TRANSCRIPTION_ANALYSIS_PROMPT_VERSION,
      },
      storageInfo,
    );

    return {
      success: analysisStatus !== ANALYSIS_STATUS.FAILED,
      error: analysisStatus === ANALYSIS_STATUS.FAILED ? analysisError : null,
      transcription: transcriptionText,
      analysis: normalizedAnalysis,
      analysisStatus,
      analysisError,
      metadata,
      fileName: outputFileName,
    };
  }

  async saveFinalTranscription(outputFileName, mergedText, extraInfo = {}) {
    let analysis = null;
    let analysisStatus = ANALYSIS_STATUS.OK;
    let analysisError = null;

    try {
      const aiClient = this._getAiClient();
      analysis = await aiClient.analyzeText(mergedText);
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para análise:', error);
      analysisStatus = ANALYSIS_STATUS.FAILED;
      analysisError = error?.message || 'Falha ao analisar transcrição.';
    }
    const normalizedAnalysis =
      analysisStatus === ANALYSIS_STATUS.OK ? this._normalizeAnalysis(analysis) : null;

    const formatted = formatTranscriptionDocument(
      mergedText,
      extraInfo,
      normalizedAnalysis || {},
    );
    const storageInfo = await this.storage.writeText(outputFileName, formatted);
    const metadata = await this.metadataRepository.saveCombinedMetadata(
      outputFileName,
      formatted,
      extraInfo,
      normalizedAnalysis,
      analysisStatus,
      analysisError,
      {
        model: this.modelName,
        promptVersion: TRANSCRIPTION_ANALYSIS_PROMPT_VERSION,
      },
      storageInfo,
    );

    return {
      success: analysisStatus !== ANALYSIS_STATUS.FAILED,
      error: analysisStatus === ANALYSIS_STATUS.FAILED ? analysisError : null,
      transcription: mergedText,
      analysis: normalizedAnalysis,
      analysisStatus,
      analysisError,
      metadata,
      fileName: outputFileName,
    };
  }

  async analyzeTranscription(text) {
    const aiClient = this._getAiClient();
    return this._normalizeAnalysis(await aiClient.analyzeText(text));
  }

  async listTranscriptionsWithMetadata(filters = {}) {
    return this.metadataRepository.list(filters);
  }

  async listTranscriptions() {
    const list = await this.listTranscriptionsWithMetadata();
    return list.map((transcription) => ({
      fileName: transcription.fileName,
      createdAt: transcription.createdAt,
      size: transcription.size,
    }));
  }

  async getTranscription(fileName) {
    const metadata = await this.metadataRepository.getByFileName(fileName);
    const storagePath = metadata?.storage?.path || null;
    const content = await this.storage.readText(fileName, { storagePath });
    if (!content) return null;

    return {
      fileName,
      content,
      metadata: metadata?.metadata || {},
      analysis: metadata?.analysis || {},
    };
  }

  async reprocessTranscription(fileName) {
    const entry = await this.metadataRepository.getByFileName(fileName);
    const storagePath = entry?.storage?.path || null;
    if (!(await this.storage.fileExists(fileName, { storagePath }))) {
      return { success: false, message: 'Arquivo de transcrição não encontrado' };
    }

    const extraInfo = entry?.metadata || {};
    const fullContent = (await this.storage.readText(fileName, { storagePath })) || '';

    const separatorIndex = fullContent.indexOf(TRANSCRIPTION_SUMMARY_SEPARATOR);
    const content =
      separatorIndex !== -1
        ? fullContent.slice(separatorIndex + TRANSCRIPTION_SUMMARY_SEPARATOR.length).trimStart()
        : fullContent;

    let analysis = null;
    let analysisStatus = ANALYSIS_STATUS.OK;
    let analysisError = null;

    try {
      const aiClient = this._getAiClient();
      analysis = await aiClient.analyzeText(content);
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para análise:', error);
      analysisStatus = ANALYSIS_STATUS.FAILED;
      analysisError = error?.message || 'Falha ao analisar transcrição.';

      await logTranscriptionProcessingError({
        source: 'transcription-service',
        stage: 'reprocess',
        error,
        status: 'failed',
        errorType: 'analysis',
        retryable: false,
        meetingId: extraInfo?.meetingId || null,
        discenteId: extraInfo?.discenteId || null,
        solicitacaoId: extraInfo?.solicitacaoId || null,
        transcriptFileName: fileName,
        metadata: {
          fileName,
          stage: 'reprocess',
        },
      });
    }

    if (analysisStatus === ANALYSIS_STATUS.FAILED) {
      return {
        success: false,
        fileName,
        message: analysisError,
      };
    }

    const normalizedAnalysis = this._normalizeAnalysis(analysis, analysisError);
    const formatted = formatTranscriptionDocument(content, extraInfo, normalizedAnalysis || {});
    const storageInfo = await this.storage.writeText(fileName, formatted);
    await this.metadataRepository.saveCombinedMetadata(
      fileName,
      formatted,
      extraInfo,
      normalizedAnalysis,
      analysisStatus,
      analysisError,
      {
        model: this.modelName,
        promptVersion: TRANSCRIPTION_ANALYSIS_PROMPT_VERSION,
      },
      storageInfo,
    );

    return {
      success: true,
      fileName,
      analysis: normalizedAnalysis,
    };
  }
}

export default TranscriptionService;
