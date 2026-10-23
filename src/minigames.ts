import gsap from 'gsap';
import { ui } from './ui';
import { h, sleep, pick } from './util';
import { sound } from './audio';

/** Runs `cb` once `el` is actually on screen (modals can be queued). */
function whenShown(el: HTMLElement, cb: () => void) {
  const go = () => setTimeout(cb, 420);
  if (el.isConnected) return go();
  const obs = new MutationObserver(() => {
    if (el.isConnected) {
      obs.disconnect();
      go();
    }
  });
  obs.observe(document.getElementById('modal')!, { childList: true, subtree: true });
}

// --------------------------------------------------------------------------- keypad
export function runKeypad(o: { title: string; hint: string; length: number; check: (code: string) => boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    let solved = false;
    const el = h('div', { class: 'keypad' });
    const disp = h('div', { class: 'kp-display' });
    const msg = h('p', { class: 'muted small kp-msg' }, o.hint);
    let code = '';
    const render = () => {
      disp.replaceChildren(...Array.from({ length: o.length }, (_, i) => h('span', { class: code[i] ? 'on' : '' }, code[i] ?? '•')));
    };
    render();
    const grid = h('div', { class: 'kp-grid' });
    const press = (k: string) => {
      if (solved) return;
      sound.tick();
      if (k === '⌫') code = code.slice(0, -1);
      else if (code.length < o.length) code += k;
      render();
      if (code.length === o.length) {
        if (o.check(code)) {
          solved = true;
          sound.unlock();
          el.classList.add('ok');
          msg.textContent = 'НЭЭГДЛЭЭ!';
          setTimeout(() => ui.closeModal(), 700);
        } else {
          sound.error();
          gsap.fromTo(disp, { x: -10 }, { x: 0, duration: 0.45, ease: 'elastic.out(1.2, 0.25)' });
          msg.textContent = pick(['Буруу код.', 'Үгүй ээ... дахин нэг бод.', 'Түгжээ хөдлөхгүй байна.']);
          setTimeout(() => { code = ''; render(); }, 450);
        }
      }
    };
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0']) {
      const b = h('button', { class: 'kp-key' }, k);
      b.addEventListener('click', () => press(k));
      grid.append(b);
    }
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
    };
    window.addEventListener('keydown', onKey);
    el.append(h('p', { class: 'eyebrow' }, 'Кодтой түгжээ'), h('h3', { class: 'kp-title' }, o.title), disp, msg, grid);
    ui.openModal(el, { className: 'modal-keypad', onClose: () => { window.removeEventListener('keydown', onKey); resolve(solved); } });
  });
}

// --------------------------------------------------------------------------- melody (Simon)
const NOTE_COLS = ['#ff7eb6', '#ffd36b', '#7df9ff', '#b388ff'];

export function runMelody(len: number): Promise<boolean> {
  return new Promise((resolve) => {
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
    let pos = 0, done = false, listening = false;
    const el = h('div', { class: 'melody' });
    const info = h('p', { class: 'muted small' }, 'Пянз тоглуулагч аялгуу тоглоно. Сонсоод яг адилхан давт.');
    const dots = h('div', { class: 'mem-dots' });
    for (let i = 0; i < len; i++) dots.append(h('i'));
    const pads = h('div', { class: 'mel-pads' });
    const btns = NOTE_COLS.map((c, i) => {
      const b = h('button', { class: 'mel-pad', style: `--c:${c}`, 'aria-label': `Нот ${i + 1}` });
      b.addEventListener('click', () => {
        if (!listening || done) return;
        flash(i);
        if (seq[pos] === i) {
          dots.children[pos].classList.add('on');
          pos++;
          if (pos === len) finish(true);
        } else finish(false);
      });
      pads.append(b);
      return b;
    });
    const flash = (i: number) => {
      sound.note(i);
      btns[i].classList.add('lit');
      setTimeout(() => btns[i].classList.remove('lit'), 260);
    };
    const finish = (ok: boolean) => {
      done = true;
      if (ok) sound.success(); else sound.error();
      el.classList.add(ok ? 'won' : 'lost');
      info.textContent = ok ? 'Төгс! Пянз баярласандаа эргэлдэж байна.' : 'Хуурамч нот... Дахиад сонсоод үз.';
      setTimeout(() => { ui.closeModal(); resolve(ok); }, ok ? 900 : 1300);
    };
    const give = h('button', { class: 'btn-ghost ch-give' }, 'Дараа');
    give.addEventListener('click', () => { if (!done) { done = true; ui.closeModal(); resolve(false); } });
    el.append(h('p', { class: 'eyebrow' }, 'Аялгууны оньсого'), h('h3', { class: 'kp-title' }, 'Пянз тоглуулагч'), info, dots, pads, give);
    ui.openModal(el, { className: 'modal-challenge', closable: false });
    whenShown(el, async () => {
      for (const n of seq) {
        if (done) return;
        flash(n);
        await sleep(560);
      }
      listening = true;
      info.textContent = 'Одоо чиний ээлж!';
    });
  });
}

