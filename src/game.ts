import * as THREE from 'three';
import gsap from 'gsap';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { World } from './world';
import type { Sky } from './sky';
import type { Creature } from './creature';
import type { Shadow } from './shadow';
import type { Avatar } from './avatar';
import { Nav } from './nav';
import { sound } from './audio';
import { ui, icon, shapeSvg } from './ui';
import { runStarCatcher, GOAL, DURATION } from './arcade';
import { loadSave, writeSave, type SaveData } from './state';
import {
  REWARDS, RARITY_LABEL, WORDS, LETTER_SOURCES, GLYPH_ORDER, GLYPH_WALL, QUESTS, HINTS, OBJECTS,
  PLANT_RIDDLE, ROOMS, ROOM_ORDER, DOORS, FINDS, BADGES, PAY, HIDE_SPOTS, roomDef,
  levelForXp, xpForLevel, type Rarity, type RewardDef, type RoomId, type ZoneId,
} from './data';
import { runChallenge, pickKind, type ChallengeKind } from './challenges';
import { h, pick, rand, letterTexture, drawGlyph, sleep } from './util';
import { Progress, today } from './progress';
import { Hunt } from './hunt';
import type { Chapter, QuestView } from './chapters/types';
import { BedroomChapter } from './chapters/bedroom';
import { LivingChapter } from './chapters/living';
import { KitchenChapter } from './chapters/kitchen';
import { BathChapter } from './chapters/bath';
import { ObservatoryChapter } from './chapters/observatory';
import { openDaily, openCollection, openShop, openMenu, applyDecor, openAvatar } from './panels';

export interface Ctx {
  world: World;
  sky: Sky;
  creature: Creature;
  shadow: Shadow;
  avatar: Avatar;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  rgbShift: ShaderPass;
  snapshot: () => string;
  /** Fly the camera to a room (null = the whole house). */
  focusRoom: (id: RoomId | null, animate?: boolean) => Promise<void>;
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

/** Decorative objects that can hide the daily mystery's letters (only once their room is finished). */
const MYSTERY_POOL: Partial<Record<RoomId, string[]>> = {
  bedroom: ['bed', 'nightlamp', 'photo', 'bedrug', 'toybox', 'slippers', 'bedwindow'],
  study: ['plant', 'clock', 'lamp', 'rug', 'window', 'beanbag', 'poster', 'neon', 'mug', 'bookshelf'],
  living: ['sofa', 'armchair', 'coffeetable', 'floorlamp', 'monstera'],
  kitchen: ['toaster', 'kettle', 'cookiejar', 'fruit', 'herbs', 'sink'],
  bath: ['bathsink', 'bathmat', 'bathplant', 'towel', 'basket'],
  observatory: ['globe', 'obschair', 'obschest'],
};

/** Challenge difficulty by chapter. */
const ROOM_LEVEL: Record<RoomId, number> = { bedroom: 0, study: 1, living: 2, kitchen: 3, bath: 4, observatory: 5 };

export class Game {
  s: SaveData = loadSave();
  busy = false;
  readonly progress: Progress;
  readonly hunt: Hunt;
  readonly chapters: Partial<Record<RoomId, Chapter>> = {};
  readonly nav: Nav;
  /** Bumped on every new walk order so a stale arrival never fires its action. */
  private walkToken = 0;
  private blackoutOn = false;
  private glitchOn = false;
  private discoOn = false;
  private lampOn = true;
  private lampClicks: number[] = [];
  private counters: Record<string, number> = {};
  private glyphInput: string[] = [];
  private cubeIdx = 0;
  private eventTimer = 45;
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
  t = 0;
  private bestScore = 0;
  private lockedUntil: Record<string, number> = {};
  private meteorEventUntil = 0;
  private mysteryMarks = new Map<string, THREE.Sprite>();
  private mysteryTex: THREE.Texture;
  private dayCheckT = 0;
  private shelfTex = new Map<string, THREE.Texture>();
  private pendingFinds = new Set<string>();
  /** Set while the true finale plays (bulbs go rainbow, aurora...). */
  finaleOn = false;

  constructor(readonly c: Ctx) {
    this.progress = new Progress({
      s: this.s,
      save: () => this.save(),
      rollReward: (o) => this.rollReward(o),
      onProgress: () => this.refreshPlayer(),
      objectCount: () => this.c.world.interactives.size,
      mysteryCandidates: () => this.mysteryCandidates(),
    });
    this.hunt = new Hunt(this);
    this.nav = new Nav(c.world);
    this.chapters.bedroom = new BedroomChapter(this);
    this.chapters.living = new LivingChapter(this);
    this.chapters.kitchen = new KitchenChapter(this);
    this.chapters.bath = new BathChapter(this);
    this.chapters.observatory = new ObservatoryChapter(this);
    this.mysteryTex = letterTexture('✉', { glow: true, fg: '#d3b8ff', size: 128 }).tex;
    c.creature.onEscaped = () => {
      if (this.s.stage >= 1 && !this.s.creatureCaught) ui.toast('Мочи дахиад нуугдчихлаа... Улаан номыг санаарай.');
    };
    this.applyState();
    this.refreshHUD();
  }

  // ================================================================== state
  save() {
    const now = performance.now();
    this.s.playMs += now - this.playStart;
    this.playStart = now;
    writeSave(this.s);
  }

  get focus(): RoomId | null { return this.s.focus; }

  private applyState() {
    const { world, creature } = this.c;
    for (const def of ROOMS) {
      const r = this.s.rooms[def.id];
      world.setRoomLocked(def.id, !r.unlocked);
      world.setPaint(def.id, r.paint);
    }
    for (const d of DOORS) if (this.s.rooms[d.to].unlocked) void world.setDoor(d.id, true, true);
    this.syncHotspots();
    // study
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
    if (this.s.stage >= 5) world.cubes.forEach((cube) => this.placeCube(cube, true));
    for (const ch of Object.values(this.chapters)) ch.apply();
    if (this.s.creatureCaught) {
      const spot = this.focus && this.s.rooms[this.focus].unlocked ? world.rooms.get(this.focus)!.mochiSpot : world.rooms.get('study')!.mochiSpot;
      creature.spot.copy(spot);
      creature.sit(true);
      creature.setHat(this.s.hat);
    }
    this.c.world.gardenRefs.setTreeStage(this.s.treeStage);
    applyDecor(this);
    this.rebuildNav();
    const start = this.focus && this.s.rooms[this.focus].unlocked ? this.focus : 'bedroom';
    const spawn = this.spawnIn(start);
    if (spawn) this.c.avatar.place(spawn, spawn.clone().add(new THREE.Vector3(3, 0, 3)));
    if (this.s.avatar) this.c.avatar.setLook(this.s.avatar);
    creature.followTarget = this.c.avatar.group;
    if (this.s.rooms.observatory.done) this.finaleAmbience(true);
    sound.setMuted(this.s.muted);
    this.syncSoundButton();
    if (this.s.noteDismissed) document.getElementById('sticky')?.remove();
    this.buildShelf();
  }

  /** White "unseen" markers: shown for objects you haven't touched yet in open rooms. */
  syncHotspots() {
    const { world } = this.c;
    for (const [id, s] of world.hotspots) {
      const z = world.zoneOf(id);
      const open = z === 'garden' || this.s.rooms[z].unlocked;
      s.visible = open && !this.s.seen.includes(id);
    }
  }

  // ================================================================== HUD
  refreshHUD() {
    const f = this.focus;
    let q: QuestView;
    let roomName = 'Байшин', tag = '', done = false;
    if (f) {
      const def = roomDef(f);
      roomName = def.name;
      tag = def.tag;
      done = this.s.rooms[f].done;
      q = f === 'study' ? this.studyQuest() : this.chapters[f]!.quest();
      if (done) q = { title: `${def.chapter} ✓`, sub: this.doneSub(f), slots: 0, letters: [] };
    } else {
      const next = ROOM_ORDER.find((r) => this.s.rooms[r].unlocked && !this.s.rooms[r].done);
      const n = ROOM_ORDER.filter((r) => this.s.rooms[r].done).length;
      q = {
        title: next ? `Дараагийнх: ${roomDef(next).name}` : 'Бүх нууц тайлагдлаа',
        sub: `${n}/${ROOMS.length} бүлэг дууссан. Өрөөн дээр дарж ойртуул.`,
        slots: 0, letters: [],
      };
    }
    const inv = this.s.inventory.map((i) => INV_LABEL[i] ?? i);
    ui.setQuest({ room: roomName, tag, title: q.title, sub: q.sub, slots: q.slots, letters: q.letters, done, inventory: inv });
    this.refreshPlayer();
    this.refreshRooms();
  }

