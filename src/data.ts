// ===================================================================== house
/** Every room of the little house, in story order. The garden is the space
 *  around the house — always open, it holds the daily things (mailbox, tree). */
export type RoomId = 'bedroom' | 'study' | 'living' | 'kitchen' | 'bath' | 'observatory';
export type ZoneId = RoomId | 'garden';

export interface RoomDef {
  id: RoomId;
  name: string;
  /** Chapter title shown in the quest panel. */
  chapter: string;
  tag: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master' | 'Finale';
  icon: string;
  /** Floor rectangle [x0, x1, z0, z1]. The observatory's is the square around its round floor. */
  bounds: [number, number, number, number];
  /** Floor height (the observatory floats a little higher than the house). */
  floorY: number;
  /** Default wall paint (always owned). */
  paint: PaintId;
  /** One-liner shown on the locked fog and the room picker. */
  teaser: string;
}

export const ROOMS: RoomDef[] = [
  { id: 'bedroom', name: 'Унтлагын өрөө', chapter: 'Өглөөний мэнд', tag: 'Easy', icon: 'bed', bounds: [-5.3, 5, 5, 13.5], floorY: 0, paint: 'sakura', teaser: 'Бүх зүйл эндээс эхэлнэ.' },
  { id: 'study', name: 'Ажлын өрөө', chapter: 'Жижиг өрөө, том нууц', tag: 'Medium', icon: 'monitor', bounds: [-5.3, 5, -5.3, 5], floorY: 0, paint: 'violet', teaser: 'Хаалганы цаанаас аркадын дуу сонсогдоно...' },
  { id: 'living', name: 'Зочны өрөө', chapter: 'Гал голомт', tag: 'Hard', icon: 'sofa', bounds: [5, 16.3, -5.3, 5], floorY: 0, paint: 'cream', teaser: 'Задгай зуух хэзээ ч асаж байгаагүй гэнэ.' },
  { id: 'kitchen', name: 'Гал тогоо', chapter: 'Мочигийн нууц жор', tag: 'Hard', icon: 'pot', bounds: [5, 11, 5, 13.5], floorY: 0, paint: 'mint', teaser: 'Хаанаас ч юм бины үнэр ханхална.' },
  { id: 'bath', name: 'Угаалгын өрөө', chapter: 'Толины цаана', tag: 'Expert', icon: 'drop', bounds: [11, 16.3, 5, 13.5], floorY: 0, paint: 'ocean', teaser: 'Толинд хэн нэгэн бичиг үлдээжээ.' },
  { id: 'observatory', name: 'Оддын цамхаг', chapter: 'Оддын хооронд', tag: 'Finale', icon: 'telescope', bounds: [22.2, 31.8, -8.3, 1.3], floorY: 1.6, paint: 'galaxy', teaser: 'Тусдаа арал дээр хөвж буй цамхаг.' },
];

export const roomDef = (id: RoomId) => ROOMS.find((r) => r.id === id)!;
export const ROOM_ORDER: RoomId[] = ROOMS.map((r) => r.id);

/** Doors between rooms: which wall they sit in and which room they lead to. */
export interface DoorDef {
  id: string;
  from: RoomId;
  to: RoomId;
  /** 'x' = wall at x = at (spanning z); 'z' = wall at z = at (spanning x). */
  axis: 'x' | 'z';
  at: number;
  /** Opening along the wall: [a, b]. */
  span: [number, number];
}

export const DOORS: DoorDef[] = [
  { id: 'door-study', from: 'bedroom', to: 'study', axis: 'z', at: 5, span: [0.6, 2.1] },
  { id: 'door-living', from: 'study', to: 'living', axis: 'x', at: 5, span: [1.9, 3.4] },
  { id: 'door-kitchen', from: 'living', to: 'kitchen', axis: 'z', at: 5, span: [7.2, 8.7] },
  { id: 'door-bath', from: 'kitchen', to: 'bath', axis: 'x', at: 11, span: [8.6, 10.1] },
];

// ===================================================================== paint
export type PaintId = 'violet' | 'sakura' | 'cream' | 'mint' | 'ocean' | 'galaxy' | 'sunset' | 'forest' | 'peach' | 'midnight';

export interface PaintDef {
  name: string;
  wall: string;
  wallLow: string;
  price: number;
}

export const PAINTS: Record<PaintId, PaintDef> = {
  violet: { name: 'Нил ягаан', wall: '#4d3c83', wallLow: '#3a2d68', price: 0 },
  sakura: { name: 'Сакура', wall: '#8a5878', wallLow: '#6a3f5c', price: 0 },
  cream: { name: 'Цөцгий', wall: '#8a6f5a', wallLow: '#6a5243', price: 0 },
  mint: { name: 'Гаа', wall: '#2f6b5e', wallLow: '#234f46', price: 0 },
  ocean: { name: 'Далай', wall: '#2d5a80', wallLow: '#21425f', price: 0 },
  galaxy: { name: 'Галактик', wall: '#2a1f55', wallLow: '#1c1540', price: 0 },
  sunset: { name: 'Нар жаргах', wall: '#7a3a4d', wallLow: '#5c2a3a', price: 180 },
  forest: { name: 'Ой', wall: '#3d5a3a', wallLow: '#2c4229', price: 180 },
  peach: { name: 'Тоор', wall: '#a0615a', wallLow: '#7c4842', price: 240 },
  midnight: { name: 'Шөнө дунд', wall: '#1f2a4a', wallLow: '#151d36', price: 240 },
};

