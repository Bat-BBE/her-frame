import './style.css';
import './house.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { World } from './world';
import { Sky } from './sky';
import { Creature } from './creature';
import { Shadow } from './shadow';
import { Avatar } from './avatar';
import { Game } from './game';
import { sound } from './audio';
import { initUI, ui, icon } from './ui';
import { hasSave } from './state';
import { ROOMS, type RoomId } from './data';

const canvas = document.getElementById('scene') as HTMLCanvasElement;

function fail() {
  document.getElementById('start-btn')?.remove();
  const p = document.querySelector('.start-hint');
  if (p) p.textContent = 'Уучлаарай, энэ төхөөрөмж/хөтөч WebGL дэмжихгүй байна. Chrome, Safari эсвэл Firefox-ийн шинэ хувилбараар нээгээрэй.';
}

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  fail();
  throw new Error('WebGL unavailable');
}

const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d0a1f');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 1200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.32;
controls.minAzimuthAngle = 0.08;
controls.maxAzimuthAngle = 1.48;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.8;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.46, 0.5, 0.88);
composer.addPass(bloom);
const rgbShift = new ShaderPass(RGBShiftShader);
rgbShift.uniforms.amount.value = 0;
rgbShift.enabled = false;
composer.addPass(rgbShift);
composer.addPass(new OutputPass());
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(innerWidth, innerHeight);

initUI();
const world = new World(scene);
const sky = new Sky(scene);
sky.camera = camera;
const creature = new Creature(world);
const shadow = new Shadow(world.root);
const avatar = new Avatar(world.root);

// ------------------------------------------------------------------ camera framing
/** What the camera frames: a room, or the whole floating house (null). */
let view: RoomId | null = null;
const HOUSE_TARGET = new THREE.Vector3(12.5, 0.2, 2.6);
const target = new THREE.Vector3();
let homeDist = 28;

function viewScale(id: RoomId | null) {
  if (!id) return 2.7;
  const r = world.rooms.get(id)!;
  return Math.max(0.78, r.size / 10.3);
}

function viewTarget(id: RoomId | null, out = new THREE.Vector3()) {
  if (!id) return out.copy(HOUSE_TARGET);
  const r = world.rooms.get(id)!;
  return out.copy(r.center).setY(r.floorY + 1.3);
}

function fit() {
  const aspect = innerWidth / innerHeight;
  camera.fov = aspect < 1 ? 42 : 30;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  const v = THREE.MathUtils.degToRad(camera.fov / 2);
  const hh = Math.atan(Math.tan(v) * aspect);
  const k = viewScale(view);
  homeDist = Math.max(6.7 / Math.tan(v), 7.8 / Math.tan(hh)) * k;
  controls.minDistance = homeDist * 0.42;
  const farDist = Math.max(9.4 / Math.tan(v), 16.7 / Math.tan(hh)) * k;
  controls.maxDistance = Math.max(homeDist * 1.4, farDist);
}

const viewPos = () => new THREE.Vector3().setFromSphericalCoords(homeDist, 0.98, 0.78).add(target);

function focusRoom(id: RoomId | null, animate = true): Promise<void> {
  view = id;
  viewTarget(id, target);
  fit();
  game.onFocus(id);
  const pos = viewPos();
  if (!animate) {
    controls.target.copy(target);
    camera.position.copy(pos);
    camera.lookAt(target);
    return Promise.resolve();
  }
  controls.enabled = false;
  // Lift the camera over the house on long hops so it doesn't skim through walls.
  const far = camera.position.distanceTo(pos) > 18;
  return new Promise((res) => {
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: far ? 1.9 : 1.4, ease: 'power2.inOut' });
    const tl = gsap.timeline({ onUpdate: () => camera.lookAt(controls.target), onComplete: () => { controls.enabled = true; res(); } });
    tl.to(camera.position, { x: pos.x, z: pos.z, duration: far ? 1.9 : 1.4, ease: 'power2.inOut' }, 0);
    if (far) tl.to(camera.position, { keyframes: [{ y: Math.max(camera.position.y, pos.y) + 6, duration: 0.95, ease: 'power2.out' }, { y: pos.y, duration: 0.95, ease: 'power2.in' }] }, 0);
    else tl.to(camera.position, { y: pos.y, duration: 1.4, ease: 'power2.inOut' }, 0);
  });
}

