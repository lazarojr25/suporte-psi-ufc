import fs from 'fs';
import path from 'path';
import {
  SAFE_METADATA_FILE_NAME,
} from '../constants/transcriptionConstants.js';

export default class TranscriptionStorage {
  constructor(transcriptionsDir) {
    this.transcriptionsDir = transcriptionsDir;
    this.metadataFile = path.join(transcriptionsDir, SAFE_METADATA_FILE_NAME);
    this.ensureDir(this.transcriptionsDir);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadMetadata() {
    if (fs.existsSync(this.metadataFile)) {
      const raw = fs.readFileSync(this.metadataFile, 'utf-8');
      return JSON.parse(raw);
    }
    return {};
  }

  saveMetadata(metadata) {
    fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  filePath(fileName) {
    return path.join(this.transcriptionsDir, fileName);
  }

  fileExists(fileName) {
    return fs.existsSync(this.filePath(fileName));
  }

  readText(fileName) {
    const filePath = this.filePath(fileName);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  }

  writeText(fileName, content) {
    fs.writeFileSync(this.filePath(fileName), content, 'utf-8');
  }

  deleteFile(fileName) {
    const filePath = this.filePath(fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