// ===================================================================== collection
export type Rarity = 'common' | 'rare' | 'legendary';
export type Shape =
  | 'sock' | 'box' | 'key' | 'duck' | 'chip' | 'dust'
  | 'mushroom' | 'cloud' | 'meteor' | 'cactus'
  | 'hourglass' | 'crown' | 'tesseract'
  | 'teddy' | 'jar' | 'remote' | 'vinyl' | 'cookie' | 'egg' | 'spoon'
  | 'soap' | 'shell' | 'bubble' | 'compass' | 'map' | 'star';

export interface RewardDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  shape: Shape;
  color: string;
  /** Which room's set the item belongs to ('legend' = the three legendaries). */
  set: RoomId | 'legend';
  /** 'find' = hidden in an object you have to keep poking; 'roll' = Mystery Generator; 'earn' = one specific deed. */
  src: 'find' | 'roll' | 'earn';
  /** Shown on the locked tile so every item is something you can actually go for. */
  how: string;
}

export const REWARDS: RewardDef[] = [
  // bedroom
  { id: 'sock', name: 'Ганцаардсан оймс', desc: 'Хос нь хаана байгааг хэн ч мэдэхгүй.', rarity: 'common', shape: 'sock', color: '#ff8fb1', set: 'bedroom', src: 'find', how: 'Унтлагын өрөөнд хөл тавьдаг зүйлийг шалга.' },
  { id: 'teddy', name: 'Хуучин баавгай', desc: 'Нэг нүд нь товч. Гэхдээ хамгийн үнэнч найз.', rarity: 'rare', shape: 'teddy', color: '#d9a066', set: 'bedroom', src: 'find', how: 'Тоглоомын хайрцгийг дахин дахин ухаад үз.' },
  { id: 'dust', name: 'Premium тоос', desc: 'Орны доороос олдсон. Limited edition.', rarity: 'common', shape: 'dust', color: '#b9b3d6', set: 'bedroom', src: 'roll', how: 'Mystery Generator-оос (унтлагын өрөө нээлттэй үед).' },
  { id: 'dreamjar', name: 'Зүүдний лонх', desc: 'Дотор нь өчигдрийн зүүд эргэлдэнэ.', rarity: 'rare', shape: 'jar', color: '#b388ff', set: 'bedroom', src: 'roll', how: 'Mystery Generator-оос (унтлагын өрөө нээлттэй үед).' },
  // study
  { id: 'chip', name: 'Хамгийн сүүлчийн чипс', desc: 'Хэн ч идэж зүрхлээгүй.', rarity: 'common', shape: 'chip', color: '#f6c453', set: 'study', src: 'find', how: 'Зөөлөн суудлын доор нэг юм шаржигнана...' },
  { id: 'key', name: 'Юу ч онгойлгодоггүй түлхүүр', desc: 'Гэхдээ үнэхээр гоё гялалзаж байна.', rarity: 'common', shape: 'key', color: '#ffd36b', set: 'study', src: 'find', how: 'Муруй постерыг төгс шулуун болго.' },
  { id: 'duck', name: 'Резинэн нугас', desc: 'Код debug хийхэд хамгийн найдвартай туслах.', rarity: 'common', shape: 'duck', color: '#ffe066', set: 'study', src: 'roll', how: 'Mystery Generator-оос (ажлын өрөө нээлттэй үед).' },
  { id: 'cactus', name: 'Дуулдаг кактус', desc: 'Ганцхан дуу мэддэг. Түүнийгээ л байнга дуулна.', rarity: 'rare', shape: 'cactus', color: '#7ed957', set: 'study', src: 'roll', how: 'Mystery Generator-оос (ажлын өрөө нээлттэй үед).' },
  // living
  { id: 'remote', name: 'Алга болсон пульт', desc: 'Буйдангийн хоёр дэрний завсар 3 жил амьдарсан.', rarity: 'common', shape: 'remote', color: '#8fa3c9', set: 'living', src: 'find', how: 'Буйдангийн дэрнүүдийн завсрыг шалга.' },
  { id: 'pizza', name: 'Хоосон пиццаны хайрцаг', desc: 'Өмнөх эзэн нь бүгдийг нь идчихсэн.', rarity: 'common', shape: 'box', color: '#f2b56b', set: 'living', src: 'find', how: 'Зочны өрөөний ширээн дээр юу байна?' },
  { id: 'vinyl', name: 'Алтан пянз', desc: 'Тоглуулахаар ганцхан "пиу" гэж дуугардаг.', rarity: 'rare', shape: 'vinyl', color: '#ffcf5c', set: 'living', src: 'roll', how: 'Mystery Generator-оос (зочны өрөө нээлттэй үед).' },
  { id: 'cloud', name: 'Халаасны үүл', desc: 'Хааяа жижигхэн бороо оруулдаг.', rarity: 'rare', shape: 'cloud', color: '#9cc8ff', set: 'living', src: 'roll', how: 'Mystery Generator-оос (зочны өрөө нээлттэй үед).' },
  // kitchen
  { id: 'cookie', name: 'Сүүлчийн жигнэмэг', desc: 'Лонхны ёроолд ганцаараа үлджээ.', rarity: 'common', shape: 'cookie', color: '#c98a4b', set: 'kitchen', src: 'find', how: 'Жигнэмэгний лонхонд гараа хий.' },
  { id: 'spoon', name: 'Мөнгөн халбага', desc: 'Угаалтуурт 2019 оноос хойш хүлээж байна.', rarity: 'common', shape: 'spoon', color: '#d6dbe6', set: 'kitchen', src: 'find', how: 'Угаалтуурыг хоёр удаа шалга.' },
  { id: 'goldegg', name: 'Алтан өндөг', desc: 'Хэн гаргасныг асуухгүй байх нь дээр.', rarity: 'rare', shape: 'egg', color: '#ffd36b', set: 'kitchen', src: 'roll', how: 'Mystery Generator-оос (гал тогоо нээлттэй үед).' },
  { id: 'mushroom', name: 'Гэрэлтдэг мөөг', desc: 'Шөнө ном уншихад яг тохиромжтой.', rarity: 'rare', shape: 'mushroom', color: '#7cf0d0', set: 'kitchen', src: 'roll', how: 'Mystery Generator-оос (гал тогоо нээлттэй үед).' },
  // bath
  { id: 'soap', name: 'Ид шидийн саван', desc: 'Хөөс нь солонгын өнгөтэй.', rarity: 'common', shape: 'soap', color: '#ff9ad5', set: 'bath', src: 'find', how: 'Угаалгын өрөөний угаалтуурыг шалга.' },
  { id: 'shell', name: 'Далайн хясаа', desc: 'Чихэндээ наавал далайн биш, Мочигийн дуу сонсогдоно.', rarity: 'common', shape: 'shell', color: '#ffc8a8', set: 'bath', src: 'find', how: 'Угаалгын хивсийг хоёр удаа сөх.' },
  { id: 'bubble', name: 'Хагардаггүй хөөс', desc: 'Гурван жил хөвж байгаа. Рекорд.', rarity: 'rare', shape: 'bubble', color: '#a8f0ff', set: 'bath', src: 'roll', how: 'Mystery Generator-оос (угаалгын өрөө нээлттэй үед).' },
  { id: 'goldduck', name: 'Алтан нугас', desc: 'Энгийн нугасны баян үеэл.', rarity: 'rare', shape: 'duck', color: '#ffb800', set: 'bath', src: 'roll', how: 'Mystery Generator-оос (угаалгын өрөө нээлттэй үед).' },
  // observatory
  { id: 'compass', name: 'Эвдэрсэн луужин', desc: 'Үргэлж гэр лүү заадаг.', rarity: 'common', shape: 'compass', color: '#c9a0ff', set: 'observatory', src: 'find', how: 'Цамхаг дахь хуучин авдрыг нээ.' },
  { id: 'starmap', name: 'Оддын зураг', desc: 'Хамгийн доод буланд "Мочи ★" гэж тэмдэглэжээ.', rarity: 'common', shape: 'map', color: '#7df9ff', set: 'observatory', src: 'find', how: 'Бөмбөрцгийг хоёр удаа эргүүл.' },
  { id: 'meteor', name: 'Жижигхэн солир', desc: 'Цонхоор унаж орж ирсэн. Одоо ч халуун.', rarity: 'rare', shape: 'meteor', color: '#ff9a5c', set: 'observatory', src: 'roll', how: 'Mystery Generator-оос (цамхаг нээлттэй үед).' },
  { id: 'fallenstar', name: 'Унасан од', desc: 'Буцаад тэнгэрт гарахыг хүсэхгүй байна.', rarity: 'rare', shape: 'star', color: '#fff3a0', set: 'observatory', src: 'roll', how: 'Mystery Generator-оос (цамхаг нээлттэй үед).' },
  // legendary — each tied to one real accomplishment
  { id: 'tesseract', name: 'Тессеракт', desc: '4 хэмжээст шоо. Удаан ширтвэл толгой эргэнэ.', rarity: 'legendary', shape: 'tesseract', color: '#7df9ff', set: 'legend', src: 'earn', how: 'Ажлын өрөөний нууц хонгилд байгаа тессерактад хүр.' },
  { id: 'crown', name: 'Жижиг ертөнцийн титэм', desc: 'Энэ байшингийн албан ёсны эзэн гэдгийн баталгаа.', rarity: 'legendary', shape: 'crown', color: '#ffd700', set: 'legend', src: 'earn', how: 'Байшингийн бүх 6 бүлгийг дуусга.' },
  { id: 'hourglass', name: 'Цаг хугацааны элс', desc: 'Хөмрөхөд өчигдөр болчихдог.', rarity: 'legendary', shape: 'hourglass', color: '#ffcf5c', set: 'legend', src: 'earn', how: '7 өдөр дараалан байшиндаа ир.' },
];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Энгийн',
  rare: 'Ховор',
  legendary: 'Домогт',
};

