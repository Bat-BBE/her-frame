import * as THREE from 'three';
import gsap from 'gsap';
import { ui } from '../ui';
import { sound } from '../audio';
import { runKeypad } from '../minigames';
import type { Game } from '../game';
import type { Chapter, QuestView } from './types';

const PIECES = ['piece-bed', 'piece-ward', 'piece-plant'] as const;

/** Chapter 1 — wake up, find the three pieces of the door key, meet the Shadow. */
export class BedroomChapter implements Chapter {
  readonly room = 'bedroom' as const;
  private ringT = 1;

  constructor(private g: Game) {}

  private get st() { return this.g.s.rooms.bedroom; }
  private get refs() { return this.g.c.world.bedroom; }
  private pieces() { return PIECES.filter((p) => this.st.flags.includes(p)).length; }

  apply() {
    const r = this.refs;
    const alarmOff = this.st.step >= 1;
    r.drawAlarm('07:15', !alarmOff);
    if (this.st.flags.includes('wardrobe-open')) for (const d of r.wardrobeDoors) d.rotation.y = (d.userData.side as number) * -1.6;
    if (this.st.flags.includes('watered')) r.setPlantHappy(true, true);
    r.can.visible = !this.st.flags.includes('can') ;
    if (this.g.s.inventory.includes('can')) r.can.visible = false;
  }

  quest(): QuestView {
    const st = this.st.step;
    if (st === 0) return { title: 'Сэрүүлэг дуугарч байна!', sub: 'Сэрүүлэгтэй цагийг унтраа.', slots: 0, letters: [] };
    if (st === 1) return { title: 'Түлхүүрийн 3 хэсэг', sub: 'Хаалганы түлхүүр 3 хэсэг болж өрөөнд нуугджээ. Ор, шүүгээ, ургамлыг шалга.', slots: 3, letters: PIECES.filter((p) => this.st.flags.includes(p)).map(() => '🗝') };
    if (st === 2) return { title: '...Хэн нэгэн ирж байна', sub: 'Хөлийн чимээ ойртож байна. Шүүгээнд эсвэл орны доор нуугд!', slots: 0, letters: [] };
    return { title: 'Хаалгыг нээ', sub: 'Түлхүүр бэлэн. Арын хананы хаалга дээр дарж ажлын өрөө рүү гар.', slots: 0, letters: [] };
  }

  hints() {
    const st = this.st.step;
    if (st === 0) return ['Орны дэргэдэх шүүгээн дээрх ягаан сэрүүлэг дээр дар.'];
    if (st === 1) return [
      'Нэг хэсэг нь толгойгоо тавьдаг газар нуугдсан байж магадгүй.',
      'Шүүгээ 3 оронтой кодтой. Зургийн жааз дээр сэжүүр бий — сэрүүлэг хэдэн цагт дуугарсан бэ?',
      'Ургамал цангажээ. Өрөөний буланд усны сав байгаа.',
    ];
    if (st === 2) return ['Хөлийн чимээ ойртох үед шүүгээ эсвэл ор дээр дарж нуугд. Дараа нь зүрхний цохилтыг тайвшруул.'];
    return ['Арын хананд хаалга бий. Түүн дээр дар.'];
  }

  onEnter() {
    if (this.st.step === 0 && !this.st.flags.includes('intro')) {
      this.st.flags.push('intro');
      this.g.save();
      setTimeout(() => ui.toast('☀️ Өглөөний мэнд! ...Хүлээгээрэй, сэрүүлэг дуугарч байна. Түүнийг унтраа!', 5000), 1200);
    }
  }

  update(dt: number) {
    if (this.st.step !== 0 || this.g.focus !== 'bedroom' || ui.modalOpen) return;
    this.ringT -= dt;
    if (this.ringT <= 0) {
      this.ringT = 2.2;
      sound.ring();
      const a = this.refs.alarm;
      gsap.fromTo(a.rotation, { z: -0.12 }, { z: 0, duration: 0.6, ease: 'elastic.out(1.5, 0.2)' });
      gsap.fromTo(a.position, { y: 0.78 }, { y: 0.72, duration: 0.3, ease: 'bounce.out' });
    }
  }

