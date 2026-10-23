import { ui, icon, shapeSvg } from './ui';
import { sound } from './audio';
import { h } from './util';
import { wipeSave } from './state';
import { today } from './progress';
import { runWordPanel } from './minigames';
import {
  CALENDAR, QUEST_POOL, REWARDS, RARITY_LABEL, BADGES, TIER_NAME, ROOMS, PAINTS, SHOP,
  roomDef, levelForXp, type PaintId, type HatId, type LightsMode, type RoomId,
} from './data';
import type { Game } from './game';
import * as THREE from 'three';
import { defaultLook, HAIR_COLORS, HAIR_NAMES, SKIN_COLORS, TOP_COLORS, type AvatarLook } from './avatar';

const tabs = (names: string[], panes: HTMLElement[], start = 0) => {
  const bar = h('div', { class: 'tabs' });
  names.forEach((n, i) => {
    const b = h('button', { class: `tab${i === start ? ' active' : ''}` }, n);
    b.addEventListener('click', () => {
      bar.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      panes.forEach((p, j) => { p.hidden = j !== i; });
      sound.tick();
    });
    bar.append(b);
  });
  panes.forEach((p, j) => { p.hidden = j !== start; });
  return bar;
};

// --------------------------------------------------------------------------- daily (mailbox)
export function openDaily(g: Game) {
  const s = g.s;
  g.progress.rollDay();
  const el = h('div', { class: 'daily' });
  el.append(h('p', { class: 'eyebrow' }, `🔥 ${s.streak} өдөр дараалан · хамгийн урт ${s.bestStreak}`), h('h2', { class: 'hand' }, 'Өнөөдрийн шуудан'));

  // 7-day calendar
  const cal = h('div', { class: 'cal' });
  CALENDAR.forEach((c, i) => {
    const state = i < s.calendarIdx || (i === s.calendarIdx && s.calendarClaimed) ? 'got' : i === s.calendarIdx ? 'today' : '';
    const d = h('div', { class: `cal-day ${state}` }, h('small', {}, `${i + 1}-р өдөр`), h('b', {}, c.roll ? '🎁' : '✦'), h('span', {}, c.label));
    cal.append(d);
  });
  el.append(cal);
  const claim = h('button', { class: 'btn-primary' }, s.calendarClaimed ? 'Өнөөдрийн бэлэг авсан ✓' : 'Өдрийн бэлгээ авах');
  if (s.calendarClaimed) claim.setAttribute('disabled', 'true');
  claim.addEventListener('click', () => {
    ui.closeModal();
    setTimeout(() => g.progress.claimCalendar(), 300);
  });
  el.append(claim);

  // quests
  el.append(h('h3', { class: 'sec' }, 'Өдрийн даалгавар'));
  const qs = h('div', { class: 'quests' });
  s.quests.forEach((q, i) => {
    const def = QUEST_POOL.find((d) => d.id === q.id);
    if (!def) return;
    const done = q.progress >= def.n;
    const row = h('div', { class: `quest-row${q.claimed ? ' claimed' : done ? ' ready' : ''}` });
    row.append(
      h('div', { class: 'q-text' }, h('b', {}, def.text.replace('{n}', String(def.n))), h('div', { class: 'q-bar' }, h('i', { style: `width:${Math.min(100, (q.progress / def.n) * 100)}%` }))),
      h('span', { class: 'q-num' }, `${Math.min(q.progress, def.n)}/${def.n}`),
    );
    if (done && !q.claimed) {
      const b = h('button', { class: 'btn-mini' }, '+40 ✦');
      b.addEventListener('click', () => {
        g.progress.claimQuest(i);
        row.classList.add('claimed');
        b.remove();
      });
      row.append(b);
    } else if (q.claimed) row.append(h('span', { class: 'q-ok' }, '✓'));
    qs.append(row);
  });
  el.append(qs);

  // mystery
  el.append(h('h3', { class: 'sec' }, '✉ Өдрийн нууц үг'));
  const m = g.progress.mystery();
  if (!m) el.append(h('p', { class: 'muted small' }, 'Унтлагын өрөөний бүлгийг дуусгасны дараа өдөр бүр шинэ нууц үг ирнэ.'));
  else if (m.solved) el.append(h('p', { class: 'muted small' }, `Өнөөдрийн үг «${m.word}» тайлагдсан ✓ Маргааш шинэ үг ирнэ.`));
  else {
    const where = [...new Set(m.sources.filter((id) => !m.letters.includes(id)).map((id) => g.c.world.zoneOf(id)))]
      .map((z) => (z === 'garden' ? 'Цэцэрлэг' : roomDef(z as RoomId).name)).join(', ');
    el.append(h('p', { class: 'muted small' }, `«${m.clue}» — ${m.word.length} үсэг. Олдсон: ${m.letters.length}/${m.word.length}.${where ? ` Үлдсэн үсгүүд: ${where} (✉ тэмдэгтэй объектууд).` : ''}`));
    const b = h('button', { class: 'btn-ghost' }, m.letters.length === m.word.length ? 'Үгээ оруулах' : 'Үсгүүдээ харах');
    b.addEventListener('click', () => {
      ui.closeModal();
      setTimeout(() => void runWordPanel({
        eyebrow: 'Өдрийн нууц',
        title: 'Үгээ бүтээ',
        clue: m.clue,
        letters: g.progress.mysteryFound(),
        total: m.word.length,
        submit: (w) => {
          if (w === m.word) {
            g.progress.solveMystery();
            return true;
          }
          m.mistakes++;
          g.save();
          let right = 0;
          for (let i = 0; i < m.word.length; i++) if (w[i] === m.word[i]) right++;
          return `Буруу. Зөв байрлалтай үсэг: ${right}/${m.word.length}`;
        },
      }), 300);
    });
    el.append(b);
  }

  // tree
  el.append(h('h3', { class: 'sec' }, '🌱 Ид шидийн мод'));
  el.append(h('p', { class: 'muted small' }, s.waterDay === today()
    ? `Өнөөдөр усалсан. Мод ${s.treeStage}/8 шатанд байна.`
    : `Цэцэрлэгийн модыг өнөөдөр услаагүй байна (${s.treeStage}/8). Өдөр бүр нэг шат ургана.`));
  ui.openModal(el, { className: 'modal-daily' });
}