/** Hidden finds: poking object `obj` for the n-th time hands over `item`. */
export const FINDS: Record<string, { item: string; nth: number; text: string }> = {
  slippers: { item: 'sock', nth: 1, text: 'Шаахайн дотор... ганцаараа хэвтэж байсан оймс!' },
  toybox: { item: 'teddy', nth: 3, text: 'Тоглоомын хайрцгийн хамгийн ёроолд хуучин баавгай нуугдаж байлаа.' },
  beanbag: { item: 'chip', nth: 3, text: 'Зөөлөн суудлын доор... хамгийн сүүлчийн чипс!' },
  sofa: { item: 'remote', nth: 2, text: 'Дэрний завсраас алга болсон пульт гарч ирлээ!' },
  coffeetable: { item: 'pizza', nth: 1, text: 'Ширээн дээр пиццаны хайрцаг. Дотор нь... юу ч алга.' },
  cookiejar: { item: 'cookie', nth: 2, text: 'Лонхны ёроолд ганцхан жигнэмэг үлджээ. Чинийх боллоо.' },
  sink: { item: 'spoon', nth: 2, text: 'Угаалтуурын шүүрээс мөнгөн халбага гялалзлаа.' },
  bathsink: { item: 'soap', nth: 1, text: 'Солонгын өнгөөр хөөсөрдөг саван олдлоо!' },
  bathmat: { item: 'shell', nth: 2, text: 'Хивсний доор далайн хясаа. Хэн авчирсан юм бол?' },
  obschest: { item: 'compass', nth: 1, text: 'Авдар дотор эвдэрсэн луужин. Зүү нь гэр лүү заасаар.' },
  globe: { item: 'starmap', nth: 2, text: 'Бөмбөрцгийн дотроос эвхсэн оддын зураг унаж ирлээ.' },
};