const game = new Game({
  world, sky, creature, shadow, avatar, camera, controls, rgbShift, focusRoom,
  snapshot: () => {
    composer.render();
    return renderer.domElement.toDataURL('image/png');
  },
});

// Start framed on the house; the intro flies into the saved room.
view = null;
viewTarget(null, target);
fit();
controls.target.copy(target);
camera.position.copy(new THREE.Vector3().setFromSphericalCoords(homeDist * 1.7, 0.7, 0.2).add(target));
camera.lookAt(target);
world.setFocus(null, true);

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__lw = { game, world, creature, camera, controls, sky, gsap, shadow, avatar, focusRoom };

// ------------------------------------------------------------------ picking
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const visible = (o: THREE.Object3D | null) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

/** First interactive id under the pointer, plus the world point that was hit. */
function pick(x: number, y: number): { id: string | null; point: THREE.Vector3 | null } {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(world.root, true);
  for (const hit of hits) {
    const o = hit.object;
    if (o.userData.ignoreRay || o instanceof THREE.Sprite || o instanceof THREE.Points || o instanceof THREE.Line) continue;
    if (!visible(o)) continue;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) {
      if (p.userData.iid) return { id: p.userData.iid as string, point: hit.point };
    }
    return { id: null, point: hit.point };
  }
  return { id: null, point: null };
}

function roomAt(p: THREE.Vector3): RoomId | null {
  for (const r of ROOMS) {
    const [x0, x1, z0, z1] = r.bounds;
    if (p.x >= x0 - 0.2 && p.x <= x1 + 0.2 && p.z >= z0 - 0.2 && p.z <= z1 + 0.2 && p.y > r.floorY - 0.6) return r.id;
  }
  return null;
}

let started = false;
let down: { x: number; y: number; t: number } | null = null;
let hoverId: string | null = null;
let pointer: { x: number; y: number } | null = null;

canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointerup', (e) => {
  if (!down || !started) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved < 8 && performance.now() - down.t < 700) {
    const { id, point } = pick(e.clientX, e.clientY);
    const room = point ? roomAt(point) : null;
    if (view === null && room && (!id || world.zoneOf(id) === room)) game.onRoomClick(room);
    else if (id) game.interact(id);
    else if (view !== null && room && room !== view) game.onRoomClick(room);
    else if (view !== null && room === view && point) game.walkTo(point);
    else game.onEmptyClick();
  }
  down = null;
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') pointer = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => {
  pointer = null;
  setHover(null);
});

function setHover(id: string | null) {
  if (id === hoverId) return;
  const prev = hoverId ? world.interactives.get(hoverId) : null;
  if (prev) {
    const b = prev.userData.baseScale as THREE.Vector3;
    gsap.to(prev.scale, { x: b.x, y: b.y, z: b.z, duration: 0.25 });
  }
  hoverId = id;
  const name = game.hoverName(id);
  canvas.style.cursor = name ? 'pointer' : '';
  const obj = id && name ? world.interactives.get(id) : null;
  if (obj) {
    const b = obj.userData.baseScale as THREE.Vector3;
    gsap.to(obj.scale, { x: b.x * 1.04, y: b.y * 1.04, z: b.z * 1.04, duration: 0.25, ease: 'back.out(3)' });
    sound.hover();
  }
}