// --------------------------------------------------------------------------- cooking (timing bar)
export function runCooking(): Promise<{ ok: boolean; perfect: boolean }> {
  return new Promise((resolve) => {
    const el = h('div', { class: 'cook' });
    const bar = h('div', { class: 'cook-bar' });
    const zone = h('i', { class: 'cook-zone' });
    const needle = h('b', { class: 'cook-needle' });
    bar.append(zone, needle);
    const pancakes = h('div', { class: 'cook-stack' });
    const info = h('p', { class: 'muted small' }, 'Зүү ногоон бүсэд орох яг тэр мөчид «Эргүүл!» дар. 3 бин хэрэгтэй.');
    const btn = h('button', { class: 'btn-primary big' }, 'Эргүүл!');
    el.append(h('p', { class: 'eyebrow' }, 'Мочигийн бин'), h('h3', { class: 'kp-title' }, 'Тогоонд бин шарах'), pancakes, bar, info, btn);
    let round = 0, misses = 0, x = 0, dir = 1, raf = 0, last = 0, done = false;
    let zoneL = 0.4, zoneW = 0.24;
    const place = () => {
      zoneW = [0.26, 0.2, 0.15][round] ?? 0.15;
      zoneL = 0.1 + Math.random() * (0.8 - zoneW);
      zone.style.left = `${zoneL * 100}%`;
      zone.style.width = `${zoneW * 100}%`;
    };
    place();
    const speed = () => 0.7 + round * 0.3;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      x += dir * dt * speed();
      if (x > 1) { x = 1; dir = -1; }
      if (x < 0) { x = 0; dir = 1; }
      needle.style.left = `${x * 100}%`;
      if (!done) raf = requestAnimationFrame(loop);
    };
    const flip = () => {
      if (done) return;
      const hit = x >= zoneL && x <= zoneL + zoneW;
      if (hit) {
        sound.sizzle();
        sound.pop();
        round++;
        pancakes.append(h('span', { class: 'pc' }));
        gsap.fromTo(pancakes.lastElementChild, { y: -40, rotate: 180 }, { y: 0, rotate: 0, duration: 0.5, ease: 'bounce.out' });
        if (round === 3) {
          done = true;
          cancelAnimationFrame(raf);
          info.textContent = misses ? 'Бэлэн! Бага зэрэг түлэгдсэн ч амттай.' : 'ТӨГС! Алтан шаргал бин!';
          sound.success();
          setTimeout(() => { ui.closeModal(); resolve({ ok: true, perfect: misses === 0 }); }, 1100);
          return;
        }
        place();
      } else {
        misses++;
        sound.error();
        gsap.fromTo(bar, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.25)' });
        info.textContent = misses >= 3 ? 'Бин түлэгдчихлээ... Дахиад оролдоё.' : 'Эрт/хоцорлоо! Дахиад.';
        if (misses >= 3) {
          done = true;
          cancelAnimationFrame(raf);
          setTimeout(() => { ui.closeModal(); resolve({ ok: false, perfect: false }); }, 1100);
        }
      }
    };
    btn.addEventListener('click', flip);
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); flip(); } };
    window.addEventListener('keydown', onKey);
    ui.openModal(el, { className: 'modal-challenge', closable: false, onClose: () => window.removeEventListener('keydown', onKey) });
    whenShown(el, () => { last = performance.now(); raf = requestAnimationFrame(loop); });
  });
}

