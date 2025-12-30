import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import TranscriptionService from '../services/transcriptionService.js';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Conversão e segmentação
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const transcriptionService = new TranscriptionService();
const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos por etapa
let reprocessInFlight = false;
const reprocessLocks = new Set(); // evita reprocessamentos concorrentes por discente

// Firebase Admin (para vincular meeting/solicitação quando possível)
let db = null;
try {
  initializeApp({
    credential: applicationDefault(),
  });
  db = getFirestore();
} catch (error) {
  if (/already exists/u.test(error.message)) {
    db = getFirestore();
  } else {
    console.error('Erro ao inicializar Firebase Admin em transcription:', error);
  }
}

// -------------------- utils --------------------
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
const toSafeBase = (name) =>
  name.replace(/[^\w\d\-_.]+/g, '_').replace(/_+/g, '_');

const removeIfExists = (p) => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {} };
const removeDir = (dir) => { try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch {} };
const readFileSafe = (p) => {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch (e) {
    return null;
  }
};

// Critério para decidir se vale reprocessar (evita chamadas desnecessárias ao Gemini)
const shouldReprocessEntry = (entry, force = false) => {
  if (force) return true;
  if (!entry) return false;
  const hasAnalysis = !!entry.analysis;
  const hasSummary = !!entry.analysis?.summary;
  const hasSentiments = !!entry.analysis?.sentiments;
  // Reprocessa apenas se faltam dados essenciais
  return !hasAnalysis || !hasSummary || !hasSentiments;
};

// Dispara um reprocessamento assíncrono das transcrições do discente
const triggerDiscenteReprocess = async (discenteId, { force = false } = {}) => {
  if (!discenteId) return;
  if (reprocessLocks.has(discenteId) || reprocessInFlight) {
    console.log(`[reprocess] Ignorando (já em andamento) para discente ${discenteId}`);
    return;
  }
  reprocessLocks.add(discenteId);
  try {
    const list = await transcriptionService.listTranscriptionsWithMetadata();
    const filtered = list.filter(
      (t) => t.metadata?.discenteId === discenteId && shouldReprocessEntry(t, force)
    );
    for (const item of filtered) {
      await transcriptionService.reprocessTranscription(item.fileName);
    }
    console.log(`[reprocess] Finalizado para discente ${discenteId} (${filtered.length} transcrições)`);
  } catch (err) {
    console.error(`[reprocess] Falha ao reprocessar discente ${discenteId}:`, err?.message);
  } finally {
    reprocessLocks.delete(discenteId);
  }
};

// Converte qualquer mídia para WAV mono 16 kHz PCM s16le
const withTimeout = (command, reject) => {
  const timer = setTimeout(() => {
    try {
      command.kill('SIGKILL');
    } catch (e) {}
    reject(new Error('Tempo limite excedido ao processar mídia.'));
  }, FFMPEG_TIMEOUT_MS);

  command.on('end', () => clearTimeout(timer));
  command.on('error', () => clearTimeout(timer));
};

const convertToWav16kMono = (inputPath, outDir, baseName) =>
  new Promise((resolve, reject) => {
    ensureDir(outDir);
    const outPath = path.join(outDir, `${toSafeBase(baseName)}.wav`);

    const command = ffmpeg(inputPath)
      .outputOptions(['-ac', '1', '-ar', '16000', '-f', 'wav', '-acodec', 'pcm_s16le'])
      .on('error', reject)
      .on('end', () => resolve(outPath))
      .save(outPath);

    withTimeout(command, reject);
  });

// Segmenta WAV em partes de ~600s (≈ < 20MB por parte)
const segmentWav = (wavPath, outDir) =>
  new Promise((resolve, reject) => {
    ensureDir(outDir);
    const SEGMENT_SECONDS = 600; // 10 min
    const pattern = path.join(outDir, 'part-%03d.wav');

    const command = ffmpeg(wavPath)
      .outputOptions(['-f', 'segment', `-segment_time`, `${SEGMENT_SECONDS}`, '-c', 'copy'])
      .on('error', reject)
      .on('end', () => {
        const parts = fs.readdirSync(outDir)
          .filter(f => f.startsWith('part-') && f.endsWith('.wav'))
          .map(f => path.join(outDir, f))
          .sort();
        resolve(parts);
      })
      .save(pattern);

    withTimeout(command, reject);
  });

