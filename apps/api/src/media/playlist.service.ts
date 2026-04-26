import { randomUUID } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { extname, join, basename } from 'node:path';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v']);

export interface PlaylistItemRecord {
  id: string;
  playlistId: string;
  videoAssetId: string;
  position: number;
  usedAt: string | null;
  createdAt: string;
}

export interface PlaylistRecord {
  id: string;
  ownerEmail: string | null;
  name: string;
  folderPath: string;
  items: PlaylistItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaAssetPresetRecord {
  id: string;
  videoAssetId: string;
  title: string;
  description: string;
  tags: string[];
  privacy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistRepository {
  create(record: PlaylistRecord): Promise<PlaylistRecord>;
  findById(id: string): Promise<PlaylistRecord | null>;
  findAll(ownerEmail?: string): Promise<PlaylistRecord[]>;
  update(id: string, data: Partial<PlaylistRecord>): Promise<PlaylistRecord | null>;
  delete(id: string): Promise<boolean>;
  upsertItem(item: PlaylistItemRecord): Promise<PlaylistItemRecord>;
  markItemUsed(itemId: string, usedAt: string): Promise<boolean>;
  removeItem(playlistId: string, videoAssetId: string): Promise<boolean>;
}

export interface PresetRepository {
  upsert(record: MediaAssetPresetRecord): Promise<MediaAssetPresetRecord>;
  findByVideoAssetId(videoAssetId: string): Promise<MediaAssetPresetRecord | null>;
  delete(videoAssetId: string): Promise<boolean>;
}

export class InMemoryPlaylistRepository implements PlaylistRepository {
  private readonly playlists: PlaylistRecord[] = [];

  async create(record: PlaylistRecord): Promise<PlaylistRecord> {
    this.playlists.push(record);
    return record;
  }

  async findById(id: string): Promise<PlaylistRecord | null> {
    return this.playlists.find((p) => p.id === id) ?? null;
  }

  async findAll(ownerEmail?: string): Promise<PlaylistRecord[]> {
    if (!ownerEmail) return [...this.playlists];
    return this.playlists.filter((p) => p.ownerEmail === ownerEmail || p.ownerEmail === null);
  }

  async update(id: string, data: Partial<PlaylistRecord>): Promise<PlaylistRecord | null> {
    const p = this.playlists.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, data);
    return p;
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.playlists.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.playlists.splice(idx, 1);
    return true;
  }

  async upsertItem(item: PlaylistItemRecord): Promise<PlaylistItemRecord> {
    const playlist = this.playlists.find((p) => p.id === item.playlistId);
    if (!playlist) throw new Error('Playlist not found');
    const existing = playlist.items.find((i) => i.videoAssetId === item.videoAssetId);
    if (existing) {
      Object.assign(existing, item);
      return existing;
    }
    playlist.items.push(item);
    return item;
  }

  async markItemUsed(itemId: string, usedAt: string): Promise<boolean> {
    for (const p of this.playlists) {
      const item = p.items.find((i) => i.id === itemId);
      if (item) { item.usedAt = usedAt; return true; }
    }
    return false;
  }

  async removeItem(playlistId: string, videoAssetId: string): Promise<boolean> {
    const playlist = this.playlists.find((p) => p.id === playlistId);
    if (!playlist) return false;
    const idx = playlist.items.findIndex((i) => i.videoAssetId === videoAssetId);
    if (idx === -1) return false;
    playlist.items.splice(idx, 1);
    return true;
  }
}

export class InMemoryPresetRepository implements PresetRepository {
  private readonly presets: MediaAssetPresetRecord[] = [];

  async upsert(record: MediaAssetPresetRecord): Promise<MediaAssetPresetRecord> {
    const existing = this.presets.find((p) => p.videoAssetId === record.videoAssetId);
    if (existing) { Object.assign(existing, record); return existing; }
    this.presets.push(record);
    return record;
  }

  async findByVideoAssetId(videoAssetId: string): Promise<MediaAssetPresetRecord | null> {
    return this.presets.find((p) => p.videoAssetId === videoAssetId) ?? null;
  }

  async delete(videoAssetId: string): Promise<boolean> {
    const idx = this.presets.findIndex((p) => p.videoAssetId === videoAssetId);
    if (idx === -1) return false;
    this.presets.splice(idx, 1);
    return true;
  }
}

export interface ScannedVideoFile {
  name: string;
  absolutePath: string;
  sizeBytes: number;
}

async function scanVideoFiles(folderPath: string): Promise<ScannedVideoFile[]> {
  const results: ScannedVideoFile[] = [];
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = extname(entry.name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) continue;
      const fullPath = join(folderPath, entry.name);
      const info = await stat(fullPath).catch(() => null);
      if (!info) continue;
      results.push({ name: entry.name, absolutePath: fullPath, sizeBytes: info.size });
    }
  } catch {
    // folder not accessible
  }
  return results;
}

async function scanSubfolders(rootPath: string): Promise<Array<{ name: string; path: string }>> {
  const results: Array<{ name: string; path: string }> = [];
  try {
    const entries = await readdir(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        results.push({ name: entry.name, path: join(rootPath, entry.name) });
      }
    }
  } catch {
    // folder not accessible
  }
  return results;
}

export interface MediaAssetLookup {
  findByOriginalName(name: string): Promise<{ id: string; storage_path: string } | null>;
  registerVideoFile(file: ScannedVideoFile): Promise<{ id: string }>;
}

