import type { AmbientParticlesConfig, CursorParticlesConfig } from './engine';
import type { SceneParams } from './scenes/types';
import { CINEMATIC_CATALOG, CINEMATIC_ALTERNATIVES, CINEMATIC_TRAVEL } from './scenes/cinematic/catalog';

export type GroupEffectKind = 'ambient' | 'cursor' | 'storm' | 'compass' | 'circuit' | 'sparkle' | 'pulse-rings' | 'orbit-dots' | 'water' | 'video' | 'mine' | 'image-reveal' | 'latvia-cube' | 'sakura' | 'sun-water' | 'lantern-water' | 'embroidery' | 'amber-words' | 'song-fire' | 'scene';

export type GroupEffectDefinition = {
  kind: GroupEffectKind;
  /** Only for kind: 'ambient'. */
  ambient?: AmbientParticlesConfig;
  /** Only for kind: 'cursor'. */
  cursor?: CursorParticlesConfig;
  /** Only for kind: 'video'. */
  videoSrc?: string;
  /** Only for kind: 'image-reveal' — the picture hidden under the cursor's circular peephole. */
  imageSrc?: string;
  /** Only for kind: 'image-reveal' — CSS `background-position` for that picture; see ImageRevealEffect. */
  imageFocus?: string;
  /** Only for kind: 'image-reveal' — CSS `background-size` for that picture; see ImageRevealEffect. */
  imageSize?: string;
  /** Only for kind: 'scene' — the scene's id in effects/scenes/registry. */
  sceneId?: string;
  /** Only for kind: 'scene' — which of the scene's palettes to use (0 = its first/default one). */
  scenePalette?: number;
  /** Only for kind: 'scene' — starting panel values on top of the scene's own `defaultParams`, so card variants can
   * show one scene in different looks (optics-lab's sets of pieces). */
  sceneParams?: Partial<SceneParams>;
  /** Accent color for the bespoke kinds (circuit/sparkle/pulse-rings/orbit-dots). */
  accent?: string;
  /** CSS background applied behind the particle canvas while the group is selected. */
  background: string;
  glow: string;
  /** When set, selecting this group ALSO mounts a whole-page background effect (BodyGridEffect,
   * FluidEffect, or one scene from the library, full-viewport) on top of whatever the card's own
   * `kind` already renders — additive, not a replacement for it. */
  bodyEffect?: 'pottery' | 'grid' | 'fluid' | 'liquid-glass' | 'liquid-drops' | 'lantern-water' | 'sakura' | 'sakura-card' | 'leaves' | 'holo-island' | 'holo-silver' | 'street-relight' | { scene: string; palette?: number };
  /** A scene that plays over the whole page is normally not repeated in the card (it keeps just its tint); this plays
   * it in the card as well, as one effect in two places (1783's fireworks). */
  alsoInCard?: boolean;
  /** Full-page decoration only: no canvas, tint, themed text, or ring on the course card. */
  bodyOnly?: boolean;
  /** Always embedded in its course card; never expands or participates in background comparison. */
  cardOnly?: boolean;
  /** The effect is meant to be seen and played with right under the card's own controls: the group's picture and
   * skill icons go half transparent (opaque again on hover), so the effect shows through them. */
  seeThrough?: boolean;
};

function bg(rgb: string): string {
  return `radial-gradient(circle at 30% 15%, rgba(${rgb},0.45), transparent 80%)`;
}

/**
 * Все 38 тематических групп курса (dictionary_id=20, A1–B2), см. resources/course/GROUPS.md.
 * Ключ — id категории 2-го уровня словаря (стабилен между окружениями, в отличие от id
 * course_group). Каждая запись — свой набор параметров общего движка (AmbientParticles/
 * CursorParticles) либо один из бесповторных компонентов с своим акцентным цветом — так 38
 * групп выглядят по-разному, не деля 3-4 захардкоженных пресета на всех.
 */
