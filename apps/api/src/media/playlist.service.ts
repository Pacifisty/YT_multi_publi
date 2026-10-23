import { randomUUID } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { extname, join, basename } from 'node:path';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov']);

export interface PlaylistItemRecord {
  id: string;
  playlistId: string;
  videoAssetId: string;
  position: number;
  usedAt: string | null;
  status?: 'available' | 'reserved' | 'published';
  reservedAt?: string | null;
  publishedAt?: string | null;
  reservationToken?: string | null;
  createdAt: string;
}

export interface PlaylistRecord {
  id: string;
  ownerEmail: string | null;
  name: string;
  folderPath: string | null;
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
  reserveItem(itemId: string, reservationToken: string, reservedAt: string, expectedStatus?: PlaylistItemRecord['status']): Promise<PlaylistItemRecord | null>;
  releaseItem(itemId: string, reservationToken?: string): Promise<boolean>;
  markItemPublished(itemId: string, publishedAt: string): Promise<boolean>;
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
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    return this.playlists.filter((p) => p.ownerEmail?.trim().toLowerCase() === normalizedOwnerEmail);
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

  async reserveItem(itemId: string, reservationToken: string, reservedAt: string, expectedStatus: PlaylistItemRecord['status'] = 'available'): Promise<PlaylistItemRecord | null> {
    for (const p of this.playlists) {
      const item = p.items.find((i) => i.id === itemId);
      if (!item || (item.status ?? 'available') !== expectedStatus) continue;
      item.status = 'reserved';
      item.reservedAt = reservedAt;
      item.reservationToken = reservationToken;
      return item;
    }
    return null;
  }

  async releaseItem(itemId: string, reservationToken?: string): Promise<boolean> {
    for (const p of this.playlists) {
      const item = p.items.find((i) => i.id === itemId);
      if (!item || (reservationToken && item.reservationToken !== reservationToken)) continue;
      item.status = 'available';
      item.reservedAt = null;
      item.reservationToken = null;
      return true;
    }
    return false;
  }

