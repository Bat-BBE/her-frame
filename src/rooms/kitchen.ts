import { THREE, canvasTex, std, glow, mesh, rand, rbox, box, cyl, sphere, checkTexture, tileTexture } from './kit';
import type { World } from '../world';

export interface KitchenRefs {
  fridgeDoor: THREE.Object3D;
  cupboardDoor: THREE.Object3D;
  pan: THREE.Group;
  pancake: THREE.Mesh;
  plate: THREE.Group;
  hob: THREE.MeshStandardMaterial;
  pantryDoor: THREE.Object3D;
  vacuum: THREE.Group;
  pendant: THREE.PointLight;
}

export function buildKitchen(w: World): KitchenRefs {
  const R = w.room;
  const dark = w.mats.darkWood;
  const cabinet = std('#f3efe4', { roughness: 0.5 });
  const cabinet2 = std('#e2dccd', { roughness: 0.55 });
  const counterTop = std('#3a3550', { roughness: 0.35 });
  const steel = std('#c9ced8', { metalness: 0.75, roughness: 0.3 });

  // ------------------------------------------------------------------ backsplash tiles on the left wall
  const bs = tileTexture('#f6f2ea', '#e9f3ef', 10, 'rgba(80,120,110,0.35)');
  bs.wrapS = bs.wrapT = THREE.RepeatWrapping;
  bs.repeat.set(4, 1.2);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.25), std('#ffffff', { map: bs, roughness: 0.4 }));
  back.rotation.y = Math.PI / 2;
  back.position.set(5.115, 1.68, 8.2);
  R.add(w.mount(back, 'x', 5));

  // ------------------------------------------------------------------ fridge (recipe note)
  const fridge = new THREE.Group();
  fridge.position.set(5.72, 0, 5.62);
  const fMat = std('#9fd8cf', { roughness: 0.35 });
  fridge.add(rbox(1.1, 3.0, 0.92, fMat, 0, 1.5, 0, 0.08));
  const fridgeDoor = new THREE.Group();
  fridgeDoor.position.set(0.55, 0, 0.47);
  fridgeDoor.add(rbox(0.06, 1.9, 0.9, fMat, 0, 1.95, -0.45, 0.03));
  fridgeDoor.add(rbox(0.06, 0.95, 0.9, fMat, 0, 0.5, -0.45, 0.03));
  fridgeDoor.add(box(0.05, 0.6, 0.05, steel, 0.05, 1.65, -0.82));
  // recipe note + magnets
  const note = canvasTex(192, 256, (ctx) => {
    ctx.fillStyle = '#fff7d6';
    ctx.fillRect(0, 0, 192, 256);
    ctx.fillStyle = '#5a3a2a';
    ctx.font = '700 30px Caveat, cursive';
    ctx.fillText('Мочигийн бин', 16, 42);
    ctx.font = '600 26px Caveat, cursive';
    ['🥚 өндөг', '🥛 сүү', '🌾 гурил', '🍯 бал'].forEach((t, i) => ctx.fillText(t, 22, 92 + i * 40));
  });
  const notePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), std('#fff', { map: note.tex, roughness: 0.9 }));
  notePlane.rotation.y = Math.PI / 2;
  notePlane.position.set(0.04, 2.2, -0.42);
  fridgeDoor.add(notePlane);
  for (const [y, z, c] of [[2.5, -0.25, '#ff7eb6'], [1.2, -0.6, '#ffd36b'], [1.0, -0.3, '#7df9ff']] as [number, number, string][]) {
    fridgeDoor.add(sphere(0.05, std(c), 0.05, y, z, 8));
  }
  fridge.add(fridgeDoor);
  // inside (visible when open): eggs + milk
  fridge.add(box(0.9, 0.04, 0.8, std('#ffffff', { roughness: 0.3 }), 0, 1.6, 0));
  fridge.add(box(0.12, 0.3, 0.12, std('#ffffff'), -0.2, 1.78, 0.1));
  for (let i = 0; i < 3; i++) fridge.add(sphere(0.06, std('#fff2dc'), 0.15 + i * 0.1, 1.68, 0.15, 8));
  R.add(fridge);
  w.register('fridge', fridge, new THREE.Vector3(0.4, 2.8, 0.3));

  // ------------------------------------------------------------------ left counter run: stove, toaster, kettle, cookie jar
  const run = new THREE.Group();
  run.position.set(5.5, 0, 8.18);
  run.add(rbox(0.75, 1.0, 4.0, cabinet, 0, 0.5, 0, 0.03));
  run.add(box(0.82, 0.07, 4.05, counterTop, 0.02, 1.04, 0));
  for (let i = 0; i < 5; i++) {
    run.add(box(0.02, 0.8, 0.74, cabinet2, 0.38, 0.48, -1.6 + i * 0.8));
    run.add(box(0.03, 0.04, 0.25, steel, 0.4, 0.82, -1.6 + i * 0.8));
  }
  R.add(run);

  // stove + pan
  const stove = new THREE.Group();
  stove.position.set(5.5, 1.08, 7.0);
  stove.add(box(0.7, 0.03, 0.8, std('#1e1b2a', { roughness: 0.3 }), 0, 0.01, 0));
  const hob = new THREE.MeshStandardMaterial({ color: '#2a1a1a', emissive: '#ff4a2a', emissiveIntensity: 0 });
  for (const [x, z] of [[-0.15, -0.2], [-0.15, 0.2], [0.15, -0.2], [0.15, 0.2]]) stove.add(mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 20).rotateX(Math.PI / 2), hob, x, 0.03, z));
  const pan = new THREE.Group();
  pan.position.set(0.15, 0.05, -0.2);
  pan.add(cyl(0.2, 0.17, 0.06, std('#2a2a33', { metalness: 0.5, roughness: 0.4 }), 0, 0.03, 0, 20));
  const handle = box(0.04, 0.03, 0.35, std('#1a1a22'), 0, 0.05, 0.36);
  pan.add(handle);
  const pancake = cyl(0.15, 0.15, 0.035, std('#e8b25a', { roughness: 0.8 }), 0, 0.075, 0, 20);
  pancake.visible = false;
  pan.add(pancake);
  stove.add(pan);
  // hood
  stove.add(box(0.5, 0.5, 0.9, steel, -0.15, 1.6, 0));
  stove.add(box(0.2, 1.4, 0.3, steel, -0.25, 2.5, 0));
  R.add(stove);
  w.register('stove', stove, new THREE.Vector3(0, 0.6, 0));

  const toaster = new THREE.Group();
  toaster.position.set(5.5, 1.08, 8.3);
  toaster.add(rbox(0.3, 0.26, 0.42, std('#ff8fb1', { roughness: 0.35 }), 0, 0.13, 0, 0.08));
  for (const z of [-0.08, 0.08]) toaster.add(box(0.06, 0.02, 0.28, std('#2a1a22'), 0, 0.265, z * 0.5 + (z > 0 ? 0.04 : -0.04)));
  toaster.add(box(0.05, 0.05, 0.03, std('#333'), 0.16, 0.18, 0.12));
  R.add(toaster);
  w.register('toaster', toaster, new THREE.Vector3(0, 0.45, 0));

  const kettle = new THREE.Group();
  kettle.position.set(5.5, 1.08, 9.0);
  kettle.add(sphere(0.17, std('#3f5bd9', { roughness: 0.3 }), 0, 0.16, 0, 16));
  kettle.add(cyl(0.04, 0.04, 0.05, std('#222'), 0, 0.33, 0, 8));
  const spout = cyl(0.02, 0.035, 0.18, std('#3f5bd9'), 0.18, 0.2, 0, 8);
  spout.rotation.z = -0.8;
  kettle.add(spout);
  kettle.add(mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12, Math.PI), std('#222'), -0.02, 0.32, 0));
  R.add(kettle);
  w.register('kettle', kettle, new THREE.Vector3(0, 0.5, 0));

  const jar = new THREE.Group();
  jar.position.set(5.5, 1.08, 9.75);
  jar.add(cyl(0.15, 0.15, 0.3, new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.45, roughness: 0.1 }), 0, 0.15, 0, 16));
  jar.add(cyl(0.16, 0.16, 0.05, std('#c98a4b'), 0, 0.32, 0, 16));
  for (let i = 0; i < 3; i++) jar.add(cyl(0.07, 0.07, 0.025, std('#c98a4b'), rand(-0.05, 0.05), 0.04 + i * 0.03, rand(-0.05, 0.05), 12));
  R.add(jar);
  w.register('cookiejar', jar, new THREE.Vector3(0, 0.5, 0));

  // upper cabinets on the left wall — one hides the flour
  const upper = new THREE.Group();
  upper.position.set(5.32, 2.85, 8.15);
  upper.add(rbox(0.45, 1.0, 3.9, cabinet, 0, 0, 0, 0.03));
  for (const z of [-1.45, -0.48, 1.45]) upper.add(box(0.02, 0.9, 0.9, cabinet2, 0.235, 0, z));
  R.add(w.mount(upper, 'x', 5));
  const cup = new THREE.Group();
  cup.position.set(5.32, 2.85, 8.15);
  const cupboardDoor = new THREE.Group();
  cupboardDoor.position.set(0.24, 0, 0.0);
  cupboardDoor.add(box(0.03, 0.9, 0.92, std('#ffd36b', { roughness: 0.5 }), 0, 0, 0.47));
  cupboardDoor.add(box(0.03, 0.2, 0.04, steel, 0.03, -0.25, 0.85));
  cup.add(cupboardDoor);
  cup.add(box(0.3, 0.4, 0.3, std('#f2e6c8'), 0, -0.2, 0.47)); // flour sack inside
  R.add(w.mount(cup, 'x', 5));
  w.register('cupboard', cup, new THREE.Vector3(0.3, 0.2, 0.47));

  // ------------------------------------------------------------------ back counter (right of the door): sink, herbs, shelf with honey
  const bc = new THREE.Group();
  bc.position.set(9.9, 0, 5.48);
  bc.add(rbox(2.0, 1.0, 0.72, cabinet, 0, 0.5, 0, 0.03));
  bc.add(box(2.05, 0.07, 0.78, counterTop, 0, 1.04, 0.02));
  for (const x of [-0.5, 0.5]) bc.add(box(0.9, 0.8, 0.02, cabinet2, x, 0.48, 0.37));
  R.add(bc);
  const sink = new THREE.Group();
  sink.position.set(10.2, 1.08, 5.5);
  sink.add(box(0.7, 0.04, 0.5, steel, 0, 0.0, 0));
  sink.add(box(0.6, 0.02, 0.4, std('#8a90a0', { metalness: 0.6, roughness: 0.3 }), 0, 0.01, 0));
  const tap = cyl(0.025, 0.025, 0.35, steel, 0, 0.18, -0.2, 8);
  sink.add(tap);
  sink.add(box(0.03, 0.03, 0.18, steel, 0, 0.34, -0.12));
  R.add(sink);
  w.register('sink', sink, new THREE.Vector3(0, 0.5, 0));

  const herbs = new THREE.Group();
  herbs.position.set(9.2, 1.08, 5.45);
  herbs.add(rbox(0.5, 0.2, 0.22, std('#e07a5f'), 0, 0.1, 0));
  for (let i = 0; i < 7; i++) {
    const l = sphere(0.08, std(i % 2 ? '#5cbf7d' : '#3fa36b'), -0.18 + i * 0.06, 0.25 + rand(0, 0.1), rand(-0.04, 0.04), 8);
    l.scale.y = 1.4;
    herbs.add(l);
  }
  R.add(herbs);
  w.register('herbs', herbs, new THREE.Vector3(0, 0.5, 0));

  const jarShelf = new THREE.Group();
  jarShelf.add(box(2.0, 0.06, 0.32, dark, 9.9, 2.6, 5.27));
  for (let i = 0; i < 4; i++) {
    const c = ['#ff8fb1', '#7cc6c0', '#c77dff', '#f2c14e'][i];
    jarShelf.add(cyl(0.09, 0.09, 0.24, std(c, { roughness: 0.4 }), 9.1 + i * 0.32, 2.75, 5.27, 10));
  }
  R.add(w.mount(jarShelf, 'z', 5));
  const honey = new THREE.Group();
  honey.position.set(10.6, 2.63, 5.27);
  honey.add(cyl(0.11, 0.12, 0.26, new THREE.MeshStandardMaterial({ color: '#ffb800', emissive: '#ff9a00', emissiveIntensity: 0.25, roughness: 0.2 }), 0, 0.13, 0, 14));
  honey.add(cyl(0.12, 0.12, 0.05, std('#c98a4b'), 0, 0.28, 0, 14));
  R.add(w.mount(honey, 'z', 5));
  w.register('honey', honey, new THREE.Vector3(0, 0.45, 0.1));

  // ------------------------------------------------------------------ pantry (hiding spot)
  const pantry = new THREE.Group();
  pantry.position.set(5.55, 0, 12.4);
  pantry.add(rbox(0.85, 2.1, 1.7, std('#6a8f84', { roughness: 0.5 }), 0, 1.05, 0, 0.04));
  const pantryDoor = new THREE.Group();
  pantryDoor.position.set(0.44, 0, -0.84);
  pantryDoor.add(rbox(0.05, 1.95, 1.66, std('#7fa89c', { roughness: 0.5 }), 0, 1.05, 0.83, 0.02));
  for (let i = 0; i < 4; i++) pantryDoor.add(box(0.02, 0.03, 1.4, std('#5f8579'), 0.03, 0.4 + i * 0.4, 0.83));
  pantryDoor.add(box(0.05, 0.3, 0.04, steel, 0.05, 1.1, 1.5));
  pantry.add(cyl(0.12, 0.12, 0.3, std('#e07a5f'), 0, 2.25, 0.3, 10));
  pantry.add(cyl(0.1, 0.1, 0.24, std('#f2e6c8'), 0, 2.22, -0.3, 10));
  pantry.add(pantryDoor);
  R.add(pantry);
  w.register('pantry', pantry, new THREE.Vector3(0.4, 2.3, 0));

  // ------------------------------------------------------------------ dining table + chairs + fruit + pendant
  const table = new THREE.Group();
  table.position.set(8.6, 0, 10.4);
  const clothTex = checkTexture('#ffffff', '#ff7eb6', 10);
  table.add(cyl(0.95, 0.95, 0.06, std('#ffffff', { map: clothTex, roughness: 0.95 }), 0, 0.82, 0, 32));
  table.add(cyl(0.97, 0.97, 0.12, std('#ffffff', { map: clothTex, roughness: 0.95 }), 0, 0.76, 0, 32));
  table.add(cyl(0.08, 0.12, 0.76, dark, 0, 0.38, 0, 10));
  table.add(cyl(0.4, 0.45, 0.05, dark, 0, 0.03, 0, 20));
  const plate = new THREE.Group();
  plate.position.set(0.35, 0.86, 0.3);
  plate.add(cyl(0.2, 0.16, 0.03, std('#ffffff', { roughness: 0.3 }), 0, 0, 0, 20));
  const stack = cyl(0.15, 0.15, 0.1, std('#e8b25a', { roughness: 0.8 }), 0, 0.06, 0, 20);
  plate.add(stack);
  plate.add(cyl(0.06, 0.06, 0.02, std('#ffb800', { roughness: 0.2 }), 0, 0.12, 0, 12));
  plate.visible = false;
  table.add(plate);
  R.add(table);
  w.register('ktable', table, new THREE.Vector3(0, 1.1, 0));

  const fruit = new THREE.Group();
  fruit.position.set(8.4, 0.86, 10.2);
  fruit.add(cyl(0.25, 0.15, 0.1, std('#7cc6c0', { roughness: 0.5 }), 0, 0.05, 0, 16));
  for (const [x, z, c] of [[-0.08, 0, '#e63946'], [0.08, 0.05, '#ff9a3c'], [0, -0.1, '#7ed957'], [0.02, 0.08, '#ffd36b']] as [number, number, string][]) {
    fruit.add(sphere(0.08, std(c, { roughness: 0.4 }), x, 0.14, z, 10));
  }
  R.add(fruit);
  w.register('fruit', fruit, new THREE.Vector3(0, 0.35, 0));

  const chairMat = std('#ffcf8a', { roughness: 0.6 });
  for (const a of [0.4, 2.4, 4.3]) {
    const c = new THREE.Group();
    c.position.set(8.6 + Math.cos(a) * 1.25, 0, 10.4 + Math.sin(a) * 1.25);
    c.rotation.y = -a - Math.PI / 2;
    c.add(rbox(0.5, 0.07, 0.5, chairMat, 0, 0.55, 0));
    c.add(rbox(0.5, 0.6, 0.06, chairMat, 0, 0.88, -0.22));
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) c.add(box(0.04, 0.55, 0.04, dark, x, 0.27, z));
    R.add(c);
  }

  const pend = new THREE.Group();
  pend.position.set(8.6, 0, 10.4);
  pend.add(cyl(0.01, 0.01, 2.0, std('#222'), 0, 4.0, 0, 4));
  pend.add(mesh(new THREE.ConeGeometry(0.35, 0.3, 20, 1, true), std('#2f6b5e', { side: THREE.DoubleSide }), 0, 2.9, 0));
  pend.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), glow('#ffd59a', 2.5), 0, 2.78, 0));
  R.add(pend);
  const pendant = w.addLight(new THREE.PointLight('#ffc98a', 9, 10, 1.5));
  pendant.position.set(8.6, 2.6, 10.4);

  // ------------------------------------------------------------------ robot vacuum (shop extra)
  const vacuum = new THREE.Group();
  vacuum.add(cyl(0.28, 0.28, 0.1, std('#2a2a33', { roughness: 0.4 }), 0, 0.06, 0, 24));
  vacuum.add(cyl(0.2, 0.2, 0.02, std('#3f5bd9'), 0, 0.12, 0, 20));
  vacuum.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), glow('#7df9ff', 2.5), 0.15, 0.12, 0));
  vacuum.position.set(8.2, 0, 7.6);
  vacuum.visible = false;
  vacuum.userData.target = new THREE.Vector3(8.2, 0, 7.6);
  R.add(vacuum);

  w.updaters.push((dt) => {
    if (!vacuum.visible) return;
    const tg = vacuum.userData.target as THREE.Vector3;
    const d = tg.clone().sub(vacuum.position);
    if (d.length() < 0.1) tg.set(rand(6.6, 10.5), 0, rand(6.4, 8.8));
    else {
      d.normalize();
      vacuum.position.addScaledVector(d, dt * 0.5);
      vacuum.rotation.y = Math.atan2(d.x, d.z);
    }
  });

  w.rooms.get('kitchen')!.mochiSpot.set(9.55, 0.6, 11.3);
  return { fridgeDoor, cupboardDoor, pan, pancake, plate, hob, pantryDoor, vacuum, pendant };
}