const updateMeetingSafe = async (meetingId, payload) => {
  if (!db || !meetingId) return;
  try {
    const meetingRef = db.collection('meetings').doc(meetingId);
    await meetingRef.update(payload);
  } catch (e) {
    console.warn('Não foi possível atualizar meeting:', e?.message);
  }
};

async function processMediaJob({ filePath, fileName, extraInfo, jobId }) {
  let workDir = null;
  let segDir = null;
  const originalPath = filePath;
  const baseName = path.basename(fileName, path.extname(fileName));

  try {
    workDir = path.join(__dirname, '../../work', baseName);
    segDir = path.join(workDir, 'segments');
    ensureDir(workDir);
    console.log(`[transcription-job ${jobId}] Iniciando processamento de ${fileName}`);

    // Marca meeting como em processamento (não bloqueante)
    updateMeetingSafe(extraInfo.meetingId, {
      status: 'em_processamento',
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    const wavPath = await convertToWav16kMono(originalPath, workDir, baseName);

    const wavStats = fs.statSync(wavPath);
    const wavSizeMB = wavStats.size / (1024 * 1024);
    const SEGMENT_THRESHOLD_MB = 90;

    let mergedText;
    let analysis = null;
    let finalMetadata = null;
    let finalFile;
    let partResults = [];

    const finalBaseName = buildTranscriptBaseName(extraInfo, toSafeBase(baseName));
    const finalFileName = `${finalBaseName}.txt`;

    if (wavSizeMB <= SEGMENT_THRESHOLD_MB) {
      console.log(
        `[transcription-job ${jobId}] Arquivo com ${wavSizeMB.toFixed(
          2
        )}MB, transcrevendo sem segmentação...`
      );

      const result = await transcriptionService.transcribeAudio(
        wavPath,
        finalFileName,
        extraInfo
      );

      if (!result.success) {
        throw new Error(result.error || 'Falha na transcrição do áudio.');
      }

      mergedText = result.transcription;
      analysis = result.analysis;
      finalMetadata = result.metadata;
      finalFile = result.fileName;
      partResults = [];
    } else {
      console.log(
        `[transcription-job ${jobId}] Arquivo com ${wavSizeMB.toFixed(
          2
        )}MB, segmentando em partes para transcrição...`
      );

      const parts = await segmentWav(wavPath, segDir);
      if (!parts.length) {
        throw new Error('Falha ao segmentar áudio (nenhuma parte gerada).');
      }

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const r = await transcriptionService.transcribeAudio(p, null, extraInfo);

        if (!r.success) {
          console.error('Erro na transcrição de parte:', p, r.error);
          throw new Error(`Erro na transcrição de uma das partes: ${p}`);
        }
        partResults.push(r);
      }

      mergedText = partResults.map((r) => r.transcription || '').join('\n\n');

      const result = await transcriptionService.saveFinalTranscription(
        finalFileName,
        mergedText,
        extraInfo
      );

      if (!result.success) {
        throw new Error(result.error || 'Falha ao salvar a transcrição final.');
      }

      mergedText = result.transcription;
      analysis = result.analysis;
      finalMetadata = result.metadata;
      finalFile = result.fileName;
    }

    if (db && extraInfo.meetingId) {
      await updateMeetingSafe(extraInfo.meetingId, {
        status: 'concluida',
        updatedAt: new Date().toISOString(),
        transcriptionFileName: finalFile,
        ...(extraInfo.discenteId ? { discenteId: extraInfo.discenteId } : {}),
        ...(extraInfo.studentEmail ? { studentEmail: extraInfo.studentEmail } : {}),
        ...(extraInfo.studentName ? { studentName: extraInfo.studentName } : {}),
        ...(extraInfo.curso ? { curso: extraInfo.curso } : {}),
        ...(extraInfo.solicitacaoId ? { solicitacaoId: extraInfo.solicitacaoId } : {}),
      });
    }

    if (extraInfo.discenteId) {
      triggerDiscenteReprocess(extraInfo.discenteId).catch((e) =>
        console.warn('Falha ao agendar reprocessamento automático:', e?.message)
      );
    }

    console.log(`[transcription-job ${jobId}] Concluído com sucesso (${finalFile})`);
    return {
      success: true,
      data: {
        fileName: finalFile,
        transcription: mergedText,
        parts: partResults.map((r, idx) => ({
          index: idx + 1,
          fileName: r.fileName,
          metadata: r.metadata || null,
        })),
        analysis: analysis || null,
        metadata: finalMetadata || null,
      },
    };
  } catch (error) {
    console.error(`[transcription-job ${jobId}] Erro no processamento:`, error);
    if (extraInfo.meetingId) {
      updateMeetingSafe(extraInfo.meetingId, {
        status: 'erro_transcricao',
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    return { success: false, message: error?.message || 'Erro no processamento de mídia' };
  } finally {
    if (originalPath) removeIfExists(originalPath);
    if (workDir) removeDir(workDir);
    if (segDir) removeDir(segDir);
  }
}

const startAsyncTranscriptionJob = (params) => {
  const jobId =
    params.jobId ||
    `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setImmediate(() => {
    processMediaJob({ ...params, jobId }).catch((err) =>
      console.error(`[transcription-job ${jobId}] Falha geral:`, err)
    );
  });
  return jobId;
};

// ---------------- multer (upload) ----------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `media-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  // Aceitamos arquivos maiores (vídeo)
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: function (req, file, cb) {
    const audioExts = ['.mp3', '.wav', '.m4a', '.ogg'];
    const videoExts = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];
    const allowed = [...audioExts, ...videoExts];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Tipo de arquivo não suportado: ${ext}. Permitidos: ${allowed.join(', ')}`));
  }
});

const textStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `transcript-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadText = multer({
  storage: textStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowedExt = ['.txt', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const mimeOk = mime === 'text/plain' || mime === 'application/msword' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (allowedExt.includes(ext) || mimeOk) cb(null, true);
    else cb(new Error('Tipo de arquivo não suportado. Envie .txt ou .docx/.doc de transcrição.'));
  }
});

// ---------------- rotas -------------------------

// POST /api/transcription/upload
// O campo FormData continua "audio" para manter compatibilidade com o frontend
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'Nenhum arquivo foi enviado' });
    }

    const {
      discenteId,
      solicitacaoId,
      meetingId,
      studentName,
      studentEmail,
      studentId: studentId,
      curso,
      sessionDate, // novo campo opcional (YYYY-MM-DD)
    } = req.body;

    const extraInfo = {
      discenteId: discenteId || null,
      solicitacaoId: solicitacaoId || null,
      meetingId: meetingId || null,
      studentName: studentName || null,
      studentEmail: studentEmail || null,
      matricula: studentId || null,
      curso: curso || null,
      sessionDate: sessionDate || null,
    };

    // Enriquecer metadados a partir do meeting, quando disponível
    if (db && meetingId) {
      try {
        const snap = await db.collection('meetings').doc(meetingId).get();
        if (snap.exists) {
          const data = snap.data() || {};
          extraInfo.discenteId = extraInfo.discenteId || data.discenteId || null;
          extraInfo.solicitacaoId = extraInfo.solicitacaoId || data.solicitacaoId || null;
          extraInfo.studentName = extraInfo.studentName || data.studentName || null;
          extraInfo.studentEmail = extraInfo.studentEmail || data.studentEmail || null;
          extraInfo.matricula = extraInfo.matricula || data.studentId || data.matricula || null;
          extraInfo.curso = extraInfo.curso || data.curso || null;
          extraInfo.sessionDate =
            extraInfo.sessionDate ||
            data.scheduledDate ||
            (data.dateTime ? new Date(data.dateTime).toISOString().slice(0, 10) : null);
        }
      } catch (e) {
        console.warn('Não foi possível enriquecer metadados a partir do meeting:', e?.message);
      }
    }

    const jobId = startAsyncTranscriptionJob({
      filePath: req.file.path,
      fileName: req.file.filename,
      extraInfo,
    });

    console.log(`[transcription-job ${jobId}] Arquivo recebido: ${req.file.filename}`);

    return res.status(202).json({
      success: true,
      processing: true,
      jobId,
      message: 'Arquivo recebido; processamento em segundo plano. Você pode continuar usando o sistema enquanto finalizamos.',
    });
  } catch (error) {
    console.error('Erro ao agendar processamento de mídia:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro no processamento de mídia',
      error: error.message,
    });
  }
});

