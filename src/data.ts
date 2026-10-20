export type Rarity = 'common' | 'rare' | 'legendary';
export type Shape =
  | 'sock' | 'box' | 'key' | 'duck' | 'chip' | 'dust'
  | 'mushroom' | 'cloud' | 'meteor' | 'cactus'
  | 'hourglass' | 'crown' | 'tesseract';

export interface RewardDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  shape: Shape;
  color: string;
}

export const REWARDS: RewardDef[] = [
  { id: 'sock', name: 'Ганцаардсан оймс', desc: 'Хос нь хаана байгааг хэн ч мэдэхгүй.', rarity: 'common', shape: 'sock', color: '#ff8fb1' },
  { id: 'pizza', name: 'Хоосон пиццаны хайрцаг', desc: 'Өмнөх эзэн нь бүгдийг нь идчихсэн.', rarity: 'common', shape: 'box', color: '#f2b56b' },
  { id: 'key', name: 'Юу ч онгойлгодоггүй түлхүүр', desc: 'Гэхдээ үнэхээр гоё гялалзаж байна.', rarity: 'common', shape: 'key', color: '#ffd36b' },
  { id: 'duck', name: 'Резинэн нугас', desc: 'Код debug хийхэд хамгийн найдвартай туслах.', rarity: 'common', shape: 'duck', color: '#ffe066' },
  { id: 'chip', name: 'Хамгийн сүүлчийн чипс', desc: 'Хэн ч идэж зүрхлээгүй.', rarity: 'common', shape: 'chip', color: '#f6c453' },
  { id: 'dust', name: 'Premium тоос', desc: 'Ширээн доороос олдсон. Limited edition.', rarity: 'common', shape: 'dust', color: '#b9b3d6' },
  { id: 'mushroom', name: 'Гэрэлтдэг мөөг', desc: 'Шөнө ном уншихад яг тохиромжтой.', rarity: 'rare', shape: 'mushroom', color: '#7cf0d0' },
  { id: 'cloud', name: 'Халаасны үүл', desc: 'Хааяа жижигхэн бороо оруулдаг.', rarity: 'rare', shape: 'cloud', color: '#9cc8ff' },
  { id: 'meteor', name: 'Жижигхэн солир', desc: 'Цонхоор унаж орж ирсэн. Одоо ч халуун.', rarity: 'rare', shape: 'meteor', color: '#ff9a5c' },
  { id: 'cactus', name: 'Дуулдаг кактус', desc: 'Ганцхан дуу мэддэг. Түүнийгээ л байнга дуулна.', rarity: 'rare', shape: 'cactus', color: '#7ed957' },
  { id: 'hourglass', name: 'Цаг хугацааны элс', desc: 'Хөмрөхөд өчигдөр болчихдог.', rarity: 'legendary', shape: 'hourglass', color: '#ffcf5c' },
  { id: 'crown', name: 'Жижиг ертөнцийн титэм', desc: 'Энэ өрөөний албан ёсны эзэн гэдгийн баталгаа.', rarity: 'legendary', shape: 'crown', color: '#ffd700' },
  { id: 'tesseract', name: 'Тессеракт', desc: '4 хэмжээст шоо. Удаан ширтвэл толгой эргэнэ.', rarity: 'legendary', shape: 'tesseract', color: '#7df9ff' },
];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Энгийн',
  rare: 'Ховор',
  legendary: 'Домогт',
};

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  secret?: boolean;
}

/** Every achievement is earned by *doing* something — solving, remembering,
 *  noticing, finishing — never by clicking the same object N times. */
