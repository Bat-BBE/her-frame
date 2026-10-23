import * as THREE from 'three';
import { WALLS } from './rooms/house';
import { DOORS, ROOMS, type RoomId } from './data';
import type { World } from './world';

const CS = 0.2;
/** How far the avatar keeps from furniture. */
const PAD = 0.22;

/** A walkable grid over one floor (the house, or the observatory island)
 *  with A* paths that are string-pulled into a few straight segments. */
class Grid {
  readonly w: number;
  readonly h: number;
  blocked: Uint8Array;

  constructor(readonly x0: number, readonly z0: number, x1: number, z1: number, readonly y: number) {
    this.w = Math.ceil((x1 - x0) / CS);
    this.h = Math.ceil((z1 - z0) / CS);
    this.blocked = new Uint8Array(this.w * this.h);
  }

  cell(x: number, z: number): [number, number] {
    return [Math.floor((x - this.x0) / CS), Math.floor((z - this.z0) / CS)];
  }

  center(i: number, j: number) {
    return new THREE.Vector3(this.x0 + (i + 0.5) * CS, this.y, this.z0 + (j + 0.5) * CS);
  }

  inside(i: number, j: number) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }
  free(i: number, j: number) { return this.inside(i, j) && !this.blocked[j * this.w + i]; }

  /** Marks every cell whose center falls in the rectangle. */
  fill(ax: number, az: number, bx: number, bz: number, v: 0 | 1) {
    const [i0, j0] = this.cell(Math.min(ax, bx), Math.min(az, bz));
    const [i1, j1] = this.cell(Math.max(ax, bx), Math.max(az, bz));
    for (let j = Math.max(0, j0); j <= Math.min(this.h - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(this.w - 1, i1); i++) this.blocked[j * this.w + i] = v;
    }
  }

  contains(p: THREE.Vector3) {
    const [i, j] = this.cell(p.x, p.z);
    return this.inside(i, j);
  }

  /** Nearest free cell to p, preferring cells closer to `toward`. */
  nearestFree(p: THREE.Vector3, toward?: THREE.Vector3, maxR = 3.2): THREE.Vector3 | null {
    const [ci, cj] = this.cell(p.x, p.z);
    const R = Math.ceil(maxR / CS);
    let best: THREE.Vector3 | null = null;
    let bestScore = Infinity;
    for (let dj = -R; dj <= R; dj++) {
      for (let di = -R; di <= R; di++) {
        const i = ci + di, j = cj + dj;
        if (!this.free(i, j)) continue;
        const c = this.center(i, j);
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d > maxR) continue;
        const score = d + (toward ? Math.hypot(c.x - toward.x, c.z - toward.z) * 0.12 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
    }
    return best;
  }

  private los(a: [number, number], b: [number, number]) {
    let [x0, y0] = a;
    const [x1, y1] = b;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!this.free(x0, y0)) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  path(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    let s = this.cell(from.x, from.z);
    const g = this.cell(to.x, to.z);
    if (!this.free(g[0], g[1])) return null;
    if (!this.free(s[0], s[1])) {
      // standing slightly inside an obstacle (e.g. after a hide) — start from the nearest free cell
      const n = this.nearestFree(from, undefined, 1.2);
      if (!n) return null;
      s = this.cell(n.x, n.z);
    }
    const W = this.w, N = W * this.h;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap: [number, number][] = [];
    const push = (f: number, k: number) => {
      heap.push([f, k]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const hcost = (i: number, j: number) => {
      const dx = Math.abs(i - g[0]), dy = Math.abs(j - g[1]);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const sk = s[1] * W + s[0], gk = g[1] * W + g[0];
    gScore[sk] = 0;
    push(hcost(s[0], s[1]), sk);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    while (heap.length) {
      const [, k] = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === gk) { found = true; break; }
      const i = k % W, j = (k / W) | 0;
      for (const [di, dj, c] of dirs) {
        const ni = i + di, nj = j + dj;
        if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(i + di, j) || !this.free(i, j + dj))) continue; // no corner cutting
        const nk = nj * W + ni;
        const ng = gScore[k] + c;
        if (ng < gScore[nk]) {
          gScore[nk] = ng;
          came[nk] = k;
          push(ng + hcost(ni, nj), nk);
        }
      }
    }
    if (!found) return null;
    const cells: [number, number][] = [];
    for (let k = gk; k !== -1; k = came[k]) cells.push([k % W, (k / W) | 0]);
    cells.reverse();
    // string-pull
    const out: [number, number][] = [cells[0]];
    let anchor = 0;
    for (let i = 2; i < cells.length; i++) {
      if (!this.los(cells[anchor], cells[i])) {
        out.push(cells[i - 1]);
        anchor = i - 1;
      }
    }
    out.push(cells[cells.length - 1]);
    const pts = out.slice(1).map(([i, j]) => this.center(i, j));
    if (pts.length) pts[pts.length - 1] = to.clone().setY(this.y);
    return pts;
  }
}

