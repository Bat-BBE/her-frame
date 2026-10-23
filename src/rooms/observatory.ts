import { THREE, canvasTex, std, glow, mesh, rand, rbox, box, cyl, sphere, tileTexture } from './kit';
import type { World } from '../world';

export interface ObservatoryRefs {
  tube: THREE.Object3D;
  globe: THREE.Object3D;
  chestLid: THREE.Object3D;
  /** Mochi-shaped constellation that lights up on the dome at the finale. */
  constellation: THREE.Group;
  domeMat: THREE.MeshStandardMaterial;
}

/** Star positions (unit square, y up) of "Mochi's constellation" — shared with the telescope mini-game. */
export const MOCHI_STARS: [number, number][] = [
  [0.22, 0.62], [0.32, 0.88], [0.42, 0.66], [0.58, 0.66], [0.68, 0.88], [0.78, 0.62], [0.7, 0.3], [0.5, 0.2], [0.3, 0.3],
];

export function buildObservatory(w: World): ObservatoryRefs {
  const R = w.room;
  const cx = 27, cz = -3.5, fy = 1.6, rad = 4.3;
  const room = w.rooms.get('observatory')!;

  // floor (always visible — it's the island's deck)
  const ft = tileTexture('#2c2556', '#241e48', 10, 'rgba(180,140,255,0.25)');
  ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
  ft.repeat.set(2, 2);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.12, 48), [std('#4a3d78'), std('#ffffff', { map: ft, roughness: 0.5 }), std('#4a3d78')]);
  floor.position.set(cx, fy - 0.06, cz);
  floor.receiveShadow = true;
  w.root.add(floor);
  w.root.add(mesh(new THREE.TorusGeometry(rad, 0.08, 8, 64).rotateX(Math.PI / 2), w.mats.gold, cx, fy, cz));

  // back half-wall + half-dome (open toward the camera), part of the shell so always visible
  const H = 4.4;
  const back = -3 * Math.PI / 4;
  const wallGeo = new THREE.CylinderGeometry(rad, rad, H, 48, 1, true, back - 1.75, 3.5);
  const wall = new THREE.Mesh(wallGeo, room.wall);
  (wall.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  wall.position.set(cx, fy + H / 2, cz);
  wall.receiveShadow = true;
  w.root.add(wall);
  const stars = canvasTex(1024, 512, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = `rgba(${200 + Math.random() * 55},${180 + Math.random() * 75},255,${Math.random()})`;
      const s = Math.random() < 0.08 ? 3 : 1.5;
      ctx.fillRect(Math.random() * 1024, Math.random() * 512, s, s);
    }
  });
  const domeMat = new THREE.MeshStandardMaterial({ color: '#2a1f55', emissive: '#ffffff', emissiveMap: stars.tex, emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(rad, 40, 16, -Math.PI / 4 - 1.75, 3.5, 0, Math.PI / 2), domeMat);
  dome.position.set(cx, fy + H, cz);
  w.root.add(dome);

  // ------------------------------------------------------------------ telescope
  const tel = new THREE.Group();
  tel.position.set(cx - 0.7, fy, cz - 0.9);
  const brass = std('#d9a441', { metalness: 0.7, roughness: 0.3 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(0.04, 0.05, 1.7, w.mats.darkWood, Math.cos(a) * 0.4, 0.8, Math.sin(a) * 0.4, 6);
    leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    tel.add(leg);
  }
  tel.add(sphere(0.12, brass, 0, 1.65, 0, 12));
  const tube = new THREE.Group();
  tube.position.y = 1.7;
  tube.rotation.set(0, 0.8, -0.75);
  tube.add(cyl(0.16, 0.22, 2.2, brass, 0, 0.6, 0, 20));
  tube.add(cyl(0.25, 0.25, 0.12, std('#5a3624'), 0, 1.68, 0, 20));
  tube.add(mesh(new THREE.CircleGeometry(0.21, 20).rotateX(-Math.PI / 2), glow('#7df9ff', 1.2), 0, 1.75, 0));
  tube.add(cyl(0.07, 0.06, 0.4, brass, 0, -0.65, 0, 12));
  tel.add(tube);
  R.add(tel);
  w.register('telescope', tel, new THREE.Vector3(0, 2.6, 0));

  // ------------------------------------------------------------------ star chart table
  const chart = new THREE.Group();
  chart.position.set(cx + 1.6, fy, cz + 0.9);
  chart.rotation.y = -0.6;
  chart.add(rbox(1.5, 0.08, 1.0, w.mats.darkWood, 0, 0.9, 0));
  for (const [x, z] of [[-0.65, -0.42], [0.65, -0.42], [-0.65, 0.42], [0.65, 0.42]]) chart.add(box(0.07, 0.9, 0.07, w.mats.darkWood, x, 0.45, z));
  const mapTex = canvasTex(512, 340, (ctx) => {
    ctx.fillStyle = '#152043';
    ctx.fillRect(0, 0, 512, 340);
    ctx.strokeStyle = 'rgba(125,249,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(256, 170, i * 34, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 340, 2, 2);
    }
    ctx.strokeStyle = '#ffd36b';
    ctx.fillStyle = '#ffd36b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    MOCHI_STARS.forEach(([x, y], i) => {
      const px = 120 + x * 272, py = 300 - y * 260;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    MOCHI_STARS.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(120 + x * 272, 300 - y * 260, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.font = '700 30px Caveat, cursive';
    ctx.fillText('Мочигийн од ★', 20, 36);
  });
  const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.9), std('#ffffff', { map: mapTex.tex, emissive: '#ffffff', emissiveMap: mapTex.tex, emissiveIntensity: 0.3 }));
  mapPlane.rotation.x = -Math.PI / 2;
  mapPlane.position.y = 0.95;
  chart.add(mapPlane);
  chart.add(cyl(0.03, 0.03, 0.25, std('#fff4e0'), 0.55, 1.07, -0.35, 8));
  const candle = mesh(new THREE.SphereGeometry(0.03, 8, 6), glow('#ffb347', 5), 0.55, 1.23, -0.35);
  candle.scale.y = 1.8;
  chart.add(candle);
  w.flames.push(candle);
  R.add(chart);
  w.register('chart', chart, new THREE.Vector3(0, 1.4, 0));

  // ------------------------------------------------------------------ globe, chest, chair
  const globeG = new THREE.Group();
  globeG.position.set(cx - 2.5, fy, cz + 1.2);
  globeG.add(cyl(0.25, 0.3, 0.06, w.mats.darkWood, 0, 0.03, 0));
  globeG.add(cyl(0.03, 0.03, 0.9, w.mats.gold, 0, 0.48, 0, 8));
  const gTex = canvasTex(256, 128, (ctx) => {
    ctx.fillStyle = '#1e2a5e';
    ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = '#ffd36b';
      ctx.fillRect(Math.random() * 256, Math.random() * 128, 2, 2);
    }
    ctx.strokeStyle = 'rgba(255,211,107,0.6)';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) ctx.lineTo(rand(20, 236), rand(20, 108));
    ctx.stroke();
  });
  const globe = sphere(0.36, std('#ffffff', { map: gTex.tex, roughness: 0.4 }), 0, 1.25, 0, 24);
  globe.rotation.z = 0.4;
  globeG.add(globe);
  globeG.add(mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 32), w.mats.gold, 0, 1.25, 0).rotateY(Math.PI / 2));
  R.add(globeG);
  w.register('globe', globeG, new THREE.Vector3(0, 1.7, 0));

  const chest = new THREE.Group();
  chest.position.set(cx + 0.9, fy, cz - 2.9);
  chest.rotation.y = -0.4;
  chest.add(rbox(1.0, 0.5, 0.6, std('#6b3f2a'), 0, 0.25, 0));
  chest.add(box(1.02, 0.08, 0.62, w.mats.gold, 0, 0.12, 0));
  const chestLid = new THREE.Group();
  chestLid.position.set(0, 0.5, -0.3);
  const lidM = mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 16, 1, false, 0, Math.PI), std('#7a4a32'), 0, 0, 0.3);
  lidM.rotation.z = Math.PI / 2;
  chestLid.add(lidM);
  chest.add(chestLid);
  chest.add(box(0.12, 0.14, 0.04, w.mats.gold, 0, 0.45, 0.31));
  R.add(chest);
  w.register('obschest', chest, new THREE.Vector3(0, 0.9, 0));

  const chair = new THREE.Group();
  chair.position.set(cx - 2.2, fy, cz - 1.6);
  chair.rotation.y = 0.9;
  const cm = std('#8b6cff', { roughness: 0.95 });
  chair.add(rbox(1.0, 0.45, 0.9, cm, 0, 0.3, 0, 0.12));
  chair.add(rbox(1.0, 0.9, 0.25, cm, 0, 0.8, -0.35, 0.12));
  chair.add(rbox(0.8, 0.08, 0.7, std('#ffd36b', { roughness: 1 }), 0.05, 0.56, 0.1, 0.03).rotateZ(0.1));
  R.add(chair);
  w.register('obschair', chair, new THREE.Vector3(0, 1.3, 0));

  // floating crystals + light
  for (let i = 0; i < 4; i++) {
    const c = mesh(new THREE.OctahedronGeometry(0.16, 0), glow(['#7df9ff', '#ff7eb6', '#b388ff', '#ffd36b'][i], 2.2), cx - 1.5 + i, fy + 3.2 + (i % 2) * 0.4, cz - 2.2 + (i % 2) * 0.6);
    c.scale.y = 1.8;
    c.castShadow = false;
    w.spinners.push(c);
    R.add(c);
  }
  const light = w.addLight(new THREE.PointLight('#b9a0ff', 7, 11, 1.4));
  light.position.set(cx, fy + 3.0, cz);

  // constellation on the dome
  const constellation = new THREE.Group();
  const pts = MOCHI_STARS.map(([x, y]) => {
    const a = -Math.PI / 4 - 1.75 + 0.6 + x * 2.3; // spread across the visible dome
    const el = 0.35 + y * 0.75;
    const r = rad - 0.15;
    return new THREE.Vector3(cx - Math.cos(a) * Math.cos(el) * r, fy + H + Math.sin(el) * r, cz + Math.sin(a) * Math.cos(el) * r);
  });
  for (const p of pts) {
    const s = mesh(new THREE.SphereGeometry(0.09, 10, 8), glow('#ffd36b', 4), p.x, p.y, p.z);
    s.castShadow = false;
    constellation.add(s);
  }
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color('#ffd36b').multiplyScalar(2.5) }));
  constellation.add(line);
  constellation.visible = false;
  constellation.traverse((o) => { o.userData.ignoreRay = true; });
  w.root.add(constellation);

  w.updaters.push((dt) => {
    globe.rotation.y += dt * (globeG.userData.spin ? 6 : 0.15);
    if (globeG.userData.spin) globeG.userData.spin = Math.max(0, (globeG.userData.spin as number) - dt);
  });

  room.mochiSpot.set(cx - 2.15, fy + 0.62, cz - 1.5);
  return { tube, globe: globeG, chestLid, constellation, domeMat };
}