export const ACHIEVEMENTS: AchievementDef[] = [
  // story
  { id: 'hello', title: 'Hello, World', desc: 'Анхны объект дээрээ дарлаа.' },
  { id: 'nothing', title: 'Absolutely Nothing', desc: 'Сэжигтэй хайрцгийг онгойлголоо.' },
  { id: 'detective', title: 'Professional Detective', desc: 'Нуугдаж байсан Мочиг барьлаа.' },
  { id: 'arcade', title: 'Arcade Legend', desc: 'Star Catcher тоглоомд яллаа.' },
  { id: 'door', title: 'The Impossible Door', desc: 'Номын тавиурын цаад нууц өрөөг нээлээ.' },
  { id: 'explorer', title: 'Little World Explorer', desc: 'Эхний 5 түвшнийг давлаа.' },
  // challenges (visible goals)
  { id: 'flawless', title: 'Flawless', desc: 'Өргөтгөсөн түвшнийг ганц ч алдаагүй давлаа.' },
  { id: 'riddler', title: 'Riddle Master', desc: '8 оньсогыг эхний оролдлогоор зөв таалаа.' },
  { id: 'memory', title: 'Elephant Memory', desc: '7 ба түүнээс урт дарааллыг алдаагүй давтлаа.' },
  { id: 'mathwiz', title: 'Human Calculator', desc: 'Хугацаатай 6 бодлогыг зөв бодлоо.' },
  { id: 'deep', title: 'Deep Explorer', desc: '8-р түвшинд хүрлээ.' },
  { id: 'master', title: 'Little World Master', desc: 'Бүх 12 түвшнийг давлаа.' },
  // secret
  { id: 'dark', title: 'Not Afraid of the Dark', desc: 'Гэрэл унтарсан үед компьютер дээр дарлаа.', secret: true },
  { id: 'stargazer', title: 'Stargazer', desc: 'Солирын бороо орж байх яг тэр мөчид цонхоор харлаа.', secret: true },
  { id: 'fourth', title: 'The Fourth Dimension', desc: 'Тессерактад хүрлээ.', secret: true },
  { id: 'glitch', title: 'Reality Glitch', desc: 'Таталцал алга болох үед хөвж буй юманд хүрлээ.', secret: true },
  { id: 'hacker', title: 'Hacker Voice: "I\'m in"', desc: 'Терминалд нууц команд олсон.', secret: true },
  { id: 'lucky', title: 'Legendary Owner', desc: 'Домогт шагнал авлаа.', secret: true },
  { id: 'hoarder', title: 'Hoarder', desc: '10 төрлийн цуглуулга цуглууллаа.', secret: true },
  { id: 'curator', title: 'Clicked Everything', desc: 'Өрөөн дэх бүх объект (шинээр гарч ирсэн ч гэсэн) дээр дарлаа.', secret: true },
  { id: 'speedrun', title: 'Speed Detective', desc: 'Эхний 5 түвшнийг 8 минутад багтааж давлаа.', secret: true },
  { id: 'blitz', title: 'Blitz', desc: 'Өргөтгөсөн түвшнийг 2 минут хүрэхгүй хугацаанд давлаа.', secret: true },
  { id: 'comeback', title: 'Never Give Up', desc: '3+ алдаа гаргасан ч бууж өгөөгүй, түвшнээ давлаа.', secret: true },
];

/** Cryptic nudges toward undiscovered secret achievements (surfaced via the
 *  hint button). Never names the exact object — that's left to the player. */
export const SECRET_CLUES: Record<string, string> = {
  dark: 'Гэрэл бүгд унтарсан үед ч ажилласаар байдаг нэг зүйл бий. Зоригтой бол ойрт.',
  stargazer: 'Тэнгэр өөрөө бороо оруулж эхлэх тэр мөчид цонхоор хар.',
  fourth: 'Нууц өрөөнд энгийн биш хэлбэртэй зүйл эргэлддэг. Хүрч үз.',
  glitch: 'Заримдаа энэ өрөөнд таталцал ажиллахаа больдог. Тэр мөчид хөвж буй зүйлд хүр.',
  hacker: 'Терминал зөвхөн нууц үг хүлээдэггүй. Нэг тусгай тушаал эрх олгоно гэж амладаг.',
  lucky: 'Домогт зүйлс азаар биш — тодорхой гавьяагаар л ирдэг.',
  hoarder: 'Цуглуулгынхаа олон янз байдлыг шалга — тоо биш, төрөл чухал.',
  curator: 'Өрөөнд — шинээр гарч ирсэн хэсгүүдэд ч — чиний дараагүй зүйл үлдэж болохгүй.',
  speedrun: 'Эхний таван түвшнийг удаан бодохгүй, шулуухан дав.',
  blitz: 'Өргөтгөсөн түвшнүүдийн нэгийг маш хурдан давж үз.',
  comeback: 'Олон удаа алдсан ч бууж өгөхгүй бол...',
};

export interface LevelDef {
  code: string;
  name: string;
  tag: 'Easy' | 'Medium' | 'Timed' | 'Twist' | 'Finale' | 'Hard' | 'Expert' | 'Master';
}

/** 12 user-facing levels. Stages 0-5 are the hand-built story (stages 4 and 5
 *  both belong to Level 05); stages 6-12 are the extended levels 06-12, and
 *  stage 13 (FINAL_STAGE) means everything is done. */
