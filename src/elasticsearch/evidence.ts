import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';

export const MAX_EVIDENCE_BYTES = 100 * 1024 * 1024;
export const MAX_EVIDENCE_COUNT = 20;
export type EvidenceType = 'image' | 'video' | 'audio' | 'document';
export interface EvidenceRef {
  doc_id: string;
  type?: string;
  sha256?: string;
}
export interface EvidenceFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

// Use the extension to derive a safe download type, even when the browser
// sends application/octet-stream for Office documents or recordings.
const formats: Record<string, [EvidenceType, string]> = {
  '.jpg': ['image', 'image/jpeg'], '.jpeg': ['image', 'image/jpeg'],
  '.png': ['image', 'image/png'], '.gif': ['image', 'image/gif'],
  '.webp': ['image', 'image/webp'], '.bmp': ['image', 'image/bmp'],
  '.mp4': ['video', 'video/mp4'], '.webm': ['video', 'video/webm'],
  '.mov': ['video', 'video/quicktime'], '.avi': ['video', 'video/x-msvideo'],
  '.mkv': ['video', 'video/x-matroska'], '.m4v': ['video', 'video/mp4'],
  '.mp3': ['audio', 'audio/mpeg'], '.wav': ['audio', 'audio/wav'],
  '.ogg': ['audio', 'audio/ogg'], '.oga': ['audio', 'audio/ogg'],
  '.m4a': ['audio', 'audio/mp4'], '.aac': ['audio', 'audio/aac'],
  '.flac': ['audio', 'audio/flac'],
  '.pdf': ['document', 'application/pdf'],
  '.txt': ['document', 'text/plain'], '.csv': ['document', 'text/csv'],
  '.rtf': ['document', 'application/rtf'],
  '.doc': ['document', 'application/msword'],
  '.docx': ['document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['document', 'application/vnd.ms-excel'],
  '.xlsx': ['document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['document', 'application/vnd.ms-powerpoint'],
  '.pptx': ['document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.odt': ['document', 'application/vnd.oasis.opendocument.text'],
  '.ods': ['document', 'application/vnd.oasis.opendocument.spreadsheet'],
  '.odp': ['document', 'application/vnd.oasis.opendocument.presentation'],
};

export function describeEvidenceFile(file?: EvidenceFile) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    throw new BadRequestException('Aucun fichier fourni ou fichier vide');
  }
  if (file.buffer.length > MAX_EVIDENCE_BYTES) {
    throw new BadRequestException('Chaque pièce jointe doit faire au maximum 100 Mo');
  }
  const extension = extname(file.originalname || '').toLowerCase();
  const format = formats[extension];
  if (!format) {
    throw new BadRequestException('Format non accepté : choisissez une image, une vidéo, un audio ou un document');
  }
  const [type, mime] = format;
  return { extension, type, mime };
}

export function normalizeEvidence(value: unknown): EvidenceRef[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_EVIDENCE_COUNT) {
    throw new BadRequestException('Les pièces jointes doivent être une liste de 20 fichiers au maximum');
  }
  const seen = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new BadRequestException('Pièce jointe invalide');
    const ref = entry as Record<string, unknown>;
    const id = typeof ref.doc_id === 'string' ? ref.doc_id.trim() : '';
    if (!id || seen.has(id)) throw new BadRequestException('Identifiant de pièce jointe vide ou dupliqué');
    seen.add(id);
    return {
      doc_id: id,
      type: typeof ref.type === 'string' ? ref.type.trim() || undefined : undefined,
      sha256: typeof ref.sha256 === 'string' ? ref.sha256.trim() || undefined : undefined,
    };
  });
}