const BY_CATEGORY_ID: Record<number, GroupEffectDefinition> = {
  // A1
  1763: { // Приятно познакомиться! — приветствия на разных языках всплывают пузырями
    kind: 'scene', sceneId: 'greetings', accent: '#ff8a65',
    background: bg('255,138,101'), glow: '#ff8a65',
  },
  1764: { // Со всего мира — комната с гирляндой лампочек на весь фон, у левого края холодильник с магнитиками разных стран
    kind: 'scene',
    sceneId: 'string-lights',
    accent: '#ffb066',
    background: 'linear-gradient(180deg, rgba(24,16,8,0.7), rgba(8,5,3,0.6))',
    glow: '#ffb066',
    // The whole room (decor, baked light, clickable bulbs, the fridge and its magnets) is the page background; the
    // card keeps a plain tint.
    bodyEffect: { scene: 'string-lights' },
  },
  1765: { // В городе и в деревне: один фонтан на весь экран, без второй копии внутри группы.
    kind: 'scene', sceneId: 'fountain-yard', accent: '#8fb8c9',
    background: 'linear-gradient(180deg, rgba(20,30,36,0.55), rgba(8,12,14,0.45))', glow: '#8fb8c9',
    bodyEffect: { scene: 'fountain-yard' },
  },
  1766: { // Мой дом и семья — два независимо сгенерированных генетических дерева на фоне страницы
    kind: 'scene', sceneId: 'genome-garden', accent: '#a8d5a5',
    background: bg('88,151,113'), glow: '#a8d5a5',
    bodyEffect: { scene: 'genome-garden' },
  },
  1767: { // Пешком, на троллейбусе, на самолёте — карта маршрута с метками и идущим следом
    kind: 'scene', sceneId: 'route-map', accent: '#5fb4dd',
    background: bg('100,180,230'), glow: '#5fb4dd',
  },
  1768: { // Ежедневные дела — пиксельные песочные часы (3D-часы с трассировкой лучей отложены, см. варианты)
    kind: 'scene', sceneId: 'pixel-hourglass', accent: '#ffab12', background: 'linear-gradient(180deg, rgba(20,16,19,0.76), rgba(5,5,8,0.66))', glow: '#ffab12',
  },
  1769: { // Покупки — три большие неоновые вывески на стене магазина, их свет на кирпиче, трубе и мокром тротуаре
    kind: 'scene', sceneId: 'neon-signs', accent: '#e08fc0',
    background: bg('224,143,192'), glow: '#e08fc0',
  },
  1770: { kind: 'video', videoSrc: '/course/effects/bon-appetit-loop.mp4', accent: '#e0762f', background: bg('224,118,47'), glow: '#e0762f' }, // Приятного аппетита! — зацикленное видео
  1771: { // Свободное время — воздушные шары, курсор их лопает
    kind: 'scene', sceneId: 'balloons', accent: '#8fd0c9',
    background: bg('143,208,201'), glow: '#8fd0c9',
  },
  1772: { // Я путешествую… — ночная трасса, уходящая к горизонту
    kind: 'scene', sceneId: 'highway', accent: '#e0a339',
    background: bg('224,163,57'), glow: '#e0a339',
  },
  1773: { kind: 'scene', sceneId: 'mandala', accent: '#e8b923', background: 'linear-gradient(180deg, rgba(34,21,65,0.7), rgba(14,9,28,0.6))', glow: '#e8b923', bodyEffect: { scene: 'mandala' } }, // Будь здоров! — узоры-калейдоскоп (мандала) на весь фон, рисовать спокойно; кардиограмма убрана
  1774: { // Учёба и работа — оптическая лаборатория на всю страницу: кристаллы и капли (вариант — оптическая скамья)
    kind: 'scene', sceneId: 'optics-lab', sceneParams: { opticsSet: 3 }, accent: '#7aa3d9', background: 'linear-gradient(180deg, rgba(8,12,20,0.55), rgba(4,6,10,0.45))', glow: '#7aa3d9',
    bodyEffect: { scene: 'optics-lab' },
  },
  // A2
  1775: { // Я, моя семья и друзья — гирлянда фотографий на верёвке
    kind: 'scene', sceneId: 'polaroids', accent: '#c98fd0',
    background: bg('201,143,208'), glow: '#c98fd0',
  },
  1776: { kind: 'scene', sceneId: 'constellation', accent: '#c9b8e0', background: bg('201,184,224'), glow: '#c9b8e0' }, // Какие мы — созвездие точек, соединяющихся в узор
  1777: { // Моё место жительства — голографический остров на весь фон (вариант — серебряная техническая наклейка; прежний изометрический городок отложен)
    kind: 'sparkle', accent: '#7fd6e8',
    background: 'linear-gradient(180deg, rgba(10,24,30,0.55), rgba(4,10,14,0.45))', glow: '#7fd6e8',
    bodyEffect: 'holo-island',
  },
  1778: { kind: 'sakura', accent: '#e89ab8', background: bg('240,170,200'), glow: '#e89ab8', bodyEffect: 'sakura-card' }, // На природе — большая сакура на весь фон, за ней пейзаж (вариант — листопад на весь фон; остальное отложено)
  1779: { kind: 'scene', sceneId: 'planner', accent: '#e0b45a', background: bg('224,180,90'), glow: '#e0b45a' }, // Мой планировщик — стикеры с галочками
  1780: { // Покупки и услуги — драгоценные камни в сотах (витрина ювелирного) на весь фон, курсор — лампа
    kind: 'scene', sceneId: 'gems', accent: '#ffd27a',
    sceneParams: { gmCell: 2.1, gmCellMobile: 1.8, gmBacking: 1 }, // ×1.5, «Порода» по умолчанию.
    background: 'linear-gradient(180deg, rgba(14,11,18,0.7), rgba(6,5,8,0.6))', glow: '#ffd27a',
    bodyEffect: { scene: 'gems' },
  },
  1781: { kind: 'sparkle', accent: '#f0c14b', background: bg('240,193,75'), glow: '#f0c14b', bodyEffect: 'liquid-glass' }, // Я интересуюсь…
  1782: { // Путешествие — один непрерывный пруд с фонарями на весь фон страницы.
    kind: 'lantern-water', accent: '#ffb04d',
    background: 'linear-gradient(180deg, rgba(5,8,28,0.55), rgba(16,26,64,0.45))', glow: '#ffb04d',
    bodyEffect: 'lantern-water',
  },
  1783: { // Время праздников — светодиодный куб 20³ с праздничными программами на весь фон страницы, карточка только с тоном (вариант — фейерверк над Ригой)
    kind: 'scene', sceneId: 'voxel-led-cube', accent: '#ffcf5a',
    background: 'radial-gradient(circle at 64% 50%, rgba(255,120,150,0.22), transparent 30%), linear-gradient(180deg, rgba(10,5,18,0.8), rgba(3,2,8,0.7))', glow: '#ffcf5a',
    bodyEffect: { scene: 'voxel-led-cube', palette: 0 },
  },
  1784: { kind: 'scene', sceneId: 'skill-tree', accent: '#a389e0', background: bg('163,137,224'), glow: '#a389e0' }, // Образование и карьера — дерево навыков A1…C2
  1785: { // Я в Латвии — 3D витрина-сувенир, только в активированной группе
    kind: 'latvia-cube', accent: '#8a2432',
    background: 'radial-gradient(circle at 72% 48%, rgba(209,160,96,.34), transparent 26%), radial-gradient(circle at 30% 15%, rgba(138,36,50,.55), rgba(48,12,18,.25) 70%)', glow: '#b54b5d',
  },
  // B1
  1786: { kind: 'scene', sceneId: 'time-vortex', accent: '#e0b45a', background: bg('224,180,90'), glow: '#e0b45a' }, // Никогда не поздно — часовой вихрь
  1787: { // Среди своих — один вариант светлячков, с карточной и полноэкранной композицией.
    kind: 'scene', sceneId: 'fireflies', accent: '#e0966b', scenePalette: 1,
    background: bg('224,150,107'), glow: '#e0966b', bodyEffect: { scene: 'fireflies', palette: 1 },
  },
  1788: { // Место жительства — тот же городок, вечерние огни
    kind: 'scene', sceneId: 'iso-town', accent: '#8fa3b8', scenePalette: 1,
    background: bg('143,163,184'), glow: '#8fa3b8',
  },
  1789: { // Когда заканчивается рабочий день… — запотевшее окно, вечерний город под дождём, на весь фон страницы
    kind: 'scene', sceneId: 'fogged-glass', accent: '#9fd3e0',
    background: 'linear-gradient(180deg, rgba(10,14,22,0.55), rgba(4,6,10,0.45))', glow: '#9fd3e0',
    bodyEffect: { scene: 'fogged-glass' },
  },
  1790: { kind: 'pulse-rings', accent: '#e07a9e', background: bg('224,122,158'), glow: '#e07a9e', bodyEffect: 'liquid-drops' }, // Красота и здоровье — пульс в карточке + сетка капель-«жидкое стекло» на всю страницу
  1791: { // Один облегчённый дракон справа в карточке; большая композиция сохранена.
    kind: 'scene', sceneId: 'dragon-burner-card', accent: '#2f8fae',
    background: bg('47,143,174'), glow: '#2f8fae',
    bodyEffect: { scene: 'burner-pair' },
  },
  1792: { kind: 'scene', sceneId: 'lcd-screen', accent: '#9bbc0f', background: 'linear-gradient(180deg, rgba(14,30,20,0.78), rgba(6,12,9,0.66))', glow: '#9bbc0f' }, // Эпоха техники и информации — только прежний третий вариант.
  1793: { // Мастера ремёсел и приключений — кузница, курсор бьёт молотом
    kind: 'scene', sceneId: 'forge', accent: '#c9863f',
    background: bg('201,134,63'), glow: '#c9863f',
  },
  1794: { kind: 'scene', sceneId: 'kaleidoscope', accent: '#ffd27a', background: 'linear-gradient(180deg, rgba(11,9,16,0.7), rgba(5,4,8,0.6))', glow: '#ffd27a', bodyEffect: { scene: 'kaleidoscope' } }, // Стань счастливым! — калейдоскоп; второй вариант временно закомментирован ниже.
  1795: { kind: 'sparkle', accent: '#7a6bc9', background: bg('122,107,201'), glow: '#7a6bc9', bodyEffect: 'fluid' }, // Удивительная и загадочная Латвия — фиолетовые + WebGL-жидкость на всю страницу
  // B2
  1796: { kind: 'circuit', accent: '#4fd8e0', background: bg('60,220,230'), glow: '#4fd8e0', bodyEffect: 'grid' }, // Связь и технологии — старый circuit в карточке + сетка-подсветка на всю страницу
  1797: { kind: 'storm', accent: '#7aa3d9', background: 'radial-gradient(circle at 30% 15%, rgba(75,90,120,0.8), rgba(40,50,70,0.65) 55%, rgba(25,32,48,0.5) 85%)', glow: '#7aa3d9' }, // Окружающая среда и погода — тёмное грозовое небо
  1798: { // Работа и финансы — 3D-шахта: рабочий добывает золото, курсор-фонарь освещает забой
    kind: 'mine', accent: '#d4af37',
    background: 'radial-gradient(circle at 35% 20%, rgba(60,48,34,0.85), rgba(28,22,16,0.9) 60%, rgba(16,12,9,0.95) 100%)',
    glow: '#d4af37',
  },
  1799: { // Политика и общество — курсор открывает круглое окошко с картинкой на обычном фоне
    kind: 'image-reveal', accent: '#8a94a3',
    imageSrc: '/course/effects/politics-reveal.jpg',
    imageFocus: 'center center',
    // One centered picture across the full viewport, fitted without cropping.
    imageSize: 'contain',
    background: bg('138,148,163'), glow: '#8a94a3',
  },
  1800: { // Культура и язык — вышитый пояс: курсор-игла вышивает латышский орнамент (варианты: янтарь, костёр)
    kind: 'embroidery', accent: '#a03f4a',
    background: 'linear-gradient(180deg, rgba(120,24,38,0.55), rgba(90,16,30,0.5))',
    glow: '#c9a24c',
    seeThrough: true,
  },
};

