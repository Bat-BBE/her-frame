import gsap from 'gsap';
import { h } from './util';
import type { CardColor, Shape } from './data';

export const ICONS: Record<string, string> = {
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  gamepad: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v5M4.5 12.5h5"/><circle cx="16" cy="11" r="1"/><circle cx="18" cy="14" r="1"/>',
  book: '<path d="M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z"/>',
  plant: '<path d="M12 20v-8M12 12c0-4 3-7 7-7 0 4-3 7-7 7zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/><path d="M7 20h10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lamp: '<path d="M8 3h8l3 7H5zM12 10v9M8 21h8"/>',
  rug: '<ellipse cx="12" cy="12" rx="9" ry="6"/><ellipse cx="12" cy="12" rx="5" ry="3"/>',
  window: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/>',
  chair: '<path d="M5 14c0-4 3-7 7-7s7 3 7 7v3H5z"/><path d="M5 17v3M19 17v3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  cloud: '<path d="M7 18h10a4 4 0 000-8 6 6 0 00-11.5 1.5A3.5 3.5 0 007 18z"/>',
  mug: '<path d="M4 8h12v8a4 4 0 01-4 4H8a4 4 0 01-4-4zM16 10h2a2 2 0 010 4h-2"/><path d="M8 2v3M12 2v3"/>',
  ghost: '<path d="M5 21V10a7 7 0 0114 0v11l-2.5-2-2.5 2-2-2-2 2-2.5-2z"/><circle cx="9.5" cy="10" r="1"/><circle cx="14.5" cy="10" r="1"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  cube: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="4"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  mute: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M23 9l-6 6M17 9l6 6"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 00-3-3H10v1"/><circle cx="7" cy="10.5" r="1.8"/>',
  door: '<path d="M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17M4 21h16"/><circle cx="14.5" cy="12" r="1"/>',
  tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 3l4 3 4-3M8 21h8"/>',
  fire: '<path d="M12 21c4 0 7-3 7-7 0-5-5-7-5-11-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 8 0 4 3 7 7 7z"/>',
  sofa: '<path d="M4 11V8a3 3 0 013-3h10a3 3 0 013 3v3M2 13a2 2 0 014 0v2h12v-2a2 2 0 014 0v5H2zM5 18v2M19 18v2"/>',
  pot: '<path d="M4 10h16v6a4 4 0 01-4 4H8a4 4 0 01-4-4zM2 10h20M9 6c0-1 1-2 1-3M14 6c0-1 1-2 1-3"/>',
  fridge: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M8 5v2M8 13v3"/>',
  drop: '<path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z"/>',
  bath: '<path d="M3 12h18v3a5 5 0 01-5 5H8a5 5 0 01-5-5zM6 12V5a2 2 0 014 0M7 20l-1 2M17 20l1 2"/>',
  mirror: '<ellipse cx="12" cy="10" rx="6" ry="8"/><path d="M12 18v4M8 22h8M9 7l3-2"/>',
  washer: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M7 5h2"/>',
  telescope: '<path d="M4 14l12-6 2 4-12 6zM16 8l3-1 1 3-2 2M9 17l-3 5M11 16l3 6"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  tree: '<path d="M12 22v-6M7 16a5 5 0 01-1-9 6 6 0 0112-1 5 5 0 01-1 10z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
  duck: '<path d="M4 14c0 4 3 6 8 6s8-2 8-6c-2 1-4 1-6 0 2-2 2-6-1-7-3-1-5 2-4 5-2 0-4 0-5 2z"/><path d="M17 8l3 1-3 1"/>',
  jar: '<path d="M7 4h10v3H7zM6 7h12v11a3 3 0 01-3 3H9a3 3 0 01-3-3z"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 016 0v2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  home: '<path d="M3 11l9-8 9 8M5 9v12h14V9"/><path d="M10 21v-6h4v6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  badge: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
};