  async markItemPublished(itemId: string, publishedAt: string): Promise<boolean> {
    for (const p of this.playlists) {
      const item = p.items.find((i) => i.id === itemId);
      if (!item) continue;
      item.status = 'published';
      item.usedAt = publishedAt;
      item.publishedAt = publishedAt;
      item.reservedAt = null;
      item.reservationToken = null;
      return true;
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
  findByStoragePath(path: string): Promise<{ id: string; storage_path: string } | null>;
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

  private isOwnedBy(playlist: PlaylistRecord, ownerEmail?: string): boolean {
    if (!ownerEmail) return true;
    return playlist.ownerEmail?.trim().toLowerCase() === ownerEmail.trim().toLowerCase();
  }

  async getOwnedPlaylist(id: string, ownerEmail?: string): Promise<PlaylistRecord | null> {
    const playlist = await this.playlistRepo.findById(id);
    return playlist && this.isOwnedBy(playlist, ownerEmail) ? playlist : null;
  }

  async createPlaylist(input: { name: string; folderPath?: string | null; ownerEmail?: string }): Promise<{ playlist: PlaylistRecord }> {
    const nowIso = this.now().toISOString();
    const record: PlaylistRecord = {
      id: randomUUID(),
      ownerEmail: input.ownerEmail?.trim().toLowerCase() || null,
      name: input.name,
      folderPath: input.folderPath?.trim() || null,
      items: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    return { playlist: await this.playlistRepo.create(record) };
  }

  async deletePlaylist(id: string, ownerEmail?: string): Promise<boolean> {
    if (!await this.getOwnedPlaylist(id, ownerEmail)) return false;
    return this.playlistRepo.delete(id);
  }

  async addItemToPlaylist(playlistId: string, videoAssetId: string, ownerEmail?: string): Promise<{ item: PlaylistItemRecord } | { error: string }> {
    const playlist = await this.getOwnedPlaylist(playlistId, ownerEmail);
    if (!playlist) return { error: 'Playlist not found' };
    const nowIso = this.now().toISOString();
    const item = await this.playlistRepo.upsertItem({
      id: randomUUID(),
      playlistId,
      videoAssetId,
      position: playlist.items.length,
      usedAt: null,
      status: 'available',
      reservedAt: null,
      publishedAt: null,
      reservationToken: null,
      createdAt: nowIso,
    });
    return { item };
  }

  async removeItemFromPlaylist(playlistId: string, videoAssetId: string, ownerEmail?: string): Promise<boolean> {
    if (!await this.getOwnedPlaylist(playlistId, ownerEmail)) return false;
    return this.playlistRepo.removeItem(playlistId, videoAssetId);
  }

  async pickNextAutoVideo(playlistId: string, ownerEmail?: string): Promise<{ videoAssetId: string; itemId: string } | null> {
    const playlist = await this.getOwnedPlaylist(playlistId, ownerEmail);
    if (!playlist || playlist.items.length === 0) return null;

    // Prefer never-used items, then oldest-used
    const unused = playlist.items.filter((i) => i.usedAt === null);
    const pool = unused.length > 0 ? unused : [...playlist.items].sort((a, b) => (a.usedAt! < b.usedAt! ? -1 : 1));

    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { videoAssetId: pick.videoAssetId, itemId: pick.id };
  }

  async reserveNextVideo(
    playlistId: string,
    ownerEmail?: string,
    options: { sequence?: 'random' | 'sequential' | 'fresh-first'; repeat?: 'no-repeat' | 'allow-repeat' | 'stop' } = {},
  ): Promise<{ videoAssetId: string; itemId: string; reservationToken: string } | null> {
    const playlist = await this.getOwnedPlaylist(playlistId, ownerEmail);
    if (!playlist) return null;
    const available = playlist.items.filter((item) => item.status !== 'reserved');
    const neverPublished = available.filter((item) => item.usedAt === null);
    const repeat = options.repeat ?? 'no-repeat';
    let pool = neverPublished;
    if (pool.length === 0 && repeat === 'allow-repeat') pool = available;
    if (pool.length === 0) return null;

    const sequence = options.sequence ?? 'sequential';
    const ordered = [...pool].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
    const candidates = sequence === 'random'
      ? ordered.map((value) => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value)
      : sequence === 'fresh-first'
        ? [...ordered].sort((a, b) => (a.usedAt ?? '').localeCompare(b.usedAt ?? ''))
        : ordered;
    for (const selected of candidates) {
      const reservationToken = randomUUID();
      const reserved = await this.playlistRepo.reserveItem(selected.id, reservationToken, this.now().toISOString(), selected.status ?? 'available');
      if (reserved) return { videoAssetId: reserved.videoAssetId, itemId: reserved.id, reservationToken };
    }
    return null;
  }

  async releaseReservation(itemId: string, reservationToken?: string): Promise<boolean> {
    return this.playlistRepo.releaseItem(itemId, reservationToken);
  }

  async markItemPublished(itemId: string): Promise<boolean> {
    return this.playlistRepo.markItemPublished(itemId, this.now().toISOString());
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
    const byFolder = new Map(existingPlaylists.filter((p) => p.folderPath).map((p) => [p.folderPath!, p]));

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
      let nextPosition = playlist.items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
      for (const file of videoFiles) {
        const existing = await assetLookup.findByStoragePath(file.absolutePath);
        const assetId = existing ? existing.id : (await assetLookup.registerVideoFile(file)).id;
        await this.playlistRepo.upsertItem({
          id: randomUUID(),
          playlistId: playlist.id,
          videoAssetId: assetId,
          position: nextPosition++,
          usedAt: null,
          status: 'available',
          reservedAt: null,
          publishedAt: null,
          reservationToken: null,
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
