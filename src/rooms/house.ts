import { THREE, RoundedBoxGeometry, canvasTex, std, glow, mesh, rand, box, cyl, plankTexture, tileTexture } from './kit';
import { hash3 } from '../util';
import { ROOMS, DOORS, roomDef, type RoomId, type DoorDef } from '../data';
import type { World, CutWall } from '../world';

const WALL_H = 5;
const RAIL_Y = 1.4;
const DOOR_H = 2.6;

export interface HouseRefs {
  bridgeStones: THREE.Object3D[];
}

export function buildHouse(w: World): HouseRefs {
  buildIsland(w);
  buildFloors(w);
  buildExterior(w);
  buildInteriorWalls(w);
  buildLocks(w);
  return { bridgeStones: buildObservatoryIsland(w) };
}

// --------------------------------------------------------------------------- island
function jaggedCone(radius: number, height: number, segs = 12, k = 0.9) {
  const g = new THREE.ConeGeometry(radius, height, segs, 6);
  g.rotateX(Math.PI);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y > height / 2 - 0.05) continue;
    p.setX(i, x + (hash3(x, y, z) - 0.5) * k * 2);
    p.setZ(i, z + (hash3(z, x, y) - 0.5) * k * 2);
    p.setY(i, y + (hash3(y, z, x) - 0.5) * 0.6);
  }
  g.computeVertexNormals();
  return g;
}

function roundedRect(x0: number, x1: number, y0: number, y1: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

const grassTex = () => {
  const t = canvasTex(512, 512, (ctx) => {
    ctx.fillStyle = '#3f8a5a';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `hsla(${rand(120, 150)}, ${rand(35, 55)}%, ${rand(28, 48)}%, 0.55)`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, rand(2, 5), rand(4, 9));
    }
  }).tex;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.18, 0.18);
  return t;
};

function buildIsland(w: World) {
  const grass = std('#ffffff', { map: grassTex(), roughness: 0.95 });
  const dirt = std('#5a3a2a', { roughness: 1 });
  // House footprint is x[-5.3, 16.3], z[-5.3, 13.5]; the lawn wraps ~3.5 around it.
  const shape = roundedRect(-8.8, 19.8, -17.2, 8.8, 3.2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  const lawn = new THREE.Mesh(geo, [grass, dirt]);
  lawn.position.y = -0.78;
  lawn.receiveShadow = true;
  w.root.add(lawn);

  const rock = new THREE.Mesh(jaggedCone(15, 13, 14, 1.4), w.mats.rock);
  rock.scale.set(1.05, 1, 0.95);
  rock.position.set(5.5, -0.7 - 6.5, 4.2);
  rock.rotation.y = 0.3;
  rock.receiveShadow = true;
  w.root.add(rock);

  const crystalCols = ['#7df9ff', '#ff7eb6', '#b388ff'];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand(-0.2, 0.2);
    const r = rand(9.5, 13);
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.35, 0.7), 0), glow(crystalCols[i % 3], 1.6));
    c.position.set(5.5 + Math.cos(a) * r * 1.05, rand(-2.5, -5.5), 4.2 + Math.sin(a) * r * 0.95);
    c.scale.y = 2.2;
    c.rotation.set(rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4));
    w.root.add(c);
  }

  for (let i = 0; i < 8; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.5, 1.3), 0), i % 2 ? w.mats.rock : w.mats.rockDark);
    r.userData.orbit = { a: (i / 8) * Math.PI * 2, r: rand(21, 27), y: rand(-4, 2), s: rand(0.03, 0.07) };
    r.castShadow = true;
    w.rocks.push(r);
    w.root.add(r);
  }
}