const INTRO_EFFECT: GroupEffectDefinition = {
  kind: 'compass',
  cardOnly: true,
  background: 'radial-gradient(circle at 30% 15%, rgba(230,180,90,0.5), transparent 80%)',
  glow: '#e6b45a',
};

const INTRO_TITLES = new Set(['Введение', 'Вступ']);

export type GroupEffectVariant = {
  id: string;
  icon: string;
  label: { ru: string; uk: string };
  effect: GroupEffectDefinition;
  /** Put aside: not offered on the card, still shown on the effects test page (/course/effects-preview). */
  hidden?: boolean;
};

/**
 * Groups whose effect the visitor can switch between from a picker on the card itself. The first
 * entry is the default from `BY_CATEGORY_ID`; prior looks remain selectable when a new default is requested.
 */
const VARIANTS_BY_CATEGORY_ID: Record<number, GroupEffectVariant[]> = {
  // Group 1766 has one DNA-driven effect; its former simple alternatives are no longer selectable.
  1787: [
    { id: 'fireflies', icon: '✨', label: { ru: 'Светлячки', uk: 'Світлячки' }, effect: BY_CATEGORY_ID[1787] },
  ],
  1794: [
    { id: 'kaleidoscope', icon: '🔮', label: { ru: 'Калейдоскоп', uk: 'Калейдоскоп' }, effect: BY_CATEGORY_ID[1794] },
    /* Второй эффект отключён по просьбе владельца; определение сохранено.
    {
      id: 'glitter-full', icon: '✨', label: { ru: 'Блёстки на весь фон', uk: 'Блискітки на все тло' },
      effect: { kind: 'scene', sceneId: 'glitter', accent: '#ffd23f', background: bg('255,210,63'), glow: '#ffd23f', bodyEffect: { scene: 'glitter' } },
    },
    */
  ],
  1772: [
    { id: 'highway', icon: '🛣️', label: { ru: 'Ночная трасса', uk: 'Нічна траса' }, effect: BY_CATEGORY_ID[1772] },
    {
      id: 'street-relight', icon: '🌧️', label: { ru: 'Улица после дождя на весь фон', uk: 'Вулиця після дощу на все тло' },
      effect: { kind: 'sparkle', accent: '#ffcf8a', background: 'linear-gradient(180deg, rgba(12,14,22,0.55), rgba(5,6,10,0.45))', glow: '#ffcf8a', bodyEffect: 'street-relight' },
    },
  ],
  1777: [
    { id: 'holo-island', icon: '🏝️', label: { ru: 'Голографический остров', uk: 'Голографічний острів' }, effect: BY_CATEGORY_ID[1777] },
    { id: 'holo-silver', icon: '💿', label: { ru: 'Серебряная голограмма', uk: 'Срібна голограма' }, effect: { ...BY_CATEGORY_ID[1777], accent: '#c9d2dc', glow: '#c9d2dc', bodyEffect: 'holo-silver' } },
    {
      id: 'iso-town', icon: '🏘️', label: { ru: 'Изометрический городок', uk: 'Ізометричне містечко' }, hidden: true,
      effect: { kind: 'scene', sceneId: 'iso-town', accent: '#b98a63', background: bg('185,138,99'), glow: '#b98a63' },
    },
  ],
  1768: [
    { id: 'pixel-hourglass', icon: '🔶', label: { ru: 'Пиксельные часы', uk: 'Піксельний годинник' }, effect: BY_CATEGORY_ID[1768] },
    {
      id: 'hourglass', icon: '⌛', label: { ru: 'Песочные часы 3D', uk: 'Пісочний годинник 3D' }, hidden: true,
      effect: { kind: 'scene', sceneId: 'hourglass', accent: '#93a1ac', background: bg('147,161,172'), glow: '#93a1ac' },
    },
  ],
  1779: [
    { id: 'planner', icon: '🗒️', label: { ru: 'Планировщик', uk: 'Планувальник' }, effect: BY_CATEGORY_ID[1779] },
    {
      id: 'focus-clock', icon: '⏱️', label: { ru: 'Фокус-таймер', uk: 'Фокус-таймер' },
      effect: { kind: 'scene', sceneId: 'focus-clock', accent: '#6ec7ff', background: 'linear-gradient(180deg, rgba(23,32,44,0.72), rgba(8,11,18,0.64))', glow: '#6ec7ff' },
    },
  ],
  1784: [
    { id: 'skill-tree', icon: '🌳', label: { ru: 'Дерево навыков', uk: 'Дерево навичок' }, effect: BY_CATEGORY_ID[1784] },
    {
      id: 'career-ladder', icon: '🚀', label: { ru: 'Лестница роста', uk: 'Драбина зростання' },
      effect: { kind: 'scene', sceneId: 'career-ladder', accent: '#9e8cff', background: 'linear-gradient(180deg, rgba(24,22,49,0.72), rgba(7,6,17,0.62))', glow: '#9e8cff' },
    },
    {
      id: 'jetpack-aviator', icon: '🛩️', label: { ru: 'Реактивный авиатор', uk: 'Реактивний авіатор' },
      effect: { kind: 'scene', sceneId: 'jetpack-aviator', accent: '#ffb35f', background: 'linear-gradient(180deg, rgba(15,31,66,0.75), rgba(5,8,23,0.64))', glow: '#ffb35f' },
    },
  ],
  1788: [
    { id: 'iso-town', icon: '🏘️', label: { ru: 'Городок', uk: 'Містечко' }, effect: BY_CATEGORY_ID[1788] },
    {
      id: 'home-windows', icon: '🪟', label: { ru: 'Окна дома', uk: 'Вікна дому' },
      effect: { kind: 'scene', sceneId: 'home-windows', scenePalette: 1, accent: '#c48dff', background: 'linear-gradient(180deg, rgba(30,23,45,0.72), rgba(5,7,14,0.63))', glow: '#c48dff' },
    },
  ],
  1797: [
    { id: 'storm', icon: '⛈️', label: { ru: 'Гроза', uk: 'Гроза' }, effect: BY_CATEGORY_ID[1797] },
    {
      id: 'sun-water',
      icon: '☀️',
      label: { ru: 'Солнце и вода', uk: 'Сонце і вода' },
      effect: {
        kind: 'sun-water',
        accent: '#4fa8e0',
        background: 'linear-gradient(180deg, rgba(120,190,240,0.6), rgba(190,225,250,0.4) 62%, rgba(255,236,190,0.38))',
        glow: '#f2c14e',
      },
    },
  ],
  1778: [
    {
      id: 'sakura-card-full', icon: '🌸', label: { ru: 'Сакура', uk: 'Сакура' },
      effect: BY_CATEGORY_ID[1778],
    },
    { id: 'sakura', icon: '🌸', label: { ru: 'Сакура в карточке', uk: 'Сакура в картці' }, hidden: true, effect: { ...BY_CATEGORY_ID[1778], bodyEffect: undefined } },
    {
      id: 'sakura-landscape', icon: '🌅', label: { ru: 'Две сакуры на весь фон', uk: 'Дві сакури на весь фон' }, hidden: true,
      effect: { ...BY_CATEGORY_ID[1778], bodyEffect: 'sakura' },
    },
    {
      id: 'leaves',
      hidden: true,
      icon: '🍂',
      label: { ru: 'Листопад', uk: 'Листопад' },
      effect: {
        kind: 'ambient', accent: '#8fae4c',
        ambient: { count: 42, colors: ['#d97b34', '#e0a339', '#8a9a3f', '#c65b3f'], shape: 'leaf', sizeRange: [7, 13], fallSpeedRange: [33.3, 77.7], swayAmplitude: 26, swaySpeedRange: [0.4, 1], rotationSpeedRange: [-1.2, 1.2], opacity: 0.9, veinCount: 3, cursorRepelRadius: 90, cursorRepelForce: 155 },
        background: bg('150,189,96'), glow: '#8fae4c',
      },
    },
    {
      id: 'leaves-full', icon: '🍁', label: { ru: 'Листопад на весь фон', uk: 'Листопад на весь фон' },
      effect: {
        kind: 'ambient', accent: '#b88a41', background: bg('150,189,96'), glow: '#b88a41', bodyEffect: 'leaves',
        ambient: { count: 210, colors: ['#d97b34', '#e0a339', '#8a9a3f', '#c65b3f'], shape: 'leaf', sizeRange: [10, 24], fallSpeedRange: [35, 95], swayAmplitude: 40, swaySpeedRange: [0.4, 1], rotationSpeedRange: [-1.2, 1.2], opacity: 0.9, veinCount: 3, cursorRepelRadius: 120, cursorRepelForce: 180 },
      },
    },
  ],
  1800: [
    { id: 'embroidery', icon: '🧵', label: { ru: 'Вышитый пояс', uk: 'Вишитий пояс' }, effect: BY_CATEGORY_ID[1800] },
    /* Янтарь восстановлен в старой реализации, но временно отключён по просьбе владельца.
    {
      id: 'amber',
      icon: '🍯',
      label: { ru: 'Янтарь со словами', uk: 'Бурштин зі словами' },
      effect: {
        kind: 'amber-words',
        accent: '#e0a030',
        background: 'linear-gradient(180deg, rgba(196,120,20,0.55), rgba(120,60,10,0.5))',
        glow: '#f0b23c',
        seeThrough: true,
      },
    },
    */
    {
      id: 'song-fire',
      icon: '🔥',
      label: { ru: 'Костёр Праздника песни', uk: 'Вогнище Свята пісні' },
      effect: {
        kind: 'song-fire',
        accent: '#f08a3c',
        background: 'linear-gradient(180deg, rgba(20,14,44,0.75), rgba(60,22,30,0.6))',
        glow: '#f08a3c',
        seeThrough: true,
      },
    },
  ],
  1770: [
    { id: 'regular', icon: '🍖', label: { ru: 'Обычное', uk: 'Звичайне' }, effect: BY_CATEGORY_ID[1770] },
    {
      id: 'vegetarian',
      icon: '🥦',
      label: { ru: 'Вегетарианское', uk: 'Вегетаріанське' },
      effect: { kind: 'video', videoSrc: '/course/effects/bon-appetit-vegetarian-loop.mp4', accent: '#4f9e5a', background: bg('79,158,90'), glow: '#4f9e5a' },
    },
  ],
  1771: [
    // Третий вариант отключён на курсе; исходная запись сохранена, копия ниже — только для тестовой страницы.
    // { id: 'balloons', icon: '🎈', label: { ru: 'Воздушные шары', uk: 'Повітряні кульки' }, effect: BY_CATEGORY_ID[1771] },
    {
      id: 'balloons', icon: '🎈', label: { ru: 'Воздушные шары', uk: 'Повітряні кульки' },
      hidden: true, effect: BY_CATEGORY_ID[1771],
    },
  ],
  1782: [
    { id: 'lantern-water-body', icon: '🌌', label: { ru: 'Фонари на весь фон', uk: 'Ліхтарі на все тло' }, effect: BY_CATEGORY_ID[1782] },
    {
      id: 'lantern-water', icon: '🏮', label: { ru: 'Фонари в карточке', uk: 'Ліхтарі в картці' },
      hidden: true,
      effect: { kind: 'lantern-water', accent: '#ffb04d', background: 'linear-gradient(180deg, #05081c, #101a40 70%, #1b2a55)', glow: '#ffb04d' },
    },
  ],
  1783: [
    { id: 'voxel-led-cube', icon: '🧊', label: { ru: 'Светодиодный куб', uk: 'Світлодіодний куб' }, effect: BY_CATEGORY_ID[1783] },
    {
      id: 'fireworks', icon: '🎆', label: { ru: 'Фейерверк над Ригой', uk: 'Феєрверк над Ригою' },
      // One effect in two places: the show over the river plays in the card and over the whole page.
      effect: { kind: 'scene', sceneId: 'fireworks', accent: '#e0524f', background: 'linear-gradient(180deg, rgba(4,6,18,0.85), rgba(2,3,8,0.75))', glow: '#e0524f', bodyEffect: { scene: 'fireworks' }, alsoInCard: true },
    },
    {
      id: 'prom-board', icon: '🎄', label: { ru: 'Ёлочка с гирляндой и платой', uk: 'Ялинка з гірляндою та платою' },
      effect: { kind: 'scene', sceneId: 'prom-board', sceneParams: { preset: 1 }, accent: '#8fffe0',
        background: '#07080a', glow: 'rgba(143,255,224,0.4)', bodyEffect: { scene: 'prom-board' } },
    },
  ],
  1792: [
    /* Остальные варианты отключены по просьбе владельца; движки сохранены для тестовой страницы.
    { id: 'led-matrix', icon: '🟩', label: { ru: 'LED-экран', uk: 'LED-екран' }, effect: { kind: 'scene', sceneId: 'led-matrix', accent: '#ff2a4d', background: bg('60,220,230'), glow: '#ff2a4d' } },
    {
      id: 'digital-rain',
      icon: '🌧️',
      label: { ru: 'Код-дождь', uk: 'Код-дощ' },
      effect: { kind: 'scene', sceneId: 'digital-rain', accent: '#4fd8e0', background: bg('60,220,230'), glow: '#4fd8e0' },
    },
    */
    {
      // A monochrome graphic LCD module off its board: 4 grey levels, slow pixels, flex cable and zebra strip, scratched window.
      id: 'lcd-screen',
      icon: '📟',
      label: { ru: 'ЖК-экран', uk: 'РК-екран' },
      effect: BY_CATEGORY_ID[1792],
    },
    /*
    {
      // A nixie tube clock on a wooden base, real time; the tubes' glow path traced into the room and baked.
      id: 'nixie-clock',
      icon: '🕰️',
      label: { ru: 'Часы на лампах', uk: 'Годинник на лампах' },
      effect: { kind: 'scene', sceneId: 'nixie-clock', accent: '#ff8a3a', background: 'linear-gradient(180deg, rgba(20,10,6,0.82), rgba(8,4,3,0.7))', glow: '#ff8a3a' },
    },
    {
      // The same clock over the whole page; the card keeps only its tone.
      id: 'nixie-clock-full',
      icon: '🔆',
      label: { ru: 'Часы на лампах — весь фон', uk: 'Годинник на лампах — усе тло' },
      effect: { kind: 'scene', sceneId: 'nixie-clock', accent: '#ff8a3a', background: 'linear-gradient(180deg, rgba(20,10,6,0.82), rgba(8,4,3,0.7))', glow: '#ff8a3a', bodyEffect: { scene: 'nixie-clock' } },
    },
    */
  ],
  1774: [
    { id: 'optics-crystals', icon: '💎', label: { ru: 'Кристаллы и капли', uk: 'Кристали й краплі' }, effect: BY_CATEGORY_ID[1774] },
    {
      id: 'optics-bench',
      icon: '🔍',
      label: { ru: 'Оптическая скамья', uk: 'Оптична лава' },
      effect: { ...BY_CATEGORY_ID[1774], sceneParams: { opticsSet: 0 } },
    },
    {
      id: 'chalkboard',
      icon: '🧑‍🏫',
      label: { ru: 'Меловая доска', uk: 'Крейдяна дошка' },
      hidden: true,
      effect: { kind: 'scene', sceneId: 'chalkboard', accent: '#7aa3d9', background: bg('122,163,217'), glow: '#7aa3d9' },
    },
  ],
};