export const LEVELS: LevelDef[] = [
  { code: '01', name: "The Beginner's Room", tag: 'Easy' },
  { code: '02', name: 'The Messy Detective', tag: 'Medium' },
  { code: '03', name: 'The 30-Second Panic', tag: 'Timed' },
  { code: '04', name: 'The Room Is Lying', tag: 'Twist' },
  { code: '05', name: 'The Final Secret', tag: 'Finale' },
  { code: '06', name: 'The Annex', tag: 'Hard' },
  { code: '07', name: 'Locked Thoughts', tag: 'Hard' },
  { code: '08', name: 'The Wide Universe', tag: 'Hard' },
  { code: '09', name: 'The Labyrinth', tag: 'Expert' },
  { code: '10', name: 'Folded Dimensions', tag: 'Expert' },
  { code: '11', name: 'Pure Imagination', tag: 'Master' },
  { code: '12', name: 'Interstellar', tag: 'Master' },
];

export interface ExtLevel {
  /** English password, built from letters hidden behind challenges. */
  word: string;
  title: string;
  /** Mongolian meaning clue — the letters arrive scrambled, so this is what
   *  tells the player which word to build from them. */
  clue: string;
  /** New interactive objects that appear in the (growing) room this level. */
  props: number;
}

/** Each level: longer word, more new objects, harder challenges. */
export const EXT_LEVELS: ExtLevel[] = [
  { word: 'SECRET', title: 'Шинэ хэсэг', clue: 'Хэнд ч хэлдэггүй, нуугдмал зүйл', props: 2 },
  { word: 'MYSTERY', title: 'Түгжээтэй бодлууд', clue: 'Учир нь тайлагдаагүй, битүүлэг оньсого', props: 2 },
  { word: 'UNIVERSE', title: 'Өргөн орчлон', clue: 'Бүх од, гараг, хоосон орон зайг багтаасан бүхэл', props: 3 },
  { word: 'LABYRINTH', title: 'Төөрдөг байшин', clue: 'Гарц нь олдохгүй ороомог замууд', props: 3 },
  { word: 'DIMENSIONS', title: 'Эвхэгдсэн хэмжээсүүд', clue: 'Урт, өргөн, өндөр... тэгээд дөрөв дэх нь', props: 3 },
  { word: 'IMAGINATION', title: 'Цэвэр төсөөлөл', clue: 'Зөвхөн толгой дотор оршдог хязгааргүй ертөнц', props: 4 },
  { word: 'INTERSTELLAR', title: 'Оддын хооронд', clue: 'Нэг одноос нөгөө од руу хийх аялал', props: 4 },
];

export const EXT_START = 6;
export const FINAL_STAGE = EXT_START + EXT_LEVELS.length;
export const propStart = (k: number) => EXT_LEVELS.slice(0, k).reduce((s, l) => s + l.props, 0);
export const isExtStage = (stage: number) => stage >= EXT_START && stage < FINAL_STAGE;

const STAGE_TO_LEVEL = [0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 11];
export const stageToLevel = (stage: number) => STAGE_TO_LEVEL[Math.min(stage, STAGE_TO_LEVEL.length - 1)];

export const TITLE_PREFIX = ['Мэргэжлийн', 'Нууцлаг', 'Албан ёсны', 'Дэлхийд алдартай', 'Шөнийн', 'Гайхамшигт', 'Жаахан сэжигтэй', 'Хагас цагийн'];
export const TITLE_NOUN = ['хайрцаг онгойлгогч', 'оймс цуглуулагч', 'оньсого тайлагч', 'ургамлын найз', 'мөрдөгч', 'од ширтэгч', 'цаг аялагч', 'чипс хамгаалагч', 'ном үнэрлэгч'];

export const WORDS = ['OPEN', 'PLAY', 'WORLD'] as const;

/** Which object hides which letter during the story stages 0-1. */
export const LETTER_SOURCES: Record<number, Record<string, string>> = {
  0: { rug: 'O', plant: 'P', clock: 'E', lamp: 'N' },
  1: { box: 'P', bookshelf: 'L', window: 'A', creature: 'Y' },
};

export const GLYPH_ORDER = ['★', '▲', '●', '■'];
export const GLYPH_WALL = ['▲', '●', '★', '■'];

