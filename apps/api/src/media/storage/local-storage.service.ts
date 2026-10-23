import { access, mkdir, writeFile, rename, unlink, copyFile, readdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join, relative, resolve, sep } from 'node:path';

export type StorageKind = 'video' | 'thumbnail';

export interface UploadedMediaFile {
  originalname: string;
  mimetype?: string;
  buffer?: Buffer;
  filePath?: string;
  size?: number;
  durationSeconds?: number;
  keepSource?: boolean;
}

export interface StoredMediaFile {
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}

export interface LocalStorageServiceOptions {
  rootDir?: string;
}

export interface ManagedStorageFile {
  storagePath: string;
  modifiedAtMs: number;
}

export class LocalStorageService {
  readonly providerName = 'local' as const;
  private readonly rootDir: string;
  private readonly rootDirAbsolute: string;

  constructor(options: LocalStorageServiceOptions = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.rootDirAbsolute = resolve(this.rootDir);
  }

  async save(kind: StorageKind, file: UploadedMediaFile): Promise<StoredMediaFile> {
    const folder = kind === 'video' ? 'videos' : 'thumbnails';
    const extension = safeExtensionForUpload(kind, file.mimetype, file.originalname);
    const fileName = `${randomUUID()}${extension}`;
    const relativePath = `storage/${folder}/${fileName}`;
    const targetDirectory = join(this.rootDir, 'storage', folder);
    const targetPath = join(targetDirectory, fileName);

    await mkdir(targetDirectory, { recursive: true });

    if (file.filePath) {
      if (file.keepSource) {
        await copyFile(file.filePath, targetPath);
      } else {
        try {
          await rename(file.filePath, targetPath);
        } catch {
          // cross-device move: copy then delete
          await copyFile(file.filePath, targetPath);
          await unlink(file.filePath).catch(() => {});
        }
      }
    } else if (file.buffer) {
      await writeFile(targetPath, file.buffer);
    } else {
      throw new Error('UploadedMediaFile must have either buffer or filePath');
    }

    return {
      original_name: file.originalname,
      storage_path: relativePath,
      mime_type: file.mimetype ?? 'application/octet-stream',
      size_bytes: file.size ?? (file.buffer?.byteLength ?? 0),
    };
  }

  async delete(storagePath: string): Promise<boolean> {
    const absolutePath = this.resolveManagedPath(storagePath);

    try {
      await unlink(absolutePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async materialize(storagePath: string): Promise<string> {
    const absolutePath = this.resolveManagedPath(storagePath);
    await access(absolutePath);
    return absolutePath;
  }

  async listManagedFiles(): Promise<ManagedStorageFile[]> {
    const files: ManagedStorageFile[] = [];
    await this.collectManagedFiles(join(this.rootDirAbsolute, 'storage', 'videos'), files);
    await this.collectManagedFiles(join(this.rootDirAbsolute, 'storage', 'thumbnails'), files);
    return files;
  }

  private async collectManagedFiles(directory: string, files: ManagedStorageFile[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await this.collectManagedFiles(absolutePath, files);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const fileStat = await stat(absolutePath);
      files.push({
        storagePath: relative(this.rootDirAbsolute, absolutePath).split(sep).join('/'),
        modifiedAtMs: fileStat.mtimeMs,
      });
    }
  }

  resolveManagedPath(storagePath: string): string {
    const absolutePath = resolve(this.rootDirAbsolute, storagePath);
    const managedDirectories = [
      resolve(this.rootDirAbsolute, 'storage', 'videos'),
      resolve(this.rootDirAbsolute, 'storage', 'thumbnails'),
    ];
    const isManaged = managedDirectories.some((directory) => (
      absolutePath.startsWith(`${directory}${sep}`)
    ));

    if (!isManaged) {
      throw new Error('Refusing to delete a file outside managed media storage.');
    }

    return absolutePath;
  }
}

function normalizeExtension(fileName: string): string {
  const extension = extname(fileName).trim().toLowerCase();

  if (!extension || extension === '.') {
    return '';
  }

  return extension;
}

function safeExtensionForUpload(kind: StorageKind, mimeType: string | undefined, originalName: string): string {
  const byMime: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'image/jpeg': '.jpg',
    'image/png': '.png',
  };
  const expected = byMime[mimeType ?? ''];
  if (expected) return expected;

  const original = normalizeExtension(originalName);
  const allowlist = kind === 'video' ? new Set(['.mp4', '.mov']) : new Set(['.jpg', '.jpeg', '.png']);
  return allowlist.has(original) ? original : '';
}
