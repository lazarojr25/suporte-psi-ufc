import { fileURLToPath } from 'url';
import path from 'path';

export const TRANSCRIPTION_SUMMARY_SEPARATOR = '=== Transcrição ===';
export const ANALYSIS_STATUS = {
  OK: 'ok',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

export const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
export const SAFE_METADATA_FILE_NAME = 'metadata.json';
export const TRANSCRIPTIONS_DIR_NAME = 'transcriptions';

export const getTranscriptionsDir = () =>
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', TRANSCRIPTIONS_DIR_NAME);