export const icon = (name: string, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

const SHAPE_SVG: Record<Shape, string> = {
  sock: '<path d="M18 6h12v18l8 8a6 6 0 01-8 8l-12-12z"/><rect x="18" y="6" width="12" height="5" fill="#fff" opacity=".5"/>',
  box: '<rect x="8" y="16" width="32" height="22" rx="2"/><path d="M8 16l6-8h20l6 8z" opacity=".75"/>',
  key: '<circle cx="15" cy="24" r="8"/><circle cx="15" cy="24" r="3" fill="#1a1433"/><rect x="21" y="22" width="20" height="5" rx="2"/><rect x="33" y="26" width="4" height="7"/>',
  duck: '<ellipse cx="22" cy="31" rx="15" ry="9"/><circle cx="31" cy="17" r="8"/><path d="M38 17l7 2-7 3z" fill="#ff9a3c"/><circle cx="33" cy="15" r="1.6" fill="#1a1433"/>',
  chip: '<path d="M8 30C10 16 26 8 40 12c-2 14-18 22-32 18z"/>',
  dust: '<circle cx="16" cy="26" r="7"/><circle cx="28" cy="22" r="9"/><circle cx="34" cy="31" r="6"/><circle cx="22" cy="33" r="6"/>',
  mushroom: '<path d="M6 24a18 14 0 0136 0z"/><rect x="18" y="24" width="12" height="16" rx="4" fill="#f4ecff"/><circle cx="16" cy="17" r="2.5" fill="#fff"/><circle cx="29" cy="14" r="3" fill="#fff"/>',
  cloud: '<path d="M14 34h22a8 8 0 000-16 11 11 0 00-21 3 7 7 0 00-1 13z"/>',
  meteor: '<circle cx="30" cy="18" r="9"/><path d="M23 24L6 41M26 28L12 42M20 21L5 33" stroke-width="3" stroke-linecap="round" opacity=".6" stroke="currentColor"/>',
  cactus: '<rect x="20" y="8" width="9" height="30" rx="4.5"/><rect x="10" y="16" width="7" height="12" rx="3.5"/><rect x="32" y="12" width="7" height="12" rx="3.5"/><rect x="14" y="36" width="20" height="7" rx="2" fill="#ff8fb1"/>',
  hourglass: '<path d="M12 6h24M12 42h24M14 6c0 10 10 12 10 18s-10 8-10 18M34 6c0 10-10 12-10 18s10 8 10 18" stroke="currentColor" stroke-width="3" fill="none"/><path d="M17 38c3-5 11-5 14 0z"/>',
  crown: '<path d="M6 36l4-22 10 10 4-14 4 14 10-10 4 22z"/><rect x="6" y="36" width="36" height="5" rx="1"/>',
  tesseract: '<rect x="8" y="8" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="16" y="15" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".7"/><path d="M8 8l8 7M34 8l6 7M8 34l8 5M34 34l6 5" stroke="currentColor" stroke-width="2.5"/>',
  teddy: '<circle cx="14" cy="12" r="6"/><circle cx="34" cy="12" r="6"/><circle cx="24" cy="20" r="11"/><ellipse cx="24" cy="36" rx="12" ry="10"/><circle cx="20" cy="18" r="1.6" fill="#1a1433"/><circle cx="28" cy="18" r="1.6" fill="#1a1433"/><ellipse cx="24" cy="24" rx="4" ry="3" fill="#f4dcc0"/>',
  jar: '<rect x="15" y="6" width="18" height="6" rx="2" opacity=".7"/><path d="M12 14h24v24a6 6 0 01-6 6H18a6 6 0 01-6-6z" opacity=".55"/><circle cx="22" cy="28" r="3" fill="#fff"/><circle cx="29" cy="22" r="2" fill="#fff"/><circle cx="27" cy="34" r="1.6" fill="#fff"/>',
  remote: '<rect x="16" y="4" width="16" height="40" rx="6"/><circle cx="24" cy="12" r="3" fill="#ff5f7a"/><rect x="20" y="20" width="3" height="3" fill="#1a1433"/><rect x="25" y="20" width="3" height="3" fill="#1a1433"/><rect x="20" y="26" width="3" height="3" fill="#1a1433"/><rect x="25" y="26" width="3" height="3" fill="#1a1433"/>',
  vinyl: '<circle cx="24" cy="24" r="19" fill="#1a1433"/><circle cx="24" cy="24" r="15" fill="none" stroke="#3a3260" stroke-width="1.5"/><circle cx="24" cy="24" r="8"/><circle cx="24" cy="24" r="2" fill="#1a1433"/>',
  cookie: '<circle cx="24" cy="24" r="18"/><circle cx="17" cy="18" r="3" fill="#4a2c1a"/><circle cx="29" cy="16" r="2.5" fill="#4a2c1a"/><circle cx="30" cy="29" r="3" fill="#4a2c1a"/><circle cx="19" cy="31" r="2.5" fill="#4a2c1a"/>',
  egg: '<path d="M24 5c8 0 14 13 14 23a14 14 0 01-28 0C10 18 16 5 24 5z"/><path d="M18 16c2-4 5-6 7-6" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>',
  spoon: '<ellipse cx="24" cy="13" rx="8" ry="10"/><rect x="22" y="21" width="4" height="23" rx="2"/>',
  soap: '<rect x="8" y="18" width="32" height="18" rx="8"/><circle cx="16" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="34" cy="13" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/>',
  shell: '<path d="M24 40L6 22a18 14 0 0136 0z"/><path d="M24 40L14 14M24 40V10M24 40l10-26" stroke="#fff" stroke-width="1.8" opacity=".55"/>',
  bubble: '<circle cx="24" cy="24" r="17" opacity=".45"/><circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M15 17a10 10 0 018-5" stroke="#fff" stroke-width="3" fill="none"/>',
  compass: '<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="14" fill="#1a1433"/><path d="M24 12l4 12-4 12-4-12z" fill="#ff5f7a"/><path d="M24 24l4 0-4 12-4-12z" fill="#fff"/>',
  map: '<path d="M6 10l11-4 14 4 11-4v32l-11 4-14-4-11 4z"/><path d="M14 18l5 6 7-3 6 7" stroke="#1a1433" stroke-width="2" fill="none" stroke-dasharray="3 2"/><circle cx="32" cy="28" r="2.5" fill="#ff5f7a"/>',
  star: '<path d="M24 4l6 13 14 2-10 10 2 14-12-7-12 7 2-14L4 19l14-2z"/>',
};

export const shapeSvg = (shape: Shape, color: string, size = 56) =>
  `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="${color}" style="color:${color}" aria-hidden="true">${SHAPE_SVG[shape]}</svg>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

interface ModalReq { el: HTMLElement; className?: string; onClose?: () => void; closable: boolean }

class UI {
  private card = $('card');
  private cardLine = $('card-line') as unknown as SVGSVGElement;
  private tooltipEl = $('tooltip');
  private modalRoot = $('modal');
  private modalQueue: ModalReq[] = [];
  private current: ModalReq | null = null;
  private cardTimer = 0;
  cardVisible = false;
  private lastQuest = '';
  private lastFilled = 0;
  onCardClose?: () => void;

  constructor() {
    this.modalRoot.addEventListener('pointerdown', (e) => {
      if (e.target === this.modalRoot && this.current?.closable) this.closeModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.current?.closable) this.closeModal();
    });
  }

  get modalOpen() { return this.current !== null; }

  setQuest(q: { room: string; tag: string; title: string; sub: string; slots: number; letters: string[]; done: boolean; inventory: string[] }) {
    const stepEl = $('quest-step');
    stepEl.textContent = q.done ? '✓ ДУУССАН' : q.room;
    stepEl.classList.toggle('done', q.done);
    $('quest').classList.toggle('done', q.done);
    const lvlEl = $('quest-level');
    lvlEl.textContent = q.tag ? q.tag.toUpperCase() : '';
    lvlEl.dataset.tag = q.tag.toLowerCase();
    lvlEl.hidden = !q.tag;
    $('quest-title').textContent = q.title;
    $('quest-sub').textContent = q.sub;
    const tray = $('tray');
    tray.replaceChildren();
    tray.hidden = q.slots === 0;
    tray.classList.toggle('many', q.slots > 6);
    const key = q.room + q.title;
    const prev = key === this.lastQuest ? this.lastFilled : 0;
    for (let i = 0; i < q.slots; i++) {
      const sl = h('span', { class: 'slot' + (q.letters[i] ? ' filled' : '') + (q.letters[i] && i >= prev ? ' pop' : '') }, q.letters[i] ?? '');
      tray.append(sl);
    }
    const inv = $('inventory');
    inv.replaceChildren(...q.inventory.map((t) => h('span', { class: 'inv-chip' }, t)));
    inv.hidden = q.inventory.length === 0;
    if (key !== this.lastQuest) gsap.fromTo('#quest', { scale: 0.94 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    this.lastQuest = key;
    this.lastFilled = q.letters.filter(Boolean).length;
  }

  /** Top-right player card: level ring, title, XP bar, coins, streak. */
  setPlayer(p: { level: number; title: string; xpInto: number; xpNeed: number; coins: number; streak: number; daily: number }) {
    $('pc-level').textContent = String(p.level);
    $('pc-title').textContent = p.title;
    $('pc-xp').style.width = `${Math.min(100, (p.xpInto / Math.max(1, p.xpNeed)) * 100)}%`;
    $('pc-xptext').textContent = `${p.xpInto} / ${p.xpNeed} XP`;
    $('pc-coins').textContent = String(p.coins);
    $('pc-streak').textContent = String(p.streak);
    document.querySelector('[data-action="daily"]')?.classList.toggle('ping', p.daily > 0);
  }

  /** Floating "+XP / +coins" pill under the player card. */
  gain(xp: number, coins: number, label?: string) {
    const parts = [label ?? '', xp ? `+${xp} XP` : '', coins ? `${coins > 0 ? '+' : ''}${coins} ✦` : ''].filter(Boolean);
    const el = h('div', { class: 'gain' }, parts.join(' · '));
    $('gains').append(el);
    gsap.fromTo(el, { y: 12, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' });
    gsap.to(el, { y: -16, opacity: 0, delay: 2.2, duration: 0.4, onComplete: () => el.remove() });
    gsap.fromTo('#player', { scale: 1.05 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
  }

  levelUp(level: number, title: string, bonus: number, newTitle: boolean) {
    const el = h('div', { class: 'levelup' });
    el.append(h('small', {}, 'ТҮВШИН АХИЛАА'), h('b', {}, String(level)), h('span', {}, newTitle ? `Шинэ цол: ${title}` : title), h('em', {}, `+${bonus} ✦`));
    document.body.append(el);
    gsap.timeline({ onComplete: () => el.remove() })
      .fromTo(el, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2.2)' })
      .to(el, { opacity: 0, y: -40, duration: 0.5, delay: 2.2 });
    this.flash('#ffd36b', 0.35);
  }

  /** Danger meter (0..1) shown while the Shadow is coming. */
  danger(k: number, label = '') {
    const el = $('danger');
    el.hidden = k <= 0;
    document.body.classList.toggle('dread', k > 0);
    if (k <= 0) return;
    $('danger-fill').style.width = `${k * 100}%`;
    $('danger-label').textContent = label;
    el.classList.toggle('hot', k > 0.85);
  }

  jumpscare(on: boolean) {
    document.body.classList.toggle('scared', on);
  }

  /** Room picker on the right: one chip per room. */
  setRooms(rooms: { id: string; name: string; icon: string; locked: boolean; done: boolean; active: boolean; danger: boolean }[], houseActive: boolean, onPick: (id: string | null) => void) {
    const nav = $('rooms');
    nav.replaceChildren();
    const house = h('button', { class: `room-chip${houseActive ? ' active' : ''}`, title: 'Бүх байшин' });
    house.innerHTML = `${icon('home', 18)}<span>Байшин</span>`;
    house.addEventListener('click', () => onPick(null));
    nav.append(house);
    for (const r of rooms) {
      const b = h('button', { class: `room-chip${r.active ? ' active' : ''}${r.locked ? ' locked' : ''}${r.done ? ' done' : ''}${r.danger ? ' danger' : ''}`, title: r.name });
      b.innerHTML = `${icon(r.locked ? 'lock' : r.icon, 18)}<span></span>${r.done ? '<i>✓</i>' : ''}`;
      (b.querySelector('span') as HTMLElement).textContent = r.name;
      b.addEventListener('click', () => onPick(r.id));
      nav.append(b);
    }
  }

  nextSlotRect(): DOMRect | null {
    const el = document.querySelector('#tray .slot:not(.filled)');
    return el ? el.getBoundingClientRect() : null;
  }

  flyLetter(letter: string, x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      const el = h('div', { class: 'fly-letter' }, letter);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      document.body.append(el);
      const r = this.nextSlotRect();
      const tx = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const ty = r ? r.top + r.height / 2 : 60;
      gsap.timeline({ onComplete: () => { el.remove(); resolve(); } })
        .fromTo(el, { scale: 0.3, opacity: 0 }, { scale: 1.4, opacity: 1, duration: 0.25, ease: 'back.out(3)' })
        .to(el, { left: tx, top: ty, scale: 1, duration: 0.75, ease: 'power3.inOut' })
        .to(el, { scale: 1.6, opacity: 0, duration: 0.2 });
    });
  }

  toast(msg: string, ms = 3400) {
    const el = h('div', { class: 'toast' }, msg);
    $('toasts').append(el);
    gsap.fromTo(el, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(2)' });
    gsap.to(el, { y: -10, opacity: 0, delay: ms / 1000, duration: 0.3, onComplete: () => el.remove() });
  }

  achievement(title: string, desc: string, emoji = '🏆', tier = 0) {
    const el = h('div', { class: `ach tier-${tier}` });
    el.append(h('div', { class: 'ach-icon' }, emoji));
    el.append(h('div', { class: 'ach-text' }, h('small', {}, tier ? 'Тэмдэг ахилаа!' : 'Тэмдэг нээгдлээ!'), h('b', {}, title), h('span', {}, desc)));
    $('ach-stack').append(el);
    gsap.fromTo(el, { x: 80, opacity: 0, scale: 0.8 }, { x: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' });
    gsap.to(el, { x: 80, opacity: 0, delay: 4.2, duration: 0.35, onComplete: () => el.remove() });
  }

  showCard(opts: { title: string; text: string; color: CardColor; icon: string }, ms = 6500) {
    const c = this.card;
    c.className = `card card-${opts.color}`;
    c.innerHTML = `<div class="card-head"><span class="card-icon">${icon(opts.icon, 22)}</span><b></b><button class="card-x" aria-label="Хаах">${icon('close', 16)}</button></div><p></p>`;
    (c.querySelector('b') as HTMLElement).textContent = opts.title;
    (c.querySelector('p') as HTMLElement).textContent = opts.text;
    c.querySelector('.card-x')!.addEventListener('click', () => this.hideCard());
    c.hidden = false;
    this.cardLine.style.display = 'block';
    this.cardVisible = true;
    gsap.fromTo(c, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2.5)' });
    clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => this.hideCard(), ms);
  }

  hideCard() {
    if (!this.cardVisible) return;
    this.cardVisible = false;
    clearTimeout(this.cardTimer);
    gsap.to(this.card, {
      scale: 0.9, opacity: 0, duration: 0.18,
      onComplete: () => { if (!this.cardVisible) { this.card.hidden = true; this.cardLine.style.display = 'none'; } },
    });
    this.onCardClose?.();
  }

  placeCard(ax: number, ay: number, onScreen: boolean) {
    if (!this.cardVisible) return;
    const c = this.card;
    const w = c.offsetWidth, hh = c.offsetHeight;
    const W = window.innerWidth, H = window.innerHeight;
    const mobile = W < 640;
    let x: number, y: number;
    if (mobile) {
      x = (W - w) / 2;
      y = Math.max(12, Math.min(ay - hh - 70, H - hh - 110));
      if (y < 130) y = Math.min(ay + 60, H - hh - 110);
    } else {
      x = ax + 60;
      y = ay - hh - 60;
      if (x + w > W - 16) x = ax - w - 60;
      if (y < 16) y = ay + 50;
      x = Math.max(16, Math.min(W - w - 16, x));
      y = Math.max(16, Math.min(H - hh - 100, y));
    }
    c.style.transform = `translate(${x}px, ${y}px)`;
    const cx = Math.max(x + 14, Math.min(x + w - 14, ax));
    const cy = ay < y ? y : ay > y + hh ? y + hh : y + hh / 2;
    const line = this.cardLine.querySelector('line')!;
    const dot = this.cardLine.querySelector('circle')!;
    line.setAttribute('x1', String(ax));
    line.setAttribute('y1', String(ay));
    line.setAttribute('x2', String(cx));
    line.setAttribute('y2', String(cy));
    dot.setAttribute('cx', String(ax));
    dot.setAttribute('cy', String(ay));
    this.cardLine.style.opacity = onScreen ? '1' : '0';
  }

  tooltip(text: string | null, x = 0, y = 0) {
    const t = this.tooltipEl;
    if (!text) {
      t.hidden = true;
      return;
    }
    t.hidden = false;
    t.textContent = text;
    t.style.transform = `translate(${x + 16}px, ${y + 14}px)`;
  }

  openModal(el: HTMLElement, opts: { className?: string; onClose?: () => void; closable?: boolean } = {}) {
    const req: ModalReq = { el, className: opts.className, onClose: opts.onClose, closable: opts.closable ?? true };
    if (this.current) this.modalQueue.push(req);
    else this.show(req);
  }

  private show(req: ModalReq) {
    this.current = req;
    const panel = h('div', { class: `modal ${req.className ?? ''}`, role: 'dialog', 'aria-modal': 'true' });
    if (req.closable) {
      const x = h('button', { class: 'modal-x', 'aria-label': 'Хаах' });
      x.innerHTML = icon('close', 18);
      x.addEventListener('click', () => this.closeModal());
      panel.append(x);
    }
    panel.append(req.el);
    this.modalRoot.replaceChildren(panel);
    this.modalRoot.classList.add('open');
    gsap.fromTo(this.modalRoot, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    const focusable = panel.querySelector<HTMLElement>('input, button.btn-primary');
    // Focus only once the panel has settled: focusing an <input> immediately pops the
    // on-screen keyboard on phones, which fights the open animation and shoves the
    // layout around mid-transition.
    gsap.fromTo(panel, { y: 30, scale: 0.92, opacity: 0 }, {
      y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)',
      onComplete: () => focusable?.focus({ preventScroll: true }),
    });
  }

  closeModal() {
    const req = this.current;
    if (!req) return;
    this.current = null;
    const root = this.modalRoot;
    gsap.to(root, {
      opacity: 0, duration: 0.2,
      onComplete: () => {
        root.classList.remove('open');
        root.replaceChildren();
        req.onClose?.();
        const next = this.modalQueue.shift();
        if (next) this.show(next);
      },
    });
  }

  flash(color = '#ffffff', strength = 0.8) {
    const f = $('flash');
    f.style.background = color;
    gsap.fromTo(f, { opacity: strength }, { opacity: 0, duration: 0.9, ease: 'power2.out' });
  }
}

export let ui: UI;
export const initUI = () => (ui = new UI());
