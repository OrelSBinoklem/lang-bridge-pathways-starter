/**
 * Data for the tutor avatar: emotions as weights of the VRoid face morphs (brows, eyes and mouth separately, so the
 * mouth part can step back while the avatar speaks), conversation states, and the body motions: Mixamo animations
 * retargeted to the VRM rig (tools/avatar/convert-mixamo.mjs → /models/avatar/anim/<file>.json).
 * Small head offsets on top are in the VRM normalized rig (model faces +Z): +x pitches the head forward.
 */

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type Framing = 'portrait' | 'bust' | 'full';

type Morphs = Record<string, number>;
export type Emotion = { label: string; face: Morphs; mouth: Morphs; tilt?: number; pitch?: number };

export const EMOTIONS = {
  neutral: { label: 'Спокойно', face: {}, mouth: {} },
  smile: { label: 'Улыбка', face: { Fcl_BRW_Fun: 0.6, Fcl_EYE_Fun: 0.3 }, mouth: { Fcl_MTH_Fun: 0.7 } },
  joy: { label: 'Радость ^^', face: { Fcl_BRW_Joy: 1, Fcl_EYE_Joy: 1 }, mouth: { Fcl_MTH_Joy: 0.8 }, pitch: -0.04 },
  praise: { label: 'Похвала', face: { Fcl_BRW_Fun: 0.8, Fcl_EYE_Joy: 0.55 }, mouth: { Fcl_MTH_Joy: 0.6 }, tilt: 0.08 },
  surprised: { label: 'Удивление', face: { Fcl_BRW_Surprised: 1, Fcl_EYE_Surprised: 0.8 }, mouth: { Fcl_MTH_Surprised: 0.7 }, pitch: -0.05 },
  sad: { label: 'Грусть', face: { Fcl_BRW_Sorrow: 1, Fcl_EYE_Sorrow: 0.6 }, mouth: { Fcl_MTH_Sorrow: 0.6 }, pitch: 0.08 },
  strict: { label: 'Строго', face: { Fcl_BRW_Angry: 0.75, Fcl_EYE_Angry: 0.45 }, mouth: { Fcl_MTH_Angry: 0.35 } },
  doubt: { label: 'Сомнение', face: { Fcl_BRW_Angry: 0.4, Fcl_EYE_Angry: 0.25 }, mouth: { Fcl_MTH_Down: 0.5, Fcl_MTH_Small: 0.3 }, tilt: -0.1 },
  think: { label: 'Задумалась', face: { Fcl_BRW_Sorrow: 0.3 }, mouth: { Fcl_MTH_Small: 0.5 }, tilt: -0.08 },
  shy: { label: 'Смущение', face: { Fcl_BRW_Sorrow: 0.45, Fcl_EYE_Joy: 0.35 }, mouth: { Fcl_MTH_Small: 0.6 }, tilt: 0.12, pitch: 0.06 },
  wink: { label: 'Подмигнуть', face: { Fcl_BRW_Fun: 0.4, Fcl_EYE_Close_R: 1 }, mouth: { Fcl_MTH_Fun: 0.6 }, tilt: 0.06 },
  sleepy: { label: 'Зевает', face: { Fcl_EYE_Close: 0.7, Fcl_BRW_Sorrow: 0.35 }, mouth: { Fcl_MTH_O: 0.9 }, pitch: -0.06 },
} satisfies Record<string, Emotion>;
export type EmotionName = keyof typeof EMOTIONS;

/** Slow pose targets per state; the avatar eases toward them. look = gaze offset from the viewer (x right, y up). */
export type StatePose = { lean: number; tilt: number; pitch: number; look: [number, number]; brows: number; smile: number };
export const STATES: Record<AvatarState, { label: string; pose: StatePose }> = {
  idle: { label: 'Ждёт', pose: { lean: 0, tilt: 0, pitch: 0, look: [0, 0], brows: 0, smile: 0.2 } },
  listening: { label: 'Слушает', pose: { lean: 0.06, tilt: 0.1, pitch: 0.03, look: [0, 0], brows: 0.25, smile: 0.3 } },
  thinking: { label: 'Думает', pose: { lean: -0.02, tilt: -0.12, pitch: -0.08, look: [-0.35, 0.4], brows: 0, smile: 0 } },
  speaking: { label: 'Говорит', pose: { lean: 0.03, tilt: 0, pitch: 0, look: [0, 0], brows: 0, smile: 0.15 } },
};

