import * as THREE from 'three';
import gsap from 'gsap';

/** "The Shadow" — a tall, faceless thing that drifts through the house.
 *  Purely visual: the hunt rules live in hunt.ts. */
export class Shadow {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private mats: THREE.MeshStandardMaterial[] = [];
  private eyes: THREE.MeshBasicMaterial;
  private wisps: THREE.Sprite[] = [];
  private arms: THREE.Object3D[] = [];
  private opacity = { v: 0 };
  /** Set by the finale: the Shadow turns out to be a giant, lonely Mochi-shaped shadow. */
  friendly = false;

  constructor(parent: THREE.Object3D) {
    const dark = () => {
      const m = new THREE.MeshStandardMaterial({ color: '#07040f', emissive: '#1a0a2e', emissiveIntensity: 0.6, roughness: 1, transparent: true, opacity: 0 });
      this.mats.push(m);
      return m;
    };
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.9, 8, 18), dark());
    torso.position.y = 1.75;
    torso.scale.set(1, 1, 0.75);
    this.body.add(torso);
    // ragged hem: a flared cone that fades into wisps
    const hem = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 14, 1, true), dark());
    hem.position.y = 0.75;
    hem.rotation.x = Math.PI;
    this.body.add(hem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), dark());
    head.position.y = 3.15;
    head.scale.set(1, 1.15, 0.95);
    this.body.add(head);
    // two little ears — a hint of who it really is
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 8), dark());
      ear.position.set(s * 0.22, 3.6, 0);
      ear.rotation.z = -s * 0.35;
      this.body.add(ear);
    }
    this.eyes = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b5c').multiplyScalar(3), transparent: true, opacity: 0 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), this.eyes);
      e.position.set(s * 0.15, 3.2, 0.36);
      e.scale.set(1, 0.55, 1);
      this.body.add(e);
    }
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.5, 2.5, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.6, 4, 8), dark());
      arm.position.y = -0.85;
      pivot.add(arm);
      pivot.rotation.z = s * 0.18;
      this.arms.push(pivot);
      this.body.add(pivot);
    }
    const wispTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(20,8,40,1)');
      g.addColorStop(1, 'rgba(20,8,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: wispTex, transparent: true, opacity: 0, depthWrite: false }));
      sp.userData.seed = Math.random() * 10;
      sp.scale.setScalar(0.8);
      this.wisps.push(sp);
      this.group.add(sp);
    }
    this.group.add(this.body);
    this.group.visible = false;
    this.group.traverse((o) => { o.userData.ignoreRay = true; o.castShadow = o instanceof THREE.Mesh; });
    parent.add(this.group);
  }

  private setOpacity(v: number) {
    this.opacity.v = v;
    for (const m of this.mats) m.opacity = v * 0.94;
    this.eyes.opacity = v;
  }

  /** Materialises at `at`, facing `look`. */
  appear(at: THREE.Vector3, look: THREE.Vector3, dur = 1.4) {
    gsap.killTweensOf(this.opacity);
    this.group.visible = true;
    this.group.position.copy(at);
    this.group.lookAt(look.x, at.y, look.z);
    this.group.scale.setScalar(1);
    return new Promise<void>((res) => gsap.to(this.opacity, { v: 1, duration: dur, ease: 'power2.out', onUpdate: () => this.setOpacity(this.opacity.v), onComplete: () => res() }));
  }

  glideTo(p: THREE.Vector3, dur = 2) {
    const look = p.clone();
    this.group.lookAt(look.x, this.group.position.y, look.z);
    return new Promise<void>((res) => gsap.to(this.group.position, { x: p.x, z: p.z, duration: dur, ease: 'sine.inOut', onComplete: () => res() }));
  }

  /** Slowly turns to look somewhere (searching). */
  lookAround(dur = 2.4) {
    const r = this.group.rotation.y;
    return new Promise<void>((res) => gsap.timeline({ onComplete: () => res() })
      .to(this.group.rotation, { y: r + 1.1, duration: dur / 3, ease: 'sine.inOut' })
      .to(this.group.rotation, { y: r - 1.1, duration: dur / 3, ease: 'sine.inOut' })
      .to(this.group.rotation, { y: r, duration: dur / 3, ease: 'sine.inOut' }));
  }

  vanish(dur = 1.2) {
    gsap.killTweensOf(this.opacity);
    return new Promise<void>((res) => gsap.to(this.opacity, {
      v: 0, duration: dur, ease: 'power2.in',
      onUpdate: () => this.setOpacity(this.opacity.v),
      onComplete: () => { this.group.visible = false; res(); },
    }));
  }

  /** Jumpscare: rushes the camera, arms up. */
  lunge(camera: THREE.Camera) {
    this.group.visible = true;
    this.setOpacity(1);
    const dir = camera.position.clone().sub(this.group.position).normalize();
    const target = camera.position.clone().addScaledVector(dir, -3.2);
    this.group.lookAt(camera.position.x, this.group.position.y, camera.position.z);
    for (const a of this.arms) gsap.to(a.rotation, { x: -2.4, duration: 0.25, ease: 'power3.out' });
    return new Promise<void>((res) => gsap.to(this.group.position, {
      x: target.x, y: target.y - 2.8, z: target.z, duration: 0.35, ease: 'power4.in',
      onComplete: () => { for (const a of this.arms) a.rotation.x = 0; res(); },
    }));
  }

  /** Finale: the darkness melts away to soft violet, eyes turn gentle gold. */
  befriend() {
    this.friendly = true;
    for (const m of this.mats) {
      gsap.to(m.color, { r: 0.42, g: 0.33, b: 0.7, duration: 3 });
      gsap.to(m.emissive, { r: 0.35, g: 0.22, b: 0.6, duration: 3 });
    }
    gsap.to(this.eyes.color, { r: 3, g: 2.6, b: 1, duration: 3 });
  }

  update(dt: number, t: number) {
    if (!this.group.visible) return;
    this.body.position.y = 0.15 + Math.sin(t * 1.6) * 0.12;
    this.body.rotation.z = Math.sin(t * 0.9) * 0.04;
    for (const a of this.arms) a.rotation.z += (Math.sin(t * 1.3 + a.position.x) * 0.12 + Math.sign(a.position.x) * 0.18 - a.rotation.z) * Math.min(1, dt * 3);
    if (!this.friendly) this.eyes.color.setRGB(3, 0.6 + Math.random() * 0.25, 0.8);
    this.wisps.forEach((w) => {
      const k = ((t * 0.35 + (w.userData.seed as number)) % 1);
      const a = (w.userData.seed as number) * 7 + t * 0.5;
      w.position.set(Math.cos(a) * (0.4 + k * 0.5), 0.2 + k * 2.6, Math.sin(a) * (0.4 + k * 0.5));
      w.scale.setScalar(0.6 + k * 0.9);
      (w.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.6 * this.opacity.v;
    });
  }
}
