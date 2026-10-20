export interface SaveData {
  v: 1;
  stage: number;
  letters: string[];
  achievements: string[];
  collection: Record<string, number>;
  seen: string[];
  boxP: boolean;
  creatureCaught: boolean;
  muted: boolean;
  playMs: number;
  finishedMs?: number;
  noteDismissed: boolean;
  /** Mistakes (failed challenges + wrong passwords) in the current extended level. */
  levelMistakes: number;
  /** playMs value when the current extended level began. */
  levelStartMs: number;
  /** Riddles solved on the first attempt at that object (Riddle Master). */
  riddleWins: number;
  /** Timed math challenges solved (Human Calculator). */
  mathWins: number;
  /** Best Star Catcher result: 0 = none yet, 1 = bronze, 2 = silver, 3 = gold. */
  bestArcadeRank: number;
  /** True once every achievement (main + secret) has been collected at least once. */
  hardModeUnlocked: boolean;
  /** Player's own toggle, only meaningful once hardModeUnlocked is true. */
  hardMode: boolean;
  /** 'default' | 'mint' | 'sunset' | 'galaxy' — kept as a plain string here so
   *  state.ts doesn't need to depend on world.ts's ThemeName type. */
  roomTheme: string;
  /** YYYY-MM-DD of the last day a daily reward was claimed. */
  lastVisitDay?: string;
  dailyStreak: number;
}

const KEY = 'little-world-save-v1';

const fresh = (): SaveData => ({
  v: 1,
  stage: 0,
  letters: [],
  achievements: [],
  collection: {},
  seen: [],
  boxP: false,
  creatureCaught: false,
  muted: false,
  playMs: 0,
  noteDismissed: false,
  levelMistakes: 0,
  levelStartMs: 0,
  riddleWins: 0,
  mathWins: 0,
  bestArcadeRank: 0,
  hardModeUnlocked: false,
  hardMode: false,
  roomTheme: 'default',
  dailyStreak: 0,
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    return { ...fresh(), ...data };
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