// ===================================================================== badges
export type StatKey =
  | 'challenges' | 'pets' | 'cooks' | 'mysteries' | 'quests' | 'photos'
  | 'waters' | 'meteors' | 'discos' | 'touches' | 'hides' | 'escapes' | 'caught';

export interface BadgeDef {
  id: string;
  name: string;
  /** `{n}` is replaced with the next tier's target. */
  desc: string;
  icon: string;
  group: 'story' | 'skill' | 'secret';
  /** Tiered badges: bronze / silver / gold targets of `measure`. */
  tiers?: [number, number, number];
  /** Secret badges show this nudge (via the hint button) until found. */
  clue?: string;
}

export const TIER_NAME = ['', 'Хүрэл', 'Мөнгө', 'Алт'];

export const BADGES: BadgeDef[] = [
  // story — one per chapter
  { id: 'ch-bedroom', name: 'Өглөөний мэнд', desc: 'Унтлагын өрөөнөөс гарах замаа оллоо.', icon: '🛏️', group: 'story' },
  { id: 'nothing', name: 'Absolutely Nothing', desc: 'Сэжигтэй хайрцгийг онгойлголоо.', icon: '📦', group: 'story' },
  { id: 'detective', name: 'Professional Detective', desc: 'Нуугдаж байсан Мочиг барьлаа.', icon: '🕵️', group: 'story' },
  { id: 'ch-study', name: 'Нууц хонгил', desc: 'Ажлын өрөөний бүх нууцыг тайллаа.', icon: '🗝️', group: 'story' },
  { id: 'ch-living', name: 'Гал голомт', desc: 'Задгай зуухаа асааж, сейфийг нээлээ.', icon: '🔥', group: 'story' },
  { id: 'ch-kitchen', name: 'Мочигийн тогооч', desc: 'Мочид дуртай бинийг нь хийж өглөө.', icon: '🥞', group: 'story' },
  { id: 'ch-bath', name: 'Толины цаана', desc: 'Толийг хаалга болгон хувиргалаа.', icon: '🪞', group: 'story' },
  { id: 'ch-observatory', name: 'Оддын хооронд', desc: 'Мочигийн одыг тэнгэрт олж холболоо.', icon: '🌌', group: 'story' },
  // skill — tiered, earned by doing things over and over *differently*
  { id: 'explorer', name: 'Судлаач', desc: '{n} өөр объект дээр дар.', icon: '🔍', group: 'skill', tiers: [20, 45, 80] },
  { id: 'solver', name: 'Тааварч', desc: '{n} сорилтыг давах.', icon: '🧩', group: 'skill', tiers: [5, 20, 50] },
  { id: 'collector', name: 'Цуглуулагч', desc: '{n} төрлийн цуглуулга.', icon: '💎', group: 'skill', tiers: [6, 15, 27] },
  { id: 'loyal', name: 'Үнэнч зочин', desc: '{n} өдөр дараалан ирэх.', icon: '📅', group: 'skill', tiers: [3, 7, 30] },
  { id: 'mochifriend', name: 'Мочигийн найз', desc: 'Мочиг {n} удаа илбэх.', icon: '💗', group: 'skill', tiers: [10, 50, 150] },
  { id: 'chef', name: 'Тогооч', desc: '{n} бин хийх.', icon: '🍳', group: 'skill', tiers: [1, 5, 20] },
  { id: 'dailydet', name: 'Өдрийн мөрдөгч', desc: '{n} өдрийн нууц тайлах.', icon: '✉️', group: 'skill', tiers: [1, 7, 30] },
  { id: 'questor', name: 'Даалгаварч', desc: '{n} өдрийн даалгавар биелүүлэх.', icon: '✅', group: 'skill', tiers: [5, 25, 100] },
  { id: 'homeowner', name: 'Гэрийн эзэн', desc: 'Дэлгүүрээс {n} зүйл авах.', icon: '🏠', group: 'skill', tiers: [2, 6, 12] },
  { id: 'greenthumb', name: 'Ногоон гар', desc: 'Ид шидийн модыг {n}-р шат хүртэл ургуулах.', icon: '🌱', group: 'skill', tiers: [2, 5, 8] },
  { id: 'hider', name: 'Нуугдагч', desc: 'Сүүдрээс {n} удаа амжилттай нуугдах.', icon: '🫣', group: 'skill', tiers: [3, 15, 50] },
  { id: 'arcadeleg', name: 'Аркад легенд', desc: 'Star Catcher-т хүрэл/мөнгө/алт зэрэглэл авах.', icon: '🕹️', group: 'skill', tiers: [1, 2, 3] },
  // secret — noticing things nobody tells you about
  { id: 'dark', name: 'Not Afraid of the Dark', desc: 'Гэрэл унтарсан үед компьютер дээр дарлаа.', icon: '🌑', group: 'secret', clue: 'Гэрэл бүгд унтарсан үед ч ажилласаар байдаг нэг зүйл бий.' },
  { id: 'stargazer', name: 'Stargazer', desc: 'Солирын бороо орж байх яг тэр мөчид цонхоор харлаа.', icon: '🌠', group: 'secret', clue: 'Тэнгэр өөрөө бороо оруулж эхлэх тэр мөчид цонхоор хар.' },
  { id: 'fourth', name: 'The Fourth Dimension', desc: 'Тессерактад хүрлээ.', icon: '🧊', group: 'secret', clue: 'Нууц хонгилд энгийн биш хэлбэртэй зүйл эргэлддэг.' },
  { id: 'glitch', name: 'Reality Glitch', desc: 'Таталцал алга болох үед хөвж буй юманд хүрлээ.', icon: '🌀', group: 'secret', clue: 'Заримдаа таталцал ажиллахаа больдог. Тэр мөчид хөвж буй зүйлд хүр.' },
  { id: 'hacker', name: 'Hacker Voice: "I\'m in"', desc: 'Терминалд нууц команд олсон.', icon: '💻', group: 'secret', clue: 'Терминал зөвхөн нууц үг хүлээдэггүй.' },
  { id: 'disco', name: 'Party of One', desc: 'Чийдэнг диско горимд оруулсан.', icon: '🪩', group: 'secret', clue: 'Ажлын өрөөний чийдэнг маш хурдан хурдан дарвал...' },
  { id: 'speedrun', name: 'Speed Detective', desc: 'Ажлын өрөөний нууцыг 8 минутад тайлсан.', icon: '⚡', group: 'secret', clue: 'Ажлын өрөөний нууцуудыг удаан бодолгүй, шулуухан тайл.' },
  { id: 'curator', name: 'Clicked Everything', desc: 'Байшин дахь бүх объект дээр дарсан.', icon: '👆', group: 'secret', clue: 'Байшинд чиний дараагүй зүйл үлдэж болохгүй.' },
  { id: 'nightowl', name: 'Night Owl', desc: 'Шөнө дунд (00:00–04:00) байшиндаа зочилсон.', icon: '🦉', group: 'secret', clue: 'Байшин шөнө дунд өөр харагддаг гэнэ.' },
  { id: 'earlybird', name: 'Early Bird', desc: 'Үүр цайхад (05:00–07:00) байшиндаа зочилсон.', icon: '🐦', group: 'secret', clue: 'Нар мандахаас өмнө ир.' },
  { id: 'perfectchef', name: 'Gordon Mochi', desc: 'Бинийг ганц ч алдаагүй төгс эргүүлсэн.', icon: '👨‍🍳', group: 'secret', clue: 'Тогоонд бин эргүүлэхдээ нэг ч удаа бүү алд.' },
  { id: 'runner', name: 'Хурдан хөл', desc: 'Сүүдрийг өрөөнд орж ирэхээс өмнө өөр өрөө рүү зугтсан.', icon: '🏃', group: 'secret', clue: 'Нуугдах ганц арга биш. Заримдаа зүгээр л зугт.' },
  { id: 'untouchable', name: 'Untouchable', desc: 'Сүүдэрт ганц ч удаа баригдалгүй түүхийг дуусгасан.', icon: '👻', group: 'secret', clue: 'Түүхийн туршид Сүүдэрт нэг ч удаа бүү баригд.' },
  { id: 'lucky', name: 'Legendary Owner', desc: 'Домогт шагнал авлаа.', icon: '👑', group: 'secret', clue: 'Домогт зүйлс азаар биш — тодорхой гавьяагаар л ирдэг.' },
];