// These new full-page worlds are additive. Preserve the old objects and stable variant IDs before
// replacing the default, so saved selections and every existing alternative continue to resolve.
for (const meta of CINEMATIC_CATALOG) {
  const previous = BY_CATEGORY_ID[meta.categoryId];
  const alternatives = VARIANTS_BY_CATEGORY_ID[meta.categoryId] ?? [{
    id: `legacy-${meta.categoryId}`, icon: '↩️', label: { ru: meta.oldRu, uk: meta.oldUk }, effect: previous,
  }];
  const effect: GroupEffectDefinition = {
    kind: 'scene', sceneId: meta.id, accent: meta.color,
    background: 'transparent', glow: 'transparent', bodyEffect: { scene: meta.id }, bodyOnly: true,
  };
  BY_CATEGORY_ID[meta.categoryId] = effect;
  VARIANTS_BY_CATEGORY_ID[meta.categoryId] = [{ id: meta.id, icon: meta.icon, label: { ru: meta.ru, uk: meta.uk }, effect }, ...alternatives];
}

// Restored full-page prototypes coexist with the current scene and the older card effects.
for (const meta of CINEMATIC_ALTERNATIVES) {
  VARIANTS_BY_CATEGORY_ID[meta.categoryId].splice(1, 0, {
    id: meta.id, icon: meta.icon, label: { ru: meta.ru, uk: meta.uk },
    effect: { kind: 'scene', sceneId: meta.id, accent: meta.color, background: 'transparent', glow: 'transparent', bodyEffect: { scene: meta.id }, bodyOnly: true },
  });
}