// GET /api/transcription/list
router.get('/list', async (req, res) => {
  try {
    const transcriptions = await transcriptionService.listTranscriptionsWithMetadata();
    res.json({ success: true, data: transcriptions });
  } catch (error) {
    console.error('Erro ao listar transcrições:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar transcrições',
      error: error.message
    });
  }
});

// GET /api/transcription/by-discente/:discenteId
router.get('/by-discente/:discenteId', async (req, res) => {
  try {
    const { discenteId } = req.params;

    // usa a versão com metadados
    const all = await transcriptionService.listTranscriptionsWithMetadata();

    const filtered = all.filter(
      (t) => t.metadata?.discenteId === discenteId
    );

    res.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    console.error('Erro ao listar transcrições por discente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar transcrições por discente',
      error: error.message,
    });
  }
});

// GET /api/transcription/:fileName
router.get('/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const transcription = transcriptionService.getTranscription(fileName);
    if (transcription) res.json({ success: true, data: transcription });
    else res.status(404).json({ success: false, message: 'Transcrição não encontrada' });
  } catch (error) {
    console.error('Erro ao obter transcrição:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter transcrição',
      error: error.message
    });
  }
});

// POST /api/transcription/upload-text
// Recebe um .txt já transcrito (ex.: Meet) e apenas executa análise + salvamento.
router.post('/upload-text', uploadText.single('transcript'), async (req, res) => {
  let uploadedPath = null;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo .txt foi enviado.',
      });
    }

    uploadedPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let textContent = readFileSafe(uploadedPath);

    // Para Word, apenas uma extração simples (apenas texto sem formatação)
    if ((!textContent || !textContent.trim()) && (ext === '.docx' || ext === '.doc')) {
      try {
        // Lazy import para não quebrar se não estiver instalado
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ path: uploadedPath });
        textContent = result?.value || '';
      } catch (convErr) {
        console.warn('Falha ao extrair texto do Word:', convErr?.message);
      }
    }

    if (!textContent || !textContent.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo de transcrição vazio ou ilegível.',
      });
    }

    const {
      discenteId,
      solicitacaoId,
      meetingId,
      studentName,
      studentEmail,
      studentId,
      curso,
      sessionDate,
    } = req.body || {};

    const extraInfo = {
      discenteId: discenteId || null,
      solicitacaoId: solicitacaoId || null,
      meetingId: meetingId || null,
      studentName: studentName || null,
      studentEmail: studentEmail || null,
      matricula: studentId || null,
      curso: curso || null,
      sessionDate: sessionDate || null,
    };

    // Enriquecer metadados com meeting se possível
    if (db && meetingId) {
      try {
        const snap = await db.collection('meetings').doc(meetingId).get();
        if (snap.exists) {
          const data = snap.data() || {};
          extraInfo.discenteId = extraInfo.discenteId || data.discenteId || null;
          extraInfo.solicitacaoId = extraInfo.solicitacaoId || data.solicitacaoId || null;
          extraInfo.studentName = extraInfo.studentName || data.studentName || null;
          extraInfo.studentEmail = extraInfo.studentEmail || data.studentEmail || null;
          extraInfo.matricula = extraInfo.matricula || data.studentId || data.matricula || null;
          extraInfo.curso = extraInfo.curso || data.curso || null;
          extraInfo.sessionDate =
            extraInfo.sessionDate ||
            data.scheduledDate ||
            (data.dateTime ? new Date(data.dateTime).toISOString().slice(0, 10) : null);
        }
      } catch (e) {
        console.warn('Não foi possível enriquecer metadados a partir do meeting (upload-text):', e?.message);
      }
    }

    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const finalBaseName = buildTranscriptBaseName(extraInfo, toSafeBase(baseName));
    const finalFileName = `${finalBaseName}.txt`;

    const result = await transcriptionService.saveFinalTranscription(
      finalFileName,
      textContent,
      extraInfo
    );

    if (!result.success) {
      throw new Error(result.error || 'Falha ao processar transcrição.');
    }

    // Atualiza meeting se aplicável
    if (db && meetingId) {
      try {
        const meetingRef = db.collection('meetings').doc(meetingId);
        const updatePayload = {
          status: 'concluida',
          updatedAt: new Date().toISOString(),
          transcriptionFileName: finalFileName,
        };
        if (extraInfo.discenteId) updatePayload.discenteId = extraInfo.discenteId;
        if (extraInfo.studentEmail) updatePayload.studentEmail = extraInfo.studentEmail;
        if (extraInfo.studentName) updatePayload.studentName = extraInfo.studentName;
        if (extraInfo.curso) updatePayload.curso = extraInfo.curso;
        if (extraInfo.solicitacaoId) updatePayload.solicitacaoId = extraInfo.solicitacaoId;
        await meetingRef.update(updatePayload);
      } catch (e) {
        console.warn('Não foi possível atualizar meeting após upload-text:', e?.message);
      }
    }

    res.json({
      success: true,
      message: 'Transcrição pronta processada com sucesso',
      data: {
        fileName: finalFileName,
        analysis: result.analysis,
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error('Erro ao processar transcrição pronta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar transcrição pronta',
      error: error.message,
    });
  } finally {
    if (uploadedPath) removeIfExists(uploadedPath);
  }
});

