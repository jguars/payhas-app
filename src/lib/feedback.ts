/**
 * One place for "how an action feels": every call pairs a sound with a haptic.
 *
 *   fx.like()  fx.heart()  fx.save()  fx.pop()  fx.win() …
 *
 * Sounds are synthesised by tools/sfx/make_sfx.py (short, -12 dBFS, mixed
 * under the video audio). Haptics use Android's own presets, which follow the
 * phone's vibration settings; iOS gets the matching impact styles. Both can be
 * turned off per device in Me → Sounds / Vibration.
 */
import 'expo-sqlite/localStorage/install';

import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const SOURCES = {
  tap: require('../../assets/sfx/tap.wav'),
  tab: require('../../assets/sfx/tab.wav'),
  toggle_on: require('../../assets/sfx/toggle_on.wav'),
  toggle_off: require('../../assets/sfx/toggle_off.wav'),
  sheet: require('../../assets/sfx/sheet.wav'),
  like: require('../../assets/sfx/like.wav'),
  heart: require('../../assets/sfx/heart.wav'),
  unlike: require('../../assets/sfx/unlike.wav'),
  react: require('../../assets/sfx/react.wav'),
  save: require('../../assets/sfx/save.wav'),
  follow: require('../../assets/sfx/follow.wav'),
  send: require('../../assets/sfx/send.wav'),
  hide: require('../../assets/sfx/hide.wav'),
  key: require('../../assets/sfx/key.wav'),
  success: require('../../assets/sfx/success.wav'),
  error: require('../../assets/sfx/error.wav'),
  pop1: require('../../assets/sfx/pop1.wav'),
  pop2: require('../../assets/sfx/pop2.wav'),
  pop3: require('../../assets/sfx/pop3.wav'),
  combo: require('../../assets/sfx/combo.wav'),
  wrong: require('../../assets/sfx/wrong.wav'),
  flip: require('../../assets/sfx/flip.wav'),
  match: require('../../assets/sfx/match.wav'),
  win: require('../../assets/sfx/win.wav'),
  times_up: require('../../assets/sfx/times_up.wav'),
} as const;

type Sfx = keyof typeof SOURCES;

/** Interface ticks sit lower than rewards. */
const VOLUME: Partial<Record<Sfx, number>> = { tap: 0.45, tab: 0.5, key: 0.55, sheet: 0.5, flip: 0.7 };
/** Sounds that can overlap themselves (rapid pops, fast PIN entry) get a small pool. */
const POOL: Partial<Record<Sfx, number>> = { pop1: 3, pop2: 3, pop3: 3, key: 2, tap: 2, flip: 2 };

// ── settings (per device) ────────────────────────────────────────────────────
const KEY = 'payhas.feedback';
type Settings = { sound: boolean; haptics: boolean };
let settings: Settings = { sound: true, haptics: true };
try {
  const raw = globalThis.localStorage?.getItem(KEY);
  if (raw) settings = { ...settings, ...JSON.parse(raw) };
} catch {}

export function getFeedbackSettings(): Settings {
  return settings;
}

export function setFeedbackSettings(next: Partial<Settings>) {
  settings = { ...settings, ...next };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(settings));
  } catch {}
}

// ── sound ────────────────────────────────────────────────────────────────────
const pools = new Map<Sfx, { players: AudioPlayer[]; next: number }>();
let ready = false;

/** Call once at startup: mix with (never pause) the video, and warm the common players. */
export function initFeedback() {
  if (ready || Platform.OS === 'web') return;
  ready = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  (['tap', 'tab', 'like', 'heart', 'save', 'key'] as Sfx[]).forEach(poolFor);
}

function poolFor(name: Sfx) {
  let pool = pools.get(name);
  if (!pool) {
    const players = Array.from({ length: POOL[name] ?? 1 }, () => {
      const p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUME[name] ?? 0.85;
      return p;
    });
    pool = { players, next: 0 };
    pools.set(name, pool);
  }
  return pool;
}

function play(name: Sfx) {
  if (!settings.sound || Platform.OS === 'web') return;
  try {
    const pool = poolFor(name);
    const p = pool.players[pool.next];
    pool.next = (pool.next + 1) % pool.players.length;
    p.seekTo(0);
    p.play();
  } catch {}
}

// ── haptics ──────────────────────────────────────────────────────────────────
type Feel = 'tick' | 'light' | 'medium' | 'heavy' | 'confirm' | 'reject' | 'toggleOn' | 'toggleOff' | 'longPress' | 'success';
const A = Haptics.AndroidHaptics;

function buzz(feel: Feel) {
  if (!settings.haptics || Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    const map: Record<Feel, Haptics.AndroidHaptics> = {
      tick: A.Segment_Tick,
      light: A.Virtual_Key,
      medium: A.Context_Click,
      heavy: A.Long_Press,
      confirm: A.Confirm,
      reject: A.Reject,
      toggleOn: A.Toggle_On,
      toggleOff: A.Toggle_Off,
      longPress: A.Long_Press,
      success: A.Confirm,
    };
    Haptics.performAndroidHapticsAsync(map[feel]).catch(() => {});
    return;
  }
  const I = Haptics.ImpactFeedbackStyle;
  const N = Haptics.NotificationFeedbackType;
  const run: Record<Feel, () => Promise<void>> = {
    tick: () => Haptics.selectionAsync(),
    light: () => Haptics.impactAsync(I.Light),
    medium: () => Haptics.impactAsync(I.Medium),
    heavy: () => Haptics.impactAsync(I.Heavy),
    confirm: () => Haptics.notificationAsync(N.Success),
    reject: () => Haptics.notificationAsync(N.Error),
    toggleOn: () => Haptics.impactAsync(I.Rigid),
    toggleOff: () => Haptics.impactAsync(I.Soft),
    longPress: () => Haptics.impactAsync(I.Medium),
    success: () => Haptics.notificationAsync(N.Success),
  };
  run[feel]().catch(() => {});
}

// ── the vocabulary screens use ───────────────────────────────────────────────
const both = (sound: Sfx | null, feel: Feel | null) => () => {
  if (sound) play(sound);
  if (feel) buzz(feel);
};

export const fx = {
  /** Generic button / chip. */
  tap: both('tap', 'light'),
  /** Tab bar, segmented controls, topic chips: a selection change. */
  tab: both('tab', 'tick'),
  toggle: (on: boolean) => (on ? both('toggle_on', 'toggleOn') : both('toggle_off', 'toggleOff'))(),
  /** A sheet or menu opening. */
  sheet: both('sheet', 'light'),
  longPress: both('sheet', 'longPress'),
  like: both('like', 'medium'),
  unlike: both('unlike', 'light'),
  /** Double-tap heart. */
  heart: both('heart', 'heavy'),
  react: both('react', 'medium'),
  save: both('save', 'medium'),
  follow: both('follow', 'confirm'),
  send: both('send', 'confirm'),
  hide: both('hide', 'light'),
  /** PIN pad. */
  key: both('key', 'tick'),
  success: both('success', 'success'),
  error: both('error', 'reject'),
  /** Games. */
  pop: () => both((['pop1', 'pop2', 'pop3'] as Sfx[])[Math.floor(Math.random() * 3)], 'tick')(),
  combo: both('combo', 'medium'),
  wrong: both('wrong', 'reject'),
  flip: both('flip', 'tick'),
  match: both('match', 'confirm'),
  win: both('win', 'success'),
  timesUp: both('times_up', 'medium'),
};
