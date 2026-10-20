import gsap from 'gsap';
import { ui } from './ui';
import { h, pick, rand, sleep } from './util';
import { sound } from './audio';
import { RIDDLES, type Riddle } from './data';

export type ChallengeKind = 'riddle' | 'memory' | 'math';

export interface ChallengeResult {
  ok: boolean;
  kind: ChallengeKind;
  /** memory: sequence length; otherwise 1. */
  size: number;
}

export interface ChallengeOpts {
  kind: ChallengeKind;
  /** 0 = first extended level ... 6 = last. Drives every difficulty knob. */
  level: number;
  hard: boolean;
  title: string;
  riddle?: Riddle;
  noTimer?: boolean;
}

const LABEL: Record<ChallengeKind, string> = { riddle: 'Оньсого', memory: 'Санах ой', math: 'Тооцоо' };
const SYMBOLS = ['★', '▲', '●', '■', '◆', '♥', '✚', '☾'];
const recent: string[] = [];

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const int = (a: number, b: number) => Math.floor(rand(a, b + 1));

export function pickKind(level: number): ChallengeKind {
  const r = Math.random();
  const wMem = 0.2 + level * 0.04;
  const wMath = 0.2 + level * 0.03;
  return r < wMem ? 'memory' : r < wMem + wMath ? 'math' : 'riddle';
}

function pickRiddle(level: number): Riddle {
  const max = level < 2 ? 1 : level < 4 ? 2 : 3;
  const min = level >= 5 ? 2 : 1;
  const pool = RIDDLES.filter((r) => r.diff >= min && r.diff <= max);
  const fresh = pool.filter((r) => !recent.includes(r.q));
  const r = pick(fresh.length ? fresh : pool);
  recent.push(r.q);
  if (recent.length > 12) recent.shift();
  return r;
}

function makeMath(level: number) {
  if (level <= 1) {
    const a = int(12, 49), b = int(11, 48);
    return { text: `${a} + ${b}`, v: a + b };
  }
  if (level <= 3) {
    const a = int(3, 9), b = int(4, 12), c = int(5, 30);
    return { text: `${a} × ${b} + ${c}`, v: a * b + c };
  }
  if (level <= 5) {
    const a = int(4, 15), b = int(3, 12), c = int(2, 6), d = int(3, 20);
    return { text: `(${a} + ${b}) × ${c} − ${d}`, v: (a + b) * c - d };
  }
  const a = int(6, 14), b = int(5, 13), c = int(3, 9), d = int(3, 9);
  return { text: `${a} × ${b} − ${c} × ${d}`, v: a * b - c * d };
}

/** Runs once the modal is actually on screen (it may be queued behind another),
 *  so timers never tick down while the player can't see the question. */
function whenShown(el: HTMLElement, cb: () => void) {
  const go = () => setTimeout(cb, 450);
  if (el.isConnected) return go();
  const obs = new MutationObserver(() => {
    if (el.isConnected) {
      obs.disconnect();
      go();
    }
  });
  obs.observe(document.getElementById('modal')!, { childList: true, subtree: true });
}

