import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { GoogleGenAI } from '@google/genai';
import { saveTranscriptionMetadata } from './firestoreService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TranscriptionService {
  constructor() {
    // Diretório onde as transcrições são salvas (apenas o conteúdo)
    this.transcriptionsDir = path.join(__dirname, '..', 'transcriptions');
    this.ensureDir(this.transcriptionsDir);
    // Metadados e análises – fallback local em metadata.json
    this.metadataFile = path.join(this.transcriptionsDir, 'metadata.json');

    // ---- Configuração da chave do Gemini ----
    const apiKey =
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Chave da API Gemini não encontrada. Defina GOOGLE_AI_API_KEY ou GEMINI_API_KEY no .env.'
      );
    }

    // Cliente único do Gemini pra toda a service
    this.ai = new GoogleGenAI({ apiKey });
    // Nome do modelo (pode sobrescrever via .env se quiser)
    this.modelName = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Fallback local – leitura de metadados de metadata.json
  loadMetadata() {
    if (fs.existsSync(this.metadataFile)) {
      const data = fs.readFileSync(this.metadataFile, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  }

  // Fallback local – escrita em metadata.json
  saveMetadata(metadata) {
    fs.writeFileSync(
      this.metadataFile,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );
  }

  /**
   * Transcreve um arquivo de áudio usando Gemini.
   * Se outputFileName === null, significa que é apenas um "chunk"
   * (retorna só o texto, sem salvar arquivo nem metadados).
   */
  async transcribeAudio(audioPath, outputFileName, extraInfo = {}) {
    let transcriptionText = '';
    let uploadedFile = null;

    try {
      // Upload do arquivo já convertido para WAV 16k mono
      uploadedFile = await this.ai.files.upload({
        file: audioPath,
        mimeType: 'audio/wav',
      });

      // Chamada ao modelo de transcrição
      const result = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'Transcreva o áudio anexo em português brasileiro. ' +
                  'O resultado deve ser apenas o texto da transcrição, sem introduções ou comentários.',
              },
              {
                fileData: {
                  mimeType: uploadedFile.mimeType || 'audio/wav',
                  fileUri: uploadedFile.uri,
                },
              },
            ],
          },
        ],
      });

      // A API do @google/genai pode expor o texto de formas diferentes
      const rawText =
        typeof result.text === 'function'
          ? result.text()
          : result.text ||
            (result.response && typeof result.response.text === 'function'
              ? result.response.text()
              : '');

      transcriptionText = (rawText || '').trim();
      if (!transcriptionText) {
        throw new Error('Transcrição vazia retornada pelo modelo.');
      }
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para transcrição:', error);
      // Fallback pra não quebrar o fluxo
      transcriptionText = `[ERRO NA TRANSCRIÇÃO: ${error.message}] Simulação de transcrição para ${path.basename(
        audioPath
      )}.`;
    } finally {
      // Aqui você poderia apagar o arquivo remoto se a API suportar isso.
      // Ex.: await this.ai.files.delete({ name: uploadedFile.name });
    }

    const transcription = transcriptionText;

    // Caso seja apenas um chunk (parte de áudio longo),
    // não salva em disco nem faz análise aqui.
    if (outputFileName === null) {
      return {
        success: true,
        transcription,
        analysis: null,
        metadata: null,
        fileName: null,
      };
    }

    // Transcrição final: analisa e salva
    const analysis = await this.analyzeTranscription(transcription);
    const metadata = await this.saveCombinedMetadata(
      outputFileName,
      transcription,
      extraInfo,
      analysis
    );

    const finalPath = path.join(this.transcriptionsDir, outputFileName);
    fs.writeFileSync(finalPath, transcription, 'utf-8');

    return {
      success: true,
      transcription,
      analysis,
      metadata,
      fileName: outputFileName,
    };
  }

  /**
   * Salva a transcrição já unificada (depois de juntar partes)
   * e faz a análise com Gemini.
   */
  async saveFinalTranscription(outputFileName, mergedText, extraInfo = {}) {
    const analysis = await this.analyzeTranscription(mergedText);
    const metadata = await this.saveCombinedMetadata(
      outputFileName,
      mergedText,
      extraInfo,
      analysis
    );

    const finalPath = path.join(this.transcriptionsDir, outputFileName);
    fs.writeFileSync(finalPath, mergedText, 'utf-8');

    return {
      success: true,
      transcription: mergedText,
      analysis,
      metadata,
      fileName: outputFileName,
    };
  }

  /**
   * Analisa a transcrição com Gemini: sentimentos, keywords, tópicos, resumo…
   */
  async analyzeTranscription(text) {
    const prompt = `Analise o texto da transcrição a seguir e retorne um objeto JSON com as seguintes chaves:
1. "sentiments": objeto { "positive": 0.0, "neutral": 0.0, "negative": 0.0 }
2. "keywords": array de até 10 palavras-chave ou frases importantes (sem artigos/preposições isoladas)
3. "topics": array de até 5 tópicos principais
4. "summary": resumo conciso (máx. 3 frases)
5. "actionableInsights": array de 3 a 5 sugestões de ações ou observações para o profissional

Texto a ser analisado:
"${text}"

Retorne APENAS o JSON, sem markdown ou texto extra.`;

    try {
      const result = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // nome correto da config na lib nova é “generationConfig”
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const raw =
        typeof result.text === 'function'
          ? result.text()
          : result.text ||
            (result.response && typeof result.response.text === 'function'
              ? result.response.text()
              : '');

      const analysis = JSON.parse(raw);
      return analysis;
    } catch (error) {
      console.error('Erro ao chamar a API do Gemini para análise:', error);
      // Fallback em caso de falha
      return {
        sentiments: { positive: 0.5, neutral: 0.3, negative: 0.2 },
        keywords: ['erro', 'analise_falhou', 'simulacao'],
        topics: ['erro_api', 'fallback'],
        summary:
          'Resumo simulado devido a falha na análise automática do Gemini.',
        actionableInsights: [
          'Verificar logs da API do Gemini.',
          'Tentar novamente mais tarde.',
          'Avaliar manualmente o conteúdo desta sessão.',
        ],
      };
    }
  }

  /**
   * Salva metadados combinados (upload + análise) no Firestore
   * e também em metadata.json como fallback.
   */
  async saveCombinedMetadata(fileName, content, extraInfo, analysis) {
    const newEntry = {
      fileName,
      size: content.length,
      createdAt: new Date().toISOString(),
      metadata: extraInfo,
      analysis,
    };


    const metadata = this.loadMetadata();
    metadata[fileName] = newEntry;
    this.saveMetadata(metadata);

    return newEntry;
  }

  // Lista transcrições com metadados (fallback local)
  listTranscriptionsWithMetadata() {
    const metadata = this.loadMetadata();
    return Object.values(metadata);
  }

  // Lista básica (nome + datas + tamanho)
  listTranscriptions() {
    return this.listTranscriptionsWithMetadata().map((t) => ({
      fileName: t.fileName,
      createdAt: t.createdAt,
      size: t.size,
    }));
  }

  // Retorna o conteúdo completo de uma transcrição
  getTranscription(fileName) {
    const filePath = path.join(this.transcriptionsDir, fileName);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const metadata = this.loadMetadata()[fileName];
      return {
        fileName,
        content,
        metadata: metadata?.metadata || {},
        analysis: metadata?.analysis || {},
      };
    }
    return null;
  }

  /**
   * Ainda deixei a análise de histórico como “fake” pra não quebrar as rotas.
   * Se quiser usar Gemini aqui também, aí a gente marca como async e ajusta o reports.js pra usar await.
   */
  analyzeDiscenteHistory(fullHistoryText) {
    return {
      mainTopics: ['tópico A', 'tópico B'],
      sentimentTrend: 'estável',
      longTermSummary:
        'Análise de histórico simulada. Aqui entrariam padrões ao longo das sessões.',
      riskAssessment: 'Desconhecido',
    };
  }
}

export default TranscriptionService;