// ===================================================================== levels
/** Total XP needed to *reach* level L (L ≥ 1). 100, 300, 600, 1000, ... */
export const xpForLevel = (L: number) => 50 * L * (L - 1);
export const levelForXp = (xp: number) => {
  let L = 1;
  while (xpForLevel(L + 1) <= xp) L++;
  return L;
};

export const LEVEL_TITLES: [number, string][] = [
  [1, 'Шинэ зочин'],
  [3, 'Сониуч хөрш'],
  [5, 'Нууц хайгч'],
  [8, 'Мөрдөгч'],
  [12, 'Байшингийн найз'],
  [16, 'Нууцын мастер'],
  [20, 'Оддын аялагч'],
  [25, 'Little World-ийн домог'],
];
export const titleFor = (L: number) => LEVEL_TITLES.filter(([n]) => L >= n).pop()![1];

// ===================================================================== daily
/** 7-day login calendar. A missed day breaks the streak but never the calendar. */
export const CALENDAR: { coins: number; roll?: Rarity | 'any'; label: string }[] = [
  { coins: 30, label: '30 ✦' },
  { coins: 40, label: '40 ✦' },
  { coins: 20, roll: 'any', label: 'Бэлэг' },
  { coins: 60, label: '60 ✦' },
  { coins: 80, label: '80 ✦' },
  { coins: 40, roll: 'rare', label: 'Ховор бэлэг' },
  { coins: 200, roll: 'any', label: '200 ✦ + бэлэг' },
];