  private doneSub(r: RoomId) {
    const m = this.s.mystery;
    if (m && !m.solved && m.sources.some((id) => this.c.world.zoneOf(id) === r && !m.letters.includes(id))) return 'Энэ өрөөнд өнөөдрийн нууц үсэг нуугдаж байна (✉).';
    return pick(['Энэ өрөө аюулгүй. Тайван судал.', 'Бүх нууц тайлагдсан. Гэхдээ цуглуулга үлдсэн байж магадгүй...', 'Мочи энд тухтай байна.']);
  }

  refreshPlayer() {
    const L = levelForXp(this.s.xp);
    ui.setPlayer({
      level: L,
      title: this.s.avatar?.name ? `${this.s.avatar.name} · ${this.progress.title}` : this.progress.title,
      xpInto: this.s.xp - xpForLevel(L),
      xpNeed: xpForLevel(L + 1) - xpForLevel(L),
      coins: this.s.coins,
      streak: this.s.streak,
      daily: this.progress.pendingDaily,
    });
    this.c.world.gardenRefs.mailFlag.rotation.z = this.progress.pendingDaily > 0 ? 0 : -1.4;
  }

  refreshRooms() {
    ui.setRooms(ROOMS.map((r) => ({
      id: r.id, name: r.name, icon: r.icon,
      locked: !this.s.rooms[r.id].unlocked,
      done: this.s.rooms[r.id].done,
      active: this.focus === r.id,
      danger: this.hunt.dangerous && this.hunt.room === r.id,
    })), this.focus === null, (id) => this.goto(id as RoomId | null));
  }

  /** Room-picker / door navigation. */
  goto(id: RoomId | null) {
    if (this.busy) return;
    if (id && !this.s.rooms[id].unlocked) {
      sound.lock();
      ui.toast(`🔒 ${roomDef(id).name} түгжээтэй. ${roomDef(id).teaser}`, 3200);
      return;
    }
    sound.whoosh();
    void this.c.focusRoom(id);
  }

  /** Called by main.ts whenever the camera starts moving to a new focus. */
  onFocus(id: RoomId | null) {
    const prev = this.s.focus;
    this.s.focus = id;
    this.c.world.setFocus(id);
    ui.hideCard();
    if (id && id !== prev) {
      this.progress.quest('visit', id);
      this.chapters[id]?.onEnter?.();
      if (id === 'study' && this.s.stage === 0 && !this.s.letters.length && !this.s.rooms.study.flags.includes('intro')) {
        this.s.rooms.study.flags.push('intro', `t0:${Math.round(this.s.playMs)}`);
        setTimeout(() => ui.toast('Ажлын өрөөнд 4 үсэг нуугдсан байна. Гэрэлтэж буй цэгүүд дээр дараад үз!', 5500), 900);
      }
    }
    this.hunt.onFocus(id);
    if (id) this.travel(id);
    this.save();
    this.refreshHUD();
  }

  // ================================================================== avatar
  rebuildNav() {
    this.nav.build((r) => this.s.rooms[r].unlocked);
  }

  private inRoom(p: THREE.Vector3, id: RoomId) {
    const [x0, x1, z0, z1] = roomDef(id).bounds;
    return p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;
  }

  /** A free spot near the room's middle to arrive at. */
  private spawnIn(id: RoomId) {
    const r = this.c.world.rooms.get(id)!;
    return this.nav.nearestFree(r.center.clone().setY(r.floorY), r.center.clone().add(new THREE.Vector3(3, 0, 3)), 4);
  }

  /** Walk (through doors) into a room, or pop over if there's no way through. */
  travel(id: RoomId) {
    const { avatar } = this.c;
    if (!this.s.rooms[id].unlocked || avatar.hidden || this.inRoom(avatar.position, id)) return;
    this.walkToken++;
    const spawn = this.spawnIn(id);
    if (!spawn) return;
    const path = this.nav.path(avatar.position, spawn);
    if (path && path.length < 40) void avatar.follow(path, this.hunt.dangerous);
    else void avatar.poofTo(spawn);
  }

  /** Clicked the floor of the room you're in: just walk there. */
  walkTo(p: THREE.Vector3) {
    const { avatar } = this.c;
    if (this.busy || avatar.hidden || !this.focus) return;
    const to = this.nav.nearestFree(p, avatar.position, 1.2);
    const path = to && this.nav.path(avatar.position, to);
    if (!path) return;
    this.walkToken++;
    ui.hideCard();
    void avatar.follow(path, this.hunt.dangerous);
  }

  /** A click on an object: walk over, reach out, then do the thing. */
  interact(id: string) {
    if (this.busy) return;
    const { world, creature, avatar } = this.c;
    if (id === 'creature' && creature.catchable) return this.onClick(id);
    const zone: ZoneId = id === 'creature' ? (this.focus ?? 'study') : world.zoneOf(id);
    const danger = this.hunt.dangerous && this.hunt.room === this.focus;
    const spot = danger && this.hunt.isSpot(id);
    if (danger && !spot && !id.startsWith('door-')) return this.onClick(id);
    if (zone === 'garden' || zone !== this.focus || !this.s.rooms[zone].unlocked || avatar.hidden) {
      if (zone === 'garden' && !avatar.hidden) avatar.wave();
      return this.onClick(id);
    }
    const obj = id === 'creature' ? creature.group : world.interactives.get(id);
    if (!obj) return this.onClick(id);
    const token = ++this.walkToken;
    const ap = this.nav.approach(obj, avatar.position);
    const act = async () => {
      if (token !== this.walkToken) return;
      avatar.face(ap ? ap.look : world.anchorOf(id));
      if (!spot) await avatar.reach();
      if (token !== this.walkToken || this.busy) return;
      this.onClick(id);
    };
    if (!ap || ap.path.length === 0 || avatar.position.distanceTo(ap.stand) < 0.25) {
      void act();
      return;
    }
    void avatar.follow(ap.path, danger).then((ok) => { if (ok) void act(); });
  }

  // ================================================================== helpers
  card(id: string, text: string, ms?: number) {
    const base = this.baseOf(id);
    const o = OBJECTS[base] ?? { name: base, color: 'dark', icon: 'star' };
    this.cardAnchor = id;
    ui.showCard({ title: o.name, text, color: o.color, icon: o.icon }, ms);
  }

  count(id: string) {
    this.counters[id] = (this.counters[id] ?? 0) + 1;
    return this.counters[id];
  }

  cycle(id: string, lines: string[]) {
    const n = this.count(`line:${id}`) - 1;
    return lines[n % lines.length];
  }

  baseOf(id: string) {
    if (id.startsWith('glyph')) return 'glyph';
    if (id.startsWith('cube')) return 'cube';
    if (id.startsWith('door-')) return 'door';
    return id;
  }

  flag(room: RoomId, f: string) {
    const r = this.s.rooms[room];
    if (!r.flags.includes(f)) r.flags.push(f);
    this.save();
  }

  has(room: RoomId, f: string) { return this.s.rooms[room].flags.includes(f); }

  addItem(id: string) {
    if (!this.s.inventory.includes(id)) this.s.inventory.push(id);
    this.save();
    this.refreshHUD();
  }

  hasItem(id: string) { return this.s.inventory.includes(id); }

  useItem(id: string) {
    this.s.inventory = this.s.inventory.filter((x) => x !== id);
    this.save();
    this.refreshHUD();
  }

  screenPos(v: THREE.Vector3) {
    const p = v.clone().project(this.c.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, on: p.z < 1 };
  }

