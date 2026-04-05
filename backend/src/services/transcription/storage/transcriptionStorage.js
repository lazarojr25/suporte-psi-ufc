import path from 'path';
import {
  getAdminStorage,
} from '../../../firebaseAdmin.js';
import {
  TRANSCRIPTIONS_STORAGE_PREFIX,
} from '../constants/transcriptionConstants.js';

export default class TranscriptionStorage {
  constructor() {
    this.storagePrefix = TRANSCRIPTIONS_STORAGE_PREFIX;
    this.bucket = this._resolveBucket();
  }

  _resolveBucket() {
    try {
      const storage = getAdminStorage();
      const configuredBucket =
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.GCLOUD_STORAGE_BUCKET ||
        process.env.STORAGE_BUCKET;
      return configuredBucket ? storage.bucket(configuredBucket) : storage.bucket();
    } catch (error) {
      console.error(
        'Firebase Storage não disponível para persistir transcrições completas:',
        error?.message,
      );
      return null;
    }
  }

  _assertStorageReady() {
    if (!this.bucket || !this.bucket.name) {
      throw new Error(
        'Firebase Storage não inicializado. Configure FIREBASE_STORAGE_BUCKET e credenciais do Admin SDK.',
      );
    }
  }

  _buildCloudPath(fileName) {
    const safeName = path.basename(fileName || '').replace(/[^\w.\-]+/g, '_');
    return `${this.storagePrefix}/${safeName}`;
  }

  _buildCloudCandidates(fileName, storagePath = null) {
    const candidates = [];
    if (storagePath && typeof storagePath === 'string') {
      candidates.push(storagePath);
    }
    candidates.push(this._buildCloudPath(fileName));
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  async fileExists(fileName, options = {}) {
    this._assertStorageReady();
    const candidates = this._buildCloudCandidates(fileName, options.storagePath);
    for (const cloudPath of candidates) {
      const [exists] = await this.bucket.file(cloudPath).exists();
      if (exists) return true;
    }
    return false;
  }

  async readTextFromCloud(fileName, options = {}) {
    this._assertStorageReady();
    const candidates = this._buildCloudCandidates(fileName, options.storagePath);

    for (const cloudPath of candidates) {
      const file = this.bucket.file(cloudPath);
      const [exists] = await file.exists();
      if (!exists) continue;

      const [contentBuffer] = await file.download();
      const content = contentBuffer.toString('utf-8');
      return {
        content,
        storagePath: cloudPath,
      };
    }

    return null;
  }

  async readText(fileName, options = {}) {
    const cloudResult = await this.readTextFromCloud(fileName, options);
    if (cloudResult?.content) {
      return cloudResult.content;
    }
    return null;
  }

  async writeText(fileName, content) {
    this._assertStorageReady();

    const storagePath = this._buildCloudPath(fileName);
    const file = this.bucket.file(storagePath);
    await file.save(content, {
      resumable: false,
      contentType: 'text/plain; charset=utf-8',
      metadata: {
        metadata: {
          fileName,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    return {
      provider: 'firebase-storage',
      bucket: this.bucket.name,
      path: storagePath,
      size: Buffer.byteLength(content || '', 'utf-8'),
    };
  }

  async deleteFile(fileName, options = {}) {
    this._assertStorageReady();
    const candidates = this._buildCloudCandidates(fileName, options.storagePath);
    await Promise.all(
      candidates.map(async (cloudPath) => {
        try {
          await this.bucket.file(cloudPath).delete({ ignoreNotFound: true });
        } catch (error) {
          if (error?.code !== 404) {
            throw error;
          }
        }
      }),
    );
  }
}
