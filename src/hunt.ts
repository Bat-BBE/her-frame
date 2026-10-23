import * as THREE from 'three';
import gsap from 'gsap';
import { ui } from './ui';
import { sound } from './audio';
import { h, rand, pick } from './util';
import { HIDE_SPOTS, HUNT_GAP, PAY, type RoomId } from './data';
import type { Game } from './game';

type Phase = 'off' | 'idle' | 'approach' | 'arrive' | 'search' | 'leave';

const APPROACH = 8;
const ARRIVE = 3.2;

/** The Shadow's hunt: it drifts toward whichever unfinished room you're in;
 *  you hear it coming, and must hide (rhythm mini-game) or run to another room. */
export class Hunt {
  phase: Phase = 'idle';
  private t = 30;
  room: RoomId | null = null;
  hidden: string | null = null;
  private scriptedDone?: (ok: boolean) => void;
  private stepT = 0;
  private flicker = false;
  private qteRunning = false;
  private overlay: HTMLElement;
  /** Where the avatar stood before squeezing into a hiding spot. */
  private hideFrom = new THREE.Vector3();

  constructor(private g: Game) {
    this.overlay = h('div', { class: 'hide-overlay', hidden: 'true' });
    document.body.append(this.overlay);
  }

  /** Is the Shadow allowed to hunt in `room` right now? */
  private allowed(room: RoomId | null): boolean {
    const s = this.g.s;
    if (!room || s.calmMode || !s.shadowMet || room === 'observatory') return false;
    if (!HIDE_SPOTS[room]) return false;
    if (room === 'living' && s.rooms.living.flags.includes('fire')) return false; // it fears the fire
    if (s.nightHunt) return s.rooms[room].unlocked;
    return !!HUNT_GAP[room] && s.rooms[room].unlocked && !s.rooms[room].done;
  }

  get dangerous() { return this.phase === 'approach' || this.phase === 'arrive' || this.phase === 'search'; }

  /** Called when the camera moves to another room. */
  onFocus(room: RoomId | null) {
    if ((this.phase === 'approach' || this.phase === 'arrive') && room !== this.room && !this.hidden) {
      const fled = this.room;
      this.reset();
      this.t = rand(28, 40);
      this.g.progress.stat('escapes');
      this.g.progress.badge('runner');
      this.g.progress.award(PAY.escape.xp, PAY.escape.coins, 'Зугтлаа!');
      ui.toast(`Зугтлаа! Сүүдэр ${fled ? 'хоосон өрөөнд' : ''} чамайг олсонгүй...`, 3500);
      return;
    }
    if (this.phase === 'idle') this.t = Math.max(this.t, this.gap() * 0.55);
  }

  private gap() {
    const room = this.g.focus;
    const [a, b] = (room && HUNT_GAP[room]) || [55, 80];
    const k = this.g.s.nightHunt ? 0.7 : 1;
    return rand(a, b) * k;
  }

  isSpot(id: string) {
    return !!(this.g.focus && HIDE_SPOTS[this.g.focus]?.some((x) => x.id === id));
  }

  /** Clicking a hiding spot while the Shadow is coming. Returns true if handled. */
  tryHide(id: string): boolean {
    if (!this.dangerous && !this.scriptedDone) return false;
    if (this.hidden || !this.room || this.g.focus !== this.room) return false;
    const spot = HIDE_SPOTS[this.room]?.find((x) => x.id === id);
    if (!spot) return false;
    this.hidden = id;
    sound.creak();
    this.g.hideAnim(id, true);
    const av = this.g.c.avatar;
    this.hideFrom.copy(av.position);
    void av.hideIn(this.g.c.world.anchorOf(id).setY(av.position.y));
    this.showOverlay(`${spot.text} нуугдлаа...`, 'Амьсгаагаа дар. Бүү хөдөл.');
    if (this.phase === 'search' && !this.qteRunning) void this.runSearchQTE();
    return true;
  }

  /** The bedroom's scripted first meeting. Resolves when you've survived it. */
  scripted(): Promise<void> {
    return new Promise((res) => {
      const attempt = () => {
        this.scriptedDone = (ok) => {
          if (ok) {
            this.scriptedDone = undefined;
            res();
          } else {
            setTimeout(() => {
              ui.toast('Дахиад оролдоё. Хөлийн чимээ сонсогдмогц шүүгээ эсвэл ор дээр дарж нуугд!', 5000);
              setTimeout(attempt, 2500);
            }, 1600);
          }
        };
        this.start(this.g.focus ?? 'bedroom');
      };
      attempt();
    });
  }

