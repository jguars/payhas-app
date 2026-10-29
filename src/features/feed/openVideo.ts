import { router } from 'expo-router';

import type { FeedVideo } from './data';

let pending: FeedVideo | null = null;

/**
 * Open a video in Home's For you feed from anywhere (Discover, a channel page,
 * Saved). The feed jumps to it if it's already loaded; otherwise it slots this
 * one in at the top, so a tap never lands on the wrong video.
 */
export function openVideo(v: FeedVideo) {
  pending = v;
  router.navigate({ pathname: '/', params: { v: v.id } });
}

/** The video handed over by `openVideo`, once, if it's the one being opened. */
export function takeOpened(id: string): FeedVideo | null {
  const v = pending?.id === id ? pending : null;
  pending = null;
  return v;
}