// --------------------------------------------------------------------------- collection + badges
export function openCollection(g: Game, startTab = 0) {
  const s = g.s;
  const el = h('div', { class: 'collection' });
  const coll = h('div', {});
  const sets: (RoomId | 'legend')[] = [...ROOMS.map((r) => r.id), 'legend'];
  for (const set of sets) {
    const items = REWARDS.filter((r) => r.set === set);
    const owned = items.filter((r) => s.collection[r.id]).length;
    coll.append(h('h3', { class: 'sec' }, `${set === 'legend' ? '👑 Домогт' : roomDef(set).name} · ${owned}/${items.length}${owned === items.length ? ' ✓' : ''}`));
    const grid = h('div', { class: 'grid' });
    for (const r of items) {
      const n = s.collection[r.id] ?? 0;
      const item = h('div', { class: `item rarity-${r.rarity}${n ? '' : ' locked'}` });
      item.innerHTML = `<div class="art">${n ? shapeSvg(r.shape, r.color, 48) : icon('lock', 26)}</div>`;
      item.append(h('b', {}, n ? r.name : '???'), h('small', {}, n ? `${RARITY_LABEL[r.rarity]}${n > 1 ? ` ×${n}` : ''}` : r.how));
      item.title = n ? r.desc : r.how;
      grid.append(item);
    }
    coll.append(grid);
  }
  const badges = h('div', { class: 'badge-book' });
  const groups: [string, string][] = [['story', 'Түүх'], ['skill', 'Ур чадвар'], ['secret', 'Нууц']];
  for (const [grp, label] of groups) {
    badges.append(h('h3', { class: 'sec' }, label));
    const grid = h('div', { class: 'badge-grid' });
    for (const b of BADGES.filter((x) => x.group === grp)) {
      const tier = s.badges[b.id] ?? 0;
      const hidden = b.group === 'secret' && !tier;
      const card = h('div', { class: `badge-card tier-${b.tiers ? tier : tier ? 3 : 0}${tier ? '' : ' off'}` });
      card.append(h('div', { class: 'b-icon' }, hidden ? '❔' : b.icon), h('b', {}, hidden ? 'Нууц тэмдэг' : b.name));
      if (b.tiers) {
        const next = b.tiers[Math.min(tier, 2)];
        card.append(h('small', {}, tier >= 3 ? 'Алт ✓' : `${tier ? TIER_NAME[tier] + ' · ' : ''}${b.desc.replace('{n}', String(next))}`));
        const pips = h('div', { class: 'pips' });
        for (let i = 1; i <= 3; i++) pips.append(h('i', { class: i <= tier ? 'on' : '' }));
        card.append(pips);
      } else card.append(h('small', {}, hidden ? 'Бүх зүйлийг судал...' : b.desc));
      grid.append(card);
    }
    badges.append(grid);
  }
  const owned = REWARDS.filter((r) => s.collection[r.id]).length;
  const earned = Object.keys(s.badges).length;
  el.append(h('h2', { class: 'hand' }, 'Миний цуглуулга'), tabs([`Цуглуулга ${owned}/${REWARDS.length}`, `Тэмдэг ${earned}/${BADGES.length}`], [coll, badges], startTab), coll, badges);
  ui.openModal(el, { className: 'modal-collection' });
}

