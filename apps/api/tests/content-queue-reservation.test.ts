import { describe, expect, test } from 'vitest';

import { PlaylistService } from '../src/media/playlist.service';

describe('content queue reservations', () => {
  test('reserves different items while an earlier item is still reserved', async () => {
    const service = new PlaylistService({ now: () => new Date('2026-10-08T12:00:00.000Z') });
    const { playlist } = await service.createPlaylist({ name: 'Fila', ownerEmail: 'owner@example.com' });
    await service.addItemToPlaylist(playlist.id, 'video-a', 'owner@example.com');
    await service.addItemToPlaylist(playlist.id, 'video-b', 'owner@example.com');

    const first = await service.reserveNextVideo(playlist.id, 'owner@example.com', { sequence: 'sequential' });
    const second = await service.reserveNextVideo(playlist.id, 'owner@example.com', { sequence: 'sequential' });

    expect(first?.videoAssetId).toBe('video-a');
    expect(second?.videoAssetId).toBe('video-b');
    expect(second?.reservationToken).not.toBe(first?.reservationToken);
  });

  test('publishing marks the item and no-repeat stops after exhaustion', async () => {
    const service = new PlaylistService();
    const { playlist } = await service.createPlaylist({ name: 'Fila', ownerEmail: 'owner@example.com' });
    await service.addItemToPlaylist(playlist.id, 'video-a', 'owner@example.com');
    const reservation = await service.reserveNextVideo(playlist.id, 'owner@example.com');
    expect(reservation).not.toBeNull();
    await service.markItemPublished(reservation!.itemId);

    expect(await service.reserveNextVideo(playlist.id, 'owner@example.com', { repeat: 'no-repeat' })).toBeNull();
    expect((await service.getOwnedPlaylist(playlist.id, 'owner@example.com'))?.items[0].status).toBe('published');
  });

  test('does not expose or mutate another owner content queue', async () => {
    const service = new PlaylistService();
    const { playlist } = await service.createPlaylist({ name: 'Privada', ownerEmail: 'owner@example.com' });
    expect(await service.getOwnedPlaylist(playlist.id, 'other@example.com')).toBeNull();
    expect(await service.addItemToPlaylist(playlist.id, 'video-a', 'other@example.com')).toEqual({ error: 'Playlist not found' });
  });

  test('does not expose legacy unowned queues to an authenticated account', async () => {
    const service = new PlaylistService();
    const { playlist } = await service.createPlaylist({ name: 'Sem proprietario' });

    expect(await service.getOwnedPlaylist(playlist.id, 'owner@example.com')).toBeNull();
    expect((await service.listPlaylists('owner@example.com')).playlists).toEqual([]);
  });
});