// ------------------------------------------------------------------ toolbar
document.getElementById('toolbar')!.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  sound.click();
  const a = b.dataset.action;
  if (a === 'hint') game.showHint();
  else if (a === 'photo') game.takePhoto();
  else if (a === 'sound') game.toggleSound();
  else if (a === 'daily') game.openDaily();
  else if (a === 'collection') game.openCollection();
  else if (a === 'shop') game.openShop();
  else if (a === 'menu') game.openMenu();
});
for (const b of document.querySelectorAll<HTMLButtonElement>('#toolbar button')) {
  if (b.dataset.action !== 'sound') b.innerHTML = icon(b.dataset.icon!, 22);
}
document.querySelector('#sticky .x')?.addEventListener('click', () => {
  game.dismissNote();
  gsap.to('#sticky', { rotate: 20, y: 200, opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: () => document.getElementById('sticky')?.remove() });
});
document.getElementById('player')?.addEventListener('click', () => { sound.click(); game.openCollection(); });

// ------------------------------------------------------------------ start
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
if (hasSave()) startBtn.textContent = 'Үргэлжлүүлэх';
const fontsReady = Promise.race([
  Promise.all([
    document.fonts.load('700 40px Caveat'),
    document.fonts.load('800 40px Nunito'),
    document.fonts.load('12px "Press Start 2P"'),
  ]),
  new Promise((r) => setTimeout(r, 2500)),
]);
fontsReady.then(() => {
  document.getElementById('start')!.classList.add('ready');
  startBtn.disabled = false;
});

startBtn.addEventListener('click', () => {
  sound.init();
  sound.setMuted(game.s.muted);
  sound.startMusic();
  sound.whoosh();
  gsap.to('#start', { opacity: 0, duration: 0.8, onComplete: () => document.getElementById('start')!.remove() });
  const hud = document.getElementById('hud')!;
  hud.hidden = false;
  gsap.from('#hud .brand, #hud .quest, #hud .player', { y: -30, opacity: 0, duration: 0.8, stagger: 0.1, delay: 1.6, ease: 'back.out(2)' });
  gsap.from('#hud .rooms', { x: 60, opacity: 0, duration: 0.8, delay: 2.0, ease: 'back.out(2)' });
  gsap.from('#hud .toolbar', { y: 60, opacity: 0, duration: 0.8, delay: 2, ease: 'back.out(2)' });
  gsap.from('#sticky', { x: -120, rotate: -20, opacity: 0, duration: 0.8, delay: 2.4, ease: 'back.out(2)' });
  // Glide over the whole house first, then into the room you were last in.
  const first = game.s.focus ?? 'bedroom';
  viewTarget(null, target);
  fit();
  controls.enabled = false;
  const hp = viewPos();
  gsap.to(camera.position, {
    x: hp.x, y: hp.y, z: hp.z, duration: 2.6, ease: 'power3.inOut',
    onUpdate: () => camera.lookAt(controls.target),
    onComplete: () => {
      void focusRoom(game.s.rooms[first]?.unlocked ? first : 'bedroom').then(() => {
        started = true;
        game.startSession();
      });
    },
  });
});

// ------------------------------------------------------------------ loop
let resizeRaf = 0;
addEventListener('resize', () => {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    fit();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });
});

const clock = new THREE.Clock();
let t = 0;
const tmp = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  if (!started && controls.enabled) {
    camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.04).add(controls.target);
    camera.lookAt(controls.target);
  } else {
    controls.update();
  }
  world.update(dt, t);
  sky.update(dt, t);
  creature.update(dt);
  avatar.update(dt, t);
  game.update(dt, t);

  if (started && pointer && !ui.modalOpen && !game.busy) setHover(pick(pointer.x, pointer.y).id);
  else if (hoverId) setHover(null);
  const name = started && pointer && hoverId ? game.hoverName(hoverId) : null;
  ui.tooltip(name, pointer?.x, pointer?.y);

  if (ui.cardVisible && game.cardAnchor) {
    const id = game.cardAnchor;
    if (id === 'creature') tmp.copy(creature.group.position).add(new THREE.Vector3(0, 0.7, 0));
    else world.anchorOf(id, tmp);
    const p = tmp.project(camera);
    ui.placeCard((p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight, p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1);
  }

  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
