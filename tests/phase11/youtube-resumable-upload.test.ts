import { beforeEach, describe, expect, test, vi } from 'vitest';

const createReadStream = vi.fn(() => 'mock-stream');
const setCredentials = vi.fn();
const videosInsert = vi.fn();
const playlistItemsInsert = vi.fn();
const thumbnailsSet = vi.fn();
const youtubeFactory = vi.fn(() => ({
  videos: { insert: videosInsert },
  playlistItems: { insert: playlistItemsInsert },
  thumbnails: { set: thumbnailsSet },
}));
const OAuth2 = vi.fn(function OAuth2Mock() {
  return { setCredentials };
});

vi.mock('node:fs', () => ({
  createReadStream,
}));

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2 },
    youtube: youtubeFactory,
  },
}));

describe('youtubeResumableUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('adds the uploaded video to the requested playlist after upload succeeds', async () => {
    videosInsert.mockResolvedValue({ data: { id: 'yt-video-123' } });
    playlistItemsInsert.mockResolvedValue({ data: {} });
    thumbnailsSet.mockResolvedValue({ data: {} });

    const { youtubeResumableUpload } = await import('../../apps/api/src/campaigns/youtube-upload.worker');

    const result = await youtubeResumableUpload({
      accessToken: 'access-token',
      filePath: '/videos/test.mp4',
        title: 'Video title',
        description: 'Video description',
        tags: ['alpha', 'beta'],
        playlistId: 'playlist-123',
        thumbnailFilePath: null,
        privacy: 'unlisted',
      });

    expect(result).toEqual({ videoId: 'yt-video-123' });
    expect(setCredentials).toHaveBeenCalledWith({ access_token: 'access-token' });
    expect(createReadStream).toHaveBeenCalledWith('/videos/test.mp4');
    expect(videosInsert).toHaveBeenCalled();
    expect(playlistItemsInsert).toHaveBeenCalledWith({
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId: 'playlist-123',
          resourceId: {
            kind: 'youtube#video',
            videoId: 'yt-video-123',
          },
        },
      },
    });
  });

  test('raises an explicit partial-failure error when playlist insertion fails after upload', async () => {
    videosInsert.mockResolvedValue({ data: { id: 'yt-video-999' } });
    playlistItemsInsert.mockRejectedValue(new Error('playlist forbidden'));
    thumbnailsSet.mockResolvedValue({ data: {} });

    const { youtubeResumableUpload } = await import('../../apps/api/src/campaigns/youtube-upload.worker');

    await expect(
      youtubeResumableUpload({
        accessToken: 'access-token',
        filePath: '/videos/test.mp4',
        title: 'Video title',
        description: 'Video description',
        tags: ['alpha'],
        playlistId: 'playlist-999',
        thumbnailFilePath: null,
        privacy: 'private',
      }),
    ).rejects.toThrow('Video uploaded as yt-video-999, but adding it to playlist failed: playlist forbidden');
  });

  test('applies a custom thumbnail after upload when thumbnailFilePath is provided', async () => {
    videosInsert.mockResolvedValue({ data: { id: 'yt-video-thumb' } });
    playlistItemsInsert.mockResolvedValue({ data: {} });
    thumbnailsSet.mockResolvedValue({ data: {} });

    const { youtubeResumableUpload } = await import('../../apps/api/src/campaigns/youtube-upload.worker');

    const result = await youtubeResumableUpload({
      accessToken: 'access-token',
      filePath: '/videos/test.mp4',
      thumbnailFilePath: '/thumbs/custom.jpg',
      title: 'Video title',
      description: 'Video description',
      tags: ['alpha'],
      playlistId: null,
      privacy: 'private',
    });

    expect(result).toEqual({ videoId: 'yt-video-thumb' });
    expect(thumbnailsSet).toHaveBeenCalledWith({
      videoId: 'yt-video-thumb',
      media: {
        body: 'mock-stream',
      },
    });
    expect(createReadStream).toHaveBeenCalledWith('/thumbs/custom.jpg');
  });

  test('raises an explicit partial-failure error when thumbnail upload fails after video upload', async () => {
    videosInsert.mockResolvedValue({ data: { id: 'yt-video-thumb-fail' } });
    playlistItemsInsert.mockResolvedValue({ data: {} });
    thumbnailsSet.mockRejectedValue(new Error('thumbnail forbidden'));

    const { youtubeResumableUpload } = await import('../../apps/api/src/campaigns/youtube-upload.worker');

    await expect(
      youtubeResumableUpload({
        accessToken: 'access-token',
        filePath: '/videos/test.mp4',
        thumbnailFilePath: '/thumbs/custom.jpg',
        title: 'Video title',
        description: 'Video description',
        tags: ['alpha'],
        playlistId: null,
        privacy: 'private',
      }),
    ).rejects.toThrow('Video uploaded as yt-video-thumb-fail, but applying the thumbnail failed: thumbnail forbidden');
  });
});