// --------------------------------------------------------------------------- constellation
export function runConstellation(stars: [number, number][]): Promise<boolean> {
  return new Promise((resolve) => {
    const el = h('div', { class: 'stars-game' });
    const cv = h('canvas', { class: 'stars-canvas' });
    const W = 360, H = 300;
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d')!;
    const info = h('p', { class: 'muted small' }, 'Газрын зураг дээр харсан Мочигийн одыг сана. Оддыг зөв дарааллаар холбо.');
    el.append(h('p', { class: 'eyebrow' }, 'Дуран'), h('h3', { class: 'kp-title' }, 'Мочигийн од'), cv, info);
    const pts = stars.map(([x, y]) => ({ x: 40 + x * (W - 80), y: H - 30 - y * (H - 60) }));
    // decoy stars
    const decoys = Array.from({ length: 14 }, () => ({ x: 20 + Math.random() * (W - 40), y: 20 + Math.random() * (H - 40) }))
      .filter((d) => pts.every((p) => Math.hypot(p.x - d.x, p.y - d.y) > 34));
    const bg = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, a: Math.random() }));
    let idx = 0, ghost = 1, done = false, raf = 0, wrongFlash = 0;
    const draw = (t: number) => {
      ctx.fillStyle = '#0b0820';
      ctx.fillRect(0, 0, W, H);
      for (const b of bg) {
        ctx.fillStyle = `rgba(255,255,255,${b.a * (0.5 + 0.5 * Math.sin(t / 600 + b.x))})`;
        ctx.fillRect(b.x, b.y, 1.5, 1.5);
      }
      if (ghost > 0) {
        ctx.strokeStyle = `rgba(255,211,107,${ghost * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
      }
      ctx.strokeStyle = '#ffd36b';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd36b';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < idx; i++) (i ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y));
      if (idx === pts.length) ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
      for (const d of decoys) {
        ctx.fillStyle = '#cfd8ff';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      pts.forEach((p, i) => {
        ctx.fillStyle = i < idx ? '#ffd36b' : '#cfd8ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, i === 0 && idx === 0 ? 6 + Math.sin(t / 200) * 1.5 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
      if (wrongFlash > 0) {
        ctx.fillStyle = `rgba(255,59,92,${wrongFlash * 0.25})`;
        ctx.fillRect(0, 0, W, H);
        wrongFlash = Math.max(0, wrongFlash - 0.05);
      }
      if (!done) raf = requestAnimationFrame(draw);
    };
    cv.addEventListener('pointerdown', (e) => {
      if (done) return;
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      const hit = [...pts, ...decoys].find((p) => Math.hypot(p.x - x, p.y - y) < 18);
      if (!hit) return;
      if (hit === pts[idx]) {
        idx++;
        sound.note(idx % 4);
        if (idx === pts.length) {
          done = true;
          sound.legendary();
          info.textContent = 'Мочигийн од гэрэлтлээ!';
          draw(performance.now());
          setTimeout(() => { ui.closeModal(); resolve(true); }, 1500);
        }
      } else if (pts.indexOf(hit) >= 0 && pts.indexOf(hit) < idx) {
        /* already-linked star — ignore */
      } else {
        sound.error();
        idx = 0;
        wrongFlash = 1;
        ghost = 0.8;
        gsap.to({ v: 0 }, { v: 1, duration: 1.8, onUpdate() { ghost = 0.8 * (1 - this.progress()); } });
        info.textContent = 'Буруу од! Хэлбэр нь хэсэгхэн гэрэлтэх үед дахин хар.';
      }
    });
    const give = h('button', { class: 'btn-ghost ch-give' }, 'Дараа');
    give.addEventListener('click', () => { if (!done) { done = true; cancelAnimationFrame(raf); ui.closeModal(); resolve(false); } });
    el.append(give);
    ui.openModal(el, { className: 'modal-stars', closable: false });
    whenShown(el, () => {
      raf = requestAnimationFrame(draw);
      gsap.to({ v: 0 }, { v: 1, duration: 3.2, delay: 0.6, onUpdate() { ghost = 1 - this.progress(); } });
    });
  });
}

// --------------------------------------------------------------------------- word entry
export interface WordPanelOpts {
  eyebrow: string;
  title: string;
  clue: string;
  letters: string[];
  total: number;
  /** Return a message to show; `true` closes the panel as solved. */
  submit: (word: string) => true | string;
}

export function runWordPanel(o: WordPanelOpts): Promise<boolean> {
  return new Promise((resolve) => {
    let solved = false;
    const el = h('div', { class: 'wordpanel' });
    const tiles = h('div', { class: 'wp-tiles' });
    for (let i = 0; i < o.total; i++) tiles.append(h('span', { class: o.letters[i] ? 'on' : '' }, o.letters[i] ?? '?'));
    const form = h('form', { class: 'wp-form' });
    const input = h('input', { class: 'pixel-in', maxlength: String(o.total + 2), autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Үг' });
    const btn = h('button', { class: 'btn-primary', type: 'submit' }, 'Шалгах');
    const msg = h('p', { class: 'muted small wp-msg' });
    form.append(input, btn);
    el.append(h('p', { class: 'eyebrow' }, o.eyebrow), h('h3', { class: 'kp-title' }, o.title), h('p', { class: 'wp-clue' }, `«${o.clue}»`), tiles, form, msg);
    if (o.letters.length < o.total) {
      input.disabled = true;
      btn.disabled = true;
      msg.textContent = `Эхлээд бүх үсгээ ол (${o.letters.length}/${o.total}).`;
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim().toUpperCase();
      if (!v) return;
      const r = o.submit(v);
      if (r === true) {
        solved = true;
        sound.success();
        el.classList.add('ok');
        msg.textContent = 'ЗӨВ!';
        input.disabled = true;
        setTimeout(() => ui.closeModal(), 900);
      } else {
        sound.error();
        msg.textContent = r;
        gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.25)' });
        input.select();
      }
    });
    ui.openModal(el, { className: 'modal-word', onClose: () => resolve(solved) });
  });
}
