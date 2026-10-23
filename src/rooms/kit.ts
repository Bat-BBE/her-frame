import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTex, std, glow, mesh, rand } from '../util';

export { THREE, RoundedBoxGeometry, canvasTex, std, glow, mesh, rand };

/** Rounded box mesh in one call — most furniture is made of these. */
export const rbox = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, r = 0.04) =>
  mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), mat, x, y, z);

export const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) =>
  mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

export const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16) =>
  mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);

export const sphere = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16) =>
  mesh(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), mat, x, y, z);

/** Wooden plank floor texture. `hue`/`sat`/`light` are [min, max] ranges. */
export function plankTexture(hue: [number, number], sat: [number, number], light: [number, number], rows = 14) {
  return canvasTex(1024, 1024, (ctx) => {
    const rh = 1024 / rows;
    for (let r = 0; r < rows; r++) {
      let x = -Math.random() * 300;
      while (x < 1024) {
        const len = rand(260, 520);
        ctx.fillStyle = `hsl(${rand(...hue)}, ${rand(...sat)}%, ${rand(...light)}%)`;
        ctx.fillRect(x, r * rh, len, rh);
        ctx.globalAlpha = 0.08;
        for (let g = 0; g < 6; g++) {
          ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
          ctx.fillRect(x, r * rh + rand(4, rh - 4), len, rand(1, 3));
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(40,20,10,0.6)';
        ctx.fillRect(x, r * rh, 3, rh);
        x += len;
      }
      ctx.fillStyle = 'rgba(40,20,10,0.7)';
      ctx.fillRect(0, r * rh, 1024, 3);
    }
  }).tex;
}

/** Square tiles with grout. `a`/`b` alternate as a checkerboard when they differ. */
export function tileTexture(a: string, b: string, n = 8, grout = 'rgba(0,0,0,0.25)') {
  return canvasTex(512, 512, (ctx) => {
    const s = 512 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? a : b;
      ctx.fillRect(i * s, j * s, s, s);
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(i * s + 4, j * s + 4, s - 8, s - 8);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = grout;
    ctx.lineWidth = 4;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, 512);
      ctx.moveTo(0, i * s);
      ctx.lineTo(512, i * s);
      ctx.stroke();
    }
  }).tex;
}

/** Soft fabric checker (blankets, tablecloths). */
export function checkTexture(a: string, b: string, n = 10) {
  return canvasTex(256, 256, (ctx) => {
    const s = 256 / n;
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = b;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < n; i += 2) ctx.fillRect(i * s, 0, s, 256);
    for (let j = 0; j < n; j += 2) ctx.fillRect(0, j * s, 256, s);
    ctx.globalAlpha = 1;
  }).tex;
}

/** A framed picture hung on a wall facing +z (rotate the group for other walls). */
export function picture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void, frameMat: THREE.Material) {
  const g = new THREE.Group();
  const W = 256, H = Math.round((256 * h) / w);
  const art = canvasTex(W, H, (ctx) => draw(ctx, W, H));
  g.add(box(w + 0.1, h + 0.1, 0.05, frameMat, 0, 0, 0));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std('#fff', { map: art.tex, roughness: 0.6 }));
  pic.position.z = 0.03;
  g.add(pic);
  return g;
}

/** Potted leafy plant, base at y = 0. */
export function pottedPlant(scale = 1, potColor = '#e07a5f', leaf = ['#3fa36b', '#2e7d55', '#5cbf7d']) {
  const g = new THREE.Group();
  g.add(cyl(0.3 * scale, 0.22 * scale, 0.5 * scale, std(potColor, { roughness: 0.8 }), 0, 0.25 * scale, 0));
  g.add(cyl(0.28 * scale, 0.28 * scale, 0.03, std('#3b2618'), 0, 0.49 * scale, 0));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const l = sphere(0.2 * scale, std(leaf[i % leaf.length], { roughness: 0.75 }), Math.cos(a) * 0.16 * scale, (0.75 + rand(0, 0.45)) * scale, Math.sin(a) * 0.16 * scale, 8);
    l.scale.set(1, 0.55, 1.5);
    l.rotation.y = -a;
    g.add(l);
  }
  return g;
}

/** Big-leaf monstera-style plant, base at y = 0. */
export function monstera(scale = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.34 * scale, 0.26 * scale, 0.6 * scale, std('#f2efe6', { roughness: 0.6 }), 0, 0.3 * scale, 0));
  const leafMat = std('#2f8a5b', { roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const a = i * 2.39;
    const stemH = rand(0.9, 1.7) * scale;
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.3 * scale, 10), leafMat);
    leaf.position.set(Math.cos(a) * 0.32 * scale, 0.6 * scale + stemH, Math.sin(a) * 0.32 * scale);
    leaf.rotation.set(-Math.PI / 2 + rand(0.3, 0.8), a, 0);
    leaf.scale.set(1, 1.4, 1);
    leaf.castShadow = true;
    g.add(leaf);
    const stem = cyl(0.015, 0.015, stemH, std('#2a6b4a'), Math.cos(a) * 0.16 * scale, 0.6 * scale + stemH / 2, Math.sin(a) * 0.16 * scale, 5);
    stem.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    g.add(stem);
  }
  return g;
}

/** Row of books standing on a shelf (spines facing +z), starting at x0 going right. */
export function bookRow(x0: number, x1: number, y: number, z: number, palette = ['#e36b6b', '#f2c14e', '#5fb3a1', '#6c8cf5', '#c77dff', '#ff9f68', '#3d5a80']) {
  const g = new THREE.Group();
  let x = x0;
  while (x < x1 - 0.1) {
    const bw = rand(0.06, 0.12);
    const bh = rand(0.26, 0.4);
    const b = box(bw, bh, rand(0.22, 0.28), std(palette[Math.floor(Math.random() * palette.length)], { roughness: 0.7 }), x + bw / 2, y + bh / 2, z);
    if (Math.random() < 0.1) b.rotation.z = rand(-0.2, 0.2);
    g.add(b);
    x += bw + 0.008;
  }
  return g;
}

/** Text drawn onto a canvas texture (labels, screens, notes). */
export function textTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  return canvasTex(w, h, draw);
}

export const emissiveScreen = (tex: THREE.Texture, intensity = 1.2) =>
  new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: tex, emissiveIntensity: intensity, roughness: 0.25 });

export { glow as glowMat };
