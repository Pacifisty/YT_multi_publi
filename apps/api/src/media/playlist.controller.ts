import type { SessionRequestLike } from '../auth/session.guard';
import { SessionGuard } from '../auth/session.guard';
import type { PlaylistService } from './playlist.service';
import type { MediaService } from './media.service';
import { PlaylistDependencyConflictError } from './prisma-playlist.repository';
import { realpath } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';
import { MediaValidationService } from './media-validation.service';

interface PlaylistRequest extends SessionRequestLike {
  params?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

export class PlaylistController {
  private readonly sessionGuard: SessionGuard;
  private readonly importRoot?: string;
  private readonly validationService = new MediaValidationService();

  constructor(
    private readonly playlistService: PlaylistService,
    private readonly mediaService: MediaService,
    sessionGuard?: SessionGuard,
    importRoot?: string,
  ) {
    this.sessionGuard = sessionGuard ?? new SessionGuard();
    this.importRoot = importRoot?.trim() || undefined;
  }

  private guard(request: PlaylistRequest): { allowed: false; status: number; reason: string } | { allowed: true } {
    const result = this.sessionGuard.check(request);
    return result;
  }

  async listPlaylists(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const ownerEmail = request.session?.adminUser?.email;
    return { status: 200, body: await this.playlistService.listPlaylists(ownerEmail) };
  }

  async getPlaylist(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const id = request.params?.id;
    if (!id) return { status: 400, body: { error: 'Missing playlist id' } };
    const playlist = await this.playlistService.getOwnedPlaylist(id, request.session?.adminUser?.email);
    if (!playlist) return { status: 404, body: { error: 'Playlist not found' } };
    return { status: 200, body: { playlist } };
  }

  async createPlaylist(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const body = request.body as { name?: string; folderPath?: string } | undefined;
    if (!body?.name?.trim()) return { status: 400, body: { error: 'name is required' } };
    const ownerEmail = request.session?.adminUser?.email;
    const result = await this.playlistService.createPlaylist({ name: body.name.trim(), folderPath: body.folderPath?.trim() || null, ownerEmail });
    return { status: 201, body: result };
  }

  async deletePlaylist(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const id = request.params?.id;
    if (!id) return { status: 400, body: { error: 'Missing playlist id' } };
    let ok: boolean;
    try {
      ok = await this.playlistService.deletePlaylist(id, request.session?.adminUser?.email);
    } catch (error) {
      if (error instanceof PlaylistDependencyConflictError) {
        return { status: 409, body: { code: 'CONTENT_QUEUE_IN_USE', error: error.message } };
      }
      throw error;
    }
    if (!ok) return { status: 404, body: { error: 'Playlist not found' } };
    return { status: 200, body: { success: true } };
  }

  async addItem(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const playlistId = request.params?.id;
    if (!playlistId) return { status: 400, body: { error: 'Missing playlist id' } };
    const body = request.body as { videoAssetId?: string } | undefined;
    if (!body?.videoAssetId) return { status: 400, body: { error: 'videoAssetId is required' } };
    const ownerEmail = request.session?.adminUser?.email;
    const asset = await this.mediaService.getAsset(body.videoAssetId, ownerEmail);
    if (!asset) return { status: 404, body: { error: 'Video asset not found' } };
    if (asset.asset_type !== 'video') return { status: 422, body: { error: 'Only video assets can be added to a content queue' } };
    const result = await this.playlistService.addItemToPlaylist(playlistId, body.videoAssetId, ownerEmail);
    if ('error' in result) return { status: 404, body: { error: result.error } };
    return { status: 201, body: result };
  }

  async removeItem(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const playlistId = request.params?.id;
    const videoAssetId = request.params?.videoAssetId;
    if (!playlistId || !videoAssetId) return { status: 400, body: { error: 'Missing ids' } };
    let ok: boolean;
    try {
      ok = await this.playlistService.removeItemFromPlaylist(playlistId, videoAssetId, request.session?.adminUser?.email);
    } catch (error: any) {
      if (error?.code === 'P2003') {
        return { status: 409, body: { code: 'QUEUE_ITEM_IN_USE', error: 'Este item está vinculado a uma campanha e não pode ser removido.' } };
      }
      throw error;
    }
    if (!ok) return { status: 404, body: { error: 'Item not found' } };
    return { status: 200, body: { success: true } };
  }