export const QUESTS: { title: string; sub: string }[] = [
  { title: 'Нууц үг №1', sub: 'Өрөөнд нуугдсан 4 үсгийг ол' },
  { title: 'Нууц үг №2', sub: 'Дахиад 4 үсэг нуугдаж байна' },
  { title: 'Аркад', sub: 'Star Catcher тоглоомд ял' },
  { title: 'Боломжгүй хаалга', sub: 'Хананы тэмдгүүдийг зөв дарааллаар дар' },
  { title: 'Сүүлчийн нууц үг', sub: 'Нууц өрөөний шоонуудаас үг бүтээ' },
  { title: 'Little World нээгдлээ', sub: 'Өрөө томрох гэж байна...' },
];

export interface Riddle {
  q: string;
  /** options[a] is the correct one. */
  options: string[];
  a: number;
  /** 1 = easy, 3 = hard. Higher levels draw harder riddles. */
  diff: 1 | 2 | 3;
}

/** Mix of logic riddles and questions only an attentive player can answer
 *  from what happened in the room earlier — rewards actually paying attention. */
export const RIDDLES: Riddle[] = [
  { q: 'Сэжигтэй хайрцгийг нээсэн нууц үг юу байсан бэ?', options: ['OPEN', 'PLAY', 'BOX', 'WORLD'], a: 0, diff: 1 },
  { q: 'Аркад машин дахь тоглоомын нэр юу вэ?', options: ['Star Catcher', 'Space Invaders', 'Moon Runner', 'Bug Hunter'], a: 0, diff: 1 },
  { q: 'Мочи хаана нуугдаж амьдардаг байсан бэ?', options: ['Номын тавиурын ард', 'Хивсний доор', 'Хайрцаг дотор', 'Цонхны гадаа'], a: 0, diff: 1 },
  { q: 'Нууц өрөөний шоонууд ямар үг бүтээсэн бэ?', options: ['WORLD', 'LITTLE', 'MOCHI', 'SPACE'], a: 0, diff: 1 },
  { q: 'Тессеракт хэдэн хэмжээст шоо вэ?', options: ['4', '3', '5', '2'], a: 0, diff: 1 },
  { q: 'Аль нь илүүц вэ?', options: ['Ширээ', 'Нар', 'Сар', 'Од'], a: 0, diff: 1 },
  { q: '2, 4, 8, 16, … дараагийн тоо?', options: ['32', '24', '20', '18'], a: 0, diff: 1 },
  { q: 'Аль нь хүнд вэ: 1 кг төмөр, 1 кг өд, 1 кг ус?', options: ['Бүгд адилхан', 'Төмөр', 'Ус', 'Өд'], a: 0, diff: 1 },
  { q: '"TAC" гэдгийг урвуулж уншвал ямар амьтан гарах вэ?', options: ['CAT', 'DOG', 'BAT', 'RAT'], a: 0, diff: 1 },
  { q: 'Аль нь сондгой тоо вэ?', options: ['21', '12', '18', '30'], a: 0, diff: 1 },
  { q: 'ABC, BCD, CDE, … дараагийнх?', options: ['DEF', 'EFG', 'CEF', 'DEG'], a: 0, diff: 1 },

  { q: 'Кофены аяга хэдэн оноос хойш хүйтэн хэвээр байгаа вэ?', options: ['2019', '2020', '2015', '2023'], a: 0, diff: 2 },
  { q: 'Постер дээр ямар өгүүлбэр бичигдсэн бэ?', options: ['Nothing is what it seems', 'Stay curious', 'Hello World', 'Keep exploring'], a: 0, diff: 2 },
  { q: 'Ханан дээрх тэмдгүүдийг ямар дарааллаар дарж хаалга нээсэн бэ?', options: ['★ ▲ ● ■', '▲ ● ★ ■', '■ ● ▲ ★', '● ★ ■ ▲'], a: 0, diff: 2 },
  { q: 'Star Catcher-т (энгийн горимд) хэдэн од барьж ялдаг вэ?', options: ['12', '10', '15', '20'], a: 0, diff: 2 },
  { q: 'Неон үүл юу "оруулдаг" гэж бичсэн байсан бэ?', options: ['Зөвхөн vibe', 'Бороо', 'Цас', 'Солонго'], a: 0, diff: 2 },
  { q: '1, 1, 2, 3, 5, 8, … дараагийн тоо?', options: ['13', '11', '12', '16'], a: 0, diff: 2 },
  { q: 'Хэдий чинээ их авна, төдий чинээ их ардаа үлдээдэг юу вэ?', options: ['Алхам (мөр)', 'Мөнгө', 'Ус', 'Цаг'], a: 0, diff: 2 },
  { q: 'Нүдгүй ч уйлдаг, далавчгүй ч нисдэг юу вэ?', options: ['Үүл', 'Шувуу', 'Салхи', 'Бороо'], a: 0, diff: 2 },
  { q: 'Өглөө 4 хөлтэй, өдөр 2 хөлтэй, орой 3 хөлтэй юу вэ?', options: ['Хүн', 'Муур', 'Ширээ', 'Шавж'], a: 0, diff: 2 },
  { q: 'Цагийн зүү 3:00 цагт ямар өнцөг үүсгэх вэ?', options: ['90°', '45°', '180°', '120°'], a: 0, diff: 2 },
  { q: '3, 9, 27, … дараагийн тоо?', options: ['81', '54', '36', '72'], a: 0, diff: 2 },
  { q: 'Аль нь гараг биш вэ?', options: ['Сар', 'Ангараг', 'Бархасбадь', 'Сугар'], a: 0, diff: 2 },

  { q: 'Чамд 3 алим байсан. Тэдгээрээс 2-ыг нь чи авлаа. Одоо чамд хэдэн алим байна?', options: ['2', '1', '3', '0'], a: 0, diff: 3 },
  { q: '5 машин 5 минутад 5 эд зүйл хийдэг. 100 машин 100 эд зүйлийг хэдэн минутад хийх вэ?', options: ['5', '100', '20', '50'], a: 0, diff: 3 },
  { q: 'Харанхуй өрөөнд лаа, дэнлүү, зуух бий. Ганц шүдэнз байна. Юуг хамгийн түрүүнд асаах вэ?', options: ['Шүдэнзээ', 'Лаа', 'Дэнлүү', 'Зуух'], a: 0, diff: 3 },
  { q: 'Жилийн хэдэн сар 28 хоногтой вэ?', options: ['Бүх 12 сар', '1', '2', '4'], a: 0, diff: 3 },
  { q: 'Аавын хүү, гэхдээ миний ах ч биш, дүү ч биш. Хэн бэ?', options: ['Би өөрөө', 'Авга ах', 'Үеэл', 'Өвөө'], a: 0, diff: 3 },
  { q: 'Нэрийг нь хэлмэгц эвдэрдэг зүйл юу вэ?', options: ['Чимээгүй байдал', 'Шил', 'Мөс', 'Аяга'], a: 0, diff: 3 },
  { q: 'Бүх Блорп нь Зинг, бүх Зинг нь Тав. Тэгвэл бүх Блорп нь…', options: ['Тав', 'Тав биш', 'Зинг биш', 'Мэдэгдэхгүй'], a: 0, diff: 3 },
  { q: 'Нэг хоногт (24 цаг) цагны том, бага зүү хэдэн удаа давхцдаг вэ?', options: ['22', '24', '12', '23'], a: 0, diff: 3 },
  { q: 'Хивсний доороос анх ямар үсэг олдсон бэ?', options: ['O', 'P', 'E', 'N'], a: 0, diff: 3 },
  { q: 'Номын тавиураас ямар үсэг унаж ирсэн бэ?', options: ['L', 'A', 'Y', 'P'], a: 0, diff: 3 },
  { q: 'Мочиг барихад ямар үсэг гарч ирсэн бэ?', options: ['Y', 'L', 'A', 'P'], a: 0, diff: 3 },
];

