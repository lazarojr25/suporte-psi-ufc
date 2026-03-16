import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import TranscriptionService from '../services/transcriptionService.js';
import { getAdminDb } from '../firebaseAdmin.js';
import TranscriptionMediaJobService from '../services/transcription/transcriptionMediaJobService.js';
import {
  buildTranscriptBaseName,
  enrichExtraInfoFromMeeting,
  ensureDir,
  isSafeFileName,
  removeIfExists,
  toSafeBase,
} from '../services/transcription/transcriptionHelpers.js';
import { extractTranscriptTextFromUpload } from '../services/transcription/transcriptTextExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const transcriptionService = new TranscriptionService();
const transcriptionMediaJobService = new TranscriptionMediaJobService(
  transcriptionService,
  {
    workDirectory: path.join(__dirname, '../..'),
  },
);

let db = null;
try {
  db = getAdminDb();
} catch (error) {
  console.error('Erro ao inicializar Firebase Admin em transcription:', error);
}

const updateMeetingSafe = async (meetingId, payload) => {
  if (!db || !meetingId) return;

  const updateIn = async (collectionName) => {
    const meetingRef = db.collection(collectionName).doc(meetingId);
    const snap = await meetingRef.get();
    if (!snap.exists) return false;
    await meetingRef.update(payload);
    return true;
  };

  try {
    const updated =
      (await updateIn('encontros')) || (await updateIn('meetings'));

    if (!updated) {
      throw new Error('Encontro não encontrado na coleção nova nem na legada.');
    }
  } catch (e) {
    console.warn('Não foi possível atualizar meeting:', e?.message);
  }
};

// -------------------- multer (upload) ----------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `media-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: function (req, file, cb) {
    const audioExts = ['.mp3', '.wav', '.m4a', '.ogg'];
    const videoExts = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];
    const allowed = [...audioExts, ...videoExts];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowed.includes(ext)) cb(null, true);
    else
      cb(
        new Error(
          `Tipo de arquivo não suportado: ${ext}. Permitidos: ${allowed.join(', ')}`,
        ),
      );
  },
});

const textStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `transcript-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const uploadText = multer({
  storage: textStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowedExt = ['.txt', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const mimeOk =
      mime === 'text/plain' ||
      mime === 'application/msword' ||
      mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (allowedExt.includes(ext) || mimeOk) cb(null, true);
    else cb(new Error('Tipo de arquivo não suportado. Envie .txt ou .docx/.doc de transcrição.'));
  },
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
      sessionDate,
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

    await enrichExtraInfoFromMeeting(db, meetingId, extraInfo, 'upload');

    const jobId = transcriptionMediaJobService.startAsyncTranscriptionJob(
      {
        filePath: req.file.path,
        fileName: req.file.filename,
        extraInfo,
      },
      { updateMeetingSafe },
    );

    console.log(`[transcription-job ${jobId}] Arquivo recebido: ${req.file.filename}`);

    return res.status(202).json({
      success: true,
      processing: true,
      jobId,
      message:
        'Arquivo recebido; processamento em segundo plano. Você pode continuar usando o sistema enquanto finalizamos.',
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
      error: error.message,
    });
  }
});

// GET /api/transcription/by-discente/:discenteId
router.get('/by-discente/:discenteId', async (req, res) => {
  try {
    const { discenteId } = req.params;
    const filtered = await transcriptionService.listTranscriptionsWithMetadata({
      discenteId,
    });

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
    if (!isSafeFileName(fileName)) {
      return res
        .status(400)
        .json({ success: false, message: 'fileName inválido.' });
    }
    const transcription = transcriptionService.getTranscription(fileName);
    if (transcription) res.json({ success: true, data: transcription });
    else
      res
        .status(404)
        .json({ success: false, message: 'Transcrição não encontrada' });
  } catch (error) {
    console.error('Erro ao obter transcrição:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter transcrição',
      error: error.message,
    });
  }
});

// POST /api/transcription/upload-text
// Recebe um .txt já transcrito (ex.: Meet) e apenas executa análise + salvamento.
router.post('/upload-text', uploadText.single('transcript'), async (req, res) => {
  let uploadedPath = null;
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Nenhum arquivo .txt foi enviado.',
        });
    }

    uploadedPath = req.file.path;
    let textContent = await extractTranscriptTextFromUpload(
      uploadedPath,
      req.file.originalname,
    );

    if (!textContent || !textContent.trim()) {
      return res
        .status(400)
        .json({
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

    await enrichExtraInfoFromMeeting(db, meetingId, extraInfo, 'upload-text');

    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const finalBaseName = buildTranscriptBaseName(extraInfo, toSafeBase(baseName));
    const finalFileName = `${finalBaseName}.txt`;

    const result = await transcriptionService.saveFinalTranscription(
      finalFileName,
      textContent,
      extraInfo,
    );

    if (!result.success) {
      if (db && meetingId) {
        try {
          await updateMeetingSafe(meetingId, {
            status: 'erro_transcricao',
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Não foi possível atualizar meeting após falha de análise:', e?.message);
        }
      }

      return res.status(200).json({
        success: false,
        message: result.error || 'Falha ao analisar transcrição.',
        data: {
          fileName: result.fileName || finalFileName,
          analysisStatus: result.analysisStatus || 'failed',
          analysisError: result.analysisError || result.error || null,
        },
      });
    }

    if (db && meetingId) {
      try {
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
        await updateMeetingSafe(meetingId, updatePayload);
      } catch (e) {
        console.warn('Não foi possível atualizar encontro após upload-text:', e?.message);
      }
    }

    res.json({
      success: true,
      message: 'Transcrição pronta processada com sucesso',
      data: {
        fileName: finalFileName,
        analysis: result.analysis,
        analysisStatus: result.analysisStatus || 'ok',
        analysisError: result.analysisError || null,
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
    if (!isSafeFileName(fileName)) {
      return res
        .status(400)
        .json({ success: false, message: 'fileName inválido.' });
    }
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
      error: error.message,
    });
  }
});

// POST /api/transcription/reprocess-all
router.post('/reprocess-all', async (req, res) => {
  try {
    const { discenteId, force = false } = req.body || {};
    const reprocessResult = await transcriptionMediaJobService.reprocessAll({
      discenteId,
      force,
    });

    if (reprocessResult.blocked) {
      return res.status(429).json({
        success: false,
        message: reprocessResult.message,
      });
    }

    res.json({
      success: true,
      total: reprocessResult.total,
      results: reprocessResult.results,
    });
  } catch (error) {
    console.error('Erro ao reprocessar transcrições:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao reprocessar transcrições',
      error: error.message,
    });
  }
});

export default router;