export type QuestEvent =
  | 'pet' | 'challenge' | 'touch' | 'water' | 'arcade' | 'photo' | 'meteor'
  | 'cook' | 'visit' | 'disco' | 'mystery' | 'fire' | 'bath' | 'hide';

export interface QuestDef {
  id: string;
  text: string;
  ev: QuestEvent;
  n: number;
  /** Room that must be finished before this quest can be drawn. */
  needs?: RoomId;
  /** Counts distinct targets (objects / rooms) instead of raw events. */
  unique?: boolean;
}

export const QUEST_POOL: QuestDef[] = [
  { id: 'pet', text: 'Мочиг {n} удаа илбэ', ev: 'pet', n: 5, needs: 'study' },
  { id: 'challenge', text: '{n} сорилт дав', ev: 'challenge', n: 2, needs: 'bedroom' },
  { id: 'touch', text: '{n} өөр объект дээр дар', ev: 'touch', n: 12, unique: true },
  { id: 'water', text: 'Ид шидийн модоо усал', ev: 'water', n: 1 },
  { id: 'arcade', text: 'Star Catcher тогло', ev: 'arcade', n: 1, needs: 'study' },
  { id: 'photo', text: 'Байшингийнхаа зургийг ав', ev: 'photo', n: 1 },
  { id: 'meteor', text: 'Цонхоор {n} удаа солир хар', ev: 'meteor', n: 2 },
  { id: 'cook', text: 'Мочид бин хийж өг', ev: 'cook', n: 1, needs: 'kitchen' },
  { id: 'visit', text: '{n} өөр өрөөнд зочил', ev: 'visit', n: 3, unique: true, needs: 'study' },
  { id: 'disco', text: 'Диско үдэшлэг зохио', ev: 'disco', n: 1, needs: 'study' },
  { id: 'mystery', text: 'Өдрийн нууцыг тайл', ev: 'mystery', n: 1, needs: 'bedroom' },
  { id: 'fire', text: 'Задгай зуухаа асаа', ev: 'fire', n: 1, needs: 'living' },
  { id: 'bath', text: 'Ванндаа халуун ус тат', ev: 'bath', n: 1, needs: 'bath' },
  { id: 'hide', text: 'Сүүдрээс {n} удаа нуугд', ev: 'hide', n: 2, needs: 'bedroom' },
];

/** Word-of-the-day pool: English word + Mongolian meaning clue. */
export const MYSTERY_WORDS: { word: string; clue: string }[] = [
  { word: 'SECRET', clue: 'Хэнд ч хэлдэггүй, нуугдмал зүйл' },
  { word: 'MYSTERY', clue: 'Учир нь тайлагдаагүй, битүүлэг оньсого' },
  { word: 'DREAM', clue: 'Унтаж байхдаа хардаг кино' },
  { word: 'PLANET', clue: 'Нарыг тойрон эргэдэг том бөмбөрцөг' },
  { word: 'COMET', clue: 'Сүүлтэй, тэнгэрээр нисдэг мөсөн чулуу' },
  { word: 'GALAXY', clue: 'Тэрбум одыг багтаасан аварга эргүүлэг' },
  { word: 'CANDLE', clue: 'Лаа — харанхуйд жижигхэн гэрэл' },
  { word: 'GARDEN', clue: 'Цэцэг, мод ургадаг газар' },
  { word: 'WINDOW', clue: 'Гадаад ертөнц рүү харах шилэн хаалга' },
  { word: 'PILLOW', clue: 'Толгойгоо тавьдаг зөөлөн зүйл' },
  { word: 'COOKIE', clue: 'Мочигийн хамгийн дуртай амттан' },
  { word: 'ROCKET', clue: 'Сансарт хөөрдөг төмөр шувуу' },
  { word: 'PUZZLE', clue: 'Тааж, эвлүүлж тайлдаг тоглоом' },
  { word: 'BLANKET', clue: 'Өвлийн шөнө дулаацуулдаг зүйл' },
  { word: 'LANTERN', clue: 'Гартаа барьдаг гэрэл' },
  { word: 'UNIVERSE', clue: 'Бүх од, гараг, хоосон орон зайг багтаасан бүхэл' },
  { word: 'TREASURE', clue: 'Далд нуусан үнэт эрдэнэс' },
  { word: 'MOONLIGHT', clue: 'Шөнийн тэнгэрээс тусах мөнгөлөг гэрэл' },
];

// ===================================================================== shop
export type ShopKind = 'paint' | 'hat' | 'lights' | 'extra';

export interface ShopDef {
  id: string;
  kind: ShopKind;
  name: string;
  desc: string;
  price: number;
  icon: string;
  /** Player level required before it can be bought. */
  level?: number;
}