  private start(room: RoomId) {
    this.phase = 'approach';
    this.room = room;
    this.hidden = null;
    this.t = this.scriptedDone ? 6.5 : APPROACH;
    this.stepT = 0;
    const first = (this.g.s.stats.hides ?? 0) + (this.g.s.stats.caught ?? 0) < 3;
    ui.toast(first || this.scriptedDone
      ? '👣 Хөлийн чимээ ойртож байна... Энэ өрөөнд нуугдах газар хай (шүүгээ, орны доор...) эсвэл өөр өрөө рүү зугт!'
      : pick(['👣 Хэн нэгэн ирж байна...', '👣 Шал шаржигнаж байна...', '👣 Сүүдэр ойртож байна!']), 4200);
    sound.whisper();
    this.g.c.creature.scared(true);
    this.g.c.avatar.scared(true);
  }

  private reset() {
    this.phase = 'idle';
    this.room = null;
    if (this.hidden) {
      this.g.hideAnim(this.hidden, false);
      this.g.c.avatar.unhide(this.hideFrom);
    }
    this.g.c.avatar.scared(false);
    this.hidden = null;
    this.qteRunning = false;
    this.hideOverlay();
    ui.danger(0);
    sound.setDread(0);
    this.g.c.creature.scared(false);
    if (this.flicker) this.restoreLights();
  }

  private roomLights() {
    const r = this.room && this.g.c.world.rooms.get(this.room);
    return r ? r.lights.filter((l) => this.g.c.world.lightBase.has(l)) : [];
  }

  private restoreLights() {
    this.flicker = false;
    for (const l of this.roomLights()) l.intensity = this.g.c.world.lightBase.get(l) ?? l.intensity;
  }

