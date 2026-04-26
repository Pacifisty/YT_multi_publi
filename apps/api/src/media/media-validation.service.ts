import type { UploadedMediaFile } from './storage/local-storage.service';

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

  validateThumbnail(file: UploadedMediaFile): ValidationResult {
    const errors: ValidationError[] = [];
    const fileSize = file.size ?? file.buffer?.byteLength ?? 0;

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
}