// --------------------------------------------------------------------------- shop + decor
export function applyDecor(g: Game) {
  const { world, creature } = g.c;
  const s = g.s;
  world.setLightsMode(s.lights);
  world.living.fishbowl.visible = s.owned.includes('fishbowl');
  world.kitchen.vacuum.visible = s.owned.includes('vacuum');
  world.gardenRefs.fireflies.visible = s.owned.includes('fireflies');
  world.bedroom.balloons.visible = s.owned.includes('balloons');
  if (s.creatureCaught) creature.setHat(s.hat);
  for (const r of ROOMS) world.setPaint(r.id, s.rooms[r.id].paint);
}

export function openShop(g: Game) {
  const s = g.s;
  const el = h('div', { class: 'shop' });
  const coinLine = h('p', { class: 'shop-coins' });
  const refreshCoins = () => { coinLine.textContent = `✦ ${s.coins} · Түвшин ${levelForXp(s.xp)}`; };
  refreshCoins();
  const buy = (price: number, id: string, done: () => void) => {
    if (!g.progress.spend(price)) {
      sound.error();
      ui.toast(`Оддын тоос хүрэлцэхгүй байна (${price} ✦ хэрэгтэй). Даалгавар биелүүлж, нууц тайлж цуглуул!`, 3500);
      return;
    }
    s.owned.push(id);
    sound.coin();
    sound.success();
    g.save();
    g.progress.checkBadges();
    done();
    refreshCoins();
  };

  // Mochi + extras
  const things = h('div', { class: 'shop-list' });
  const renderThings = () => {
    things.replaceChildren();
    if (!s.creatureCaught) things.append(h('p', { class: 'muted small' }, 'Мочигийн малгайнууд Мочиг олсны дараа нээгдэнэ.'));
    const hats: { id: HatId; name: string; icon: string; price: number; level?: number; desc: string }[] = [
      ...SHOP.filter((x) => x.kind === 'hat').map((x) => ({ id: x.id as HatId, name: x.name, icon: x.icon, price: x.price, level: x.level, desc: x.desc })),
      { id: 'hat-crown', name: 'Домогт титэм', icon: '👑', price: 0, desc: '«Жижиг ертөнцийн титэм» цуглуулгад байвал үнэгүй.' },
    ];
    for (const hat of hats) {
      const own = hat.id === 'hat-crown' ? !!s.collection.crown : s.owned.includes(hat.id);
      const on = s.hat === hat.id;
      const row = shopRow(hat.icon, hat.name, hat.desc);
      const lvlLock = (hat.level ?? 0) > levelForXp(s.xp);
      const b = h('button', { class: `btn-mini${on ? ' on' : ''}` }, on ? 'Өмссөн' : own ? 'Өмсгөх' : lvlLock ? `Түв. ${hat.level}` : hat.id === 'hat-crown' ? '🔒' : `${hat.price} ✦`);
      if (!s.creatureCaught || (!own && (lvlLock || hat.id === 'hat-crown'))) b.setAttribute('disabled', 'true');
      b.addEventListener('click', () => {
        const wear = () => {
          s.hat = s.hat === hat.id ? null : hat.id;
          g.c.creature.setHat(s.hat);
          g.c.creature.bounce();
          g.save();
          renderThings();
        };
        if (own) wear();
        else buy(hat.price, hat.id, wear);
      });
      row.append(b);
      things.append(row);
    }
    for (const x of SHOP.filter((y) => y.kind === 'extra' || y.kind === 'lights')) {
      const own = s.owned.includes(x.id);
      const row = shopRow(x.icon, x.name, x.desc);
      const lvlLock = (x.level ?? 0) > levelForXp(s.xp);
      let label = own ? 'Байгаа ✓' : lvlLock ? `Түв. ${x.level}` : `${x.price} ✦`;
      if (x.kind === 'lights' && own) label = s.lights === lightsOf(x.id) ? 'Асаалттай' : 'Асаах';
      const b = h('button', { class: `btn-mini${own && x.kind === 'lights' && s.lights === lightsOf(x.id) ? ' on' : ''}` }, label);
      if ((own && x.kind === 'extra') || (!own && lvlLock)) b.setAttribute('disabled', 'true');
      b.addEventListener('click', () => {
        const apply = () => {
          if (x.kind === 'lights') s.lights = s.lights === lightsOf(x.id) ? 'warm' : lightsOf(x.id);
          g.save();
          applyDecor(g);
          renderThings();
          if (x.kind === 'extra') ui.toast(`${x.icon} ${x.name} байшинд нэмэгдлээ!`, 3000);
        };
        if (own) apply();
        else buy(x.price, x.id, apply);
      });
      row.append(b);
      things.append(row);
    }
  };
  renderThings();

  // paints
  const paints = h('div', { class: 'shop-list' });
  const renderPaints = () => {
    paints.replaceChildren();
    paints.append(h('p', { class: 'muted small' }, 'Будаг худалдаж аваад дурын өрөөндөө түрх.'));
    const sw = h('div', { class: 'paint-row' });
    (Object.keys(PAINTS) as PaintId[]).forEach((p) => {
      const def = PAINTS[p];
      const own = s.paints.includes(p);
      const b = h('button', { class: `paint-swatch${own ? '' : ' locked'}`, style: `background:linear-gradient(${def.wall} 60%, ${def.wallLow} 60%)`, title: own ? def.name : `${def.name} — ${def.price} ✦` });
      b.innerHTML = own ? '' : `<span>${def.price}✦</span>`;
      b.addEventListener('click', () => {
        if (own) return;
        if (!g.progress.spend(def.price)) {
          sound.error();
          ui.toast(`${def.price} ✦ хэрэгтэй.`, 2500);
          return;
        }
        s.paints.push(p);
        sound.success();
        g.save();
        refreshCoins();
        renderPaints();
      });
      sw.append(b);
    });
    paints.append(sw);
    for (const r of ROOMS) {
      if (!s.rooms[r.id].unlocked) continue;
      const row = h('div', { class: 'paint-room' }, h('b', {}, r.name));
      const opts = h('div', { class: 'paint-opts' });
      for (const p of s.paints) {
        const def = PAINTS[p];
        const b = h('button', { class: `paint-dot${s.rooms[r.id].paint === p ? ' on' : ''}`, style: `background:${def.wall}`, title: def.name, 'aria-label': def.name });
        b.addEventListener('click', () => {
          s.rooms[r.id].paint = p;
          g.c.world.setPaint(r.id, p);
          sound.pop();
          g.save();
          renderPaints();
        });
        opts.append(b);
      }
      row.append(opts);
      paints.append(row);
    }
  };
  renderPaints();

  el.append(h('h2', { class: 'hand' }, 'Байшингаа чимэх'), coinLine, tabs(['Мочи ба эд зүйл', 'Ханын будаг'], [things, paints]), things, paints);
  ui.openModal(el, { className: 'modal-shop' });
}

