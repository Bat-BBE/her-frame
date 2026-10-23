import gsap from 'gsap';
import { ui } from '../ui';
import { sound } from '../audio';
import { runKeypad, runMelody } from '../minigames';
import type { Game } from '../game';
import type { Chapter, QuestView } from './types';

const CHANNELS = [
  { name: 'CH 01 · Хүүхэлдэйн кино', text: '«Мочигийн адал явдал» — Мочи бяцхан сүүдрээсээ айгаад гүйж байна.' },
  { name: 'CH 03 · Мэдээ', text: 'Мэдээ: "Өнөө шөнө солирын бороо орно. Байшинд үл таних сүүдэр харагдсан гэх мэдээлэл ирж байна..."' },
  { name: 'CH 05 · Хоолны шоу', text: 'Хоолны шоу: "Бин хийхэд өндөг, сүү, гурил, бал хэрэгтэй. Яг тэнцвэртэй эргүүлэх нь гол!"' },
  { name: 'CH 07 · ...', text: 'Дэлгэцэн дээр шуугианы дунд тоо анивчлаа: «_ 7 _ 2». Хаа нэгтээ бусад нь байгаа байх.' },
  { name: 'CH 09 · Цаг агаар', text: 'Цаг агаар: "Байшин дотор: дулаахан. Задгай зуух асаалттай бол бүр ч дулаахан."' },
];

/** Chapter 3 — melody → matches → light the fire → safe behind the painting. */
export class LivingChapter implements Chapter {
  readonly room = 'living' as const;
  private ch = -1;

  constructor(private g: Game) {}

  private get st() { return this.g.s.rooms.living; }
  private get refs() { return this.g.c.world.living; }
  private hasF(f: string) { return this.st.flags.includes(f); }

  apply() {
    if (this.hasF('fire')) this.setFire(true, true);
    if (this.hasF('safe')) this.refs.safeDoor.rotation.y = -1.9;
  }

  quest(): QuestView {
    const st = this.st.step;
    if (st === 0) return { title: 'Хүйтэн зочны өрөө', sub: 'Задгай зуух хүйтэн. Пянз тоглуулагч хэн нэгнийг хүлээж байх шиг...', slots: 0, letters: [] };
    if (st === 1) return { title: 'Галаа асаа', sub: 'Шүүгээнээс шүдэнз гарч ирлээ. Задгай зууханд гал асаа.', slots: 0, letters: [] };
    const digits = [this.hasF('fire') ? '3' : '', this.hasF('tv-code') ? '7' : '', this.hasF('fire') ? '9' : '', this.hasF('tv-code') ? '2' : ''];
    return { title: 'Зургийн ард сейф', sub: 'Сейфний 4 оронтой код хоёр газар хуваагдсан. Зуухны хана болон... зурагтын сувгуудыг шалга.', slots: 4, letters: digits };
  }

  hints() {
    const st = this.st.step;
    if (st === 0) return ['Пянз тоглуулагч дээр дарж аялгууг давт. Ноотуудыг анхааралтай сонс.', 'Задгай зуух асахгүй байгаа нь шүдэнз байхгүйгээс.'];
    if (st === 1) return ['Шүдэнз гарт байна — задгай зуух дээр дар.'];
    return ['Галын гэрэлд зуухны хана дээр 2 тоо харагдсан. Үлдсэн 2-ыг зурагтын сувгуудаас хай.', 'Зурагтыг хэд хэдэн удаа дарж суваг соль. Шуугиантай суваг сэжигтэй.'];
  }

  update(_dt: number, t: number) {
    if (this.g.focus !== 'living') return;
    this.drawTV(t);
    if (this.hasF('fire')) this.refs.fireLight.intensity = (this.refs.fireLight.userData.base as number ?? 7) * (0.85 + Math.sin(t * 9) * 0.08 + Math.random() * 0.07);
  }

