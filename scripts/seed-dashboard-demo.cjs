const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ownerEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
const passwordHash = (process.env.ADMIN_PASSWORD_HASH || 'plain:admin123').trim();
const now = new Date();

const ids = {
  admin: 'demo-admin-user',
  youtubeAccount: 'demo-account-youtube',
  tiktokAccount: 'demo-account-tiktok',
  instagramAccount: 'demo-account-instagram',
  youtubeMain: 'demo-youtube-channel-main',
  youtubeShorts: 'demo-youtube-channel-shorts',
  videoHero: 'demo-media-video-hero',
  videoShort: 'demo-media-video-short',
  videoLong: 'demo-media-video-long',
  thumbHero: 'demo-media-thumb-hero',
  thumbShort: 'demo-media-thumb-short',
  playlist: 'demo-playlist-growth',
};

const campaignIds = [
  'demo-campaign-launching',
  'demo-campaign-completed',
  'demo-campaign-risk',
  'demo-campaign-ready',
  'demo-campaign-draft',
];

const targetIds = [
  'demo-target-launching-youtube',
  'demo-target-launching-tiktok',
  'demo-target-launching-instagram',
  'demo-target-completed-youtube',
  'demo-target-completed-tiktok',
  'demo-target-completed-instagram',
  'demo-target-risk-youtube',
  'demo-target-risk-instagram',
  'demo-target-ready-youtube',
  'demo-target-ready-tiktok',
  'demo-target-draft-instagram',
];

function datePlus({ days = 0, hours = 0, minutes = 0 }) {
  return new Date(now.getTime() + days * 86400000 + hours * 3600000 + minutes * 60000);
}

function mediaData(id, assetType, originalName, sizeBytes, durationSeconds, linkedVideoAssetId = null) {
  return {
    id,
    ownerEmail,
    assetType,
    originalName,
    storagePath: `demo/${originalName}`,
    sizeBytes,
    mimeType: assetType === 'video' ? 'video/mp4' : 'image/png',
    durationSeconds,
    linkedVideoAssetId,
  };
}

function campaignData(id, title, videoAssetId, status, scheduledAt, extra = {}) {
  return {
    id,
    ownerEmail,
    title,
    videoAssetId,
    status,
    scheduledAt,
    playlistId: extra.playlistId ?? null,
    autoMode: extra.autoMode ?? false,
    schedulePattern: extra.schedulePattern ?? null,
    createdAt: extra.createdAt ?? datePlus({ days: -6 }),
    updatedAt: now,
  };
}

function targetData(id, campaignId, platform, destinationId, destinationLabel, data) {
  const isYoutube = platform === 'youtube';
  return {
    id,
    campaignId,
    platform,
    destinationId,
    destinationLabel,
    connectedAccountId: data.connectedAccountId ?? null,
    channelId: isYoutube ? destinationId : null,
    videoTitle: data.videoTitle,
    videoDescription: data.videoDescription,
    tags: data.tags ?? ['demo', 'dashboard', platform],
    publishAt: data.publishAt ?? null,
    playlistId: data.playlistId ?? null,
    privacy: data.privacy ?? (platform === 'youtube' ? 'private' : 'public'),
    thumbnailAssetId: data.thumbnailAssetId ?? null,
    status: data.status,
    externalPublishId: data.externalPublishId ?? null,
    youtubeVideoId: isYoutube ? data.youtubeVideoId ?? data.externalPublishId ?? null : null,
    errorMessage: data.errorMessage ?? null,
    retryCount: data.retryCount ?? 0,
    tiktokPrivacyLevel: platform === 'tiktok' ? data.tiktokPrivacyLevel ?? 'PUBLIC_TO_EVERYONE' : null,
    tiktokDisableComment: platform === 'tiktok' ? data.tiktokDisableComment ?? false : null,
    tiktokDisableDuet: platform === 'tiktok' ? data.tiktokDisableDuet ?? false : null,
    tiktokDisableStitch: platform === 'tiktok' ? data.tiktokDisableStitch ?? true : null,
    instagramCaption: platform === 'instagram' ? data.instagramCaption ?? data.videoDescription : null,
    instagramShareToFeed: platform === 'instagram' ? data.instagramShareToFeed ?? true : null,
    createdAt: data.createdAt ?? datePlus({ days: -5 }),
    updatedAt: now,
  };
}