/** Level 01's plant letter: you have to understand what the plant wants, not spam it. */
export const PLANT_RIDDLE: Riddle = {
  q: 'Ургамал чамаас юуг хамгийн их хүсэж байгаа юм бэ? (Сэжүүрээ сана)',
  options: ['Анхаарал — ярилцаж өгөх', 'Илүү их ус', 'Харанхуй', 'Хайч'],
  a: 0,
  diff: 1,
};

export const HINTS: string[][] = [
  [
    'Өрөөнд 4 үсэг нуугдсан. Бүх зүйл дээр дараад үз — тэр дундаа шал руу.',
    'Ургамал анхаарал их хүсдэг. Түүн дээр дарж, юу хүсэж байгааг нь зөв сонго.',
    'Хивс, ургамал, цаг, чийдэн... 4 үсгээ олоод ширээн дээрх компьютерт нууц үгээ бич.',
  ],
  [
    'Хайрцаг хоосон гэж хэн хэлсэн бэ? Дахиад нэг шалга.',
    'Шөнийн тэнгэр рүү цонхоор хар. Номын тавиурыг бас шалга.',
    'Улаан ном жаахан цухуйчихсан байна... Тавиурын ард хэн нэгэн амьдардаг. Түүнийг барь!',
    '4 үсгээ олсны дараа нууц үгээ аркад машин дээр оруул.',
  ],
  ['Аркад машин асчихлаа! Дээр нь дараад тогло. 12 од барих хэрэгтэй.'],
  [
    'Аркадын HI-SCORE дэлгэц дээр хачин тэмдгүүд гарсан...',
    'Зүүн хананы 4 тэмдгийг ★ ▲ ● ■ дарааллаар дар.',
  ],
  [
    'Нууц өрөөнд үсэгтэй шоонууд хөвж байна.',
    'Тоглоомын нэрийг санаарай: Little _ _ _ _ _',
  ],
  ['Эхний 5 түвшин дууслаа! Өрөө томорч, шинэ түвшнүүд эхлэх гэж байна...'],
  [
    'Өрөө томорч шинэ объектууд гарч ирлээ. Гэрэлтэх цэгтэй объект дээр дарж сорилтыг дав.',
    'Зарим үсэг хуучин объектуудад ч нуугдсан — тэдэнд тэмдэг байхгүй. Өрөөг бүхэлд нь дахин шалга.',
    'Буруу хариулбал объект хэсэг хугацаанд түгжигдэнэ. Яарахгүй, сайн бод.',
    'Үсгүүд холилдсон дарааллаар гарна. Сэжүүрийн утгыг ашиглан англи үгээ бүтээгээд компьютер дээр бич.',
    'Компьютерт буруу үг бичихэд хэдэн үсэг зөв байрлалтай байгааг хэлж өгнө — гэхдээ энэ нь алдаанд тооцогдоно.',
  ],
  ['Чи бүх 12 түвшнийг давлаа! Нууц амжилтуудаа бүгдийг нь цуглуулсан уу? Бүгдийг олбол Хэцүү горим нээгдэнэ.'],
];