/** Walkable areas: the house floor and the observatory deck. */
export class Nav {
  private house = new Grid(-5.3, -5.3, 16.3, 13.5, 0);
  private obs = new Grid(22.2, -8.3, 31.8, 1.3, 1.6);
  private box = new THREE.Box3();

  constructor(private world: World) {}

  grid(p: THREE.Vector3) {
    return p.x > 20 ? this.obs : this.house;
  }

  /** Rebuild after anything that changes what's walkable (rooms unlocking, doors, furniture moving). */
  build(unlocked: (r: RoomId) => boolean) {
    const H = this.house;
    H.blocked.fill(1);
    for (const r of ROOMS) {
      if (r.id === 'observatory' || !unlocked(r.id)) continue;
      const [x0, x1, z0, z1] = r.bounds;
      H.fill(x0, z0, x1, z1, 0);
    }
    // keep off the outer walls and the open edges
    H.fill(-5.3, -5.3, -4.75, 13.5, 1);
    H.fill(-5.3, -5.3, 16.3, -4.75, 1);
    H.fill(15.95, -5.3, 16.3, 13.5, 1);
    H.fill(-5.3, 13.15, 16.3, 13.5, 1);
    for (const w of WALLS) {
      const t = 0.1 + PAD;
      if (w.axis === 'z') H.fill(w.from, w.at - t, w.to, w.at + t, 1);
      else H.fill(w.at - t, w.from, w.at + t, w.to, 1);
    }
    for (const d of DOORS) {
      if (!this.world.doors.get(d.id)?.open || !unlocked(d.from) || !unlocked(d.to)) continue;
      const t = 0.1 + PAD + 0.05;
      const a = d.span[0] + 0.12, b = d.span[1] - 0.12;
      if (d.axis === 'z') H.fill(a, d.at - t, b, d.at + t, 0);
      else H.fill(d.at - t, a, d.at + t, b, 0);
    }
    const O = this.obs;
    O.blocked.fill(1);
    if (unlocked('observatory')) {
      const c = new THREE.Vector3(27, 1.6, -3.5);
      for (let j = 0; j < O.h; j++) for (let i = 0; i < O.w; i++) {
        const p = O.center(i, j);
        if (Math.hypot(p.x - c.x, p.z - c.z) < 3.75) O.blocked[j * O.w + i] = 0;
      }
    }
    for (const r of ROOMS) {
      if (!unlocked(r.id)) continue;
      const G = r.id === 'observatory' ? O : H;
      const floor = r.floorY;
      this.world.rooms.get(r.id)!.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.userData.ignoreRay || o.userData.noNav) return;
        for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible && p !== this.world.rooms.get(r.id)!.group) return;
        this.box.setFromObject(o);
        if (this.box.max.y < floor + 0.14 || this.box.min.y > floor + 1.45) return;
        if (this.box.max.x - this.box.min.x > 6 || this.box.max.z - this.box.min.z > 6) return;
        G.fill(this.box.min.x - PAD, this.box.min.z - PAD, this.box.max.x + PAD, this.box.max.z + PAD, 1);
      });
    }
  }

  path(from: THREE.Vector3, to: THREE.Vector3) {
    const a = this.grid(from), b = this.grid(to);
    if (a !== b) return null;
    return a.path(from, to);
  }

  nearestFree(p: THREE.Vector3, toward?: THREE.Vector3, maxR?: number) {
    return this.grid(p).nearestFree(p, toward, maxR);
  }

  /** Where to stand to use an object: the closest reachable free spot around it. */
  approach(obj: THREE.Object3D, from: THREE.Vector3): { stand: THREE.Vector3; look: THREE.Vector3; path: THREE.Vector3[] } | null {
    this.box.setFromObject(obj);
    if (this.box.isEmpty()) return null;
    const c = this.box.getCenter(new THREE.Vector3());
    const G = this.grid(c);
    c.y = G.y;
    const halfX = (this.box.max.x - this.box.min.x) / 2, halfZ = (this.box.max.z - this.box.min.z) / 2;
    const reach = Math.max(halfX, halfZ) + 1.4;
    // try a few candidate spots around the object, nearest first
    const tried: THREE.Vector3[] = [];
    for (let k = 0; k < 5; k++) {
      const s = G.nearestFree(c, from, reach + k * 0.5);
      if (!s || tried.some((t) => t.distanceTo(s) < 0.1)) break;
      tried.push(s);
      const path = this.path(from, s);
      if (path) return { stand: s, look: c, path };
      // block it temporarily isn't worth it — widen and prefer the camera side
      const alt = G.nearestFree(c.clone().add(new THREE.Vector3(halfX + 0.6, 0, halfZ + 0.6)), from, reach);
      if (alt) {
        const p2 = this.path(from, alt);
        if (p2) return { stand: alt, look: c, path: p2 };
      }
    }
    return null;
  }
}