async function upsertById(model, rows) {
  for (const row of rows) {
    await model.upsert({
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
}

async function main() {
  await prisma.adminUser.upsert({
    where: { email: ownerEmail },
    update: {
      fullName: 'Dashboard Demo Admin',
      passwordHash,
      isActive: true,
      planSelectionCompleted: true,
    },
    create: {
      id: ids.admin,
      email: ownerEmail,
      fullName: 'Dashboard Demo Admin',
      passwordHash,
      isActive: true,
      planSelectionCompleted: true,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.accountPlan.upsert({
    where: { email: ownerEmail },
    update: {
      plan: 'PRO',
      tokens: 1280,
      selectedAt: datePlus({ days: -18 }),
      billingStartedAt: datePlus({ days: -18 }),
      billingExpiresAt: datePlus({ days: 12 }),
    },
    create: {
      email: ownerEmail,
      plan: 'PRO',
      tokens: 1280,
      selectedAt: datePlus({ days: -18 }),
      billingStartedAt: datePlus({ days: -18 }),
      billingExpiresAt: datePlus({ days: 12 }),
      createdAt: now,
      updatedAt: now,
    },
  });

  await upsertById(prisma.connectedAccount, [
    {
      id: ids.youtubeAccount,
      ownerEmail,
      provider: 'youtube',
      googleSubject: 'demo-google-subject',
      email: 'studio@example.com',
      displayName: 'Studio Growth Network',
      accessTokenEnc: 'demo-token-youtube',
      refreshTokenEnc: 'demo-refresh-youtube',
      scopes: ['youtube.upload', 'youtube.readonly'],
      tokenExpiresAt: datePlus({ days: 7 }),
      status: 'connected',
      connectedAt: datePlus({ days: -21 }),
      updatedAt: now,
    },
    {
      id: ids.tiktokAccount,
      ownerEmail,
      provider: 'tiktok',
      googleSubject: 'demo-tiktok-subject',
      email: 'creator@tiktok.example',
      displayName: 'TikTok Creator Desk',
      accessTokenEnc: 'demo-token-tiktok',
      refreshTokenEnc: 'demo-refresh-tiktok',
      scopes: ['video.upload'],
      tokenExpiresAt: datePlus({ days: 5 }),
      status: 'connected',
      connectedAt: datePlus({ days: -11 }),
      updatedAt: now,
    },
    {
      id: ids.instagramAccount,
      ownerEmail,
      provider: 'instagram',
      googleSubject: 'demo-instagram-subject',
      email: 'reels@instagram.example',
      displayName: 'Instagram Reels Hub',
      accessTokenEnc: 'demo-token-instagram',
      refreshTokenEnc: 'demo-refresh-instagram',
      scopes: ['instagram_content_publish'],
      tokenExpiresAt: datePlus({ days: 4 }),
      status: 'connected',
      connectedAt: datePlus({ days: -9 }),
      updatedAt: now,
    },
  ]);

  await upsertById(prisma.youTubeChannel, [
    {
      id: ids.youtubeMain,
      connectedAccountId: ids.youtubeAccount,
      youtubeChannelId: 'UCdemoMain',
      title: 'PMP Growth Lab',
      handle: '@pmpgrowth',
      thumbnailUrl: null,
      isActive: true,
      lastSyncedAt: now,
    },
    {
      id: ids.youtubeShorts,
      connectedAccountId: ids.youtubeAccount,
      youtubeChannelId: 'UCdemoShorts',
      title: 'PMP Shorts Radar',
      handle: '@pmpshorts',
      thumbnailUrl: null,
      isActive: true,
      lastSyncedAt: now,
    },
  ]);

  await upsertById(prisma.mediaAsset, [
    mediaData(ids.videoHero, 'video', 'dashboard-growth-system.mp4', 184_000_000, 482),
    mediaData(ids.videoShort, 'video', 'reels-launch-cut.mp4', 48_000_000, 42),
    mediaData(ids.videoLong, 'video', 'creator-operating-system.mp4', 252_000_000, 920),
    mediaData(ids.thumbHero, 'thumbnail', 'dashboard-growth-system.png', 3_600_000, 0, ids.videoHero),
    mediaData(ids.thumbShort, 'thumbnail', 'reels-launch-cut.png', 2_200_000, 0, ids.videoShort),
  ]);

  await prisma.playlist.upsert({
    where: { id: ids.playlist },
    update: {
      ownerEmail,
      name: 'Demo Growth Rotation',
      folderPath: 'demo/playlists/growth-rotation',
      updatedAt: now,
    },
    create: {
      id: ids.playlist,
      ownerEmail,
      name: 'Demo Growth Rotation',
      folderPath: 'demo/playlists/growth-rotation',
      createdAt: now,
      updatedAt: now,
    },
  });
  await prisma.playlistItem.deleteMany({ where: { playlistId: ids.playlist } });
  await prisma.playlistItem.createMany({
    data: [
      { playlistId: ids.playlist, videoAssetId: ids.videoHero, position: 1, usedAt: datePlus({ days: -2 }) },
      { playlistId: ids.playlist, videoAssetId: ids.videoShort, position: 2, usedAt: null },
      { playlistId: ids.playlist, videoAssetId: ids.videoLong, position: 3, usedAt: null },
    ],
  });

  await prisma.publishJob.deleteMany({ where: { campaignTargetId: { in: targetIds } } });
  await prisma.campaignTarget.deleteMany({ where: { id: { in: targetIds } } });
  await prisma.auditEvent.deleteMany({ where: { campaignId: { in: campaignIds } } });

  await upsertById(prisma.campaign, [
    campaignData('demo-campaign-launching', 'Live launch wave / Shorts + Reels', ids.videoShort, 'launching', datePlus({ hours: 1 }), {
      playlistId: ids.playlist,
      autoMode: true,
      schedulePattern: 'random-window',
      createdAt: datePlus({ days: -1 }),
    }),
    campaignData('demo-campaign-completed', 'Published growth recap across all platforms', ids.videoHero, 'completed', datePlus({ days: -2 }), {
      playlistId: ids.playlist,
      createdAt: datePlus({ days: -4 }),
    }),
    campaignData('demo-campaign-risk', 'Quota pressure recovery batch', ids.videoLong, 'failed', datePlus({ days: -1, hours: -3 }), {
      createdAt: datePlus({ days: -3 }),
    }),
    campaignData('demo-campaign-ready', 'Ready creator system drop', ids.videoHero, 'ready', datePlus({ days: 1, hours: 2 }), {
      playlistId: ids.playlist,
      createdAt: datePlus({ days: -2 }),
    }),
    campaignData('demo-campaign-draft', 'Draft Instagram narrative test', ids.videoShort, 'draft', null, {
      createdAt: datePlus({ hours: -10 }),
    }),
  ]);

  const targets = [
    targetData('demo-target-launching-youtube', 'demo-campaign-launching', 'youtube', ids.youtubeShorts, 'PMP Shorts Radar', {
      videoTitle: 'Live Launch: 42-second creator workflow',
      videoDescription: 'Short-form launch cut queued for the next publishing wave.',
      publishAt: datePlus({ minutes: 35 }),
      playlistId: ids.playlist,
      thumbnailAssetId: ids.thumbShort,
      status: 'enviando',
    }),
    targetData('demo-target-launching-tiktok', 'demo-campaign-launching', 'tiktok', ids.tiktokAccount, 'TikTok Creator Desk', {
      connectedAccountId: ids.tiktokAccount,
      videoTitle: 'TikTok creator workflow pulse',
      videoDescription: 'Launch wave currently processing for TikTok.',
      publishAt: datePlus({ minutes: 50 }),
      status: 'aguardando',
    }),
    targetData('demo-target-launching-instagram', 'demo-campaign-launching', 'instagram', ids.instagramAccount, 'Instagram Reels Hub', {
      connectedAccountId: ids.instagramAccount,
      videoTitle: 'Reels workflow pulse',
      videoDescription: 'Reels caption and feed sharing enabled.',
      publishAt: datePlus({ hours: 1 }),
      status: 'aguardando',
      instagramCaption: 'Demo launch wave for the new dashboard cockpit.',
    }),
    targetData('demo-target-completed-youtube', 'demo-campaign-completed', 'youtube', ids.youtubeMain, 'PMP Growth Lab', {
      videoTitle: 'Published dashboard growth recap',
      videoDescription: 'Completed YouTube publish with playlist and thumbnail.',
      publishAt: datePlus({ days: -2 }),
      playlistId: ids.playlist,
      thumbnailAssetId: ids.thumbHero,
      status: 'publicado',
      youtubeVideoId: 'yt-demo-growth-recap',
      externalPublishId: 'yt-demo-growth-recap',
    }),
    targetData('demo-target-completed-tiktok', 'demo-campaign-completed', 'tiktok', ids.tiktokAccount, 'TikTok Creator Desk', {
      connectedAccountId: ids.tiktokAccount,
      videoTitle: 'Growth recap for TikTok',
      videoDescription: 'Completed TikTok publish.',
      publishAt: datePlus({ days: -2, hours: 1 }),
      status: 'publicado',
      externalPublishId: 'tt-demo-growth-recap',
    }),
    targetData('demo-target-completed-instagram', 'demo-campaign-completed', 'instagram', ids.instagramAccount, 'Instagram Reels Hub', {
      connectedAccountId: ids.instagramAccount,
      videoTitle: 'Growth recap reel',
      videoDescription: 'Completed Instagram Reels publish.',
      publishAt: datePlus({ days: -2, hours: 2 }),
      status: 'publicado',
      externalPublishId: 'ig-demo-growth-recap',
      instagramCaption: 'Completed demo reel for the dashboard.',
    }),
    targetData('demo-target-risk-youtube', 'demo-campaign-risk', 'youtube', ids.youtubeMain, 'PMP Growth Lab', {
      videoTitle: 'Quota recovery upload',
      videoDescription: 'Failed post-upload operation for dashboard risk panel.',
      publishAt: datePlus({ days: -1 }),
      playlistId: ids.playlist,
      thumbnailAssetId: ids.thumbHero,
      status: 'erro',
      errorMessage: 'Video uploaded as yt-demo-partial, but adding it to playlist failed: forbidden',
      retryCount: 2,
    }),
    targetData('demo-target-risk-instagram', 'demo-campaign-risk', 'instagram', ids.instagramAccount, 'Instagram Reels Hub', {
      connectedAccountId: ids.instagramAccount,
      videoTitle: 'Reauth-needed reel',
      videoDescription: 'Requires reauthorization.',
      publishAt: datePlus({ days: -1 }),
      status: 'erro',
      errorMessage: 'REAUTH_REQUIRED',
      retryCount: 1,
      instagramCaption: 'This demo target drives the risk panel.',
    }),
    targetData('demo-target-ready-youtube', 'demo-campaign-ready', 'youtube', ids.youtubeMain, 'PMP Growth Lab', {
      videoTitle: 'Ready creator operating system',
      videoDescription: 'Ready YouTube target with thumbnail.',
      publishAt: datePlus({ days: 1, hours: 2 }),
      playlistId: ids.playlist,
      thumbnailAssetId: ids.thumbHero,
      status: 'aguardando',
    }),
    targetData('demo-target-ready-tiktok', 'demo-campaign-ready', 'tiktok', ids.tiktokAccount, 'TikTok Creator Desk', {
      connectedAccountId: ids.tiktokAccount,
      videoTitle: 'Ready TikTok operating system',
      videoDescription: 'Ready TikTok target.',
      publishAt: datePlus({ days: 1, hours: 2, minutes: 30 }),
      status: 'aguardando',
    }),
    targetData('demo-target-draft-instagram', 'demo-campaign-draft', 'instagram', ids.instagramAccount, 'Instagram Reels Hub', {
      connectedAccountId: ids.instagramAccount,
      videoTitle: 'Draft Instagram narrative',
      videoDescription: 'Draft target for library and platform mix panels.',
      status: 'aguardando',
      instagramCaption: 'Draft demo caption.',
    }),
  ];

  await prisma.campaignTarget.createMany({ data: targets });

  await prisma.publishJob.createMany({
    data: [
      {
        id: 'demo-job-launching-youtube',
        campaignTargetId: 'demo-target-launching-youtube',
        status: 'processing',
        attempt: 1,
        progressPercent: 62,
        startedAt: datePlus({ minutes: -12 }),
        createdAt: datePlus({ minutes: -18 }),
      },
      {
        id: 'demo-job-launching-tiktok',
        campaignTargetId: 'demo-target-launching-tiktok',
        status: 'queued',
        attempt: 1,
        progressPercent: 0,
        createdAt: datePlus({ minutes: -8 }),
      },
      {
        id: 'demo-job-completed-youtube',
        campaignTargetId: 'demo-target-completed-youtube',
        status: 'completed',
        attempt: 1,
        progressPercent: 100,
        youtubeVideoId: 'yt-demo-growth-recap',
        startedAt: datePlus({ days: -2, minutes: -18 }),
        completedAt: datePlus({ days: -2 }),
        createdAt: datePlus({ days: -2, minutes: -24 }),
      },
      {
        id: 'demo-job-completed-tiktok',
        campaignTargetId: 'demo-target-completed-tiktok',
        status: 'completed',
        attempt: 1,
        progressPercent: 100,
        startedAt: datePlus({ days: -2, hours: 1, minutes: -18 }),
        completedAt: datePlus({ days: -2, hours: 1 }),
        createdAt: datePlus({ days: -2, hours: 1, minutes: -24 }),
      },
      {
        id: 'demo-job-risk-youtube',
        campaignTargetId: 'demo-target-risk-youtube',
        status: 'failed',
        attempt: 3,
        progressPercent: 88,
        errorMessage: 'Video uploaded as yt-demo-partial, but adding it to playlist failed: forbidden',
        errorClass: 'post_upload_step_failed',
        startedAt: datePlus({ days: -1, minutes: -35 }),
        completedAt: datePlus({ days: -1, minutes: -20 }),
        createdAt: datePlus({ days: -1, minutes: -45 }),
      },
      {
        id: 'demo-job-risk-instagram',
        campaignTargetId: 'demo-target-risk-instagram',
        status: 'failed',
        attempt: 2,
        progressPercent: 18,
        errorMessage: 'REAUTH_REQUIRED',
        errorClass: 'reauth_required',
        startedAt: datePlus({ days: -1, minutes: -28 }),
        completedAt: datePlus({ days: -1, minutes: -24 }),
        createdAt: datePlus({ days: -1, minutes: -36 }),
      },
    ],
  });

  await prisma.auditEvent.createMany({
    data: [
      { id: 'demo-audit-1', eventType: 'mark_ready', actorEmail: ownerEmail, campaignId: 'demo-campaign-ready', targetId: null, createdAt: datePlus({ days: -2 }) },
      { id: 'demo-audit-2', eventType: 'launch_campaign', actorEmail: ownerEmail, campaignId: 'demo-campaign-launching', targetId: null, createdAt: datePlus({ hours: -2 }) },
      { id: 'demo-audit-3', eventType: 'publish_completed', actorEmail: 'system@internal', campaignId: 'demo-campaign-completed', targetId: 'demo-target-completed-youtube', createdAt: datePlus({ days: -2 }) },
      { id: 'demo-audit-4', eventType: 'publish_completed', actorEmail: 'system@internal', campaignId: 'demo-campaign-completed', targetId: 'demo-target-completed-tiktok', createdAt: datePlus({ days: -2, hours: 1 }) },
      { id: 'demo-audit-5', eventType: 'publish_completed', actorEmail: 'system@internal', campaignId: 'demo-campaign-completed', targetId: 'demo-target-completed-instagram', createdAt: datePlus({ days: -2, hours: 2 }) },
      { id: 'demo-audit-6', eventType: 'publish_failed', actorEmail: 'system@internal', campaignId: 'demo-campaign-risk', targetId: 'demo-target-risk-youtube', createdAt: datePlus({ days: -1 }) },
      { id: 'demo-audit-7', eventType: 'retry_target', actorEmail: ownerEmail, campaignId: 'demo-campaign-risk', targetId: 'demo-target-risk-youtube', createdAt: datePlus({ days: -1, hours: 1 }) },
      { id: 'demo-audit-8', eventType: 'add_targets_bulk', actorEmail: ownerEmail, campaignId: 'demo-campaign-launching', targetId: null, createdAt: datePlus({ hours: -3 }) },
      { id: 'demo-audit-9', eventType: 'update_campaign', actorEmail: ownerEmail, campaignId: 'demo-campaign-draft', targetId: null, createdAt: datePlus({ minutes: -45 }) },
    ],
  });

  console.log(`Seeded dashboard demo workspace for ${ownerEmail}.`);
  console.log(`Campaigns: ${campaignIds.length}, targets: ${targetIds.length}, assets: 5, accounts: 3.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