// DELETE /api/transcription/:fileName - remove arquivo e metadados
router.delete('/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const result = await transcriptionService.deleteTranscription(fileName);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    res.json({ success: true, message: 'Transcrição removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover transcrição:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover transcrição',
      error: error.message,
    });
  }
});

// POST /api/transcription/analyze
router.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Texto é obrigatório para análise' });

    const analysis = await transcriptionService.analyzeTranscription(text);
    res.json({ success: true, data: { analysis, originalText: text } });
  } catch (error) {
    console.error('Erro na análise:', error);
    res.status(500).json({
      success: false,
      message: 'Erro na análise do texto',
      error: error.message
    });
  }
});

// POST /api/transcription/reprocess-all
router.post('/reprocess-all', async (req, res) => {
  try {
    if (reprocessInFlight) {
      return res.status(429).json({
        success: false,
        message: 'Há um reprocessamento em andamento. Tente novamente em instantes.',
      });
    }
    reprocessInFlight = true;
    const { discenteId, force = false } = req.body || {};
    const list = await transcriptionService.listTranscriptionsWithMetadata();
    const filtered = discenteId
      ? list.filter((t) => t.metadata?.discenteId === discenteId && shouldReprocessEntry(t, force))
      : list.filter((t) => shouldReprocessEntry(t, force));

    const results = [];
    for (const item of filtered) {
      const r = await transcriptionService.reprocessTranscription(item.fileName);
      results.push({ fileName: item.fileName, success: r.success, message: r.message || null });
    }

    res.json({
      success: true,
      total: filtered.length,
      results,
    });
  } catch (error) {
    console.error('Erro ao reprocessar transcrições:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao reprocessar transcrições',
      error: error.message,
    });
  } finally {
    reprocessInFlight = false;
  }
});

