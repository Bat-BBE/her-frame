import * as THREE from 'three';
import gsap from 'gsap';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { World, ROOM_THEMES, type ThemeName } from './world';
import { Sky } from './sky';
import { Creature } from './creature';
import { sound } from './audio';
import { ui, icon, shapeSvg } from './ui';
import { runStarCatcher, GOAL, DURATION } from './arcade';
import { loadSave, writeSave, wipeSave, type SaveData } from './state';
import {
  ACHIEVEMENTS, REWARDS, RARITY_LABEL, TITLE_PREFIX, TITLE_NOUN, WORDS, LETTER_SOURCES,
  GLYPH_ORDER, GLYPH_WALL, QUESTS, HINTS, OBJECTS, LEVELS, stageToLevel, SECRET_CLUES,
  EXT_LEVELS, EXT_START, FINAL_STAGE, propStart, isExtStage, PLANT_RIDDLE,
  type Rarity, type RewardDef,
} from './data';
import { runChallenge, pickKind } from './challenges';
import { h, pick, rand, letterTexture, drawGlyph, sleep } from './util';

export interface Ctx {
  world: World;
  sky: Sky;
  creature: Creature;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  rgbShift: ShaderPass;
  snapshot: () => string;
  homeView: () => { pos: THREE.Vector3; target: THREE.Vector3 };
  /** Grow the room to `levels` unlocked extended levels and reframe the camera. */
  setGrowth: (levels: number, animate: boolean) => void;
}

/** Story objects that can also hide extended-level letters (no hint marker on these). */
const EXT_BASE_SOURCES = ['box', 'bookshelf', 'redbook', 'plant', 'clock', 'lamp', 'rug', 'window', 'beanbag', 'poster', 'neon', 'mug', 'tesseract'];

