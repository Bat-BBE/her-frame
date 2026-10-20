import { sound } from './audio';

interface Item { x: number; y: number; vy: number; kind: 'star' | 'bug' | 'gold'; rot: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

export const GOAL = 12;
export const DURATION = 22;

/** Runs the Star Catcher mini-game on the given canvas. Returns a cleanup function.
 *  `onEnd`'s third argument is the seconds left on the clock when the round ended —
 *  the caller uses it to rank a win as bronze/silver/gold. */
export function runStarCatcher(canvas: HTMLCanvasElement, onEnd: (win: boolean, score: number, timeLeft: number) => void) {
  const W = 320, H = 420;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  let px = W / 2;
  let targetX = W / 2;
  let score = 0;
  let lives = 3;
  let time = DURATION;
  let countdown = 3;
  let spawn = 0;
  let over = false;
  let shake = 0;
  const items: Item[] = [];
  const sparks: Spark[] = [];
  const bg = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.5 }));
  const keys = new Set<string>();

  const toLocal = (clientX: number) => {
    const r = canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  };
  const onMove = (e: PointerEvent) => { targetX = toLocal(e.clientX); };
  const onKey = (e: KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) {
      e.preventDefault();
      if (e.type === 'keydown') keys.add(e.key.toLowerCase()); else keys.delete(e.key.toLowerCase());
    }
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onMove);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  const burst = (x: number, y: number, color: string, n = 12) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 120;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, color });
    }
  };

  const drawStar = (x: number, y: number, r: number, rot: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawBug = (x: number, y: number, t: number) => {
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(x - 11, y - 9, 22, 18);
    ctx.fillStyle = '#ff7a90';
    ctx.fillRect(x - 11 + Math.sin(t * 20) * 2, y - 9, 6, 6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 7, y - 4, 5, 5);
    ctx.fillRect(x + 2, y - 4, 5, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 5, y - 2, 2, 2);
    ctx.fillRect(x + 4, y - 2, 2, 2);
    ctx.fillStyle = '#ff3b5c';
    for (const s of [-1, 1]) {
      ctx.fillRect(x + s * 13 - 2, y - 6 + Math.sin(t * 25) * 2, 4, 3);
      ctx.fillRect(x + s * 13 - 2, y + 2 - Math.sin(t * 25) * 2, 4, 3);
    }
  };

  const drawShip = (x: number, t: number) => {
    const y = H - 42;
    ctx.fillStyle = '#7df9ff';
    ctx.fillRect(x - 26, y, 52, 10);
    ctx.fillStyle = '#4fc3ff';
    ctx.fillRect(x - 18, y - 8, 36, 8);
    ctx.fillStyle = '#c8f7ff';
    ctx.fillRect(x - 9, y - 16, 18, 9);
    ctx.fillStyle = Math.sin(t * 12) > 0 ? '#ff4fd8' : '#ffd36b';
    for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 10 - 2, y + 3, 4, 4);
    ctx.fillStyle = `rgba(125,249,255,${0.25 + Math.sin(t * 8) * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(x - 22, y + 10);
    ctx.lineTo(x + 22, y + 10);
    ctx.lineTo(x + 30, H);
    ctx.lineTo(x - 30, H);
    ctx.fill();
  };

  let last = performance.now();
  let t = 0;
  let raf = 0;
  let lastCount = 4;

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    if (keys.has('arrowleft') || keys.has('a')) targetX -= 320 * dt;
    if (keys.has('arrowright') || keys.has('d')) targetX += 320 * dt;
    targetX = Math.max(26, Math.min(W - 26, targetX));
    px += (targetX - px) * Math.min(1, dt * 14);

    if (countdown > 0) {
      countdown -= dt;
      const c = Math.ceil(countdown);
      if (c !== lastCount && c > 0) { sound.tick(); lastCount = c; }
      if (countdown <= 0) sound.powerUp();
    } else if (!over) {
      time -= dt;
      spawn -= dt;
      const progress = 1 - time / DURATION;
      if (spawn <= 0) {
        spawn = 0.5 - progress * 0.24;
        const r = Math.random();
        items.push({
          x: 20 + Math.random() * (W - 40),
          y: -20,
          vy: 110 + progress * 140 + Math.random() * 50,
          kind: r < 0.05 ? 'gold' : r < 0.3 + progress * 0.12 ? 'bug' : 'star',
          rot: Math.random() * 6,
        });
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.vy * dt;
        it.rot += dt * 3;
        const hit = it.y > H - 58 && it.y < H - 26 && Math.abs(it.x - px) < 32;
        if (hit) {
          if (it.kind === 'bug') {
            lives--;
            shake = 0.3;
            sound.error();
            burst(it.x, it.y, '#ff3b5c', 16);
          } else {
            score += it.kind === 'gold' ? 3 : 1;
            sound.pop();
            burst(it.x, it.y, it.kind === 'gold' ? '#ffcf5c' : '#fff3a0');
          }
          items.splice(i, 1);
        } else if (it.y > H + 20) {
          items.splice(i, 1);
        }
      }
      if (lives <= 0 || time <= 0) {
        over = true;
        const win = lives > 0 && score >= GOAL;
        setTimeout(() => onEnd(win, score, Math.max(0, time)), 900);
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 200 * dt;
      s.life -= dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    shake = Math.max(0, shake - dt);

    // draw
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake * 3, (Math.random() - 0.5) * 10 * shake * 3);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120a2e');
    g.addColorStop(1, '#2b1460');
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    for (const s of bg) {
      s.y += s.s * 30 * dt;
      if (s.y > H) s.y = 0;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + s.s * 0.25})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    for (const it of items) {
      if (it.kind === 'bug') drawBug(it.x, it.y, t);
      else drawStar(it.x, it.y, it.kind === 'gold' ? 15 : 11, it.rot, it.kind === 'gold' ? '#ffcf5c' : '#fff3a0');
    }
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, s.life / 0.6);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    drawShip(px, t);
    ctx.restore();

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffd36b';
    ctx.textAlign = 'left';
    ctx.fillText(`★ ${score}/${GOAL}`, 10, 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff7eb6';
    ctx.fillText('♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives)), W - 10, 10);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7df9ff';
    ctx.fillText(`${Math.max(0, Math.ceil(time))}s`, W / 2, 10);

    if (countdown > 0) {
      ctx.fillStyle = 'rgba(10,6,30,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '40px "Press Start 2P", monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.ceil(countdown)), W / 2, H / 2 - 20);
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffd36b';
      ctx.fillText('CATCH ★  AVOID BUGS', W / 2, H / 2 + 30);
    }
    if (over) {
      ctx.fillStyle = 'rgba(10,6,30,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textBaseline = 'middle';
      const win = lives > 0 && score >= GOAL;
      ctx.fillStyle = win ? '#7ed957' : '#ff3b5c';
      ctx.fillText(win ? 'YOU WIN!' : 'GAME OVER', W / 2, H / 2);
    }

    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerdown', onMove);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  };
}