// The owner kept only the third greeting look. Retired saved IDs fall back to this default too.
VARIANTS_BY_CATEGORY_ID[1763] = VARIANTS_BY_CATEGORY_ID[1763].filter((variant) => variant.id === 'legacy-1763');
BY_CATEGORY_ID[1763] = VARIANTS_BY_CATEGORY_ID[1763][0].effect;

// Shopping keeps the former third look. Retired first/second saved selections fall back to it.
VARIANTS_BY_CATEGORY_ID[1769] = VARIANTS_BY_CATEGORY_ID[1769].filter(variant => variant.id !== 'midnight-arcade' && variant.id !== 'neon-market');
BY_CATEGORY_ID[1769] = VARIANTS_BY_CATEGORY_ID[1769][0].effect;

// The transport category now has one open sleeping-car scene; all retired saved choices fall back to it.
VARIANTS_BY_CATEGORY_ID[1767] = CINEMATIC_TRAVEL.map((meta) => ({
  id: meta.id, icon: meta.icon, label: { ru: meta.ru, uk: meta.uk },
  effect: { kind: 'scene', sceneId: meta.id, accent: meta.color, background: 'transparent', glow: 'transparent', bodyEffect: { scene: meta.id }, bodyOnly: true },
}));
BY_CATEGORY_ID[1767] = VARIANTS_BY_CATEGORY_ID[1767][0].effect;