export interface PlaylistServiceOptions {
  playlistRepo?: PlaylistRepository;
  presetRepo?: PresetRepository;
  now?: () => Date;
}

export class PlaylistService {
  private readonly playlistRepo: PlaylistRepository;
  private readonly presetRepo: PresetRepository;
  private readonly now: () => Date;

  constructor(options: PlaylistServiceOptions = {}) {
    this.playlistRepo = options.playlistRepo ?? new InMemoryPlaylistRepository();
    this.presetRepo = options.presetRepo ?? new InMemoryPresetRepository();
    this.now = options.now ?? (() => new Date());
  }

  async listPlaylists(ownerEmail?: string): Promise<{ playlists: PlaylistRecord[] }> {
    const playlists = await this.playlistRepo.findAll(ownerEmail);
    return { playlists };
  }

  async getPlaylist(id: string): Promise<PlaylistRecord | null> {
    return this.playlistRepo.findById(id);
  }

  async createPlaylist(input: { name: string; folderPath: string; ownerEmail?: string }): Promise<{ playlist: PlaylistRecord }> {
    const nowIso = this.now().toISOString();
    const record: PlaylistRecord = {
      id: randomUUID(),
      ownerEmail: input.ownerEmail ?? null,
      name: input.name,
      folderPath: input.folderPath,
      items: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    return { playlist: await this.playlistRepo.create(record) };
  }

  async deletePlaylist(id: string): Promise<boolean> {
    return this.playlistRepo.delete(id);
  }

  async addItemToPlaylist(playlistId: string, videoAssetId: string): Promise<{ item: PlaylistItemRecord } | { error: string }> {
    const playlist = await this.playlistRepo.findById(playlistId);
    if (!playlist) return { error: 'Playlist not found' };
    const nowIso = this.now().toISOString();
    const item = await this.playlistRepo.upsertItem({
      id: randomUUID(),
      playlistId,
      videoAssetId,
      position: playlist.items.length,
      usedAt: null,
      createdAt: nowIso,
    });
    return { item };
  }

  async removeItemFromPlaylist(playlistId: string, videoAssetId: string): Promise<boolean> {
    return this.playlistRepo.removeItem(playlistId, videoAssetId);
  }

  async pickNextAutoVideo(playlistId: string): Promise<{ videoAssetId: string; itemId: string } | null> {
    const playlist = await this.playlistRepo.findById(playlistId);
    if (!playlist || playlist.items.length === 0) return null;

    // Prefer never-used items, then oldest-used
    const unused = playlist.items.filter((i) => i.usedAt === null);
    const pool = unused.length > 0 ? unused : [...playlist.items].sort((a, b) => (a.usedAt! < b.usedAt! ? -1 : 1));

    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { videoAssetId: pick.videoAssetId, itemId: pick.id };
  }

  async markItemUsed(itemId: string): Promise<boolean> {
    return this.playlistRepo.markItemUsed(itemId, this.now().toISOString());
  }

  async scanFolderForPlaylists(
    rootPath: string,
    ownerEmail: string | undefined,
    assetLookup: MediaAssetLookup,
  ): Promise<{ playlists: PlaylistRecord[]; created: number; updated: number }> {
    const subfolders = await scanSubfolders(rootPath);
    const existingPlaylists = await this.playlistRepo.findAll(ownerEmail);
    const byFolder = new Map(existingPlaylists.map((p) => [p.folderPath, p]));

    let created = 0;
    let updated = 0;
    const result: PlaylistRecord[] = [];

    for (const folder of subfolders) {
      let playlist = byFolder.get(folder.path) ?? null;
      const nowIso = this.now().toISOString();

      if (!playlist) {
        playlist = (await this.createPlaylist({ name: folder.name, folderPath: folder.path, ownerEmail })).playlist;
        created++;
      } else {
        updated++;
      }

      const videoFiles = await scanVideoFiles(folder.path);
      for (const file of videoFiles) {
        const existing = await assetLookup.findByOriginalName(file.name);
        const assetId = existing ? existing.id : (await assetLookup.registerVideoFile(file)).id;
        await this.playlistRepo.upsertItem({
          id: randomUUID(),
          playlistId: playlist.id,
          videoAssetId: assetId,
          position: playlist.items.length,
          usedAt: null,
          createdAt: nowIso,
        });
      }

      const refreshed = await this.playlistRepo.findById(playlist.id);
      if (refreshed) result.push(refreshed);
    }

    return { playlists: result, created, updated };
  }

  // Preset methods

  async upsertPreset(
    videoAssetId: string,
    data: { title?: string; description?: string; tags?: string[]; privacy?: string },
  ): Promise<{ preset: MediaAssetPresetRecord }> {
    const nowIso = this.now().toISOString();
    const existing = await this.presetRepo.findByVideoAssetId(videoAssetId);
    const record: MediaAssetPresetRecord = {
      id: existing?.id ?? randomUUID(),
      videoAssetId,
      title: data.title ?? existing?.title ?? '',
      description: data.description ?? existing?.description ?? '',
      tags: data.tags ?? existing?.tags ?? [],
      privacy: data.privacy ?? existing?.privacy ?? 'private',
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
    return { preset: await this.presetRepo.upsert(record) };
  }

  async getPreset(videoAssetId: string): Promise<MediaAssetPresetRecord | null> {
    return this.presetRepo.findByVideoAssetId(videoAssetId);
  }

  async deletePreset(videoAssetId: string): Promise<boolean> {
    return this.presetRepo.delete(videoAssetId);
  }
}