  update(dt: number) {
    const g = this.g;
    if (this.phase === 'off') return;
    const paused = ui.modalOpen || g.busy;
    if (this.phase === 'idle') {
      if (paused || !this.allowed(g.focus)) return;
      this.t -= dt;
      if (this.t <= 0) this.start(g.focus!);
      return;
    }
    if (paused && !this.qteRunning) return;
    this.t -= dt;
    if (this.phase === 'approach') {
      const k = 1 - Math.max(0, this.t) / (this.scriptedDone ? 6.5 : APPROACH);
      ui.danger(k * 0.75, this.hidden ? 'Нуугдсан' : 'Ойртож байна');
      sound.setDread(k * 0.6);
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.95 - k * 0.5;
        sound.footstep(0.08 + k * 0.4);
      }
      if (k > 0.55) {
        this.flicker = true;
        for (const l of this.roomLights()) l.intensity = (g.c.world.lightBase.get(l) ?? 1) * (Math.random() < 0.15 ? 0.15 : 0.75);
      }
      if (this.t <= 0) void this.arrive();
    } else if (this.phase === 'arrive') {
      ui.danger(0.9, this.hidden ? 'Нуугдсан' : 'НУУГД!');
      if (Math.random() < dt * 2) sound.heartbeat(0.35);
      if (this.t <= 0) void this.search();
    } else if (this.phase === 'search') {
      ui.danger(1, this.hidden ? 'Бүү хөдөл...' : 'ОЛДЛОО');
    }
  }

  private async arrive() {
    const g = this.g;
    this.phase = 'arrive';
    this.t = ARRIVE;
    if (this.flicker) this.restoreLights();
    const r = g.c.world.rooms.get(this.room!)!;
    const from = new THREE.Vector3((r.x0 + r.x1) / 2 + rand(-1, 1), r.floorY, r.z0 + 0.7);
    sound.creak();
    sound.setDread(0.85);
    ui.flash('#3a0010', 0.5);
    if (!this.hidden) ui.toast('Сүүдэр ирлээ!! НУУГД!', 2600);
    await g.c.shadow.appear(from, r.center, 1.2);
  }

  private async search() {
    const g = this.g;
    this.phase = 'search';
    const r = g.c.world.rooms.get(this.room!)!;
    const av = g.c.avatar;
    const target = this.hidden ? r.center.clone().add(new THREE.Vector3(rand(-1, 1), 0, rand(-0.5, 1))) : av.position.clone().lerp(r.center, 0.25);
    void g.c.shadow.glideTo(target, this.hidden ? 2.4 : 1.2);
    if (this.hidden) {
      await this.runSearchQTE();
      return;
    }
    // Not hidden — a short grace beat, then it sees you.
    await new Promise((res) => setTimeout(res, 1100));
    if (this.hidden || this.phase !== 'search') return;
    await this.caught();
  }

  private async runSearchQTE() {
    if (this.qteRunning || !this.hidden) return;
    this.qteRunning = true;
    const g = this.g;
    const same = g.s.lastHide[this.room!] === this.hidden;
    const tutorial = !!this.scriptedDone;
    const hits = tutorial ? 2 : same ? 4 : 3;
    if (same && !tutorial) ui.toast('Сүүдэр яг энэ газрыг өмнө нь шалгаж байсан... Илүү тайван бай!', 3200);
    void g.c.shadow.lookAround(4);
    const ok = await this.qte(hits, tutorial ? 1.25 : same ? 0.85 : 1.0);
    this.qteRunning = false;
    if (this.phase !== 'search') return;
    if (ok) await this.survived();
    else await this.caught();
  }

  private async survived() {
    const g = this.g;
    const room = this.room!;
    g.s.lastHide[room] = this.hidden!;
    await g.c.shadow.vanish(1.4);
    const tutorial = this.scriptedDone;
    this.reset();
    this.t = this.gap();
    sound.success();
    ui.toast(tutorial ? 'Сүүдэр алга боллоо... Амьд үлдлээ. Энэ байшинд ганцаараа биш юм байна.' : 'Сүүдэр холдлоо. Амьд үлдлээ!', 4000);
    g.progress.stat('hides');
    g.progress.quest('hide');
    g.progress.award(PAY.hide.xp * (g.s.nightHunt ? 2 : 1), PAY.hide.coins * (g.s.nightHunt ? 2 : 1), 'Нуугдлаа');
    tutorial?.(true);
  }

  private async caught() {
    const g = this.g;
    const room = this.room!;
    this.hideOverlay();
    g.busy = true;
    sound.scream();
    ui.flash('#ff1a3a', 0.85);
    ui.jumpscare(true);
    g.shakeCamera(0.35, 1.0);
    g.c.avatar.knockdown();
    g.rgbGlitch(0.03, 1.4);
    await g.c.shadow.lunge(g.c.camera);
    await new Promise((res) => setTimeout(res, 650));
    ui.jumpscare(false);
    g.c.shadow.group.visible = false;
    const tutorial = this.scriptedDone;
    this.reset();
    g.busy = false;
    this.t = this.gap() * 1.2;
    if (tutorial) {
      tutorial(false);
      return;
    }
    g.s.everCaught = true;
    g.progress.stat('caught');
    const lost = g.loseOne(room);
    g.save();
    ui.toast(lost ? `Сүүдэрт баригдлаа! ${lost}` : 'Сүүдэрт баригдлаа! Дараагийн удаа хурдан нуугд.', 5000);
  }

  // ------------------------------------------------------------------ overlay + rhythm QTE
  private showOverlay(title: string, sub: string) {
    this.overlay.hidden = false;
    this.overlay.innerHTML = '<div class="slats"></div><div class="hide-box"><b></b><small></small><div class="qte"></div></div>';
    (this.overlay.querySelector('b') as HTMLElement).textContent = title;
    (this.overlay.querySelector('small') as HTMLElement).textContent = sub;
    gsap.fromTo(this.overlay, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  }

  private hideOverlay() {
    if (this.overlay.hidden) return;
    gsap.to(this.overlay, { opacity: 0, duration: 0.4, onComplete: () => { this.overlay.hidden = true; this.overlay.replaceChildren(); } });
  }

  /** A pulse ring shrinks toward the heart; tap (or Space) as it touches it. */
  private qte(hits: number, speed: number): Promise<boolean> {
    return new Promise((resolve) => {
      const box = this.overlay.querySelector('.qte') as HTMLElement;
      const sub = this.overlay.querySelector('small') as HTMLElement;
      sub.textContent = 'Цагираг зүрхэнд хүрэх мөчид дар (эсвэл Space) — зүрхээ тайвшруул!';
      box.innerHTML = '<div class="qte-heart">♥</div><div class="qte-ring"></div><div class="qte-dots"></div>';
      const ring = box.querySelector('.qte-ring') as HTMLElement;
      const dots = box.querySelector('.qte-dots') as HTMLElement;
      for (let i = 0; i < hits; i++) dots.append(h('i'));
      let got = 0, miss = 0, k = 1, raf = 0, last = performance.now(), done = false, cool = 0;
      const end = (ok: boolean) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
        this.overlay.removeEventListener('pointerdown', onTap);
        resolve(ok);
      };
      const frame = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        cool = Math.max(0, cool - dt);
        k -= dt * speed * 0.9;
        if (k < 0.12) {
          // passed the heart without a tap
          miss++;
          sound.heartbeat(0.6);
          box.classList.add('bad');
          setTimeout(() => box.classList.remove('bad'), 250);
          k = 1;
          if (miss >= 2) return end(false);
        }
        ring.style.transform = `translate(-50%,-50%) scale(${0.35 + k * 1.6})`;
        ring.style.opacity = String(0.4 + (1 - k) * 0.6);
        raf = requestAnimationFrame(frame);
      };
      const tap = () => {
        if (done || cool > 0) return;
        cool = 0.15;
        if (k < 0.42 && k > 0.12) {
          got++;
          sound.heartbeat(0.25);
          dots.children[got - 1]?.classList.add('on');
          box.classList.add('good');
          setTimeout(() => box.classList.remove('good'), 200);
          k = 1;
          if (got >= hits) end(true);
        } else {
          miss++;
          sound.error();
          box.classList.add('bad');
          setTimeout(() => box.classList.remove('bad'), 250);
          if (miss >= 2) end(false);
        }
      };
      const onTap = (e: Event) => { e.preventDefault(); tap(); };
      const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); tap(); } };
      window.addEventListener('keydown', onKey);
      this.overlay.addEventListener('pointerdown', onTap);
      raf = requestAnimationFrame(frame);
    });
  }
}
