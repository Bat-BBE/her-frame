import { sound } from './audio';
import { ui } from './ui';
import {
  BADGES, TIER_NAME, QUEST_POOL, MYSTERY_WORDS, CALENDAR, PAY, REWARDS,
  levelForXp, titleFor, type StatKey, type QuestEvent, type RoomId, type Rarity,
} from './data';
import type { SaveData } from './state';

export interface ProgressHost {
  s: SaveData;
  save(): void;
  rollReward(opts: { rarity?: Rarity; id?: string; reason?: string }): void;
  /** Re-render HUD bits that show XP / coins / quests. */
  onProgress(): void;
  /** Total interactive objects in the house (for Explorer / Curator). */
  objectCount(): number;
  /** Candidate object ids for today's mystery letters (unlocked rooms only). */
  mysteryCandidates(): string[];
}

export const today = () => new Date().toLocaleDateString('sv-SE');

/** Small deterministic PRNG so "today's" picks are the same all day. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dayHash = (d: string) => [...d].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

export function seededShuffle<T>(arr: T[], rnd: () => number) {
  const r = arr.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export class Progress {
  constructor(private h: ProgressHost) {}

  private get s() { return this.h.s; }

  get level() { return levelForXp(this.s.xp); }
  get title() { return titleFor(this.level); }

  // ------------------------------------------------------------------ xp / coins
  award(xp: number, coins = 0, label?: string) {
    if (!xp && !coins) return;
    const before = this.level;
    this.s.xp += xp;
    this.s.coins = Math.max(0, this.s.coins + coins);
    this.h.save();
    ui.gain(xp, coins, label);
    if (coins > 0) sound.coin();
    const after = this.level;
    if (after > before) {
      for (let L = before + 1; L <= after; L++) {
        const bonus = 30 + L * 10;
        this.s.coins += bonus;
        setTimeout(() => {
          sound.levelUp();
          ui.levelUp(L, titleFor(L), bonus, titleFor(L) !== titleFor(L - 1));
        }, 600);
        if (L % 5 === 0) setTimeout(() => this.h.rollReward({ reason: `${L}-р түвшний бэлэг` }), 2600);
      }
      this.h.save();
    }
    this.h.onProgress();
  }

  spend(coins: number) {
    if (this.s.coins < coins) return false;
    this.s.coins -= coins;
    this.h.save();
    this.h.onProgress();
    return true;
  }

  // ------------------------------------------------------------------ stats + badges
  stat(key: StatKey, n = 1) {
    this.s.stats[key] = (this.s.stats[key] ?? 0) + n;
    this.h.save();
    this.checkBadges();
  }

  private measure(id: string): number {
    const s = this.s;
    switch (id) {
      case 'explorer': return s.seen.length;
      case 'solver': return s.stats.challenges ?? 0;
      case 'collector': return Object.keys(s.collection).length;
      case 'loyal': return s.bestStreak;
      case 'mochifriend': return s.stats.pets ?? 0;
      case 'chef': return s.stats.cooks ?? 0;
      case 'dailydet': return s.stats.mysteries ?? 0;
      case 'questor': return s.stats.quests ?? 0;
      case 'homeowner': return s.owned.length;
      case 'greenthumb': return s.treeStage;
      case 'arcadeleg': return s.bestArcadeRank;
      case 'hider': return s.stats.hides ?? 0;
      default: return 0;
    }
  }

  /** Re-evaluates every tiered badge (cheap; called after any stat change). */
  checkBadges() {
    for (const b of BADGES) {
      if (!b.tiers) continue;
      const have = this.s.badges[b.id] ?? 0;
      const v = this.measure(b.id);
      let tier = have;
      while (tier < 3 && v >= b.tiers[tier]) tier++;
      if (tier > have) {
        this.s.badges[b.id] = tier;
        this.h.save();
        sound.chime();
        ui.achievement(b.name, `${TIER_NAME[tier]} зэрэг · ${b.desc.replace('{n}', String(b.tiers[tier - 1]))}`, b.icon, tier);
        this.award(PAY.badgeTier.xp * tier, PAY.badgeTier.coins * tier);
      }
    }
    if (this.s.seen.length >= this.h.objectCount()) this.badge('curator');
  }

  /** Single (story / secret) badges. */
  badge(id: string) {
    if (this.s.badges[id]) return false;
    const b = BADGES.find((x) => x.id === id);
    if (!b) return false;
    this.s.badges[id] = 1;
    this.h.save();
    sound.chime();
    ui.achievement(b.group === 'secret' ? `Нууц: ${b.name}` : b.name, b.desc, b.icon, 0);
    this.award(b.group === 'secret' ? 80 : 50, b.group === 'secret' ? 40 : 20);
    return true;
  }

  has(id: string) { return !!this.s.badges[id]; }

  // ------------------------------------------------------------------ days
  /** Call on start and periodically. Returns true when a new calendar day began. */
  rollDay() {
    const d = today();
    const hr = new Date().getHours();
    if (hr < 4) this.badge('nightowl');
    else if (hr >= 5 && hr < 7) this.badge('earlybird');
    if (this.s.day === d) return false;
    const prev = this.s.day;
    const gap = prev ? Math.round((new Date(d).getTime() - new Date(prev).getTime()) / 86400000) : null;
    this.s.streak = gap === 1 ? this.s.streak + 1 : 1;
    this.s.bestStreak = Math.max(this.s.bestStreak, this.s.streak);
    if (prev && this.s.calendarClaimed) this.s.calendarIdx = (this.s.calendarIdx + 1) % CALENDAR.length;
    this.s.calendarClaimed = false;
    this.s.day = d;
    this.s.quests = this.pickQuests(d);
    this.s.allQuestsBonus = false;
    this.h.save();
    this.checkBadges();
    if (this.s.streak >= 7 && !this.s.collection.hourglass) {
      setTimeout(() => this.h.rollReward({ id: 'hourglass', reason: '7 өдөр дараалан ирсний шагнал' }), 3000);
    }
    return true;
  }

  private doneRooms() {
    return (Object.keys(this.s.rooms) as RoomId[]).filter((r) => this.s.rooms[r].done);
  }

  private pickQuests(d: string) {
    const done = new Set(this.doneRooms());
    const pool = QUEST_POOL.filter((q) => !q.needs || done.has(q.needs));
    const rnd = seeded(dayHash(d));
    return seededShuffle(pool, rnd).slice(0, 3).map((q) => ({ id: q.id, progress: 0, seen: [] as string[], claimed: false }));
  }

  quest(ev: QuestEvent, target?: string) {
    let changed = false;
    for (const q of this.s.quests) {
      const def = QUEST_POOL.find((x) => x.id === q.id);
      if (!def || def.ev !== ev || q.claimed || q.progress >= def.n) continue;
      if (def.unique) {
        if (!target || q.seen.includes(target)) continue;
        q.seen.push(target);
        q.progress = q.seen.length;
      } else q.progress++;
      changed = true;
      if (q.progress >= def.n) {
        sound.chime();
        ui.toast(`✅ Өдрийн даалгавар биеллээ: «${def.text.replace('{n}', String(def.n))}» — шуудангаас шагналаа ав!`, 4500);
      }
    }
    if (changed) {
      this.h.save();
      this.h.onProgress();
    }
  }

  claimQuest(i: number) {
    const q = this.s.quests[i];
    const def = q && QUEST_POOL.find((x) => x.id === q.id);
    if (!q || !def || q.claimed || q.progress < def.n) return;
    q.claimed = true;
    this.s.stats.quests = (this.s.stats.quests ?? 0) + 1;
    this.award(PAY.quest.xp, PAY.quest.coins, 'Даалгавар');
    if (!this.s.allQuestsBonus && this.s.quests.every((x) => x.claimed)) {
      this.s.allQuestsBonus = true;
      setTimeout(() => this.award(PAY.allQuests.xp, PAY.allQuests.coins, 'Бүх даалгавар!'), 700);
    }
    this.checkBadges();
  }

  claimCalendar() {
    if (this.s.calendarClaimed) return;
    const c = CALENDAR[this.s.calendarIdx];
    this.s.calendarClaimed = true;
    this.h.save();
    this.award(15, c.coins, `Өдрийн бэлэг · ${this.s.calendarIdx + 1}-р өдөр`);
    if (c.roll) setTimeout(() => this.h.rollReward({ rarity: c.roll === 'any' ? undefined : c.roll, reason: `Өдрийн бэлэг — ${this.s.calendarIdx + 1}-р өдөр` }), 900);
  }

  get pendingDaily() {
    const q = this.s.quests.filter((x) => {
      const def = QUEST_POOL.find((d) => d.id === x.id);
      return def && !x.claimed && x.progress >= def.n;
    }).length;
    return (this.s.calendarClaimed ? 0 : 1) + q;
  }

  // ------------------------------------------------------------------ mystery word
  /** Today's mystery (created on first call of the day once the bedroom is done). */
  mystery() {
    const d = today();
    if (!this.s.rooms.bedroom.done) return null;
    if (this.s.mystery?.day === d) return this.s.mystery;
    const rnd = seeded(dayHash(d) ^ 0x9e3779b9);
    const cands = seededShuffle(this.h.mysteryCandidates(), rnd);
    const fitting = MYSTERY_WORDS.filter((m) => m.word.length <= Math.min(8, cands.length));
    if (!fitting.length) return null;
    const m = fitting[Math.floor(rnd() * fitting.length)];
    this.s.mystery = { day: d, word: m.word, clue: m.clue, sources: cands.slice(0, m.word.length), letters: [], solved: false, mistakes: 0 };
    this.h.save();
    return this.s.mystery;
  }

  /** Scrambled letters found so far (in the order found). */
  mysteryFound() {
    const m = this.s.mystery;
    if (!m) return [];
    return m.letters.map((id) => m.word[m.sources.indexOf(id)]);
  }

  solveMystery() {
    const m = this.s.mystery;
    if (!m || m.solved) return;
    m.solved = true;
    this.s.stats.mysteries = (this.s.stats.mysteries ?? 0) + 1;
    this.h.save();
    this.award(PAY.mystery.xp, PAY.mystery.coins, 'Өдрийн нууц');
    this.quest('mystery');
    this.checkBadges();
    if (m.mistakes === 0) setTimeout(() => this.h.rollReward({ reason: 'Өдрийн нууцыг алдаагүй тайлсны шагнал' }), 1400);
  }

  // ------------------------------------------------------------------ collection helpers
  uniqueItems() { return Object.keys(this.s.collection).filter((id) => REWARDS.some((r) => r.id === id)).length; }
}