  private drawTV(t: number) {
    const { ctx, tex } = this.refs.tv;
    const W = 320, H = 180;
    if (this.ch < 0 || this.ch === 3) {
      const img = ctx.createImageData(W / 4, H / 4);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      ctx.drawImage(ctx.canvas, 0, 0, W / 4, H / 4, 0, 0, W, H);
      if (this.ch === 3 && Math.floor(t * 2.5) % 3 !== 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(60, 55, 200, 70);
        ctx.fillStyle = '#7dff9b';
        ctx.font = '700 46px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('_ 7 _ 2', W / 2, H / 2);
      }
    } else {
      const cols = [['#ff9ad5', '#ffd36b'], ['#1e2a5e', '#3f5bd9'], ['#ff9a5c', '#ffd36b'], [], ['#5ab8ff', '#bfefff']][this.ch];
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, cols[0]);
      gr.addColorStop(1, cols[1]);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(W / 2 + Math.sin(t * 2) * 60, H * 0.62, 34, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1030';
      ctx.font = '700 18px Nunito, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(CHANNELS[this.ch].name, 10, 10);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    tex.needsUpdate = true;
  }

  private setFire(on: boolean, instant = false) {
    const r = this.refs;
    for (const f of r.flames) f.visible = on;
    const base = 7;
    r.fireLight.userData.base = base;
    if (on) this.g.c.world.lightBase.set(r.fireLight, base);
    else this.g.c.world.lightBase.delete(r.fireLight);
    gsap.to(r.fireLight, { intensity: on ? base : 0, duration: instant ? 0 : 1.2 });
    gsap.to(r.soot, { emissiveIntensity: on ? 1.4 : 0, duration: instant ? 0 : 2 });
    if (on && this.st.step >= 2) {
      r.safe.visible = true;
      gsap.to(r.painting.position, { x: 11.0 + 1.9, duration: instant ? 0 : 1.6, ease: 'power2.inOut' });
      gsap.to(r.painting.rotation, { z: -0.08, duration: instant ? 0 : 1.6 });
    }
  }

  onClick(id: string): boolean {
    const g = this.g;
    const r = this.refs;
    switch (id) {
      case 'record': {
        if (this.hasF('melody')) {
          r.record.userData.playing = !r.record.userData.playing;
          for (let i = 0; i < 4; i++) setTimeout(() => sound.note(i), i * 220);
          g.card('record', r.record.userData.playing ? 'Пянз эргэлдэж, зөөлөн аялгуу эгшиглэнэ.' : 'Пянз зогслоо.');
          return true;
        }
        void (async () => {
          g.busy = true;
          r.record.userData.playing = true;
          const ok = await runMelody(5);
          g.busy = false;
          r.record.userData.playing = false;
          if (!ok) {
            g.card('record', 'Аялгуу таарсангүй. Дахин нэг сонсоод үз.');
            return;
          }
          g.flag('living', 'melody');
          g.progress.stat('challenges');
          g.progress.quest('challenge');
          sound.unlock();
          gsap.fromTo(r.drawer.position, { z: 0.32 }, { z: 0.7, duration: 0.6, ease: 'back.out(2)' });
          g.addItem('matches');
          g.card('record', 'Аялгуу дуусахад шүүгээний шургуулга өөрөө онгойлоо! Дотор нь шүдэнз байна.', 6000);
          g.stepDone('living', 1, 'Аялгуу');
        })();
        return true;
      }
      case 'fireplace': {
        if (this.hasF('fire')) {
          if (this.st.done) {
            const on = !r.flames[0].visible;
            this.setFire(on);
            if (on) g.progress.quest('fire');
            g.card('fireplace', on ? 'Гал дахин дүрэлзлээ. Сүүдэр галын ойролцоо ирж зүрхэлдэггүй.' : 'Гал унтарлаа. Өрөө сэрүүцэв.');
            return true;
          }
          g.card('fireplace', 'Гал дүрэлзэж байна. Зуухны ханан дээр хөө тортгоор "3 _ 9 _" гэж бичжээ.');
          return true;
        }
        if (!g.hasItem('matches')) {
          sound.lock();
          g.card('fireplace', 'Задгай зуух мөс шиг хүйтэн. Гал асаах юм хэрэгтэй.');
          return true;
        }
        g.useItem('matches');
        g.flag('living', 'fire');
        sound.whoosh();
        sound.powerUp();
        g.stepDone('living', 2, 'Гал асаалаа');
        this.setFire(true);
        g.progress.quest('fire');
        g.confetti(g.c.world.anchorOf('fireplace'), 30, 0.6);
        g.card('fireplace', 'Гал дүрэлзлээ! Галын гэрэлд хананд "3 _ 9 _" гэж бичсэн нь харагдав... Дулаанд зураг хөдөлж, ард нь сейф ил гарлаа! (Сүүдэр галаас айдаг — энэ өрөө одоо аюулгүй.)', 9000);
        return true;
      }
      case 'painting': {
        g.card('painting', this.hasF('fire') ? 'Зураг хажуу тийш гулсаж, ард нь сейф харагдаж байна.' : 'Хөвөгч арал дээрх жижиг байшингийн зураг. Хүрээ нь хананд хачин бат наалдсан.');
        return true;
      }
      case 'safe': {
        if (this.hasF('safe')) {
          g.card('safe', 'Хоосон сейф. Түлхүүрийг нь аль хэдийн авсан.');
          return true;
        }
        void (async () => {
          g.busy = true;
          const ok = await runKeypad({ title: 'Ханын сейф', hint: '4 оронтой код. Зуух ба зурагт хоёроос хэсэг хэсгээр нь ол.', length: 4, check: (c) => c === '3792' });
          g.busy = false;
          if (!ok) return;
          g.flag('living', 'safe');
          g.progress.stat('challenges');
          gsap.to(r.safeDoor.rotation, { y: -1.9, duration: 1.2, ease: 'back.out(1.4)' });
          g.card('safe', 'Сейф нээгдлээ! Дотор нь жижигхэн алтан түлхүүр — "Гал тогоо" гэсэн шошготой.', 6000);
          setTimeout(() => void g.completeRoom('living'), 2200);
        })();
        return true;
      }
      case 'tv': {
        this.ch = (this.ch + 1) % CHANNELS.length;
        sound.tick();
        if (this.ch === 3 && !this.hasF('tv-code')) {
          g.flag('living', 'tv-code');
          g.refreshHUD();
        }
        g.card('tv', CHANNELS[this.ch].text);
        return true;
      }
      case 'cabinet': {
        sound.pop();
        g.openCollection();
        return true;
      }
      case 'floorlamp': {
        sound.tick();
        const l = r.floorLight;
        const on = l.intensity < 1;
        gsap.to(l, { intensity: on ? 9 : 0, duration: 0.3 });
        if (on) g.c.world.lightBase.set(l, 9); else g.c.world.lightBase.delete(l);
        g.card('floorlamp', on ? 'Гэрэл асав.' : 'Гэрэл унтрав. Зуухны гал л үлдлээ.');
        return true;
      }
      case 'sofa':
        sound.boing();
        g.card('sofa', g.cycle('sofa', ['Зөөлөн буйдан. Ард нь нуугдах зай бий.', 'Дэрнүүдийн завсар ямар нэг юм хатуу тээглэнэ...', 'Буйдан: "Пуф."']));
        return false;
      case 'coffeetable':
        sound.pop();
        g.card('coffeetable', g.cycle('ctable', ['Кофены ширээ. Дээр нь хоосон хайрцаг, ундаа.', 'Ширээн дээр аяганы ул мөр. Хэн нэгэн саяхан энд байжээ.']));
        return false;
      case 'armchair':
        sound.boing();
        g.card('armchair', g.cycle('arm', ['Түшлэгтэй сандал гал руу харж байна.', 'Сандлын ард нуугдаж болох юм.']));
        return true;
      case 'monstera':
        sound.whoosh();
        g.card('monstera', g.cycle('mon', ['Монстера навчаа дэлгэлээ.', 'Навчны цоорхойнуудаар гэрэл тусна.']));
        return true;
      case 'fishbowl':
        sound.pop();
        g.card('fishbowl', g.cycle('fish', ['Загаснууд: "Буль буль."', 'Алтан загас гурван секунд тутамд бүхнийг мартдаг. Азтай юм.']));
        return true;
    }
    return false;
  }

  loseOne() {
    if (this.g.hasItem('matches')) {
      this.g.useItem('matches');
      this.g.s.rooms.living.flags = this.st.flags.filter((f) => f !== 'melody');
      this.g.s.rooms.living.step = 0;
      gsap.to(this.refs.drawer.position, { z: 0.32, duration: 0.5 });
      return 'Шүдэнз алга боллоо! Пянзын аялгууг дахин тоглуулах хэрэгтэй.';
    }
    return null;
  }

  onEnter() {
    if (this.st.step === 0 && !this.hasF('intro')) {
      this.g.flag('living', 'intro');
      setTimeout(() => ui.toast('Зочны өрөө... хүйтэн, чимээгүй. Пянз тоглуулагч дээр тоос суужээ.', 4500), 1200);
    }
  }
}
