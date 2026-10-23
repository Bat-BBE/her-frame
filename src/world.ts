import * as THREE from 'three';
import gsap from 'gsap';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTex, std, glow, mesh, rand, drawGlyph, letterTexture } from './util';
import { Tesseract } from './sky';
import { GLYPH_WALL, ROOMS, PAINTS, type RoomId, type ZoneId, type PaintId, type LightsMode } from './data';
import { buildHouse, type HouseRefs } from './rooms/house';
import { buildBedroom, type BedroomRefs } from './rooms/bedroom';
import { buildLiving, type LivingRefs } from './rooms/living';
import { buildKitchen, type KitchenRefs } from './rooms/kitchen';
import { buildBath, type BathRefs } from './rooms/bath';
import { buildObservatory, type ObservatoryRefs } from './rooms/observatory';
import { buildGarden, type GardenRefs } from './rooms/garden';

const WALL_H = 5;
const RAIL_Y = 1.4;
/** Height interior walls drop to when they would block the view of the focused room. */
export const CUT_H = 0.7;

export interface RoomRuntime {
  id: RoomId;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  floorY: number;
  center: THREE.Vector3;
  /** Largest floor dimension — drives camera framing. */
  size: number;
  /** Everything inside the room (hidden while the room is locked). */
  group: THREE.Group;
  wall: THREE.MeshStandardMaterial;
  wallLow: THREE.MeshStandardMaterial;
  lights: THREE.PointLight[];
  /** Floating padlock hologram shown while locked. */
  lock: THREE.Group;
  /** Where Mochi sits when it follows you into this room. */
  mochiSpot: THREE.Vector3;
  locked: boolean;
}

export interface CutWall {
  group: THREE.Group;
  axis: 'x' | 'z';
  at: number;
  doors: THREE.Object3D[];
  cut: boolean;
}

export interface DoorRuntime {
  id: string;
  leaf: THREE.Object3D;
  closed: number;
  opened: number;
  open: boolean;
  padlock: THREE.Object3D;
}

export interface LightSet {
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  lamp: THREE.PointLight;
  monitor: THREE.PointLight;
  neon: THREE.PointLight;
  arcade: THREE.PointLight;
  alcove: THREE.PointLight;
  box: THREE.PointLight;
  fill: THREE.PointLight;
}

export interface Bulb {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  base: THREE.Color;
}

export class World {
  readonly root = new THREE.Group();
  readonly interactives = new Map<string, THREE.Object3D>();
  readonly hotspots = new Map<string, THREE.Sprite>();
  lights!: LightSet;
  readonly lightBase = new Map<THREE.Light, number>();

  monitor!: ReturnType<typeof canvasTex>;
  arcadeScreen!: ReturnType<typeof canvasTex>;
  arcadeStrips: THREE.MeshStandardMaterial[] = [];
  arcadeMarquee!: THREE.MeshStandardMaterial;
  clockHour!: THREE.Object3D;
  clockMinute!: THREE.Object3D;
  plantGrowth!: THREE.Group;
  lampBulb!: THREE.MeshStandardMaterial;
  lampShade!: THREE.MeshStandardMaterial;
  rug!: THREE.Mesh;
  bookshelf!: THREE.Group;
  books: THREE.Mesh[] = [];
  redbook!: THREE.Mesh;
  beanbagInner!: THREE.Mesh;
  poster!: THREE.Group;
  mug!: THREE.Group;
  neonMat!: THREE.MeshStandardMaterial;
  glyphMats: THREE.MeshStandardMaterial[] = [];
  glyphTiles: THREE.Object3D[] = [];
  cubes: THREE.Mesh[] = [];
  cubeHome: THREE.Vector3[] = [];
  tesseract!: Tesseract;
  bulbs: Bulb[] = [];
  floatables: THREE.Object3D[] = [];
  boxLid!: THREE.Object3D;
  boxGlow!: THREE.MeshStandardMaterial;
  boxBeams!: THREE.Group;
  boxBody!: THREE.Group;
  alcove!: THREE.Group;
  windowGroup!: THREE.Group;
  rocks: THREE.Mesh[] = [];
  readonly flames: THREE.Mesh[] = [];
  readonly spinners: THREE.Object3D[] = [];
  trophyRing = new THREE.Group();
  readonly rooms = new Map<RoomId, RoomRuntime>();
  readonly cutWalls: CutWall[] = [];
  /** Things hung on an interior wall: hidden while that wall is cut down. */
  private mounts: { obj: THREE.Object3D; axis: 'x' | 'z'; at: number }[] = [];
  readonly doors = new Map<string, DoorRuntime>();
  readonly garden = new THREE.Group();
  /** Builder target: objects added by the room builders go into this zone's group. */
  currentZone: ZoneId = 'study';
  room!: THREE.Group;
  /** Per-frame callbacks registered by the room builders (flames, steam, fish...). */
  readonly updaters: ((dt: number, t: number) => void)[] = [];
  house!: HouseRefs;
  bedroom!: BedroomRefs;
  living!: LivingRefs;
  kitchen!: KitchenRefs;
  bath!: BathRefs;
  observatory!: ObservatoryRefs;
  gardenRefs!: GardenRefs;
  lightsMode: LightsMode = 'warm';
  /** Last focus passed to setFocus (null = whole house). */
  focus: RoomId | null = null;
  private dust!: THREE.Points;
  private dustMat!: THREE.ShaderMaterial;
  private hotspotTex: THREE.Texture;

  readonly mats = {
    wall: std('#4d3c83', { roughness: 0.95 }),
    wallLow: std('#3a2d68', { roughness: 0.95 }),
    trim: std('#7c66c9', { roughness: 0.6 }),
    baseboard: std('#2a1f4e'),
    wood: std('#b37a4e', { roughness: 0.65 }),
    darkWood: std('#6b4430', { roughness: 0.7 }),
    frame: std('#2a2046', { roughness: 0.5 }),
    gold: std('#ffcc4d', { metalness: 0.75, roughness: 0.3 }),
    rock: std('#241c48', { flatShading: true, roughness: 0.95 }),
    rockDark: std('#1d1640', { flatShading: true, roughness: 1 }),
  };

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.hotspotTex = this.makeHotspotTex();
    this.root.add(this.garden);
    for (const def of ROOMS) {
      const group = new THREE.Group();
      this.root.add(group);
      const isStudy = def.id === 'study';
      const p = PAINTS[def.paint];
      const [x0, x1, z0, z1] = def.bounds;
      this.rooms.set(def.id, {
        id: def.id, x0, x1, z0, z1, floorY: def.floorY,
        center: new THREE.Vector3((x0 + x1) / 2, def.floorY, (z0 + z1) / 2),
        size: Math.max(x1 - x0, z1 - z0),
        group,
        wall: isStudy ? this.mats.wall : std(p.wall, { roughness: 0.95 }),
        wallLow: isStudy ? this.mats.wallLow : std(p.wallLow, { roughness: 0.95 }),
        lights: [],
        lock: new THREE.Group(),
        mochiSpot: new THREE.Vector3((x0 + x1) / 2, def.floorY, (z0 + z1) / 2),
        locked: false,
      });
    }

