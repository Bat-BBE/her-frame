import * as THREE from 'three';
import gsap from 'gsap';
import { ui } from '../ui';
import { sound } from '../audio';
import { h } from '../util';
import { runConstellation } from '../minigames';
import { MOCHI_STARS } from '../rooms/observatory';
import type { Game } from '../game';
import type { Chapter, QuestView } from './types';

/** Chapter 6 — the finale: connect Mochi's constellation and learn what the Shadow really is. */
export class ObservatoryChapter implements Chapter {
  readonly room = 'observatory' as const;

  constructor(private g: Game) {}

  private get st() { return this.g.s.rooms.observatory; }
  private get refs() { return this.g.c.world.observatory; }

  apply() {
    if (this.st.flags.includes('chest')) this.refs.chestLid.rotation.x = -1.6;
  }

  quest(): QuestView {
    if (this.st.step === 0) return { title: 'Оддын цамхаг', sub: 'Ширээн дээр оддын газрын зураг дэлгээтэй байна. Хар.', slots: 0, letters: [] };
    return { title: 'Мочигийн од', sub: 'Дурангаар харж газрын зураг дээрх хэлбэрээр оддыг холбо.', slots: 0, letters: [] };
  }

  hints() {
    if (this.st.step === 0) return ['Ширээн дээрх оддын газрын зураг дээр дар.'];
    return ['Дуран дээр дар. Хэлбэр эхэндээ бүдэг гэрэлтэнэ — тэр үед сайн хар. Эхний од анивчиж байгаа.'];
  }

  private showChart() {
    const el = h('div', { class: 'chart-view' });
    const W = 300, H = 240;
    const pts = MOCHI_STARS.map(([x, y]) => [30 + x * (W - 60), H - 20 - y * (H - 40)]);
    el.innerHTML = `<p class="eyebrow">Оддын газрын зураг</p><h3 class="kp-title">Мочигийн од ★</h3>
      <svg viewBox="0 0 ${W} ${H}" class="chart-svg"><rect width="${W}" height="${H}" rx="16" fill="#0b0820"/>
      <polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#ffd36b" stroke-width="2.5"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 ? 7 : 5}" fill="${i === 0 ? '#ff7eb6' : '#ffd36b'}"/>`).join('')}</svg>
      <p class="muted small">Ягаан одноос эхлэн цагийн зүүний эсрэг — Мочигийн чих, хацар, эрүү. Сайн цээжил!</p>`;
    const b = h('button', { class: 'btn-primary' }, 'Цээжиллээ');
    b.addEventListener('click', () => ui.closeModal());
    el.append(b);
    ui.openModal(el, { className: 'modal-challenge' });
  }

  onClick(id: string): boolean {
    const g = this.g;
    switch (id) {
      case 'chart':
        sound.pop();
        this.showChart();
        if (this.st.step === 0) g.stepDone('observatory', 1, 'Оддын зураг');
        return true;
      case 'telescope': {
        if (this.st.done) {
          g.c.sky.meteorShower(25);
          g.card('telescope', 'Мочигийн од тэнгэрт гэрэлтэж байна. Тэнд нэгэн цагт Сүүдэр ганцаараа байсан юм.');
          return true;
        }
        if (this.st.step === 0) {
          g.card('telescope', 'Тэнгэр дүүрэн од... гэхдээ юуг хайхаа мэдэхгүй байна. Эхлээд газрын зургийг хар.');
          return true;
        }
        void (async () => {
          gsap.to(this.refs.tube.rotation, { z: -0.95, duration: 1.2, ease: 'power2.inOut' });
          g.busy = true;
          const ok = await runConstellation(MOCHI_STARS);
          g.busy = false;
          if (ok) await this.finale();
          else g.card('telescope', 'Хэлбэр таарсангүй. Газрын зургаа дахин харчих.');
        })();
        return true;
      }
      case 'globe': {
        const gl = this.refs.globe;
        gl.userData.spin = 1.4;
        sound.whoosh();
        g.card('globe', g.cycle('globe', ['Тэнгэрийн бөмбөрцөг эргэлдэнэ.', 'Бөмбөрцгийн дотор нэг юм шажигнана...']));
        return false;
      }
      case 'obschest': {
        sound.creak();
        g.flag('observatory', 'chest');
        gsap.to(this.refs.chestLid.rotation, { x: -1.6, duration: 0.9, ease: 'back.out(1.6)' });
        g.card('obschest', 'Хуучин авдар нээгдлээ.');
        return false;
      }
      case 'obschair':
        g.card('obschair', g.cycle('ochair', ['Зөөлөн сандал. Энд суугаад одод тоолж болно.', 'Сандал дээр хөнжил: "Мочи + Сүүдэр" гэж хатгажээ.']));
        return true;
    }
    return false;
  }

  /** The Shadow comes one last time — and the starlight shows who it really is. */
  private async finale() {
    const g = this.g;
    const { world, shadow, sky } = g.c;
    g.busy = true;
    ui.hideCard();
    const r = world.rooms.get('observatory')!;
    world.observatory.constellation.visible = true;
    sound.legendary();
    gsap.to(sky, { starBrightness: 2.2, duration: 3 });
    await g.cinematic(r.center.clone().setY(4.5), r.center.clone().add(new THREE.Vector3(12, 8, 12)), 2);
    // it arrives one last time...
    sound.creak();
    sound.setDread(0.8);
    ui.flash('#3a0010', 0.5);
    await shadow.appear(r.center.clone().add(new THREE.Vector3(1.2, 0, 0.6)), g.c.camera.position, 1.6);
    await new Promise((res) => setTimeout(res, 1400));
    // ...and the starlight pours down on it
    ui.flash('#fff3c4', 0.9);
    g.rgbGlitch(0.02, 2);
    sound.setDread(0);
    shadow.befriend();
    g.confetti(r.center.clone().setY(3.5), 120, 1.3);
    ui.toast('Оддын гэрэл Сүүдрийг гэрэлтүүллээ... Энэ бол Мочигийн сүүдэр байжээ. Олон жил харанхуйд ганцаараа үлдээд, хэн нэгэн оддыг нь холбохыг хүлээж байсан юм.', 9000);
    await new Promise((res) => setTimeout(res, 4500));
    sound.fanfare();
    await shadow.vanish(2.5);
    ui.toast('Сүүдэр оддын дунд гэрэл болон уусаж, Мочигийн од тэнгэрт мандлаа ★', 6000);
    if (!g.s.everCaught) g.progress.badge('untouchable');
    g.s.hardModeUnlocked = true;
    g.finaleAmbience(false);
    g.busy = false;
    await g.c.focusRoom(null);
    await g.completeRoom('observatory');
    setTimeout(() => {
      if (!g.s.collection.crown) g.rollReward({ id: 'crown', reason: 'Байшингийн бүх бүлгийг дуусгасны шагнал' });
      ui.toast('Шинэ: Цэснээс «Шөнийн ан» горимыг асааж Сүүдэртэй дахин тоглож болно 🌙', 7000);
    }, 1500);
  }
}
