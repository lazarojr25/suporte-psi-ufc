import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import {
  buildTranscriptionAnalysisPrompt,
  TRANSCRIPTION_ANALYSIS_PROMPT_VERSION,
} from '../utils/transcriptionPrompt.js';

dotenv.config();

const getApiKey = () => process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

export default class TranscriptionAiClient {
  constructor({ modelName }) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error(
        'Chave da API Gemini não encontrada. Defina GOOGLE_AI_API_KEY ou GEMINI_API_KEY no .env.',
      );
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  extractResponseText(result) {
    return typeof result.text === 'function'
      ? result.text()
      : result.text ||
          (result.response && typeof result.response.text === 'function'
            ? result.response.text()
            : '');
  }

  _cleanJsonText(rawText) {
    if (!rawText) return '';
    const normalized = rawText.trim();
    if (normalized.startsWith('```')) {
      const withoutFence = normalized.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/m, '');
      return withoutFence.trim();
    }
    return normalized;
  }

  _extractJson(rawText) {
    const cleaned = this._cleanJsonText(rawText);
    if (!cleaned) return null;

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const candidate = cleaned.slice(start, end + 1);
        return JSON.parse(candidate);
      }
      throw error;
    }
  }

  async transcribeAudio(audioPath, mimeType = 'audio/wav') {
    let uploadedFile = null;
    try {
      uploadedFile = await this.ai.files.upload({
        file: audioPath,
        mimeType,
      });

      const result = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'Transcreva o áudio anexo em português brasileiro. ' +
                  'Tente separar falantes diferentes quando possível.  ' +
                  'O resultado deve ser apenas o texto da transcrição, sem introduções ou comentários.',
              },
              {
                fileData: {
                  mimeType: uploadedFile.mimeType || mimeType,
                  fileUri: uploadedFile.uri,
                },
              },
            ],
          },
        ],
      });

      const rawText = this.extractResponseText(result);
      const transcription = (rawText || '').trim();

      if (!transcription) {
        throw new Error('Transcrição vazia retornada pelo modelo.');
      }

      return transcription;
    } finally {
      try {
        if (uploadedFile?.name) {
          await this.ai.files.delete({ name: uploadedFile.name });
        }
      } catch (cleanupErr) {
        console.warn(
          'Falha ao remover arquivo temporário no Gemini:',
          cleanupErr?.message,
        );
      }
    }
  }

  async analyzeText(text) {
    const result = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [{ role: 'user', parts: [{ text: buildTranscriptionAnalysisPrompt(text) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const raw = this.extractResponseText(result);
    const parsed = this._extractJson(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Gemini retornou resposta JSON inválida para análise.');
    }

    return {
      ...parsed,
      schemaVersion: parsed.schemaVersion || TRANSCRIPTION_ANALYSIS_PROMPT_VERSION,
      model: parsed.model || this.modelName,
    };
  }
}