  private async gotPiece(flag: (typeof PIECES)[number], at: THREE.Vector3) {
    this.g.flag('bedroom', flag);
    await this.g.flyToken('🗝', at);
    this.g.progress.award(15, 5, 'Түлхүүрийн хэсэг');
    this.g.refreshHUD();
    if (this.pieces() === 3) void this.allPieces();
  }

  private async allPieces() {
    const g = this.g;
    g.stepDone('bedroom', 2, 'Түлхүүр бүтэн боллоо');
    ui.toast('Гурван хэсэг нийлж түлхүүр боллоо! ...Хүлээгээрэй. Тэр юуны чимээ вэ?', 4500);
    await new Promise((r) => setTimeout(r, 3500));
    if (g.s.calmMode) {
      g.s.shadowMet = true;
    } else {
      await g.hunt.scripted();
      g.s.shadowMet = true;
      ui.toast('Энэ юу байсан бэ...? Яаралтай эндээс гарах хэрэгтэй. Хаалга руу!', 5000);
    }
    g.stepDone('bedroom', 3);
  }

  onClick(id: string): boolean {
    const g = this.g;
    const r = this.refs;
    const st = this.st.step;
    switch (id) {
      case 'alarm': {
        sound.tick();
        if (st === 0) {
          r.drawAlarm('07:15', false);
          g.card('alarm', 'Сэрүүлэг 07:15-д дуугарч байж. Унтраалаа! ...Гэвч хаалга түгжээтэй байна. Түлхүүр 3 хэсэг болж өрөөнд нуугдсан гэнэ.', 7000);
          g.stepDone('bedroom', 1, 'Сэрлээ!');
          return true;
        }
        g.card('alarm', g.cycle('alarm', ['07:15. Энэ цагийг санаж аваарай.', 'Сэрүүлэг: "Би ажлаа хийсэн."', 'Цаг: 07:15. Дандаа 07:15.']));
        return true;
      }
      case 'bed': {
        sound.boing();
        gsap.fromTo(r.pillow.scale, { x: 1.1, y: 0.6 }, { x: 1, y: 1, duration: 0.8, ease: 'elastic.out(1, 0.35)' });
        if (st === 1 && !this.st.flags.includes('piece-bed')) {
          g.card('bed', 'Дэрийг сөхөхөд... түлхүүрийн нэг хэсэг гялалзлаа!');
          void this.gotPiece('piece-bed', g.c.world.anchorOf('bed'));
          return true;
        }
        g.card('bed', g.cycle('bed', ['Дэлхийн хамгийн тухтай шийдвэр бол орондоо үлдэх.', 'Ор: "Дахиад 5 минут..."', 'Орны доор нуугдахад яг тохиромжтой зай бий.']));
        return true;
      }
      case 'photo': {
        sound.pop();
        g.card('photo', 'Мочи болон "best friend". Зургийн ард харандаагаар: «Шүүгээний код = сэрүүлэг дуугарсан цаг».', 7000);
        g.flag('bedroom', 'photo');
        return true;
      }
      case 'wardrobe': {
        if (this.st.flags.includes('wardrobe-open')) {
          sound.creak();
          g.card('wardrobe', g.cycle('ward', ['Өнгө өнгийн хувцаснууд. Энд нуугдах зай хангалттай.', 'Шүүгээ дотор нафталины үнэр.']));
          return true;
        }
        if (st < 1) {
          sound.lock();
          g.card('wardrobe', 'Кодтой түгжээтэй шүүгээ. Эхлээд тэр дуугараад байгаа сэрүүлгийг унтраа.');
          return true;
        }
        void (async () => {
          g.busy = true;
          const ok = await runKeypad({
            title: 'Хувцасны шүүгээ',
            hint: this.st.flags.includes('photo') ? 'Зургийн ард: «сэрүүлэг дуугарсан цаг»' : '3 оронтой код. Өрөөнөөс сэжүүр хай.',
            length: 3,
            check: (c) => c === '715',
          });
          g.busy = false;
          if (!ok) return;
          g.flag('bedroom', 'wardrobe-open');
          setTimeout(() => g.rebuildNav(), 1200);
          sound.creak();
          for (const d of r.wardrobeDoors) gsap.to(d.rotation, { y: (d.userData.side as number) * -1.6, duration: 1.1, ease: 'back.out(1.4)' });
          g.card('wardrobe', 'Шүүгээ нээгдлээ! Хувцасны халаасанд түлхүүрийн хэсэг байна.');
          g.progress.stat('challenges');
          await this.gotPiece('piece-ward', g.c.world.anchorOf('wardrobe'));
        })();
        return true;
      }
      case 'can': {
        if (!g.hasItem('can')) {
          sound.pop();
          g.addItem('can');
          g.flag('bedroom', 'can');
          gsap.to(r.can.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.35, ease: 'back.in(2)', onComplete: () => { r.can.visible = false; } });
          g.card('can', 'Усны савыг авлаа. Хэн нэгэн цангасан байх...');
        }
        return true;
      }
      case 'bedplant': {
        if (this.st.flags.includes('watered')) {
          g.card('bedplant', g.cycle('bp', ['Ургамал: "Баярлалаа! Одоо би амьд."', 'Навчнууд нь гялалзаж байна.']));
          return true;
        }
        if (!g.hasItem('can')) {
          sound.tick();
          g.card('bedplant', 'Ургамал гандаж унжчихаж. Ус хэрэгтэй бололтой. Хувин эсвэл сав хаана байгаа бол?');
          return true;
        }
        g.useItem('can');
        g.flag('bedroom', 'watered');
        sound.splash();
        g.puff(g.c.world.anchorOf('bedplant').add(new THREE.Vector3(0, -0.6, 0)), 14, '#9de8ff');
        r.setPlantHappy(true);
        g.card('bedplant', 'Ургамал усаа уугаад сэргэлээ! Шороон дотроос нэг юм гялалзлаа...');
        if (st >= 1 && !this.st.flags.includes('piece-plant')) setTimeout(() => void this.gotPiece('piece-plant', g.c.world.anchorOf('bedplant')), 900);
        return true;
      }
      case 'nightlamp': {
        const on = r.nightBulb.emissiveIntensity < 1;
        sound.tick();
        gsap.to(r.nightBulb, { emissiveIntensity: on ? 2 : 0.05, duration: 0.25 });
        gsap.to(r.nightShade, { emissiveIntensity: on ? 0.5 : 0.02, duration: 0.25 });
        const base = (r.nightLight.userData.base as number | undefined) ?? 7;
        gsap.to(r.nightLight, { intensity: on ? base : 0, duration: 0.25 });
        if (on) g.c.world.lightBase.set(r.nightLight, base);
        else g.c.world.lightBase.delete(r.nightLight);
        g.card('nightlamp', on ? 'Гэрэл асав. Сүүдэр гэрэлд дургүй гэдэг...' : 'Гэрэл унтарлаа. Харанхуй... бага зэрэг аймшигтай.');
        return true;
      }
      case 'bedrug': {
        sound.whoosh();
        g.card('bedrug', g.cycle('brug', ['Зөөлөн хивс. Хөл нүцгэн алхахад хамгийн гоё.', 'Хивсний доор... юу ч алга. Энэ удаад.']));
        return true;
      }
      case 'toybox': {
        sound.pop();
        gsap.fromTo(r.toyLid.rotation, { x: -1.2 }, { x: 0, duration: 0.9, ease: 'bounce.out' });
        g.card('toybox', g.cycle('toy', ['Тоглоомын хайрцаг. Шоо, бөмбөг, хуучин тоглоомууд.', 'Гүнзгий ухах тусам хуучин тоглоомууд гарч ирнэ...', 'Ёроолд нь зөөлөн юм хуруунд тээглээ.']));
        return false;
      }
      case 'slippers': {
        sound.boing();
        g.card('slippers', g.cycle('slip', ['Ягаан шаахай. Дотор нь зөөлөн.', 'Шаахайнууд: "Биднийг өмсөөч."']));
        return false;
      }
      case 'bedwindow': {
        g.onWindow('bedwindow');
        return true;
      }
      case 'door-study': {
        if (st < 3) {
          sound.lock();
          g.card('door-study', st < 2 ? 'Түгжээтэй. Түлхүүрийн 3 хэсгийг ол.' : 'Одоо биш... Тэр чимээ юу байсан бэ?');
          return true;
        }
        void (async () => {
          sound.unlock();
          g.card('door-study', 'Түлхүүр эргэлээ. Хаалга нээгдлээ!', 3000);
          await g.c.world.setDoor('door-study', true);
          await g.completeRoom('bedroom');
        })();
        return true;
      }
    }
    return false;
  }
}
