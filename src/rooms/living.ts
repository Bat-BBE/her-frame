import { THREE, canvasTex, std, glow, mesh, rbox, box, cyl, sphere, monstera, emissiveScreen, picture } from './kit';
import type { World } from '../world';

export interface LivingRefs {
  tv: ReturnType<typeof canvasTex>;
  drawer: THREE.Object3D;
  flames: THREE.Mesh[];
  fireLight: THREE.PointLight;
  soot: THREE.MeshStandardMaterial;
  painting: THREE.Object3D;
  safe: THREE.Group;
  safeDoor: THREE.Object3D;
  /** World positions of the display-cabinet slots, filled by the collection. */
  shelfSlots: THREE.Vector3[];
  shelfGroup: THREE.Group;
  fishbowl: THREE.Group;
  fish: THREE.Object3D[];
  record: THREE.Object3D;
  floorLight: THREE.PointLight;
}

export function buildLiving(w: World): LivingRefs {
  const R = w.room;
  const dark = w.mats.darkWood;
  const wood = w.mats.wood;

  // ------------------------------------------------------------------ rug
  const rugTex = canvasTex(512, 384, (ctx) => {
    ctx.fillStyle = '#8a3a4d';
    ctx.fillRect(0, 0, 512, 384);
    ctx.strokeStyle = '#f0c987';
    ctx.lineWidth = 10;
    ctx.strokeRect(22, 22, 468, 340);
    ctx.lineWidth = 4;
    ctx.strokeRect(44, 44, 424, 296);
    ctx.fillStyle = '#c45f7a';
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      ctx.save();
      ctx.translate(100 + i * 78, 100 + j * 92);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-18, -18, 36, 36);
      ctx.restore();
    }
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(Math.random() * 512, Math.random() * 384, 2, 2);
    }
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), std('#fff', { map: rugTex.tex, roughness: 1 }));
  rug.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  rug.position.set(7.9, 0.012, -1.8);
  rug.receiveShadow = true;
  R.add(rug);

  // ------------------------------------------------------------------ sideboard + record player + round window
  const side = new THREE.Group();
  side.position.set(7.2, 0, -4.68);
  side.add(rbox(2.4, 0.85, 0.62, std('#7a4a35', { roughness: 0.55 }), 0, 0.5, 0));
  for (const x of [-0.8, 0, 0.8]) side.add(box(0.7, 0.55, 0.02, std('#8d5a42'), x, 0.5, 0.32));
  for (const x of [-1.05, 1.05]) side.add(box(0.06, 0.1, 0.5, dark, x, 0.04, 0));
  const drawer = new THREE.Group();
  drawer.position.set(0.8, 0.5, 0.32);
  drawer.add(box(0.7, 0.55, 0.04, std('#9a6649'), 0, 0, 0));
  drawer.add(box(0.2, 0.04, 0.05, w.mats.gold, 0, 0.12, 0.03));
  side.add(drawer);
  R.add(side);

  const record = new THREE.Group();
  record.position.set(6.6, 0.93, -4.65);
  record.add(rbox(0.75, 0.14, 0.55, std('#2a1f3e', { roughness: 0.4 }), 0, 0.07, 0));
  const disc = new THREE.Group();
  disc.position.set(-0.08, 0.15, 0);
  disc.add(cyl(0.22, 0.22, 0.015, std('#111', { roughness: 0.3 }), 0, 0, 0, 32));
  disc.add(cyl(0.07, 0.07, 0.02, std('#ff7eb6'), 0, 0.002, 0, 16));
  record.add(disc);
  const arm = box(0.03, 0.02, 0.3, w.mats.gold, 0.22, 0.2, 0.02);
  arm.rotation.y = 0.5;
  record.add(arm);
  for (const s of [-1, 1]) record.add(rbox(0.32, 0.52, 0.3, std('#3a2a4a'), s * 0.75 + 0.1, 0.26, 0));
  for (const s of [-1, 1]) record.add(cyl(0.09, 0.09, 0.02, std('#111'), s * 0.75 + 0.1, 0.32, 0.16, 16).rotateX(Math.PI / 2));
  R.add(record);
  w.register('record', record, new THREE.Vector3(0, 0.5, 0));

  {
    const sky = canvasTex(256, 256, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
      g.addColorStop(0, '#3a2a7a');
      g.addColorStop(1, '#120a2e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random()})`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      ctx.fillStyle = '#fff4d6';
      ctx.beginPath();
      ctx.arc(170, 80, 22, 0, Math.PI * 2);
      ctx.fill();
    });
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), emissiveScreen(sky.tex, 0.9));
    win.position.set(7.2, 3.25, -4.97);
    R.add(win);
    R.add(mesh(new THREE.TorusGeometry(0.66, 0.07, 10, 40), w.mats.frame, 7.2, 3.25, -4.95));
    R.add(box(0.05, 1.3, 0.05, w.mats.frame, 7.2, 3.25, -4.94));
    R.add(box(1.3, 0.05, 0.05, w.mats.frame, 7.2, 3.25, -4.94));
  }

  // ------------------------------------------------------------------ fireplace + painting + safe
  const fx = 11.0;
  const stone = std('#9b8fa8', { roughness: 0.95, flatShading: true });
  const brick = std('#7a5a6a', { roughness: 0.95 });
  R.add(box(2.9, 5.0, 0.55, brick, fx, 2.5, -4.75));
  R.add(box(2.5, 1.6, 0.4, stone, fx, 0.8, -4.3));
  R.add(box(1.5, 1.05, 0.42, std('#120a12', { roughness: 1 }), fx, 0.62, -4.28));
  R.add(box(3.0, 0.14, 0.7, std('#5a3624'), fx, 1.66, -4.25));
  R.add(box(2.7, 0.1, 0.9, stone, fx, 0.05, -3.75));
  // mantle decor
  R.add(cyl(0.05, 0.05, 0.3, std('#fff4e0'), fx - 1.1, 1.88, -4.3, 10));
  R.add(cyl(0.05, 0.05, 0.22, std('#fff4e0'), fx - 0.9, 1.84, -4.3, 10));
  R.add(cyl(0.12, 0.08, 0.32, std('#5fb3a1'), fx + 1.0, 1.89, -4.3, 12));
  // logs
  for (const [x, r] of [[-0.25, 0.3], [0.25, -0.3], [0, 0]] as [number, number][]) {
    const log = cyl(0.08, 0.08, 0.9, std('#5a3a22'), fx + x, 0.22 + (x === 0 ? 0.12 : 0), -4.2, 8);
    log.rotation.set(0, r, Math.PI / 2);
    R.add(log);
  }
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const f = mesh(new THREE.ConeGeometry(0.12 + (i % 2) * 0.05, 0.5, 8), glow(i % 2 ? '#ff9a3c' : '#ffd36b', 4), fx - 0.4 + i * 0.2, 0.55, -4.2 + (i % 2) * 0.05);
    f.castShadow = false;
    f.visible = false;
    flames.push(f);
    w.flames.push(f);
    R.add(f);
  }
  const fireLight = w.addLight(new THREE.PointLight('#ff8a3c', 0, 9, 1.4));
  fireLight.position.set(fx, 0.9, -3.4);
  fireLight.userData.manual = true;
  const fireHit = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.7, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  fireHit.position.set(fx, 0.85, -4.1);
  R.add(fireHit);
  w.register('fireplace', fireHit, new THREE.Vector3(0, 0.9, 0.3));

  // soot writing that only shows once the fire is lit
  const sootTex = canvasTex(256, 96, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 96);
    ctx.font = '700 60px Caveat, cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('3 _ 9 _', 128, 50);
  });
  const soot = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb36b', emissiveMap: sootTex.tex, emissiveIntensity: 0, transparent: true, opacity: 0.95 });
  const sootPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.38), soot);
  sootPlane.position.set(fx, 1.32, -4.09);
  R.add(sootPlane);

  // safe hidden behind the painting
  const safe = new THREE.Group();
  safe.position.set(fx, 3.2, -4.45);
  const steel = std('#5f6b80', { metalness: 0.7, roughness: 0.35 });
  safe.add(box(0.9, 0.8, 0.12, std('#2a2f3a'), 0, 0, 0));
  const safeDoor = new THREE.Group();
  safeDoor.position.set(-0.4, 0, 0.07);
  safeDoor.add(box(0.8, 0.72, 0.06, steel, 0.4, 0, 0));
  safeDoor.add(cyl(0.12, 0.12, 0.04, w.mats.gold, 0.4, 0, 0.05, 20).rotateX(Math.PI / 2));
  for (let i = 0; i < 4; i++) safeDoor.add(box(0.04, 0.12, 0.03, w.mats.gold, 0.4 + Math.cos((i * Math.PI) / 2) * 0.17, Math.sin((i * Math.PI) / 2) * 0.17, 0.05));
  safeDoor.add(box(0.2, 0.12, 0.02, glow('#7df9ff', 1.2), 0.62, 0.24, 0.04));
  safe.add(safeDoor);
  // key inside
  safe.add(mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 14), w.mats.gold, -0.1, 0, 0.02));
  safe.add(box(0.18, 0.03, 0.02, w.mats.gold, 0.05, 0, 0.02));
  safe.visible = false;
  R.add(safe);
  w.register('safe', safe, new THREE.Vector3(0, 0.3, 0.1));

  const painting = new THREE.Group();
  painting.position.set(fx, 3.2, -4.4);
  const art = picture(1.6, 1.1, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b1b5e');
    g.addColorStop(0.6, '#a04a7a');
    g.addColorStop(1, '#ffb36b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // a little house on a floating island
    ctx.fillStyle = '#3a2a5a';
    ctx.beginPath();
    ctx.moveTo(60, 120); ctx.lineTo(196, 120); ctx.lineTo(170, 160); ctx.lineTo(86, 160);
    ctx.fill();
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(108, 86, 40, 34);
    ctx.fillStyle = '#5a3a7a';
    ctx.beginPath();
    ctx.moveTo(100, 88); ctx.lineTo(128, 64); ctx.lineTo(156, 88);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 30; i++) ctx.fillRect(Math.random() * W, Math.random() * 60, 2, 2);
  }, std('#c9a14a', { metalness: 0.6, roughness: 0.35 }));
  painting.add(art);
  R.add(painting);
  w.register('painting', painting, new THREE.Vector3(0, 0.3, 0.1));

  // ------------------------------------------------------------------ display cabinet (collection)
  const cab = new THREE.Group();
  cab.position.set(15.0, 0, -4.7);
  const cabWood = std('#4a2f3a', { roughness: 0.5 });
  cab.add(box(2.2, 3.5, 0.08, cabWood, 0, 1.75, -0.26));
  for (const s of [-1, 1]) cab.add(box(0.08, 3.5, 0.6, cabWood, s * 1.06, 1.75, 0));
  cab.add(box(2.2, 0.1, 0.6, cabWood, 0, 3.5, 0));
  cab.add(box(2.2, 0.3, 0.6, cabWood, 0, 0.15, 0));
  const shelfYs = [0.3, 1.1, 1.9, 2.7];
  for (const y of shelfYs) cab.add(box(2.05, 0.05, 0.52, std('#e8e0f0', { roughness: 0.3 }), 0, y, 0));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 3.2), new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.1, roughness: 0.05 }));
  glass.position.set(0, 1.85, 0.3);
  glass.userData.ignoreRay = true;
  cab.add(glass);
  cab.add(box(2.0, 0.03, 0.03, glow('#ffd59a', 1.8), 0, 3.4, 0.2));
  R.add(cab);
  w.register('cabinet', cab, new THREE.Vector3(0, 3.3, 0.3));
  const shelfGroup = new THREE.Group();
  R.add(shelfGroup);
  const shelfSlots: THREE.Vector3[] = [];
  for (const y of shelfYs) for (let i = 0; i < 7; i++) shelfSlots.push(new THREE.Vector3(15.0 - 0.84 + i * 0.28, y + 0.2, -4.6));

  // ------------------------------------------------------------------ TV (left wall)
  const tvG = new THREE.Group();
  tvG.position.set(5.45, 0, -1.8);
  tvG.add(rbox(0.6, 0.55, 2.4, std('#3a2a4a', { roughness: 0.5 }), 0, 0.3, 0));
  for (const z of [-0.6, 0.6]) tvG.add(box(0.02, 0.4, 1.0, std('#4a3a5a'), 0.31, 0.3, z));
  tvG.add(rbox(0.1, 1.2, 2.1, std('#16121f', { roughness: 0.3 }), -0.18, 1.55, 0));
  const tv = canvasTex(320, 180);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.08), emissiveScreen(tv.tex, 1.15));
  scr.rotation.y = Math.PI / 2;
  scr.position.set(-0.12, 1.55, 0);
  tvG.add(scr);
  // console + plant on the stand
  tvG.add(rbox(0.3, 0.1, 0.4, std('#ffffff'), 0.05, 0.63, 0.75));
  tvG.add(cyl(0.1, 0.08, 0.18, std('#e07a5f'), 0.05, 0.67, -0.85, 10));
  tvG.add(sphere(0.13, std('#4caf7a'), 0.05, 0.84, -0.85, 8));
  R.add(tvG);
  w.register('tv', tvG, new THREE.Vector3(0, 2.3, 0));

  // ------------------------------------------------------------------ sofa + coffee table
  const sofa = new THREE.Group();
  sofa.position.set(9.0, 0, -1.8);
  const fabric = std('#5b6fd6', { roughness: 0.95 });
  const fabric2 = std('#4a5cc0', { roughness: 0.95 });
  sofa.add(rbox(1.0, 0.45, 3.0, fabric2, 0, 0.32, 0, 0.1));
  sofa.add(rbox(0.32, 0.85, 3.0, fabric, 0.42, 0.75, 0, 0.12));
  for (const s of [-1, 1]) sofa.add(rbox(1.0, 0.6, 0.28, fabric, 0, 0.55, s * 1.5, 0.12));
  for (const s of [-1, 1]) sofa.add(rbox(0.75, 0.18, 1.32, fabric, -0.05, 0.62, s * 0.68, 0.08));
  const throwB = rbox(0.6, 0.06, 0.9, std('#ffd36b', { roughness: 1 }), 0.3, 0.98, 0.7, 0.03);
  throwB.rotation.z = 0.5;
  sofa.add(throwB);
  sofa.add(rbox(0.16, 0.38, 0.4, std('#ff9ad5'), 0.22, 0.9, -1.05, 0.08).rotateZ(0.2));
  for (const [x, z] of [[-0.4, -1.4], [0.4, -1.4], [-0.4, 1.4], [0.4, 1.4]]) sofa.add(box(0.07, 0.12, 0.07, dark, x, 0.06, z));
  R.add(sofa);
  w.register('sofa', sofa, new THREE.Vector3(0, 1.3, 0));

  const table = new THREE.Group();
  table.position.set(7.3, 0, -1.8);
  table.add(rbox(0.9, 0.08, 1.6, wood, 0, 0.48, 0, 0.04));
  table.add(rbox(0.8, 0.05, 1.5, dark, 0, 0.18, 0, 0.02));
  for (const [x, z] of [[-0.38, -0.72], [0.38, -0.72], [-0.38, 0.72], [0.38, 0.72]]) table.add(box(0.06, 0.48, 0.06, dark, x, 0.24, z));
  const pizza = box(0.5, 0.06, 0.5, std('#e8c79a'), 0.05, 0.55, 0.35);
  pizza.rotation.y = 0.3;
  table.add(pizza);
  table.add(cyl(0.05, 0.05, 0.18, std('#e63946', { metalness: 0.6, roughness: 0.3 }), -0.2, 0.61, -0.4, 10));
  table.add(cyl(0.06, 0.05, 0.12, std('#fff4e0'), 0.2, 0.58, -0.35, 10));
  R.add(table);
  w.register('coffeetable', table, new THREE.Vector3(0, 0.8, 0));

  // ------------------------------------------------------------------ armchair + floor lamp + plant
  const chair = new THREE.Group();
  chair.position.set(13.1, 0, -1.4);
  chair.rotation.y = Math.PI + 0.35;
  const cm = std('#3fa38a', { roughness: 0.95 });
  chair.add(rbox(1.0, 0.42, 0.95, cm, 0, 0.32, 0, 0.1));
  chair.add(rbox(1.0, 0.9, 0.25, cm, 0, 0.8, -0.38, 0.1));
  for (const s of [-1, 1]) chair.add(rbox(0.22, 0.55, 0.95, cm, s * 0.5, 0.55, 0, 0.1));
  chair.add(rbox(0.75, 0.14, 0.7, std('#5fc4a8', { roughness: 1 }), 0, 0.58, 0.05, 0.06));
  for (const [x, z] of [[-0.4, -0.38], [0.4, -0.38], [-0.4, 0.38], [0.4, 0.38]]) chair.add(box(0.06, 0.14, 0.06, dark, x, 0.07, z));
  R.add(chair);
  w.register('armchair', chair, new THREE.Vector3(0, 1.3, 0));

  const fl = new THREE.Group();
  fl.position.set(14.5, 0, -2.7);
  fl.add(cyl(0.25, 0.28, 0.05, w.mats.frame, 0, 0.03, 0));
  fl.add(cyl(0.025, 0.025, 2.3, w.mats.gold, 0, 1.18, 0, 8));
  fl.add(mesh(new THREE.CylinderGeometry(0.24, 0.38, 0.45, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#ffe6c4', emissive: '#ffb36b', emissiveIntensity: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), 0, 2.4, 0));
  fl.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffd59a', emissiveIntensity: 2 }), 0, 2.3, 0));
  R.add(fl);
  w.register('floorlamp', fl, new THREE.Vector3(0, 2.7, 0));
  const floorLight = w.addLight(new THREE.PointLight('#ffb36b', 9, 12, 1.5));
  floorLight.position.set(14.5, 2.2, -2.5);

  const mon = monstera(1.15);
  mon.position.set(15.6, 0, 3.9);
  R.add(mon);
  w.register('monstera', mon, new THREE.Vector3(0, 2.3, 0));

  // wall art on the back wall between fireplace and cabinet
  const art2 = picture(0.6, 0.8, (ctx, W, H) => {
    ctx.fillStyle = '#ffcf8a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff7eb6';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }, w.mats.frame);
  art2.position.set(13.2, 2.6, -4.97);
  R.add(art2);

  // ------------------------------------------------------------------ fishbowl (shop extra)
  const fishbowl = new THREE.Group();
  fishbowl.position.set(8.05, 0.93, -4.62);
  fishbowl.add(cyl(0.16, 0.18, 0.04, std('#2a1f3e'), 0, 0.02, 0));
  const water = sphere(0.24, new THREE.MeshStandardMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 0.24, 0, 24);
  fishbowl.add(water);
  const fish: THREE.Object3D[] = [];
  for (let i = 0; i < 2; i++) {
    const f = new THREE.Group();
    const body = sphere(0.05, std(i ? '#ff9a3c' : '#ffd36b'), 0, 0, 0, 10);
    body.scale.set(1.5, 1, 0.7);
    f.add(body);
    f.add(mesh(new THREE.ConeGeometry(0.04, 0.06, 6).rotateZ(Math.PI / 2), std(i ? '#ff9a3c' : '#ffd36b'), -0.08, 0, 0));
    f.userData.phase = i * Math.PI;
    fish.push(f);
    fishbowl.add(f);
  }
  fishbowl.visible = false;
  R.add(fishbowl);
  w.register('fishbowl', fishbowl, new THREE.Vector3(0, 0.6, 0), false);

  w.updaters.push((dt, t) => {
    disc.rotation.y += dt * (record.userData.playing ? 3.5 : 0);
    if (fishbowl.visible) fish.forEach((f) => {
      const a = t * 1.1 + (f.userData.phase as number);
      f.position.set(Math.cos(a) * 0.12, 0.24 + Math.sin(t * 2 + a) * 0.04, Math.sin(a) * 0.12);
      f.rotation.y = -a - Math.PI / 2;
    });
  });

  w.rooms.get('living')!.mochiSpot.set(8.95, 0.73, -1.0);
  return { tv, drawer, flames, fireLight, soot, painting, safe, safeDoor, shelfSlots, shelfGroup, fishbowl, fish, record, floorLight };
}