// --------------------------------------------------------------------------- floors
function buildFloors(w: World) {
  const side = std('#5a3624');
  const looks: Record<RoomId, () => THREE.Texture> = {
    study: () => plankTexture([20, 28], [38, 50], [36, 46]),
    bedroom: () => plankTexture([26, 34], [32, 44], [48, 58]),
    living: () => plankTexture([14, 22], [32, 42], [26, 34], 18),
    kitchen: () => tileTexture('#ece3d0', '#4f9c90', 8),
    bath: () => tileTexture('#eaf6fb', '#b9d8e8', 12, 'rgba(60,90,110,0.35)'),
    observatory: () => tileTexture('#2c2556', '#241e48', 10, 'rgba(180,140,255,0.25)'),
  };
  for (const def of ROOMS) {
    if (def.id === 'observatory') continue;
    const [x0, x1, z0, z1] = def.bounds;
    const tex = looks[def.id]();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const tile = def.id === 'kitchen' || def.id === 'bath' ? 4.5 : 10.3;
    tex.repeat.set((x1 - x0) / tile, (z1 - z0) / tile);
    const top = std('#ffffff', { map: tex, roughness: def.id === 'bath' ? 0.35 : 0.62 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.5, z1 - z0), [side, side, top, side, side, side]);
    floor.position.set((x0 + x1) / 2, -0.25, (z0 + z1) / 2);
    floor.receiveShadow = true;
    w.root.add(floor);
  }
  w.root.add(mesh(new THREE.BoxGeometry(21.8, 0.14, 19.0), w.mats.trim, 5.5, -0.52, 4.1));
}

// --------------------------------------------------------------------------- walls
const roomMats = (w: World, id: RoomId) => {
  const r = w.rooms.get(id)!;
  return { wall: r.wall, low: r.wallLow };
};

/** Exterior walls of the new rooms (the study builds its own two). */
function buildExterior(w: World) {
  const outer = std('#2f2457', { roughness: 0.95 });
  const t = w.mats.trim;
  // living — back wall z ∈ [-5.3, -5.0], x ∈ [5.0, 16.3]
  {
    const m = roomMats(w, 'living');
    const seg = (y0: number, y1: number, mat: THREE.Material) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(11.3, y1 - y0, 0.3), [outer, outer, t, t, mat, outer]);
      b.position.set(10.65, (y0 + y1) / 2, -5.15);
      b.castShadow = b.receiveShadow = true;
      w.root.add(b);
    };
    seg(0, RAIL_Y, m.low);
    seg(RAIL_Y, WALL_H, m.wall);
    w.root.add(mesh(new THREE.BoxGeometry(11.3, 0.1, 0.42), t, 10.65, WALL_H + 0.05, -5.15));
    w.root.add(mesh(new THREE.BoxGeometry(11.3, 0.2, 0.05), w.mats.baseboard, 10.65, 0.1, -4.97));
    w.root.add(mesh(new THREE.BoxGeometry(11.3, 0.07, 0.07), t, 10.65, RAIL_Y, -4.96));
    w.root.add(mesh(new THREE.BoxGeometry(0.06, WALL_H + 0.1, 0.42), t, 16.32, WALL_H / 2, -5.15));
  }
  // bedroom — left wall x ∈ [-5.3, -5.0], z ∈ [5.0, 13.5], with a real window
  {
    const m = roomMats(w, 'bedroom');
    const wz0 = 6.3, wz1 = 8.5, wy0 = 2.0, wy1 = 3.9;
    const seg = (z0: number, z1: number, y0: number, y1: number) => {
      const add = (ya: number, yb: number, mat: THREE.Material) => {
        if (yb - ya <= 0.001) return;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, yb - ya, z1 - z0), [mat, outer, t, t, outer, outer]);
        b.position.set(-5.15, (ya + yb) / 2, (z0 + z1) / 2);
        b.castShadow = b.receiveShadow = true;
        w.root.add(b);
      };
      if (y0 < RAIL_Y && y1 > RAIL_Y) {
        add(y0, RAIL_Y, m.low);
        add(RAIL_Y, y1, m.wall);
      } else add(y0, y1, y0 >= RAIL_Y ? m.wall : m.low);
    };
    seg(5.0, wz0, 0, WALL_H);
    seg(wz1, 13.5, 0, WALL_H);
    seg(wz0, wz1, 0, wy0);
    seg(wz0, wz1, wy1, WALL_H);
    w.root.add(mesh(new THREE.BoxGeometry(0.42, 0.1, 8.5), t, -5.15, WALL_H + 0.05, 9.25));
    w.root.add(mesh(new THREE.BoxGeometry(0.42, WALL_H + 0.1, 0.06), t, -5.15, WALL_H / 2, 13.52));
    w.root.add(mesh(new THREE.BoxGeometry(0.05, 0.2, 8.5), w.mats.baseboard, -4.97, 0.1, 9.25));
    w.root.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 1.3), t, -4.96, RAIL_Y, 5.65));
    w.root.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 5.0), t, -4.96, RAIL_Y, 11.0));
  }
}