// Owner restored the classic reactor; Skyline stays in the experimental gallery, not in the course.
BY_CATEGORY_ID[1771] = { ...BY_CATEGORY_ID[1783], sceneParams: { lcMode: 0, leisurePinball: 1 } };
VARIANTS_BY_CATEGORY_ID[1771].unshift({
  id: 'voxel-led-cube', icon: '🧊',
  label: { ru: 'Светодиодный куб', uk: 'Світлодіодний куб' },
  effect: BY_CATEGORY_ID[1771],
});

/** The variants offered on a group's card (the put-aside ones are left out). */
// The old forge/cinematic builders stay in the archive; this group now runs only the pottery wheel.
BY_CATEGORY_ID[1793] = { kind: 'scene', background: 'transparent', glow: 'transparent', bodyOnly: true, bodyEffect: 'pottery' };
VARIANTS_BY_CATEGORY_ID[1793] = [{ id: 'pottery-wheel', icon: '◉', label: { ru: 'Гончарный круг', uk: 'Гончарне коло' }, effect: BY_CATEGORY_ID[1793] }];

// Additive transfers from the experimental gallery: same interaction, independent instance settings.
for (const [categoryId, id, ru, uk, icon] of [
  [1789, 'fogged-blackheads', 'Дом Черноголовых за стеклом', 'Будинок Чорноголових за склом', '🌃'],
  [1784, 'zero-gravity-drop', 'Капля в невесомости', 'Крапля в невагомості', '💧'],
  [1784, 'domino-archipelago', 'Цепная реакция знаний', 'Ланцюгова реакція знань', '🧩'],
  [1772, 'highway-panorama', 'Генеративная трасса — панорама', 'Генеративна траса — панорама', '🛣️'],
] as const) {
  VARIANTS_BY_CATEGORY_ID[categoryId] ??= [{ id: `legacy-${categoryId}`, icon: '↩️', label: { ru: 'Исходный вариант', uk: 'Початковий варіант' }, effect: BY_CATEGORY_ID[categoryId] }];
  VARIANTS_BY_CATEGORY_ID[categoryId].push({ id, icon, label: { ru, uk }, effect: {
    kind: 'scene', sceneId: id, background: 'transparent', glow: 'transparent', bodyOnly: true, bodyEffect: { scene: id },
  } });
}

