import * as THREE from 'three';
import gsap from 'gsap';
import { ui } from '../ui';
import { sound } from '../audio';
import { runCooking } from '../minigames';
import type { Game } from '../game';
import type { Chapter, QuestView } from './types';

const INGREDIENTS = ['egg', 'milk', 'flour', 'honey'] as const;
const EMOJI: Record<string, string> = { egg: '🥚', milk: '🥛', flour: '🌾', honey: '🍯' };

/** Chapter 4 — Mochi's secret recipe: gather, cook (timing game), feed Mochi. */
export class KitchenChapter implements Chapter {
  readonly room = 'kitchen' as const;

  constructor(private g: Game) {}

  private get st() { return this.g.s.rooms.kitchen; }
  private get refs() { return this.g.c.world.kitchen; }
  private hasF(f: string) { return this.st.flags.includes(f); }
  private got(i: string) { return this.hasF(`got-${i}`); }

  apply() {
    if (this.hasF('cooked') && !this.st.done) this.refs.plate.visible = true;
  }

  quest(): QuestView {
    const st = this.st.step;
    if (st === 0) return { title: 'Хэн нэгэн өлсөж байна', sub: 'Хөргөгчин дээр хуудас наасан байна. Унш.', slots: 0, letters: [] };
    if (st === 1) return { title: 'Мочигийн нууц жор', sub: 'Бинд 4 орц хэрэгтэй. Шүүгээ, тавиурыг шалга.', slots: 4, letters: INGREDIENTS.map((i) => (this.got(i) ? EMOJI[i] : '')) };
    if (st === 2) return { title: 'Бин шарах', sub: 'Бүх орц бэлэн! Зуухан дээр бин шар.', slots: 0, letters: [] };
    return { title: 'Мочид бинээ өг', sub: 'Мочи ширээний дэргэд хүлээж байна. Мочи дээр дар.', slots: 0, letters: [] };
  }

  hints() {
    const st = this.st.step;
    if (st === 0) return ['Хөргөгчин дээр дар.'];
    if (st === 1) return ['Гурил дээд шүүгээнд (шар хаалгатай). Зөгийн бал баруун дээд тавиур дээр.', 'Буруу хариулбал объект түр түгжигдэнэ — сайн бод.'];
    if (st === 2) return ['Зуухан дээр дараад зүү ногоон бүсэд орох мөчид "Эргүүл!" дар.'];
    return ['Ширээний дэргэдэх Мочи дээр дар.'];
  }

  private gather(i: (typeof INGREDIENTS)[number], at: THREE.Vector3) {
    this.g.flag('kitchen', `got-${i}`);
    this.g.addItem(i);
    void this.g.flyToken(EMOJI[i], at).then(() => {
      this.g.refreshHUD();
      if (INGREDIENTS.every((x) => this.got(x)) && this.st.step < 2) {
        this.g.stepDone('kitchen', 2, 'Бүх орц');
        ui.toast('Бүх орц бэлэн! Одоо зуухан дээр бин шар.', 4000);
      }
    });
  }