export interface WallSpec {
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
  neg: RoomId;
  pos: RoomId;
}

export const WALLS: WallSpec[] = [
  { axis: 'z', at: 5, from: -5.0, to: 4.9, neg: 'study', pos: 'bedroom' },
  { axis: 'z', at: 5, from: 5.1, to: 11.1, neg: 'living', pos: 'kitchen' },
  { axis: 'z', at: 5, from: 11.1, to: 16.3, neg: 'living', pos: 'bath' },
  { axis: 'x', at: 5, from: -5.0, to: 5.1, neg: 'study', pos: 'living' },
  { axis: 'x', at: 5, from: 5.1, to: 13.5, neg: 'bedroom', pos: 'kitchen' },
  { axis: 'x', at: 11, from: 5.1, to: 13.5, neg: 'kitchen', pos: 'bath' },
];

function buildInteriorWalls(w: World) {
  const trim = w.mats.trim;
  const base = w.mats.baseboard;
  for (const spec of WALLS) {
    const g = new THREE.Group();
    w.root.add(g);
    const neg = roomMats(w, spec.neg);
    const pos = roomMats(w, spec.pos);
    const door = DOORS.find((d) => d.axis === spec.axis && d.at === spec.at && d.span[0] >= spec.from && d.span[1] <= spec.to);
    const T = 0.2;
    /** One stretch of wall from a to b along the wall, between heights y0..y1. */
    const piece = (a: number, b: number, y0: number, y1: number) => {
      const len = b - a, mid = (a + b) / 2;
      const add = (ya: number, yb: number, low: boolean) => {
        if (yb - ya <= 0.001) return;
        const pm = low ? pos.low : pos.wall;
        const nm = low ? neg.low : neg.wall;
        const geo = spec.axis === 'z' ? new THREE.BoxGeometry(len, yb - ya, T) : new THREE.BoxGeometry(T, yb - ya, len);
        const mats = spec.axis === 'z' ? [trim, trim, trim, trim, pm, nm] : [pm, nm, trim, trim, trim, trim];
        const m = new THREE.Mesh(geo, mats);
        if (spec.axis === 'z') m.position.set(mid, (ya + yb) / 2, spec.at);
        else m.position.set(spec.at, (ya + yb) / 2, mid);
        m.castShadow = m.receiveShadow = true;
        g.add(m);
      };
      if (y0 < RAIL_Y && y1 > RAIL_Y) {
        add(y0, RAIL_Y, true);
        add(RAIL_Y, y1, false);
      } else add(y0, y1, y0 < RAIL_Y);
      if (y0 === 0) {
        // baseboards on both faces
        for (const s of [-1, 1]) {
          const bb = spec.axis === 'z' ? box(len, 0.2, 0.04, base, mid, 0.1, spec.at + s * (T / 2 + 0.02)) : box(0.04, 0.2, len, base, spec.at + s * (T / 2 + 0.02), 0.1, mid);
          g.add(bb);
        }
      }
    };
    if (door) {
      piece(spec.from, door.span[0], 0, WALL_H);
      piece(door.span[1], spec.to, 0, WALL_H);
      piece(door.span[0], door.span[1], DOOR_H, WALL_H);
    } else piece(spec.from, spec.to, 0, WALL_H);
    // top cap
    const len = spec.to - spec.from, mid = (spec.from + spec.to) / 2;
    g.add(spec.axis === 'z' ? box(len, 0.08, T + 0.1, trim, mid, WALL_H + 0.04, spec.at) : box(T + 0.1, 0.08, len, trim, spec.at, WALL_H + 0.04, mid));

    const cw: CutWall = { group: g, axis: spec.axis, at: spec.at, doors: [], cut: false };
    if (door) cw.doors.push(buildDoor(w, g, door));
    w.cutWalls.push(cw);
  }
}

