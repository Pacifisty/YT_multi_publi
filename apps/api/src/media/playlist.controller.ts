import type { SessionRequestLike } from '../auth/session.guard';
import { SessionGuard } from '../auth/session.guard';
import type { PlaylistService } from './playlist.service';
import type { MediaService } from './media.service';

interface PlaylistRequest extends SessionRequestLike {
  params?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

export class PlaylistController {
  private readonly sessionGuard: SessionGuard;

  constructor(
    private readonly playlistService: PlaylistService,
    private readonly mediaService: MediaService,
    sessionGuard?: SessionGuard,
  ) {
    this.sessionGuard = sessionGuard ?? new SessionGuard();
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
    const playlist = await this.playlistService.getPlaylist(id);
    if (!playlist) return { status: 404, body: { error: 'Playlist not found' } };
    return { status: 200, body: { playlist } };
  }

  async createPlaylist(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const body = request.body as { name?: string; folderPath?: string } | undefined;
    if (!body?.name?.trim()) return { status: 400, body: { error: 'name is required' } };
    if (!body?.folderPath?.trim()) return { status: 400, body: { error: 'folderPath is required' } };
    const ownerEmail = request.session?.adminUser?.email;
    const result = await this.playlistService.createPlaylist({ name: body.name.trim(), folderPath: body.folderPath.trim(), ownerEmail });
    return { status: 201, body: result };
  }

  async deletePlaylist(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const id = request.params?.id;
    if (!id) return { status: 400, body: { error: 'Missing playlist id' } };
    const ok = await this.playlistService.deletePlaylist(id);
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
    const result = await this.playlistService.addItemToPlaylist(playlistId, body.videoAssetId);
    if ('error' in result) return { status: 404, body: { error: result.error } };
    return { status: 201, body: result };
  }

  async removeItem(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const playlistId = request.params?.id;
    const videoAssetId = request.params?.videoAssetId;
    if (!playlistId || !videoAssetId) return { status: 400, body: { error: 'Missing ids' } };
    const ok = await this.playlistService.removeItemFromPlaylist(playlistId, videoAssetId);
    if (!ok) return { status: 404, body: { error: 'Item not found' } };
    return { status: 200, body: { success: true } };
  }

  async scanFolder(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const body = request.body as { rootPath?: string } | undefined;
    if (!body?.rootPath?.trim()) return { status: 400, body: { error: 'rootPath is required' } };

    const ownerEmail = request.session?.adminUser?.email;
    const mediaService = this.mediaService;

    const assetLookup = {
      findByOriginalName: async (name: string) => {
        const list = await mediaService.listAssets(ownerEmail);
        const found = list.assets.find((a) => a.original_name === name && a.asset_type === 'video');
        return found ? { id: found.id, storage_path: found.storage_path } : null;
      },
      registerVideoFile: async (file: { name: string; absolutePath: string; sizeBytes: number }) => {
        const { asset } = await mediaService.createAsset(
          {
            video: {
              originalname: file.name,
              filePath: file.absolutePath,
              mimetype: 'video/mp4',
              size: file.sizeBytes,
              keepSource: true,
            },
          },
          ownerEmail,
        );
        return { id: asset.id };
      },
    };

    try {
      const result = await this.playlistService.scanFolderForPlaylists(body.rootPath.trim(), ownerEmail, assetLookup);
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
    const next = await this.playlistService.pickNextAutoVideo(playlistId);
    if (!next) return { status: 404, body: { error: 'No available videos in playlist' } };
    return { status: 200, body: next };
  }

  // Preset endpoints

  async upsertPreset(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const videoAssetId = request.params?.videoAssetId;
    if (!videoAssetId) return { status: 400, body: { error: 'Missing videoAssetId' } };
    const body = request.body as { title?: string; description?: string; tags?: string[]; privacy?: string } | undefined;
    const result = await this.playlistService.upsertPreset(videoAssetId, body ?? {});
    return { status: 200, body: result };
  }

  async getPreset(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const videoAssetId = request.params?.videoAssetId;
    if (!videoAssetId) return { status: 400, body: { error: 'Missing videoAssetId' } };
    const preset = await this.playlistService.getPreset(videoAssetId);
    if (!preset) return { status: 404, body: { error: 'Preset not found' } };
    return { status: 200, body: { preset } };
  }

  async deletePreset(request: PlaylistRequest): Promise<{ status: number; body: unknown }> {
    const g = this.guard(request);
    if (!g.allowed) return { status: (g as any).status, body: { error: (g as any).reason } };
    const videoAssetId = request.params?.videoAssetId;
    if (!videoAssetId) return { status: 400, body: { error: 'Missing videoAssetId' } };
    const ok = await this.playlistService.deletePreset(videoAssetId);
    if (!ok) return { status: 404, body: { error: 'Preset not found' } };
    return { status: 200, body: { success: true } };
  }
}
