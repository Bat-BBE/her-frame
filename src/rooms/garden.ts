import { THREE, std, glow, mesh, rand, rbox, box, cyl, sphere } from './kit';
import type { World } from '../world';

export interface GardenRefs {
  setTreeStage: (stage: number, animate?: boolean) => void;
  tree: THREE.Group;
  mailFlag: THREE.Object3D;
  fireflies: THREE.Points;
}

export const TREE_MAX = 8;

export function buildGarden(w: World): GardenRefs {
  const G = w.garden;
  const dark = w.mats.darkWood;

  // ------------------------------------------------------------------ magic tree (grows one stage per watered day)
  const tree = new THREE.Group();
  tree.position.set(18.0, -0.06, 15.3);
  const trunk = cyl(0.12, 0.2, 1.6, std('#6b4430', { roughness: 0.9 }), 0, 0.8, 0, 8);
  tree.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = 1.7;
  const leafCols = ['#5cbf7d', '#3fa36b', '#7ed9a0', '#b388ff'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const l = sphere(0.55, std(leafCols[i % leafCols.length], { roughness: 0.8 }), Math.cos(a) * 0.45, rand(-0.1, 0.4), Math.sin(a) * 0.45, 12);
    crown.add(l);
  }
  crown.add(sphere(0.7, std('#4caf7a', { roughness: 0.8 }), 0, 0.5, 0, 14));
  tree.add(crown);
  const fruits: THREE.Mesh[] = [];
  for (let i = 0; i < TREE_MAX; i++) {
    const a = i * 2.4;
    const f = mesh(new THREE.SphereGeometry(0.11, 10, 8), glow(['#ffd36b', '#ff7eb6', '#7df9ff', '#b388ff'][i % 4], 2.2), Math.cos(a) * 0.75, 1.6 + (i % 3) * 0.35, Math.sin(a) * 0.75);
    f.castShadow = false;
    f.visible = false;
    fruits.push(f);
    tree.add(f);
  }
  G.add(tree);
  w.register('magictree', tree, new THREE.Vector3(0, 3.0, 0));
  const setTreeStage = (stage: number, animate = false) => {
    const k = 0.35 + (Math.min(stage, TREE_MAX) / TREE_MAX) * 0.85;
    if (animate) {
      const from = tree.scale.x;
      let t = 0;
      const grow = (dt: number) => {
        t = Math.min(1, t + dt * 0.8);
        const e = 1 - Math.pow(1 - t, 3);
        tree.scale.setScalar(from + (k - from) * e + Math.sin(t * Math.PI) * 0.08);
        if (t >= 1) w.updaters.splice(w.updaters.indexOf(grow), 1);
      };
      w.updaters.push(grow);
    } else tree.scale.setScalar(k);
    fruits.forEach((f, i) => { f.visible = i < stage; });
  };
  setTreeStage(0);

  // ------------------------------------------------------------------ mailbox
  const mail = new THREE.Group();
  mail.position.set(18.2, 0, 9.0);
  mail.rotation.y = Math.PI / 2;
  mail.add(cyl(0.06, 0.06, 1.1, dark, 0, 0.55, 0, 8));
  const boxMat = std('#ff7eb6', { roughness: 0.45 });
  mail.add(rbox(0.42, 0.38, 0.65, boxMat, 0, 1.25, 0, 0.06));
  mail.add(mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.65, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), boxMat, 0, 1.44, 0));
  mail.add(box(0.36, 0.3, 0.02, std('#d65f95'), 0, 1.27, 0.33));
  const mailFlag = new THREE.Group();
  mailFlag.position.set(0.23, 1.2, -0.1);
  mailFlag.add(box(0.03, 0.4, 0.04, std('#e63946'), 0, 0.2, 0));
  mailFlag.add(box(0.03, 0.14, 0.2, std('#e63946'), 0, 0.33, 0.1));
  mail.add(mailFlag);
  G.add(mail);
  w.register('mailbox', mail, new THREE.Vector3(0, 1.8, 0));

  // ------------------------------------------------------------------ bench, flowers, gnome
  const bench = new THREE.Group();
  bench.position.set(3.0, -0.06, 15.6);
  for (let i = 0; i < 3; i++) bench.add(box(1.8, 0.06, 0.14, w.mats.wood, 0, 0.5, -0.17 + i * 0.17));
  for (let i = 0; i < 2; i++) bench.add(box(1.8, 0.14, 0.05, w.mats.wood, 0, 0.75 + i * 0.2, -0.3));
  for (const s of [-1, 1]) {
    bench.add(box(0.06, 0.5, 0.5, w.mats.frame, s * 0.8, 0.25, 0));
    bench.add(box(0.06, 0.45, 0.05, w.mats.frame, s * 0.8, 0.75, -0.3));
  }
  G.add(bench);
  w.register('bench', bench, new THREE.Vector3(0, 1.1, 0));

  const flowers = new THREE.Group();
  flowers.position.set(9.4, -0.06, 14.6);
  flowers.add(rbox(4.2, 0.25, 0.8, std('#6b4430', { roughness: 1 }), 0, 0.12, 0, 0.06));
  flowers.add(box(4.0, 0.05, 0.6, std('#3b2618'), 0, 0.26, 0));
  const fc = ['#ff7eb6', '#ffd36b', '#b388ff', '#ff9a5c', '#7df9ff', '#ffffff'];
  for (let i = 0; i < 22; i++) {
    const x = -1.9 + (i / 21) * 3.8 + rand(-0.05, 0.05);
    const z = rand(-0.2, 0.2);
    const h = rand(0.25, 0.5);
    flowers.add(cyl(0.012, 0.012, h, std('#3fa36b'), x, 0.28 + h / 2, z, 4));
    const bloom = sphere(0.07, std(fc[i % fc.length], { roughness: 0.6 }), x, 0.3 + h, z, 8);
    bloom.scale.y = 0.6;
    flowers.add(bloom);
  }
  G.add(flowers);
  w.register('flowers', flowers, new THREE.Vector3(0, 0.9, 0));

  const gnome = new THREE.Group();
  gnome.position.set(-2.6, -0.06, 15.4);
  gnome.rotation.y = 0.5;
  gnome.add(cyl(0.2, 0.24, 0.35, std('#3f5bd9'), 0, 0.18, 0, 12));
  gnome.add(sphere(0.15, std('#ffd0b0'), 0, 0.45, 0, 12));
  gnome.add(mesh(new THREE.ConeGeometry(0.17, 0.42, 12), std('#e63946'), 0, 0.72, 0));
  const beard = mesh(new THREE.ConeGeometry(0.13, 0.25, 10), std('#ffffff'), 0, 0.33, 0.08);
  beard.rotation.x = Math.PI;
  gnome.add(beard);
  G.add(gnome);
  w.register('gnome', gnome, new THREE.Vector3(0, 1.0, 0));

  // ------------------------------------------------------------------ lamp posts, path, fence
  for (const [x, z] of [[-6.6, 14.8], [13.2, 16.0], [18.8, 3.4]]) {
    const p = new THREE.Group();
    p.position.set(x, -0.06, z);
    p.add(cyl(0.06, 0.08, 2.2, w.mats.frame, 0, 1.1, 0, 8));
    p.add(mesh(new THREE.SphereGeometry(0.17, 12, 10), glow('#ffd59a', 2.4), 0, 2.3, 0));
    p.add(mesh(new THREE.ConeGeometry(0.22, 0.16, 12), w.mats.frame, 0, 2.5, 0));
    G.add(p);
  }
  const stoneMat = std('#a69cc9', { roughness: 0.9, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const s = mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.06, 7), stoneMat, 18.0 + Math.sin(t * 3) * 0.5, -0.04, 13.0 - t * 12.4);
    s.rotation.y = i;
    G.add(s);
  }
  const picket = std('#f3efe4', { roughness: 0.6 });
  for (let x = -8; x <= 19; x += 0.45) {
    if (x > 16.6 && x < 19.4) continue;
    G.add(box(0.1, 0.55, 0.05, picket, x, 0.2, 16.95));
  }
  G.add(box(25.6, 0.06, 0.04, picket, 4.2, 0.36, 16.95));

  // ------------------------------------------------------------------ fireflies (shop extra)
  const N = 70;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos.set([rand(-7, 19.5), rand(0.4, 3.0), i % 2 ? rand(13.8, 16.8) : rand(-8, 16.5)], i * 3);
  for (let i = 0; i < N; i += 2) pos[i * 3] = rand(16.5, 19.5);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: new THREE.Color('#d8ff7a').multiplyScalar(2.2), size: 0.14, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  fireflies.userData.ignoreRay = true;
  fireflies.visible = false;
  G.add(fireflies);
  const base = pos.slice();
  w.updaters.push((_dt, t) => {
    if (!fireflies.visible) return;
    const p = fg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      p.setX(i, base[i * 3] + Math.sin(t * 0.7 + i) * 0.4);
      p.setY(i, base[i * 3 + 1] + Math.sin(t * 1.1 + i * 2) * 0.3);
      p.setZ(i, base[i * 3 + 2] + Math.cos(t * 0.6 + i) * 0.4);
    }
    p.needsUpdate = true;
    (fireflies.material as THREE.PointsMaterial).opacity = 0.6 + Math.sin(t * 3) * 0.3;
  });

  return { setTreeStage, tree, mailFlag, fireflies };
}