function buildDoor(w: World, wallGroup: THREE.Group, d: DoorDef) {
  const [s0, s1] = d.span;
  const width = s1 - s0;
  const holder = new THREE.Group();
  wallGroup.add(holder);
  const frameMat = std('#efe6d6', { roughness: 0.6 });
  const leafMat = std('#c89a6a', { roughness: 0.55 });
  const panelMat = std('#b5875a', { roughness: 0.6 });
  // frame (both faces), built in "along the wall" coordinates then placed
  const along = (u: number, y: number, n: number, sx: number, sy: number, sz: number, mat: THREE.Material) =>
    d.axis === 'z' ? box(sx, sy, sz, mat, u, y, d.at + n) : box(sz, sy, sx, mat, d.at + n, y, u);
  holder.add(along(s0 - 0.05, DOOR_H / 2, 0, 0.1, DOOR_H, 0.3, frameMat));
  holder.add(along(s1 + 0.05, DOOR_H / 2, 0, 0.1, DOOR_H, 0.3, frameMat));
  holder.add(along((s0 + s1) / 2, DOOR_H + 0.05, 0, width + 0.2, 0.1, 0.3, frameMat));
  // leaf on a hinge pivot
  const pivot = new THREE.Group();
  if (d.axis === 'z') pivot.position.set(s0, 0, d.at);
  else pivot.position.set(d.at, 0, s0);
  const base = d.axis === 'z' ? 0 : -Math.PI / 2;
  const to = roomDef(d.to).bounds;
  const toSide = d.axis === 'z' ? Math.sign((to[2] + to[3]) / 2 - d.at) : Math.sign((to[0] + to[1]) / 2 - d.at);
  const swing = d.axis === 'z' ? -toSide * 1.75 : toSide * 1.75;
  pivot.rotation.y = base;
  const lw = width - 0.04;
  const leaf = new THREE.Group();
  leaf.add(mesh(new RoundedBoxGeometry(lw, DOOR_H - 0.04, 0.08, 2, 0.02), leafMat, lw / 2 + 0.02, (DOOR_H - 0.04) / 2, 0));
  for (const s of [-1, 1]) {
    leaf.add(box(lw * 0.7, 0.8, 0.02, panelMat, lw / 2 + 0.02, 1.85, s * 0.045));
    leaf.add(box(lw * 0.7, 0.8, 0.02, panelMat, lw / 2 + 0.02, 0.75, s * 0.045));
    leaf.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), w.mats.gold, lw - 0.12, 1.25, s * 0.07));
  }
  // padlock (both faces)
  const padlock = new THREE.Group();
  const lockMat = glow('#ffb84d', 1.6);
  for (const s of [-1, 1]) {
    const body = mesh(new RoundedBoxGeometry(0.22, 0.2, 0.06, 2, 0.03), lockMat, lw - 0.12, 1.0, s * 0.09);
    const shackle = mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI), w.mats.gold, lw - 0.12, 1.1, s * 0.09);
    padlock.add(body, shackle);
  }
  leaf.add(padlock);
  pivot.add(leaf);
  holder.add(pivot);
  w.doors.set(d.id, { id: d.id, leaf: pivot, closed: base, opened: base + swing, open: false, padlock });
  const prevZone = w.currentZone;
  w.currentZone = d.from;
  w.register(d.id, holder, d.axis === 'z' ? new THREE.Vector3((s0 + s1) / 2, 2.2, d.at) : new THREE.Vector3(d.at, 2.2, (s0 + s1) / 2), false);
  w.currentZone = prevZone;
  return holder;
}