  private async cook() {
    const g = this.g;
    const r = this.refs;
    g.busy = true;
    gsap.to(r.hob, { emissiveIntensity: 1.6, duration: 0.6 });
    r.pancake.visible = true;
    const res = await runCooking();
    g.busy = false;
    gsap.to(r.hob, { emissiveIntensity: 0, duration: 1.2 });
    if (!res.ok) {
      r.pancake.visible = false;
      g.card('stove', 'Бин түлэгдчихлээ... Дахиад оролдоё. Орц хангалттай байна.');
      return false;
    }
    gsap.fromTo(r.pancake.position, { y: 0.075 }, { y: 0.6, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' });
    gsap.fromTo(r.pancake.rotation, { x: 0 }, { x: Math.PI * 2, duration: 0.6 });
    g.puff(g.c.world.anchorOf('stove'), 10, '#ffffff');
    g.progress.stat('cooks');
    g.progress.quest('cook');
    if (res.perfect) g.progress.badge('perfectchef');
    return true;
  }

  onClick(id: string): boolean {
    const g = this.g;
    const r = this.refs;
    const st = this.st.step;
    switch (id) {
      case 'fridge': {
        sound.creak();
        gsap.fromTo(r.fridgeDoor.rotation, { y: 0 }, { y: 1.6, duration: 0.6, yoyo: true, repeat: 1, repeatDelay: 1.2, ease: 'power2.out' });
        if (st === 0) {
          g.flag('kitchen', 'recipe');
          g.stepDone('kitchen', 1, 'Жор');
          g.card('fridge', '«Мочигийн дуртай бин: өндөг, сүү, гурил, зөгийн бал.» Хөргөгчинд өндөг, сүү байна — авлаа!', 7000);
          setTimeout(() => this.gather('egg', g.c.world.anchorOf('fridge')), 700);
          setTimeout(() => this.gather('milk', g.c.world.anchorOf('fridge')), 2600);
          return true;
        }
        g.card('fridge', g.cycle('fridge', ['Хөргөгч: хүйтэн. Үнэхээр хүйтэн.', 'Дотор нь ганц шил даршилсан өргөст хэмх.', 'Хөргөгчний гэрэл асч унтарлаа. Ид шид!']));
        return true;
      }
      case 'cupboard':
      case 'honey': {
        const item = id === 'cupboard' ? 'flour' : 'honey';
        if (st < 1) {
          g.card(id, id === 'cupboard' ? 'Дээд шүүгээ. Юу хайж байгаагаа мэдэхгүй байна.' : 'Алтлаг лонх. Хэрэг болох эсэхийг мэдэхгүй.');
          return true;
        }
        if (this.got(item)) {
          g.card(id, id === 'cupboard' ? 'Шүүгээнд гурил үлдсэнгүй.' : 'Балны лонх хоосорчихлоо.');
          return true;
        }
        if (g.locked(id)) return true;
        void (async () => {
          ui.hideCard();
          const res = await g.challenge(id === 'cupboard' ? 'Дээд шүүгээ' : 'Зөгийн бал', { kind: id === 'cupboard' ? 'riddle' : 'math' });
          if (!res.ok) {
            g.lockFor(id, 7);
            g.card(id, 'Буруу! 7 секунд түгжигдлээ.', 3500);
            return;
          }
          if (id === 'cupboard') gsap.fromTo(r.cupboardDoor.rotation, { y: 0 }, { y: 1.5, duration: 0.6, yoyo: true, repeat: 1, repeatDelay: 1, ease: 'power2.out' });
          g.card(id, id === 'cupboard' ? 'Шүүгээ онгойлоо — гурил!' : 'Зөгийн балны лонх тавиураас гулсаад гарт чинь буулаа!');
          this.gather(item, g.c.world.anchorOf(id));
        })();
        return true;
      }
      case 'stove': {
        if (this.st.done) {
          void this.cook().then((ok) => { if (ok) { g.progress.award(25, 15, 'Бин'); g.card('stove', 'Дахиад нэг бин! Мочи маш их баярлана.'); } });
          return true;
        }
        if (st < 2) {
          const miss = INGREDIENTS.filter((i) => !this.got(i)).map((i) => EMOJI[i]).join(' ');
          g.card('stove', st < 1 ? 'Зуух. Юу хийхээ эхлээд мэдэх хэрэгтэй.' : `Орц дутуу байна: ${miss}`);
          return true;
        }
        if (this.hasF('cooked')) {
          g.card('stove', 'Бин аль хэдийн бэлэн. Мочи дээр дар!');
          return true;
        }
        void this.cook().then((ok) => {
          if (!ok) return;
          for (const i of INGREDIENTS) g.useItem(i);
          g.addItem('pancake');
          g.flag('kitchen', 'cooked');
          r.plate.visible = true;
          g.stepDone('kitchen', 3, 'Бин!');
          ui.toast('Мочи бины үнэрт хамраа хөдөлгөж байна! Мочи дээр дарж бинээ өг.', 5000);
        });
        return true;
      }
      case 'creature': {
        if (st !== 3 || this.st.done || !g.hasItem('pancake')) return false;
        g.useItem('pancake');
        r.plate.visible = false;
        sound.squeak();
        g.c.creature.bounce();
        g.confetti(g.c.creature.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 60, 0.8);
        g.card('creature', 'Мочи: "Ммм! Миний хамгийн дуртай бин! Баярлалаа!" ...Мочи халааснаасаа жижигхэн түлхүүр гаргаж ирлээ. "Угаалгын өрөө. Толинд болгоомжтой хандаарай."', 8000);
        g.progress.stat('pets');
        setTimeout(() => void g.completeRoom('kitchen'), 2600);
        return true;
      }
      case 'toaster':
        sound.pop();
        g.card('toaster', g.cycle('toast', ['Талх үсрэн гарлаа! Шатсан байна.', 'Талх шарагч: "Тинг!"']));
        return true;
      case 'kettle':
        sound.steam();
        g.puff(g.c.world.anchorOf('kettle'), 8);
        g.card('kettle', g.cycle('kettle', ['Данх исгэрлээ. Цай уух цаг!', 'Уур савсаж, цонх манантай болов.']));
        return true;
      case 'cookiejar':
        sound.pop();
        g.card('cookiejar', g.cycle('cj', ['Жигнэмэгний лонх. Бараг хоосон.', 'Лонхны ёроолд нэг юм харагдана...']));
        return false;
      case 'fruit':
        g.card('fruit', g.cycle('fruit', ['Алим, жүрж, гадил. Эрүүл амьдрал!', 'Нэг алим чамайг ширтэж байх шиг.']));
        return true;
      case 'herbs':
        g.card('herbs', 'Гаа, базилик, яншуй. Гал тогоо гоё үнэртэж байна.');
        return true;
      case 'sink':
        sound.splash();
        g.card('sink', g.cycle('sink', ['Ус шоржигнолоо.', 'Угаалтуурын шүүрэнд нэг юм гялалзаж байна...']));
        return false;
      case 'pantry':
        sound.creak();
        g.card('pantry', 'Агуулахын шүүгээ. Дотор нь харанхуй, нуугдахад тохиромжтой.');
        return true;
      case 'ktable':
        g.card('ktable', 'Хоолны ширээ. Ширээн доор хүн нуугдаж болохуйц зай бий.');
        return true;
    }
    return false;
  }

  loseOne() {
    const last = (['honey', 'flour'] as const).find((i) => this.got(i) && this.g.hasItem(i));
    if (!last || this.st.step >= 2) return null;
    this.g.useItem(last);
    this.g.s.rooms.kitchen.flags = this.st.flags.filter((f) => f !== `got-${last}`);
    return `${EMOJI[last]} ${last === 'honey' ? 'Зөгийн бал' : 'Гурил'} алга боллоо — дахин олох хэрэгтэй.`;
  }

  onEnter() {
    if (this.st.step === 0 && !this.hasF('intro')) {
      this.g.flag('kitchen', 'intro');
      setTimeout(() => ui.toast('Гал тогоо... Мочигийн гэдэс дуугарах сонсогдоно.', 4000), 1200);
    }
  }
}