const lightsOf = (id: string): LightsMode => (id === 'lights-rainbow' ? 'rainbow' : id === 'lights-ice' ? 'ice' : 'warm');

function shopRow(emoji: string, name: string, desc: string) {
  return h('div', { class: 'shop-row' }, h('span', { class: 'shop-ic' }, emoji), h('div', { class: 'shop-txt' }, h('b', {}, name), h('small', {}, desc)));
}

// --------------------------------------------------------------------------- menu
export function openMenu(g: Game) {
  const s = g.s;
  const el = h('div', { class: 'menu' });
  el.append(h('h2', { class: 'hand' }, 'Цэс'));
  const mk = (label: string, fn: (b: HTMLButtonElement) => void, cls = 'btn-ghost') => {
    const b = h('button', { class: cls }, label);
    b.addEventListener('click', () => fn(b));
    el.append(b);
    return b;
  };
  mk('Бүх байшинг харах', () => { ui.closeModal(); g.goto(null); });
  mk('🧑 Дүрээ өөрчлөх', () => { ui.closeModal(); setTimeout(() => openAvatar(g, false), 300); });
  mk(s.muted ? 'Дуу асаах' : 'Дуу унтраах', () => { g.toggleSound(); ui.closeModal(); });
  const calmLabel = () => (s.calmMode ? '🕊 Тайван горим: Асаалттай (Сүүдэргүй)' : '👻 Тайван горим: Унтраалттай');
  mk(calmLabel(), (b) => {
    s.calmMode = !s.calmMode;
    if (s.calmMode && !s.shadowMet && s.rooms.bedroom.step >= 2) s.shadowMet = true;
    g.save();
    b.textContent = calmLabel();
    b.classList.toggle('hard-on', s.calmMode);
    ui.toast(s.calmMode ? 'Тайван горим: Сүүдэр ирэхгүй.' : 'Сүүдэр буцаж ирлээ... Болгоомжтой!', 3000);
  }).classList.toggle('hard-on', s.calmMode);
  if (s.rooms.observatory.done) {
    const nl = () => (s.nightHunt ? '🌙 Шөнийн ан: Асаалттай' : '🌙 Шөнийн ан: Унтраалттай');
    mk(nl(), (b) => {
      s.nightHunt = !s.nightHunt;
      g.save();
      b.textContent = nl();
      b.classList.toggle('hard-on', s.nightHunt);
      ui.toast(s.nightHunt ? 'Шөнийн ан: Сүүдэр бүх өрөөнд нуугдаж тоглоно. Нуугдах бүрт 2 дахин их шагнал!' : 'Шөнийн ан унтарлаа.', 4000);
    }).classList.toggle('hard-on', s.nightHunt);
  }
  if (s.hardModeUnlocked) {
    const label = () => (s.hardMode ? '🔥 Хэцүү горим: Асаалттай' : 'Хэцүү горим: Унтраалттай');
    mk(label(), (b) => {
      s.hardMode = !s.hardMode;
      g.save();
      b.textContent = label();
      b.classList.toggle('hard-on', s.hardMode);
    }).classList.toggle('hard-on', s.hardMode);
  }
  mk('Зураг авах', () => { ui.closeModal(); setTimeout(() => g.takePhoto(), 300); });
  let armed = false;
  mk('Шинээр эхлэх', (b) => {
    if (!armed) {
      armed = true;
      b.textContent = 'Итгэлтэй байна уу? Бүх ахиц устана. Дахин дар.';
      b.classList.add('danger');
      return;
    }
    wipeSave();
    location.reload();
  });
  const st = s.stats;
  el.append(h('p', { class: 'muted small' }, `Нуугдсан: ${st.hides ?? 0} · Баригдсан: ${st.caught ?? 0} · Сорилт: ${st.challenges ?? 0} · Star Catcher: ${['—', 'BRONZE', 'SILVER', 'GOLD'][s.bestArcadeRank]}`));
  el.append(h('p', { class: 'muted small' }, 'Little House · Three.js + WebAudio · Ахиц энэ төхөөрөмж дээр хадгалагдана.'));
  ui.openModal(el, { className: 'modal-menu' });
}

