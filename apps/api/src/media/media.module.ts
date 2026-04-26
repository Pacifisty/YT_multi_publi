import { SessionGuard } from '../auth/session.guard';
import { MediaController } from './media.controller';
import { MediaService, type MediaServiceOptions } from './media.service';
import { PlaylistService, type PlaylistRepository, type PresetRepository } from './playlist.service';
import { PlaylistController } from './playlist.controller';

export interface MediaModuleOptions extends MediaServiceOptions {
  playlistRepository?: PlaylistRepository;
  presetRepository?: PresetRepository;
}

export interface MediaModuleInstance {
  mediaController: MediaController;
  mediaService: MediaService;
  playlistService: PlaylistService;
  playlistController: PlaylistController;
  sessionGuard: SessionGuard;
}

export function createMediaModule(options: MediaModuleOptions = {}): MediaModuleInstance {
  const { playlistRepository, presetRepository, ...mediaOptions } = options;
  const mediaService = new MediaService(mediaOptions);
  const sessionGuard = new SessionGuard();
  const mediaController = new MediaController(mediaService, sessionGuard);
  const playlistService = new PlaylistService({
    playlistRepo: playlistRepository,
    presetRepo: presetRepository,
  });
  const playlistController = new PlaylistController(playlistService, mediaService, sessionGuard);

  return {
    mediaController,
    mediaService,
    playlistService,
    playlistController,
    sessionGuard,
  };
}
