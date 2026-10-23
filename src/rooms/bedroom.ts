import gsap from 'gsap';
import { THREE, canvasTex, std, glow, mesh, rand, rbox, box, cyl, sphere, checkTexture, picture, emissiveScreen } from './kit';
import type { World } from '../world';

export interface BedroomRefs {
  alarm: THREE.Group;
  drawAlarm: (text: string, ringing: boolean) => void;
  pillow: THREE.Mesh;
  wardrobeDoors: THREE.Object3D[];
  plantLeaves: THREE.Mesh[];
  setPlantHappy: (happy: boolean, instant?: boolean) => void;
  can: THREE.Group;
  nightBulb: THREE.MeshStandardMaterial;
  nightShade: THREE.MeshStandardMaterial;
  nightLight: THREE.PointLight;
  toyLid: THREE.Object3D;
  balloons: THREE.Group;
}

export function buildBedroom(w: World): BedroomRefs {
  const R = w.room;
  const dark = w.mats.darkWood;
  const wood = w.mats.wood;

  // ------------------------------------------------------------------ bed
  const bed = new THREE.Group();
  bed.position.set(-3.3, 0, 6.9);
  const frame = std('#6b4a7a', { roughness: 0.6 });
  bed.add(rbox(2.7, 0.32, 3.45, frame, 0, 0.32, 0));
  for (const [x, z] of [[-1.25, -1.6], [1.25, -1.6], [-1.25, 1.6], [1.25, 1.6]]) bed.add(box(0.12, 0.2, 0.12, dark, x, 0.08, z));
  bed.add(rbox(2.8, 1.55, 0.16, frame, 0, 1.0, -1.72, 0.06));
  bed.add(rbox(2.8, 0.75, 0.13, frame, 0, 0.62, 1.74, 0.05));
  bed.add(rbox(2.55, 0.3, 3.3, std('#f4efe6', { roughness: 0.9 }), 0, 0.62, 0, 0.08));
  const blanketTex = checkTexture('#3b4f9a', '#e9e6f5', 12);
  blanketTex.wrapS = blanketTex.wrapT = THREE.RepeatWrapping;
  const blanketMat = std('#ffffff', { map: blanketTex, roughness: 0.95 });
  bed.add(rbox(2.62, 0.12, 2.25, blanketMat, 0, 0.82, 0.58, 0.05));
  for (const s of [-1, 1]) bed.add(rbox(0.06, 0.42, 2.25, blanketMat, s * 1.31, 0.62, 0.58, 0.02));
  bed.add(rbox(2.62, 0.14, 0.4, std('#e9e6f5', { roughness: 0.95 }), 0, 0.86, -0.55, 0.06));
  const pillow = rbox(1.0, 0.24, 0.55, std('#fff6ea', { roughness: 0.95 }), -0.62, 0.9, -1.25, 0.1);
  bed.add(pillow);
  bed.add(rbox(1.0, 0.24, 0.55, std('#ffd0e1', { roughness: 0.95 }), 0.58, 0.9, -1.25, 0.1));
  // smiley cushion
  const smile = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#3a2a00';
    ctx.beginPath();
    ctx.arc(96, 110, 14, 0, Math.PI * 2);
    ctx.arc(160, 110, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2a00';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 135, 52, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  });
  const cushion = sphere(0.3, std('#ffffff', { map: smile.tex, roughness: 0.9 }), 0.15, 1.12, -0.85, 20);
  cushion.scale.set(1, 1, 0.55);
  cushion.rotation.set(-0.25, -Math.PI / 2 + 0.35, 0);
  cushion.rotation.order = 'YXZ';
  bed.add(cushion);
  R.add(bed);
  w.register('bed', bed, new THREE.Vector3(0, 1.4, -0.3));

  // ------------------------------------------------------------------ nightstand + alarm + lamp
  const ns = new THREE.Group();
  ns.position.set(-1.35, 0, 5.6);
  ns.add(rbox(0.78, 0.72, 0.66, wood, 0, 0.36, 0));
  ns.add(box(0.64, 0.24, 0.02, std('#c99366'), 0, 0.42, 0.34));
  ns.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), w.mats.gold, 0, 0.42, 0.36));
  R.add(ns);

  const alarm = new THREE.Group();
  alarm.position.set(-1.52, 0.72, 5.62);
  alarm.rotation.y = 0.35;
  const alarmBody = std('#ff7eb6', { roughness: 0.4 });
  alarm.add(rbox(0.34, 0.22, 0.16, alarmBody, 0, 0.13, 0, 0.05));
  for (const s of [-1, 1]) {
    alarm.add(mesh(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), w.mats.gold, s * 0.1, 0.25, 0));
    alarm.add(box(0.03, 0.05, 0.03, w.mats.frame, s * 0.12, 0.01, 0));
  }
  const alarmTex = canvasTex(256, 128);
  const drawAlarm = (text: string, ringing: boolean) => {
    const { ctx, tex } = alarmTex;
    ctx.fillStyle = '#1a0a12';
    ctx.fillRect(0, 0, 256, 128);
    ctx.font = '700 78px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = ringing ? '#ff3b5c' : '#7df9ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = ringing ? '#ff5f7a' : '#9ff7ff';
    ctx.fillText(text, 128, 68);
    tex.needsUpdate = true;
  };
  drawAlarm('07:15', true);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), emissiveScreen(alarmTex.tex, 1.4));
  scr.position.set(0, 0.13, 0.081);
  alarm.add(scr);
  R.add(alarm);
  w.register('alarm', alarm, new THREE.Vector3(0, 0.35, 0));

  const lampG = new THREE.Group();
  lampG.position.set(-1.12, 0.72, 5.5);
  lampG.add(cyl(0.1, 0.12, 0.05, w.mats.gold, 0, 0.025, 0));
  lampG.add(cyl(0.02, 0.02, 0.38, w.mats.gold, 0, 0.22, 0, 6));
  const nightShade = new THREE.MeshStandardMaterial({ color: '#ffe6c4', emissive: '#ffb36b', emissiveIntensity: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  lampG.add(mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.24, 18, 1, true), nightShade, 0, 0.46, 0));
  const nightBulb = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffd59a', emissiveIntensity: 2 });
  lampG.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), nightBulb, 0, 0.42, 0));
  R.add(lampG);
  w.register('nightlamp', lampG, new THREE.Vector3(0, 0.6, 0));
  const nightLight = w.addLight(new THREE.PointLight('#ffb36b', 7, 9, 1.6));
  nightLight.position.set(-1.1, 1.35, 5.85);

  // ------------------------------------------------------------------ fairy lights along the back wall
  {
    const wallDeco = new THREE.Group();
    R.add(w.mount(wallDeco, 'z', 5));
    const cols = ['#ffcf6b', '#ff7eb6', '#7df9ff', '#b388ff'];
    const a = new THREE.Vector3(-4.9, 4.55, 5.22), b = new THREE.Vector3(4.9, 4.55, 5.22);
    const pts: THREE.Vector3[] = [];
    const seg = 5;
    for (let s = 0; s < seg; s++) for (let i = 0; i <= 16; i++) {
      const t = s / seg + i / 16 / seg;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(((t * seg) % 1) * Math.PI) * 0.3;
      pts.push(p);
    }
    wallDeco.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1a1430' })));
    for (let i = 0; i < 22; i++) {
      const p = pts[Math.floor((i / 22) * pts.length + pts.length / 44)];
      const base = new THREE.Color(cols[i % cols.length]);
      const mat = new THREE.MeshStandardMaterial({ color: '#000', emissive: base, emissiveIntensity: 2.2 });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat);
      m.position.copy(p).y -= 0.05;
      wallDeco.add(m);
      w.bulbs.push({ mesh: m, mat, base });
    }
    // polaroids pinned under the lights
    const polCols = ['#ff9ad5', '#7df9ff', '#ffd36b', '#b388ff', '#7ed957'];
    for (let i = 0; i < 5; i++) {
      const x = -4.3 + i * 0.75;
      const pol = new THREE.Group();
      pol.position.set(x, 3.85 + Math.sin(i * 1.7) * 0.06, 5.12);
      pol.rotation.z = rand(-0.15, 0.15);
      pol.add(box(0.42, 0.5, 0.01, std('#fbf7ef'), 0, 0, 0));
      pol.add(box(0.34, 0.32, 0.012, std(polCols[i], { roughness: 0.5 }), 0, 0.04, 0.002));
      wallDeco.add(pol);
    }
  }

  // ------------------------------------------------------------------ window (left wall)
  {
    const g = new THREE.Group();
    const f = w.mats.frame;
    const cz = 7.4, cy = 2.95, wd = 2.2, ht = 1.9, x = -5.0;
    g.add(box(0.42, 0.12, wd + 0.16, f, x - 0.1, cy + ht / 2, cz));
    g.add(box(0.42, 0.12, wd + 0.16, f, x - 0.1, cy - ht / 2, cz));
    g.add(box(0.42, ht, 0.12, f, x - 0.1, cy, cz - wd / 2));
    g.add(box(0.42, ht, 0.12, f, x - 0.1, cy, cz + wd / 2));
    g.add(box(0.08, ht, 0.06, f, x - 0.15, cy, cz));
    g.add(box(0.42, 0.08, wd + 0.5, w.mats.trim, x + 0.12, cy - ht / 2 - 0.02, cz));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshStandardMaterial({ color: '#9fb4ff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2 }));
    glass.rotation.y = Math.PI / 2;
    glass.position.set(x - 0.16, cy, cz);
    g.add(glass);
    const curtain = std('#e7a6c8', { roughness: 0.95 });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.5, 10), curtain);
      c.scale.x = 0.45;
      c.position.set(x + 0.12, cy - 0.05, cz + s * (wd / 2 + 0.3));
      c.castShadow = true;
      g.add(c);
    }
    g.add(cyl(0.03, 0.03, wd + 1.3, w.mats.gold, x + 0.14, cy + ht / 2 + 0.24, cz, 8).rotateX(Math.PI / 2));
    // tiny succulents on the sill
    for (let i = 0; i < 3; i++) {
      const pz = cz - 0.6 + i * 0.6;
      g.add(cyl(0.08, 0.06, 0.13, std(['#e07a5f', '#7c66c9', '#f2efe6'][i]), x + 0.12, cy - ht / 2 + 0.08, pz, 10));
      g.add(sphere(0.08, std('#4caf7a'), x + 0.12, cy - ht / 2 + 0.2, pz, 8));
    }
    R.add(g);
    w.register('bedwindow', g, new THREE.Vector3(x + 0.2, cy + 0.3, cz));
  }

  // ------------------------------------------------------------------ dresser + photo + poster
  const dresser = new THREE.Group();
  dresser.position.set(3.6, 0, 5.55);
  dresser.add(rbox(1.9, 1.1, 0.7, std('#e9d8c4', { roughness: 0.6 }), 0, 0.55, 0));
  for (const y of [0.3, 0.75]) for (const s of [-1, 1]) {
    dresser.add(box(0.82, 0.36, 0.02, std('#dcc6ad'), s * 0.45, y, 0.36));
    dresser.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), w.mats.gold, s * 0.45, y, 0.38));
  }
  // jewelry box + cactus
  dresser.add(rbox(0.32, 0.16, 0.22, std('#7b4bd1'), -0.55, 1.18, 0));
  dresser.add(cyl(0.08, 0.06, 0.14, std('#ff8fb1'), 0.65, 1.17, -0.05, 10));
  dresser.add(mesh(new THREE.CapsuleGeometry(0.05, 0.14, 4, 8), std('#4caf7a'), 0.65, 1.32, -0.05));
  R.add(dresser);

  const photo = new THREE.Group();
  photo.position.set(3.65, 1.1, 5.55);
  photo.rotation.y = -0.2;
  const photoArt = picture(0.42, 0.52, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffcfe2');
    g.addColorStop(1, '#a8d8ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Mochi portrait
    ctx.fillStyle = '#fff0f6';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.62, W * 0.3, H * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9cc5';
    ctx.beginPath();
    ctx.moveTo(W * 0.32, H * 0.44); ctx.lineTo(W * 0.38, H * 0.3); ctx.lineTo(W * 0.44, H * 0.42);
    ctx.moveTo(W * 0.56, H * 0.42); ctx.lineTo(W * 0.62, H * 0.3); ctx.lineTo(W * 0.68, H * 0.44);
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.arc(W * 0.42, H * 0.6, 7, 0, Math.PI * 2);
    ctx.arc(W * 0.58, H * 0.6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2046';
    ctx.font = '700 26px Caveat, cursive';
    ctx.textAlign = 'center';
    ctx.fillText('best friend', W / 2, H * 0.94);
  }, std('#c99366', { roughness: 0.5 }));
  photo.add(photoArt);
  photoArt.position.y = 0.3;
  photo.add(box(0.06, 0.4, 0.25, std('#c99366'), 0, 0.18, -0.1).rotateX(-0.4));
  R.add(photo);
  w.register('photo', photo, new THREE.Vector3(0, 0.6, 0));

  const sign = picture(1.1, 1.3, (ctx, W, H) => {
    ctx.fillStyle = '#efe0c8';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3a2a1a';
    ctx.textAlign = 'center';
    ctx.font = '700 56px Caveat, cursive';
    ['GOOD', 'THINGS', 'TAKE', 'TIME'].forEach((t, i) => ctx.fillText(t, W / 2, 70 + i * 66));
  }, w.mats.frame);
  sign.position.set(3.6, 2.75, 5.14);
  sign.rotation.z = -0.04;
  R.add(w.mount(sign, 'z', 5));

  // ------------------------------------------------------------------ wardrobe (code lock)
  const ward = new THREE.Group();
  ward.position.set(-4.6, 0, 10.4);
  const wMat = std('#efe6d6', { roughness: 0.55 });
  ward.add(rbox(0.85, 3.3, 2.2, wMat, 0, 1.65, 0, 0.05));
  ward.add(box(0.9, 0.12, 2.3, std('#c9b9a3'), 0, 3.36, 0));
  // inside (seen when doors open): clothes on a rail
  const clothesCols = ['#ff8fb1', '#7cc6c0', '#ffd36b', '#8b6cff', '#e36b6b'];
  clothesCols.forEach((c, i) => ward.add(rbox(0.06, 1.0, 0.3, std(c), 0.3, 2.2, -0.75 + i * 0.37, 0.02)));
  const wardrobeDoors: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.44, 0, s * 1.08);
    const leaf = rbox(0.05, 3.1, 1.06, std('#f7f0e3', { roughness: 0.5 }), 0, 1.65, -s * 0.53, 0.02);
    pivot.add(leaf);
    pivot.add(box(0.02, 0.9, 0.7, std('#e9dcc6'), 0.03, 2.3, -s * 0.53));
    pivot.add(box(0.02, 0.9, 0.7, std('#e9dcc6'), 0.03, 1.0, -s * 0.53));
    pivot.add(box(0.05, 0.3, 0.04, w.mats.gold, 0.05, 1.65, -s * 0.95));
    pivot.userData.side = s;
    wardrobeDoors.push(pivot);
    ward.add(pivot);
  }
  // little keypad between the handles
  ward.add(rbox(0.06, 0.34, 0.24, std('#2a2046'), 0.48, 1.65, 0, 0.02));
  ward.add(box(0.02, 0.12, 0.16, glow('#7df9ff', 1.4), 0.52, 1.72, 0));
  R.add(ward);
  w.register('wardrobe', ward, new THREE.Vector3(0.4, 2.6, 0));

  // ------------------------------------------------------------------ thirsty plant + watering can
  const plantG = new THREE.Group();
  plantG.position.set(4.25, 0, 8.4);
  plantG.add(cyl(0.38, 0.28, 0.65, std('#f2efe6', { roughness: 0.6 }), 0, 0.33, 0, 18));
  plantG.add(cyl(0.36, 0.36, 0.03, std('#3b2618'), 0, 0.64, 0, 18));
  const plantLeaves: THREE.Mesh[] = [];
  const leafMat = std('#4caf7a', { roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const geo = new THREE.ConeGeometry(0.13, 1.3, 4, 1);
    geo.translate(0, 0.65, 0);
    const blade = new THREE.Mesh(geo, leafMat);
    blade.scale.z = 0.35;
    blade.position.set(Math.cos(a) * 0.1, 0.64, Math.sin(a) * 0.1);
    blade.rotation.order = 'YXZ';
    blade.rotation.y = -a;
    blade.userData.up = 0.25;
    blade.userData.down = 1.25;
    blade.castShadow = true;
    plantLeaves.push(blade);
    plantG.add(blade);
  }
  R.add(plantG);
  w.register('bedplant', plantG, new THREE.Vector3(0, 1.6, 0));
  const setPlantHappy = (happy: boolean, instant = false) => {
    plantLeaves.forEach((b, i) => {
      const x = happy ? b.userData.up : b.userData.down;
      if (instant) b.rotation.x = x;
      else gsap.to(b.rotation, { x, duration: 1.2, delay: i * 0.05, ease: 'elastic.out(1, 0.4)' });
    });
    leafMat.color.set(happy ? '#4caf7a' : '#8a9a52');
  };
  setPlantHappy(false, true);

  const can = new THREE.Group();
  can.position.set(-4.2, 0, 12.75);
  can.rotation.y = 0.8;
  const canMat = std('#5ab8ff', { metalness: 0.3, roughness: 0.4 });
  can.add(cyl(0.2, 0.22, 0.38, canMat, 0, 0.19, 0, 16));
  const spout = cyl(0.03, 0.05, 0.5, canMat, 0.28, 0.32, 0, 8);
  spout.rotation.z = -0.9;
  can.add(spout);
  can.add(mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 16, Math.PI), canMat, -0.05, 0.4, 0));
  R.add(can);
  w.register('can', can, new THREE.Vector3(0, 0.6, 0));

  // ------------------------------------------------------------------ rug, slippers, toybox, balloons
  const rugTex = canvasTex(512, 512, (ctx) => {
    ['#f7d6e6', '#ffffff', '#f2b8d2', '#fbe9f1', '#e99bbf'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(256, 256, 256 - i * 40, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), std('#fff', { map: rugTex.tex, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.6, 0.012, 10.3);
  rug.receiveShadow = true;
  R.add(rug);
  w.register('bedrug', rug, new THREE.Vector3(1.4, -1.4, 0.1));

  const slippers = new THREE.Group();
  slippers.position.set(-1.45, 0, 9.15);
  slippers.rotation.y = 0.4;
  for (const s of [-1, 1]) {
    const sl = rbox(0.2, 0.1, 0.42, std('#ff9ad5', { roughness: 0.95 }), s * 0.14, 0.05, 0, 0.05);
    slippers.add(sl);
    slippers.add(sphere(0.06, std('#ffffff', { roughness: 1 }), s * 0.14, 0.12, -0.1, 8));
  }
  R.add(slippers);
  w.register('slippers', slippers, new THREE.Vector3(0, 0.3, 0));

  const toy = new THREE.Group();
  toy.position.set(2.7, 0, 12.6);
  toy.rotation.y = -0.25;
  toy.add(rbox(1.1, 0.6, 0.7, std('#7cc6c0', { roughness: 0.6 }), 0, 0.3, 0));
  for (const [x, c] of [[-0.3, '#ff7eb6'], [0.05, '#ffd36b'], [0.35, '#b388ff']] as [number, string][]) {
    toy.add(box(0.2, 0.2, 0.02, std(c), x, 0.32, 0.36));
  }
  const toyLid = new THREE.Group();
  toyLid.position.set(0, 0.6, -0.35);
  toyLid.add(rbox(1.14, 0.1, 0.74, std('#5fb3a1', { roughness: 0.6 }), 0, 0.05, 0.35));
  toy.add(toyLid);
  // bear ears peeking out
  for (const s of [-1, 1]) toy.add(sphere(0.07, std('#d9a066'), 0.25 + s * 0.09, 0.62, 0.05, 8));
  R.add(toy);
  w.register('toybox', toy, new THREE.Vector3(0, 0.9, 0));

  const balloons = new THREE.Group();
  balloons.position.set(1.6, 0, 11.2);
  ['#ff7eb6', '#ffd36b', '#7df9ff'].forEach((c, i) => {
    const b = sphere(0.32, std(c, { roughness: 0.25, metalness: 0.1 }), (i - 1) * 0.45, 3.4 + (i % 2) * 0.35, (i % 2) * 0.3, 20);
    b.scale.y = 1.15;
    b.userData.phase = i * 1.7;
    balloons.add(b);
    const pts = [new THREE.Vector3((i - 1) * 0.45, 3.0 + (i % 2) * 0.35, (i % 2) * 0.3), new THREE.Vector3(0, 0.9, 0)];
    balloons.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })));
  });
  balloons.add(box(0.12, 0.12, 0.12, std('#8b6cff'), 0, 0.9, 0));
  balloons.visible = false;
  R.add(balloons);

  w.updaters.push((_dt, t) => {
    if (!balloons.visible) return;
    balloons.children.forEach((b) => {
      if (b.userData.phase === undefined) return;
      b.position.y += Math.sin(t * 1.2 + b.userData.phase) * 0.0015;
      b.rotation.z = Math.sin(t * 0.8 + b.userData.phase) * 0.08;
    });
  });

  w.rooms.get('bedroom')!.mochiSpot.set(-3.5, 0.97, 7.6);

  return { alarm, drawAlarm, pillow, wardrobeDoors, plantLeaves, setPlantHappy, can, nightBulb, nightShade, nightLight, toyLid, balloons };
}