// --------------------------------------------------------------------------- character creator
export function openAvatar(g: Game, first: boolean, onDone?: () => void) {
  const look: AvatarLook = { ...(g.s.avatar ?? defaultLook()) };
  const av = g.c.avatar;
  const el = h('div', { class: 'avatar-maker' });
  el.append(h('p', { class: 'eyebrow' }, first ? 'Тавтай морил' : 'Миний дүр'), h('h2', { class: 'hand' }, first ? 'Чи хэн бэ?' : 'Дүрээ өөрчлөх'));
  const name = h('input', { class: 'name-in', maxlength: '12', placeholder: 'Нэрээ бич (заавал биш)', 'aria-label': 'Нэр', value: look.name });
  name.addEventListener('input', () => { look.name = name.value.trim(); });
  el.append(name);
  const apply = () => av.setLook(look);
  const row = (label: string, items: HTMLElement[]) => {
    el.append(h('p', { class: 'av-label' }, label), h('div', { class: 'av-row' }, ...items));
  };
  const choice = <T,>(values: T[], get: () => T, set: (v: T) => void, render: (v: T, b: HTMLButtonElement) => void) =>
    values.map((v) => {
      const b = h('button', { class: `av-opt${get() === v ? ' on' : ''}` });
      render(v, b);
      b.addEventListener('click', () => {
        set(v);
        apply();
        sound.pop();
        b.parentElement?.querySelectorAll('.av-opt').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      });
      return b;
    });
  row('Үс', choice([0, 1, 2, 3], () => look.hair, (v) => { look.hair = v; }, (v, b) => { b.textContent = HAIR_NAMES[v]; b.classList.add('wide'); }));
  row('Үсний өнгө', choice(HAIR_COLORS, () => look.hairColor, (v) => { look.hairColor = v; }, (v, b) => { b.style.background = v; }));
  row('Хувцас', choice(TOP_COLORS, () => look.top, (v) => { look.top = v; }, (v, b) => { b.style.background = v; }));
  row('Арьс', choice(SKIN_COLORS, () => look.skin, (v) => { look.skin = v; }, (v, b) => { b.style.background = v; }));
  row('Нүдний шил', choice([false, true], () => look.glasses, (v) => { look.glasses = v; }, (v, b) => { b.textContent = v ? '👓 Тийм' : 'Үгүй'; b.classList.add('wide'); }));
  const done = h('button', { class: 'btn-primary big' }, first ? 'Байшиндаа орох →' : 'Хадгалах');
  done.addEventListener('click', () => ui.closeModal());
  el.append(done);
  // bring the camera close to the little avatar while dressing up
  const p = av.position.clone();
  void g.cinematic(p.clone().add(new THREE.Vector3(0, 0.8, 0)), p.clone().add(new THREE.Vector3(2.6, 2.0, 3.4)), 1.2);
  av.face(p.clone().add(new THREE.Vector3(3, 0, 4)));
  setTimeout(() => av.wave(), 900);
  ui.openModal(el, {
    className: 'modal-avatar',
    closable: !first,
    onClose: () => {
      look.name = name.value.trim();
      g.s.avatar = look;
      av.setLook(look);
      g.save();
      g.refreshHUD();
      av.cheer();
      void g.c.focusRoom(g.focus);
      onDone?.();
    },
  });
}
