import gsap from 'gsap';
import { ui } from '../ui';
import { sound } from '../audio';
import { runWordPanel } from '../minigames';
import type { Game } from '../game';
import type { Chapter, QuestView } from './types';

const WORD = 'PORTAL';
const CLUE = 'Нэг газраас нөгөө рүү шууд хүргэдэг ид шидийн хаалга';
/** Object → index of the letter of WORD it hides. */
const SOURCES: Record<string, number> = { duck: 0, towel: 1, washer: 2, bottles: 3, basket: 4, bathplant: 5 };
const NAMES: Record<string, string> = { duck: 'Резинэн нугас', towel: 'Алчуур', washer: 'Угаалгын машин', bottles: 'Лонхнууд', basket: 'Сагс', bathplant: 'Ургамал' };

/** Chapter 5 — hot water fogs the mirror; collect PORTAL; the mirror becomes a door. */
export class BathChapter implements Chapter {
  readonly room = 'bath' as const;
  private mirrorMode: 'clean' | 'fog' | 'portal' = 'clean';

  constructor(private g: Game) {}

  private get st() { return this.g.s.rooms.bath; }
  private get refs() { return this.g.c.world.bath; }
  private get letters() { return this.g.s.bathLetters; }

  apply() {
    if (this.st.flags.includes('hot')) this.setHot(true, true);
    if (this.st.done) this.mirrorMode = 'portal';
    this.drawMirror(0);
  }

  quest(): QuestView {
    const st = this.st.step;
    if (st === 0) return { title: 'Манантай толь', sub: 'Толинд хэн нэгэн бичиг үлдээжээ... гэхдээ харагдахгүй байна.', slots: 0, letters: [] };
    return {
      title: 'Толины цаана',
      sub: `«${CLUE}» — англи үг, ${WORD.length} үсэг. Үсгүүд угаалгын өрөөний эд зүйлсэд нуугдсан.`,
      slots: WORD.length,
      letters: this.letters.map((id) => WORD[SOURCES[id]]),
    };
  }

  hints() {
    if (this.st.step === 0) return ['Ванны дэргэдэх халуун усны цорго дээр дар. Уур толийг манантуулна.'];
    return [
      'Нугас, алчуур, угаалгын машин, лонхнууд, сагс, ургамал... сорилтыг давж үсгээ ол.',
      'Үсгүүд холилдож ирнэ. Сэжүүр: нэг газраас нөгөө рүү шууд хүргэдэг хаалга.',
      'Бүх үсгээ олсны дараа толин дээр дарж үгээ бич.',
    ];
  }

  private setHot(on: boolean, instant = false) {
    const r = this.refs;
    r.steam.visible = on;
    gsap.to(r.water.position, { y: on ? 0.95 : 0.7, duration: instant ? 0 : 2.5 });
    gsap.to(r.water.scale, { x: on ? 1.02 : 0.9, y: on ? 1.02 : 0.9, duration: instant ? 0 : 2.5 });
    gsap.to(r.duck.position, { y: on ? 0.97 : 0.72, duration: instant ? 0 : 2.5 });
    if (!this.st.done) this.mirrorMode = on ? 'fog' : 'clean';
  }

  update(_dt: number, t: number) {
    if (this.g.focus !== 'bath') return;
    if (Math.floor(t * 10) % 2 === 0) this.drawMirror(t);
    this.refs.duck.rotation.y = Math.sin(t * 0.8) * 0.4;
  }