  async scanFolder(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const body = request.body as { rootPath?: string } | undefined;
    if (!body?.rootPath?.trim()) return { status: 400, body: { error: 'rootPath is required' } };

    if (!this.importRoot) {
      return { status: 403, body: { error: 'Folder import is disabled on this server.' } };
    }

    let approvedRootPath: string;
    try {
      const [configuredRoot, requestedRoot] = await Promise.all([
        realpath(this.importRoot),
        realpath(body.rootPath.trim()),
      ]);
      const relativePath = relative(configuredRoot, requestedRoot);
      if (relativePath === '..' || relativePath.startsWith(`..\\`) || isAbsolute(relativePath)) {
        return { status: 403, body: { error: 'Folder is outside the configured import directory.' } };
      }
      approvedRootPath = requestedRoot;
    } catch {
      return { status: 400, body: { error: 'Import folder does not exist or cannot be accessed.' } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const mediaService = this.mediaService;

    const assetLookup = {
      findByOriginalName: async (name: string) => {
        const list = await mediaService.listAssets(ownerEmail);
        const found = list.assets.find((a) => a.original_name === name && a.asset_type === 'video');
        return found ? { id: found.id, storage_path: found.storage_path } : null;
      },
      findByStoragePath: async (path: string) => {
        const list = await mediaService.listAssets(ownerEmail);
        const normalized = path.replace(/\\/g, '/').toLowerCase();
        const found = list.assets.find((a) => a.asset_type === 'video' && (a.source_path ?? a.storage_path).replace(/\\/g, '/').toLowerCase() === normalized);
        return found ? { id: found.id, storage_path: found.storage_path } : null;
      },
      registerVideoFile: async (file: { name: string; absolutePath: string; sizeBytes: number }) => {
        const mimeType = file.name.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
        const upload = {
          originalname: file.name,
          filePath: file.absolutePath,
          mimetype: mimeType,
          size: file.sizeBytes,
          keepSource: true,
        };
        const structuralValidation = this.validationService.validateVideo(upload);
        const contentValidation = await this.validationService.validateVideoContent(upload);
        if (!structuralValidation.valid || !contentValidation.valid) {
          throw new Error(`Invalid media file: ${file.name}`);
        }
        const { asset } = await mediaService.createAsset(
          {
            video: upload,
          },
          ownerEmail,
        );
        return { id: asset.id };
      },
    };

    try {
      const result = await this.playlistService.scanFolderForPlaylists(approvedRootPath, ownerEmail, assetLookup);
      return { status: 200, body: result };
    } catch (err) {
      return { status: 500, body: { error: err instanceof Error ? err.message : 'Scan failed' } };
    }
  }

  async pickNextAutoVideo(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const playlistId = request.params?.id;
    if (!playlistId) return { status: 400, body: { error: 'Missing playlist id' } };
    const next = await this.playlistService.pickNextAutoVideo(playlistId, request.session?.adminUser?.email);
    if (!next) return { status: 404, body: { error: 'No available videos in playlist' } };
    return { status: 200, body: next };
  }

  async reserveNextVideo(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const playlistId = request.params?.id;
    if (!playlistId) return { status: 400, body: { error: 'Missing content queue id' } };
    const body = request.body as { sequence?: 'random' | 'sequential' | 'fresh-first'; repeat?: 'no-repeat' | 'allow-repeat' | 'stop' } | undefined;
    const reservation = await this.playlistService.reserveNextVideo(
      playlistId,
      request.session?.adminUser?.email,
      { sequence: body?.sequence, repeat: body?.repeat },
    );
    if (!reservation) return { status: 409, body: { error: 'No available videos in content queue' } };
    return { status: 201, body: { reservation } };
  }

  async releaseReservation(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const playlistId = request.params?.id;
    const itemId = request.params?.itemId;
    if (!playlistId || !itemId) return { status: 400, body: { error: 'Missing content queue or item id' } };
    if (!await this.playlistService.getOwnedPlaylist(playlistId, request.session?.adminUser?.email)) {
      return { status: 404, body: { error: 'Content queue not found' } };
    }
    const token = (request.body as { reservationToken?: string } | undefined)?.reservationToken;
    const released = await this.playlistService.releaseReservation(itemId, token);
    return released ? { status: 200, body: { success: true } } : { status: 404, body: { error: 'Reservation not found' } };
  }

  // Preset endpoints

  async upsertPreset(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const videoAssetId = request.params?.videoAssetId;
    if (!videoAssetId) return { status: 400, body: { error: 'Missing videoAssetId' } };
    const body = request.body as { title?: string; description?: string; tags?: string[]; privacy?: string } | undefined;
    const asset = await this.mediaService.getAsset(videoAssetId, request.session?.adminUser?.email);
    if (!asset) return { status: 404, body: { error: 'Video asset not found' } };
    if (asset.asset_type !== 'video') return { status: 422, body: { error: 'Presets can only be assigned to video assets' } };
    const result = await this.playlistService.upsertPreset(videoAssetId, body ?? {});
    return { status: 200, body: result };
  }

  async getPreset(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const videoAssetId = request.params?.videoAssetId;
    if (!videoAssetId) return { status: 400, body: { error: 'Missing videoAssetId' } };
    const asset = await this.mediaService.getAsset(videoAssetId, request.session?.adminUser?.email);
    if (!asset || asset.asset_type !== 'video') return { status: 404, body: { error: 'Video asset not found' } };
    const preset = await this.playlistService.getPreset(videoAssetId);
    if (!preset) return { status: 404, body: { error: 'Preset not found' } };
    return { status: 200, body: { preset } };
  }

  async deletePreset(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const videoAssetId = request.params?.videoAssetId;
    if (!videoAssetId) return { status: 400, body: { error: 'Missing videoAssetId' } };
    const asset = await this.mediaService.getAsset(videoAssetId, request.session?.adminUser?.email);
    if (!asset || asset.asset_type !== 'video') return { status: 404, body: { error: 'Video asset not found' } };
    const ok = await this.playlistService.deletePreset(videoAssetId);
    if (!ok) return { status: 404, body: { error: 'Preset not found' } };
    return { status: 200, body: { success: true } };
  }
}
