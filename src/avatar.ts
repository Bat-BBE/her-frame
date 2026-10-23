import * as THREE from 'three';
import gsap from 'gsap';
import { std, mesh } from './util';

export interface AvatarLook {
  name: string;
  /** 0 short · 1 bob · 2 ponytail · 3 buns */
  hair: number;
  hairColor: string;
  top: string;
  skin: string;
  glasses: boolean;
}

export const HAIR_COLORS = ['#2a1d1a', '#6b3f2a', '#d9a066', '#ff7eb6', '#7c66c9', '#5ab8ff'];
export const TOP_COLORS = ['#ff7eb6', '#ffd36b', '#7cc6c0', '#8b6cff', '#e36b6b', '#f4efe6'];
export const SKIN_COLORS = ['#ffe0c8', '#f2c49b', '#d39a6a', '#8d5a3b'];
export const HAIR_NAMES = ['Богино', 'Каре', 'Гэзэг', 'Боодол'];

export const defaultLook = (): AvatarLook => ({ name: '', hair: 1, hairColor: HAIR_COLORS[0], top: TOP_COLORS[3], skin: SKIN_COLORS[0], glasses: false });

/** The player's little chibi self. Walks paths handed to it, and acts things out. */
export class Avatar {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private hairG = new THREE.Group();
  private glassesG = new THREE.Group();
  private legs: THREE.Object3D[] = [];
  private arms: THREE.Object3D[] = [];
  private mats = {
    skin: std('#ffe0c8', { roughness: 0.6 }),
    top: std('#8b6cff', { roughness: 0.7 }),
    pants: std('#3a3560', { roughness: 0.8 }),
    shoes: std('#f4efe6', { roughness: 0.6 }),
    hair: std('#2a1d1a', { roughness: 0.55 }),
  };
  private ring: THREE.Mesh;
  private marker: THREE.Mesh;
  private path: THREE.Vector3[] = [];
  private done?: (ok: boolean) => void;
  private phase = 0;
  private speed = 3.0;
  private shake = false;
  hidden = false;
  /** Busy with a scripted action (reach / cheer) — no walk cycle. */
  private acting = false;