// Gera um "slug" seguro com nome do aluno + data (YYYY-MM-DD)
function buildTranscriptBaseName(extraInfo, fallbackBaseName) {
  const rawName = extraInfo.studentName || 'discente';
  const rawId = extraInfo.matricula || '';       // matrícula
  const sessionDate =
    extraInfo.sessionDate ||
    new Date().toISOString().slice(0, 10);      // yyyy-mm-dd

  // normaliza nome (remove acentos e caracteres estranhos)
  const safeName =
    rawName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')          // tira acentos
      .replace(/[^a-zA-Z0-9]+/g, '_')           // troca espaços e símbolos por _
      .replace(/^_+|_+$/g, '')                  // tira _ no começo/fim
    || 'discente';

  // matrícula: só números/letras
  const safeId = rawId
    .toString()
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim();

  // data só com dígitos: 2024-11-27 -> 20241127
  const safeDate = sessionDate.replace(/[^0-9]/g, '');

  // monta: NomeAluno_123456_20241127_sessao
  let base = safeName;
  if (safeId) base += `_${safeId}`;
  if (safeDate) base += `_${safeDate}`;
  base += '_sessao';

  // se por algum motivo ficar vazio, usa fallback
  return base || fallbackBaseName || 'transcricao';
}

export default router;