  private drawMirror(t: number) {
    const { ctx, tex } = this.refs.mirror;
    const W = 256, H = 320;
    if (this.mirrorMode === 'portal') {
      const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 170);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, '#b388ff');
      g.addColorStop(0.7, '#2a1f55');
      g.addColorStop(1, '#0b0820');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.2) {
          const r = a * 9 + i * 6;
          ctx.lineTo(W / 2 + Math.cos(a + t * 2 + i) * r, H / 2 + Math.sin(a + t * 2 + i) * r * 1.2);
        }
        ctx.stroke();
      }
      this.refs.mirrorMat.emissiveIntensity = 1.2;
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#cfe3f2');
      g.addColorStop(0.5, '#9bb8d1');
      g.addColorStop(1, '#7a96b2');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(30, 40); ctx.lineTo(90, 40); ctx.lineTo(40, 140); ctx.lineTo(10, 140);
      ctx.fill();
      if (this.mirrorMode === 'fog') {
        ctx.fillStyle = 'rgba(240,246,250,0.82)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#5a6a7a';
        ctx.font = '700 40px Caveat, cursive';
        ctx.textAlign = 'center';
        ctx.fillText('6 үсэг', W / 2, 90);
        ctx.font = '700 26px Caveat, cursive';
        ['Нэг газраас', 'нөгөө рүү шууд', 'хүргэдэг хаалга', '— P _ _ _ _ _ ?'].forEach((l, i) => ctx.fillText(l, W / 2, 150 + i * 36));
        ctx.fillStyle = 'rgba(90,106,122,0.35)';
        for (let i = 0; i < 8; i++) ctx.fillRect(40 + i * 24, 280 + Math.sin(i + t) * 2, 3, 26);
      }
      this.refs.mirrorMat.emissiveIntensity = 0.35;
    }
    tex.needsUpdate = true;
  }

  onClick(id: string): boolean {
    const g = this.g;
    const r = this.refs;
    const st = this.st.step;
    if (id in SOURCES) {
      if (st >= 1 && !this.st.done && !this.letters.includes(id)) {
        if (g.locked(id)) return true;
        void (async () => {
          ui.hideCard();
          const res = await g.challenge(NAMES[id] ?? id);
          if (!res.ok) {
            g.lockFor(id, 8);
            g.card(id, 'Буруу! 8 секунд түгжигдлээ.', 3500);
            return;
          }
          this.letters.push(id);
          g.save();
          await g.flyToken(WORD[SOURCES[id]], g.c.world.anchorOf(id));
          g.progress.award(15, 5);
          g.refreshHUD();
          if (this.letters.length === WORD.length) ui.toast('Бүх үсэг олдлоо! Толин дээр дарж үгээ бич. Үсгүүд холилдсон шүү.', 6000);
        })();
        return true;
      }
      if (id === 'washer') {
        const w = g.c.world.interactives.get('washer')!;
        w.userData.spin = !w.userData.spin;
        sound.whoosh();
        g.card('washer', w.userData.spin ? 'Угаалгын машин эргэлдэж эхэллээ. Оймс алга болох газар.' : 'Машин зогслоо.');
        return true;
      }
      if (id === 'duck') {
        sound.squeak();
        gsap.fromTo(r.duck.position, { y: r.duck.position.y + 0.15 }, { y: r.duck.position.y, duration: 0.6, ease: 'bounce.out' });
        g.card('duck', g.cycle('duck', ['Квак!', 'Нугас чиний нүд рүү хараад квак гэлээ.']));
        return true;
      }
      g.card(id, st === 0 ? 'Энгийн харагдаж байна... Өрөө жаахан хүйтэн байна.' : 'Энд нуугдсан үсгийг аль хэдийн олсон.');
      return true;
    }
    switch (id) {
      case 'faucet': {
        const hot = !this.st.flags.includes('hot') || !r.steam.visible;
        sound.splash();
        if (st === 0) {
          this.g.flag('bath', 'hot');
          this.setHot(true);
          g.progress.quest('bath');
          g.card('faucet', 'Халуун ус шоржигнон урсаж, өрөөнд уур савслаа... Толин дээр бичиг тодорч эхэллээ!', 6000);
          setTimeout(() => g.stepDone('bath', 1, 'Халуун ус'), 1500);
          return true;
        }
        this.setHot(hot);
        if (hot) g.progress.quest('bath');
        g.card('faucet', hot ? 'Халуун ус урслаа. Уур савсав.' : 'Ус хаалаа.');
        return true;
      }
      case 'mirror': {
        if (this.st.done) {
          sound.legendary();
          g.card('mirror', 'Толь одоо ид шидийн хаалга. Цаана нь оддын цамхаг харагдана.');
          g.goto('observatory');
          return true;
        }
        if (st === 0) {
          g.card('mirror', 'Толь бүдэг... ямар нэг бичиг байх шиг, гэхдээ уншигдахгүй. Уур хэрэгтэй юм болов уу?');
          return true;
        }
        void (async () => {
          const found = this.letters.map((x) => WORD[SOURCES[x]]);
          g.busy = true;
          const ok = await runWordPanel({
            eyebrow: 'Манантай толь',
            title: 'Толин дээр бич',
            clue: CLUE,
            letters: found,
            total: WORD.length,
            submit: (w) => {
              if (w === WORD) return true;
              let right = 0;
              for (let i = 0; i < WORD.length; i++) if (w[i] === WORD[i]) right++;
              return w.length !== WORD.length ? `${WORD.length} үсэгтэй үг хэрэгтэй.` : `Буруу. Зөв байрлалтай үсэг: ${right}/${WORD.length}`;
            },
          });
          g.busy = false;
          if (!ok) return;
          this.mirrorMode = 'portal';
          sound.legendary();
          ui.flash('#b388ff', 0.6);
          g.rgbGlitch(0.015, 1.6);
          g.card('mirror', 'Толины гадаргуу долгилж... ид шидийн хаалга болон хувирлаа! Цаана нь од эргэлдэнэ.', 6000);
          setTimeout(() => void g.completeRoom('bath'), 2400);
        })();
        return true;
      }
      case 'tub':
        g.card('tub', g.cycle('tub', ['Хөлтэй хуучин ванн. Хөшигний цаана нуугдаж болно.', 'Ванны ёроолд жижигхэн загасны зураг.']));
        return true;
      case 'closet':
        sound.creak();
        g.card('closet', 'Алчуурын шүүгээ. Дотор нь зөөлөн алчуурууд — нуугдахад тохиромжтой.');
        return true;
      case 'bathsink':
        sound.splash();
        g.card('bathsink', g.cycle('bsink', ['Гар угаалтуур. Ус хүйтэн.', 'Шүдний сойз ганцаараа.']));
        return false;
      case 'bathmat':
        g.card('bathmat', g.cycle('bmat', ['Зөөлөн хивс. Хөл хуурай.', 'Хивсний доор нэг юм хатуу...']));
        return false;
    }
    return false;
  }

  loseOne() {
    if (!this.letters.length || this.st.done) return null;
    const id = this.letters.pop()!;
    return `«${WORD[SOURCES[id]]}» үсэг алга боллоо — дахин олох хэрэгтэй.`;
  }

  onEnter() {
    if (this.st.step === 0 && !this.st.flags.includes('intro')) {
      this.g.flag('bath', 'intro');
      setTimeout(() => ui.toast('Угаалгын өрөө... дусал дуслах чимээ. Толь яагаад ч юм манантай.', 4000), 1200);
    }
  }
}
