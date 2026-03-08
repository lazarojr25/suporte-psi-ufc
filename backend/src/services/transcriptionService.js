import path from 'path';
import dotenv from 'dotenv';
import {
  ANALYSIS_STATUS,
  DEFAULT_MODEL,
  TRANSCRIPTION_SUMMARY_SEPARATOR,
  getTranscriptionsDir,
} from './transcription/constants/transcriptionConstants.js';
import { formatTranscriptionDocument } from './transcription/utils/transcriptionFormatter.js';
import TranscriptionStorage from './transcription/storage/transcriptionStorage.js';
import TranscriptionAiClient from './transcription/clients/transcriptionAiClient.js';
import TranscriptionMetadataRepository from './transcription/repositories/transcriptionMetadataRepository.js';

dotenv.config();

class TranscriptionService {
  constructor() {
    // Diretório onde as transcrições são salvas (apenas o conteúdo)
    this.transcriptionsDir = getTranscriptionsDir();
    this.storage = new TranscriptionStorage(this.transcriptionsDir);
    this.metadataRepository = new TranscriptionMetadataRepository(this.storage);

    this.aiClient = new TranscriptionAiClient({
      modelName: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    });
  }

  async deleteTranscription(fileName) {
    if (!fileName) {
      return { success: false, message: 'fileName é obrigatório' };
    }

    try {
      this.storage.deleteFile(fileName);
    } catch (error) {
      console.warn('Falha ao remover arquivo de transcrição local:', error?.message);
    }

    await this.metadataRepository.delete(fileName);

    return { success: true };
  }

  async transcribeAudio(audioPath, outputFileName, extraInfo = {}) {
    let transcriptionText = '';
    let analysis = null;
    let analysisStatus = ANALYSIS_STATUS.OK;
    let analysisError = null;

    try {
      transcriptionText = await this.aiClient.transcribeAudio(audioPath);
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para transcrição:', error);
      transcriptionText = `[ERRO NA TRANSCRIÇÃO: ${error.message}] Simulação de transcrição para ${path.basename(
        audioPath,
      )}.`;
    }

    if (outputFileName === null) {
      return {
        success: true,
        transcription: transcriptionText,
        analysis: null,
        analysisStatus: ANALYSIS_STATUS.SKIPPED,
        analysisError: null,
        metadata: null,
        fileName: null,
      };
    }

    try {
      analysis = await this.aiClient.analyzeText(transcriptionText);
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para análise:', error);
      analysisStatus = ANALYSIS_STATUS.FAILED;
      analysisError = error?.message || 'Falha ao analisar transcrição.';
    }

    const formatted = formatTranscriptionDocument(
      transcriptionText,
      extraInfo,
      analysis || {},
    );
    const metadata = await this.metadataRepository.saveCombinedMetadata(
      outputFileName,
      formatted,
      extraInfo,
      analysis,
      analysisStatus,
      analysisError,
    );

    this.storage.writeText(outputFileName, formatted);

    return {
      success: analysisStatus !== ANALYSIS_STATUS.FAILED,
      error: analysisStatus === ANALYSIS_STATUS.FAILED ? analysisError : null,
      transcription: transcriptionText,
      analysis,
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
      analysis = await this.aiClient.analyzeText(mergedText);
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para análise:', error);
      analysisStatus = ANALYSIS_STATUS.FAILED;
      analysisError = error?.message || 'Falha ao analisar transcrição.';
    }

    const formatted = formatTranscriptionDocument(
      mergedText,
      extraInfo,
      analysis || {},
    );
    const metadata = await this.metadataRepository.saveCombinedMetadata(
      outputFileName,
      formatted,
      extraInfo,
      analysis,
      analysisStatus,
      analysisError,
    );

    this.storage.writeText(outputFileName, formatted);

    return {
      success: analysisStatus !== ANALYSIS_STATUS.FAILED,
      error: analysisStatus === ANALYSIS_STATUS.FAILED ? analysisError : null,
      transcription: mergedText,
      analysis,
      analysisStatus,
      analysisError,
      metadata,
      fileName: outputFileName,
    };
  }

  async analyzeTranscription(text) {
    return await this.aiClient.analyzeText(text);
  }

  async listTranscriptionsWithMetadata() {
    return this.metadataRepository.list();
  }

  async listTranscriptions() {
    const list = await this.listTranscriptionsWithMetadata();
    return list.map((transcription) => ({
      fileName: transcription.fileName,
      createdAt: transcription.createdAt,
      size: transcription.size,
    }));
  }

  getTranscription(fileName) {
    const content = this.storage.readText(fileName);
    if (!content) return null;

    const metadata = this.storage.loadMetadata()[fileName];
    return {
      fileName,
      content,
      metadata: metadata?.metadata || {},
      analysis: metadata?.analysis || {},
    };
  }

  async reprocessTranscription(fileName) {
    if (!this.storage.fileExists(fileName)) {
      return { success: false, message: 'Arquivo de transcrição não encontrado' };
    }

    const metadataAll = this.storage.loadMetadata();
    const entry = metadataAll[fileName];
    const extraInfo = entry?.metadata || {};
    const fullContent = this.storage.readText(fileName) || '';

    const separatorIndex = fullContent.indexOf(TRANSCRIPTION_SUMMARY_SEPARATOR);
    const content =
      separatorIndex !== -1
        ? fullContent.slice(separatorIndex + TRANSCRIPTION_SUMMARY_SEPARATOR.length).trimStart()
        : fullContent;

    let analysis = null;
    let analysisStatus = ANALYSIS_STATUS.OK;
    let analysisError = null;

    try {
      analysis = await this.aiClient.analyzeText(content);
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para análise:', error);
      analysisStatus = ANALYSIS_STATUS.FAILED;
      analysisError = error?.message || 'Falha ao analisar transcrição.';
    }

    if (analysisStatus === ANALYSIS_STATUS.FAILED) {
      return {
        success: false,
        fileName,
        message: analysisError,
      };
    }

    const formatted = formatTranscriptionDocument(content, extraInfo, analysis || {});
    await this.metadataRepository.saveCombinedMetadata(
      fileName,
      formatted,
      extraInfo,
      analysis,
      analysisStatus,
      analysisError,
    );
    this.storage.writeText(fileName, formatted);

    return {
      success: true,
      fileName,
      analysis,
    };
  }
}

export default TranscriptionService;
