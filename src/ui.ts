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

  setQuest(step: number, total: number, title: string, sub: string, slots: number, letters: string[]) {
    $('quest-step').textContent = `${Math.min(step, total)}/${total}`;
    $('quest-title').textContent = title;
    $('quest-sub').textContent = sub;
    const tray = $('tray');
    tray.replaceChildren();
    tray.hidden = slots === 0;
    for (let i = 0; i < slots; i++) {
      const s = h('span', { class: 'slot' + (letters[i] ? ' filled' : '') }, letters[i] ?? '');
      tray.append(s);
    }
    gsap.fromTo('#quest', { scale: 0.97 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  nextSlotRect(): DOMRect | null {
    const el = document.querySelector('#tray .slot:not(.filled)');
    return el ? el.getBoundingClientRect() : null;
  }

  setCounter(n: number, total: number) {
    $('counter-n').textContent = String(n);
    $('counter-t').textContent = String(total);
    gsap.fromTo('#counter', { scale: 1.15 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
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

  achievement(title: string, desc: string) {
    const el = h('div', { class: 'ach' });
    el.innerHTML = `<div class="ach-icon">${icon('trophy', 22)}</div>`;
    el.append(h('div', { class: 'ach-text' }, h('small', {}, 'Амжилт нээгдлээ!'), h('b', {}, title), h('span', {}, desc)));
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
    gsap.fromTo(panel, { y: 30, scale: 0.92, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' });
    const focusable = panel.querySelector<HTMLElement>('input, button.btn-primary');
    focusable?.focus();
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
