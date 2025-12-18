import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { GoogleGenAI } from '@google/genai';
import {
  saveTranscriptionMetadata,
  getAllTranscriptionsMetadata,
  deleteTranscriptionMetadata,
} from './firestoreService.js';

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

  formatTranscriptionDocument(transcription, extraInfo = {}, analysis = {}) {
    const headerLines = [];
    headerLines.push('=== Dados da sessão ===');
    if (extraInfo.studentName) headerLines.push(`Discente: ${extraInfo.studentName}`);
    if (extraInfo.studentId) headerLines.push(`Matrícula: ${extraInfo.studentId}`);
    if (extraInfo.curso) headerLines.push(`Curso: ${extraInfo.curso}`);
    if (extraInfo.sessionDate) headerLines.push(`Data da sessão: ${extraInfo.sessionDate}`);
    if (extraInfo.meetingId) headerLines.push(`Meeting ID: ${extraInfo.meetingId}`);
    if (extraInfo.solicitacaoId) headerLines.push(`Solicitação ID: ${extraInfo.solicitacaoId}`);

    const summaryBlock = [];
    summaryBlock.push('=== Resumo automático ===');
    if (analysis.summary) summaryBlock.push(`Resumo: ${analysis.summary}`);
    if (analysis.sentiments) {
      const s = analysis.sentiments;
      summaryBlock.push(
        `Sentimentos: +${((s.positive || 0) * 100).toFixed(1)}% / ~${((s.neutral || 0) * 100).toFixed(1)}% / -${((s.negative || 0) * 100).toFixed(1)}%`
      );
    }
    if (Array.isArray(analysis.keywords) && analysis.keywords.length) {
      summaryBlock.push(`Palavras-chave: ${analysis.keywords.join(', ')}`);
    }
    if (Array.isArray(analysis.topics) && analysis.topics.length) {
      summaryBlock.push(`Tópicos: ${analysis.topics.join(', ')}`);
    }
    if (Array.isArray(analysis.actionableInsights) && analysis.actionableInsights.length) {
      summaryBlock.push('Insights acionáveis:');
      analysis.actionableInsights.forEach((insight, idx) => {
        summaryBlock.push(`  ${idx + 1}. ${insight}`);
      });
    }

    const body = [
      headerLines.join('\n'),
      '',
      summaryBlock.join('\n'),
      '',
      '=== Transcrição ===',
      transcription,
    ];

    return body.join('\n');
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
   * Remove transcrição (arquivo + metadados em disco) e tenta apagar metadados no Firestore.
   */
  async deleteTranscription(fileName) {
    if (!fileName) {
      return { success: false, message: 'fileName é obrigatório' };
    }

    const filePath = path.join(this.transcriptionsDir, fileName);
    const metadataAll = this.loadMetadata();

    // remove arquivo local
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn('Falha ao remover arquivo de transcrição local:', err?.message);
    }

    // remove do cache local
    if (metadataAll[fileName]) {
      delete metadataAll[fileName];
      this.saveMetadata(metadataAll);
    }

    // remove no Firestore (best-effort)
    try {
      await deleteTranscriptionMetadata(fileName);
    } catch (err) {
      console.warn('Falha ao remover metadados no Firestore:', err?.message);
    }

    return { success: true };
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
                  'Tente separar falantes diferentes quando possível.  ' +
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
      // Remove arquivo enviado para o Gemini (quando disponível)
      try {
        if (uploadedFile?.name) {
          await this.ai.files.delete({ name: uploadedFile.name });
        }
      } catch (cleanupErr) {
        console.warn('Falha ao remover arquivo temporário no Gemini:', cleanupErr?.message);
      }
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
    const formatted = this.formatTranscriptionDocument(transcription, extraInfo, analysis);
    const metadata = await this.saveCombinedMetadata(
      outputFileName,
      formatted,
      extraInfo,
      analysis
    );

    const finalPath = path.join(this.transcriptionsDir, outputFileName);
    fs.writeFileSync(finalPath, formatted, 'utf-8');

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
    const formatted = this.formatTranscriptionDocument(mergedText, extraInfo, analysis);
    const metadata = await this.saveCombinedMetadata(
      outputFileName,
      formatted,
      extraInfo,
      analysis
    );

    const finalPath = path.join(this.transcriptionsDir, outputFileName);
    fs.writeFileSync(finalPath, formatted, 'utf-8');

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
    const prompt = `Analise o texto de uma transcrição de sessão psicológica e retorne APENAS um JSON com:
1. "sentiments": objeto { "positive": 0.0, "neutral": 0.0, "negative": 0.0 } (valores entre 0 e 1)
2. "keywords": até 10 palavras-chave ou frases (sem artigos/preposições isoladas)
3. "topics": até 5 tópicos principais
4. "summary": resumo conciso (máx. 3 frases)
5. "actionableInsights": 3 a 5 sugestões de ações/observações clínicas

Texto a ser analisado:
"${text}"

Retorne somente o JSON, sem markdown.`;

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

    try {
      const firestoreId = await saveTranscriptionMetadata(newEntry);
      if (firestoreId) {
        newEntry.firestoreId = firestoreId;
      }
    } catch (error) {
      console.warn('Não foi possível salvar metadados no Firestore, usando fallback local.', error?.message);
    }

    const metadata = this.loadMetadata();
    metadata[fileName] = newEntry;
    this.saveMetadata(metadata);

    return newEntry;
  }

  // Lista transcrições com metadados (tenta Firestore primeiro, fallback local)
  async listTranscriptionsWithMetadata() {
    try {
      const firestoreMetadata = await getAllTranscriptionsMetadata();
      if (Array.isArray(firestoreMetadata) && firestoreMetadata.length > 0) {
        return firestoreMetadata;
      }
    } catch (error) {
      console.warn('Falha ao carregar metadados do Firestore, usando fallback local.', error?.message);
    }

    const metadata = this.loadMetadata();
    return Object.values(metadata);
  }

  // Lista básica (nome + datas + tamanho)
  async listTranscriptions() {
    const list = await this.listTranscriptionsWithMetadata();
    return list.map((t) => ({
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
   * Reprocessa uma transcrição existente (reanálise e regravação formatada).
   */
  async reprocessTranscription(fileName) {
    const filePath = path.join(this.transcriptionsDir, fileName);
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'Arquivo de transcrição não encontrado' };
    }

    const metadataAll = this.loadMetadata();
    const entry = metadataAll[fileName];
    const extraInfo = entry?.metadata || {};
    const fullContent = fs.readFileSync(filePath, 'utf-8');
    // Se já estiver formatado, isola apenas a transcrição bruta para não duplicar cabeçalhos
    const separator = '=== Transcrição ===';
    const separatorIndex = fullContent.indexOf(separator);
    const content =
      separatorIndex !== -1
        ? fullContent.slice(separatorIndex + separator.length).trimStart()
        : fullContent;

    const analysis = await this.analyzeTranscription(content);
    const formatted = this.formatTranscriptionDocument(content, extraInfo, analysis);
    await this.saveCombinedMetadata(fileName, formatted, extraInfo, analysis);

    fs.writeFileSync(filePath, formatted, 'utf-8');

    return { success: true, fileName, analysis };
  }
}

export default TranscriptionService;
