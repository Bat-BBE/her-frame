import * as THREE from 'three';

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function canvasTex(w: number, h: number, draw?: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw?.(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx, tex };
}

export function std(color: THREE.ColorRepresentation, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...opts });
}

export function glow(color: THREE.ColorRepresentation, intensity = 2.5) {
  return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity });
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Deterministic pseudo-random from a 3D position so duplicated seam vertices move together. */
export function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

export function letterTexture(letter: string, opts: { fg?: string; bg?: string; size?: number; glow?: boolean } = {}) {
  const size = opts.size ?? 256;
  return canvasTex(size, size, (ctx) => {
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = size * 0.04;
      ctx.strokeRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88);
    }
    ctx.font = `900 ${size * 0.62}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (opts.glow) {
      ctx.shadowColor = opts.fg ?? '#ffd36b';
      ctx.shadowBlur = size * 0.12;
    }
    ctx.fillStyle = opts.fg ?? '#ffd36b';
    ctx.fillText(letter, size / 2, size / 2 + size * 0.04);
  });
}

export function drawGlyph(ctx: CanvasRenderingContext2D, glyph: string, cx: number, cy: number, r: number) {
  ctx.beginPath();
  if (glyph === '▲') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.95, cy + r * 0.7);
    ctx.lineTo(cx - r * 0.95, cy + r * 0.7);
    ctx.closePath();
  } else if (glyph === '●') {
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  } else if (glyph === '■') {
    ctx.rect(cx - r * 0.72, cy - r * 0.72, r * 1.44, r * 1.44);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.42;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