// Give the existing misted-city scene its own icon/name, not the generic archive-return arrow.
const eveningWindow = VARIANTS_BY_CATEGORY_ID[1789].find(variant => variant.id === 'legacy-1789')!;
eveningWindow.icon = '🌧️';
eveningWindow.label = { ru: 'Вечерний город за стеклом', uk: 'Вечірнє місто за склом' };

// One road, not separate card/background copies. The rainy street remains its own untouched effect.
VARIANTS_BY_CATEGORY_ID[1772] = ['highway-panorama', 'street-relight'].map(id => VARIANTS_BY_CATEGORY_ID[1772].find(variant => variant.id === id)!);
BY_CATEGORY_ID[1772] = VARIANTS_BY_CATEGORY_ID[1772][0].effect;

// Owner kept only the former first and fifth career effects. Retired saved selections fall back to the first.
VARIANTS_BY_CATEGORY_ID[1784] = VARIANTS_BY_CATEGORY_ID[1784].filter(variant => variant.id === 'knowledge-launch' || variant.id === 'zero-gravity-drop');
const careerDrop = VARIANTS_BY_CATEGORY_ID[1784].find(variant => variant.id === 'zero-gravity-drop')!;
careerDrop.effect = { ...careerDrop.effect, sceneParams: { ...careerDrop.effect.sceneParams, zgLayout: 1 } };
BY_CATEGORY_ID[1784] = VARIANTS_BY_CATEGORY_ID[1784][0].effect;

// «Какие мы»: keep only the former last look; stale selections also resolve to this constellation.
VARIANTS_BY_CATEGORY_ID[1776] = VARIANTS_BY_CATEGORY_ID[1776].filter(variant => variant.id === 'legacy-1776');
BY_CATEGORY_ID[1776] = VARIANTS_BY_CATEGORY_ID[1776][0].effect;

// Family keeps its original photo garland; retired saved choices resolve to it as well.
VARIANTS_BY_CATEGORY_ID[1775] = VARIANTS_BY_CATEGORY_ID[1775].filter(variant => variant.id === 'legacy-1775');
VARIANTS_BY_CATEGORY_ID[1775][0].icon = '📷';
BY_CATEGORY_ID[1775] = VARIANTS_BY_CATEGORY_ID[1775][0].effect;

// Apply after the additive cinematic catalog, so neither old saved IDs nor its defaults restore a second look.
VARIANTS_BY_CATEGORY_ID[1787] = VARIANTS_BY_CATEGORY_ID[1787].filter(variant => variant.id === 'fireflies');
BY_CATEGORY_ID[1787] = VARIANTS_BY_CATEGORY_ID[1787][0].effect;

