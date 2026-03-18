import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

import {
  buildTranscriptBaseName,
  removeDir,
  removeIfExists,
  shouldReprocessEntry,
  toSafeBase,
} from './transcriptionHelpers.js';

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos por etapa
const SEGMENT_THRESHOLD_MB = 90;
const SEGMENT_SECONDS = 600; // 10 min

const envNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

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

class TranscriptionMediaJobService {
  constructor(transcriptionService, { workDirectory = process.cwd() } = {}) {
    this.transcriptionService = transcriptionService;
    this.workDirectory = workDirectory;
    this.reprocessInFlight = false;
    this.reprocessLocks = new Set();
    this.debounceTimerMs = envNumber(process.env.TRANSCRIPTION_DEBOUNCE_MS, 1200);
    this.maxRetryAttempts = envNumber(
      process.env.TRANSCRIPTION_MAX_RETRIES,
      2,
    );
    this.retryBaseDelayMs = envNumber(process.env.TRANSCRIPTION_RETRY_BASE_MS, 900);
    this.retryMaxDelayMs = envNumber(process.env.TRANSCRIPTION_RETRY_MAX_MS, 8000);
    this.retryJitterMs = envNumber(process.env.TRANSCRIPTION_RETRY_JITTER_MS, 250);
    this.queue = [];
    this.queueRunning = false;
    this.debounceJobs = new Map();
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _generateJobId() {
    return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _buildDebounceKey({ fileName, extraInfo = {} }) {
    const discenteId = extraInfo.discenteId || 'sem-discente';
    const meetingId = extraInfo.meetingId || 'sem-encontro';
    const safeFile = fileName ? path.basename(fileName) : 'arquivo';
    return `${meetingId}::${discenteId}::${safeFile}`;
  }

  _isRetryableError(error) {
    const raw = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
    const nonRetryPatterns = ['enoent', 'permission', 'invalid', 'validation', 'schema', 'malformed'];
    return !nonRetryPatterns.some((token) => raw.includes(token));
  }

  _calculateRetryDelayMs(attemptIndex) {
    const exponential = this.retryBaseDelayMs * Math.pow(2, attemptIndex);
    const capped = Math.min(exponential, this.retryMaxDelayMs);
    const jitter = Math.floor(Math.random() * this.retryJitterMs);
    return capped + jitter;
  }

  async _runJobWithRetry(payload) {
    const maxAttempts = Math.max(0, this.maxRetryAttempts) + 1;
    let lastResult = { success: false, message: 'Falha desconhecida' };

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const isFinalAttempt = attempt === maxAttempts;
      lastResult = await this.processMediaJob({
        ...payload,
        attempt,
        maxAttempts,
        cleanupSource: isFinalAttempt,
      });

      if (lastResult.success) {
        return lastResult;
      }

      if (!lastResult.retryable || attempt >= maxAttempts) {
        if (this._isRetryableError({ message: lastResult.message }) === false) {
          return lastResult;
        }
        return lastResult;
      }

      const waitMs = this._calculateRetryDelayMs(attempt - 1);
      console.warn(
        `[transcription-job ${payload.jobId}] Tentativa ${attempt}/${maxAttempts} falhou; retry em ${waitMs}ms`,
      );
      this._safeUpdateMeeting(payload.updateMeetingSafe, payload.extraInfo?.meetingId, {
        status: 'em_processamento',
        updatedAt: new Date().toISOString(),
        tentativaTranscricao: attempt,
        maxTentativas: maxAttempts,
      });
      await this._sleep(waitMs);
    }

    return lastResult;
  }

  async _drainQueue() {
    if (this.queueRunning) return;
    this.queueRunning = true;

    try {
      while (this.queue.length > 0) {
        const payload = this.queue.shift();
        await this._runJobWithRetry(payload);
      }
    } finally {
      this.queueRunning = false;
    }
  }

  _scheduleJobWithDebounce(params, options = {}) {
    const key = this._buildDebounceKey(params);
    const existing = this.debounceJobs.get(key);
    const jobId = existing?.jobId || options.jobId || this._generateJobId();

    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const payload = {
      ...params,
      jobId,
      attempt: 1,
      maxAttempts: Math.max(1, this.maxRetryAttempts + 1),
      cleanupSource: true,
    };

    const timer = setTimeout(async () => {
      this.debounceJobs.delete(key);
      this.queue.push(payload);
      await this._drainQueue().catch((err) =>
        console.error(`[transcription-job ${jobId}] Falha ao esvaziar fila:`, err),
      );
    }, this.debounceTimerMs);

    this.debounceJobs.set(key, { ...payload, timer });
    return jobId;
  }

  _safeUpdateMeeting(updateMeetingSafe, meetingId, payload) {
    if (!updateMeetingSafe || !meetingId) return;
    return updateMeetingSafe(meetingId, payload).catch(() => {});
  }

  async _convertToWav16kMono(inputPath, outDir, baseName) {
    return new Promise((resolve, reject) => {
      const outPath = path.join(outDir, `${toSafeBase(baseName)}.wav`);

      const command = ffmpeg(inputPath)
        .outputOptions(['-ac', '1', '-ar', '16000', '-f', 'wav', '-acodec', 'pcm_s16le'])
        .on('error', reject)
        .on('end', () => resolve(outPath))
        .save(outPath);

      withTimeout(command, reject);
    });
  }

  async _segmentWav(wavPath, outDir) {
    return new Promise((resolve, reject) => {
      const pattern = path.join(outDir, 'part-%03d.wav');
      fs.mkdirSync(outDir, { recursive: true });

      const command = ffmpeg(wavPath)
        .outputOptions(['-f', 'segment', `-segment_time`, `${SEGMENT_SECONDS}`, '-c', 'copy'])
        .on('error', reject)
        .on('end', () => {
          const parts = fs
            .readdirSync(outDir)
            .filter((f) => f.startsWith('part-') && f.endsWith('.wav'))
            .map((f) => path.join(outDir, f))
            .sort();
          resolve(parts);
        })
        .save(pattern);

      withTimeout(command, reject);
    });
  }

  async triggerDiscenteReprocess(discenteId, { force = false } = {}) {
    if (!discenteId) return;
    if (this.reprocessLocks.has(discenteId) || this.reprocessInFlight) {
      console.log(`[reprocess] Ignorando (já em andamento) para discente ${discenteId}`);
      return;
    }

    this.reprocessLocks.add(discenteId);
    try {
      const list = await this.transcriptionService.listTranscriptionsWithMetadata({
        discenteId,
      });
      const filtered = list.filter((t) => shouldReprocessEntry(t, force));

      const concurrency = Number(process.env.REPROCESS_PARALLELISM || 4);
      for (let i = 0; i < filtered.length; i += concurrency) {
        const batch = filtered.slice(i, i + concurrency);
        await Promise.all(
          batch.map((item) => this.transcriptionService.reprocessTranscription(item.fileName)),
        );
      }

      console.log(
        `[reprocess] Finalizado para discente ${discenteId} (${filtered.length} transcrições)`,
      );
    } catch (err) {
      console.error(
        `[reprocess] Falha ao reprocessar discente ${discenteId}:`,
        err?.message,
      );
    } finally {
      this.reprocessLocks.delete(discenteId);
    }
  }

  async processMediaJob({
    filePath,
    fileName,
    extraInfo,
    jobId,
    updateMeetingSafe,
    attempt = 1,
    maxAttempts = 1,
    cleanupSource = true,
  }) {
    let workDir = null;
    let segDir = null;
    const originalPath = filePath;
    const baseName = path.basename(fileName, path.extname(fileName));

    try {
      workDir = path.join(this.workDirectory, 'work', baseName);
      segDir = path.join(workDir, 'segments');
      fs.mkdirSync(workDir, { recursive: true });
      console.log(`[transcription-job ${jobId}] Iniciando processamento de ${fileName}`);

      this._safeUpdateMeeting(updateMeetingSafe, extraInfo?.meetingId, {
        status: 'em_processamento',
        updatedAt: new Date().toISOString(),
        tentativaTranscricao: attempt,
        maxTentativas: maxAttempts,
      });

      const wavPath = await this._convertToWav16kMono(originalPath, workDir, baseName);
      const wavStats = fs.statSync(wavPath);
      const wavSizeMB = wavStats.size / (1024 * 1024);

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
            2,
          )}MB, transcrevendo sem segmentação...`,
        );

        const result = await this.transcriptionService.transcribeAudio(
          wavPath,
          finalFileName,
          extraInfo,
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
            2,
          )}MB, segmentando em partes para transcrição...`,
        );

