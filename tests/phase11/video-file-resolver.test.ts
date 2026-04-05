import { describe, expect, test, vi } from 'vitest';

import {
  InMemoryVideoFileResolver,
} from '../../apps/api/src/integrations/youtube/video-file-resolver';

describe('InMemoryVideoFileResolver', () => {
  test('resolves video asset ID to file path', async () => {
    const getMediaAsset = vi.fn().mockResolvedValue({
      id: 'asset-1',
      storagePath: '/uploads/2026/04/video.mp4',
    });

    const resolver = new InMemoryVideoFileResolver({ getMediaAsset });

    const filePath = await resolver.resolve('asset-1');
    expect(filePath).toBe('/uploads/2026/04/video.mp4');
    expect(getMediaAsset).toHaveBeenCalledWith('asset-1');
  });

  test('throws when media asset not found', async () => {
    const getMediaAsset = vi.fn().mockResolvedValue(null);

    const resolver = new InMemoryVideoFileResolver({ getMediaAsset });

    await expect(resolver.resolve('missing')).rejects.toThrow('Media asset not found');
  });

  test('throws when media asset has no storage path', async () => {
    const getMediaAsset = vi.fn().mockResolvedValue({
      id: 'asset-1',
      storagePath: '',
    });

    const resolver = new InMemoryVideoFileResolver({ getMediaAsset });

    await expect(resolver.resolve('asset-1')).rejects.toThrow('no storage path');
  });
});
