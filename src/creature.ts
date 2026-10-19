import * as THREE from 'three';
import gsap from 'gsap';
import { std, mesh } from './util';
import type { World } from './world';

type Mode = 'hidden' | 'peek' | 'run' | 'caught' | 'sit';

const HIDE = new THREE.Vector3(-5.15, 0, -1.1);
const PEEK = new THREE.Vector3(-4.72, 0, -0.36);
const SIT = new THREE.Vector3(-3.0, 0.78, 3.35);

export class Creature {
  readonly group = new THREE.Group();
  private body: THREE.Group;
  private eyes: THREE.Mesh[] = [];
  mode: Mode = 'hidden';
  private path: THREE.CatmullRomCurve3;
  private u = 0;
  private runLeft = 0;
  private blinkT = 2;
  onEscaped?: () => void;

  constructor(world: World) {
    this.body = new THREE.Group();
    const skin = std('#fff0f6', { roughness: 0.55 });
    const pink = std('#ff9cc5', { roughness: 0.6 });
    const b = mesh(new THREE.SphereGeometry(0.3, 24, 16), skin, 0, 0.28, 0);
    b.scale.set(1, 0.9, 0.95);
    this.body.add(b);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.09, 0.2, 10), pink, s * 0.15, 0.56, -0.02);
      ear.rotation.z = -s * 0.35;
      this.body.add(ear);
      const eye = mesh(new THREE.SphereGeometry(0.045, 10, 8), std('#1a1030', { roughness: 0.2 }), s * 0.1, 0.34, 0.26);
      this.eyes.push(eye);
      this.body.add(eye);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      hl.position.set(s * 0.1 + 0.015, 0.355, 0.3);
      this.body.add(hl);
      this.eyes.push(hl);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6), std('#ff7eb6'));
      blush.scale.set(1, 0.5, 0.3);
      blush.position.set(s * 0.18, 0.26, 0.24);
      this.body.add(blush);
      this.body.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), pink, s * 0.13, 0.04, 0.08));
    }
    this.group.add(this.body);
    this.group.position.copy(HIDE);
    this.group.visible = false;
    world.root.add(this.group);
    world.register('creature', this.group, new THREE.Vector3(0, 0.7, 0), false);

    this.path = new THREE.CatmullRomCurve3(
      [
        [-4.5, -0.3], [-3.2, 1.0], [-1.6, 3.0], [1.2, 3.9], [3.2, 2.6],
        [3.0, -0.6], [1.4, -2.6], [-1.2, -2.4], [-3.4, -1.2],
      ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
    );
  }

  get catchable() { return this.mode === 'run' || this.mode === 'peek'; }

  peek() {
    if (this.mode !== 'hidden') return;
    this.mode = 'peek';
    this.group.visible = true;
    this.group.position.copy(HIDE);
    this.group.lookAt(PEEK.x + 2, 0, PEEK.z + 2);
    gsap.to(this.group.position, { x: PEEK.x, z: PEEK.z, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(this.body.rotation, { z: 0 }, { z: 0.25, duration: 0.3, yoyo: true, repeat: 5, ease: 'sine.inOut', delay: 0.5 });
    gsap.delayedCall(3.2, () => {
      if (this.mode === 'peek') this.hide();
    });
  }

  hide() {
    this.mode = 'hidden';
    gsap.to(this.group.position, {
      x: HIDE.x, z: HIDE.z, duration: 0.45, ease: 'power2.in',
      onComplete: () => { if (this.mode === 'hidden') this.group.visible = false; },
    });
  }

  run(loops = 2) {
    if (this.mode === 'caught' || this.mode === 'sit') return;
    gsap.killTweensOf(this.group.position);
    this.mode = 'run';
    this.group.visible = true;
    this.u = 0;
    this.runLeft = loops;
  }

  catch(onDone: () => void) {
    this.mode = 'caught';
    gsap.killTweensOf(this.group.position);
    const tl = gsap.timeline({ onComplete: () => { this.sit(); onDone(); } });
    tl.to(this.group.position, { y: 1.4, duration: 0.35, ease: 'power2.out' })
      .to(this.group.rotation, { y: this.group.rotation.y + Math.PI * 4, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(this.body.scale, { x: 1.3, y: 0.7, z: 1.3, duration: 0.15, yoyo: true, repeat: 3 }, 0.1)
      .to(this.group.position, { y: 0, duration: 0.35, ease: 'bounce.out' });
  }

  sit(instant = false) {
    this.mode = 'sit';
    this.group.visible = true;
    const face = () => this.group.lookAt(SIT.x + 6, SIT.y, SIT.z + 3);
    if (instant) {
      this.group.position.copy(SIT);
      face();
      return;
    }
    this.group.lookAt(SIT.x, this.group.position.y, SIT.z);
    gsap.timeline({ onComplete: face })
      .to(this.group.position, { x: SIT.x, z: SIT.z, duration: 1.2, ease: 'power1.inOut' }, 0)
      .to(this.group.position, { y: SIT.y + 0.6, duration: 0.9, ease: 'power1.out' }, 0)
      .to(this.group.position, { y: SIT.y, duration: 0.3, ease: 'bounce.out' });
  }

  bounce() {
    gsap.fromTo(this.body.scale, { x: 1.25, y: 0.75, z: 1.25 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
    gsap.fromTo(this.body.position, { y: 0 }, { y: 0.3, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
  }

  dance(on: boolean) {
    gsap.killTweensOf(this.body.rotation);
    if (on) gsap.to(this.body.rotation, { z: 0.3, duration: 0.25, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    else this.body.rotation.z = 0;
  }

  update(dt: number) {
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blinkT = 2 + Math.random() * 3;
      for (const e of this.eyes) gsap.fromTo(e.scale, { y: 0.1 }, { y: 1, duration: 0.15, ease: 'power1.out' });
    }
    if (this.mode !== 'run') return;
    const len = this.path.getLength();
    this.u += (dt * 4.2) / len;
    if (this.u >= 1) {
      this.u -= 1;
      this.runLeft--;
      if (this.runLeft <= 0) {
        this.mode = 'peek';
        gsap.to(this.group.position, {
          x: PEEK.x, z: PEEK.z, y: 0, duration: 0.5,
          onComplete: () => { this.hide(); this.onEscaped?.(); },
        });
        return;
      }
    }
    const p = this.path.getPointAt(this.u);
    const ahead = this.path.getPointAt((this.u + 0.01) % 1);
    this.group.position.set(p.x, Math.abs(Math.sin(this.u * len * 2.2)) * 0.22, p.z);
    this.group.lookAt(ahead.x, this.group.position.y, ahead.z);
    const sq = 1 + Math.sin(this.u * len * 4.4) * 0.08;
    this.body.scale.set(1 / sq, sq, 1 / sq);
  }
}