export const SHOP: ShopDef[] = [
  { id: 'hat-party', kind: 'hat', name: 'Үдэшлэгийн малгай', desc: 'Мочид. Өдөр болгон баяр.', price: 120, icon: '🥳' },
  { id: 'hat-bow', kind: 'hat', name: 'Ягаан бантан', desc: 'Мочид. Энгийн ч гоёмсог.', price: 160, icon: '🎀' },
  { id: 'hat-wizard', kind: 'hat', name: 'Илбэчний малгай', desc: 'Мочид. Од гялалзаж байдаг.', price: 320, icon: '🧙', level: 6 },
  { id: 'lights-rainbow', kind: 'lights', name: 'Солонгон гэрэл', desc: 'Гирлянд бүх өнгөөр гүйнэ.', price: 200, icon: '🌈' },
  { id: 'lights-ice', kind: 'lights', name: 'Мөсөн гэрэл', desc: 'Цэнхэр, цагаан сэрүүн гэрэл.', price: 150, icon: '❄️' },
  { id: 'fishbowl', kind: 'extra', name: 'Загасны сав', desc: 'Зочны өрөөнд жижигхэн алтан загас.', price: 220, icon: '🐠' },
  { id: 'vacuum', kind: 'extra', name: 'Робот тоос сорогч', desc: 'Байшингаар өөрөө эргэлдэнэ. Мочи айдаг.', price: 420, icon: '🤖', level: 5 },
  { id: 'fireflies', kind: 'extra', name: 'Цэцэрлэгийн галт хорхой', desc: 'Цэцэрлэгт зөөлөн гэрэлтэх хорхойнууд.', price: 280, icon: '✨', level: 4 },
  { id: 'balloons', kind: 'extra', name: 'Бөмбөлөгнүүд', desc: 'Унтлагын өрөөнд хөвөх бөмбөлгүүд.', price: 140, icon: '🎈' },
];
export const HAT_IDS = ['hat-party', 'hat-bow', 'hat-wizard', 'hat-crown'] as const;
export type HatId = (typeof HAT_IDS)[number];
export type LightsMode = 'warm' | 'rainbow' | 'ice';

// ===================================================================== the Shadow
/** Places you can hide from the Shadow in each room (object ids). Clicking one
 *  while the Shadow is coming hides you instead of the object's usual reaction. */
export const HIDE_SPOTS: Partial<Record<RoomId, { id: string; text: string }[]>> = {
  bedroom: [{ id: 'wardrobe', text: 'Шүүгээнд' }, { id: 'bed', text: 'Орны доор' }],
  study: [{ id: 'beanbag', text: 'Зөөлөн суудлын ард' }, { id: 'arcade', text: 'Аркадын ард' }],
  living: [{ id: 'sofa', text: 'Буйдангийн ард' }, { id: 'armchair', text: 'Сандлын ард' }],
  kitchen: [{ id: 'pantry', text: 'Агуулахын шүүгээнд' }, { id: 'ktable', text: 'Ширээн доор' }],
  bath: [{ id: 'tub', text: 'Ванны хөшигний цаана' }, { id: 'closet', text: 'Алчуурын шүүгээнд' }],
};

/** Rooms the Shadow can drift between (it walks through walls, so any shared wall counts). */
export const ROOM_LINKS: Record<RoomId, RoomId[]> = {
  bedroom: ['study', 'kitchen'],
  study: ['bedroom', 'living'],
  living: ['study', 'kitchen', 'bath', 'observatory'],
  kitchen: ['bedroom', 'living', 'bath'],
  bath: ['kitchen', 'living'],
  observatory: ['living'],
};

/** Seconds between hunts, per chapter (later chapters are more dangerous). */
export const HUNT_GAP: Partial<Record<RoomId, [number, number]>> = {
  study: [70, 95],
  living: [60, 85],
  kitchen: [50, 75],
  bath: [42, 65],
};

