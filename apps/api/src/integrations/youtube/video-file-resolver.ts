export interface VideoFileResolver {
  resolve(videoAssetId: string): Promise<string>;
}

export interface MediaAssetLookup {
  id: string;
  storagePath: string;
}

export interface InMemoryVideoFileResolverOptions {
  getMediaAsset: (assetId: string) => Promise<MediaAssetLookup | null>;
}

export class InMemoryVideoFileResolver implements VideoFileResolver {
  private readonly getMediaAsset: (assetId: string) => Promise<MediaAssetLookup | null>;

  constructor(options: InMemoryVideoFileResolverOptions) {
    this.getMediaAsset = options.getMediaAsset;
  }

  async resolve(videoAssetId: string): Promise<string> {
    const asset = await this.getMediaAsset(videoAssetId);

    if (!asset) {
      throw new Error(`Media asset not found: ${videoAssetId}`);
    }

    if (!asset.storagePath) {
      throw new Error(`Media asset ${videoAssetId} has no storage path`);
    }

    return asset.storagePath;
  }
}
