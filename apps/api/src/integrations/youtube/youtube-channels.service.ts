export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  handle?: string;
  thumbnailUrl?: string;
}

export interface YouTubeChannelsListResult {
  channels: YouTubeChannelInfo[];
}

export interface YouTubeChannelsServiceOptions {
  fetchChannels?: (accessToken: string) => Promise<YouTubeChannelsListResult>;
}

export class YouTubeChannelsService {
  private readonly fetchChannelsFn: (accessToken: string) => Promise<YouTubeChannelsListResult>;

  constructor(options: YouTubeChannelsServiceOptions = {}) {
    this.fetchChannelsFn = options.fetchChannels ?? defaultFetchChannels;
  }

  async listMineChannels(accessToken: string): Promise<YouTubeChannelsListResult> {
    return this.fetchChannelsFn(accessToken);
  }
}

async function defaultFetchChannels(accessToken: string): Promise<YouTubeChannelsListResult> {
  const { google } = await import('googleapis');
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  const response = await youtube.channels.list({
    part: ['id', 'snippet'],
    mine: true,
    maxResults: 50,
  });

  const items = response.data.items ?? [];

  return {
    channels: items.map((item) => ({
      channelId: item.id!,
      title: item.snippet?.title ?? '',
      handle: item.snippet?.customUrl,
      thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? undefined,
    })),
  };
}