  async cinematic(target: THREE.Vector3, pos: THREE.Vector3, dur = 1.4) {
    const { camera, controls } = this.c;
    controls.enabled = false;
    await Promise.all([
      gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: dur, ease: 'power2.inOut' }),
      gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease: 'power2.inOut', onUpdate: () => camera.lookAt(controls.target) }),
    ]);
    controls.enabled = true;
  }

  shakeCamera(strength = 0.15, dur = 0.8) {
    const cam = this.c.camera;
    const o = { k: 1 };
    const base = cam.position.clone();
    gsap.to(o, {
      k: 0, duration: dur, ease: 'power2.out',
      onUpdate: () => cam.position.set(base.x + rand(-1, 1) * strength * o.k, base.y + rand(-1, 1) * strength * o.k, base.z + rand(-1, 1) * strength * o.k),
      onComplete: () => cam.position.copy(base),
    });
  }

  rgbGlitch(amount = 0.006, dur = 0.8) {
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

  puff(pos: THREE.Vector3, n = 8, color = '#ffffff') {
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

  /** A glowing token rises from an object and flies into the quest tray. */
  async flyToken(text: string, pos: THREE.Vector3) {
    const t = letterTexture(text, { glow: true, fg: '#ffe08a' });
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
      .to({}, { duration: 0.4 });
    const sp = this.screenPos(spr.position);
    this.c.world.root.remove(spr);
    t.tex.dispose();
    await ui.flyLetter(text, sp.x, sp.y);
    sound.pop();
  }

  /** Wrapped challenge: tracks stats, quests and payouts. */
  async challenge(title: string, opts: { kind?: ChallengeKind; level?: number } = {}) {
    const level = opts.level ?? (this.focus ? ROOM_LEVEL[this.focus] : 2);
    this.busy = true;
    const res = await runChallenge({ kind: opts.kind ?? pickKind(level), level, hard: this.s.hardMode, title });
    this.busy = false;
    if (res.ok) {
      this.progress.stat('challenges');
      this.progress.quest('challenge');
      this.progress.award(PAY.challenge.xp, PAY.challenge.coins);
    }
    return res;
  }

  /** Locks an object for a few seconds after a failed challenge. */
  locked(id: string) {
    const left = (this.lockedUntil[id] ?? 0) - performance.now();
    if (left > 0) {
      sound.lock();
      this.card(id, `Түгжигдсэн байна... ${Math.ceil(left / 1000)} секундын дараа дахин оролд.`);
      return true;
    }
    return false;
  }

  lockFor(id: string, sec: number) {
    this.lockedUntil[id] = performance.now() + sec * 1000;
  }

  /** Little animation on the object you hide in/behind. */
  hideAnim(id: string, on: boolean) {
    const obj = this.c.world.interactives.get(id);
    if (!obj) return;
    if (id === 'wardrobe') {
      for (const d of this.c.world.bedroom.wardrobeDoors) {
        const open = this.has('bedroom', 'wardrobe-open');
        gsap.to(d.rotation, { y: on ? 0 : open ? (d.userData.side as number) * -1.6 : 0, duration: 0.4 });
      }
    }
    gsap.fromTo(obj.position, { x: obj.position.x + 0.04 }, { x: obj.position.x, duration: 0.4, ease: 'elastic.out(1.2, 0.3)' });
  }

  /** The Shadow caught you — take back one piece of the current chapter's progress. */
  loseOne(room: RoomId): string | null {
    let msg: string | null = null;
    if (room === 'study') {
      if ((this.s.stage === 0 || this.s.stage === 1) && this.s.letters.length) {
        const id = this.s.letters.pop()!;
        const L = LETTER_SOURCES[this.s.stage]?.[id];
        msg = `«${L}» үсэг алга боллоо — дахин олох хэрэгтэй.`;
      }
    } else msg = this.chapters[room]?.loseOne?.() ?? null;
    if (!msg) {
      const lose = Math.min(this.s.coins, 20);
      this.s.coins -= lose;
      msg = lose ? `Сүүдэр ${lose} ✦ авч оджээ.` : null;
    }
    this.save();
    this.refreshHUD();
    return msg;
  }

  // ================================================================== rooms
  /** A chapter step finished: small payout + HUD. */
  stepDone(room: RoomId, step: number, label?: string) {
    this.c.avatar.cheer();
    this.s.rooms[room].step = Math.max(this.s.rooms[room].step, step);
    this.progress.award(PAY.step.xp, PAY.step.coins, label);
    this.save();
    this.refreshHUD();
  }

  async completeRoom(room: RoomId) {
    const r = this.s.rooms[room];
    if (r.done) return;
    r.done = true;
    this.save();
    this.progress.badge(`ch-${room}`);
    this.progress.award(PAY.room.xp, PAY.room.coins, 'Бүлэг дууслаа!');
    this.syncMystery();
    const idx = ROOM_ORDER.indexOf(room);
    const next = ROOM_ORDER[idx + 1] as RoomId | undefined;
    const def = roomDef(room);
    const el = h('div', { class: 'finale' });
    el.innerHTML = `
      <p class="eyebrow">${idx + 1}-р бүлэг дууслаа</p>
      <h2 class="hand"></h2>
      <div class="stats">
        <div><b>${levelForXp(this.s.xp)}</b><span>түвшин</span></div>
        <div><b>${this.progress.uniqueItems()}/${REWARDS.length}</b><span>цуглуулга</span></div>
        <div><b>${Object.keys(this.s.badges).length}</b><span>тэмдэг</span></div>
      </div>
      <p class="muted"></p>`;
    (el.querySelector('h2') as HTMLElement).textContent = def.chapter;
    (el.querySelector('p.muted') as HTMLElement).textContent = next
      ? `Шинэ өрөө нээгдлээ: ${roomDef(next).name}. ${roomDef(next).teaser}`
      : 'Байшингийн бүх нууц тайлагдлаа.';
    const b = h('button', { class: 'btn-primary' }, next ? `${roomDef(next).name} руу →` : 'Гайхалтай!');
    b.addEventListener('click', () => ui.closeModal());
    el.append(b);
    ui.openModal(el, {
      className: 'modal-finale',
      onClose: () => {
        if (next) void this.unlockRoom(next, true);
        setTimeout(() => this.rollReward({ room, reason: `«${def.chapter}» бүлгийн шагнал` }), next ? 3400 : 600);
      },
    });
    this.refreshHUD();
  }

  async unlockRoom(id: RoomId, animate: boolean) {
    const r = this.s.rooms[id];
    if (r.unlocked && !animate) return;
    r.unlocked = true;
    this.save();
    const { world } = this.c;
    const door = DOORS.find((d) => d.to === id);
    this.busy = true;
    await this.c.focusRoom(id);
    world.setRoomLocked(id, false);
    const group = world.rooms.get(id)!.group;
    sound.unlock();
    group.children.forEach((o, i) => {
      const s = o.scale.clone();
      o.scale.multiplyScalar(0.01);
      gsap.to(o.scale, { x: s.x, y: s.y, z: s.z, duration: 0.7, delay: 0.15 + i * 0.025, ease: 'back.out(1.8)' });
    });
    this.confetti(world.rooms.get(id)!.center.clone().setY(2.5), 90, 1.1);
    ui.flash('#b388ff', 0.35);
    if (door) await world.setDoor(door.id, true);
    sound.powerUp();
    this.busy = false;
    this.rebuildNav();
    this.travel(id);
    this.syncHotspots();
    this.syncMystery();
    this.refreshHUD();
    this.chapters[id]?.onEnter?.();
  }

  // ================================================================== rewards & collection
  rollReward(opts: { rarity?: Rarity; id?: string; reason?: string; room?: RoomId } = {}) {
    let item: RewardDef | undefined = opts.id ? REWARDS.find((r) => r.id === opts.id) : undefined;
    if (!item) {
      const open = ROOM_ORDER.filter((r) => this.s.rooms[r].unlocked);
      let pool = REWARDS.filter((x) => x.src === 'roll' && (opts.room ? x.set === opts.room : open.includes(x.set as RoomId)));
      if (!pool.length) pool = REWARDS.filter((x) => x.src === 'roll' && open.includes(x.set as RoomId));
      if (opts.rarity) {
        const rp = pool.filter((x) => x.rarity === opts.rarity);
        if (rp.length) pool = rp;
      }
      const fresh = pool.filter((x) => !this.s.collection[x.id]);
      item = pick(fresh.length ? fresh : pool);
    }
    this.showReward(item, opts.reason ?? '', 'Mystery Generator');
  }

  /** Hidden find (FINDS table) — handed over directly with a reveal card. */
  giveFind(objId: string) {
    const f = FINDS[objId];
    if (!f || this.s.collection[f.item] || this.pendingFinds.has(f.item)) return false;
    const n = (this.s.pokes[objId] = (this.s.pokes[objId] ?? 0) + 1);
    if (n < f.nth) return false;
    const item = REWARDS.find((r) => r.id === f.item)!;
    this.pendingFinds.add(item.id);
    this.card(objId, f.text, 5000);
    this.progress.award(PAY.find.xp, PAY.find.coins, 'Нууц олдвор');
    setTimeout(() => { this.pendingFinds.delete(item.id); this.showReward(item, 'Нуугдмал олдвор', 'Олдвор!'); }, 900);
    return true;
  }

  private showReward(reward: RewardDef, reason: string, eyebrow: string) {
    const dup = !!this.s.collection[reward.id];
    this.s.collection[reward.id] = (this.s.collection[reward.id] ?? 0) + 1;
    this.save();
    const dupCoins = PAY.dupe[reward.rarity];
    const el = h('div', { class: 'reward' });
    el.innerHTML = `
      <p class="eyebrow"></p>
      <div class="slot-machine"><span class="roll">???</span></div>
      <div class="reward-card rarity-${reward.rarity}" hidden>
        <div class="reward-art">${shapeSvg(reward.shape, reward.color, 84)}</div>
        <span class="rarity">${RARITY_LABEL[reward.rarity]}${dup ? ` · давхардсан → +${dupCoins} ✦` : ' · шинэ!'}</span>
        <h3></h3>
        <p></p>
        <small class="reason-line" hidden></small>
        <small class="title-gen"></small>
      </div>`;
    (el.querySelector('.eyebrow') as HTMLElement).textContent = eyebrow;
    (el.querySelector('h3') as HTMLElement).textContent = reward.name;
    (el.querySelector('.reward-card p') as HTMLElement).textContent = reward.desc;
    if (reason) {
      const reasonEl = el.querySelector('.reason-line') as HTMLElement;
      reasonEl.textContent = `🏷 ${reason}`;
      reasonEl.hidden = false;
    }
    const set = reward.set === 'legend' ? null : reward.set;
    const setOwned = set ? REWARDS.filter((r) => r.set === set && this.s.collection[r.id]).length : 0;
    (el.querySelector('.title-gen') as HTMLElement).textContent = set ? `${roomDef(set).name}-ны цуглуулга: ${setOwned}/4` : 'Домогт цуглуулга';
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
        if (i < 16) setTimeout(step, 50 + i * 9);
        else {
          (el.querySelector('.slot-machine') as HTMLElement).hidden = true;
          const cardEl = el.querySelector('.reward-card') as HTMLElement;
          cardEl.hidden = false;
          gsap.fromTo(cardEl, { rotateY: 90, scale: 0.7 }, { rotateY: 0, scale: 1, duration: 0.6, ease: 'back.out(2)' });
          if (reward.rarity === 'legendary') { sound.legendary(); ui.flash('#ffd36b', 0.4); }
          else sound.success();
          btn.removeAttribute('disabled');
          if (reward.rarity === 'legendary') this.progress.badge('lucky');
          if (dup) this.progress.award(0, dupCoins, 'Давхардсан');
          else {
            this.progress.award(PAY.newItem.xp, 0);
            if (set && setOwned === 4) setTimeout(() => {
              ui.toast(`🎉 ${roomDef(set).name}-ны цуглуулга бүрэн боллоо! +100 ✦`, 5000);
              this.progress.award(60, 100, 'Цуглуулга бүрэн');
            }, 800);
          }
          this.progress.checkBadges();
          this.buildShelf();
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

  /** The living-room display cabinet shows every item you own as a little coin. */
  buildShelf() {
    const { shelfGroup, shelfSlots } = this.c.world.living;
    shelfGroup.clear();
    const owned = REWARDS.filter((r) => this.s.collection[r.id]);
    owned.forEach((r, i) => {
      const slot = shelfSlots[i];
      if (!slot) return;
      let tex = this.shelfTex.get(r.id);
      if (!tex) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 128;
        const ctx = cv.getContext('2d')!;
        ctx.fillStyle = r.rarity === 'legendary' ? '#3b2a12' : r.rarity === 'rare' ? '#16305a' : '#2a2046';
        ctx.beginPath();
        ctx.arc(64, 64, 64, 0, Math.PI * 2);
        ctx.fill();
        const t = new THREE.CanvasTexture(cv);
        t.colorSpace = THREE.SRGBColorSpace;
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 22, 22, 84, 84); t.needsUpdate = true; };
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(shapeSvg(r.shape, r.color, 84).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
        tex = t;
        this.shelfTex.set(r.id, t);
      }
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24).rotateX(Math.PI / 2), [
        new THREE.MeshStandardMaterial({ color: r.rarity === 'legendary' ? '#ffd700' : '#c9b8ff', metalness: 0.6, roughness: 0.3 }),
        new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 }),
        new THREE.MeshStandardMaterial({ color: '#c9b8ff' }),
      ]);
      coin.position.copy(slot);
      coin.rotation.z = 0;
      coin.userData.ignoreRay = true;
      shelfGroup.add(coin);
    });
  }

  // ================================================================== input
  hoverName(id: string | null) {
    if (!id) return null;
    if (id === 'creature' && this.c.creature.mode === 'hidden') return null;
    const z = this.c.world.zoneOf(id);
    if (z !== 'garden' && !this.s.rooms[z].unlocked && !id.startsWith('door-')) return null;
    if (this.hunt.dangerous && this.focus && HIDE_SPOTS[this.focus]?.some((x) => x.id === id)) return `🫣 ${HIDE_SPOTS[this.focus]!.find((x) => x.id === id)!.text} нуугдах`;
    return OBJECTS[this.baseOf(id)]?.name ?? null;
  }

  onEmptyClick() {
    ui.hideCard();
  }

  /** Clicks in the whole-house view on a room's floor/walls (no object): zoom in. */
  onRoomClick(id: ZoneId) {
    if (id === 'garden') return;
    this.goto(id);
  }

  onClick(id: string) {
    if (this.busy) return;
    const { world } = this.c;
    const zone: ZoneId = id === 'creature' ? (this.focus ?? 'study') : world.zoneOf(id);

    // The Shadow is coming: only hiding (or running) matters now.
    if (this.hunt.dangerous && this.hunt.room === this.focus) {
      if (this.hunt.tryHide(id)) return;
      if (!id.startsWith('door-')) {
        sound.error();
        ui.toast('Одоо биш! Нуугдах газар сонго (🫣) эсвэл өөр өрөө рүү зугт!', 2200);
        return;
      }
    }
    if (id.startsWith('door-')) return this.onDoor(id);
    if (zone !== 'garden') {
      if (!this.s.rooms[zone].unlocked) {
        sound.lock();
        ui.toast(`🔒 ${roomDef(zone).name} түгжээтэй.`, 2200);
        return;
      }
      if (zone !== this.focus) {
        this.goto(zone);
        return;
      }
    }
    sound.click();
    if (!this.s.seen.includes(id)) {
      this.s.seen.push(id);
      const hs = world.hotspots.get(id);
      if (hs) gsap.to(hs.scale, { x: 0, y: 0, duration: 0.3, onComplete: () => { hs.visible = false; } });
      this.progress.award(PAY.touch.xp, 0);
      this.progress.checkBadges();
      this.save();
    }
    this.progress.quest('touch', id);
    if (this.glitchOn) this.progress.badge('glitch');
    const obj = world.interactives.get(id);
    if (obj) {
      const b = obj.userData.baseScale as THREE.Vector3;
      gsap.fromTo(obj.scale, { x: b.x * 0.92, y: b.y * 0.92, z: b.z * 0.92 }, { x: b.x, y: b.y, z: b.z, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    }

    // Today's mystery letter hidden here?
    const m = this.s.mystery;
    if (m && m.day === today() && !m.solved && m.sources.includes(id) && !m.letters.includes(id)) {
      void this.mysteryChallenge(id);
      return;
    }
    if (zone === 'garden') return this.onGarden(id);
    if (id === 'creature') return this.onCreature();
    const handled = zone === 'study' ? this.studyClick(id) : this.chapters[zone]!.onClick(id);
    if (!handled) this.giveFind(id);
  }

  private onDoor(id: string) {
    const d = DOORS.find((x) => x.id === id)!;
    const open = this.c.world.doors.get(id)?.open;
    if (!open && this.chapters[d.from]?.onClick(id)) return;
    if (!open) {
      sound.lock();
      this.card(id, `Түгжээтэй. Цаана нь ${roomDef(d.to).name} байна. ${d.from === 'bedroom' ? 'Түлхүүр хэрэгтэй.' : 'Энэ бүлгийн нууцыг тайлбал нээгдэнэ.'}`);
      return;
    }
    this.goto(this.focus === d.to ? d.from : d.to);
  }

  private onCreature() {
    const { creature } = this.c;
    if (creature.catchable) return this.catchMochi();
    if (creature.mode === 'sit') {
      if (this.focus === 'kitchen' && this.chapters.kitchen!.onClick('creature')) return;
      sound.squeak();
      creature.bounce();
      this.progress.stat('pets');
      this.progress.quest('pet');
      this.progress.award(PAY.pet.xp, 0);
      this.card('creature', this.cycle('mochi', [
        'Мочи: "Пиу!"',
        'Мочи чамайг ширтэж байна. Маш их ширтэж байна.',
        'Мочи: "Сүүдэр ирэхэд би чамд хэлнэ. Би чихтэй шүү дээ."',
        'Мочи хэвлийгээ илүүлэхийг хүсэж байгаа бололтой.',
        'Мочи: "Хайрцаг хоосон байсныг би мэдэж байсан. Хэлээгүй л юм."',
        'Мочи: "Сүүдэр... надтай их адилхан харагддаг. Хачин."',
      ]));
    }
  }

  // ================================================================== daily mystery
  private mysteryCandidates() {
    const out: string[] = [];
    for (const r of ROOM_ORDER) if (this.s.rooms[r].done) out.push(...(MYSTERY_POOL[r] ?? []));
    return out.filter((id) => this.c.world.interactives.has(id));
  }

  /** Creates today's mystery if possible and places the ✉ markers. */
  syncMystery() {
    const m = this.progress.mystery();
    for (const [id, spr] of this.mysteryMarks) {
      spr.removeFromParent();
      this.mysteryMarks.delete(id);
    }
    if (!m || m.solved) return;
    for (const id of m.sources) {
      if (m.letters.includes(id) || !this.c.world.interactives.has(id)) continue;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.mysteryTex, transparent: true, depthTest: false }));
      spr.renderOrder = 21;
      spr.scale.setScalar(0.45);
      spr.userData.ignoreRay = true;
      this.c.world.root.add(spr);
      this.mysteryMarks.set(id, spr);
    }
  }

  private async mysteryChallenge(id: string) {
    if (this.locked(id)) return;
    ui.hideCard();
    const lvl = Math.min(6, 1 + Math.floor(levelForXp(this.s.xp) / 4));
    const res = await this.challenge(`${OBJECTS[this.baseOf(id)]?.name ?? id} · Өдрийн нууц`, { level: lvl });
    const m = this.s.mystery!;
    if (!res.ok) {
      m.mistakes++;
      this.lockFor(id, 6);
      this.card(id, 'Буруу! Энэ объект хэдэн секунд түгжигдлээ.', 3500);
      this.save();
      return;
    }
    m.letters.push(id);
    this.save();
    this.mysteryMarks.get(id)?.removeFromParent();
    this.mysteryMarks.delete(id);
    const L = m.word[m.sources.indexOf(id)];
    await this.flyToken(L, this.c.world.anchorOf(id));
    this.progress.award(PAY.letter.xp, PAY.letter.coins, 'Өдрийн үсэг');
    if (m.letters.length === m.word.length) ui.toast('✉ Өдрийн нууцын бүх үсэг олдлоо! Шуудангийн хайрцаг (эсвэл 📅) дээр үгээ оруул.', 6000);
    else ui.toast(`✉ Өдрийн нууц: ${m.letters.length}/${m.word.length} үсэг`, 2500);
    this.refreshHUD();
  }

  // ================================================================== garden
  private onGarden(id: string) {
    const { world } = this.c;
    if (id === 'mailbox') {
      sound.pop();
      gsap.fromTo(world.gardenRefs.mailFlag.rotation, { z: -0.4 }, { z: world.gardenRefs.mailFlag.rotation.z, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
      openDaily(this);
      return;
    }
    if (id === 'magictree') {
      const d = today();
      if (this.s.waterDay === d) {
        this.card('magictree', this.s.treeStage >= 8
          ? 'Ид шидийн мод бүрэн ургасан! Жимс нь бүгд гэрэлтэж байна.'
          : `Өнөөдөр аль хэдийн усалсан. Маргааш дахиад ир — мод ${this.s.treeStage}/8 шатанд байна.`);
        return;
      }
      this.s.waterDay = d;
      this.s.treeStage = Math.min(8, this.s.treeStage + 1);
      this.save();
      sound.splash();
      this.puff(world.anchorOf('magictree').add(new THREE.Vector3(0, -1.5, 0)), 14, '#9de8ff');
      world.gardenRefs.setTreeStage(this.s.treeStage, true);
      this.progress.stat('waters');
      this.progress.quest('water');
      this.progress.award(PAY.water.xp, PAY.water.coins, 'Мод усаллаа');
      this.card('magictree', this.s.treeStage >= 8
        ? 'Мод бүрэн ургалаа! Бүх жимс нь гэрэлтэж байна. Гайхалтай!'
        : `Мод нэг шат ургалаа (${this.s.treeStage}/8). Өдөр бүр услаарай — шинэ гэрэлт жимс гарна.`);
      if (this.s.treeStage === 4 || this.s.treeStage === 8) setTimeout(() => this.rollReward({ reason: `Ид шидийн мод ${this.s.treeStage}-р шатанд хүрлээ` }), 1800);
      return;
    }
    const lines: Record<string, string[]> = {
      gnome: ['Одой: "Би энэ цэцэрлэгийг 100 жил манаж байна."', 'Одой: "Шөнө байшинд нэг юм хэсүүчилдэг. Би харсан."', 'Одой нүдээ ирмэх шиг болов. Эсвэл үгүй.'],
      bench: ['Вандан сандал. Энд суугаад оддыг ширтэхэд яг тохиромжтой.', 'Сандал дээр сийлсэн бичиг: "М + ★"'],
      flowers: ['Цэцгүүд Мочигийн дуунаар найгана.', 'Нэг цэцэг чамайг хараад дэлбээгээ дэлгэв.'],
    };
    sound.pop();
    this.card(id, this.cycle(id, lines[id] ?? ['...']));
  }

  // ================================================================== study (the original room)
  private letterTotal() { return Object.keys(LETTER_SOURCES[this.s.stage] ?? {}).length; }

  private studyQuest(): QuestView {
    const st = this.s.stage;
    const q = QUESTS[Math.min(st, QUESTS.length - 1)];
    const map = LETTER_SOURCES[st];
    const word = st < 2 ? WORDS[st] : st === 4 ? WORDS[2] : '';
    const letters = map ? this.s.letters.map((id) => map[id]) : st === 4 ? WORDS[2].slice(0, this.cubeIdx).split('') : [];
    return { title: q.title, sub: q.sub, slots: word.length, letters };
  }

  private async revealLetter(sourceId: string, at?: THREE.Vector3) {
    const L = LETTER_SOURCES[this.s.stage]?.[sourceId];
    if (!L || this.s.letters.includes(sourceId)) return false;
    this.s.letters.push(sourceId);
    this.save();
    await this.flyToken(L, at ?? this.c.world.anchorOf(sourceId));
    this.progress.award(PAY.letter.xp, PAY.letter.coins);
    this.refreshHUD();
    if (this.s.letters.length === this.letterTotal()) {
      const where = this.s.stage === 1 ? 'Аркад машин' : 'Ширээн дээрх компьютер';
      setTimeout(() => ui.toast(`Бүх үсэг олдлоо! ${where} дээр нууц үгээ оруул.`, 6000), 400);
    }
    return true;
  }

  private studyClick(id: string): boolean {
    if (id.startsWith('glyph')) { this.onGlyph(Number(id.slice(5))); return true; }
    if (id.startsWith('cube')) { this.onCube(Number(id.slice(4))); return true; }
    const handler: Record<string, () => void> = {
      box: () => this.onBox(),
      computer: () => this.onComputer(),
      arcade: () => this.onArcade(),
      bookshelf: () => this.onBookshelf(),
      redbook: () => this.onRedbook(),
      plant: () => void this.onPlant(),
      clock: () => this.onClock(),
      lamp: () => this.onLamp(),
      rug: () => this.onRug(),
      window: () => this.onWindow('window'),
      beanbag: () => this.onBeanbag(),
      poster: () => this.onPoster(),
      neon: () => this.onNeon(),
      mug: () => this.onMug(),
      tesseract: () => this.onTesseract(),
    };
    handler[id]?.();
    return id === 'beanbag' || id === 'poster' ? false : true;
  }

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
      this.progress.badge('dark');
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
        setTimeout(() => creature.run(this.s.hardMode ? 1 : 2), 250);
        this.card('redbook', 'ЮУ ВЭ?! Тавиурын цаанаас жижигхэн амьтан гүйгээд гарлаа! Түүнийг барь!', 5000);
      }
      return;
    }
    this.card('redbook', 'Номын нэр: "Нууц хаалга хэрхэн хийх вэ — 2-р хэвлэл". Нэг хуудас нь урагдчихсан.');
  }

  private catchMochi() {
    const { creature } = this.c;
    sound.squeak();
    ui.flash('#ffb3d9', 0.35);
    const at = creature.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    this.confetti(at, 50, 0.8);
    const wasCaught = this.s.creatureCaught;
    this.s.creatureCaught = true;
    this.save();
    creature.spot.copy(this.c.world.rooms.get('study')!.mochiSpot);
    creature.catch(() => creature.setHat(this.s.hat));
    if (!wasCaught) {
      this.card('creature', 'Баригдлаа! Энэ бол Мочи. Тэр олон жил тавиурын ард Сүүдрээс нуугдаж, хэн нэгэн олохыг хүлээж байжээ. Одоо чамтай хамт явна.', 7000);
      this.progress.badge('detective');
      if (this.s.stage === 1) void this.revealLetter('creature', at);
      setTimeout(() => this.rollReward({ reason: 'Мочиг барьсны шагнал' }), 4500);
    }
  }

  private async onPlant() {
    const { world } = this.c;
    sound.boing();
    gsap.fromTo(world.plantGrowth.scale, { x: 0.9, y: 0.8, z: 0.9 }, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'elastic.out(1, 0.35)' });
    if (this.s.stage === 0 && !this.s.letters.includes('plant')) {
      if (this.locked('plant')) return;
      this.busy = true;
      const res = await runChallenge({ kind: 'riddle', level: 0, hard: false, title: 'Ургамал', riddle: PLANT_RIDDLE, noTimer: true });
      this.busy = false;
      if (res.ok) {
        this.progress.stat('challenges');
        gsap.fromTo(world.plantGrowth.scale, { x: 1.4, y: 1.6, z: 1.4 }, { x: 1, y: 1, z: 1, duration: 1.2, ease: 'elastic.out(1, 0.35)' });
        this.puff(world.anchorOf('plant'), 10, '#9df5b0');
        this.card('plant', 'Ургамал баярласандаа навчаа дэлгээд... навчны завсраас нэг үсэг гарч ирлээ!');
        void this.revealLetter('plant');
      } else {
        this.lockFor('plant', 4);
        this.card('plant', 'Ургамал гомдчихлоо. Түр хүлээгээд дахин оролд. Сэжүүр: юу хамгийн их хэрэгтэй гэж хэлсэн бэ?');
      }
      return;
    }
    this.card('plant', this.cycle('plant', ['Ургамал чамайг анзаарлаа.', 'Ургамал: "Баярлалаа, ярилцаж өгсөнд."', 'Ургамал нартай өдрийг санагалзаж байх шиг.']));
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
    this.card('clock', this.cycle('clock', ['Цаг жинхэнэ цагаар явдаг. Гайхалтай, тийм ээ?', 'Хэн нэгэн "цаг бол мөнгө" гэсэн. Энэ цаг үнэгүй.', 'Цагийн зүү хурдан эргэлээ. Бусад нь хэвийн.']));
  }

  private setLamp(on: boolean) {
    const { world } = this.c;
    this.lampOn = on;
    const base = world.lightBase.get(world.lights.lamp) ?? world.lights.lamp.userData.base ?? 14;
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
    this.progress.badge('disco');
    this.progress.stat('discos');
    this.progress.quest('disco');
    this.card('lamp', 'PARTY OF ONE! Чийдэн диско горимд шилжлээ. Бүжиглэ!');
    sound.fanfare();
    const lamp = world.lights.lamp;
    const orig = lamp.color.clone();
    const origFill = world.lights.fill.color.clone();
    const origNeon = world.neonMat.emissive.clone();
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
      world.neonMat.emissive.copy(origNeon);
      for (const b of world.bulbs) b.mat.emissive.copy(b.base);
      if (!this.finaleOn) creature.dance(false);
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
    this.card('rug', this.cycle('rug', ['Хивс. Бүх нууцыг доороо нуудаг гэж ярьдаг.', 'Хивсний доор... тоос. Premium тоос.', 'Энэ хивс өрөөг бүхэлд нь холбож өгдөг. Үнэхээр.']));
  }

  /** Both the study window and the bedroom window show the sky. */
  onWindow(id: string) {
    const { sky } = this.c;
    if (performance.now() < this.meteorEventUntil) this.progress.badge('stargazer');
    if (this.showerCooldown > 0) {
      this.card(id, 'Тэнгэр амсхийж байна. Хэдэн секундийн дараа дахиад хар.');
      return;
    }
    this.showerCooldown = 7;
    sky.meteorShower(20);
    sound.whoosh();
    this.progress.stat('meteors');
    this.progress.quest('meteor');
    if (id === 'window' && this.s.stage === 1 && !this.s.letters.includes('window')) {
      this.card('window', 'Цонхоор харахад солирын бороо орж эхэллээ! Нэг солир цонхны тавцан дээр унах шиг боллоо...', 5000);
      setTimeout(() => {
        this.puff(this.c.world.anchorOf('window').add(new THREE.Vector3(0, -1.2, 0)), 10, '#ffb36b');
        void this.revealLetter('window', this.c.world.anchorOf('window').add(new THREE.Vector3(0, -1, 0)));
      }, 2400);
      return;
    }
    this.card(id, this.cycle('window', [
      'Гадаа харахад солир унаж байна. Хүсэл шивнэх цаг!',
      'Энэ жижигхэн байшин сансарт хөвж явдгийг мэдэх үү?',
      'Сар инээмсэглэх шиг болов. Эсвэл үгүй.',
      'Цонхны шилэн дээр хуруугаар бичсэн: "Түүнээс бүү ай. Ганцаардсан л юм."',
    ]));
  }

  private onBeanbag() {
    const { world } = this.c;
    sound.boing();
    gsap.fromTo(world.beanbagInner.scale, { x: 1.18, y: 0.35, z: 1.18 }, { x: 1, y: 0.55, z: 1, duration: 1, ease: 'elastic.out(1, 0.3)' });
    this.card('beanbag', this.cycle('bean', ['Пуф! Дэлхийн хамгийн зөөлөн шийдвэр.', 'Зөөлөн суудал чамайг тэвэрч авлаа.', 'Ард нь нуугдахад яг тохиромжтой. Хэн нэгэнд хэрэг болох байх...', 'Пуф! Дахиад нэг удаа?']));
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
    this.card('poster', this.cycle('poster', ['"Nothing is what it seems." Энэ байшингийн гол дүрэм.', 'Постер арай муруй болчихлоо. Засах уу?', 'Одоо бүр муруй боллоо.', 'Чи үүнийг засаж байгаа юм уу эвдэж байгаа юм уу?', 'Сүүлийн нэг оролдлого...']));
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
    this.card('neon', this.cycle('neon', ['Неон үүл. Бороо оруулдаггүй, зөвхөн vibe оруулдаг.', 'Өнгө солигдлоо. Өрөөний сэтгэл санаа ч бас.', 'Энэ үүл хэзээ ч бүрхэгддэггүй.']));
  }

  private onMug() {
    sound.steam();
    this.puff(this.c.world.anchorOf('mug').add(new THREE.Vector3(0, -0.12, 0)), 7);
    this.card('mug', this.cycle('mug', ['Кофе. 2019 оноос хойш хүйтэн хэвээр.', 'Аяган дээр "World\'s okayest explorer" гэж бичжээ.', 'Чи үүнийг уух гэж байгаа юм биш биз дээ?', 'Дахиад шалгалаа. Одоо ч хүйтэн.']));
  }

  private onTesseract() {
    const { world } = this.c;
    world.tesseract.speed = 6;
    gsap.to(world.tesseract, { speed: 1, duration: 3, ease: 'power2.out' });
    this.rgbGlitch(0.01, 1.5);
    sound.legendary();
    const first = this.progress.badge('fourth');
    this.card('tesseract', first
      ? 'Тессеракт — 4 хэмжээст шоо. Чи түүнд хүрэхэд орон зай хоромхон зуур эвхэгдлээ!'
      : 'Тессеракт эргэлдэж байна. Дөрөв дэх хэмжээс өнөөдөр ч гэсэн ажиллаж байна.');
    if (!this.s.collection.tesseract) setTimeout(() => this.rollReward({ id: 'tesseract', reason: 'Тессерактад хүрсний шагнал' }), 1500);
  }

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
      void this.openSecretDoor();
    } else ui.toast(`Зөв дараалал: ${k}/${GLYPH_ORDER.length} ✦`, 1100);
  }

  private async openSecretDoor() {
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
    this.rebuildNav();
    ui.flash('#b388ff', 0.4);
    sound.success();
    await this.cinematic(new THREE.Vector3(-5.6, 1.4, -1.8), new THREE.Vector3(9, 6.5, 4), 1.6);
    this.stepDone('study', 4, 'Нууц хонгил');
    this.card('cube', 'Нууц хонгил нээгдлээ! Дотор нь үсэгтэй шоонууд хөвж байна. Тэднээр сүүлчийн нууц үгийг бүтээ.', 8000);
    this.cardAnchor = 'cube3';
    this.busy = false;
    if (!this.s.creatureCaught && creature.mode === 'hidden') {
      setTimeout(() => {
        ui.toast('Мочи нууц хонгилоос гүйгээд гарлаа! Барьж аваарай!');
        creature.run(this.s.hardMode ? 2 : 3);
      }, 2500);
    }
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
        setTimeout(() => void this.studyFinale(), 1300);
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

  private async studyFinale() {
    const { world } = this.c;
    this.busy = true;
    ui.hideCard();
    this.s.stage = 5;
    this.s.finishedMs = this.s.playMs + (performance.now() - this.playStart);
    const t0 = Number(this.s.rooms.study.flags.find((f) => f.startsWith('t0:'))?.slice(3) ?? 0);
    if (this.s.finishedMs - t0 <= 8 * 60 * 1000) this.progress.badge('speedrun');
    this.save();
    this.refreshHUD();
    await this.cinematic(new THREE.Vector3(0.4, 2.6, 0.9), new THREE.Vector3(11, 7.5, 11), 1.4);
    sound.powerDown();
    for (const b of world.bulbs) gsap.to(b.mat, { emissiveIntensity: 0.1, duration: 0.6 });
    await sleep(900);
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
    this.confetti(new THREE.Vector3(0.4, 3.4, 0.9), 140, 1.3);
    for (const b of world.bulbs) gsap.to(b.mat, { emissiveIntensity: 2.4, duration: 1 });
    for (const cube of world.cubes) (cube.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3;
    this.busy = false;
    setTimeout(() => void this.completeRoom('study'), 900);
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
    print('LITTLE-OS v5.0  (c) Little House Inc.', 'dim');
    if (this.s.stage === 0) {
      print('Нууц үг шаардлагатай. Өрөөнөөс 4 үсэг ол.');
      const map = LETTER_SOURCES[0];
      const found = this.s.letters.map((id) => map[id]).join(' ');
      if (found) print(`Олдсон үсгүүд: ${found}`, 'gold');
    } else print('Сайн уу, мөрдөгч. Тусламж: help', 'green');

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
      const cmds: Record<string, () => void> = {
        HELP: () => print('Командууд: help, hint, joke, whoami, time, shadow, clear ... бас хэд хэдэн нууц команд.', 'dim'),
        HINT: () => print(this.currentHint(), 'gold'),
        JOKE: () => print(pick([
          'Программист яагаад байгальд гардаггүй вэ? — Хэт олон bug байдаг.',
          'Яагаад хайрцаг хоосон байсан бэ? — Учир нь энэ бол хайрцаг.',
          'Сүүдэр яагаад гэрэлд дургүй вэ? — Тэр үед өөрийгөө хардаг.',
          '"Энэ ажиллаж байна" гэж хэлмэгц л ажиллахаа больдог.',
        ])),
        WHOAMI: () => print(`${this.progress.title} · Түвшин ${levelForXp(this.s.xp)}`),
        TIME: () => print(new Date().toLocaleTimeString()),
        CLEAR: () => out.replaceChildren(),
        SHADOW: () => print('ФАЙЛ: shadow.log — "Тэр шөнө бүр гэрэл хайдаг. Харанхуйд ганцаараа удаж дээ." [ЭВДЭРСЭН]', 'red'),
        PLAY: () => print('Энэ үг өөр машинд зориулагдсан. Аркад руу оч.', 'gold'),
        WORLD: () => print('Энэ үгийг бичих биш, БҮТЭЭХ хэрэгтэй...', 'gold'),
        MOCHI: () => print(this.s.creatureCaught ? 'Мочи: "Пиу!"' : 'Мочи гэж хэн бэ? Мэдэхгүй ээ. *тавиур руу харна*'),
        LS: () => print('box.secret  arcade.exe  bookshelf/  .mochi_hideout  shadow.log  nothing.txt', 'dim'),
        'CAT NOTHING.TXT': () => print('Энд юу ч байхгүй. Үнэхээр.'),
        'CAT SHADOW.LOG': () => print('"...хэрэв хэн нэгэн оддыг холбож чадвал, би гэр лүүгээ буцаж чадна..."', 'gold'),
        SUDO: () => { print('Зөвшөөрөл олгогдлоо... гэж бодсон уу? Энэ байшинд бүгд тэгш эрхтэй.', 'gold'); this.progress.badge('hacker'); },
        HACK: () => this.matrix(print),
        MATRIX: () => this.matrix(print),
      };
      const fn = cmds[cmd] ?? (cmd.startsWith('SUDO ') ? cmds.SUDO : undefined);
      if (fn) { fn(); return; }
      sound.error();
      gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.25)' });
      print(pick(['ACCESS DENIED. Гэхдээ оролдлогод чинь 10 оноо.', 'Буруу. Компьютер чамайг харж инээмсэглэлээ.', 'Үгүй ээ. Гэхдээ сайхан оролдлого байлаа.', 'Алдаа 418: Би бол цайны данх.']), 'red');
    });
    ui.openModal(el, { className: 'modal-terminal', onClose: () => { this.terminalText = ''; } });
  }

  private matrix(print: (t: string, c?: string) => void) {
    this.progress.badge('hacker');
    let n = 0;
    const iv = setInterval(() => {
      print(Array.from({ length: 34 }, () => (Math.random() > 0.5 ? '1' : '0')).join(''), 'green');
      if (++n > 10) {
        clearInterval(iv);
        print("I'm in. ...Гэхдээ энд нууц юм байхгүй, зөвхөн чипс.", 'gold');
      }
    }, 70);
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
    void this.c.focusRoom('study');
    this.peekTimer = 8;
    this.stepDone('study', 1, 'OPEN');
    const el = h('div', { class: 'nothing' });
    el.innerHTML = `
      <p class="eyebrow">Сэжигтэй хайрцаг нээгдлээ</p>
      <h2 class="hand">Congratulations!</h2>
      <p class="nothing-big">You unlocked<br/><span>absolutely nothing.</span></p>
      <p class="muted">Хайрцаг бүрэн хоосон байна. Маш хоосон. Мэргэжлийн түвшний хоосон.</p>`;
    const b = h('button', { class: 'btn-primary' }, 'Хүлээгээрэй... үнэхээр юу ч байхгүй гэж үү?');
    b.addEventListener('click', () => ui.closeModal());
    el.append(b);
    this.progress.badge('nothing');
    ui.openModal(el, {
      className: 'modal-nothing',
      onClose: () => {
        this.card('box', 'Хайрцгийн ёроолд ямар нэг юм наалдсан юм шиг... Дахиад дарж шалгаад үз!', 8000);
        setTimeout(() => this.rollReward({ reason: 'Анхны нууц үгийг тайлсны шагнал' }), 2600);
      },
    });
  }

  // ------------------------------------------------------------------ arcade
  private get arcadeGoal() { return this.s.hardMode ? GOAL + 3 : GOAL; }
  private get arcadeDuration() { return this.s.hardMode ? DURATION - 5 : DURATION; }

  private arcadePower(on: boolean) {
    const { world } = this.c;
    for (const m of world.arcadeStrips) gsap.to(m, { emissiveIntensity: on ? 3 : 0.15, duration: 0.8 });
    gsap.to(world.arcadeMarquee, { emissiveIntensity: on ? 1.6 : 0.35, duration: 0.8 });
    gsap.to(world.lights.arcade, { intensity: on ? 5 : 0, duration: 0.8 });
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
    this.stepDone('study', 2, 'PLAY');
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
    this.progress.quest('arcade');
    const start = () => {
      stop?.();
      stop = runStarCatcher(cv, (win, score, timeLeft) => {
        this.bestScore = Math.max(this.bestScore, score);
        const dur = this.arcadeDuration;
        if (win) {
          sound.fanfare();
          const rank = timeLeft >= dur * 0.5 ? 3 : timeLeft >= dur * 0.25 ? 2 : 1;
          this.s.bestArcadeRank = Math.max(this.s.bestArcadeRank, rank);
          this.progress.checkBadges();
          if (this.s.stage === 2) {
            stop?.();
            ui.closeModal();
            void this.arcadeWin(score, rank);
          } else {
            this.progress.award(15, 10, 'Star Catcher');
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

  private async arcadeWin(score: number, rank: number) {
    this.s.stage = 3;
    this.save();
    this.stepDone('study', 3, 'Star Catcher');
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

  // ================================================================== finale (the observatory)
  /** Aurora, rainbow bulbs, orbiting trophies — the house after the last chapter. */
  finaleAmbience(instant: boolean) {
    const { world, sky } = this.c;
    this.finaleOn = true;
    gsap.to(sky, { auroraAmount: 1, starBrightness: 1.5, duration: instant ? 0 : 4 });
    sky.bigTesseract.lines.visible = true;
    if (!instant) sky.meteorShower(40);
    world.setDustColor('#bff7ff');
    world.observatory.constellation.visible = true;
    sound.setFinale(true);
    this.buildTrophies();
    if (this.s.creatureCaught) this.c.creature.dance(true);
  }

  buildTrophies() {
    const ring = this.c.world.trophyRing;
    ring.clear();
    const owned = REWARDS.filter((r) => this.s.collection[r.id]);
    owned.forEach((r, i) => {
      const geo = r.rarity === 'legendary' ? new THREE.OctahedronGeometry(0.5, 0) : r.rarity === 'rare' ? new THREE.OctahedronGeometry(0.35, 0) : new THREE.IcosahedronGeometry(0.3, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: r.color, emissive: r.color, emissiveIntensity: r.rarity === 'legendary' ? 2 : 0.8, roughness: 0.3, metalness: 0.4 }));
      m.userData.orbit = { a: (i / Math.max(1, owned.length)) * Math.PI * 2, r: 19 + (i % 2) * 1.2, y: 6 + (i % 3) * 0.6 };
      m.userData.ignoreRay = true;
      ring.add(m);
    });
  }

  // ================================================================== hints, sound, menus
  private hintList(): string[] {
    const f = this.focus;
    if (!f) return ['Байшин дээр дарж өрөө сонго. Баруун талын жагсаалтаас ч болно.', 'Шуудангийн хайрцаг (цэцэрлэгт) өдөр бүр бэлэг, даалгавартай.', 'Цэцэрлэгийн ид шидийн модыг өдөр бүр услаарай.'];
    if (this.s.rooms[f].done) return ['Энэ бүлэг дууссан. Нууц олдворууд (цуглуулга) үлдсэн эсэхийг шалга — зарим объектыг хэд хэдэн удаа дарах хэрэгтэй.'];
    if (f === 'study') return HINTS[Math.min(this.s.stage, HINTS.length - 1)];
    return this.chapters[f]!.hints();
  }

  currentHint() {
    const list = this.hintList();
    return list[Math.min(this.hintIdx, list.length - 1)];
  }

  showHint() {
    this.hintIdx++;
    sound.chime();
    if (this.hintIdx % 3 === 0) {
      const undiscovered = BADGES.filter((a) => a.group === 'secret' && !this.s.badges[a.id] && a.clue);
      if (undiscovered.length) {
        ui.toast(`🔎 Нууц сэжүүр: ${pick(undiscovered).clue}`, 6500);
        return;
      }
    }
    const list = this.hintList();
    ui.toast(list[(this.hintIdx - 1) % list.length], 6000);
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

  takePhoto() {
    ui.flash('#ffffff', 0.9);
    sound.tick();
    const url = this.c.snapshot();
    this.progress.stat('photos');
    this.progress.quest('photo');
    void this.savePhoto(url);
  }

  /** Phones get the native share sheet ("Save Image" / send); a data-URL download
   *  link does nothing on iOS and can navigate away from the game on some Androids. */
  private async savePhoto(url: string) {
    const name = 'little-house.png';
    // Decoded synchronously: iOS only allows share() while the tap's user activation
    // is still fresh, and awaiting a fetch first can use it up.
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });
    const file = new File([blob], name, { type: 'image/png' });
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Little World' });
        ui.toast('Зураг бэлэн!');
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    ui.toast('Зураг хадгалагдлаа!');
  }

  openDaily() { openDaily(this); }
  openCollection() { openCollection(this); }
  openShop() { openShop(this); }
  openMenu() { openMenu(this); }

  dismissNote() {
    this.s.noteDismissed = true;
    this.save();
  }

  /** Called once the intro camera move ends. */
  startSession() {
    if (!this.s.avatar) {
      openAvatar(this, true, () => this.startSession());
      return;
    }
    const newDay = this.progress.rollDay();
    this.syncMystery();
    this.refreshHUD();
    this.applyDayPhase();
    if (newDay && this.s.rooms.bedroom.done) {
      setTimeout(() => {
        sound.chime();
        ui.toast(`🎁 Шуудангийн хайрцагт өдрийн бэлэг ирлээ! (${this.s.streak}-р өдөр дараалан)`, 5000);
      }, 1500);
    }
    this.chapters[this.focus ?? 'bedroom']?.onEnter?.();
  }

  private applyDayPhase() {
    const hr = new Date().getHours();
    const phase = hr >= 5 && hr < 9 ? 'dawn' : hr >= 9 && hr < 17 ? 'day' : hr >= 17 && hr < 20 ? 'dusk' : 'night';
    this.c.world.setDayPhase(phase);
    this.c.sky.setPhase(phase);
  }

  // ================================================================== random events
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
    gsap.to(sky, { starBrightness: this.finaleOn ? 1.5 : 1, duration: 1 });
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

  // ================================================================== loop
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

    this.hunt.update(dt);
    this.c.shadow.update(dt, t);

    if (!this.busy && !ui.modalOpen && !this.hunt.dangerous) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) {
        if (this.blackoutOn || this.glitchOn || this.discoOn) this.eventTimer = 2;
        else {
          this.eventTimer = rand(50, 100) * (this.s.hardMode ? 0.6 : 1);
          this.randomEvent();
        }
      }
      if (this.focus === 'study' && this.s.stage >= 1 && this.s.stage < 4 && !this.s.creatureCaught && creature.mode === 'hidden') {
        this.peekTimer -= dt;
        if (this.peekTimer <= 0) {
          this.peekTimer = rand(12, 22);
          creature.peek();
          sound.squeak();
        }
      }
    }

    if (this.finaleOn || world.lightsMode === 'rainbow') {
      world.bulbs.forEach((b, i) => b.mat.emissive.setHSL(((i / world.bulbs.length) + t * 0.15) % 1, 0.9, 0.6));
    } else if (!this.discoOn && !this.blackoutOn) {
      world.bulbs.forEach((b, i) => { b.mat.emissiveIntensity = 2.0 + Math.sin(t * 2 + i * 1.7) * 0.6; });
    }

    for (const ch of Object.values(this.chapters)) ch.update?.(dt, t);

    for (const [id, spr] of this.mysteryMarks) {
      const z = world.zoneOf(id);
      spr.visible = z === 'garden' || this.s.rooms[z].unlocked;
      world.anchorOf(id, spr.position);
      spr.position.y += 0.55 + Math.sin(t * 2.4 + id.length) * 0.08;
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

    this.dayCheckT -= dt;
    if (this.dayCheckT <= 0) {
      this.dayCheckT = 60;
      if (this.progress.rollDay()) {
        this.syncMystery();
        ui.toast('🌅 Шинэ өдөр эхэллээ! Шуудангийн хайрцгийг шалга.', 4500);
      }
      this.applyDayPhase();
      this.refreshHUD();
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
      ctx.fillText('LITTLE-OS v5.0', 24, 22);
      ctx.fillStyle = '#2f8f7a';
      ctx.fillRect(24, 58, W - 48, 3);
      ctx.fillStyle = '#5ff2c4';
      const lines: string[] = [];
      if (this.s.stage === 0) {
        const map = LETTER_SOURCES[0];
        lines.push('STATUS: LOCKED', `LETTERS: ${this.s.letters.map((id) => map[id]).join(' ') || '?'}`, '', `PASSWORD: ${this.terminalText}${blink ? '_' : ' '}`);
      } else if (this.s.stage < 5) {
        lines.push('BOX.SECRET ... OPENED', 'CONTENTS ... NOTHING', '', `> ${this.terminalText}${blink ? '_' : ' '}`);
      } else if (this.hunt.dangerous) {
        lines.push('WARNING: MOVEMENT', 'SOURCE: UNKNOWN', '', `RUN${blink ? '!' : ' '}`);
      } else {
        lines.push('ALL SYSTEMS: WONDERFUL', `LEVEL: ${levelForXp(this.s.xp)}`, '', `THANK YOU${blink ? ' <3' : ''}`);
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

/** Inventory chip labels shown under the quest. */
const INV_LABEL: Record<string, string> = {
  can: '💧 Усны сав',
  'piece-1': '🗝 Түлхүүр 1',
  matches: '🔥 Шүдэнз',
  egg: '🥚 Өндөг',
  milk: '🥛 Сүү',
  flour: '🌾 Гурил',
  honey: '🍯 Бал',
  pancake: '🥞 Бин',
};
