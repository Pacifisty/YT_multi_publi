import type { UploadedMediaFile } from './storage/local-storage.service';
import { open } from 'node:fs/promises';

export const VALIDATION_RULES = {
  VIDEO_MAX_SIZE_BYTES: 2 * 1024 * 1024 * 1024, // 2 GB
  THUMBNAIL_MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  SHORT_FORM_MAX_DURATION_SECONDS: 180, // 3 minutes
  VIDEO_MAX_DURATION_SECONDS: 2147483647, // Storage safeguard for 32-bit integer persistence
  ACCEPTED_VIDEO_MIMES: ['video/mp4', 'video/quicktime'] as readonly string[],
  ACCEPTED_THUMBNAIL_MIMES: ['image/jpeg', 'image/png'] as readonly string[],
} as const;

export interface ValidationError {
  code: string;
  message: string;
  field: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class MediaValidationService {
  validateVideo(file: UploadedMediaFile): ValidationResult {
    const errors: ValidationError[] = [];
    const fileSize = file.size ?? file.buffer?.byteLength ?? 0;

    if (fileSize <= 0) {
      errors.push({ code: 'EMPTY_VIDEO', message: 'Video file is empty.', field: 'video' });
    }

    if (!VALIDATION_RULES.ACCEPTED_VIDEO_MIMES.includes(file.mimetype ?? '')) {
      errors.push({
        code: 'INVALID_VIDEO_TYPE',
        message: `Unsupported video type "${file.mimetype ?? 'unknown'}". Accepted: ${VALIDATION_RULES.ACCEPTED_VIDEO_MIMES.join(', ')}.`,
        field: 'video',
      });
    }

    if (fileSize > VALIDATION_RULES.VIDEO_MAX_SIZE_BYTES) {
      errors.push({
        code: 'VIDEO_TOO_LARGE',
        message: `Video exceeds maximum size of ${VALIDATION_RULES.VIDEO_MAX_SIZE_BYTES} bytes.`,
        field: 'video',
      });
    }

    const duration = file.durationSeconds ?? 0;
    if (duration > VALIDATION_RULES.VIDEO_MAX_DURATION_SECONDS) {
      errors.push({
        code: 'VIDEO_DURATION_EXCEEDED',
        message: `Video duration ${duration}s exceeds maximum of ${VALIDATION_RULES.VIDEO_MAX_DURATION_SECONDS}s.`,
        field: 'video',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  async validateVideoContent(file: UploadedMediaFile): Promise<ValidationResult> {
    const header = await readFileHeader(file, 64);
    const ftypIndex = header.indexOf(Buffer.from('ftyp'));
    const hasIsoMediaSignature = ftypIndex >= 4 && ftypIndex <= 32;
    return hasIsoMediaSignature
      ? { valid: true, errors: [] }
      : {
          valid: false,
          errors: [{ code: 'INVALID_VIDEO_CONTENT', message: 'The uploaded file is not a valid MP4 or MOV container.', field: 'video' }],
        };
  }

  validateThumbnail(file: UploadedMediaFile): ValidationResult {
    const errors: ValidationError[] = [];
    const fileSize = file.size ?? file.buffer?.byteLength ?? 0;

    if (fileSize <= 0) {
      errors.push({ code: 'EMPTY_THUMBNAIL', message: 'Thumbnail file is empty.', field: 'thumbnail' });
    }

    if (!VALIDATION_RULES.ACCEPTED_THUMBNAIL_MIMES.includes(file.mimetype ?? '')) {
      errors.push({
        code: 'INVALID_THUMBNAIL_TYPE',
        message: `Unsupported thumbnail type "${file.mimetype ?? 'unknown'}". Accepted: ${VALIDATION_RULES.ACCEPTED_THUMBNAIL_MIMES.join(', ')}.`,
        field: 'thumbnail',
      });
    }

    if (fileSize > VALIDATION_RULES.THUMBNAIL_MAX_SIZE_BYTES) {
      errors.push({
        code: 'THUMBNAIL_TOO_LARGE',
        message: `Thumbnail exceeds maximum size of ${VALIDATION_RULES.THUMBNAIL_MAX_SIZE_BYTES} bytes.`,
        field: 'thumbnail',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  async validateThumbnailContent(file: UploadedMediaFile): Promise<ValidationResult> {
    const header = await readFileHeader(file, 16);
    const isJpeg = header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const isPng = header.length >= pngSignature.length && header.subarray(0, pngSignature.length).equals(pngSignature);
    const matchesDeclaredType = file.mimetype === 'image/png' ? isPng : file.mimetype === 'image/jpeg' ? isJpeg : false;
    return matchesDeclaredType
      ? { valid: true, errors: [] }
      : {
          valid: false,
          errors: [{ code: 'INVALID_THUMBNAIL_CONTENT', message: 'Thumbnail content does not match its declared JPEG or PNG type.', field: 'thumbnail' }],
        };
  }
}

async function readFileHeader(file: UploadedMediaFile, length: number): Promise<Buffer> {
  if (file.buffer) return file.buffer.subarray(0, length);
  if (!file.filePath) return Buffer.alloc(0);

  const handle = await open(file.filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
