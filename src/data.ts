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

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'hello', title: 'Hello, World', desc: 'Анхны объект дээрээ дарлаа.' },
  { id: 'nothing', title: 'Absolutely Nothing', desc: 'Сэжигтэй хайрцгийг онгойлголоо.' },
  { id: 'detective', title: 'Professional Detective — Lv.1', desc: 'Нуугдаж байсан Мочиг барьлаа.' },
  { id: 'arcade', title: 'Arcade Legend', desc: 'Star Catcher тоглоомд яллаа.' },
  { id: 'door', title: 'The Impossible Door', desc: 'Номын тавиурын цаад нууц өрөөг нээлээ.' },
  { id: 'explorer', title: 'Little World Explorer', desc: 'Бүх үндсэн тааврыг тайллаа.' },
  { id: 'party', title: 'Party of One', desc: 'Чийдэнг маш хурдан дарж диско асаалаа.', secret: true },
  { id: 'overwatered', title: 'Over-Watered', desc: 'Ургамлыг хэтэрхий их анхаарал халамжаар дарлаа.', secret: true },
  { id: 'timetraveler', title: 'Time Traveler', desc: 'Цагийг ухрааж эргүүллээ.', secret: true },
  { id: 'dark', title: 'Not Afraid of the Dark', desc: 'Гэрэл унтарсан үед компьютер дээр дарлаа.', secret: true },
  { id: 'sitter', title: 'Professional Sitter', desc: 'Зөөлөн суудал дээр 10 удаа суулаа.', secret: true },
  { id: 'stargazer', title: 'Stargazer', desc: 'Солирын бороог 3 удаа үзлээ.', secret: true },
  { id: 'fourth', title: 'The Fourth Dimension', desc: 'Тессерактад хүрлээ.', secret: true },
  { id: 'glitch', title: 'Reality Glitch', desc: 'Таталцал алга болох үед хөвж буй юманд хүрлээ.', secret: true },
  { id: 'designer', title: 'Interior Designer', desc: 'Постерыг 6 удаа "засаж" өгсөн.', secret: true },
  { id: 'coffee', title: 'Cold Brew', desc: '2019 оны кофег 3 удаа шалгалаа.', secret: true },
  { id: 'hacker', title: 'Hacker Voice: "I\'m in"', desc: 'Терминалд нууц команд олсон.', secret: true },
  { id: 'lucky', title: 'Suspiciously Lucky', desc: 'Домогт шагнал авлаа.', secret: true },
  { id: 'hoarder', title: 'Hoarder', desc: '10 төрлийн цуглуулга цуглууллаа.', secret: true },
  { id: 'curator', title: 'Clicked Everything', desc: 'Өрөөн дэх бүх объект дээр дор хаяж нэг удаа дарлаа.', secret: true },
  { id: 'curious', title: 'Too Curious', desc: 'Нийтдээ 150 удаа дарлаа. Тайвшир — энэ ердөө нэг өрөө шүү.', secret: true },
  { id: 'speedrun', title: 'Speed Detective', desc: 'Бүх үндсэн таавраа 6 минутын дотор тайлчихлаа.', secret: true },
];

export interface LevelDef {
  code: string;
  name: string;
  tag: 'Easy' | 'Medium' | 'Timed' | 'Twist' | 'Finale';
  reward: string;
}

/** Display metadata for the 5 user-facing "levels". Internally the game still
 *  tracks 6 numeric stages (0-5) — stages 4 and 5 both belong to Level 05,
 *  since the cube word-puzzle and the finale are one continuous beat. Use
 *  `stageToLevel()` to go from a stage number to an index into this array. */
export const LEVELS: LevelDef[] = [
  { code: '01', name: "The Beginner's Room", tag: 'Easy', reward: 'Сэжигтэй хайрцаг нээгдэж, дотроос нэг жижиг бэлэг гарч ирлээ.' },
  { code: '02', name: 'The Messy Detective', tag: 'Medium', reward: 'Өрөөнд шинэ дүр илэрлээ — одоо Мочиг барих ёстой боллоо.' },
  { code: '03', name: 'The 30-Second Panic', tag: 'Timed', reward: '' },
  { code: '04', name: 'The Room Is Lying', tag: 'Twist', reward: 'Зөв дарааллыг олж, нууц өрөөний хаалгыг нээлээ.' },
  { code: '05', name: 'The Final Secret', tag: 'Finale', reward: 'Жижиг ертөнцийн нууц төгсгөл нээгдлээ.' },
];

export const stageToLevel = (stage: number) => Math.min(stage, LEVELS.length - 1);

export const TITLE_PREFIX = ['Мэргэжлийн', 'Нууцлаг', 'Албан ёсны', 'Дэлхийд алдартай', 'Шөнийн', 'Гайхамшигт', 'Жаахан сэжигтэй', 'Хагас цагийн'];
export const TITLE_NOUN = ['хайрцаг онгойлгогч', 'оймс цуглуулагч', 'товчлуур дарагч', 'ургамал усалгаач', 'мөрдөгч', 'од ширтэгч', 'цаг аялагч', 'чипс хамгаалагч', 'ном үнэрлэгч'];

export const WORDS = ['OPEN', 'PLAY', 'WORLD'] as const;

/** Which object hides which letter during each stage. */
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
  { title: 'Little World нээгдлээ', sub: 'Нууц амжилтуудыг бүгдийг нь олох уу?' },
];

export const HINTS: string[][] = [
  [
    'Өрөөнд 4 үсэг нуугдсан. Бүх зүйл дээр дараад үз — тэр дундаа шал руу.',
    'Ургамал анхаарал их хүсдэг. Хэд хэдэн удаа дар.',
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
  ['Чи бүх үндсэн тааврыг тайлсан! Харин 13 нууц амжилт бий... Бүгдийг нь олсон уу?'],
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
};
