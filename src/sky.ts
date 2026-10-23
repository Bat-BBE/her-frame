import * as THREE from 'three';
import { rand } from './util';

export class Tesseract {
  readonly lines: THREE.LineSegments;
  private verts: number[][] = [];
  private edges: [number, number][] = [];
  private pos: Float32Array;
  speed = 1;
  private a = 0;

  constructor(color: THREE.ColorRepresentation = 0x7df9ff, size = 0.5) {
    for (let i = 0; i < 16; i++) {
      this.verts.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    }
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        const diff = i ^ j;
        if ((diff & (diff - 1)) === 0) this.edges.push([i, j]);
      }
    }
    this.pos = new Float32Array(this.edges.length * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const col = new THREE.Color(color).multiplyScalar(3);
    this.lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.lines.scale.setScalar(size);
    this.update(0);
  }

  update(dt: number) {
    this.a += dt * 0.6 * this.speed;
    const a = this.a;
    const cXW = Math.cos(a), sXW = Math.sin(a);
    const cYZ = Math.cos(a * 0.7), sYZ = Math.sin(a * 0.7);
    const cZW = Math.cos(a * 0.45), sZW = Math.sin(a * 0.45);
    const proj: number[][] = this.verts.map(([x, y, z, w]) => {
      let x1 = x * cXW - w * sXW;
      let w1 = x * sXW + w * cXW;
      const y1 = y * cYZ - z * sYZ;
      let z1 = y * sYZ + z * cYZ;
      const z2 = z1 * cZW - w1 * sZW;
      const w2 = z1 * sZW + w1 * cZW;
      z1 = z2;
      w1 = w2;
      const k = 1 / (2.6 - w1);
      x1 *= k;
      return [x1 * 2, y1 * k * 2, z1 * k * 2];
    });
    let o = 0;
    for (const [i, j] of this.edges) {
      const p = proj[i], q = proj[j];
      this.pos[o++] = p[0]; this.pos[o++] = p[1]; this.pos[o++] = p[2];
      this.pos[o++] = q[0]; this.pos[o++] = q[1]; this.pos[o++] = q[2];
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

interface Meteor {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class Sky {
  readonly group = new THREE.Group();
  private starMat: THREE.ShaderMaterial;
  private auroraMat: THREE.ShaderMaterial;
  private meteors: Meteor[] = [];
  private meteorGeo: THREE.BufferGeometry;
  readonly bigTesseract: Tesseract;
  private showerLeft = 0;
  private showerTimer = 0;
  moon: THREE.Mesh;
  camera?: THREE.Camera;
  private bgMat: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);

    const bgMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTop: { value: new THREE.Color('#2a1d5c') }, uBottom: { value: new THREE.Color('#07060f') }, uMid: { value: new THREE.Color('#15102e') } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uMid; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.8, h)) : mix(uMid, uBottom, smoothstep(0.0, -0.6, h));
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.bgMat = bgMat;
    const bg = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), bgMat);
    bg.renderOrder = -10;
    this.group.add(bg);

    const N = 2600;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const size = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(rand(120, 300));
      pos.set([v.x, v.y, v.z], i * 3);
      seed[i] = Math.random() * 100;
      size[i] = Math.random() < 0.06 ? rand(2.6, 4.2) : rand(0.8, 2.0);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.starMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uBright: { value: 1 }, uPixel: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: `attribute float aSeed; attribute float aSize; uniform float uTime; uniform float uPixel; varying float vTw; varying float vS;
        void main(){ vTw = 0.55 + 0.45*sin(uTime*1.7 + aSeed*6.0); vS = aSeed; gl_PointSize = aSize * uPixel * 1.6; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uBright; varying float vTw; varying float vS;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(0.75,0.8,1.0), vec3(1.0,0.85,0.95), fract(vS*0.37));
        gl_FragColor = vec4(col * 1.6 * uBright, a * vTw); }`,
    });
    this.group.add(new THREE.Points(sg, this.starMat));

    const nebTex = this.makeNebulaTexture();
    const nebColors = ['#6b3fd6', '#2f6bff', '#d64f9b', '#3fc7d6'];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.SpriteMaterial({ map: nebTex, color: nebColors[i % nebColors.length], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Sprite(m);
      const dir = new THREE.Vector3(rand(-1, 0.6), rand(-0.3, 0.7), rand(-1, 0.2)).normalize();
      s.position.copy(dir.multiplyScalar(180));
      s.scale.setScalar(rand(120, 220));
      this.group.add(s);
    }

    // Was a 1.6x-bright sphere under an 8x-radius, 0.35-opacity additive halo — with
    // bloom on top that combination rendered as a single featureless white blob that
    // swallowed a large share of the frame instead of reading as a moon.
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(5, 32, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d6').multiplyScalar(1.1) }),
    );
    this.moon.position.set(-150, 8, -170);
    this.group.add(this.moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebTex, color: '#ffe9b0', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(22);
    halo.position.copy(this.moon.position);
    this.group.add(halo);

    this.auroraMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
      vertexShader: `varying vec2 vUv; uniform float uTime; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*0.05 + uTime*0.4)*8.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uAmt;
        void main(){ float wave = sin(vUv.x*18.0 + uTime*0.8)*0.5+0.5; float band = smoothstep(0.0,0.35,vUv.y)*smoothstep(1.0,0.4,vUv.y);
        float streak = 0.6 + 0.4*sin(vUv.x*90.0 + uTime*2.0 + sin(vUv.x*7.0)*3.0);
        vec3 c = mix(vec3(0.1,1.0,0.7), vec3(0.6,0.3,1.0), vUv.y + 0.2*wave);
        gl_FragColor = vec4(c*1.4, band*streak*uAmt*0.55); }`,
    });
    for (let i = 0; i < 2; i++) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(260, 60, 64, 1), this.auroraMat);
      a.position.set(-20 + i * 30, 45 + i * 8, -110 - i * 20);
      a.rotation.set(0.15, 0.25 - i * 0.5, 0);
      this.group.add(a);
    }

    this.bigTesseract = new Tesseract(0xb48cff, 7);
    this.bigTesseract.lines.position.set(0, 22, -25);
    this.bigTesseract.lines.visible = false;
    this.group.add(this.bigTesseract.lines);

    const mg = new THREE.ConeGeometry(0.25, 7, 6, 1, true);
    mg.translate(0, 3.5, 0);
    mg.rotateX(-Math.PI / 2);
    this.meteorGeo = mg;
  }

  private makeNebulaTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  set auroraAmount(v: number) { this.auroraMat.uniforms.uAmt.value = v; }
  get auroraAmount() { return this.auroraMat.uniforms.uAmt.value; }
  set starBrightness(v: number) { this.starMat.uniforms.uBright.value = v; }
  get starBrightness() { return this.starMat.uniforms.uBright.value; }

  /** Real-world time of day: recolours the sky gradient and dims stars in daylight. */
  setPhase(phase: 'dawn' | 'day' | 'dusk' | 'night') {
    const P = {
      night: ['#2a1d5c', '#15102e', '#07060f', 1],
      dawn: ['#4a3488', '#b8668e', '#22143a', 0.55],
      day: ['#3f6fcf', '#8fb0ec', '#22305e', 0.18],
      dusk: ['#33256e', '#d27a68', '#200c26', 0.6],
    }[phase] as [string, string, string, number];
    const u = this.bgMat.uniforms;
    (u.uTop.value as THREE.Color).set(P[0]);
    (u.uMid.value as THREE.Color).set(P[1]);
    (u.uBottom.value as THREE.Color).set(P[2]);
    if (this.auroraAmount < 0.5) this.starBrightness = P[3];
  }

  meteorShower(count = 14) {
    this.showerLeft += count;
  }

  spawnMeteor() {
    const col = new THREE.Color().setHSL(rand(0.05, 0.6), 0.8, 0.7).multiplyScalar(4);
    const mesh = new THREE.Mesh(
      this.meteorGeo,
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.5) }));
    mesh.add(head);
    const cam = this.camera;
    if (!cam) return;
    const dir = new THREE.Vector3(rand(-0.4, 1.15), rand(0.15, 1.05), 0.5).unproject(cam).sub(cam.position).normalize();
    mesh.position.copy(cam.position).addScaledVector(dir, rand(55, 85));
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const vel = right.multiplyScalar(-rand(22, 34)).addScaledVector(up, -rand(10, 18));
    mesh.lookAt(mesh.position.clone().add(vel));
    this.group.add(mesh);
    this.meteors.push({ mesh, vel, life: 0, maxLife: rand(1.4, 2.2) });
  }

  update(dt: number, t: number) {
    this.starMat.uniforms.uTime.value = t;
    this.auroraMat.uniforms.uTime.value = t;
    this.group.children[1].rotation.y = t * 0.003;
    if (this.bigTesseract.lines.visible) {
      this.bigTesseract.update(dt);
      this.bigTesseract.lines.rotation.y += dt * 0.1;
    }

    if (this.showerLeft > 0) {
      this.showerTimer -= dt;
      if (this.showerTimer <= 0) {
        this.spawnMeteor();
        this.showerLeft--;
        this.showerTimer = rand(0.12, 0.45);
      }
    }

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.life += dt;
      m.mesh.position.addScaledVector(m.vel, dt);
      const k = m.life / m.maxLife;
      (m.mesh.material as THREE.MeshBasicMaterial).opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      if (m.life >= m.maxLife) {
        this.group.remove(m.mesh);
        (m.mesh.material as THREE.Material).dispose();
        const head = m.mesh.children[0] as THREE.Mesh;
        head.geometry.dispose();
        (head.material as THREE.Material).dispose();
        this.meteors.splice(i, 1);
      }
    }
  }
}
