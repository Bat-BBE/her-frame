import type { PaintId, RoomId, StatKey, LightsMode, HatId } from './data';
import type { AvatarLook } from './avatar';

export interface RoomSave {
  unlocked: boolean;
  done: boolean;
  /** Chapter step (0 = just arrived). The study keeps using SaveData.stage instead. */
  step: number;
  /** Free-form per-chapter facts ('alarm-off', 'piece-bed', 'tv-ch', ...). */
  flags: string[];
  paint: PaintId;
}

export interface DailyQuest {
  id: string;
  progress: number;
  /** For unique quests: the distinct targets counted so far. */
  seen: string[];
  claimed: boolean;
}

export interface SaveData {
  v: 2;
  // ---------------------------------------------------------------- study story (unchanged from v1)
  stage: number;
  letters: string[];
  creatureCaught: boolean;
  bestArcadeRank: number;
  finishedMs?: number;
  // ---------------------------------------------------------------- house
  rooms: Record<RoomId, RoomSave>;
  /** Room the camera was last focused on (null = whole-house view). */
  focus: RoomId | null;
  inventory: string[];
  /** Letters found in the bathroom's word puzzle (object ids). */
  bathLetters: string[];
  // ---------------------------------------------------------------- meta
  xp: number;
  coins: number;
  collection: Record<string, number>;
  /** badge id → tier reached (1..3; single badges are always 1). */
  badges: Record<string, number>;
  stats: Partial<Record<StatKey, number>>;
  seen: string[];
  /** Hidden-find counters: object id → times poked. */
  pokes: Record<string, number>;
  // ---------------------------------------------------------------- daily
  day?: string;
  streak: number;
  bestStreak: number;
  calendarIdx: number;
  calendarClaimed: boolean;
  quests: DailyQuest[];
  allQuestsBonus: boolean;
  mystery: { day: string; word: string; clue: string; sources: string[]; letters: string[]; solved: boolean; mistakes: number } | null;
  treeStage: number;
  waterDay?: string;
  // ---------------------------------------------------------------- shop / decor
  owned: string[];
  paints: PaintId[];
  hat: HatId | null;
  lights: LightsMode;
  // ---------------------------------------------------------------- settings
  muted: boolean;
  playMs: number;
  noteDismissed: boolean;
  hardModeUnlocked: boolean;
  hardMode: boolean;
  /** No Shadow hunts at all (for younger / calmer players). */
  calmMode: boolean;
  /** Set once the Shadow catches you even once (for the Untouchable badge). */
  everCaught: boolean;
  /** Post-game: the Shadow hunts again in every room, for rewards. */
  nightHunt: boolean;
  /** Last hiding spot used per room — hiding twice in the same spot is risky. */
  lastHide: Record<string, string>;
  /** The scripted first encounter in the bedroom has played. */
  shadowMet: boolean;
  /** The player's own character (null until created). */
  avatar: AvatarLook | null;
}

const KEY = 'little-world-save-v1';

const room = (paint: PaintId, unlocked = false): RoomSave => ({ unlocked, done: false, step: 0, flags: [], paint });

const fresh = (): SaveData => ({
  v: 2,
  stage: 0,
  letters: [],
  creatureCaught: false,
  bestArcadeRank: 0,
  rooms: {
    bedroom: room('sakura', true),
    study: room('violet'),
    living: room('cream'),
    kitchen: room('mint'),
    bath: room('ocean'),
    observatory: room('galaxy'),
  },
  focus: 'bedroom',
  inventory: [],
  bathLetters: [],
  xp: 0,
  coins: 0,
  collection: {},
  badges: {},
  stats: {},
  seen: [],
  pokes: {},
  streak: 0,
  bestStreak: 0,
  calendarIdx: 0,
  calendarClaimed: false,
  quests: [],
  allQuestsBonus: false,
  mystery: null,
  treeStage: 0,
  owned: [],
  paints: ['violet', 'sakura', 'cream', 'mint', 'ocean', 'galaxy'],
  hat: null,
  lights: 'warm',
  muted: false,
  playMs: 0,
  noteDismissed: false,
  hardModeUnlocked: false,
  hardMode: false,
  calmMode: false,
  everCaught: false,
  nightHunt: false,
  lastHide: {},
  shadowMet: false,
  avatar: null,
});

/** v1 saves were a single room: the study. Carry the story progress over into the
 *  new house (the bedroom counts as already done, so nobody replays a tutorial)
 *  and keep collection / sound settings. Everything else starts fresh. */
function migrate(old: Record<string, unknown>): SaveData {
  const s = fresh();
  const stage = Math.min(Number(old.stage ?? 0), 5);
  if (stage > 0 || (Array.isArray(old.seen) && old.seen.length)) {
    s.rooms.bedroom.done = true;
    s.rooms.study.unlocked = true;
    s.focus = 'study';
    s.stage = stage;
    s.letters = stage === Number(old.stage) && Array.isArray(old.letters) ? (old.letters as string[]) : [];
    s.creatureCaught = !!old.creatureCaught;
    if (stage >= 5) {
      s.rooms.study.done = true;
      s.rooms.living.unlocked = true;
      s.focus = 'living';
    }
  }
  if (old.collection && typeof old.collection === 'object') s.collection = { ...(old.collection as Record<string, number>) };
  s.muted = !!old.muted;
  s.playMs = Number(old.playMs ?? 0);
  s.bestArcadeRank = Number(old.bestArcadeRank ?? 0);
  s.noteDismissed = !!old.noteDismissed;
  return s;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    if (data.v !== 2) return migrate(data);
    const f = fresh();
    const s: SaveData = { ...f, ...data };
    // Rooms added after a save was written still need an entry.
    s.rooms = { ...f.rooms, ...(data.rooms ?? {}) };
    return s;
  } catch {
    return fresh();
  }
}

export function writeSave(d: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable — progress lives only in memory */
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const hasSave = () => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
};
