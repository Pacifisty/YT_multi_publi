import type { SessionRequestLike } from '../auth/session.guard';
import { SessionGuard } from '../auth/session.guard';
import { MediaValidationService } from './media-validation.service';
import { MediaService } from './media.service';
import type { UploadedMediaFile } from './storage/local-storage.service';

export interface MediaRequest extends SessionRequestLike {
  files?: {
    video?: UploadedMediaFile[];
    thumbnail?: UploadedMediaFile[];
  };
  params?: Record<string, string>;
  body?: unknown;
}

interface JsonUploadFilePayload {
  originalName?: string;
  mimeType?: string;
  base64Data?: string;
  sizeBytes?: number;
  durationSeconds?: number;
}

interface JsonUploadBody {
  video?: JsonUploadFilePayload;
  thumbnail?: JsonUploadFilePayload;
}

function normalizeBase64Payload(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('data:')) {
    const separatorIndex = trimmed.indexOf(',');
    if (separatorIndex >= 0) {
      return trimmed.slice(separatorIndex + 1);
    }
  }

  return trimmed;
}

function parseUploadedFileFromJson(
  payload: JsonUploadFilePayload | undefined,
  fieldName: 'video' | 'thumbnail',
): UploadedMediaFile | null {
  if (!payload) {
    return null;
  }

  const originalName = typeof payload.originalName === 'string' ? payload.originalName.trim() : '';
  if (!originalName) {
    throw new Error(`Invalid ${fieldName}.originalName: value must be a non-empty string.`);
  }

  const rawBase64Data = typeof payload.base64Data === 'string' ? normalizeBase64Payload(payload.base64Data) : '';
  if (!rawBase64Data) {
    throw new Error(`Invalid ${fieldName}.base64Data: value must be a non-empty base64 string.`);
  }

  const buffer = Buffer.from(rawBase64Data, 'base64');
  if (buffer.byteLength === 0) {
    throw new Error(`Invalid ${fieldName}.base64Data: decoded payload is empty.`);
  }

  const sizeBytes = typeof payload.sizeBytes === 'number' && Number.isFinite(payload.sizeBytes) && payload.sizeBytes >= 0
    ? Math.round(payload.sizeBytes)
    : buffer.byteLength;

  const durationSeconds = typeof payload.durationSeconds === 'number' && Number.isFinite(payload.durationSeconds) && payload.durationSeconds >= 0
    ? payload.durationSeconds
    : undefined;

  return {
    originalname: originalName,
    mimetype: typeof payload.mimeType === 'string' && payload.mimeType.trim() ? payload.mimeType.trim() : undefined,
    buffer,
    size: sizeBytes,
    durationSeconds,
  };
}

function parseUploadedFilesFromBody(body: unknown): { video: UploadedMediaFile; thumbnail?: UploadedMediaFile } | null {
  if (!body || typeof body !== 'object' || !('video' in body)) {
    return null;
  }

  const payload = body as JsonUploadBody;
  const videoFile = parseUploadedFileFromJson(payload.video, 'video');
  if (!videoFile) {
    throw new Error('Missing required field: video.');
  }

  const thumbnailFile = parseUploadedFileFromJson(payload.thumbnail, 'thumbnail') ?? undefined;
  return {
    video: videoFile,
    thumbnail: thumbnailFile,
  };
}

export class MediaController {
  private readonly sessionGuard: SessionGuard;
  private readonly validationService: MediaValidationService;

  constructor(
    private readonly mediaService: MediaService,
    sessionGuard?: SessionGuard,
    validationService?: MediaValidationService,
  ) {
    this.sessionGuard = sessionGuard ?? new SessionGuard();
    this.validationService = validationService ?? new MediaValidationService();
  }