  constructor(parent: THREE.Object3D) {
    const m = this.mats;
    // legs (pivot at the hip)
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.1, 0.42, 0);
      hip.add(mesh(new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), m.pants, 0, -0.18, 0));
      const shoe = mesh(new THREE.SphereGeometry(0.09, 10, 8), m.shoes, 0, -0.37, 0.04);
      shoe.scale.set(1, 0.6, 1.4);
      hip.add(shoe);
      this.legs.push(hip);
      this.body.add(hip);
    }
    // torso
    const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.22, 6, 14), m.top, 0, 0.62, 0);
    torso.scale.set(1, 1, 0.8);
    this.body.add(torso);
    this.body.add(mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.08, 14), m.pants, 0, 0.44, 0));
    // arms (pivot at the shoulder)
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.25, 0.76, 0);
      sh.add(mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), m.top, 0, -0.14, 0));
      sh.add(mesh(new THREE.SphereGeometry(0.065, 10, 8), m.skin, 0, -0.3, 0));
      sh.rotation.z = s * 0.12;
      this.arms.push(sh);
      this.body.add(sh);
    }
    // head
    this.head.position.y = 1.08;
    const skull = mesh(new THREE.SphereGeometry(0.27, 24, 18), m.skin, 0, 0, 0);
    skull.scale.set(1, 0.95, 0.95);
    this.head.add(skull);
    for (const s of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.035, 10, 8), std('#1a1030', { roughness: 0.2 }), s * 0.095, -0.01, 0.235);
      eye.scale.y = 1.25;
      this.head.add(eye);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff' }));
      hl.position.set(s * 0.095 + 0.012, 0.01, 0.265);
      this.head.add(hl);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 6), std('#ff9cc5'));
      blush.scale.set(1, 0.5, 0.3);
      blush.position.set(s * 0.16, -0.07, 0.21);
      this.head.add(blush);
      // glasses
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 16), std('#2a2046'));
      lens.position.set(s * 0.095, -0.01, 0.255);
      this.glassesG.add(lens);
    }
    this.glassesG.add(mesh(new THREE.BoxGeometry(0.07, 0.012, 0.012), std('#2a2046'), 0, -0.005, 0.262));
    this.head.add(this.glassesG);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 12, Math.PI), std('#7a2a3a'));
    smile.position.set(0, -0.08, 0.245);
    smile.rotation.z = Math.PI;
    this.head.add(smile);
    this.head.add(this.hairG);
    this.body.add(this.head);
    this.group.add(this.body);

    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 32), new THREE.MeshBasicMaterial({ color: '#b388ff', transparent: true, opacity: 0.55, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.group.add(this.ring);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.24, 32), new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2;
    this.group.traverse((o) => { o.userData.ignoreRay = true; });
    this.marker.userData.ignoreRay = true;
    this.body.scale.setScalar(1);
    this.group.scale.setScalar(1.18);
    parent.add(this.group, this.marker);
    this.setLook(defaultLook());
  }

  setLook(l: AvatarLook) {
    this.mats.skin.color.set(l.skin);
    this.mats.top.color.set(l.top);
    this.mats.hair.color.set(l.hairColor);
    this.glassesG.visible = l.glasses;
    this.hairG.clear();
    const H = this.mats.hair;
    const cap = mesh(new THREE.SphereGeometry(0.29, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), H, 0, 0.02, -0.02);
    cap.rotation.x = -0.25;
    this.hairG.add(cap);
    const fringe = mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), H, 0, 0.1, 0.1);
    fringe.rotation.x = 0.5;
    this.hairG.add(fringe);
    if (l.hair === 1) {
      for (const s of [-1, 1]) {
        const side = mesh(new THREE.CapsuleGeometry(0.11, 0.2, 4, 10), H, s * 0.21, -0.1, -0.03);
        this.hairG.add(side);
      }
      this.hairG.add(mesh(new THREE.SphereGeometry(0.25, 16, 12), H, 0, -0.06, -0.12));
    } else if (l.hair === 2) {
      const tail = mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 10), H, 0, -0.12, -0.32);
      tail.rotation.x = 0.5;
      this.hairG.add(tail, mesh(new THREE.SphereGeometry(0.06, 8, 6), std('#ff7eb6'), 0, 0.06, -0.27));
    } else if (l.hair === 3) {
      for (const s of [-1, 1]) this.hairG.add(mesh(new THREE.SphereGeometry(0.11, 14, 10), H, s * 0.19, 0.2, -0.08));
    }
    this.hairG.traverse((o) => { o.userData.ignoreRay = true; });
  }

  get position() { return this.group.position; }
  get moving() { return this.path.length > 0; }

  place(p: THREE.Vector3, look?: THREE.Vector3) {
    this.cancel();
    this.group.position.copy(p);
    this.group.visible = true;
    this.hidden = false;
    this.body.scale.setScalar(1);
    if (look) this.face(look, true);
  }

  /** Vanish in a puff and reappear at p. */
  poofTo(p: THREE.Vector3) {
    this.cancel();
    return new Promise<void>((res) => {
      gsap.to(this.body.scale, {
        x: 0.01, y: 0.01, z: 0.01, duration: 0.25, ease: 'back.in(2)',
        onComplete: () => {
          this.group.position.copy(p);
          gsap.to(this.body.scale, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'back.out(2.4)', onComplete: () => res() });
        },
      });
    });
  }

  cancel() {
    this.path = [];
    const d = this.done;
    this.done = undefined;
    d?.(false);
  }

  /** Walk a path (from Nav). Resolves true on arrival, false if interrupted. */
  follow(path: THREE.Vector3[], run = false): Promise<boolean> {
    this.cancel();
    if (!path.length) return Promise.resolve(true);
    this.speed = run ? 4.4 : 3.0;
    this.path = path.map((p) => p.clone());
    const last = path[path.length - 1];
    this.marker.position.set(last.x, last.y + 0.03, last.z);
    gsap.killTweensOf(this.marker.material);
    gsap.fromTo(this.marker.material, { opacity: 0.9 }, { opacity: 0, duration: 1.4 });
    gsap.fromTo(this.marker.scale, { x: 1.6, y: 1.6, z: 1.6 }, { x: 1, y: 1, z: 1, duration: 0.5 });
    return new Promise((res) => { this.done = res; });
  }

  face(p: THREE.Vector3, instant = false) {
    const a = Math.atan2(p.x - this.group.position.x, p.z - this.group.position.z);
    if (instant) {
      this.group.rotation.y = a;
      return;
    }
    let d = a - this.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    gsap.to(this.group.rotation, { y: this.group.rotation.y + d, duration: 0.25 });
  }

  /** Reach out to touch / use something. */
  reach(): Promise<void> {
    this.acting = true;
    const arm = this.arms[1];
    return new Promise((res) => gsap.timeline({ onComplete: () => { this.acting = false; res(); } })
      .to(arm.rotation, { x: -1.5, z: 0.1, duration: 0.18, ease: 'power2.out' })
      .to(this.body.rotation, { x: 0.12, duration: 0.18 }, 0)
      .to(arm.rotation, { x: 0, z: 0.12, duration: 0.25, ease: 'power2.in' }, 0.3)
      .to(this.body.rotation, { x: 0, duration: 0.25 }, 0.3));
  }

  cheer() {
    if (this.hidden) return;
    this.acting = true;
    gsap.timeline({ onComplete: () => { this.acting = false; } })
      .to(this.arms.map((a) => a.rotation), { x: -2.8, duration: 0.2 })
      .to(this.body.position, { y: 0.35, duration: 0.22, ease: 'power2.out' }, 0)
      .to(this.body.position, { y: 0, duration: 0.3, ease: 'bounce.out' })
      .to(this.body.position, { y: 0.25, duration: 0.2, ease: 'power2.out' })
      .to(this.body.position, { y: 0, duration: 0.3, ease: 'bounce.out' })
      .to(this.arms.map((a) => a.rotation), { x: 0, duration: 0.25 });
  }

  wave() {
    this.acting = true;
    const arm = this.arms[1];
    gsap.timeline({ onComplete: () => { this.acting = false; } })
      .to(arm.rotation, { z: 2.6, duration: 0.2 })
      .to(arm.rotation, { z: 2.2, duration: 0.15, yoyo: true, repeat: 3 })
      .to(arm.rotation, { z: 0.12, duration: 0.25 });
  }

  scared(on: boolean) { this.shake = on; }

  /** Squeeze into a hiding place. */
  hideIn(spot: THREE.Vector3) {
    this.hidden = true;
    this.cancel();
    return new Promise<void>((res) => gsap.timeline({ onComplete: () => { this.group.visible = false; res(); } })
      .to(this.group.position, { x: spot.x, z: spot.z, duration: 0.35, ease: 'power2.in' })
      .to(this.body.scale, { x: 0.2, y: 0.2, z: 0.2, duration: 0.35, ease: 'power2.in' }, 0));
  }

  unhide(at: THREE.Vector3) {
    this.hidden = false;
    this.group.visible = true;
    this.group.position.copy(at);
    gsap.fromTo(this.body.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2.5)' });
  }

  knockdown() {
    this.cancel();
    this.acting = true;
    gsap.timeline({ onComplete: () => { this.acting = false; } })
      .to(this.body.rotation, { x: -1.4, duration: 0.3, ease: 'power2.in' })
      .to(this.body.position, { y: 0.15, duration: 0.3 }, 0)
      .to({}, { duration: 1.2 })
      .to(this.body.rotation, { x: 0, duration: 0.5, ease: 'back.out(2)' })
      .to(this.body.position, { y: 0, duration: 0.5 }, '<');
  }

  update(dt: number, t: number) {
    const g = this.group;
    let walking = false;
    if (this.path.length && !this.hidden) {
      const target = this.path[0];
      const to = new THREE.Vector3(target.x - g.position.x, 0, target.z - g.position.z);
      const d = to.length();
      const step = this.speed * dt;
      if (d <= step) {
        g.position.x = target.x;
        g.position.z = target.z;
        g.position.y = target.y;
        this.path.shift();
        if (!this.path.length) {
          const done = this.done;
          this.done = undefined;
          done?.(true);
        }
      } else {
        to.multiplyScalar(step / d);
        g.position.add(to);
        const a = Math.atan2(to.x, to.z);
        let diff = a - g.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        g.rotation.y += diff * Math.min(1, dt * 14);
      }
      walking = true;
    }
    if (walking) {
      this.phase += dt * this.speed * 3.4;
      const s = Math.sin(this.phase);
      this.legs[0].rotation.x = s * 0.7;
      this.legs[1].rotation.x = -s * 0.7;
      if (!this.acting) {
        this.arms[0].rotation.x = -s * 0.6;
        this.arms[1].rotation.x = s * 0.6;
      }
      this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.06;
      this.head.rotation.z = s * 0.04;
    } else if (!this.acting) {
      for (const l of this.legs) l.rotation.x *= 0.8;
      for (const a of this.arms) a.rotation.x *= 0.8;
      this.body.position.y = Math.sin(t * 2) * 0.012;
      this.head.rotation.z = Math.sin(t * 0.9) * 0.05;
    }
    this.body.position.x = this.shake ? (Math.random() - 0.5) * 0.04 : 0;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 3) * 0.15;
  }
}
