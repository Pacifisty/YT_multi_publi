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

    const videoFiles = request.files?.video ?? [];
    const thumbnailFiles = request.files?.thumbnail ?? [];

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

    const asset = await this.mediaService.createAsset({
      video: videoFiles[0],
      thumbnail: thumbnailFiles[0],
    });

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
      body: await this.mediaService.listAssets(),
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

    const asset = await this.mediaService.getAsset(id);
    if (!asset) {
      return { status: 404, body: { error: 'Asset not found' } };
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

    const ok = await this.mediaService.deleteAsset(id);
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

    const ok = await this.mediaService.linkThumbnail(thumbnailId, body.videoAssetId);
    if (!ok) {
      return { status: 404, body: { error: 'Thumbnail or video asset not found' } };
    }

    return { status: 200, body: { success: true } };
  }
}