export type CardColor = 'yellow' | 'pink' | 'green' | 'blue' | 'dark';

export const OBJECTS: Record<string, { name: string; color: CardColor; icon: string }> = {
  box: { name: 'Сэжигтэй хайрцаг', color: 'yellow', icon: 'box' },
  computer: { name: 'Компьютер', color: 'dark', icon: 'monitor' },
  arcade: { name: 'Аркад машин', color: 'blue', icon: 'gamepad' },
  bookshelf: { name: 'Номын тавиур', color: 'dark', icon: 'book' },
  redbook: { name: 'Улаан ном', color: 'pink', icon: 'book' },
  plant: { name: 'Ургамал', color: 'green', icon: 'plant' },
  clock: { name: 'Ханын цаг', color: 'pink', icon: 'clock' },
  lamp: { name: 'Шалны чийдэн', color: 'yellow', icon: 'lamp' },
  rug: { name: 'Хивс', color: 'pink', icon: 'rug' },
  window: { name: 'Цонх', color: 'yellow', icon: 'window' },
  beanbag: { name: 'Зөөлөн суудал', color: 'green', icon: 'chair' },
  poster: { name: 'Постер', color: 'dark', icon: 'image' },
  neon: { name: 'Неон үүл', color: 'blue', icon: 'cloud' },
  mug: { name: 'Кофены аяга', color: 'pink', icon: 'mug' },
  creature: { name: 'Мочи', color: 'pink', icon: 'ghost' },
  glyph: { name: 'Хачин тэмдэг', color: 'dark', icon: 'star' },
  cube: { name: 'Үсэгтэй шоо', color: 'blue', icon: 'cube' },
  tesseract: { name: 'Тессеракт', color: 'blue', icon: 'cube' },
  // objects that appear as the room grows
  crate: { name: 'Модон авдар', color: 'yellow', icon: 'box' },
  lantern: { name: 'Гэрэлт дэнлүү', color: 'yellow', icon: 'lamp' },
  crystal: { name: 'Болор чулуу', color: 'blue', icon: 'star' },
  statue: { name: 'Хачин хөшөө', color: 'dark', icon: 'star' },
  chest: { name: 'Эрдэнэсийн авдар', color: 'yellow', icon: 'box' },
  orb: { name: 'Ид шидийн бөмбөлөг', color: 'blue', icon: 'sparkle' },
  tree: { name: 'Жижиг мод', color: 'green', icon: 'plant' },
};