// One effect chooses a picture per activation; all four stories are selectable in public settings.
VARIANTS_BY_CATEGORY_ID[1786] = [
  { id: 'late-stories', icon: '💌', label: { ru: 'Никогда не поздно · истории', uk: 'Ніколи не пізно · історії' },
    effect: { kind: 'scene', sceneId: 'late-stories', accent: '#d4aa72',
      background: 'transparent', glow: 'transparent', bodyEffect: { scene: 'late-stories' } } },
  // ...VARIANTS_BY_CATEGORY_ID[1786], // «Вторая весна», «Второй шанс · золотые швы», часовой механизм.
  // Their standalone scene definitions remain available in the test gallery; stale course IDs use the default.
];
BY_CATEGORY_ID[1786] = VARIANTS_BY_CATEGORY_ID[1786][0].effect;

// Replacement compositions: retired planner/neighbourhood selections resolve to the new default.
for (const [categoryId, id, icon, ru, uk] of [
  [1779, 'week-gardens', '🌱', 'Семь садов недели', 'Сім садів тижня'],
  [1788, 'folding-home', '🏡', 'Дом в разрезе', 'Будинок у розрізі'],
] as const) {
  const effect: GroupEffectDefinition = { kind: 'scene', sceneId: id, background: 'transparent', glow: 'transparent', bodyEffect: { scene: id } };
  BY_CATEGORY_ID[categoryId] = effect;
  VARIANTS_BY_CATEGORY_ID[categoryId] = [{ id, icon, label: { ru, uk }, effect }];
}
VARIANTS_BY_CATEGORY_ID[1779].push({
  id:'week-book',icon:'📖',label:{ru:'Книга недели',uk:'Книга тижня'},
  effect:{kind:'scene',sceneId:'week-book',background:'transparent',glow:'transparent',bodyEffect:{scene:'week-book'}},
});

// 2026-10-30 (owner: «придумай парочку крутых эффектов для карточек»): new compositions offered beside the current ones
// (the current default stays first). One scene each: compact on the right in a card, the whole world on a page.
for (const [categoryId, id, icon, ru, uk] of [
  [1775, 'family-campfire', '🔥', 'Вечер у костра', 'Вечір біля багаття'],
  // Owner 2026-10-30: 1779 keeps only the week book (below); the library is put aside to the admin test gallery.
  // [1779, 'day-astrolabe', '🧭', 'Астролябия дня', 'Астролябія дня'],
  // [1784, 'spiral-library', '📚', 'Бесконечная библиотека', 'Нескінченна бібліотека'],
  [1788, 'snow-globe-town', '❄️', 'Снежный шар с городком', 'Сніжна куля з містечком'],
] as const) {
  VARIANTS_BY_CATEGORY_ID[categoryId].push({ id, icon, label: { ru, uk }, effect: {
    kind: 'scene', sceneId: id, background: 'transparent', glow: 'transparent', bodyEffect: { scene: id },
  } });
}

// 1767 (owner, 2026-10-30: «добавь ещё вариант на основе дефолта, только подними детализацию»): the same platskart,
// its detailed look (platDetail) at a higher render resolution.
{
  const platskart = VARIANTS_BY_CATEGORY_ID[1767][0];
  VARIANTS_BY_CATEGORY_ID[1767].push({
    id: 'platskart-detailed', icon: '🚆', label: { ru: 'Плацкарт · высокая детализация', uk: 'Плацкарт · висока деталізація' },
    effect: { ...platskart.effect, sceneParams: { ...platskart.effect.sceneParams, platDetail: 1, quality: 1.3 } },
  });
}

// 1771 (owner, 2026-10-30: «слева игру можешь более красочной сделать и интересной, как ещё один вариант»): the same cube,
// the left pinball in its carnival «Fiesta» dress (pinballFiesta.ts: levels, jackpot, ball save, confetti).
VARIANTS_BY_CATEGORY_ID[1771].push({
  id: 'pinball-fiesta', icon: '🎡', label: { ru: 'Куб и пинбол «Фиеста»', uk: 'Куб і пінбол «Фієста»' },
  effect: { ...BY_CATEGORY_ID[1771], sceneParams: { ...BY_CATEGORY_ID[1771].sceneParams, leisurePinball: 3 } },
});

// 1779 «Мой планировщик» (owner, 2026-10-30: «удали все эффекты кроме книги»): the week book alone, as the default.
// Retired saved choices (gardens, planner, focus clock, astrolabe) resolve to it.
VARIANTS_BY_CATEGORY_ID[1779] = VARIANTS_BY_CATEGORY_ID[1779].filter(variant => variant.id === 'week-book');
BY_CATEGORY_ID[1779] = VARIANTS_BY_CATEGORY_ID[1779][0].effect;

export function getGroupEffectVariants(categoryId: number | null): GroupEffectVariant[] | null {
  const all = categoryId != null ? VARIANTS_BY_CATEGORY_ID[categoryId] : undefined;
  return all ? all.filter((v) => !v.hidden) : null;
}

/** The put-aside variants, for the effects test page. */
export function getHiddenGroupEffectVariants(): { categoryId: number; variant: GroupEffectVariant }[] {
  return Object.entries(VARIANTS_BY_CATEGORY_ID).flatMap(([id, list]) => list.filter((v) => v.hidden).map((variant) => ({ categoryId: Number(id), variant })));
}

export function getGroupEffect({ categoryId, title, variantId }: { categoryId: number | null; title: string | null; variantId?: string | null }): GroupEffectDefinition | null {
  if (title && INTRO_TITLES.has(title)) return INTRO_EFFECT;
  // Put-aside variants resolve too (the test page shows them); the card only ever asks for offered ones.
  const variant = variantId && categoryId != null ? VARIANTS_BY_CATEGORY_ID[categoryId]?.find((v) => v.id === variantId) : undefined;
  if (variant) return variant.effect;
  if (categoryId != null && BY_CATEGORY_ID[categoryId]) return BY_CATEGORY_ID[categoryId];
  return null;
}
