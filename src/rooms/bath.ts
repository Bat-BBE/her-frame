import { THREE, canvasTex, std, glow, mesh, rand, rbox, box, cyl, sphere, pottedPlant } from './kit';
import type { World } from '../world';

export interface BathRefs {
  water: THREE.Mesh;
  steam: THREE.Group;
  mirror: ReturnType<typeof canvasTex>;
  mirrorMat: THREE.MeshStandardMaterial;
  washerDrum: THREE.Object3D;
  duck: THREE.Group;
  closetDoor: THREE.Object3D;
  curtain: THREE.Group;
}

export function buildBath(w: World): BathRefs {
  const R = w.room;
  const porcelain = std('#e4e9f2', { roughness: 0.35 });
  const chrome = std('#d6dbe6', { metalness: 0.85, roughness: 0.2 });

  // ------------------------------------------------------------------ clawfoot tub + water + steam
  const tub = new THREE.Group();
  tub.position.set(12.7, 0, 5.95);
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.55, 8, 20), porcelain);
  shell.rotation.z = Math.PI / 2;
  shell.scale.set(0.8, 1, 1.05);
  shell.position.y = 0.62;
  shell.castShadow = shell.receiveShadow = true;
  tub.add(shell);
  tub.add(box(2.6, 0.04, 1.1, std('#bfe6f2', { roughness: 0.2 }), 0, 1.05, 0)); // rim shadow
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), porcelain);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1.36, 0.6, 1);
  rim.position.y = 1.08;
  tub.add(rim);
  for (const [x, z] of [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]]) tub.add(sphere(0.08, w.mats.gold, x, 0.08, z, 10));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.95), new THREE.MeshStandardMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.7;
  water.scale.set(0.9, 0.9, 1);
  tub.add(water);
  // faucet on the wall end
  const faucet = new THREE.Group();
  faucet.position.set(-1.25, 1.2, 0);
  faucet.add(cyl(0.04, 0.04, 0.35, chrome, 0, 0.1, 0, 10));
  faucet.add(box(0.25, 0.05, 0.05, chrome, 0.12, 0.27, 0));
  for (const s of [-1, 1]) faucet.add(cyl(0.05, 0.05, 0.05, s < 0 ? std('#ff5f7a') : std('#5ab8ff'), 0, 0.2, s * 0.12, 10));
  tub.add(faucet);
  R.add(tub);
  w.register('tub', tub, new THREE.Vector3(0, 1.3, 0));
  const faucetHit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  faucetHit.position.copy(tub.position).add(new THREE.Vector3(-1.25, 1.35, 0));
  R.add(faucetHit);
  w.register('faucet', faucetHit, new THREE.Vector3(0, 0.3, 0));

  const duck = new THREE.Group();
  duck.position.set(13.2, 0.72, 6.0);
  const duckBody = sphere(0.13, std('#ffe066', { roughness: 0.4 }), 0, 0.08, 0, 14);
  duckBody.scale.set(1.3, 0.9, 1);
  duck.add(duckBody);
  duck.add(sphere(0.08, std('#ffe066', { roughness: 0.4 }), 0.1, 0.22, 0, 12));
  duck.add(mesh(new THREE.ConeGeometry(0.035, 0.08, 8).rotateZ(-Math.PI / 2), std('#ff9a3c'), 0.2, 0.21, 0));
  for (const s of [-1, 1]) duck.add(sphere(0.012, std('#1a1030'), 0.15, 0.25, s * 0.045, 6));
  R.add(duck);
  w.register('duck', duck, new THREE.Vector3(0, 0.45, 0));

  const steam = new THREE.Group();
  const puffMat = new THREE.SpriteMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false });
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(puffMat.clone());
    s.position.set(12.7 + rand(-1.1, 1.1), rand(1.0, 3.2), 5.95 + rand(-0.4, 0.4));
    s.scale.setScalar(rand(0.5, 1.0));
    s.userData.ignoreRay = true;
    s.userData.seed = Math.random() * 10;
    steam.add(s);
  }
  steam.visible = false;
  R.add(steam);

  // shower curtain on a rail (the hiding spot)
  const curtain = new THREE.Group();
  R.add(cyl(0.025, 0.025, 2.7, chrome, 12.7, 3.2, 6.75, 8).rotateZ(Math.PI / 2));
  const cMat = std('#bfe6f2', { roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.1), cMat);
    p.position.set(11.55 + i * 0.14, 2.12, 6.75 + (i % 2) * 0.05);
    p.rotation.y = (i % 2 ? 0.4 : -0.4);
    curtain.add(p);
  }
  R.add(curtain);

  // ------------------------------------------------------------------ sink + mirror
  const sink = new THREE.Group();
  sink.position.set(15.2, 0, 5.45);
  sink.add(cyl(0.12, 0.18, 0.85, porcelain, 0, 0.42, 0, 14));
  sink.add(rbox(0.85, 0.18, 0.55, porcelain, 0, 0.92, 0.02, 0.08));
  sink.add(cyl(0.025, 0.025, 0.22, chrome, 0, 1.1, -0.18, 8));
  sink.add(box(0.03, 0.03, 0.14, chrome, 0, 1.2, -0.12));
  sink.add(rbox(0.12, 0.06, 0.08, std('#ff9ad5'), 0.28, 1.04, 0.05, 0.02));
  R.add(sink);
  w.register('bathsink', sink, new THREE.Vector3(0, 1.3, 0));

  const mirror = canvasTex(256, 320);
  const mirrorMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: mirror.tex, emissive: '#ffffff', emissiveMap: mirror.tex, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.3 });
  const mirrorG = new THREE.Group();
  mirrorG.position.set(15.2, 2.65, 5.12);
  const mGeo = new THREE.CircleGeometry(0.5, 40);
  mGeo.scale(1, 1.25, 1);
  const mPlane = new THREE.Mesh(mGeo, mirrorMat);
  mPlane.position.z = 0.03;
  mirrorG.add(mPlane);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.05, 10, 48), w.mats.gold);
  frame.scale.set(1, 1.25, 1);
  frame.position.z = 0.03;
  mirrorG.add(frame);
  R.add(w.mount(mirrorG, 'z', 5));
  w.register('mirror', mirrorG, new THREE.Vector3(0, 0.75, 0.1));

  // bottles on a shelf above the tub
  const shelf = new THREE.Group();
  shelf.position.set(12.7, 2.2, 5.2);
  shelf.add(box(1.4, 0.05, 0.25, w.mats.darkWood, 0, 0, 0));
  ['#ff9ad5', '#7df9ff', '#ffd36b', '#7ed957', '#b388ff'].forEach((c, i) => {
    shelf.add(rbox(0.12, 0.26 + (i % 2) * 0.08, 0.12, std(c, { roughness: 0.3 }), -0.5 + i * 0.25, 0.16 + (i % 2) * 0.04, 0, 0.04));
  });
  R.add(w.mount(shelf, 'z', 5));
  w.register('bottles', shelf, new THREE.Vector3(0, 0.45, 0));

  // ------------------------------------------------------------------ towel rack (left wall)
  const towel = new THREE.Group();
  towel.position.set(11.15, 1.7, 7.6);
  towel.add(cyl(0.02, 0.02, 0.9, chrome, 0.12, 0.3, 0, 8).rotateX(Math.PI / 2));
  towel.add(rbox(0.06, 0.9, 0.7, std('#ff7eb6', { roughness: 1 }), 0.14, 0.0, 0, 0.03));
  towel.add(box(0.07, 0.08, 0.7, std('#ffffff', { roughness: 1 }), 0.15, -0.3, 0));
  R.add(w.mount(towel, 'x', 11));
  w.register('towel', towel, new THREE.Vector3(0.2, 0.6, 0));

  // ------------------------------------------------------------------ washing machine
  const washer = new THREE.Group();
  washer.position.set(11.6, 0, 10.85);
  washer.add(rbox(0.85, 1.0, 0.8, std('#f2f4f8', { roughness: 0.35 }), 0, 0.5, 0, 0.05));
  const drum = new THREE.Group();
  drum.position.set(0.43, 0.48, 0);
  drum.rotation.z = Math.PI / 2;
  drum.add(mesh(new THREE.TorusGeometry(0.27, 0.04, 10, 32).rotateX(Math.PI / 2), chrome, 0, 0, 0));
  drum.add(mesh(new THREE.CircleGeometry(0.25, 24).rotateZ(0).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7fb2ff', transparent: true, opacity: 0.55, roughness: 0.1 }), 0.01, 0, 0));
  for (let i = 0; i < 3; i++) drum.add(box(0.02, 0.12, 0.05, std(['#ff7eb6', '#ffd36b', '#7ed957'][i]), -0.01, Math.cos(i * 2.1) * 0.12, Math.sin(i * 2.1) * 0.12));
  washer.add(drum);
  washer.add(box(0.02, 0.1, 0.5, std('#2a2046'), 0.43, 0.88, 0));
  washer.add(cyl(0.04, 0.04, 0.03, glow('#7ed957', 1.5), 0.44, 0.88, 0.3, 10).rotateZ(Math.PI / 2));
  R.add(washer);
  w.register('washer', washer, new THREE.Vector3(0.3, 1.2, 0));

  // ------------------------------------------------------------------ towel closet (hiding spot)
  const closet = new THREE.Group();
  closet.position.set(11.55, 0, 12.45);
  closet.add(rbox(0.85, 1.5, 1.6, std('#b8c8dc', { roughness: 0.5 }), 0, 0.75, 0, 0.04));
  const closetDoor = new THREE.Group();
  closetDoor.position.set(0.44, 0, -0.79);
  closetDoor.add(rbox(0.05, 1.36, 1.56, std('#cfdcec', { roughness: 0.45 }), 0, 0.75, 0.78, 0.02));
  closetDoor.add(box(0.05, 0.3, 0.04, chrome, 0.05, 0.85, 1.42));
  for (let i = 0; i < 2; i++) closetDoor.add(box(0.02, 0.04, 1.3, std('#a8bad2'), 0.03, 0.45 + i * 0.6, 0.78));
  // folded towels on top
  ['#ff9ad5', '#7cc6c0', '#ffd36b'].forEach((c, i) => closet.add(rbox(0.6, 0.12, 0.5, std(c, { roughness: 1 }), 0, 1.57 + i * 0.12, -0.4 + i * 0.06, 0.04)));
  closet.add(closetDoor);
  R.add(closet);
  w.register('closet', closet, new THREE.Vector3(0.4, 1.9, 0));

  // ------------------------------------------------------------------ basket, mat, plant
  const basket = new THREE.Group();
  basket.position.set(13.4, 0, 12.7);
  basket.add(cyl(0.38, 0.32, 0.6, std('#d9b48a', { roughness: 1 }), 0, 0.3, 0, 16));
  basket.add(sphere(0.25, std('#7cc6c0', { roughness: 1 }), 0.05, 0.6, 0, 10));
  basket.add(sphere(0.2, std('#ff9ad5', { roughness: 1 }), -0.12, 0.62, 0.1, 10));
  R.add(basket);
  w.register('basket', basket, new THREE.Vector3(0, 0.95, 0));

  const mat = rbox(1.3, 0.03, 0.8, std('#9be0d0', { roughness: 1 }), 12.8, 0.02, 7.3, 0.015);
  R.add(mat);
  w.register('bathmat', mat, new THREE.Vector3(0, 0.3, 0));

  const plant = pottedPlant(1.1, '#f2efe6');
  plant.position.set(15.8, 0, 12.9);
  R.add(plant);
  w.register('bathplant', plant, new THREE.Vector3(0, 1.5, 0));

  const light = w.addLight(new THREE.PointLight('#cfe8ff', 5, 10, 1.5));
  light.position.set(13.6, 3.8, 9.0);

  w.updaters.push((dt, t) => {
    if (washer.userData.spin) drum.rotation.x += dt * 9;
    if (steam.visible) steam.children.forEach((s) => {
      const k = ((t * 0.25 + (s.userData.seed as number)) % 1);
      s.position.y = 1.0 + k * 2.6;
      ((s as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.22;
    });
  });

  w.rooms.get('bath')!.mochiSpot.set(14.3, 0, 8.6);
  return { water, steam, mirror, mirrorMat, washerDrum: drum, duck, closetDoor, curtain };
}