/** Small deterministic PRNG so a level's letter placement is stable across reloads. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rnd: () => number) {
  const r = arr.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

interface Particle {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  max: number;
  gravity: number;
}

const CONFETTI_COLS = ['#ff7eb6', '#ffd36b', '#7df9ff', '#b388ff', '#7ed957', '#ff9a5c'];

export class Game {
  s: SaveData = loadSave();
  busy = false;
  private blackoutOn = false;
  private glitchOn = false;
  private discoOn = false;
  private lampOn = true;
  private lampClicks: number[] = [];
  private counters: Record<string, number> = {};
  private glyphInput: string[] = [];
  private cubeIdx = 0;
  private eventTimer = 35;
  private peekTimer = 10;
  private hintIdx = 0;
  private showerCooldown = 0;
  private clockSpin = 0;
  private particles: Particle[] = [];
  private confGeo = new THREE.PlaneGeometry(0.07, 0.11);
  private screenT = 0;
  private terminalText = '';
  private lastEvent = '';
  private playStart = performance.now();
  cardAnchor: string | null = null;
  private t = 0;
  private bestScore = 0;
  /** object id → performance.now() until which a failed challenge keeps it locked. */
  private lockedUntil: Record<string, number> = {};
  /** Objects whose challenge was failed at least once this level (for Riddle Master's "first try"). */
  private failedSources = new Set<string>();
  /** End time of the current random meteor-shower event (Stargazer is timing, not clicking). */
  private meteorEventUntil = 0;
  private srcCache: { stage: number; map: Record<string, number> } | null = null;

  constructor(private c: Ctx) {
    c.creature.onEscaped = () => {
      if (this.s.stage >= 1 && !this.s.creatureCaught) ui.toast('Мочи дахиад нуугдчихлаа... Улаан номыг санаарай.');
    };
    // Drop achievements that no longer exist (the old "click it N times" ones).
    this.s.achievements = this.s.achievements.filter((id) => ACHIEVEMENTS.some((a) => a.id === id));
    this.applyState();
    this.refreshHUD();
  }

  // ------------------------------------------------------------------ state
  private save() {
    const now = performance.now();
    this.s.playMs += now - this.playStart;
    this.playStart = now;
    writeSave(this.s);
  }

  private applyState() {
    const { world, creature } = this.c;
    world.setTheme(this.validTheme(this.s.roomTheme));
    for (const id of this.s.seen) {
      const hs = world.hotspots.get(id);
      if (hs) hs.visible = false;
    }
    if (this.s.stage >= 1) {
      world.boxLid.rotation.x = -1.9;
      world.boxGlow.emissiveIntensity = 1.2;
    }
    if (this.s.stage >= 2) this.arcadePower(true);
    if (this.s.stage >= 4) {
      world.bookshelf.position.z = -1.8 + 2.6;
      world.lights.alcove.intensity = 9;
      world.lightBase.set(world.lights.alcove, 9);
      for (const cube of world.cubes) cube.visible = true;
    }
    if (this.s.stage >= 5) {
      world.cubes.forEach((cube) => this.placeCube(cube, true));
      this.finaleAmbience(true);
    }
    if (this.s.creatureCaught) creature.sit(true);
    // Story finished (finale seen) on an older build — move straight into Level 06.
    if (this.s.stage === 5 && this.s.finishedMs !== undefined) this.enterExtStage(EXT_START);
    if (this.s.stage >= EXT_START) {
      this.c.setGrowth(Math.min(this.s.stage, FINAL_STAGE - 1) - EXT_START + 1, false);
      // Letters from an older save layout may not match this level's sources.
      const src = this.extSources();
      this.s.letters = this.s.letters.filter((id) => id in src);
    }
    this.syncPropHotspots();
    sound.setMuted(this.s.muted);
    this.syncSoundButton();
    if (this.s.noteDismissed) document.getElementById('sticky')?.remove();
  }

  refreshHUD() {
    const lvlIdx = stageToLevel(this.s.stage);
    const lvl = LEVELS[lvlIdx];
    const done = this.s.stage >= FINAL_STAGE;
    let title: string, sub: string, slots = 0, letters: string[] = [];
    if (this.s.stage < EXT_START) {
      const st = this.s.stage;
      const q = QUESTS[st];
      title = q.title;
      sub = q.sub;
      const map = LETTER_SOURCES[st];
      const word = st < 2 ? WORDS[st] : st === 4 ? WORDS[2] : '';
      slots = word.length;
      letters = map ? this.s.letters.map((id) => map[id]) : st === 4 ? WORDS[2].slice(0, this.cubeIdx).split('') : [];
    } else if (!done) {
      const ext = EXT_LEVELS[this.s.stage - EXT_START];
      title = ext.title;
      sub = `Hint: «${ext.clue}» — англи үг, ${ext.word.length} үсэг. Үсгүүд холилдож гарна.`;
      slots = ext.word.length;
      letters = this.foundLetters();
    } else {
      title = 'Little World Master';
      sub = 'Бүх 12 түвшнийг давлаа! Нууц амжилтуудаа бүгдийг нь олсон уу?';
    }
    ui.setQuest(lvlIdx + 1, LEVELS.length, title, sub, slots, letters, lvl, done);
    ui.setCounter(this.s.achievements.length, ACHIEVEMENTS.length);
  }

  // ------------------------------------------------------------------ extended levels
  private nowPlayMs() {
    return this.s.playMs + (performance.now() - this.playStart);
  }

  /** For the current extended level: object id → index of the letter it hides.
   *  This level's brand-new objects come first, then older new objects, then
   *  story objects (which get no hint marker) — so later words reach further
   *  into the room. Deterministic per level so reloads keep the same layout. */
  private extSources(): Record<string, number> {
    if (!isExtStage(this.s.stage)) return {};
    if (this.srcCache?.stage === this.s.stage) return this.srcCache.map;
    const k = this.s.stage - EXT_START;
    const rnd = seeded((k + 1) * 9973);
    const ids = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => `prop${a + i}`);
    const newest = ids(propStart(k), propStart(k + 1));
    const older = ids(0, propStart(k));
    const order = [...seededShuffle(newest, rnd), ...seededShuffle(older, rnd), ...seededShuffle(EXT_BASE_SOURCES, rnd)];
    const map: Record<string, number> = {};
    order.slice(0, EXT_LEVELS[k].word.length).forEach((id, i) => { map[id] = i; });
    this.srcCache = { stage: this.s.stage, map };
    return map;
  }

  private foundLetters() {
    if (!isExtStage(this.s.stage)) return [];
    const word = EXT_LEVELS[this.s.stage - EXT_START].word;
    const src = this.extSources();
    return this.s.letters.map((id) => word[src[id]]);
  }

  /** Only the new objects that still hide a letter this level get the glowing marker. */
  private syncPropHotspots() {
    const { world } = this.c;
    const src = this.extSources();
    for (const id of world.propTypes.keys()) {
      const hs = world.hotspots.get(id);
      if (hs) hs.visible = id in src && !this.s.letters.includes(id);
    }
  }

  private enterExtStage(stage: number) {
    this.s.stage = stage;
    this.s.letters = [];
    this.s.levelMistakes = 0;
    this.s.levelStartMs = this.nowPlayMs();
    this.lockedUntil = {};
    this.failedSources.clear();
    this.srcCache = null;
    this.save();
  }

  /** Called once the story finale modal is dismissed: the room grows and Level 06 begins. */
  private beginExtLevels() {
    if (this.s.stage !== 5) return;
    this.enterExtStage(EXT_START);
    this.c.setGrowth(1, true);
    this.syncPropHotspots();
    this.refreshHUD();
    sound.powerUp();
    setTimeout(() => {
      ui.toast(`Өрөө томорлоо! ${EXT_LEVELS[0].props} шинэ объект гарч ирлээ — Түвшин 06 эхэллээ.`, 6000);
    }, 1200);
  }

  private async tryChallenge(id: string) {
    const left = (this.lockedUntil[id] ?? 0) - performance.now();
    if (left > 0) {
      sound.lock();
      this.card(id, `Түгжигдсэн байна... ${Math.ceil(left / 1000)} секундын дараа дахин оролд.`);
      return;
    }
    const k = this.s.stage - EXT_START;
    ui.hideCard();
    this.busy = true;
    const res = await runChallenge({ kind: pickKind(k), level: k, hard: this.s.hardMode, title: this.nameOf(id) });
    this.busy = false;
    if (res.ok) {
      if (res.kind === 'riddle' && !this.failedSources.has(id)) {
        this.s.riddleWins++;
        if (this.s.riddleWins >= 8) this.unlock('riddler');
      }
      if (res.kind === 'math') {
        this.s.mathWins++;
        if (this.s.mathWins >= 6) this.unlock('mathwiz');
      }
      if (res.kind === 'memory' && res.size >= 7) this.unlock('memory');
      this.card(id, 'Зөв! Нуугдсан үсэг ил гарлаа.', 3500);
      await this.revealLetter(id);
      this.syncPropHotspots();
    } else {
      const sec = 5 + k * 2 + (this.s.hardMode ? 3 : 0);
      this.lockedUntil[id] = performance.now() + sec * 1000;
      this.failedSources.add(id);
      this.s.levelMistakes++;
      this.save();
      this.card(id, `Буруу! Энэ объект ${sec} секунд түгжигдлээ. Энэ түвшний алдаа: ${this.s.levelMistakes}`, 4500);
      this.syncPropHotspots();
    }
  }

  private async solveExtLevel() {
    const k = this.s.stage - EXT_START;
    const ext = EXT_LEVELS[k];
    const levelNo = this.s.stage;
    const elapsed = this.nowPlayMs() - this.s.levelStartMs;
    const mistakes = this.s.levelMistakes;
    this.busy = true;
    ui.flash('#ffffff', 0.7);
    this.rgbGlitch(0.012, 1.2);
    sound.fanfare();
    this.confetti(this.c.world.anchorOf('computer'), 120, 1.2);
    if (mistakes === 0) this.unlock('flawless');
    if (mistakes >= 3) this.unlock('comeback');
    if (elapsed < 120000) this.unlock('blitz');
    this.enterExtStage(this.s.stage + 1);
    const last = this.s.stage >= FINAL_STAGE;
    if (this.s.stage === 8) this.unlock('deep');
    if (last) this.unlock('master');
    this.refreshHUD();
    this.syncPropHotspots();
    this.busy = false;

    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const stars = mistakes === 0 ? '★★★' : mistakes <= 2 ? '★★☆' : '★☆☆';
    const next = last ? null : EXT_LEVELS[k + 1];
    const el = h('div', { class: 'finale' });
    el.innerHTML = `
      <p class="eyebrow">Түвшин ${String(levelNo).padStart(2, '0')} давлаа</p>
      <h2 class="hand">${ext.word}</h2>
      <div class="stats">
        <div><b>${mins}:${String(secs).padStart(2, '0')}</b><span>хугацаа</span></div>
        <div><b>${mistakes}</b><span>алдаа</span></div>
        <div><b>${stars}</b><span>үнэлгээ</span></div>
      </div>
      <p class="muted">${next
        ? `Дараагийнх: Түвшин ${String(levelNo + 1).padStart(2, '0')} — ${next.title}. Өрөө томорч ${next.props} шинэ объект гарч ирнэ. Үг ${next.word.length} үсэгтэй, сорилтууд улам хэцүү.`
        : 'Чи Little World-ийн бүх 12 түвшнийг давлаа. Жинхэнэ мастер!'}</p>`;
    const b = h('button', { class: 'btn-primary' }, next ? 'Дараагийн түвшин' : 'Гайхалтай!');
    b.addEventListener('click', () => ui.closeModal());
    el.append(b);
    ui.openModal(el, {
      className: 'modal-finale',
      onClose: () => {
        if (next) {
          this.c.setGrowth(this.s.stage - EXT_START + 1, true);
          this.syncPropHotspots();
          sound.powerUp();
          setTimeout(() => this.rollReward({ reason: `Түвшин ${String(levelNo).padStart(2, '0')}-г давсны шагнал` }), 2600);
        } else {
          setTimeout(() => this.rollReward({ id: 'hourglass', reason: 'Бүх 12 түвшнийг давсны шагнал' }), 800);
        }
      },
    });
  }

  private baseOf(id: string) {
    if (id.startsWith('glyph')) return 'glyph';
    if (id.startsWith('cube')) return 'cube';
    if (id.startsWith('prop')) return this.c.world.propTypes.get(id) ?? 'crate';
    return id;
  }

  private nameOf(id: string) {
    return OBJECTS[this.baseOf(id)]?.name ?? id;
  }

  private onProp(id: string) {
    const type = this.c.world.propTypes.get(id) ?? 'crate';
    const obj = this.c.world.interactives.get(id);
    if (obj) gsap.fromTo(obj.rotation, { z: 0.08 }, { z: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.3)' });
    sound.pop();
    if (this.s.letters.includes(id)) {
      this.card(id, 'Энэ объектын нууцыг чи аль хэдийн олсон.');
      return;
    }
    const lines: Record<string, string[]> = {
      crate: ['Хуучин модон авдар. Энэ удаад хоосон.', 'Авдар хөдлөхгүй. Гэхдээ дараагийн түвшинд юу болохыг хэн мэдэх вэ.'],
      lantern: ['Дэнлүү зөөлөн гэрэлтэж, шинэ хэсгийг гэрэлтүүлж байна.', 'Гэрлийн дотор жижигхэн од эргэлдэж байх шиг.'],
      crystal: ['Болор чулуу дотроосоо гэрэлтэнэ. Хүрэхэд дулаахан.', 'Болорт чиний царай олон болж тусав.'],
      statue: ['Хачин хөшөө. Хэн ч энэ хэлбэрийг тайлбарлаж чаддаггүй.', 'Хөшөө чамайг харж байгаа юм шиг санагдана.'],
      chest: ['Эрдэнэсийн авдар. Хамгийн үнэтэй эрдэнэ нь эрдэм мэдлэг гэдэг.', 'Авдрын түгжээ одоохондоо хөдлөхгүй.'],
      orb: ['Бөмбөлөг дотор өрөөний жижигхэн хуулбар харагдана.', 'Бөмбөлөг эргэлдээд зогсов.'],
      tree: ['Өрөө томрох тусам энэ мод ч бас ургадаг.', 'Навчнууд намуухан шивнэлдэнэ.'],
    };
    this.card(id, this.cycle(`prop-${type}`, lines[type] ?? lines.crate));
  }

  // ------------------------------------------------------------------ hard mode
  /** +3 stars to catch, 5 fewer seconds to do it in. Still beatable (the spawn
   *  math leaves plenty of catchable stars in that window) but leaves little
   *  room for mistakes. */
  private get arcadeGoal() { return this.s.hardMode ? GOAL + 3 : GOAL; }
  private get arcadeDuration() { return this.s.hardMode ? DURATION - 5 : DURATION; }
  /** Mochi gets one fewer lap before it ducks back into hiding, so there's less
   *  time to react and tap it. */
  private creatureLoops(normal: number) { return this.s.hardMode ? Math.max(1, normal - 1) : normal; }

  // ------------------------------------------------------------------ room themes
  private validTheme(name: string): ThemeName {
    return name in ROOM_THEMES ? (name as ThemeName) : 'default';
  }

  /** How many unique reward types have to be collected before a theme unlocks. */
  private themeUnlocked(name: ThemeName) {
    return Object.keys(this.s.collection).length >= ROOM_THEMES[name].unlockAt;
  }

  private setTheme(name: ThemeName) {
    if (!this.themeUnlocked(name)) return;
    this.s.roomTheme = name;
    this.save();
    this.c.world.setTheme(name);
  }

  // ------------------------------------------------------------------ daily reward
  /** Call once per app launch, only for returning players (brand-new players get
   *  their own onboarding toast instead — see main.ts). Awards a small reward and
   *  bumps the streak on a fresh calendar day; a gap of more than one day resets it. */
  checkDailyReward() {
    const today = new Date().toLocaleDateString('sv-SE'); // cheap local YYYY-MM-DD
    if (this.s.lastVisitDay === today) return;
    const prev = this.s.lastVisitDay;
    this.s.lastVisitDay = today;
    const gapDays = prev ? Math.round((new Date(today).getTime() - new Date(prev).getTime()) / 86400000) : null;
    this.s.dailyStreak = gapDays === 1 ? this.s.dailyStreak + 1 : 1;
    this.save();
    setTimeout(() => {
      sound.chime();
      ui.toast(`🎁 Өдрийн бэлэг! ${this.s.dailyStreak}-р өдөр дараалан ирлээ.`, 4500);
      setTimeout(() => this.rollReward({ reason: `Өдрийн бэлэг — ${this.s.dailyStreak}-р өдөр` }), 1300);
    }, 1800);
  }

  // ------------------------------------------------------------------ helpers
  private card(id: string, text: string, ms?: number) {
    const base = this.baseOf(id);
    const o = OBJECTS[base] ?? { name: base, color: 'dark', icon: 'star' };
    this.cardAnchor = id;
    ui.showCard({ title: o.name, text, color: o.color, icon: o.icon }, ms);
  }

  private count(id: string) {
    this.counters[id] = (this.counters[id] ?? 0) + 1;
    return this.counters[id];
  }

  private cycle(id: string, lines: string[]) {
    const n = this.count(`line:${id}`) - 1;
    return lines[n % lines.length];
  }

  unlock(id: string) {
    if (this.s.achievements.includes(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.s.achievements.push(id);
    this.save();
    sound.chime();
    ui.achievement(a.title, a.desc);
    ui.setCounter(this.s.achievements.length, ACHIEVEMENTS.length);
    // Secret achievements are side-goals for players who poke at everything, not
    // just the 5-level story — collecting the full set (main + secret) used to lead
    // nowhere once the finale was already seen. Now it unlocks a real post-game goal.
    if (!this.s.hardModeUnlocked && this.s.achievements.length === ACHIEVEMENTS.length) {
      this.s.hardModeUnlocked = true;
      this.save();
      setTimeout(() => {
        sound.legendary();
        ui.flash('#ffd36b', 0.5);
        ui.toast('100%! Чи бүх амжилтыг цуглууллаа. Цэснээс "Хэцүү горим" нээгдлээ 🏆', 7000);
      }, 900);
    }
  }

  private screenPos(v: THREE.Vector3) {
    const p = v.clone().project(this.c.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, on: p.z < 1 };
  }

  private async cinematic(target: THREE.Vector3, pos: THREE.Vector3, dur = 1.4) {
    const { camera, controls } = this.c;
    controls.enabled = false;
    await Promise.all([
      gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: dur, ease: 'power2.inOut' }),
      gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease: 'power2.inOut', onUpdate: () => camera.lookAt(controls.target) }),
    ]);
    controls.enabled = true;
  }

  private shakeCamera(strength = 0.15, dur = 0.8) {
    const cam = this.c.camera;
    const o = { k: 1 };
    const base = cam.position.clone();
    gsap.to(o, {
      k: 0, duration: dur, ease: 'power2.out',
      onUpdate: () => cam.position.set(base.x + rand(-1, 1) * strength * o.k, base.y + rand(-1, 1) * strength * o.k, base.z + rand(-1, 1) * strength * o.k),
      onComplete: () => cam.position.copy(base),
    });
  }

  private rgbGlitch(amount = 0.006, dur = 0.8) {
    const p = this.c.rgbShift;
    p.enabled = true;
    const u = p.uniforms.amount;
    gsap.killTweensOf(u);
    gsap.fromTo(u, { value: amount }, { value: 0, duration: dur, ease: 'power2.out', onComplete: () => { p.enabled = false; } });
  }

  confetti(pos: THREE.Vector3, n = 60, power = 1) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        this.confGeo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(pick(CONFETTI_COLS)).multiplyScalar(1.3), side: THREE.DoubleSide, transparent: true }),
      );
      m.position.copy(pos);
      m.userData.ignoreRay = true;
      this.c.world.root.add(m);
      const a = Math.random() * Math.PI * 2;
      const sp = rand(1, 3) * power;
      this.particles.push({
        obj: m,
        vel: new THREE.Vector3(Math.cos(a) * sp, rand(3, 6) * power, Math.sin(a) * sp),
        spin: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
        life: 0, max: rand(2, 3.2), gravity: 6,
      });
    }
  }

  private puff(pos: THREE.Vector3, n = 8, color = '#ffffff') {
    const mat = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.scale.setScalar(rand(0.08, 0.18));
      s.position.copy(pos).add(new THREE.Vector3(rand(-0.06, 0.06), 0, rand(-0.06, 0.06)));
      s.userData.ignoreRay = true;
      this.c.world.root.add(s);
      this.particles.push({ obj: s, vel: new THREE.Vector3(rand(-0.1, 0.1), rand(0.4, 0.8), rand(-0.1, 0.1)), spin: new THREE.Vector3(), life: -i * 0.08, max: 1.6, gravity: -0.1 });
    }
  }

  private letterFor(id: string): string | undefined {
    if (isExtStage(this.s.stage)) {
      const src = this.extSources();
      return id in src ? EXT_LEVELS[this.s.stage - EXT_START].word[src[id]] : undefined;
    }
    return LETTER_SOURCES[this.s.stage]?.[id];
  }

  private letterTotal() {
    if (isExtStage(this.s.stage)) return EXT_LEVELS[this.s.stage - EXT_START].word.length;
    return Object.keys(LETTER_SOURCES[this.s.stage] ?? {}).length;
  }

  private async revealLetter(sourceId: string, at?: THREE.Vector3) {
    const L = this.letterFor(sourceId);
    if (!L || this.s.letters.includes(sourceId)) return false;
    this.s.letters.push(sourceId);
    this.save();
    const pos = at ?? this.c.world.anchorOf(sourceId);
    const t = letterTexture(L, { glow: true, fg: '#ffe08a' });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthTest: false }));
    spr.renderOrder = 30;
    spr.position.copy(pos);
    spr.scale.setScalar(0.01);
    spr.userData.ignoreRay = true;
    this.c.world.root.add(spr);
    sound.letter();
    this.confetti(pos, 18, 0.5);
    await gsap.timeline()
      .to(spr.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.5, ease: 'back.out(3)' })
      .to(spr.position, { y: pos.y + 0.7, duration: 0.9, ease: 'power2.out' }, 0)
      .to({}, { duration: 0.5 });
    const sp = this.screenPos(spr.position);
    this.c.world.root.remove(spr);
    t.tex.dispose();
    await ui.flyLetter(L, sp.x, sp.y);
    sound.pop();
    this.refreshHUD();
    if (this.s.letters.length === this.letterTotal()) {
      const where = this.s.stage === 1 ? 'Аркад машин' : 'Ширээн дээрх компьютер';
      const extra = isExtStage(this.s.stage) ? ' Үсгүүд холилдсон — сэжүүрийг ашиглан зөв дарааллыг ол!' : '';
      setTimeout(() => ui.toast(`Бүх үсэг олдлоо! ${where} дээр нууц үгээ оруул.${extra}`, 6000), 400);
    }
    return true;
  }

  // ------------------------------------------------------------------ input
  hoverName(id: string | null) {
    if (!id) return null;
    if (id === 'creature' && this.c.creature.mode === 'hidden') return null;
    return OBJECTS[this.baseOf(id)]?.name ?? null;
  }

  onEmptyClick() {
    ui.hideCard();
  }

  onClick(id: string) {
    if (this.busy) return;
    sound.click();
    if (!this.s.seen.includes(id)) {
      this.s.seen.push(id);
      // New-object markers are managed by syncPropHotspots (they mean "still hides a letter").
      const hs = id.startsWith('prop') ? undefined : this.c.world.hotspots.get(id);
      if (hs) gsap.to(hs.scale, { x: 0, y: 0, duration: 0.3, onComplete: () => { hs.visible = false; } });
      if ([...this.c.world.interactives.keys()].every((k) => this.s.seen.includes(k))) this.unlock('curator');
      this.save();
    }
    this.unlock('hello');
    if (this.glitchOn) this.unlock('glitch');
    const obj = this.c.world.interactives.get(id);
    if (obj) {
      const b = obj.userData.baseScale as THREE.Vector3;
      gsap.fromTo(obj.scale, { x: b.x * 0.92, y: b.y * 0.92, z: b.z * 0.92 }, { x: b.x, y: b.y, z: b.z, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    }

    // Extended levels: an object hiding a letter opens a challenge instead of its usual reaction.
    if (isExtStage(this.s.stage) && id in this.extSources() && !this.s.letters.includes(id)) {
      void this.tryChallenge(id);
      return;
    }
    if (id.startsWith('prop')) return this.onProp(id);
    if (id.startsWith('glyph')) return this.onGlyph(Number(id.slice(5)));
    if (id.startsWith('cube')) return this.onCube(Number(id.slice(4)));
    const handler: Record<string, () => void> = {
      box: () => this.onBox(),
      computer: () => this.onComputer(),
      arcade: () => this.onArcade(),
      bookshelf: () => this.onBookshelf(),
      redbook: () => this.onRedbook(),
      plant: () => this.onPlant(),
      clock: () => this.onClock(),
      lamp: () => this.onLamp(),
      rug: () => this.onRug(),
      window: () => this.onWindow(),
      beanbag: () => this.onBeanbag(),
      poster: () => this.onPoster(),
      neon: () => this.onNeon(),
      mug: () => this.onMug(),
      creature: () => this.onCreature(),
      tesseract: () => this.onTesseract(),
    };
    handler[id]?.();
  }

  // ------------------------------------------------------------------ objects
  private onBox() {
    const { world } = this.c;
    if (this.s.stage === 0) {
      sound.lock();
      gsap.fromTo(world.boxBody.rotation, { z: -0.12 }, { z: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.2)' });
      this.card('box', this.cycle('box0', [
        'Түгжээтэй. Маш, маш сэжигтэй.',
        'Дотор нь ямар нэг юм шажигнаж байна...',
        'Хайрцаг: "Намайг битгий сэгсэр." Чи: *сэгсэрнэ*',
        'Нууц үг хэрэгтэй бололтой. Компьютер дээр оролдоод үз.',
      ]));
      return;
    }
    if (this.s.stage === 1 && !this.s.letters.includes('box')) {
      this.card('box', 'Хүлээгээрэй... хайрцагны ёроолд нэг юм наалдсан байна!');
      void this.revealLetter('box');
      return;
    }
    gsap.fromTo(world.boxLid.rotation, { x: -1.9 }, { x: -1.5, duration: 0.15, yoyo: true, repeat: 1 });
    this.card('box', this.cycle('box1', [
      'Хайрцаг одоо албан ёсоор хоосон.',
      'Хоосон хайрцаг. Гэхдээ дурсамжаар дүүрэн.',
      'Дотор нь жижигхэн бичиг: "Энд юу ч байхгүй. Дахиж битгий шалга."',
      'Чи үнэхээр дахиад шалгачихлаа шүү дээ.',
    ]));
  }

  private onComputer() {
    if (this.blackoutOn) {
      this.unlock('dark');
      this.card('computer', 'Бүх зүйл харанхуй... зөвхөн дэлгэц л чамайг харж инээмсэглэж байна. Зоригтой юм аа!');
      return;
    }
    this.openTerminal();
  }

  private onArcade() {
    const { world } = this.c;
    if (this.s.stage === 0) {
      gsap.fromTo(world.arcadeMarquee, { emissiveIntensity: 1.5 }, { emissiveIntensity: 0.35, duration: 0.8 });
      sound.lock();
      this.card('arcade', this.cycle('arc0', [
        'INSERT PASSWORD. Аркад нууц үг хүлээж байна... гэхдээ одоохондоо биш.',
        'Дэлгэц дээр бүдэгхэн "P _ _ _" гэж анивчлаа. Эсвэл чамд тэгж санагдсан уу?',
        'Аркад: "Эхлээд хайрцгийг онгойлго. Тэгээд ярья."',
      ]));
      return;
    }
    if (this.s.stage === 1) return this.openArcadePassword();
    this.openArcadeGame();
  }

  private onBookshelf() {
    const { world } = this.c;
    sound.whoosh();
    const books = [...world.books].sort(() => Math.random() - 0.5).slice(0, 9);
    books.forEach((b, i) => {
      gsap.fromTo(b.position, { y: b.position.y }, { y: b.position.y + 0.12, duration: 0.12, yoyo: true, repeat: 1, delay: i * 0.04, ease: 'power2.out' });
      gsap.fromTo(b.rotation, { x: 0 }, { x: rand(-0.2, 0.2), duration: 0.12, yoyo: true, repeat: 1, delay: i * 0.04 });
    });
    if (this.s.stage === 1 && !this.s.letters.includes('bookshelf')) {
      this.card('bookshelf', 'Нэг номын хуудас дундаас L үсэг уналаа! Ном унших бас ашигтай юм байна.');
      void this.revealLetter('bookshelf');
      return;
    }
    if (this.s.stage === 3) {
      this.card('bookshelf', 'Тавиурын цаанаас сэрүүн салхи үлээж байна... Ард нь юу байгаа бол? Зүүн хананы тэмдгүүдийг хар.');
      return;
    }
    this.card('bookshelf', this.cycle('shelf', [
      'Номын тавиур. 50% мэдлэг, 50% санамсаргүй зүйлс, 100% гоё vibe.',
      'Эдгээр номыг хэн ч уншаагүй. Гэхдээ их гоё харагддаг.',
      'Тавиурын цаанаас жижигхэн шаржигнах чимээ гарав...',
      'Нэг ном цухуйчихсан байна. Улаан өнгөтэй. Сэжигтэй.',
    ]));
  }

  private onRedbook() {
    const { world, creature } = this.c;
    sound.pop();
    gsap.fromTo(world.redbook.position, { x: 0.12 }, { x: 0.32, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' });
    gsap.fromTo(world.redbook.rotation, { z: 0 }, { z: -0.35, duration: 0.25, yoyo: true, repeat: 1 });
    if (!this.s.creatureCaught && creature.mode === 'hidden' && this.s.stage < 4) {
      if (this.s.stage === 0) {
        creature.peek();
        sound.squeak();
        this.card('redbook', 'Улаан номыг татахад тавиурын цаанаас хэн нэгэн шагайгаад... буцаад нуугдчихлаа?!');
      } else {
        sound.squeak();
        setTimeout(() => creature.run(this.creatureLoops(2)), 250);
        this.card('redbook', 'ЮУ ВЭ?! Тавиурын цаанаас жижигхэн амьтан гүйгээд гарлаа! Түүнийг барь!', 5000);
      }
      return;
    }
    this.card('redbook', 'Номын нэр: "Нууц хаалга хэрхэн хийх вэ — 2-р хэвлэл". Нэг хуудас нь урагдчихсан.');
  }

  private onCreature() {
    const { creature } = this.c;
    if (creature.catchable) {
      sound.squeak();
      ui.flash('#ffb3d9', 0.35);
      const at = creature.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      this.confetti(at, 50, 0.8);
      const wasCaught = this.s.creatureCaught;
      this.s.creatureCaught = true;
      this.save();
      creature.catch(() => {});
      if (!wasCaught) {
        this.card('creature', 'Баригдлаа! Энэ бол Мочи. Тэр олон жил тавиурын ард нуугдаж, хэн нэгэн олохыг хүлээж байжээ.', 7000);
        this.unlock('detective');
        if (this.s.stage === 1) void this.revealLetter('creature', at);
        setTimeout(() => this.rollReward({ reason: 'Мочиг барьсны шагнал' }), 4500);
      }
      return;
    }
    if (creature.mode === 'sit') {
      sound.squeak();
      creature.bounce();
      this.card('creature', this.cycle('mochi', [
        'Мочи: "Пиу!"',
        'Мочи чамайг ширтэж байна. Маш их ширтэж байна.',
        'Мочи: "Би хаашаа ч явахгүй ээ... одоохондоо."',
        'Мочи хэвлийгээ илүүлэхийг хүсэж байгаа бололтой.',
        'Мочи: "Хайрцаг хоосон байсныг би мэдэж байсан. Хэлээгүй л юм."',
      ]));
    }
  }

  private async onPlant() {
    const { world } = this.c;
    sound.boing();
    gsap.fromTo(world.plantGrowth.scale, { x: 0.9, y: 0.8, z: 0.9 }, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'elastic.out(1, 0.35)' });
    // Level 01's plant letter: understand what it wants (a choice), don't spam it.
    if (this.s.stage === 0 && !this.s.letters.includes('plant')) {
      const left = (this.lockedUntil.plant ?? 0) - performance.now();
      if (left > 0) {
        this.card('plant', `Ургамал гомдсон хэвээр... ${Math.ceil(left / 1000)} секундын дараа дахин оролд.`);
        return;
      }
      this.busy = true;
      const res = await runChallenge({ kind: 'riddle', level: 0, hard: false, title: 'Ургамал', riddle: PLANT_RIDDLE, noTimer: true });
      this.busy = false;
      if (res.ok) {
        gsap.fromTo(world.plantGrowth.scale, { x: 1.4, y: 1.6, z: 1.4 }, { x: 1, y: 1, z: 1, duration: 1.2, ease: 'elastic.out(1, 0.35)' });
        this.puff(world.anchorOf('plant'), 10, '#9df5b0');
        this.card('plant', 'Ургамал баярласандаа навчаа дэлгээд... навчны завсраас нэг үсэг гарч ирлээ!');
        void this.revealLetter('plant');
      } else {
        this.lockedUntil.plant = performance.now() + 4000;
        this.card('plant', 'Ургамал гомдчихлоо. Түр хүлээгээд дахин оролд. Сэжүүр: юу хамгийн их хэрэгтэй гэж хэлсэн бэ?');
      }
      return;
    }
    this.card('plant', this.cycle('plant', [
      'Ургамал чамайг анзаарлаа.',
      'Ургамал: "Баярлалаа, ярилцаж өгсөнд."',
      'Ургамал нартай өдрийг санагалзаж байх шиг.',
    ]));
  }

  private onClock() {
    const n = this.count('clock');
    const o = { v: this.clockSpin };
    if (n % 4 === 0) {
      sound.rumble();
      this.rgbGlitch(0.008, 1.6);
      this.shakeCamera(0.08, 1);
      gsap.to(o, { v: this.clockSpin - Math.PI * 14, duration: 2.2, ease: 'power3.inOut', onUpdate: () => { this.clockSpin = o.v; } });
      this.card('clock', 'Цаг ухарч эргэлээ! Чи 3 секундийн өмнөх үе рүү аялчихлаа. Ялгаа мэдрэгдэж байна уу?');
      return;
    }
    for (let i = 0; i < 8; i++) setTimeout(() => sound.tick(), i * 90);
    gsap.to(o, { v: this.clockSpin + Math.PI * 4, duration: 1.2, ease: 'power2.inOut', onUpdate: () => { this.clockSpin = o.v; } });
    if (this.s.stage === 0 && !this.s.letters.includes('clock')) {
      this.card('clock', 'Зүү хурдан эргээд... цагны ард нуугдаж байсан үсэг унаад ирлээ!');
      void this.revealLetter('clock');
      return;
    }
    this.card('clock', this.cycle('clock', [
      'Цаг жинхэнэ цагаар явдаг. Гайхалтай, тийм ээ?',
      'Хэн нэгэн "цаг бол мөнгө" гэсэн. Энэ цаг үнэгүй.',
      'Цагийн зүү хурдан эргэлээ. Бусад нь хэвийн.',
    ]));
  }

  private setLamp(on: boolean) {
    const { world } = this.c;
    this.lampOn = on;
    const base = world.lightBase.get(world.lights.lamp) ?? 14;
    gsap.to(world.lights.lamp, { intensity: on && !this.blackoutOn ? base : 0, duration: 0.25 });
    gsap.to(world.lampBulb, { emissiveIntensity: on ? 2 : 0.05, duration: 0.25 });
    gsap.to(world.lampShade, { emissiveIntensity: on ? 0.45 : 0.02, duration: 0.25 });
  }

  private onLamp() {
    const now = performance.now();
    this.lampClicks = this.lampClicks.filter((t) => now - t < 2600);
    this.lampClicks.push(now);
    if (this.lampClicks.length >= 5 && !this.discoOn && !this.blackoutOn) {
      this.lampClicks = [];
      this.disco();
      return;
    }
    this.setLamp(!this.lampOn);
    sound.tick();
    if (!this.lampOn && this.s.stage === 0 && !this.s.letters.includes('lamp')) {
      this.card('lamp', 'Гэрэл унтрахад чийдэнгийн бүрхүүл дээр харанхуйд гэрэлтдэг үсэг харагдлаа!');
      void this.revealLetter('lamp');
      return;
    }
    this.card('lamp', this.lampOn
      ? this.cycle('lampOn', ['Гэрэл асав. Тав тух эргэж ирлээ.', 'Чийдэн: "Би бас амрах эрхтэй шүү."', 'Асаах, унтраах... Чийдэн бол хамгийн энгийн тоглоом.'])
      : this.cycle('lampOff', ['Гэрэл унтрав. Өрөө нууцлаг болчихлоо.', 'Харанхуйд юм илүү сонирхолтой харагддаг.', 'Хурдан хурдан дарвал юу болох бол?']));
  }

  private disco() {
    const { world, creature } = this.c;
    this.discoOn = true;
    this.card('lamp', 'PARTY OF ONE! Чийдэн диско горимд шилжлээ. Бүжиглэ!');
    sound.fanfare();
    const lamp = world.lights.lamp;
    const orig = lamp.color.clone();
    const origFill = world.lights.fill.color.clone();
    lamp.intensity = (world.lightBase.get(lamp) ?? 14) * 1.4;
    world.lampBulb.emissiveIntensity = 2;
    const iv = window.setInterval(() => {
      const hue = Math.random();
      lamp.color.setHSL(hue, 1, 0.55);
      world.lights.fill.color.setHSL((hue + 0.5) % 1, 1, 0.6);
      world.neonMat.emissive.setHSL((hue + 0.25) % 1, 1, 0.55);
      for (const b of world.bulbs) b.mat.emissive.setHSL(Math.random(), 1, 0.6);
      sound.tick();
    }, 220);
    if (creature.mode === 'sit') creature.dance(true);
    setTimeout(() => {
      clearInterval(iv);
      lamp.color.copy(orig);
      world.lights.fill.color.copy(origFill);
      // Was hardcoded to the default theme's blue — broke the neon cloud's color
      // on an alt room theme once disco ended. Restore to whatever's active instead.
      world.neonMat.emissive.set(ROOM_THEMES[this.validTheme(this.s.roomTheme)].neon);
      for (const b of world.bulbs) b.mat.emissive.copy(b.base);
      if (this.s.stage < 5) creature.dance(false);
      this.discoOn = false;
      this.setLamp(true);
    }, 7000);
  }

  private onRug() {
    const { world } = this.c;
    sound.whoosh();
    gsap.fromTo(world.rug.scale, { x: 1.06, y: 0.94 }, { x: 1, y: 1, duration: 1, ease: 'elastic.out(1, 0.3)' });
    gsap.fromTo(world.rug.position, { y: 0.15 }, { y: 0.012, duration: 0.6, ease: 'bounce.out' });
    if (this.s.stage === 0 && !this.s.letters.includes('rug')) {
      this.card('rug', 'Хивсний захыг сөхөхөд доороос нь O үсэг олдлоо. Хэн тэнд нуусан юм бол?');
      void this.revealLetter('rug');
      return;
    }
    this.card('rug', this.cycle('rug', [
      'Хивс. Бүх нууцыг доороо нуудаг гэж ярьдаг.',
      'Хивсний доор... тоос. Premium тоос.',
      'Энэ хивс өрөөг бүхэлд нь холбож өгдөг. Үнэхээр.',
    ]));
  }

  private onWindow() {
    const { sky } = this.c;
    // Stargazer is about noticing the sky's own meteor event in time — not clicking the window repeatedly.
    if (performance.now() < this.meteorEventUntil) this.unlock('stargazer');
    if (this.showerCooldown > 0) {
      this.card('window', 'Тэнгэр амсхийж байна. Хэдэн секундийн дараа дахиад хар.');
      return;
    }
    this.showerCooldown = 7;
    sky.meteorShower(20);
    sound.whoosh();
    if (this.s.stage === 1 && !this.s.letters.includes('window')) {
      this.card('window', 'Цонхоор харахад солирын бороо орж эхэллээ! Нэг солир цонхны тавцан дээр унах шиг боллоо...', 5000);
      setTimeout(() => {
        this.puff(this.c.world.anchorOf('window').add(new THREE.Vector3(0, -1.2, 0)), 10, '#ffb36b');
        void this.revealLetter('window', this.c.world.anchorOf('window').add(new THREE.Vector3(0, -1, 0)));
      }, 2400);
      return;
    }
    this.card('window', this.cycle('window', [
      'Гадаа харахад солир унаж байна. Хүсэл шивнэх цаг!',
      'Энэ жижигхэн ертөнц сансарт хөвж явдгийг мэдэх үү?',
      'Сар инээмсэглэх шиг болов. Эсвэл үгүй.',
    ]));
  }

  private onBeanbag() {
    const { world } = this.c;
    sound.boing();
    gsap.fromTo(world.beanbagInner.scale, { x: 1.18, y: 0.35, z: 1.18 }, { x: 1, y: 0.55, z: 1, duration: 1, ease: 'elastic.out(1, 0.3)' });
    this.card('beanbag', this.cycle('bean', [
      'Пуф! Дэлхийн хамгийн зөөлөн шийдвэр.',
      'Зөөлөн суудал чамайг тэвэрч авлаа.',
      'Энд суувал босохыг хүсэхгүй болно. Анхааруулж байна.',
      'Пуф! Дахиад нэг удаа?',
    ]));
  }

  private onPoster() {
    const { world } = this.c;
    const n = this.count('poster');
    sound.tick();
    if (n % 6 === 0) {
      gsap.to(world.poster.rotation, { z: 0, duration: 1.2, ease: 'elastic.out(1, 0.3)' });
      this.card('poster', 'Төгс шулуун! ...Хэдийгээр өмнөх 5 удаа чи л муруйлгасан ч гэсэн.');
      return;
    }
    gsap.to(world.poster.rotation, { z: rand(-0.35, 0.35), duration: 1, ease: 'elastic.out(1, 0.25)' });
    this.card('poster', this.cycle('poster', [
      '"Nothing is what it seems." Энэ өрөөний гол дүрэм.',
      'Постер арай муруй болчихлоо. Засах уу?',
      'Одоо бүр муруй боллоо.',
      'Чи үүнийг засаж байгаа юм уу эвдэж байгаа юм уу?',
      'Сүүлийн нэг оролдлого...',
    ]));
  }

  private onNeon() {
    const { world } = this.c;
    const cols = ['#5ab8ff', '#ff7eb6', '#7ed957', '#ffd36b', '#b388ff'];
    const n = this.count('neon');
    const col = cols[n % cols.length];
    const tl = gsap.timeline();
    for (let i = 0; i < 4; i++) tl.set(world.neonMat, { emissiveIntensity: 0.2 }, i * 0.08).set(world.neonMat, { emissiveIntensity: 3.2 }, i * 0.08 + 0.04);
    tl.call(() => { world.neonMat.emissive.set(col); world.lights.neon.color.set(col); });
    sound.tick();
    this.card('neon', this.cycle('neon', [
      'Неон үүл. Бороо оруулдаггүй, зөвхөн vibe оруулдаг.',
      'Өнгө солигдлоо. Өрөөний сэтгэл санаа ч бас.',
      'Энэ үүл хэзээ ч бүрхэгддэггүй.',
    ]));
  }

  private onMug() {
    sound.steam();
    this.puff(this.c.world.anchorOf('mug').add(new THREE.Vector3(0, -0.12, 0)), 7);
    this.card('mug', this.cycle('mug', [
      'Кофе. 2019 оноос хойш хүйтэн хэвээр.',
      'Аяган дээр "World\'s okayest explorer" гэж бичжээ.',
      'Чи үүнийг уух гэж байгаа юм биш биз дээ?',
      'Дахиад шалгалаа. Одоо ч хүйтэн.',
    ]));
  }

  private onTesseract() {
    const { world } = this.c;
    world.tesseract.speed = 6;
    gsap.to(world.tesseract, { speed: 1, duration: 3, ease: 'power2.out' });
    this.rgbGlitch(0.01, 1.5);
    sound.legendary();
    const first = !this.s.achievements.includes('fourth');
    this.unlock('fourth');
    this.card('tesseract', first
      ? 'Тессеракт — 4 хэмжээст шоо. Чи түүнд хүрэхэд орон зай хоромхон зуур эвхэгдлээ!'
      : 'Тессеракт эргэлдэж байна. Дөрөв дэх хэмжээс өнөөдөр ч гэсэн ажиллаж байна.');
    if (first) setTimeout(() => this.rollReward({ id: 'tesseract', reason: 'Тессерактад хүрсний шагнал' }), 1500);
  }

  // ------------------------------------------------------------------ glyphs + door
  private onGlyph(i: number) {
    const { world } = this.c;
    const glyph = GLYPH_WALL[i];
    const mat = world.glyphMats[i];
    if (this.s.stage !== 3) {
      sound.tick();
      gsap.fromTo(mat, { emissiveIntensity: 2.5 }, { emissiveIntensity: 0.35, duration: 1 });
      this.card(`glyph${i}`, this.s.stage > 3
        ? 'Тэмдэг дулаахан гэрэлтэж байна. Хаалга аль хэдийн нээгдсэн.'
        : this.cycle('glyph', ['Тэмдэг бүдэгхэн гэрэлтээд унтарлаа... Ямар нэг юм дутуу байна.', 'Хачин тэмдэг. Хаа нэгтээ энэ дарааллыг харсан шиг...', 'Тэмдгүүд дараалал хүлээж байх шиг байна.']));
      return;
    }
    this.glyphInput.push(glyph);
    const k = this.glyphInput.length;
    const ok = GLYPH_ORDER.slice(0, k).join('') === this.glyphInput.join('');
    if (!ok) {
      this.glyphInput = [];
      sound.error();
      for (const m of world.glyphMats) {
        gsap.killTweensOf(m);
        m.emissive.set('#ff3b5c');
        gsap.to(m, { emissiveIntensity: 2, duration: 0.1, yoyo: true, repeat: 3, onComplete: () => { m.emissive.set('#7df9ff'); m.emissiveIntensity = 0.35; } });
      }
      this.card(`glyph${i}`, 'Буруу дараалал! Тэмдгүүд улаанаар анивчлаа. Аркадын HI-SCORE-ыг санаарай.');
      return;
    }
    gsap.killTweensOf(mat);
    mat.emissiveIntensity = 3;
    sound.letter();
    if (k === GLYPH_ORDER.length) {
      this.glyphInput = [];
      void this.openDoor();
    } else {
      ui.toast(`Зөв дараалал: ${k}/${GLYPH_ORDER.length} ✦`, 1100);
    }
  }

  private async openDoor() {
    const { world, creature } = this.c;
    this.busy = true;
    ui.hideCard();
    this.s.stage = 4;
    this.save();
    await this.cinematic(new THREE.Vector3(-4.8, 1.6, -1.6), new THREE.Vector3(6.5, 5.5, 6.5), 1.2);
    sound.rumble();
    this.shakeCamera(0.12, 2.4);
    this.rgbGlitch(0.012, 2.2);
    for (const m of world.glyphMats) gsap.to(m, { emissiveIntensity: 4, duration: 0.4, yoyo: true, repeat: 3 });
    this.puff(new THREE.Vector3(-4.6, 0.2, -0.5), 14, '#c9b8ff');
    this.puff(new THREE.Vector3(-4.6, 0.2, -3.0), 14, '#c9b8ff');
    for (const cube of world.cubes) cube.visible = true;
    gsap.to(world.lights.alcove, { intensity: 9, duration: 2.5, delay: 0.5 });
    world.lightBase.set(world.lights.alcove, 9);
    await gsap.to(world.bookshelf.position, { z: -1.8 + 2.6, duration: 2.6, ease: 'power2.inOut' });
    ui.flash('#b388ff', 0.4);
    sound.success();
    await this.cinematic(new THREE.Vector3(-5.6, 1.4, -1.8), new THREE.Vector3(9, 6.5, 4), 1.6);
    this.unlock('door');
    this.card('cube', 'Нууц өрөө нээгдлээ! Дотор нь үсэгтэй шоонууд хөвж байна. Тэднээр сүүлчийн нууц үгийг бүтээ.', 8000);
    this.cardAnchor = 'cube3';
    this.refreshHUD();
    this.busy = false;
    if (!this.s.creatureCaught && creature.mode === 'hidden') {
      setTimeout(() => {
        ui.toast('Мочи нууц өрөөнөөс гүйгээд гарлаа! Барьж аваарай!');
        creature.run(this.creatureLoops(3));
      }, 2500);
    }
    setTimeout(() => this.rollReward({ reason: 'Нууц өрөөг нээсний шагнал' }), 5000);
  }

  private linePos(k: number) {
    const dir = new THREE.Vector3(1, 0, -1).normalize();
    return new THREE.Vector3(0.4, 3.3, 0.9).addScaledVector(dir, (k - 2) * 0.62);
  }

  private placeCube(cube: THREE.Mesh, instant = false) {
    const k = WORDS[2].indexOf(cube.userData.letter as string);
    const p = this.linePos(k);
    cube.userData.placed = true;
    if (instant) {
      cube.position.copy(p);
      cube.rotation.set(0, Math.PI / 4, 0);
      return Promise.resolve();
    }
    return Promise.all([
      gsap.to(cube.position, { x: p.x, y: p.y, z: p.z, duration: 1.1, ease: 'power3.inOut' }),
      gsap.to(cube.rotation, { x: 0, y: Math.PI / 4 + Math.PI * 2, z: 0, duration: 1.1, ease: 'power3.inOut' }),
    ]);
  }

  private onCube(i: number) {
    if (this.s.stage !== 4 || this.busy) return;
    const { world } = this.c;
    const cube = world.cubes[i];
    if (cube.userData.placed) return;
    const want = WORDS[2][this.cubeIdx];
    if (cube.userData.letter === want) {
      this.cubeIdx++;
      sound.letter();
      void this.placeCube(cube);
      this.refreshHUD();
      if (this.cubeIdx === WORDS[2].length) {
        this.busy = true;
        setTimeout(() => void this.finale(), 1300);
      }
      return;
    }
    sound.error();
    gsap.fromTo(cube.position, { x: cube.position.x - 0.1 }, { x: cube.position.x, duration: 0.5, ease: 'elastic.out(1.2, 0.2)' });
    if (this.cubeIdx > 0) {
      world.cubes.forEach((c, j) => {
        if (!c.userData.placed) return;
        c.userData.placed = false;
        const home = world.cubeHome[j];
        gsap.to(c.position, { x: home.x, y: home.y, z: home.z, duration: 0.9, ease: 'power2.inOut' });
      });
      this.cubeIdx = 0;
      this.refreshHUD();
    }
    this.card(`cube${i}`, 'Үгүй ээ... шоонууд буцаад байрандаа ниснэ. Тоглоомын нэрийг санаарай: Little _ _ _ _ _');
  }

  // ------------------------------------------------------------------ finale
  private async finale() {
    const { world, creature } = this.c;
    this.busy = true;
    ui.hideCard();
    this.s.stage = 5;
    this.s.finishedMs = this.s.playMs + (performance.now() - this.playStart);
    this.save();
    if (this.s.finishedMs <= 8 * 60 * 1000) this.unlock('speedrun');
    this.refreshHUD();
    await this.cinematic(new THREE.Vector3(0.4, 2.6, 0.9), new THREE.Vector3(11, 7.5, 11), 1.4);
    sound.powerDown();
    for (const [l] of world.lightBase) gsap.to(l, { intensity: 0.02, duration: 0.6 });
    for (const b of world.bulbs) gsap.to(b.mat, { emissiveIntensity: 0.1, duration: 0.6 });
    await sleep(1200);
    for (const cube of world.cubes) {
      const m = cube.material as THREE.MeshStandardMaterial;
      gsap.to(m, { emissiveIntensity: 4, duration: 0.8 });
      gsap.to(cube.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.4, yoyo: true, repeat: 1, delay: 0.5 });
    }
    sound.legendary();
    await sleep(1100);
    this.rgbGlitch(0.02, 1.8);
    ui.flash('#ffffff', 0.9);
    sound.fanfare();
    this.confetti(new THREE.Vector3(0.4, 3.4, 0.9), 160, 1.4);
    this.finaleAmbience(false);
    creature.dance(true);
    this.unlock('explorer');
    const { controls } = this.c;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    await this.cinematic(new THREE.Vector3(0, 0.5, 0), this.c.homeView().pos.clone().multiplyScalar(1.25).setY(14), 3);
    this.busy = false;
    setTimeout(() => {
      controls.autoRotate = false;
      this.rollReward({ id: 'crown', reason: 'Бүх үндсэн тааврыг даваад дуусгасны шагнал' });
      this.openFinaleModal();
    }, 1500);
  }

  private finaleAmbience(instant: boolean) {
    const { world, sky } = this.c;
    const d = instant ? 0 : 2.5;
    const { hemi, fill, key } = world.lights;
    hemi.color.set('#ff9ad5');
    hemi.groundColor.set('#2a6b8a');
    fill.color.set('#7df9ff');
    key.color.set('#ffe0f0');
    world.lightBase.set(fill, 9);
    for (const [l, base] of world.lightBase) gsap.to(l, { intensity: l === world.lights.lamp && !this.lampOn ? 0 : base, duration: d });
    for (const b of world.bulbs) gsap.to(b.mat, { emissiveIntensity: 2.6, duration: d });
    for (const cube of world.cubes) (cube.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3;
    gsap.to(sky, { auroraAmount: 1, starBrightness: 1.5, duration: instant ? 0 : 4 });
    sky.bigTesseract.lines.visible = true;
    if (!instant) sky.meteorShower(40);
    world.setDustColor('#bff7ff');
    sound.setFinale(true);
    this.buildTrophies();
    if (this.s.creatureCaught) this.c.creature.dance(true);
  }

  private buildTrophies() {
    const ring = this.c.world.trophyRing;
    ring.clear();
    const owned = REWARDS.filter((r) => this.s.collection[r.id]);
    const geos: Record<string, THREE.BufferGeometry> = {
      tesseract: new THREE.BoxGeometry(0.5, 0.5, 0.5),
      crown: new THREE.CylinderGeometry(0.3, 0.25, 0.3, 5, 1, true),
      hourglass: new THREE.ConeGeometry(0.25, 0.5, 6),
      default: new THREE.IcosahedronGeometry(0.28, 0),
    };
    owned.forEach((r, i) => {
      const geo = geos[r.shape] ?? (r.rarity === 'rare' ? new THREE.OctahedronGeometry(0.3, 0) : geos.default);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: r.color, emissive: r.color, emissiveIntensity: r.rarity === 'legendary' ? 2 : 0.8, roughness: 0.3, metalness: 0.4 }));
      m.userData.orbit = { a: (i / Math.max(1, owned.length)) * Math.PI * 2, r: 7.5 + (i % 2) * 0.8, y: 5.6 + (i % 3) * 0.5 };
      m.userData.ignoreRay = true;
      ring.add(m);
    });
  }

  /** Which of the 3 endings the player earned — reusing existing save data,
   *  no new tracking needed. Checked at the moment the finale modal opens. */
  private endingVariant(): 'speedrun' | 'normal' {
    return (this.s.finishedMs ?? this.s.playMs) <= 8 * 60 * 1000 ? 'speedrun' : 'normal';
  }

  /** End of Level 05 — not the end of the game: closing this grows the room into Level 06. */
  private openFinaleModal() {
    const total = this.s.finishedMs ?? this.s.playMs;
    const mins = Math.floor(total / 60000);
    const secs = Math.floor((total % 60000) / 1000);
    const owned = REWARDS.filter((r) => this.s.collection[r.id]).length;
    const copy = {
      speedrun: {
        eyebrow: 'Эхний 5 түвшин — рекорд хурдаар',
        h2: 'You blazed through<br/>Little World',
        muted: 'Гэхдээ энэ бол зөвхөн эхлэл. Өрөө томорч, илүү урт үгтэй, илүү хэцүү 7 түвшин хүлээж байна.',
      },
      normal: {
        eyebrow: 'Эхний 5 түвшин давлаа',
        h2: 'You explored<br/>Little World',
        muted: 'Гэхдээ энэ бол зөвхөн эхлэл. Өрөө томорч, илүү урт үгтэй, илүү хэцүү 7 түвшин хүлээж байна.',
      },
    }[this.endingVariant()];
    const el = h('div', { class: 'finale' });
    el.innerHTML = `
      <p class="eyebrow">${copy.eyebrow}</p>
      <h2 class="hand">${copy.h2}</h2>
      <div class="stats">
        <div><b>${mins}:${String(secs).padStart(2, '0')}</b><span>хугацаа</span></div>
        <div><b>${this.s.achievements.length}/${ACHIEVEMENTS.length}</b><span>амжилт</span></div>
        <div><b>${owned}/${REWARDS.length}</b><span>цуглуулга</span></div>
      </div>
      <p class="muted">${copy.muted}</p>`;
    const actions = h('div', { class: 'actions' });
    const share = h('button', { class: 'btn-primary' });
    share.innerHTML = `${icon('camera', 18)} Амжилтын карт татах`;
    share.addEventListener('click', () => this.downloadShareCard());
    const coll = h('button', { class: 'btn-ghost' }, 'Цуглуулга харах');
    coll.addEventListener('click', () => { ui.closeModal(); setTimeout(() => this.openCollection(), 300); });
    const keep = h('button', { class: 'btn-ghost' }, 'Түвшин 06 руу →');
    keep.addEventListener('click', () => ui.closeModal());
    actions.append(share, coll, keep);
    el.append(actions);
    ui.openModal(el, { className: 'modal-finale', onClose: () => this.beginExtLevels() });
  }

  async downloadShareCard() {
    const shot = new Image();
    shot.src = this.c.snapshot();
    await shot.decode().catch(() => undefined);
    const W = 1080, H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1c1240');
    g.addColorStop(1, '#3b1d5e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const pad = 70;
    const iw = W - pad * 2, ih = 760;
    if (shot.width) {
      const s = Math.max(iw / shot.width, ih / shot.height);
      const sw = iw / s, sh = ih / s;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(pad, 230, iw, ih, 36);
      ctx.clip();
      ctx.drawImage(shot, (shot.width - sw) / 2, (shot.height - sh) / 2, sw, sh, pad, 230, iw, ih);
      ctx.restore();
    }
    ctx.fillStyle = '#ffd36b';
    ctx.font = '700 44px Nunito, sans-serif';
    ctx.fillText('ACHIEVEMENT UNLOCKED', pad, 110);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 84px Caveat, cursive';
    ctx.fillText('I explored the entire Little World', pad, 190);
    const owned = REWARDS.filter((r) => this.s.collection[r.id]).length;
    const stats: [string, string][] = [
      [`${this.s.achievements.length}/${ACHIEVEMENTS.length}`, 'амжилт'],
      [`${owned}/${REWARDS.length}`, 'цуглуулга'],
      [`${Math.max(1, Math.round((this.s.finishedMs ?? this.s.playMs) / 60000))} мин`, 'хугацаа'],
    ];
    stats.forEach(([v, l], i) => {
      const x = pad + i * (iw / 3);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 72px Nunito, sans-serif';
      ctx.fillText(v, x, 1110);
      ctx.fillStyle = '#c9b8ff';
      ctx.font = '600 34px Nunito, sans-serif';
      ctx.fillText(l, x, 1160);
    });
    ctx.fillStyle = '#ff7eb6';
    ctx.font = '700 46px Caveat, cursive';
    ctx.fillText('Nothing is what it seems.', pad, 1265);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 28px Nunito, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString(), W - pad, 1265);
    this.download(cv.toDataURL('image/png'), 'little-world-achievement.png');
    ui.toast('Амжилтын карт хадгалагдлаа!');
  }

  private download(url: string, name: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }

  takePhoto() {
    ui.flash('#ffffff', 0.9);
    sound.tick();
    this.download(this.c.snapshot(), 'little-world.png');
    ui.toast('Зураг хадгалагдлаа!');
  }

  // ------------------------------------------------------------------ rewards
  /** The 3 legendary items are each tied to one specific accomplishment (see the
   *  `id:` call sites below) rather than being just another slot-machine outcome —
   *  so they're excluded from every *random* roll, including when rarity happens
   *  to land on 'legendary' with no explicit id (defensive: that combination
   *  shouldn't occur anymore now that every legendary-granting call site passes
   *  an explicit id, but this keeps a stray future call from crashing on an
   *  empty pool instead of silently reaching one of these "earned" items). */
  private static readonly DETERMINISTIC_REWARDS = new Set(['tesseract', 'crown', 'hourglass']);

  rollReward(opts: { rarity?: Rarity; id?: string; reason?: string } = {}) {
    let item: RewardDef | undefined = opts.id ? REWARDS.find((r) => r.id === opts.id) : undefined;
    if (!item) {
      const r = Math.random();
      const rarity: Rarity = opts.rarity ?? (r < 0.42 ? 'rare' : 'common');
      const excl = (x: RewardDef) => !Game.DETERMINISTIC_REWARDS.has(x.id);
      const pool = REWARDS.filter((x) => x.rarity === rarity && excl(x));
      const fresh = pool.filter((x) => !this.s.collection[x.id]);
      const candidates = fresh.length ? fresh : pool;
      item = pick(candidates.length ? candidates : REWARDS.filter(excl));
    }
    const dup = !!this.s.collection[item.id];
    this.s.collection[item.id] = (this.s.collection[item.id] ?? 0) + 1;
    this.save();
    const reward = item;
    const title = `${pick(TITLE_PREFIX)} ${pick(TITLE_NOUN)}`;

    const el = h('div', { class: 'reward' });
    el.innerHTML = `
      <p class="eyebrow">Mystery Generator</p>
      <div class="slot-machine"><span class="roll">???</span></div>
      <div class="reward-card rarity-${reward.rarity}" hidden>
        <div class="reward-art">${shapeSvg(reward.shape, reward.color, 84)}</div>
        <span class="rarity">${RARITY_LABEL[reward.rarity]}${dup ? ' · давхардсан' : ' · шинэ!'}</span>
        <h3></h3>
        <p></p>
        <small class="reason-line" hidden></small>
        <small class="title-gen"></small>
      </div>`;
    (el.querySelector('h3') as HTMLElement).textContent = reward.name;
    (el.querySelector('.reward-card p') as HTMLElement).textContent = reward.desc;
    if (opts.reason) {
      const reasonEl = el.querySelector('.reason-line') as HTMLElement;
      reasonEl.textContent = `🏷 ${opts.reason}`;
      reasonEl.hidden = false;
    }
    (el.querySelector('.title-gen') as HTMLElement).textContent = `Шинэ цол: ${title}`;
    const btn = h('button', { class: 'btn-primary', disabled: 'true' }, 'Гоё!');
    btn.addEventListener('click', () => ui.closeModal());
    el.append(btn);

    const onOpen = () => {
      const roll = el.querySelector('.roll') as HTMLElement;
      let i = 0;
      const names = REWARDS.map((r) => r.name);
      const step = () => {
        roll.textContent = names[(i * 7) % names.length];
        sound.rollTick(i);
        i++;
        if (i < 18) setTimeout(step, 50 + i * 9);
        else {
          (el.querySelector('.slot-machine') as HTMLElement).hidden = true;
          const cardEl = el.querySelector('.reward-card') as HTMLElement;
          cardEl.hidden = false;
          gsap.fromTo(cardEl, { rotateY: 90, scale: 0.7 }, { rotateY: 0, scale: 1, duration: 0.6, ease: 'back.out(2)' });
          if (reward.rarity === 'legendary') { sound.legendary(); ui.flash('#ffd36b', 0.4); }
          else sound.success();
          btn.removeAttribute('disabled');
          if (reward.rarity === 'legendary') this.unlock('lucky');
          if (Object.keys(this.s.collection).length >= 10) this.unlock('hoarder');
          if (this.s.stage >= 5) this.buildTrophies();
        }
      };
      setTimeout(step, 350);
    };
    const observer = new MutationObserver(() => {
      if (el.isConnected) {
        observer.disconnect();
        onOpen();
      }
    });
    observer.observe(document.getElementById('modal')!, { childList: true, subtree: true });
    ui.openModal(el, { className: 'modal-reward', closable: false });
  }

  openCollection() {
    const el = h('div', { class: 'collection' });
    const tabs = h('div', { class: 'tabs' });
    const t1 = h('button', { class: 'tab active' }, `Цуглуулга (${Object.keys(this.s.collection).length}/${REWARDS.length})`);
    const t2 = h('button', { class: 'tab' }, `Амжилт (${this.s.achievements.length}/${ACHIEVEMENTS.length})`);
    tabs.append(t1, t2);
    const grid = h('div', { class: 'grid' });
    const list = h('div', { class: 'ach-list', hidden: 'true' });
    // The 3 legendary items are each earned a specific way (not a random roll —
    // see rollReward()), so unlike the rest, their locked tooltip can honestly say
    // how to get them instead of just "???".
    const LEGENDARY_HOW: Record<string, string> = {
      tesseract: 'Нууц өрөөнд тессерактад хүрвэл олдоно.',
      crown: 'Тоглоомын бүх үндсэн таавар даваад дуусгавал олдоно.',
      hourglass: 'Бүх 12 түвшнийг давбал олдоно.',
    };
    for (const r of REWARDS) {
      const n = this.s.collection[r.id] ?? 0;
      const item = h('div', { class: `item rarity-${r.rarity}${n ? '' : ' locked'}` });
      item.innerHTML = `<div class="art">${n ? shapeSvg(r.shape, r.color, 48) : icon('lock', 26)}</div>`;
      item.append(h('b', {}, n ? r.name : '???'), h('small', {}, n ? `${RARITY_LABEL[r.rarity]}${n > 1 ? ` ×${n}` : ''}` : RARITY_LABEL[r.rarity]));
      item.title = n ? r.desc : (LEGENDARY_HOW[r.id] ?? 'Өрөөн дэх зүйлсийг судалж, санамсаргүй шагналуудаас олоорой.');
      grid.append(item);
    }
    for (const a of ACHIEVEMENTS) {
      const got = this.s.achievements.includes(a.id);
      const row = h('div', { class: `ach-row${got ? ' got' : ''}` });
      row.innerHTML = `<span class="ach-ic">${icon(got ? 'trophy' : 'lock', 18)}</span>`;
      row.append(h('div', {}, h('b', {}, got || !a.secret ? a.title : 'Нууц амжилт'), h('small', {}, got || !a.secret ? a.desc : '??? Бүх зүйл дээр дараад үз.')));
      list.append(row);
    }
    t1.addEventListener('click', () => { t1.classList.add('active'); t2.classList.remove('active'); grid.hidden = false; list.hidden = true; });
    t2.addEventListener('click', () => { t2.classList.add('active'); t1.classList.remove('active'); grid.hidden = true; list.hidden = false; });
    el.append(h('h2', { class: 'hand' }, 'Миний цуглуулга'), tabs, grid, list);
    ui.openModal(el, { className: 'modal-collection' });
  }

  // ------------------------------------------------------------------ terminal
  private openTerminal() {
    const el = h('div', { class: 'terminal' });
    const out = h('div', { class: 'term-out' });
    const form = h('form', { class: 'term-form' });
    const input = h('input', { class: 'term-in', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '24', 'aria-label': 'Нууц үг' });
    form.append(h('span', { class: 'prompt' }, '>'), input);
    el.append(h('div', { class: 'term-bar' }, h('i'), h('i'), h('i'), h('span', {}, 'little-os — terminal')), out, form);

    const print = (text: string, cls = '') => {
      const line = h('div', { class: `ln ${cls}` }, text);
      out.append(line);
      out.scrollTop = out.scrollHeight;
    };
    print('LITTLE-OS v4.0  (c) Little World Inc.', 'dim');
    if (this.s.stage === 0) {
      print('Нууц үг шаардлагатай. Өрөөнөөс 4 үсэг ол.');
      const map = LETTER_SOURCES[0];
      const found = this.s.letters.map((id) => map[id]).join(' ');
      if (found) print(`Олдсон үсгүүд: ${found}`, 'gold');
    } else if (isExtStage(this.s.stage)) {
      const ext = EXT_LEVELS[this.s.stage - EXT_START];
      print(`ТҮВШИН ${String(this.s.stage).padStart(2, '0')} — ${ext.title}`, 'green');
      print(`Сэжүүр: «${ext.clue}» (англи үг, ${ext.word.length} үсэг)`);
      const found = this.foundLetters();
      print(found.length ? `Олдсон үсгүүд (холилдсон): ${found.join(' ')}  [${found.length}/${ext.word.length}]` : 'Одоогоор үсэг олдоогүй. Өрөөн дэх сорилтуудыг дав.', 'gold');
    } else {
      print('Сайн уу, мөрдөгч. Тусламж: help', 'green');
    }

    input.addEventListener('input', () => { this.terminalText = input.value.toUpperCase(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      const cmd = raw.toUpperCase();
      input.value = '';
      this.terminalText = '';
      if (!cmd) return;
      print(`> ${raw}`, 'me');
      sound.tick();
      if (cmd === 'OPEN') {
        if (this.s.stage === 0) {
          print('ACCESS GRANTED', 'green big');
          sound.success();
          input.disabled = true;
          setTimeout(() => { ui.closeModal(); void this.solveOpen(); }, 1100);
        } else print('Хайрцаг аль хэдийн нээгдсэн. Дахиад нээвэл... юу ч байхгүй.');
        return;
      }
      if (isExtStage(this.s.stage)) {
        const word = EXT_LEVELS[this.s.stage - EXT_START].word;
        const all = this.s.letters.length >= word.length;
        if (cmd === word) {
          if (all) {
            print('ACCESS GRANTED', 'green big');
            sound.success();
            input.disabled = true;
            setTimeout(() => { ui.closeModal(); void this.solveExtLevel(); }, 1100);
          } else print(`Үг таарч магадгүй... гэхдээ эхлээд бүх үсгээ ол (${this.s.letters.length}/${word.length}).`, 'gold');
          return;
        }
        if (cmd.length === word.length && /^[A-Z]+$/.test(cmd)) {
          if (!all) {
            print(`Эхлээд бүх үсгээ ол (${this.s.letters.length}/${word.length}).`, 'gold');
            return;
          }
          // Wordle-style feedback helps unscramble — but a wrong guess costs a mistake.
          let right = 0;
          for (let i = 0; i < word.length; i++) if (cmd[i] === word[i]) right++;
          this.s.levelMistakes++;
          this.save();
          sound.error();
          gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.25)' });
          print(`Буруу. Зөв байрлалтай үсэг: ${right}/${word.length}. (Алдаа: ${this.s.levelMistakes})`, 'red');
          return;
        }
      }
      const cmds: Record<string, () => void> = {
        HELP: () => print('Командууд: help, hint, joke, whoami, time, clear ... бас хэд хэдэн нууц команд.', 'dim'),
        HINT: () => print(this.currentHint(), 'gold'),
        JOKE: () => print(pick([
          'Программист яагаад байгальд гардаггүй вэ? — Хэт олон bug байдаг.',
          'Яагаад хайрцаг хоосон байсан бэ? — Учир нь энэ бол хайрцаг.',
          'Хамгийн хурдан амьтан аль вэ? — Deadline өмнөх програмист.',
          '"Энэ ажиллаж байна" гэж хэлмэгц л ажиллахаа больдог.',
        ])),
        WHOAMI: () => print('Мэргэжлийн мөрдөгч (туршилтын хугацаанд).'),
        TIME: () => print(new Date().toLocaleTimeString()),
        CLEAR: () => out.replaceChildren(),
        PLAY: () => print('Энэ үг өөр машинд зориулагдсан. Аркад руу оч.', 'gold'),
        WORLD: () => print('Энэ үгийг бичих биш, БҮТЭЭХ хэрэгтэй...', 'gold'),
        MOCHI: () => print(this.s.creatureCaught ? 'Мочи: "Пиу!"' : 'Мочи гэж хэн бэ? Мэдэхгүй ээ. *тавиур руу харна*'),
        LS: () => print('box.secret  arcade.exe  bookshelf/  .mochi_hideout  nothing.txt', 'dim'),
        'CAT NOTHING.TXT': () => print('Энд юу ч байхгүй. Үнэхээр.'),
        SUDO: () => { print('Зөвшөөрөл олгогдлоо... гэж бодсон уу? Энэ өрөөнд бүгд тэгш эрхтэй.', 'gold'); this.unlock('hacker'); },
        HACK: () => this.matrix(out, print),
        MATRIX: () => this.matrix(out, print),
      };
      const fn = cmds[cmd] ?? (cmd.startsWith('SUDO ') ? cmds.SUDO : undefined);
      if (fn) { fn(); return; }
      sound.error();
      gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.25)' });
      print(pick([
        'ACCESS DENIED. Гэхдээ оролдлогод чинь 10 оноо.',
        'Буруу. Компьютер чамайг харж инээмсэглэлээ.',
        'Үгүй ээ. Гэхдээ сайхан оролдлого байлаа.',
        'Алдаа 418: Би бол цайны данх.',
      ]), 'red');
    });
    ui.openModal(el, { className: 'modal-terminal', onClose: () => { this.terminalText = ''; } });
  }

  private matrix(out: HTMLElement, print: (t: string, c?: string) => void) {
    this.unlock('hacker');
    let n = 0;
    const iv = setInterval(() => {
      print(Array.from({ length: 34 }, () => (Math.random() > 0.5 ? '1' : '0')).join(''), 'green');
      if (++n > 10) {
        clearInterval(iv);
        print("I'm in. ...Гэхдээ энд нууц юм байхгүй, зөвхөн чипс.", 'gold');
      }
    }, 70);
    void out;
  }

  private async solveOpen() {
    const { world } = this.c;
    this.busy = true;
    this.s.stage = 1;
    this.s.letters = [];
    this.save();
    this.refreshHUD();
    const boxPos = world.anchorOf('box');
    await this.cinematic(boxPos.clone().setY(1), boxPos.clone().add(new THREE.Vector3(7.5, 6.5, 8.5)), 1.3);
    sound.lock();
    await gsap.fromTo(world.boxBody.rotation, { z: -0.1 }, { z: 0, duration: 0.9, ease: 'elastic.out(1.5, 0.15)' });
    sound.lock();
    await gsap.fromTo(world.boxBody.rotation, { z: 0.14 }, { z: 0, duration: 0.9, ease: 'elastic.out(1.5, 0.15)' });
    sound.powerUp();
    world.boxBeams.visible = true;
    gsap.to(world.lights.box, { intensity: 3.5, duration: 0.4 });
    gsap.to(world.boxGlow, { emissiveIntensity: 1.8, duration: 0.4 });
    await gsap.to(world.boxLid.rotation, { x: -1.9, duration: 0.7, ease: 'back.out(2.5)' });
    gsap.to(world.boxBeams.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(2)' });
    gsap.to(world.boxBeams.rotation, { y: Math.PI * 2, duration: 6, ease: 'none', repeat: 1 });
    ui.flash('#ffe08a', 0.45);
    sound.fanfare();
    this.confetti(boxPos, 90, 1);
    await sleep(1600);
    gsap.to(world.boxBeams.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 1.2, onComplete: () => { world.boxBeams.visible = false; } });
    gsap.to(world.lights.box, { intensity: 0, duration: 1.5 });
    gsap.to(world.boxGlow, { emissiveIntensity: 1.2, duration: 1.5 });
    this.busy = false;
    this.peekTimer = 8;
    const el = h('div', { class: 'nothing' });
    el.innerHTML = `
      <p class="eyebrow">Сэжигтэй хайрцаг нээгдлээ</p>
      <h2 class="hand">Congratulations!</h2>
      <p class="nothing-big">You unlocked<br/><span>absolutely nothing.</span></p>
      <p class="muted">Хайрцаг бүрэн хоосон байна. Маш хоосон. Мэргэжлийн түвшний хоосон.</p>`;
    const b = h('button', { class: 'btn-primary' }, 'Хүлээгээрэй... үнэхээр юу ч байхгүй гэж үү?');
    b.addEventListener('click', () => ui.closeModal());
    el.append(b);
    this.unlock('nothing');
    ui.openModal(el, {
      className: 'modal-nothing',
      onClose: () => {
        this.card('box', 'Хайрцгийн ёроолд ямар нэг юм наалдсан юм шиг... Дахиад дарж шалгаад үз! Бас шагнал болгон жижигхэн бэлэг өгье.', 8000);
        setTimeout(() => this.rollReward({ reason: 'Анхны нууц үгийг тайлсны шагнал' }), 2600);
      },
    });
  }

  // ------------------------------------------------------------------ arcade
  private arcadePower(on: boolean) {
    const { world } = this.c;
    for (const m of world.arcadeStrips) gsap.to(m, { emissiveIntensity: on ? 3 : 0.15, duration: 0.8 });
    gsap.to(world.arcadeMarquee, { emissiveIntensity: on ? 1.6 : 0.35, duration: 0.8 });
    gsap.to(world.lights.arcade, { intensity: on ? 5 : 0, duration: 0.8 });
    // Register this as the arcade light's new "on" baseline so a later blackout
    // can actually darken it, and the post-blackout restore brings it back to 5
    // instead of snapping it back to its pre-power-up 0.
    world.lightBase.set(world.lights.arcade, on ? 5 : 0);
  }

  private openArcadePassword() {
    const el = h('div', { class: 'arcade-pass' });
    const map = LETTER_SOURCES[1];
    const found = this.s.letters.map((id) => map[id]);
    el.innerHTML = `<p class="pixel blink">INSERT PASSWORD</p><p class="pixel small">LETTERS: ${found.length ? found.join(' ') : '- - - -'}</p>`;
    const form = h('form', {});
    const input = h('input', { class: 'pixel-in', maxlength: '8', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Нууц үг' });
    const btn = h('button', { class: 'btn-primary pixel-btn', type: 'submit' }, 'ENTER');
    const msg = h('p', { class: 'pixel small msg' });
    form.append(input, btn);
    el.append(form, msg);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim().toUpperCase();
      if (v === 'PLAY') {
        msg.textContent = 'ACCESS GRANTED!';
        msg.className = 'pixel small msg ok';
        sound.success();
        input.disabled = true;
        setTimeout(() => { ui.closeModal(); void this.solvePlay(); }, 900);
        return;
      }
      sound.error();
      msg.textContent = v === 'OPEN' ? 'THAT WAS LAST LEVEL!' : pick(['WRONG CODE', 'NOPE.EXE', 'TRY AGAIN, HERO', 'INSERT COIN... JK']);
      msg.className = 'pixel small msg bad';
      gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.25)' });
      input.select();
    });
    ui.openModal(el, { className: 'modal-arcade' });
  }

  private async solvePlay() {
    const { world } = this.c;
    this.busy = true;
    this.s.stage = 2;
    this.s.letters = [];
    this.save();
    this.refreshHUD();
    const p = world.anchorOf('arcade');
    await this.cinematic(p.clone().setY(1.6), p.clone().add(new THREE.Vector3(3.5, 2.6, 7)), 1.3);
    sound.powerUp();
    this.arcadePower(true);
    this.confetti(p, 50, 0.8);
    await sleep(1200);
    this.busy = false;
    this.card('arcade', 'Аркад машин асаллаа! Star Catcher — 12 од барьж ял. Бэлэн үү?', 5000);
    setTimeout(() => this.openArcadeGame(), 900);
  }

  private openArcadeGame() {
    const el = h('div', { class: 'arcade-game' });
    const cv = h('canvas', { class: 'arcade-canvas' });
    const goal = this.arcadeGoal;
    const info = h('p', { class: 'pixel small' }, `★ ${goal} од барь · хулгана/хуруу эсвэл ← →`);
    el.append(cv, info);
    let stop: (() => void) | null = null;
    const start = () => {
      stop?.();
      stop = runStarCatcher(cv, (win, score, timeLeft) => {
        this.bestScore = Math.max(this.bestScore, score);
        if (win) {
          sound.fanfare();
          if (this.s.stage === 2) {
            stop?.();
            ui.closeModal();
            void this.arcadeWin(score, timeLeft);
          } else {
            info.textContent = `YOU WIN! ${score} оноо. Аркад легенд хэвээрээ.`;
            showRetry();
          }
        } else {
          info.textContent = `${score}/${goal} — дахиад нэг оролдоё!`;
          showRetry();
        }
      }, { goal: this.arcadeGoal, duration: this.arcadeDuration });
    };
    const showRetry = () => {
      const b = h('button', { class: 'btn-primary pixel-btn' }, 'RETRY');
      b.addEventListener('click', () => { b.remove(); info.textContent = `★ ${goal} од барь`; start(); });
      el.append(b);
      b.focus();
    };
    ui.openModal(el, { className: 'modal-arcade', onClose: () => stop?.() });
    start();
  }

  private async arcadeWin(score: number, timeLeft: number) {
    this.s.stage = 3;
    // Rank the win by how much of the clock was left: gold if you finished with
    // over half the time to spare, silver over a quarter, bronze for any win at all.
    // Uses this.arcadeDuration (the round's real duration, Hard Mode or not) rather
    // than the flat DURATION constant, so the fraction stays correct either way.
    const dur = this.arcadeDuration;
    const rank = timeLeft >= dur * 0.5 ? 3 : timeLeft >= dur * 0.25 ? 2 : 1;
    this.s.bestArcadeRank = Math.max(this.s.bestArcadeRank, rank);
    this.save();
    this.refreshHUD();
    this.unlock('arcade');
    this.confetti(this.c.world.anchorOf('arcade'), 80, 1);
    const rankLabel = rank === 3 ? '★★★ GOLD' : rank === 2 ? '★★ SILVER' : '★ BRONZE';
    const el = h('div', { class: 'arcade-win' });
    el.innerHTML = `<p class="pixel">NEW HI-SCORE!</p><p class="pixel big">${score}</p><p class="pixel small rank-${rank}">${rankLabel} RANK</p><p class="pixel small">ENTER YOUR NAME:</p><div class="glyph-row">${GLYPH_ORDER.map((g) => `<span>${g}</span>`).join('')}</div><p class="hint-note">Хачин... нэрийн оронд тэмдгүүд бичигдчихлээ. Энэ дараалал хаа нэгтээ хэрэг болох байх.</p>`;
    const b = h('button', { class: 'btn-primary' }, 'Санаж авлаа');
    b.addEventListener('click', () => ui.closeModal());
    el.append(b);
    ui.openModal(el, { className: 'modal-arcade' });
    this.rollReward({ reason: 'Star Catcher тоглоомд яллагын шагнал' });
  }

  // ------------------------------------------------------------------ hints & menu
  /** Story stages each have their own hints; all extended levels share one set; then "done". */
  private hintList() {
    if (this.s.stage < EXT_START) return HINTS[this.s.stage];
    return HINTS[isExtStage(this.s.stage) ? 6 : 7];
  }

  currentHint() {
    const list = this.hintList();
    return list[Math.min(this.hintIdx, list.length - 1)];
  }

  showHint() {
    this.hintIdx++;
    sound.chime();
    // Every 3rd press nudges toward an undiscovered secret achievement instead of
    // the normal stage hint — these used to be entirely silent, which made them
    // feel like arbitrary trivia rather than something you could actually go for.
    if (this.hintIdx % 3 === 0) {
      const undiscovered = ACHIEVEMENTS.filter((a) => a.secret && !this.s.achievements.includes(a.id) && SECRET_CLUES[a.id]);
      if (undiscovered.length) {
        ui.toast(`🔎 Нууц сэжүүр: ${SECRET_CLUES[pick(undiscovered).id]}`, 6500);
        return;
      }
    }
    const list = this.hintList();
    const text = list[(this.hintIdx - 1) % list.length];
    ui.toast(text, 6000);
  }

  toggleSound() {
    this.s.muted = !this.s.muted;
    sound.setMuted(this.s.muted);
    this.save();
    this.syncSoundButton();
    ui.toast(this.s.muted ? 'Дуу унтарлаа' : 'Дуу асаалаа', 1500);
  }

  private syncSoundButton() {
    const b = document.querySelector('[data-action="sound"]');
    if (b) {
      b.innerHTML = icon(this.s.muted ? 'mute' : 'music', 22);
      b.setAttribute('aria-label', this.s.muted ? 'Дуу асаах' : 'Дуу унтраах');
    }
  }

  openMenu() {
    const el = h('div', { class: 'menu' });
    el.append(h('h2', { class: 'hand' }, 'Цэс'));
    const mk = (label: string, fn: () => void, cls = 'btn-ghost') => {
      const b = h('button', { class: cls }, label);
      b.addEventListener('click', fn);
      el.append(b);
      return b;
    };
    mk('Камерыг анхны байрлалд', () => {
      ui.closeModal();
      const v = this.c.homeView();
      void this.cinematic(v.target, v.pos, 1.2);
    });
    mk(this.s.muted ? 'Дуу асаах' : 'Дуу унтраах', () => { this.toggleSound(); ui.closeModal(); });
    mk('Зураг авах', () => { ui.closeModal(); setTimeout(() => this.takePhoto(), 300); });
    if (this.s.stage >= 5) mk('Амжилтын карт татах', () => void this.downloadShareCard());
    if (this.s.hardModeUnlocked) {
      const label = () => (this.s.hardMode ? '🔥 Хэцүү горим: Асаалттай' : 'Хэцүү горим: Унтраалттай');
      const hardBtn = mk(label(), () => {
        this.s.hardMode = !this.s.hardMode;
        this.save();
        hardBtn.textContent = label();
        hardBtn.classList.toggle('hard-on', this.s.hardMode);
        ui.toast(this.s.hardMode
          ? 'Хэцүү горим асав: Аркад хурдан дуусна, санамсаргүй үйл явдлууд нэмэгдэнэ.'
          : 'Хэцүү горим унтарлаа.', 3500);
      });
      hardBtn.classList.toggle('hard-on', this.s.hardMode);
    }
    el.append(h('p', { class: 'muted small theme-label' }, 'Өрөөний өнгө'));
    const themeRow = h('div', { class: 'theme-row' });
    (Object.keys(ROOM_THEMES) as ThemeName[]).forEach((name) => {
      const def = ROOM_THEMES[name];
      const unlocked = this.themeUnlocked(name);
      const active = this.validTheme(this.s.roomTheme) === name;
      const btn = h('button', {
        class: `theme-swatch${active ? ' active' : ''}${unlocked ? '' : ' locked'}`,
        style: `background:${def.wall}`,
        title: unlocked ? def.label : `${def.label} — ${def.unlockAt} төрлийн шагнал цуглуулахад нээгдэнэ`,
        'aria-label': def.label,
      });
      if (!unlocked) btn.innerHTML = icon('lock', 14);
      btn.addEventListener('click', () => {
        if (!unlocked) {
          ui.toast(`Энэ өнгийг нээхийн тулд дор хаяж ${def.unlockAt} төрлийн шагнал цуглуулаарай (одоо: ${Object.keys(this.s.collection).length}).`, 3500);
          return;
        }
        this.setTheme(name);
        themeRow.querySelectorAll('.theme-swatch').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        ui.toast(`Өрөөний өнгө: ${def.label}`, 2000);
      });
      themeRow.append(btn);
    });
    el.append(themeRow);
    let armed = false;
    const reset = mk('Шинээр эхлэх', () => {
      if (!armed) {
        armed = true;
        reset.textContent = 'Итгэлтэй байна уу? Бүх ахиц устана. Дахин дар.';
        reset.classList.add('danger');
        return;
      }
      wipeSave();
      location.reload();
    });
    if (this.s.bestArcadeRank > 0) {
      const rankLabel = ['', 'BRONZE 🥉', 'SILVER 🥈', 'GOLD 🥇'][this.s.bestArcadeRank];
      el.append(h('p', { class: 'muted small' }, `Star Catcher-ийн шилдэг дүн: ${rankLabel}`));
    }
    if (this.s.dailyStreak > 0) {
      el.append(h('p', { class: 'muted small' }, `🔥 Дараалсан өдрийн тоо: ${this.s.dailyStreak}`));
    }
    el.append(h('p', { class: 'muted small' }, 'Little World · Three.js + WebAudio · Ахиц энэ төхөөрөмж дээр хадгалагдана.'));
    ui.openModal(el, { className: 'modal-menu' });
  }

  dismissNote() {
    this.s.noteDismissed = true;
    this.save();
  }

  // ------------------------------------------------------------------ random events
  private randomEvent() {
    const opts = ['blackout', 'meteor', 'glitch'].filter((e) => e !== this.lastEvent);
    const ev = pick(opts);
    this.lastEvent = ev;
    if (ev === 'blackout') void this.blackout();
    else if (ev === 'meteor') {
      this.c.sky.meteorShower(22);
      this.meteorEventUntil = performance.now() + 9000;
      ui.toast('Цонхны гадаа солирын бороо орж байна! Хүсэл шивнээрэй ✦');
    } else void this.gravityGlitch();
  }

  private async blackout() {
    const { world, sky } = this.c;
    this.blackoutOn = true;
    sound.powerDown();
    for (const [l] of world.lightBase) gsap.to(l, { intensity: 0.03, duration: 0.35 });
    gsap.to(world.lampBulb, { emissiveIntensity: 0.05, duration: 0.35 });
    gsap.to(world.lampShade, { emissiveIntensity: 0.02, duration: 0.35 });
    gsap.to(world.neonMat, { emissiveIntensity: 0.15, duration: 0.35 });
    for (const b of world.bulbs) gsap.to(b.mat, { emissiveIntensity: 0.05, duration: 0.35 });
    gsap.to(sky, { starBrightness: 2, duration: 1 });
    ui.toast('...Хэн гэрэл унтраав? Зөвхөн компьютерын дэлгэц л асаалттай үлдлээ.', 4500);
    await sleep(6500);
    const tl = gsap.timeline();
    for (let i = 0; i < 3; i++) {
      tl.call(() => { for (const [l, base] of world.lightBase) l.intensity = base * 0.6; }, [], i * 0.18)
        .call(() => { for (const [l] of world.lightBase) l.intensity = 0.03; }, [], i * 0.18 + 0.09);
    }
    await tl;
    this.blackoutOn = false;
    for (const [l, base] of world.lightBase) gsap.to(l, { intensity: l === world.lights.lamp && !this.lampOn ? 0 : base, duration: 0.5 });
    if (this.lampOn) {
      gsap.to(world.lampBulb, { emissiveIntensity: 2, duration: 0.5 });
      gsap.to(world.lampShade, { emissiveIntensity: 0.45, duration: 0.5 });
    }
    gsap.to(world.neonMat, { emissiveIntensity: 3.2, duration: 0.5 });
    for (const b of world.bulbs) gsap.to(b.mat, { emissiveIntensity: 2.4, duration: 0.5 });
    gsap.to(sky, { starBrightness: this.s.stage >= 5 ? 1.5 : 1, duration: 1 });
    sound.powerUp();
  }

  private async gravityGlitch() {
    const { world } = this.c;
    this.glitchOn = true;
    sound.whoosh();
    this.rgbGlitch(0.008, 1.2);
    ui.toast('Таталцлын хүч түр завсарлага авлаа... Хөвж буй юманд хүрээд үз!', 4500);
    world.floatables.forEach((o, i) => {
      const y0 = o.position.y;
      const r0 = o.rotation.clone();
      gsap.timeline({ delay: i * 0.08 })
        .to(o.position, { y: y0 + rand(0.5, 1.1), duration: 1.4, ease: 'power2.out' })
        .to(o.rotation, { x: r0.x + rand(-0.6, 0.6), z: r0.z + rand(-0.6, 0.6), duration: 1.4, ease: 'sine.inOut' }, '<')
        .to(o.position, { y: y0 + 0.15, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: 1 })
        .to(o.position, { y: y0, duration: 0.6, ease: 'bounce.out' })
        .to(o.rotation, { x: r0.x, z: r0.z, duration: 0.4 }, '<');
    });
    await sleep(6200);
    this.glitchOn = false;
  }

  // ------------------------------------------------------------------ loop
  update(dt: number, t: number) {
    this.t = t;
    const { world, creature } = this.c;
    this.showerCooldown = Math.max(0, this.showerCooldown - dt);

    const now = new Date();
    const mins = now.getMinutes() + now.getSeconds() / 60;
    const hrs = (now.getHours() % 12) + mins / 60;
    world.clockMinute.rotation.z = -(mins / 60) * Math.PI * 2 - this.clockSpin;
    world.clockHour.rotation.z = -(hrs / 12) * Math.PI * 2 - this.clockSpin / 12;

    if (this.s.stage === 3) {
      world.glyphMats.forEach((m, i) => {
        if (i < 4 && !gsap.isTweening(m) && m.emissiveIntensity < 2.9) m.emissiveIntensity = 0.45 + Math.sin(t * 3 + i * 0.7) * 0.3;
      });
    }

    if (!this.busy && !ui.modalOpen) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) {
        if (this.blackoutOn || this.glitchOn || this.discoOn) {
          // Another ambient event is still mid-animation — don't stack a second
          // one on top of it (e.g. a meteor shower firing *during* a blackout).
          // Re-check shortly instead of burning this roll.
          this.eventTimer = 2;
        } else {
          // Rarer early on, noticeably more frequent by the finale — the room
          // should feel like it's waking up more as the mystery gets deeper.
          // Hard Mode (unlocked at 100%) shrinks this further still — one of the
          // few things that keeps mattering forever, since these events never
          // stop firing even long after the finale.
          const hardK = this.s.hardMode ? 0.6 : 1;
          const lo = Math.max(22, 45 - this.s.stage * 5) * hardK;
          const hi = Math.max(38, 80 - this.s.stage * 6) * hardK;
          this.eventTimer = rand(lo, hi);
          this.randomEvent();
        }
      }
      if (this.s.stage >= 1 && this.s.stage < 4 && !this.s.creatureCaught && creature.mode === 'hidden') {
        this.peekTimer -= dt;
        if (this.peekTimer <= 0) {
          this.peekTimer = rand(12, 22);
          creature.peek();
          sound.squeak();
        }
      }
    }

    if (this.s.stage >= 5) {
      world.bulbs.forEach((b, i) => b.mat.emissive.setHSL(((i / world.bulbs.length) + t * 0.15) % 1, 0.9, 0.6));
    } else if (!this.discoOn && !this.blackoutOn) {
      world.bulbs.forEach((b, i) => { b.mat.emissiveIntensity = 2.0 + Math.sin(t * 2 + i * 1.7) * 0.6; });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life < 0) continue;
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(1 - dt * 0.6);
      p.obj.position.addScaledVector(p.vel, dt);
      p.obj.rotation.x += p.spin.x * dt;
      p.obj.rotation.y += p.spin.y * dt;
      p.obj.rotation.z += p.spin.z * dt;
      const mat = (p.obj as THREE.Mesh).material as THREE.Material & { opacity: number };
      const k = p.life / p.max;
      if (p.obj instanceof THREE.Sprite) {
        mat.opacity = 0.5 * (1 - k);
        p.obj.scale.multiplyScalar(1 + dt * 0.8);
      } else if (k > 0.7) mat.opacity = (1 - k) / 0.3;
      if (p.obj.position.y < 0.02 && !(p.obj instanceof THREE.Sprite)) {
        p.obj.position.y = 0.02;
        p.vel.set(0, 0, 0);
        p.spin.set(0, 0, 0);
      }
      if (p.life >= p.max) {
        p.obj.removeFromParent();
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }

    this.screenT -= dt;
    if (this.screenT <= 0) {
      this.screenT = 1 / 12;
      this.drawMonitor();
      this.drawArcade();
    }
  }

  private drawMonitor() {
    const { ctx, tex } = this.c.world.monitor;
    const W = 512, H = 384;
    const t = this.t;
    ctx.fillStyle = this.blackoutOn ? '#02080a' : '#06171c';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '600 26px "Courier New", monospace';
    ctx.textBaseline = 'top';
    const blink = Math.floor(t * 2) % 2 === 0;
    if (this.blackoutOn) {
      ctx.fillStyle = '#7df9ff';
      ctx.font = '700 64px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('boo.', W / 2, H / 2 - 40);
      ctx.font = '600 22px "Courier New", monospace';
      ctx.fillText('(click me)', W / 2, H / 2 + 40);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#5ff2c4';
      ctx.fillText('LITTLE-OS v4.0', 24, 22);
      ctx.fillStyle = '#2f8f7a';
      ctx.fillRect(24, 58, W - 48, 3);
      ctx.fillStyle = '#5ff2c4';
      const lines: string[] = [];
      if (this.s.stage === 0) {
        const map = LETTER_SOURCES[0];
        lines.push('STATUS: LOCKED', `LETTERS: ${this.s.letters.map((id) => map[id]).join(' ') || '?'}`, '', `PASSWORD: ${this.terminalText}${blink ? '_' : ' '}`);
      } else if (this.s.stage < 5) {
        lines.push('BOX.SECRET ... OPENED', 'CONTENTS ... NOTHING', '', `> ${this.terminalText}${blink ? '_' : ' '}`);
      } else if (isExtStage(this.s.stage)) {
        const n = EXT_LEVELS[this.s.stage - EXT_START].word.length;
        lines.push(`LEVEL ${this.s.stage}: LOCKED`, `LETTERS: ${this.s.letters.length}/${n}`, '', `> ${this.terminalText}${blink ? '_' : ' '}`);
      } else {
        lines.push('ALL SYSTEMS: WONDERFUL', 'LITTLE WORLD: EXPLORED', '', `THANK YOU${blink ? ' <3' : ''}`);
      }
      lines.forEach((l, i) => ctx.fillText(l, 24, 84 + i * 40));
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    tex.needsUpdate = true;
  }

  private drawArcade() {
    const { ctx, tex } = this.c.world.arcadeScreen;
    const W = 256, H = 224;
    const t = this.t;
    ctx.fillStyle = '#0a0620';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '12px "Press Start 2P", monospace';
    if (this.s.stage < 2) {
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
      }
      if (Math.floor(t * 1.5) % 2 === 0) {
        ctx.fillStyle = this.s.stage === 1 ? '#ff4fd8' : '#4a3d78';
        ctx.fillText('INSERT', W / 2, H / 2 - 12);
        ctx.fillText('PASSWORD', W / 2, H / 2 + 12);
      }
    } else if (this.s.stage === 2) {
      for (let i = 0; i < 14; i++) {
        const x = (i * 53) % W;
        const y = ((t * 60 + i * 37) % (H + 20)) - 10;
        ctx.fillStyle = i % 4 === 0 ? '#ff3b5c' : '#fff3a0';
        ctx.fillRect(x, y, 6, 6);
      }
      ctx.fillStyle = '#7df9ff';
      ctx.fillText('STAR CATCHER', W / 2, 60);
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillStyle = '#ffd36b';
        ctx.fillText('PRESS START', W / 2, 150);
      }
    } else {
      ctx.fillStyle = '#ffd36b';
      ctx.fillText('HI-SCORE', W / 2, 40);
      const cols = ['#ffd36b', '#7df9ff', '#ff7eb6', '#7ed957'];
      GLYPH_ORDER.forEach((g, i) => {
        ctx.fillStyle = cols[i];
        drawGlyph(ctx, g, 50 + i * 52, 112 + Math.sin(t * 3 + i) * 4, 16);
        ctx.fill();
      });
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.s.stage >= 5 ? 'LEGEND' : '1ST  YOU', W / 2, 180);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    tex.needsUpdate = true;
  }
}