// --------------------------------------------------------------------------- locks
function buildLocks(w: World) {
  for (const def of ROOMS) {
    const r = w.rooms.get(def.id)!;
    const g = r.lock;
    g.position.set(r.center.x, def.floorY + 2.4, r.center.z);
    const mat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#b388ff', emissiveIntensity: 1.6, transparent: true, opacity: 0.9 });
    g.add(mesh(new RoundedBoxGeometry(0.9, 0.75, 0.32, 3, 0.08), mat, 0, 0, 0));
    const sh = mesh(new THREE.TorusGeometry(0.3, 0.07, 10, 24, Math.PI), mat, 0, 0.36, 0);
    g.add(sh);
    const hole = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 10).rotateX(Math.PI / 2), std('#1a1030'), 0, 0.02, 0);
    g.add(hole);
    const label = canvasTex(512, 128, (ctx) => {
      ctx.font = '800 54px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#b388ff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(def.name, 256, 64);
    });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: label.tex, transparent: true, depthWrite: false }));
    spr.scale.set(3.2, 0.8, 1);
    spr.position.y = -0.95;
    spr.userData.ignoreRay = true;
    g.add(spr);
    g.traverse((o) => { o.userData.ignoreRay = true; });
    // soft glow ring on the floor
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#b388ff', transparent: true, opacity: 0.35, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.35;
    ring.userData.ignoreRay = true;
    g.add(ring);
    g.visible = false;
    w.root.add(g);
  }
}

// --------------------------------------------------------------------------- observatory island
function buildObservatoryIsland(w: World) {
  const cx = 27, cz = -3.5;
  const grass = std('#3f8a5a', { roughness: 0.95 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.2, 0.6, 32), [std('#5a3a2a', { roughness: 1 }), grass, grass]);
  top.position.set(cx, 1.2, cz);
  top.receiveShadow = true;
  w.root.add(top);
  const rock = new THREE.Mesh(jaggedCone(5.3, 7, 10, 0.8), w.mats.rock);
  rock.position.set(cx, 0.9 - 3.5, cz);
  w.root.add(rock);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.25, 0.45), 0), glow(['#7df9ff', '#b388ff', '#ff7eb6'][i % 3], 1.8));
    c.position.set(cx + Math.cos(a) * 4.2, rand(-1.5, -3), cz + Math.sin(a) * 4.2);
    c.scale.y = 2;
    w.root.add(c);
  }
  // floating stepping-stone bridge from the lawn to the island
  const stones: THREE.Object3D[] = [];
  const from = new THREE.Vector3(19.4, -0.15, 0.2);
  const to = new THREE.Vector3(22.6, 1.45, -2.0);
  const stoneMat = std('#8a80b8', { roughness: 0.9, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const k = (i + 0.5) / 4;
    const p = from.clone().lerp(to, k);
    const s = mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.25, 7), stoneMat, p.x, p.y, p.z);
    s.rotation.y = i * 1.3;
    s.userData.baseY = p.y;
    stones.push(s);
    w.root.add(s);
  }
  for (const p of [from, to]) {
    const post = new THREE.Group();
    post.position.copy(p).add(new THREE.Vector3(0.3, 0, 0.9));
    post.add(cyl(0.05, 0.05, 1.5, w.mats.frame, 0, 0.75, 0, 8));
    const bulb = mesh(new THREE.SphereGeometry(0.13, 12, 8), glow('#ffd59a', 2.6), 0, 1.6, 0);
    post.add(bulb);
    w.root.add(post);
  }
  w.updaters.push((_dt, t) => {
    stones.forEach((s, i) => { s.position.y = (s.userData.baseY as number) + Math.sin(t * 1.3 + i) * 0.06; });
  });
  return stones;
}
