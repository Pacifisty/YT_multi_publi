// Client-side validation rules — must match server-side VALIDATION_RULES in media-validation.service.ts
const VALIDATION_RULES = {
  VIDEO_MAX_SIZE_BYTES: 2 * 1024 * 1024 * 1024,
  THUMBNAIL_MAX_SIZE_BYTES: 5 * 1024 * 1024,
  SHORT_FORM_MAX_DURATION_SECONDS: 180,
  VIDEO_MAX_DURATION_SECONDS: 2147483647,
  ACCEPTED_VIDEO_MIMES: ['video/mp4', 'video/quicktime'] as readonly string[],
  ACCEPTED_THUMBNAIL_MIMES: ['image/jpeg', 'image/png'] as readonly string[],
} as const;

export { VALIDATION_RULES as CLIENT_VALIDATION_RULES };

export interface FileInfo {
  name: string;
  type: string;
  size: number;
}

export interface ClientValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadFormField {
  required: boolean;
  acceptedMimes: readonly string[];
  maxSizeBytes: number;
}

export interface MediaUploadFormView {
  fields: {
    video: UploadFormField;
    thumbnail: UploadFormField;
  };
  submitLabel: string;
  validateVideo: (file: FileInfo) => ClientValidationResult;
  validateThumbnail: (file: FileInfo) => ClientValidationResult;
}

export interface MediaUploadFormData {}

export function buildMediaUploadFormView(_data?: MediaUploadFormData): MediaUploadFormView {
  return {
    fields: {
      video: {
        required: true,
        acceptedMimes: VALIDATION_RULES.ACCEPTED_VIDEO_MIMES,
        maxSizeBytes: VALIDATION_RULES.VIDEO_MAX_SIZE_BYTES,
      },
      thumbnail: {
        required: false,
        acceptedMimes: VALIDATION_RULES.ACCEPTED_THUMBNAIL_MIMES,
        maxSizeBytes: VALIDATION_RULES.THUMBNAIL_MAX_SIZE_BYTES,
      },
    },
    submitLabel: 'Upload video',
    validateVideo(file: FileInfo): ClientValidationResult {
      if (!VALIDATION_RULES.ACCEPTED_VIDEO_MIMES.includes(file.type)) {
        return { valid: false, error: 'INVALID_VIDEO_TYPE' };
      }
      if (file.size > VALIDATION_RULES.VIDEO_MAX_SIZE_BYTES) {
        return { valid: false, error: 'VIDEO_TOO_LARGE' };
      }
      return { valid: true };
    },
    validateThumbnail(file: FileInfo): ClientValidationResult {
      if (!VALIDATION_RULES.ACCEPTED_THUMBNAIL_MIMES.includes(file.type)) {
        return { valid: false, error: 'INVALID_THUMBNAIL_TYPE' };
      }
      if (file.size > VALIDATION_RULES.THUMBNAIL_MAX_SIZE_BYTES) {
        return { valid: false, error: 'THUMBNAIL_TOO_LARGE' };
      }
      return { valid: true };
    },
  };
}