        const parts = await this._segmentWav(wavPath, segDir);
        if (!parts.length) {
          throw new Error('Falha ao segmentar áudio (nenhuma parte gerada).');
        }

        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          const r = await this.transcriptionService.transcribeAudio(p, null, extraInfo);

          if (!r.success) {
            console.error('Erro na transcrição de parte:', p, r.error);
            throw new Error(`Erro na transcrição de uma das partes: ${p}`);
          }
          partResults.push(r);
        }

        mergedText = partResults.map((r) => r.transcription || '').join('\n\n');

        const result = await this.transcriptionService.saveFinalTranscription(
          finalFileName,
          mergedText,
          extraInfo,
        );

        if (!result.success) {
          throw new Error(result.error || 'Falha ao salvar a transcrição final.');
        }

        mergedText = result.transcription;
        analysis = result.analysis;
        finalMetadata = result.metadata;
        finalFile = result.fileName;
      }

      this._safeUpdateMeeting(updateMeetingSafe, extraInfo?.meetingId, {
        status: 'concluida',
        updatedAt: new Date().toISOString(),
        transcriptionFileName: finalFile,
        ...(extraInfo?.discenteId ? { discenteId: extraInfo.discenteId } : {}),
        ...(extraInfo?.studentEmail ? { studentEmail: extraInfo.studentEmail } : {}),
        ...(extraInfo?.studentName ? { studentName: extraInfo.studentName } : {}),
        ...(extraInfo?.curso ? { curso: extraInfo.curso } : {}),
        ...(extraInfo?.solicitacaoId ? { solicitacaoId: extraInfo.solicitacaoId } : {}),
      });

      if (extraInfo?.discenteId) {
        this.triggerDiscenteReprocess(extraInfo.discenteId).catch((e) =>
          console.warn('Falha ao agendar reprocessamento automático:', e?.message),
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
      const shouldMarkFailed = attempt >= maxAttempts;
      if (shouldMarkFailed) {
        this._safeUpdateMeeting(updateMeetingSafe, extraInfo?.meetingId, {
          status: 'erro_transcricao',
          updatedAt: new Date().toISOString(),
        });
      }
      return {
        success: false,
        message: error?.message || 'Erro no processamento de mídia',
        retryable: this._isRetryableError(error),
      };
    } finally {
      if (workDir) removeDir(workDir);
      if (segDir) removeDir(segDir);
      if (originalPath && cleanupSource && attempt >= maxAttempts) {
        removeIfExists(originalPath);
      }
    }
  }

  startAsyncTranscriptionJob(params, { updateMeetingSafe } = {}) {
    const jobId = this._scheduleJobWithDebounce(
      { ...params, updateMeetingSafe },
      { jobId: params.jobId || this._generateJobId() },
    );
    return jobId;
  }

  async reprocessAll({ discenteId, force = false }) {
    if (this.reprocessInFlight) {
      return {
        blocked: true,
        message: 'Há um reprocessamento em andamento. Tente novamente em instantes.',
      };
    }

    this.reprocessInFlight = true;
    try {
      const list = await this.transcriptionService.listTranscriptionsWithMetadata();
      const filtered = discenteId
        ? list.filter(
            (t) => t.metadata?.discenteId === discenteId && shouldReprocessEntry(t, force),
          )
        : list.filter((t) => shouldReprocessEntry(t, force));

      const results = [];
      const concurrency = Number(process.env.REPROCESS_PARALLELISM || 4);
      for (let i = 0; i < filtered.length; i += concurrency) {
        const batch = filtered.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            const r = await this.transcriptionService.reprocessTranscription(item.fileName);
            return {
              fileName: item.fileName,
              success: r.success,
              message: r.message || null,
            };
          }),
        );
        results.push(...batchResults);
      }

      return {
        blocked: false,
        total: filtered.length,
        results,
      };
    } finally {
      this.reprocessInFlight = false;
    }
  }
}

export default TranscriptionMediaJobService;
