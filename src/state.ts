export interface SaveData {
  v: 1;
  stage: number;
  letters: string[];
  achievements: string[];
  collection: Record<string, number>;
  seen: string[];
  boxP: boolean;
  creatureCaught: boolean;
  meteorCount: number;
  muted: boolean;
  playMs: number;
  finishedMs?: number;
  noteDismissed: boolean;
  totalClicks: number;
  /** Best Star Catcher result: 0 = none yet, 1 = bronze, 2 = silver, 3 = gold. */
  bestArcadeRank: number;
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
  meteorCount: 0,
  muted: false,
  playMs: 0,
  noteDismissed: false,
  totalClicks: 0,
  bestArcadeRank: 0,
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