/** Body motions. Loops carry a state or an idle stance; the others play once and return to the loop. */
export type Motion = { file: string; label: string; loop?: boolean; extra?: boolean };
export const MOTIONS = {
  breathing: { file: 'breathing-idle', label: 'Дышит', loop: true },
  idle: { file: 'idle', label: 'Стоит', loop: true },
  idleShift: { file: 'idle-1', label: 'Переминается', loop: true },
  idleHappy: { file: 'happy-idle', label: 'Весело ждёт', loop: true },
  thinking: { file: 'thinking', label: 'Думает', loop: true },
  talking: { file: 'talking', label: 'Говорит', loop: true },
  arguing: { file: 'standing-arguing', label: 'Горячо объясняет', loop: true },
  nod: { file: 'head-nod-yes', label: 'Кивнуть' },
  shake: { file: 'shaking-head-no', label: 'Нет-нет' },
  wave: { file: 'waving', label: 'Помахать' },
  waveShort: { file: 'waving-1', label: 'Коротко помахать' },
  thumbsUp: { file: 'standing-thumbs-up', label: 'Класс!' },
  thanks: { file: 'thankful', label: 'Спасибо' },
  bow: { file: 'quick-informal-bow', label: 'Поклон' },
  shrug: { file: 'shrugging', label: 'Пожать плечами' },
  stretch: { file: 'arm-stretching', label: 'Потянуться' },
  yawn: { file: 'yawn', label: 'Зевнуть' },
  bored: { file: 'bored', label: 'Скучает' },
  lookAround: { file: 'look-around', label: 'Оглядеться' },
  lookingAround: { file: 'looking-around', label: 'Осмотреться' },
  looking: { file: 'looking', label: 'Высматривает' },
  lookBehind: { file: 'looking-behind', label: 'Оглянуться' },
  turnLeft: { file: 'unarmed-turn-left-90', label: 'Поворот налево', extra: true },
  walkCircle: { file: 'walk-in-circle', label: 'Ходит по кругу', extra: true },
  rope: { file: 'pulling-a-rope', label: 'Тянет канат', extra: true },
  phone: { file: 'talking-on-a-cell-phone', label: 'Говорит по телефону', extra: true },
  talkingSeated: { file: 'talking-1', label: 'Говорит сидя (нужен стул)', loop: true, extra: true },
} satisfies Record<string, Motion>;
export type MotionName = keyof typeof MOTIONS;

/** Loops per state; idle picks one of its stances now and then. */
export const STATE_LOOPS: Record<AvatarState, MotionName[]> = {
  idle: ['breathing', 'idle', 'idleShift', 'idleHappy'],
  listening: ['breathing'],
  thinking: ['thinking'],
  speaking: ['talking', 'arguing'],
};

/** What the avatar does on its own when nothing happens: a motion and/or a short emotion, picked by weight. */
export const IDLE_ACTS: { label: string; weight: number; motion?: MotionName; emotion?: EmotionName; ms?: number; tilt?: boolean }[] = [
  { label: 'оглядывается', weight: 2, motion: 'lookingAround' },
  { label: 'высматривает', weight: 1.2, motion: 'looking' },
  { label: 'осматривает всё вокруг', weight: 0.8, motion: 'lookAround' },
  { label: 'улыбается', weight: 3, emotion: 'smile', ms: 2600 },
  { label: 'наклоняет голову', weight: 2, emotion: 'smile', ms: 1800, tilt: true },
  { label: 'потягивается', weight: 1, motion: 'stretch', emotion: 'joy', ms: 2500 },
  { label: 'зевает', weight: 0.7, motion: 'yawn', emotion: 'sleepy', ms: 2600 },
  { label: 'скучает', weight: 0.8, motion: 'bored', emotion: 'doubt', ms: 2500 },
  { label: 'смущается', weight: 1, emotion: 'shy', ms: 2200 },
  { label: 'подмигивает', weight: 0.5, emotion: 'wink', ms: 900 },
  { label: 'радуется', weight: 0.7, emotion: 'joy', ms: 1800 },
];