// ===================================================================== economy
/** XP / coin payouts, in one place so the pacing is easy to tune. */
export const PAY = {
  touch: { xp: 4, coins: 0 },
  find: { xp: 25, coins: 15 },
  letter: { xp: 15, coins: 5 },
  step: { xp: 40, coins: 10 },
  room: { xp: 200, coins: 120 },
  challenge: { xp: 20, coins: 6 },
  quest: { xp: 40, coins: 30 },
  allQuests: { xp: 60, coins: 50 },
  mystery: { xp: 120, coins: 90 },
  newItem: { xp: 30, coins: 0 },
  dupe: { common: 15, rare: 40, legendary: 120 } as Record<Rarity, number>,
  badgeTier: { xp: 50, coins: 30 },
  water: { xp: 20, coins: 10 },
  pet: { xp: 2, coins: 0 },
  hide: { xp: 35, coins: 20 },
  escape: { xp: 20, coins: 10 },
};

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
  { title: 'Ажлын өрөө нээгдлээ', sub: 'Зочны өрөөний хаалга нээгдлээ — дараагийн бүлэг хүлээж байна.' },
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
  ['Ажлын өрөөний бүх нууц тайлагдлаа! Зочны өрөө рүү орох хаалга нээгдсэн.'],
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
  // bedroom
  bed: { name: 'Ор', color: 'pink', icon: 'bed' },
  alarm: { name: 'Сэрүүлэгтэй цаг', color: 'pink', icon: 'clock' },
  nightlamp: { name: 'Орны дэргэдэх гэрэл', color: 'yellow', icon: 'lamp' },
  wardrobe: { name: 'Хувцасны шүүгээ', color: 'dark', icon: 'lock' },
  photo: { name: 'Зургийн жааз', color: 'yellow', icon: 'image' },
  bedplant: { name: 'Цангасан ургамал', color: 'green', icon: 'plant' },
  can: { name: 'Усны сав', color: 'blue', icon: 'drop' },
  bedrug: { name: 'Зөөлөн хивс', color: 'pink', icon: 'rug' },
  toybox: { name: 'Тоглоомын хайрцаг', color: 'yellow', icon: 'box' },
  slippers: { name: 'Шаахай', color: 'pink', icon: 'heart' },
  bedwindow: { name: 'Орны цонх', color: 'yellow', icon: 'window' },
  // living
  fireplace: { name: 'Задгай зуух', color: 'yellow', icon: 'fire' },
  painting: { name: 'Хуучин зураг', color: 'dark', icon: 'image' },
  safe: { name: 'Нууц сейф', color: 'dark', icon: 'lock' },
  tv: { name: 'Зурагт', color: 'blue', icon: 'tv' },
  sofa: { name: 'Буйдан', color: 'pink', icon: 'sofa' },
  armchair: { name: 'Түшлэгтэй сандал', color: 'green', icon: 'chair' },
  coffeetable: { name: 'Кофены ширээ', color: 'yellow', icon: 'mug' },
  record: { name: 'Пянз тоглуулагч', color: 'dark', icon: 'music' },
  cabinet: { name: 'Цуглуулгын шүүгээ', color: 'blue', icon: 'trophy' },
  floorlamp: { name: 'Шалны гэрэл', color: 'yellow', icon: 'lamp' },
  monstera: { name: 'Монстера', color: 'green', icon: 'plant' },
  fishbowl: { name: 'Загасны сав', color: 'blue', icon: 'drop' },
  // kitchen
  fridge: { name: 'Хөргөгч', color: 'blue', icon: 'fridge' },
  stove: { name: 'Зуух', color: 'pink', icon: 'pot' },
  sink: { name: 'Угаалтуур', color: 'blue', icon: 'drop' },
  cupboard: { name: 'Дээд шүүгээ', color: 'yellow', icon: 'box' },
  honey: { name: 'Зөгийн балны лонх', color: 'yellow', icon: 'jar' },
  toaster: { name: 'Талх шарагч', color: 'pink', icon: 'box' },
  kettle: { name: 'Данх', color: 'dark', icon: 'mug' },
  cookiejar: { name: 'Жигнэмэгний лонх', color: 'yellow', icon: 'jar' },
  fruit: { name: 'Жимсний таваг', color: 'green', icon: 'heart' },
  herbs: { name: 'Ногоон амтлагч', color: 'green', icon: 'plant' },
  pantry: { name: 'Агуулахын шүүгээ', color: 'dark', icon: 'box' },
  ktable: { name: 'Хоолны ширээ', color: 'yellow', icon: 'mug' },
  // bath
  tub: { name: 'Ванн', color: 'blue', icon: 'bath' },
  faucet: { name: 'Халуун усны цорго', color: 'blue', icon: 'drop' },
  duck: { name: 'Резинэн нугас', color: 'yellow', icon: 'duck' },
  mirror: { name: 'Манантай толь', color: 'blue', icon: 'mirror' },
  bathsink: { name: 'Гар угаалтуур', color: 'blue', icon: 'drop' },
  towel: { name: 'Алчуур', color: 'pink', icon: 'rug' },
  washer: { name: 'Угаалгын машин', color: 'dark', icon: 'washer' },
  bottles: { name: 'Шампунийн лонхнууд', color: 'green', icon: 'jar' },
  basket: { name: 'Хувцасны сагс', color: 'yellow', icon: 'box' },
  bathmat: { name: 'Угаалгын хивс', color: 'pink', icon: 'rug' },
  bathplant: { name: 'Чийгэнд дуртай ургамал', color: 'green', icon: 'plant' },
  closet: { name: 'Алчуурын шүүгээ', color: 'dark', icon: 'box' },
  // observatory
  telescope: { name: 'Дуран', color: 'blue', icon: 'telescope' },
  chart: { name: 'Оддын газрын зураг', color: 'dark', icon: 'map' },
  globe: { name: 'Тэнгэрийн бөмбөрцөг', color: 'blue', icon: 'globe' },
  obschest: { name: 'Хуучин авдар', color: 'yellow', icon: 'box' },
  obschair: { name: 'Зөөлөн сандал', color: 'pink', icon: 'chair' },
  // garden
  mailbox: { name: 'Шуудангийн хайрцаг', color: 'pink', icon: 'mail' },
  magictree: { name: 'Ид шидийн мод', color: 'green', icon: 'tree' },
  gnome: { name: 'Цэцэрлэгийн одой', color: 'green', icon: 'ghost' },
  bench: { name: 'Вандан сандал', color: 'yellow', icon: 'chair' },
  flowers: { name: 'Цэцгийн мандал', color: 'pink', icon: 'plant' },
  shadow: { name: 'Сүүдэр', color: 'dark', icon: 'ghost' },
  // doors
  door: { name: 'Хаалга', color: 'dark', icon: 'door' },
};