  async createAsset(request: MediaRequest): Promise<{ status: number; body: unknown }> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return {
        status: guardResult.status,
        body: {
          error: guardResult.reason,
        },
      };
    }

    let videoFiles = request.files?.video ?? [];
    let thumbnailFiles = request.files?.thumbnail ?? [];

    try {
      const parsedBodyUpload = parseUploadedFilesFromBody(request.body);
      if (parsedBodyUpload) {
        videoFiles = [parsedBodyUpload.video];
        thumbnailFiles = parsedBodyUpload.thumbnail ? [parsedBodyUpload.thumbnail] : [];
      }
    } catch (error) {
      return {
        status: 400,
        body: {
          error: error instanceof Error ? error.message : 'Invalid upload payload.',
        },
      };
    }

    if (videoFiles.length !== 1 || thumbnailFiles.length > 1) {
      return {
        status: 400,
        body: {
          error: 'Expected one video file and at most one thumbnail file.',
        },
      };
    }

    // Validation gate: reject invalid files before any persistence
    const videoValidation = this.validationService.validateVideo(videoFiles[0]);
    if (!videoValidation.valid) {
      return {
        status: 400,
        body: {
          code: videoValidation.errors[0].code,
          error: videoValidation.errors[0].message,
          field: videoValidation.errors[0].field,
          errors: videoValidation.errors,
        },
      };
    }

    if (thumbnailFiles.length === 1) {
      const thumbValidation = this.validationService.validateThumbnail(thumbnailFiles[0]);
      if (!thumbValidation.valid) {
        return {
          status: 400,
          body: {
            code: thumbValidation.errors[0].code,
            error: thumbValidation.errors[0].message,
            field: thumbValidation.errors[0].field,
            errors: thumbValidation.errors,
          },
        };
      }
    }

    const ownerEmail = request.session?.adminUser?.email;
    const asset = await this.mediaService.createAsset({
      video: videoFiles[0],
      thumbnail: thumbnailFiles[0],
    }, ownerEmail);

    return {
      status: 201,
      body: asset,
    };
  }

  async listAssets(request: SessionRequestLike): Promise<{ status: number; body: unknown }> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return {
        status: guardResult.status,
        body: {
          error: guardResult.reason,
        },
      };
    }

    return {
      status: 200,
      body: await this.mediaService.listAssets(request.session?.adminUser?.email),
    };
  }

  async getAsset(request: MediaRequest): Promise<{ status: number; body: unknown }> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const id = request.params?.id;
    if (!id) {
      return { status: 400, body: { error: 'Missing asset id' } };
    }

    const asset = await this.mediaService.getAsset(id, request.session?.adminUser?.email);
    if (!asset) {
      return { status: 404, body: { error: 'Asset not found' } };
    }

    return { status: 200, body: { asset } };
  }

  async updateAssetMetadata(request: MediaRequest): Promise<{ status: number; body: unknown }> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const id = request.params?.id;
    if (!id) {
      return { status: 400, body: { error: 'Missing asset id' } };
    }

    const body = request.body as { durationSeconds?: unknown } | undefined;
    const durationSeconds = Number(body?.durationSeconds);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return { status: 400, body: { error: 'durationSeconds must be a positive number.' } };
    }

    const asset = await this.mediaService.updateAssetDuration(id, durationSeconds, request.session?.adminUser?.email);
    if (!asset) {
      return { status: 404, body: { error: 'Video asset not found' } };
    }

    return { status: 200, body: { asset } };
  }

  async deleteAsset(request: MediaRequest): Promise<{ status: number; body: unknown }> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const id = request.params?.id;
    if (!id) {
      return { status: 400, body: { error: 'Missing asset id' } };
    }

    const ok = await this.mediaService.deleteAsset(id, request.session?.adminUser?.email);
    if (!ok) {
      return { status: 404, body: { error: 'Asset not found' } };
    }

    return { status: 200, body: { success: true } };
  }

  async linkThumbnail(request: MediaRequest): Promise<{ status: number; body: unknown }> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const thumbnailId = request.params?.id;
    if (!thumbnailId) {
      return { status: 400, body: { error: 'Missing thumbnail id' } };
    }

    const body = request.body as { videoAssetId?: string } | undefined;
    if (!body?.videoAssetId) {
      return { status: 400, body: { error: 'Missing required field: videoAssetId' } };
    }

    const ok = await this.mediaService.linkThumbnail(thumbnailId, body.videoAssetId, request.session?.adminUser?.email);
    if (!ok) {
      return { status: 404, body: { error: 'Thumbnail or video asset not found' } };
    }

    return { status: 200, body: { success: true } };
  }
}
