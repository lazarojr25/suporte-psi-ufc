import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { buildTranscriptionAnalysisPrompt } from '../utils/transcriptionPrompt.js';

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
    return JSON.parse(raw);
  }
}
