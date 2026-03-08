import path from 'path';
import { readFileSafe } from './transcriptionHelpers.js';

export async function extractTranscriptTextFromUpload(filePath, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  let textContent = readFileSafe(filePath);

  // Para Word, apenas uma extração simples (apenas texto sem formatação)
  if ((!textContent || !textContent.trim()) && (ext === '.docx' || ext === '.doc')) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      textContent = result?.value || '';
    } catch (convErr) {
      console.warn('Falha ao extrair texto do Word:', convErr?.message);
    }
  }

  return textContent;
}