    // The original room — now the study — keeps its hand-built layout.
    this.useZone('study');
    this.buildWalls();
    this.buildWindow();
    this.buildDesk();
    this.buildArcade();
    this.buildBookshelf();
    this.buildPlant();
    this.buildClock();
    this.buildNeon();
    this.buildPoster();
    this.buildGlyphs();
    this.buildRugAndTable();
    this.buildLamp();
    this.buildBeanbag();
    this.buildDecor();
    this.buildStringLights();
    this.buildAlcove();
    this.rooms.get('study')!.mochiSpot.set(-3.0, 0.78, 3.35);

    this.house = buildHouse(this);
    this.useZone('bedroom');
    this.bedroom = buildBedroom(this);
    this.useZone('living');
    this.living = buildLiving(this);
    this.useZone('kitchen');
    this.kitchen = buildKitchen(this);
    this.useZone('bath');
    this.bath = buildBath(this);
    this.useZone('observatory');
    this.observatory = buildObservatory(this);
    this.useZone('garden');
    this.gardenRefs = buildGarden(this);

    this.buildDust();
    this.buildLights();
    this.root.add(this.trophyRing);
  }

  useZone(z: ZoneId) {
    this.currentZone = z;
    this.room = z === 'garden' ? this.garden : this.rooms.get(z)!.group;
  }

  /** Adds a room light: parented to the root (so hiding a locked room's group
   *  never changes the scene's light count and forces a shader recompile). */
  addLight(l: THREE.PointLight) {
    this.root.add(l);
    if (this.currentZone !== 'garden') this.rooms.get(this.currentZone)!.lights.push(l);
    this.lightBase.set(l, l.intensity);
    return l;
  }

  zoneOf(id: string): ZoneId {
    return (this.interactives.get(id)?.userData.zone as ZoneId) ?? 'study';
  }

  register(id: string, obj: THREE.Object3D, anchor: THREE.Vector3, hotspot = true) {
    obj.userData.iid = id;
    obj.userData.zone = this.currentZone;
    obj.userData.anchor = anchor;
    obj.userData.baseScale = obj.scale.clone();
    this.interactives.set(id, obj);
    if (hotspot) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.hotspotTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.9 }),
      );
      s.renderOrder = 20;
      s.scale.setScalar(0.38);
      s.userData.ignoreRay = true;
      this.root.add(s);
      this.hotspots.set(id, s);
    }
  }

  anchorOf(id: string, target = new THREE.Vector3()) {
    const o = this.interactives.get(id);
    if (!o) return target.set(0, 1, 0);
    return o.localToWorld(target.copy(o.userData.anchor as THREE.Vector3));
  }

  private makeHotspotTex() {
    const { tex } = canvasTex(128, 128, (ctx) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(64, 64, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.arc(64, 64, 16, 0, Math.PI * 2);
      ctx.fill();
    });
    return tex;
  }

  // ---------------------------------------------------------------- walls
  private wallBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    const add = (ya: number, yb: number, mat: THREE.Material) => {
      if (yb - ya <= 0.001) return;
      const m = mesh(new THREE.BoxGeometry(x1 - x0, yb - ya, z1 - z0), mat, (x0 + x1) / 2, (ya + yb) / 2, (z0 + z1) / 2);
      this.room.add(m);
    };
    if (y0 < RAIL_Y && y1 > RAIL_Y) {
      add(y0, RAIL_Y, this.mats.wallLow);
      add(RAIL_Y, y1, this.mats.wall);
    } else {
      add(y0, y1, y0 >= RAIL_Y ? this.mats.wall : this.mats.wallLow);
    }
  }

  private buildWalls() {
    // back wall (inner face z = -5) with window opening
    this.wallBox(-5.3, -2.7, 0, WALL_H, -5.3, -5.0);
    this.wallBox(-0.3, 5.0, 0, WALL_H, -5.3, -5.0);
    this.wallBox(-2.7, -0.3, 0, 2.0, -5.3, -5.0);
    this.wallBox(-2.7, -0.3, 3.9, WALL_H, -5.3, -5.0);
    // left wall (inner face x = -5) with the secret door opening
    this.wallBox(-5.3, -5.0, 0, WALL_H, -5.0, -3.0);
    this.wallBox(-5.3, -5.0, 0, WALL_H, -0.6, 5.0);
    this.wallBox(-5.3, -5.0, 2.8, WALL_H, -3.0, -0.6);

    const t = this.mats.trim;
    this.room.add(mesh(new THREE.BoxGeometry(10.42, 0.1, 0.42), t, -0.15, WALL_H + 0.05, -5.15));
    this.room.add(mesh(new THREE.BoxGeometry(0.42, 0.1, 10.3), t, -5.15, WALL_H + 0.05, -0.15));
    this.room.add(mesh(new THREE.BoxGeometry(0.06, WALL_H + 0.1, 0.42), t, 5.02, WALL_H / 2, -5.15));
    this.room.add(mesh(new THREE.BoxGeometry(0.42, WALL_H + 0.1, 0.06), t, -5.15, WALL_H / 2, 5.02));

    const b = this.mats.baseboard;
    this.room.add(mesh(new THREE.BoxGeometry(10, 0.2, 0.05), b, 0, 0.1, -4.97));
    this.room.add(mesh(new THREE.BoxGeometry(0.05, 0.2, 2.4), b, -4.97, 0.1, -4.0));
    this.room.add(mesh(new THREE.BoxGeometry(0.05, 0.2, 5.6), b, -4.97, 0.1, 2.2));
    // chair rail
    this.room.add(mesh(new THREE.BoxGeometry(2.3, 0.07, 0.07), t, -3.85, RAIL_Y, -4.96));
    this.room.add(mesh(new THREE.BoxGeometry(5.3, 0.07, 0.07), t, 2.35, RAIL_Y, -4.96));
    this.room.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 2.0), t, -4.96, RAIL_Y, -4.0));
    this.room.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 5.6), t, -4.96, RAIL_Y, 2.2));
  }

  private buildWindow() {
    const g = new THREE.Group();
    const f = this.mats.frame;
    const cx = -1.5, cy = 2.95, w = 2.4, hgt = 1.9, z = -5.0;
    g.add(mesh(new THREE.BoxGeometry(w + 0.16, 0.12, 0.42), f, cx, cy + hgt / 2, z - 0.1));
    g.add(mesh(new THREE.BoxGeometry(w + 0.16, 0.12, 0.42), f, cx, cy - hgt / 2, z - 0.1));
    g.add(mesh(new THREE.BoxGeometry(0.12, hgt, 0.42), f, cx - w / 2, cy, z - 0.1));
    g.add(mesh(new THREE.BoxGeometry(0.12, hgt, 0.42), f, cx + w / 2, cy, z - 0.1));
    g.add(mesh(new THREE.BoxGeometry(0.06, hgt, 0.08), f, cx, cy, z - 0.15));
    g.add(mesh(new THREE.BoxGeometry(w, 0.06, 0.08), f, cx, cy, z - 0.15));
    const sill = mesh(new THREE.BoxGeometry(w + 0.5, 0.08, 0.42), this.mats.trim, cx, cy - hgt / 2 - 0.02, z + 0.12);
    g.add(sill);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(w, hgt),
      new THREE.MeshStandardMaterial({ color: '#9fb4ff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2 }),
    );
    glass.position.set(cx, cy, z - 0.16);
    g.add(glass);

    const curtain = std('#c45f9a', { roughness: 0.95 });
    for (const side of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 10, 1), curtain);
      c.scale.z = 0.45;
      c.position.set(cx + side * (w / 2 + 0.28), cy - 0.05, z + 0.12);
      c.castShadow = true;
      g.add(c);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, w + 1.2, 8).rotateZ(Math.PI / 2), this.mats.gold, cx, cy + hgt / 2 + 0.22, z + 0.14));

    const pot = mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.18, 12), std('#e07a5f'), cx - 0.7, cy - hgt / 2 + 0.11, z + 0.15);
    g.add(pot);
    for (let i = 0; i < 5; i++) {
      const s = mesh(new THREE.SphereGeometry(0.09, 8, 6), std('#4caf7a'), cx - 0.7 + rand(-0.06, 0.06), cy - hgt / 2 + 0.27 + i * 0.04, z + 0.15 + rand(-0.05, 0.05));
      g.add(s);
    }
    this.windowGroup = g;
    this.room.add(g);
    this.register('window', g, new THREE.Vector3(cx, cy + 0.3, z + 0.2));
  }

  // ---------------------------------------------------------------- desk + computer
  private buildDesk() {
    const w = this.mats.wood;
    const desk = new THREE.Group();
    desk.position.set(-1.6, 0, -4.38);
    desk.add(mesh(new THREE.BoxGeometry(2.7, 0.1, 1.1), w, 0, 1.0, 0));
    for (const [x, z] of [[-1.25, -0.45], [-1.25, 0.45]]) desk.add(mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), this.mats.darkWood, x, 0.48, z));
    const drawers = mesh(new THREE.BoxGeometry(0.75, 0.95, 1.0), w, 0.95, 0.48, 0);
    desk.add(drawers);
    for (const y of [0.25, 0.55, 0.82]) {
      desk.add(mesh(new THREE.BoxGeometry(0.68, 0.24, 0.02), std('#c99366'), 0.95, y, 0.51));
      desk.add(mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), this.mats.gold, 0.95, y + 0.04, 0.53));
    }
    this.room.add(desk);

    // chair
    const chair = new THREE.Group();
    chair.position.set(-1.9, 0, -3.35);
    chair.rotation.y = 0.35;
    const cm = std('#3f5bd9', { roughness: 0.8 });
    chair.add(mesh(new RoundedBoxGeometry(0.62, 0.1, 0.6, 2, 0.04), cm, 0, 0.62, 0));
    chair.add(mesh(new RoundedBoxGeometry(0.62, 0.7, 0.08, 2, 0.04), cm, 0, 1.0, 0.28));
    for (const [x, z] of [[-0.26, -0.24], [0.26, -0.24], [-0.26, 0.24], [0.26, 0.24]]) chair.add(mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), this.mats.frame, x, 0.3, z));
    this.room.add(chair);

    // computer
    const pc = new THREE.Group();
    pc.position.set(-1.85, 1.05, -4.55);
    const shell = std('#e8dfcc', { roughness: 0.55 });
    pc.add(mesh(new RoundedBoxGeometry(1.08, 0.86, 0.78, 4, 0.08), shell, 0, 0.5, 0));
    pc.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.45), shell, 0, 0.04, 0));
    this.monitor = canvasTex(512, 384);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 0.62),
      new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: this.monitor.tex, emissiveIntensity: 1.25, roughness: 0.2 }),
    );
    screen.position.set(0, 0.52, 0.395);
    pc.add(screen);
    pc.add(mesh(new THREE.BoxGeometry(0.92, 0.04, 0.32), shell, 0.05, 0.0, 0.72));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) {
      pc.add(mesh(new THREE.BoxGeometry(0.06, 0.025, 0.06), std(r === 2 && c > 2 && c < 7 ? '#cfc6b3' : '#f6f0e2'), -0.36 + c * 0.082, 0.03, 0.62 + r * 0.085));
    }
    pc.add(mesh(new RoundedBoxGeometry(0.1, 0.04, 0.16, 2, 0.02), shell, 0.68, 0.0, 0.72));
    this.room.add(pc);
    this.register('computer', pc, new THREE.Vector3(0, 0.95, 0.3));

    // mug
    const mug = new THREE.Group();
    mug.position.set(-0.55, 1.05, -4.05);
    const mm = std('#ff8fb1', { roughness: 0.4 });
    mug.add(mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.22, 16), mm, 0, 0.11, 0));
    mug.add(mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12), mm, 0.11, 0.12, 0));
    mug.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 16), std('#4a2c1a'), 0, 0.2, 0));
    this.mug = mug;
    this.room.add(mug);
    this.register('mug', mug, new THREE.Vector3(0, 0.35, 0));
    this.floatables.push(mug);

    // books on desk
    const stack = new THREE.Group();
    stack.position.set(-2.65, 1.05, -4.5);
    ['#6c8cf5', '#f2c14e', '#e36b6b'].forEach((c, i) => {
      const b = mesh(new THREE.BoxGeometry(0.5, 0.09, 0.36), std(c), 0, 0.045 + i * 0.09, 0);
      b.rotation.y = rand(-0.2, 0.2);
      stack.add(b);
    });
    this.room.add(stack);
    this.floatables.push(stack);
  }

  // ---------------------------------------------------------------- arcade
  private buildArcade() {
    const g = new THREE.Group();
    g.position.set(3.95, 0, -4.1);
    g.rotation.y = -0.18;
    const body = std('#2d2a7a', { roughness: 0.55 });
    const sideArt = std('#5b3fd6', { roughness: 0.5 });
    g.add(mesh(new THREE.BoxGeometry(1.0, 2.5, 0.95), body, 0, 1.25, 0));
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(0.06, 2.6, 1.05), sideArt, s * 0.53, 1.3, 0));
      const strip = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff4fd8', emissiveIntensity: 0.15 });
      this.arcadeStrips.push(strip);
      g.add(mesh(new THREE.BoxGeometry(0.03, 2.6, 0.03), strip, s * 0.56, 1.3, 0.52));
    }
    this.arcadeScreen = canvasTex(256, 224);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.66),
      new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: this.arcadeScreen.tex, emissiveIntensity: 1.3 }),
    );
    screen.position.set(0, 1.72, 0.49);
    screen.rotation.x = -0.12;
    g.add(mesh(new THREE.BoxGeometry(0.92, 0.78, 0.04), std('#0b0a1a'), 0, 1.72, 0.47).rotateX(-0.12));
    g.add(screen);

    const marquee = canvasTex(512, 128, (ctx) => {
      const gr = ctx.createLinearGradient(0, 0, 512, 0);
      gr.addColorStop(0, '#ff4fd8');
      gr.addColorStop(1, '#4fc3ff');
      ctx.fillStyle = '#120a2e';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = gr;
      ctx.font = '400 44px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STAR★CATCH', 256, 68);
    });
    this.arcadeMarquee = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: marquee.tex, emissiveIntensity: 0.35 });
    g.add(mesh(new THREE.BoxGeometry(1.0, 0.36, 0.5), body, 0, 2.62, 0.2));
    const mq = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.28), this.arcadeMarquee);
    mq.position.set(0, 2.62, 0.46);
    g.add(mq);

    const panel = mesh(new THREE.BoxGeometry(1.0, 0.12, 0.55), std('#1b1847'), 0, 1.18, 0.6);
    panel.rotation.x = 0.28;
    g.add(panel);
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), std('#222'), -0.22, 1.3, 0.62));
    g.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), std('#ff3b5c', { roughness: 0.3 }), -0.22, 1.39, 0.62));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), glow('#4fc3ff', 1.2), 0.12, 1.26, 0.64));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), glow('#ffd36b', 1.2), 0.3, 1.24, 0.68));
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), glow('#ff9a3c', 1.0), 0, 0.55, 0.48));
    this.room.add(g);
    this.register('arcade', g, new THREE.Vector3(0, 2.2, 0.5));
  }

  // ---------------------------------------------------------------- bookshelf
  private buildBookshelf() {
    const g = new THREE.Group();
    g.position.set(-4.62, 0, -1.8);
    const D = 0.65, W = 2.4, H = 3.2;
    const wood = this.mats.darkWood;
    g.add(mesh(new THREE.BoxGeometry(D, H, 0.1), wood, 0, H / 2, -W / 2 + 0.05));
    g.add(mesh(new THREE.BoxGeometry(D, H, 0.1), wood, 0, H / 2, W / 2 - 0.05));
    g.add(mesh(new THREE.BoxGeometry(D + 0.06, 0.1, W + 0.06), wood, 0, H - 0.05, 0));
    g.add(mesh(new THREE.BoxGeometry(0.05, H, W), wood, -D / 2 + 0.025, H / 2, 0));
    const levels = [0.1, 0.85, 1.6, 2.35];
    for (const y of levels) g.add(mesh(new THREE.BoxGeometry(D, 0.06, W - 0.1), wood, 0, y - 0.03, 0));

    const palette = ['#e36b6b', '#f2c14e', '#5fb3a1', '#6c8cf5', '#c77dff', '#ff9f68', '#3d5a80', '#e8d5b7', '#7ed957'];
    levels.forEach((y, li) => {
      let z = -W / 2 + 0.14;
      let redPlaced = false;
      while (z < W / 2 - 0.2) {
        if (Math.random() < 0.08) { z += rand(0.1, 0.25); continue; }
        const bw = rand(0.08, 0.16);
        const isRed = li === 2 && !redPlaced && z > -0.1;
        const bh = isRed ? 0.6 : rand(0.38, 0.62);
        const bd = rand(0.4, 0.5);
        const b = mesh(new THREE.BoxGeometry(bd, bh, bw), std(isRed ? '#e0413a' : palette[Math.floor(Math.random() * palette.length)], { roughness: 0.7 }), isRed ? 0.12 : rand(-0.04, 0.04), y + bh / 2, z + bw / 2);
        if (!isRed && Math.random() < 0.08) b.rotation.x = rand(-0.18, 0.18);
        g.add(b);
        if (isRed) {
          redPlaced = true;
          this.redbook = b;
        } else {
          this.books.push(b);
        }
        z += bw + 0.01;
      }
    });
    const topPot = mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 12), std('#e07a5f'), 0, H + 0.11, -0.7);
    g.add(topPot);
    for (let i = 0; i < 6; i++) {
      const leaf = mesh(new THREE.SphereGeometry(0.12, 8, 6), std('#3fa36b'), rand(-0.12, 0.12), H + 0.3 + rand(0, 0.15), -0.7 + rand(-0.12, 0.12));
      leaf.scale.y = 0.6;
      g.add(leaf);
    }
    g.add(mesh(new RoundedBoxGeometry(0.4, 0.3, 0.4, 2, 0.04), std('#4fc3a1'), 0, H + 0.15, 0.6));
    this.bookshelf = g;
    this.room.add(g);
    this.register('bookshelf', g, new THREE.Vector3(0.3, 2.6, 0));
    this.register('redbook', this.redbook, new THREE.Vector3(0.25, 0.35, 0), false);
  }

  // ---------------------------------------------------------------- plant
  private buildPlant() {
    const g = new THREE.Group();
    g.position.set(-4.2, 0, -4.2);
    const pot = std('#d9825b', { roughness: 0.8 });
    g.add(mesh(new THREE.CylinderGeometry(0.45, 0.34, 0.8, 18), pot, 0, 0.4, 0));
    g.add(mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 24).rotateX(Math.PI / 2), pot, 0, 0.8, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 18), std('#3b2618'), 0, 0.76, 0));
    const growth = new THREE.Group();
    growth.position.y = 0.76;
    const greens = ['#3fa36b', '#2e7d55', '#5cbf7d', '#2a6b4a'];
    for (let i = 0; i < 14; i++) {
      const hgt = rand(1.0, 1.9);
      const geo = new THREE.ConeGeometry(0.11, hgt, 4, 1);
      geo.translate(0, hgt / 2, 0);
      const blade = mesh(geo, std(greens[i % greens.length], { roughness: 0.7 }));
      blade.scale.z = 0.35;
      const a = i * 2.4;
      blade.position.set(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12);
      blade.rotation.set(Math.sin(a) * rand(0.15, 0.45), a, Math.cos(a) * rand(0.15, 0.45));
      growth.add(blade);
    }
    g.add(growth);
    this.plantGrowth = growth;
    this.room.add(g);
    this.register('plant', g, new THREE.Vector3(0, 2.4, 0));
  }

  // ---------------------------------------------------------------- clock
  private buildClock() {
    const g = new THREE.Group();
    g.position.set(1.9, 3.65, -4.95);
    const dial = canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = '#fbf3e4';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#2a2046';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r1 = i % 3 === 0 ? 92 : 100;
        ctx.save();
        ctx.translate(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1);
        ctx.rotate(a);
        ctx.fillRect(-3, -6, 6, i % 3 === 0 ? 18 : 10);
        ctx.restore();
      }
      ctx.font = '700 22px Caveat, cursive';
      ctx.textAlign = 'center';
      ctx.fillText('little time', 128, 172);
    });
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.08, 40),
      [std('#2a2046'), std('#ffffff', { map: dial.tex, roughness: 0.4 }), std('#2a2046')],
    );
    face.rotation.x = Math.PI / 2;
    face.rotation.y = Math.PI;
    face.castShadow = true;
    g.add(face);
    g.add(mesh(new THREE.TorusGeometry(0.5, 0.05, 10, 40), std('#ff7eb6', { roughness: 0.4 }), 0, 0, 0.02));
    const handMat = std('#2a2046');
    const hg = new THREE.BoxGeometry(0.05, 0.26, 0.02).translate(0, 0.11, 0);
    const mg = new THREE.BoxGeometry(0.035, 0.38, 0.02).translate(0, 0.17, 0);
    this.clockHour = mesh(hg, handMat, 0, 0, 0.06);
    this.clockMinute = mesh(mg, handMat, 0, 0, 0.075);
    g.add(this.clockHour, this.clockMinute);
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12).rotateX(Math.PI / 2), std('#ff7eb6'), 0, 0, 0.09));
    this.room.add(g);
    this.register('clock', g, new THREE.Vector3(0, 0.55, 0.1));
  }

  // ---------------------------------------------------------------- neon cloud
  private buildNeon() {
    const pts: THREE.Vector3[] = [];
    const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n: number) => {
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
      }
    };
    pts.push(new THREE.Vector3(-0.35, -0.22, 0), new THREE.Vector3(0.35, -0.22, 0));
    arc(0.4, 0.0, 0.22, -Math.PI / 2, Math.PI / 2.4, 8);
    arc(0.03, 0.12, 0.32, Math.PI / 8, Math.PI * 0.92, 12);
    arc(-0.42, -0.02, 0.2, Math.PI * 0.6, Math.PI * 1.5, 8);
    const curve = new THREE.CatmullRomCurve3(pts, true);
    this.neonMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#5ab8ff', emissiveIntensity: 3.2 });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.028, 8, true), this.neonMat);
    const g = new THREE.Group();
    g.position.set(3.55, 3.75, -4.93);
    g.scale.setScalar(1.25);
    g.add(tube);
    this.room.add(g);
    this.register('neon', g, new THREE.Vector3(0, 0.45, 0.1));
  }

  // ---------------------------------------------------------------- poster
  private buildPoster() {
    const art = canvasTex(512, 680, (ctx) => {
      const gr = ctx.createLinearGradient(0, 0, 0, 680);
      gr.addColorStop(0, '#2b1b5e');
      gr.addColorStop(1, '#ff7eb6');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 512, 680);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 400, 3, 3);
      }
      ctx.fillStyle = '#ffd36b';
      ctx.beginPath();
      ctx.arc(256, 260, 110, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.ellipse(256, 260, 190, 46, -0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '700 70px Caveat, cursive';
      ctx.fillText('nothing is', 256, 500);
      ctx.fillText('what it seems', 256, 575);
    });
    const g = new THREE.Group();
    g.position.set(0.55, 3.75, -4.96);
    const inner = new THREE.Group();
    inner.position.y = -0.62;
    inner.add(mesh(new THREE.BoxGeometry(0.98, 1.28, 0.04), this.mats.frame, 0, 0, 0));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.17), std('#fff', { map: art.tex, roughness: 0.5 }));
    pic.position.z = 0.025;
    inner.add(pic);
    g.add(inner);
    g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), this.mats.gold, 0, 0.0, 0.02));
    g.rotation.z = 0.06;
    this.poster = g;
    this.room.add(g);
    this.register('poster', g, new THREE.Vector3(0, -0.1, 0.1));
  }

  // ---------------------------------------------------------------- glyph wall
  private buildGlyphs() {
    const zs = [2.15, 2.85, 3.55, 4.25];
    GLYPH_WALL.forEach((gl, i) => {
      const tile = new THREE.Group();
      tile.position.set(-4.96, 2.65, zs[i]);
      tile.add(mesh(new RoundedBoxGeometry(0.1, 0.56, 0.56, 2, 0.04), std('#3b2f62', { roughness: 0.9 }), 0, 0, 0));
      const t = canvasTex(128, 128, (ctx) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#fff';
        drawGlyph(ctx, gl, 64, 66, 40);
        ctx.fill();
      });
      const mat = new THREE.MeshStandardMaterial({ color: '#4a3d78', emissive: '#7df9ff', emissiveMap: t.tex, emissiveIntensity: 0.35, roughness: 0.9 });
      this.glyphMats.push(mat);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), mat);
      face.rotation.y = Math.PI / 2;
      face.position.x = 0.056;
      tile.add(face);
      this.room.add(tile);
      this.glyphTiles.push(tile);
      this.register(`glyph${i}`, tile, new THREE.Vector3(0.1, 0.3, 0), false);
    });
  }

  // ---------------------------------------------------------------- rug, table, box
  private buildRugAndTable() {
    const rugTex = canvasTex(1024, 1024, (ctx) => {
      const rings = ['#5b3a8c', '#ff8fb1', '#3a2d68', '#ffcf8a', '#5b3a8c', '#7cc6c0', '#3a2d68', '#ff8fb1', '#2a1f4e'];
      rings.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(512, 512, 512 - i * 54, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 6;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(512 + Math.cos(a) * 390, 512 + Math.sin(a) * 390, 26, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
        ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
      }
    });
    this.rug = new THREE.Mesh(new THREE.CircleGeometry(2.5, 64), std('#fff', { map: rugTex.tex, roughness: 1 }));
    this.rug.rotation.x = -Math.PI / 2;
    this.rug.position.set(0.4, 0.012, 0.9);
    this.rug.receiveShadow = true;
    this.room.add(this.rug);
    this.register('rug', this.rug, new THREE.Vector3(1.6, -1.6, 0.1));

    const table = new THREE.Group();
    table.position.set(0.5, 0, 1.0);
    table.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.09, 40), this.mats.wood, 0, 0.58, 0));
    table.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.52, 12), this.mats.darkWood, 0, 0.28, 0));
    table.add(mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.05, 24), this.mats.darkWood, 0, 0.03, 0));
    this.room.add(table);

    const pizza = mesh(new THREE.BoxGeometry(0.55, 0.06, 0.55), std('#e8c79a'), 1.05, 0.66, 1.3);
    pizza.rotation.y = 0.4;
    this.room.add(pizza);
    const can = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12), std('#e63946', { metalness: 0.6, roughness: 0.3 }), 1.05, 0.73, 0.5);
    this.room.add(can);
    this.floatables.push(pizza, can);

    // the suspicious box
    const box = new THREE.Group();
    box.position.set(0.15, 0.625, 0.9);
    box.rotation.y = 0.5;
    const body = new THREE.Group();
    const purple = std('#7b4bd1', { roughness: 0.45 });
    body.add(mesh(new RoundedBoxGeometry(0.62, 0.42, 0.48, 3, 0.04), purple, 0, 0.21, 0));
    body.add(mesh(new THREE.BoxGeometry(0.1, 0.43, 0.5), this.mats.gold, 0, 0.215, 0));
    body.add(mesh(new THREE.BoxGeometry(0.15, 0.17, 0.05), this.mats.gold, 0, 0.36, 0.26));
    body.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8).rotateX(Math.PI / 2), std('#1a1030'), 0, 0.37, 0.29));
    const q = canvasTex(128, 128, (ctx) => {
      ctx.fillStyle = '#ffd36b';
      ctx.font = '900 100px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 64, 70);
    });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshStandardMaterial({ map: q.tex, transparent: true, emissive: '#ffd36b', emissiveMap: q.tex, emissiveIntensity: 0.6 }));
      p.position.set(s * 0.315, 0.21, 0);
      p.rotation.y = (s * Math.PI) / 2;
      body.add(p);
    }
    this.boxGlow = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffd36b', emissiveIntensity: 0 });
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.4), this.boxGlow);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.4;
    body.add(inner);
    box.add(body);
    this.boxBody = body;

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.42, -0.24);
    lidPivot.add(mesh(new RoundedBoxGeometry(0.66, 0.12, 0.52, 3, 0.04), purple, 0, 0.06, 0.24));
    lidPivot.add(mesh(new THREE.BoxGeometry(0.1, 0.125, 0.54), this.mats.gold, 0, 0.06, 0.24));
    box.add(lidPivot);
    this.boxLid = lidPivot;

    this.boxBeams = new THREE.Group();
    this.boxBeams.position.y = 0.42;
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.ConeGeometry(0.22, 2.6, 16, 1, true);
      geo.translate(0, -1.3, 0);
      geo.rotateX(Math.PI);
      const beam = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe08a').multiplyScalar(1.6), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      beam.rotation.set(rand(-0.35, 0.35), rand(0, 3), rand(-0.35, 0.35));
      this.boxBeams.add(beam);
    }
    this.boxBeams.scale.setScalar(0.001);
    this.boxBeams.visible = false;
    box.add(this.boxBeams);
    this.room.add(box);
    this.floatables.push(box);
    this.register('box', box, new THREE.Vector3(0, 0.6, 0));
  }

  // ---------------------------------------------------------------- lamp
  private buildLamp() {
    const g = new THREE.Group();
    g.position.set(4.05, 0, 0.6);
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 20), this.mats.frame, 0, 0.03, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.35, 8), this.mats.gold, 0, 1.2, 0));
    this.lampShade = new THREE.MeshStandardMaterial({ color: '#ffe6c4', emissive: '#ffb36b', emissiveIntensity: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
    const shade = mesh(new THREE.CylinderGeometry(0.26, 0.44, 0.5, 24, 1, true), this.lampShade, 0, 2.45, 0);
    shade.castShadow = false;
    g.add(shade);
    this.lampBulb = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffd59a', emissiveIntensity: 2 });
    g.add(mesh(new THREE.SphereGeometry(0.1, 12, 8), this.lampBulb, 0, 2.36, 0));
    this.room.add(g);
    this.register('lamp', g, new THREE.Vector3(0, 2.75, 0));
  }

  // ---------------------------------------------------------------- beanbag
  private buildBeanbag() {
    const g = new THREE.Group();
    g.position.set(-3.1, 0, 3.4);
    const inner = mesh(new THREE.SphereGeometry(0.9, 32, 20), std('#f29e4c', { roughness: 0.95 }), 0, 0.42, 0);
    inner.scale.set(1, 0.55, 1);
    g.add(inner);
    const pillow = mesh(new RoundedBoxGeometry(0.55, 0.18, 0.45, 3, 0.08), std('#7cc6c0', { roughness: 0.95 }), 0.1, 0.82, -0.15);
    // Was rotated (0.3, 0.4, 0.1) — from the default camera angle that presented the
    // thin 0.18-tall face edge-on, so the pillow read as a flat blue wedge instead of
    // a soft cushion. A gentler tilt keeps the casual "tossed there" look without that.
    pillow.rotation.set(0.12, 0.15, 0.08);
    g.add(pillow);
    this.beanbagInner = inner;
    this.room.add(g);
    this.register('beanbag', g, new THREE.Vector3(0, 1.1, 0));
  }

  // ---------------------------------------------------------------- decor
  private buildDecor() {
    const books = new THREE.Group();
    books.position.set(0.9, 0, -4.5);
    ['#3d5a80', '#ff9f68', '#c77dff', '#5fb3a1'].forEach((c, i) => {
      const b = mesh(new THREE.BoxGeometry(0.55 - i * 0.04, 0.1, 0.4), std(c), 0, 0.05 + i * 0.1, 0);
      b.rotation.y = rand(-0.25, 0.25);
      books.add(b);
    });
    this.room.add(books);
    this.floatables.push(books);

    const cactus = new THREE.Group();
    cactus.position.set(1.55, 0, -4.55);
    cactus.add(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 12), std('#ff8fb1'), 0, 0.15, 0));
    cactus.add(mesh(new THREE.CapsuleGeometry(0.12, 0.45, 4, 8), std('#4caf7a'), 0, 0.6, 0));
    cactus.add(mesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 8), std('#4caf7a'), 0.14, 0.62, 0).rotateZ(-0.9));
    this.room.add(cactus);
    this.floatables.push(cactus);

    const fern = new THREE.Group();
    fern.position.set(4.35, 0, 4.3);
    fern.add(mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 14), std('#7c66c9'), 0, 0.25, 0));
    for (let i = 0; i < 12; i++) {
      const l = mesh(new THREE.SphereGeometry(0.22, 8, 6), std(i % 2 ? '#3fa36b' : '#5cbf7d'), rand(-0.25, 0.25), 0.6 + rand(0, 0.45), rand(-0.25, 0.25));
      l.scale.set(1, 0.6, 1.4);
      l.rotation.y = rand(0, 3);
      fern.add(l);
    }
    this.room.add(fern);

    const side = new THREE.Group();
    side.position.set(-1.7, 0, 3.9);
    side.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 20), this.mats.wood, 0, 0.55, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      side.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), this.mats.darkWood, Math.cos(a) * 0.22, 0.27, Math.sin(a) * 0.22));
    }
    side.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 12), std('#fff4e0'), 0, 0.67, 0));
    const flame = mesh(new THREE.SphereGeometry(0.035, 8, 6), glow('#ffb347', 5), 0, 0.8, 0);
    flame.scale.y = 1.8;
    side.add(flame);
    this.flames.push(flame);
    this.room.add(side);
  }

  // ---------------------------------------------------------------- string lights
  private buildStringLights() {
    const cols = ['#ffcf6b', '#ff7eb6', '#7df9ff', '#b388ff'];
    const run = (a: THREE.Vector3, b: THREE.Vector3, n: number) => {
      const pts: THREE.Vector3[] = [];
      const seg = 6;
      for (let s = 0; s < seg; s++) {
        for (let i = 0; i <= 20; i++) {
          const t = s / seg + i / 20 / seg;
          const p = a.clone().lerp(b, t);
          const local = (t * seg) % 1;
          p.y -= Math.sin(local * Math.PI) * 0.28;
          pts.push(p);
        }
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1a1430' }));
      this.room.add(line);
      for (let i = 0; i < n; i++) {
        const p = pts[Math.floor((i / n) * pts.length + pts.length / n / 2)];
        const base = new THREE.Color(cols[i % cols.length]);
        const mat = new THREE.MeshStandardMaterial({ color: '#000', emissive: base, emissiveIntensity: 2.4 });
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mat);
        m.position.copy(p).y -= 0.05;
        this.room.add(m);
        this.bulbs.push({ mesh: m, mat, base });
      }
    };
    run(new THREE.Vector3(-4.95, 4.65, -4.9), new THREE.Vector3(4.95, 4.65, -4.9), 30);
    run(new THREE.Vector3(-4.9, 4.65, -4.9), new THREE.Vector3(-4.9, 4.65, 4.95), 30);
  }

  // ---------------------------------------------------------------- secret alcove
  private buildAlcove() {
    const g = new THREE.Group();
    const stars = canvasTex(512, 512, (ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(${200 + Math.random() * 55},${180 + Math.random() * 75},255,${Math.random()})`;
        const s = Math.random() < 0.1 ? 3 : 1.5;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, s, s);
      }
    });
    const wall = new THREE.MeshStandardMaterial({ color: '#2b1f55', emissive: '#ffffff', emissiveMap: stars.tex, emissiveIntensity: 0.9, roughness: 0.9 });
    const plain = std('#2b1f55', { roughness: 0.9 });
    g.add(mesh(new THREE.BoxGeometry(2.8, 0.5, 2.9), plain, -6.7, -0.25, -1.8));
    g.add(mesh(new THREE.BoxGeometry(0.3, 3.1, 2.9), wall, -8.0, 1.4, -1.8));
    g.add(mesh(new THREE.BoxGeometry(2.8, 3.1, 0.3), wall, -6.7, 1.4, -3.15));
    g.add(mesh(new THREE.BoxGeometry(2.8, 3.1, 0.3), wall, -6.7, 1.4, -0.45));
    g.add(mesh(new THREE.BoxGeometry(2.8, 0.3, 2.9), plain, -6.7, 2.95, -1.8));

    g.add(mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.9, 16), std('#5a4a8f', { roughness: 0.6 }), -6.95, 0.45, -1.8));
    const ring = mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 32).rotateX(Math.PI / 2), glow('#b388ff', 3), -6.95, 0.92, -1.8);
    g.add(ring);
    this.tesseract = new Tesseract(0x7df9ff, 0.38);
    this.tesseract.lines.position.set(-6.95, 1.6, -1.8);
    g.add(this.tesseract.lines);
    const tHit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    tHit.position.copy(this.tesseract.lines.position);
    g.add(tHit);
    this.register('tesseract', tHit, new THREE.Vector3(0, 0.5, 0), false);

    const letters = ['R', 'D', 'O', 'W', 'L'];
    const homes = [
      new THREE.Vector3(-5.75, 1.9, -2.55),
      new THREE.Vector3(-6.4, 1.15, -2.6),
      new THREE.Vector3(-5.7, 0.85, -1.0),
      new THREE.Vector3(-6.25, 2.25, -1.25),
      new THREE.Vector3(-5.85, 1.45, -1.75),
    ];
    letters.forEach((l, i) => {
      const t = letterTexture(l, { fg: '#ffd36b', bg: '#4b2f9a', size: 256 });
      const mat = new THREE.MeshStandardMaterial({ map: t.tex, emissive: '#ffffff', emissiveMap: t.tex, emissiveIntensity: 0.55, roughness: 0.4 });
      const c = mesh(new RoundedBoxGeometry(0.4, 0.4, 0.4, 3, 0.05), mat);
      c.position.copy(homes[i]);
      c.userData.letter = l;
      c.userData.phase = i * 1.3;
      c.visible = false;
      this.cubes.push(c);
      this.cubeHome.push(homes[i].clone());
      this.room.add(c);
      this.register(`cube${i}`, c, new THREE.Vector3(0, 0.35, 0), false);
    });

    this.alcove = g;
    this.room.add(g);
  }

  // ---------------------------------------------------------------- dust
  private buildDust() {
    const N = 520;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos.set([rand(-5, 16), rand(0.2, 4.8), rand(-5, 13.5)], i * 3);
      seed[i] = Math.random() * 50;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixel: { value: Math.min(window.devicePixelRatio, 2) }, uColor: { value: new THREE.Color('#ffd9a8') } },
      vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPixel; varying float vA;
        void main(){ vec3 p = position; p.x += sin(uTime*0.2 + aSeed)*0.3; p.y += sin(uTime*0.15 + aSeed*2.0)*0.25; p.z += cos(uTime*0.18 + aSeed)*0.3;
        vA = 0.35 + 0.35*sin(uTime*1.3 + aSeed*4.0);
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = uPixel * 60.0 / -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(uColor*1.5, smoothstep(0.5,0.0,d)*vA); }`,
    });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.userData.ignoreRay = true;
    this.root.add(this.dust);
  }

  setDustColor(c: THREE.ColorRepresentation) { (this.dustMat.uniforms.uColor.value as THREE.Color).set(c); }

  // ---------------------------------------------------------------- house state
  setPaint(id: RoomId, paint: PaintId) {
    const r = this.rooms.get(id)!;
    const p = PAINTS[paint] ?? PAINTS.violet;
    r.wall.color.set(p.wall);
    r.wallLow.color.set(p.wallLow);
  }

  /** Locked rooms keep their floor and walls but hide everything inside, and
   *  show a floating padlock instead. Lights stay in the scene at zero
   *  intensity (changing the light count would recompile every shader). */
  setRoomLocked(id: RoomId, locked: boolean) {
    const r = this.rooms.get(id)!;
    r.locked = locked;
    r.group.visible = !locked;
    r.lock.visible = locked;
    for (const l of r.lights) {
      if (l.userData.base === undefined) l.userData.base = this.lightBase.get(l) ?? l.intensity;
      if (locked) {
        this.lightBase.delete(l);
        l.intensity = 0;
      } else if (!l.userData.manual) {
        this.lightBase.set(l, l.userData.base as number);
        l.intensity = l.userData.base as number;
      }
    }
    if (locked) for (const [hid, s] of this.hotspots) if (this.zoneOf(hid) === id) s.visible = false;
  }

  /** Interior walls between the camera and the focused room drop to CUT_H so
   *  the room is always fully visible; in the whole-house view they all drop. */
  setFocus(focus: RoomId | null, instant = false) {
    this.focus = focus;
    const r = focus ? this.rooms.get(focus)! : null;
    for (const w of this.cutWalls) {
      const full = !!r && focus !== 'observatory' && (w.axis === 'z' ? w.at <= r.z0 + 0.01 : w.at <= r.x0 + 0.01);
      const cut = !full;
      if (cut === w.cut && !instant) continue;
      w.cut = cut;
      const k = cut ? CUT_H / WALL_H : 1;
      gsap.killTweensOf(w.group.scale);
      if (instant) w.group.scale.y = k;
      else gsap.to(w.group.scale, { y: k, duration: 0.7, ease: 'power2.inOut' });
      for (const d of w.doors) {
        if (cut) d.visible = false;
        else if (instant) d.visible = true;
        else gsap.delayedCall(0.45, () => { if (!w.cut) d.visible = true; });
      }
    }
    for (const m of this.mounts) {
      const full = !!r && focus !== 'observatory' && (m.axis === 'z' ? m.at <= r.z0 + 0.01 : m.at <= r.x0 + 0.01);
      if (!full) m.obj.visible = false;
      else if (instant) m.obj.visible = true;
      else gsap.delayedCall(0.45, () => { if (this.focus === focus) m.obj.visible = true; });
    }
  }

  mount(obj: THREE.Object3D, axis: 'x' | 'z', at: number) {
    this.mounts.push({ obj, axis, at });
    return obj;
  }

  setDoor(id: string, open: boolean, instant = false): Promise<void> {
    const d = this.doors.get(id);
    if (!d) return Promise.resolve();
    d.open = open;
    d.padlock.visible = !open;
    const rot = open ? d.opened : d.closed;
    if (instant) {
      d.leaf.rotation.y = rot;
      return Promise.resolve();
    }
    return new Promise((res) => gsap.to(d.leaf.rotation, { y: rot, duration: 1.4, ease: 'power2.inOut', onComplete: () => res() }));
  }

  setLightsMode(mode: LightsMode) {
    this.lightsMode = mode;
    const cols = mode === 'ice' ? ['#bfefff', '#7df9ff', '#ffffff', '#9cc8ff'] : ['#ffcf6b', '#ff7eb6', '#7df9ff', '#b388ff'];
    this.bulbs.forEach((b, i) => {
      b.base.set(cols[i % cols.length]);
      b.mat.emissive.copy(b.base);
    });
  }

  /** Real-world time of day tints the house light (the sky itself is handled by Sky). */
  setDayPhase(phase: 'dawn' | 'day' | 'dusk' | 'night') {
    const { hemi, key } = this.lights;
    const P = {
      night: { sky: '#9a8cf0', ground: '#3a2238', hi: 1.25, key: '#d6c8ff', ki: 1.3 },
      dawn: { sky: '#ffb8d0', ground: '#4a2a48', hi: 1.45, key: '#ffd2b0', ki: 1.6 },
      day: { sky: '#d4dcff', ground: '#5a4a6a', hi: 1.7, key: '#fff4e0', ki: 2.0 },
      dusk: { sky: '#ff9f80', ground: '#4a2238', hi: 1.4, key: '#ffb07a', ki: 1.5 },
    }[phase];
    hemi.color.set(P.sky);
    hemi.groundColor.set(P.ground);
    key.color.set(P.key);
    hemi.intensity = P.hi;
    key.intensity = P.ki;
    this.lightBase.set(hemi, P.hi);
    this.lightBase.set(key, P.ki);
  }

  // ---------------------------------------------------------------- lights
  private buildLights() {
    const hemi = new THREE.HemisphereLight('#9a8cf0', '#3a2238', 1.25);
    const key = new THREE.DirectionalLight('#d6c8ff', 1.3);
    key.position.set(17, 24, 19);
    key.target.position.set(5.5, 0, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const b = 17;
    key.shadow.camera.left = -b;
    key.shadow.camera.right = b;
    key.shadow.camera.top = b;
    key.shadow.camera.bottom = -b;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 70;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 4;

    const lamp = new THREE.PointLight('#ffb36b', 14, 0, 1.6);
    lamp.position.set(4.05, 2.3, 0.6);
    const monitor = new THREE.PointLight('#6fe3ff', 2.2, 5, 1.8);
    monitor.position.set(-1.85, 1.6, -3.7);
    const neon = new THREE.PointLight('#5ab8ff', 2.5, 5, 1.8);
    neon.position.set(3.5, 3.7, -4.3);
    const arcade = new THREE.PointLight('#ff4fd8', 0, 5, 1.6);
    arcade.position.set(3.8, 1.9, -3.0);
    const alcove = new THREE.PointLight('#b07cff', 0, 6, 1.4);
    alcove.position.set(-6.3, 2.2, -1.8);
    const box = new THREE.PointLight('#ffd36b', 0, 5, 1.5);
    box.position.set(0.15, 1.4, 0.9);
    const fill = new THREE.PointLight('#ff9ad5', 6, 14, 1.4);
    fill.position.set(0, 4.2, 1.5);

    this.root.add(hemi, key, key.target, monitor, arcade, alcove, box);
    this.lights = { hemi, key, lamp, monitor, neon, arcade, alcove, box, fill };
    for (const l of [hemi, key]) this.lightBase.set(l, l.intensity);
    // The study's always-on lights belong to the study, so they go dark while it's locked.
    this.useZone('study');
    for (const l of [lamp, neon, fill]) this.addLight(l);
  }

  update(dt: number, t: number) {
    this.dustMat.uniforms.uTime.value = t;
    for (const r of this.rocks) {
      const o = r.userData.orbit;
      o.a += dt * o.s;
      r.position.set(5.5 + Math.cos(o.a) * o.r, o.y + Math.sin(t * 0.6 + o.a * 3) * 0.4, 4 + Math.sin(o.a) * o.r);
      r.rotation.x += dt * 0.2;
      r.rotation.y += dt * 0.15;
    }
    this.tesseract.update(dt);
    for (const s of this.spinners) s.rotation.y += dt * 0.8;
    for (const f of this.flames) {
      if (!f.visible) continue;
      const k = 1 + Math.sin(t * 11 + f.position.x) * 0.18 + (Math.random() - 0.5) * 0.12;
      f.scale.set(k, 1.8 * k, k);
      (f.material as THREE.MeshStandardMaterial).emissiveIntensity = 4.6 + Math.sin(t * 17) * 1.1 + Math.random() * 0.4;
    }
    for (let i = 0; i < this.cubes.length; i++) {
      const c = this.cubes[i];
      if (c.userData.placed || !c.visible) continue;
      const home = this.cubeHome[i];
      c.position.y = home.y + Math.sin(t * 1.4 + c.userData.phase) * 0.08;
      c.rotation.y += dt * 0.5;
      c.rotation.x = Math.sin(t * 0.8 + c.userData.phase) * 0.25;
    }
    for (const [id, s] of this.hotspots) {
      if (!s.visible) continue;
      this.anchorOf(id, s.position);
      s.position.y += 0.25;
      const k = 0.3 + Math.sin(t * 3 + id.length) * 0.06;
      s.scale.setScalar(k);
    }
    for (const r of this.rooms.values()) {
      if (!r.lock.visible) continue;
      r.lock.rotation.y += dt * 0.6;
      r.lock.position.y = r.floorY + 2.4 + Math.sin(t * 1.5 + r.x0) * 0.15;
    }
    for (const u of this.updaters) u(dt, t);
    for (const t2 of this.trophyRing.children) {
      const o = t2.userData.orbit;
      if (!o) continue;
      o.a += dt * 0.25;
      t2.position.set(5.5 + Math.cos(o.a) * o.r, o.y + Math.sin(t * 1.2 + o.a * 2) * 0.3, 4 + Math.sin(o.a) * o.r);
      t2.rotation.y += dt;
      t2.rotation.x += dt * 0.5;
    }
  }

  makeGlyphTexture(text: string) {
    return letterTexture(text, { glow: true });
  }
}