export function runChallenge(o: ChallengeOpts): Promise<ChallengeResult> {
  return new Promise((resolve) => {
    const el = h('div', { class: 'challenge' });
    const body = h('div', { class: 'ch-body' });
    const timerBar = h('div', { class: 'ch-timer' }, h('i'));
    const giveUp = h('button', { class: 'btn-ghost ch-give' }, 'Бууж өгөх');
    let done = false;
    let timer: gsap.core.Tween | null = null;

    const finish = (ok: boolean, size: number) => {
      if (done) return;
      done = true;
      timer?.kill();
      if (ok) sound.success();
      else sound.error();
      el.classList.add(ok ? 'won' : 'lost');
      setTimeout(() => {
        ui.closeModal();
        resolve({ ok, kind: o.kind, size });
      }, ok ? 700 : 1100);
    };

    const startTimer = (sec: number) => {
      if (!sec || o.noTimer || done) {
        timerBar.hidden = true;
        return;
      }
      timerBar.hidden = false;
      timer = gsap.fromTo(timerBar.querySelector('i'), { scaleX: 1 }, { scaleX: 0, duration: sec, ease: 'none', onComplete: () => finish(false, 0) });
    };

    el.append(h('div', { class: 'ch-head' }, h('span', { class: 'ch-kind' }, LABEL[o.kind]), h('b', {}, o.title)), body);
    timerBar.hidden = true;
    giveUp.addEventListener('click', () => finish(false, 0));

    const choiceGrid = (options: string[], correct: string) => {
      const grid = h('div', { class: 'ch-opts' });
      for (const t of options) {
        const b = h('button', { class: 'ch-opt' }, t);
        b.addEventListener('click', () => {
          if (done) return;
          const ok = t === correct;
          b.classList.add(ok ? 'right' : 'wrong');
          if (!ok) grid.querySelectorAll('button').forEach((x) => { if (x.textContent === correct) x.classList.add('right'); });
          finish(ok, 1);
        });
        grid.append(b);
      }
      return grid;
    };

    let onShown: () => void = () => {};

    if (o.kind === 'riddle') {
      const r = o.riddle ?? pickRiddle(o.level);
      const answer = r.options[r.a];
      const n = o.riddle ? r.options.length : Math.min(r.options.length, o.level < 3 ? 3 : 4);
      const wrong = shuffle(r.options.filter((_, i) => i !== r.a)).slice(0, n - 1);
      body.append(h('p', { class: 'ch-q' }, r.q), choiceGrid(shuffle([answer, ...wrong]), answer));
      const sec = o.level >= 2 ? Math.max(9, 24 - o.level * 2 - (o.hard ? 4 : 0)) : 0;
      onShown = () => startTimer(sec);
    } else if (o.kind === 'math') {
      const { text, v } = makeMath(o.level);
      const set = new Set<number>([v]);
      for (const d of shuffle([1, -1, 2, -2, 10, -10, 3, -3, 5, -5])) {
        if (set.size >= 4) break;
        set.add(v + d);
      }
      body.append(
        h('p', { class: 'muted small' }, 'Толгойгоороо бод — хугацаа гүйж байна!'),
        h('p', { class: 'ch-math' }, `${text} = ?`),
        choiceGrid(shuffle([...set]).map(String), String(v)),
      );
      const sec = Math.max(7, 16 - o.level - (o.hard ? 3 : 0));
      onShown = () => startTimer(sec);
    } else {
      const len = Math.min(10, 3 + o.level + (o.hard ? 1 : 0));
      const syms = SYMBOLS.slice(0, o.level >= 4 ? 8 : 6);
      const seq = Array.from({ length: len }, () => pick(syms));
      const info = h('p', { class: 'muted small' }, `${len} тэмдгийн дарааллыг цээжил...`);
      const disp = h('div', { class: 'mem-display' }, '');
      const dots = h('div', { class: 'mem-dots' });
      for (let i = 0; i < len; i++) dots.append(h('i'));
      const grid = h('div', { class: 'mem-grid' });
      grid.style.gridTemplateColumns = `repeat(${syms.length > 6 ? 4 : 3}, 1fr)`;
      const btns = syms.map((s) => {
        const b = h('button', { class: 'mem-btn', disabled: 'true' }, s);
        grid.append(b);
        return b;
      });
      let pos = 0;
      btns.forEach((b, i) => b.addEventListener('click', () => {
        if (done) return;
        if (syms[i] === seq[pos]) {
          dots.children[pos].classList.add('on');
          sound.pop();
          pos++;
          if (pos === len) finish(true, len);
        } else {
          b.classList.add('wrong');
          disp.textContent = seq[pos];
          finish(false, len);
        }
      }));
      body.append(info, disp, dots, grid);
      const interval = Math.max(360, 780 - o.level * 55 - (o.hard ? 80 : 0));
      onShown = async () => {
        for (const s of seq) {
          if (done) return;
          disp.textContent = s;
          gsap.fromTo(disp, { scale: 0.6, opacity: 0.3 }, { scale: 1, opacity: 1, duration: 0.2 });
          sound.tick();
          await sleep(interval);
          disp.textContent = '';
          await sleep(140);
        }
        if (done) return;
        disp.textContent = '?';
        info.textContent = 'Одоо яг ижил дарааллаар дар!';
        btns.forEach((b) => b.removeAttribute('disabled'));
        startTimer(o.level >= 3 ? Math.ceil(len * 1.5 + 3 - (o.hard ? 2 : 0)) : 0);
      };
    }

    el.append(timerBar, giveUp);
    ui.openModal(el, { className: 'modal-challenge', closable: false });
    whenShown(el, () => onShown());
  });
}
