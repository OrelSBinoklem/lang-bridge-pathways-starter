/**
 * The cat is animated through one flat set of pose parameters. Postures, actions and emotions only describe
 * target values; the model eases toward them every frame, so any switch blends by itself. Leg values are paw
 * targets in the body frame (solved by IK), angles are radians.
 */
import { boneAt } from './catRig';
import { clamp, smooth } from './catMath';

const hand = boneAt('handL'), hock = boneAt('hockL'), foot = boneAt('footL');
const META = Math.atan2(foot[1] - hock[1], foot[0] - hock[0]);

export const POSE_DEFAULTS = {
  bodyX: 0, bodyY: 0, bodyPitch: 0, bodyRoll: 0, squash: 1, stretch: 1,
  hips: 0, spine1: 0, spine2: 0, bend: 0, twist: 0,
  neck: 0, headPitch: 0, headYaw: 0, headRoll: 0, jaw: 0,
  earBackL: 0, earOutL: 0, earTurnL: 0, earBackR: 0, earOutR: 0, earTurnR: 0,
  tailLift: 0.35, tailCurl: 0.5, tailSide: 0, tailSideCurl: 0, tailWave: 0.12, tailSpeed: 1, tailPuff: 1,
  flX: hand[0], flY: hand[1], flTilt: 0, flRaise: 0, flA1: -1.2, flA2: -1.2, flA3: 0,
  frX: hand[0], frY: hand[1], frTilt: 0, frRaise: 0, frA1: -1.2, frA2: -1.2, frA3: 0,
  hlX: hock[0], hlY: hock[1], hlMeta: META, hlFoot: 0,
  hrX: hock[0], hrY: hock[1], hrMeta: META, hrFoot: 0,
  lidUp: 0.12, lidLow: 0, lidTilt: 0, wink: 0, pupil: 0.38, lookX: 0, lookY: 0,
  whisk: 0, blush: 0, purr: 0, pointer: 0, legsBody: 0, happyEyes: 0,
};
export type PoseKey = keyof typeof POSE_DEFAULTS;
export type Pose = Record<PoseKey, number>;
export type PartialPose = Partial<Pose>;

export const META_BIND = META;

/** Base postures every action starts from. */
export const POSTURES = {
  stand: { neck: 0.12, headPitch: -0.08 } as PartialPose,
  sit: {
    bodyX: 0.06, bodyY: -0.31, hips: 0.82, spine1: 0.08, spine2: 0.05, neck: -0.5, headPitch: -0.38,
    flX: 0.13, flY: 0.033, frX: 0.13, frY: 0.033, flTilt: -0.15, frTilt: -0.15,
    hlX: -0.26, hlY: 0.03, hlMeta: 0, hrX: -0.26, hrY: 0.03, hrMeta: 0,
    tailLift: -0.75, tailCurl: 0.15, tailSide: 1.05, tailSideCurl: 1.6, tailWave: 0.05,
  } as PartialPose,
  lie: {
    bodyY: -0.32, hips: 0.02, spine1: 0.02, spine2: 0.04, neck: 0.12, headPitch: -0.12,
    flX: 0.19, flY: 0.03, frX: 0.21, frY: 0.03, flTilt: 0.05, frTilt: 0.05,
    hlX: -0.2, hlY: 0.04, hlMeta: 0.15, hrX: -0.18, hrY: 0.04, hrMeta: 0.15,
    tailLift: -0.35, tailCurl: 0.05, tailSide: 0.95, tailSideCurl: 1.4, tailWave: 0.04,
  } as PartialPose,
  crouch: {
    bodyY: -0.13, hips: -0.08, spine1: 0.03, spine2: 0.04, neck: 0.2, headPitch: -0.2,
    flX: 0.24, frX: 0.24, hlX: -0.24, hrX: -0.24, hlY: 0.07, hrY: 0.07, tailLift: -0.1, tailCurl: 0.1, tailWave: 0.05,
  } as PartialPose,
};
export type Posture = keyof typeof POSTURES;

export type ActionContext = {
  /** Pointing direction in the body frame: angle above the horizontal toward the front. */
  pointAngle: number;
  /** -1 left .. 1 right relative to where the cat faces the camera. */
  pointSide: number;
};
type ActionDef = { label: string; posture: Posture; duration: number; lockHead?: boolean; pose: (t: number, ctx: ActionContext) => PartialPose; sprites?: [number, SpriteKind][] };

const wave = (t: number, f: number, a = 1) => Math.sin(t * f * Math.PI * 2) * a;
/** Ramp in over `a` seconds and out over the last `b` seconds of `d`. */
const env = (t: number, d: number, a = 0.35, b = 0.4) => smooth(0, a, t) * (1 - smooth(d - b, d, t));

export type SpriteKind = 'heart' | 'anger' | 'sweat' | 'exclaim' | 'question' | 'sparkle' | 'zzz' | 'note' | 'gloom' | 'tear' | 'dots';

export const ACTIONS = {
  idle: { label: 'Сидит', posture: 'sit', duration: 0, pose: t => ({ spine2: 0.05 + wave(t, 0.25, 0.012), headRoll: wave(t, 0.09, 0.04) }) },
  stand: { label: 'Стоит', posture: 'stand', duration: 0, pose: t => ({ spine1: wave(t, 0.25, 0.01), tailWave: 0.15 }) },
  lie: { label: 'Лежит (буханка)', posture: 'lie', duration: 0, pose: t => ({ spine1: 0.02 + wave(t, 0.22, 0.012) }) },
  walk: {
    label: 'Шагает на месте', posture: 'stand', duration: 0, pose: t => {
      const p = t * 1.6, step = (o: number) => {
        const ph = ((p + o) % 1 + 1) % 1, swing = ph < 0.6 ? 1 - ph / 0.6 * 2 : -1 + (ph - 0.6) / 0.4 * 2;
        return { dx: swing * 0.07, dy: ph >= 0.6 ? Math.sin((ph - 0.6) / 0.4 * Math.PI) * 0.05 : 0 };
      };
      const lh = step(0), lf = step(0.25), rh = step(0.5), rf = step(0.75);
      return {
        bodyY: wave(t, 3.2, 0.008) - 0.01, bend: wave(t, 1.6, 0.06), headYaw: wave(t, 1.6, -0.05), tailWave: 0.2, tailSpeed: 1.6,
        flX: hand[0] + lf.dx, flY: hand[1] + lf.dy, frX: hand[0] + rf.dx, frY: hand[1] + rf.dy,
        hlX: hock[0] + lh.dx, hlY: hock[1] + lh.dy, hrX: hock[0] + rh.dx, hrY: hock[1] + rh.dy, flTilt: lf.dy * 4, frTilt: rf.dy * 4,
      };
    },
  },
  wave: {
    label: 'Машет лапой', posture: 'sit', duration: 2.6, pose: t => {
      const e = env(t, 2.6, 0.3, 0.35);
      return { frRaise: e, frA1: 0.55 + wave(t, 2.2, 0.18), frA2: 1.35 + wave(t, 2.2, 0.32), frA3: 1.4 + wave(t, 2.2, 0.35), headRoll: -0.12 * e, headYaw: 0.1 * e, bodyRoll: 0.05 * e };
    },
  },
  point: {
    label: 'Указывает', posture: 'sit', duration: 3.2, lockHead: true, pose: (t, c) => {
      const e = env(t, 3.2, 0.3, 0.35), a = clamp(c.pointAngle, -0.9, 1.1);
      return { frRaise: e, frA1: a * 0.7 + 0.15, frA2: a + 0.05, frA3: a + 0.1, headPitch: -0.38 + a * 0.3 * e, headYaw: 0.25 * e * c.pointSide, bodyRoll: 0.04 * e, spine2: 0.05 + 0.06 * e, pointer: e, earBackL: -0.15 * e, earBackR: -0.15 * e };
    },
  },
  stretch: {
    label: 'Потягивается', posture: 'stand', duration: 3.4, pose: t => {
      const e = env(t, 3.4, 0.6, 0.7);
      return { hips: -0.45 * e, spine1: 0.08 * e, spine2: 0.12 * e, bodyY: -0.05 * e, neck: 0.25 - 0.1 * e, headPitch: -0.08 + 0.35 * e, flX: hand[0] + 0.2 * e, frX: hand[0] + 0.22 * e, flTilt: 0.2 * e, frTilt: 0.2 * e, hlX: hock[0] - 0.05 * e, hrX: hock[0] - 0.05 * e, tailLift: 0.35 + 0.6 * e, tailCurl: 0.3, jaw: smooth(1.2, 1.7, t) * (1 - smooth(2.3, 2.7, t)) * 0.9, lidUp: 0.12 + 0.75 * smooth(1.1, 1.6, t) * (1 - smooth(2.4, 2.8, t)), earBackL: 0.3 * e, earBackR: 0.3 * e };
    },
  },
  yawn: {
    label: 'Зевает', posture: 'sit', duration: 2.6, lockHead: true, pose: t => {
      const e = smooth(0.2, 0.8, t) * (1 - smooth(1.7, 2.3, t));
      return { jaw: e, headPitch: -0.38 + 0.4 * e, lidUp: 0.12 + 0.8 * e, earBackL: 0.35 * e, earBackR: 0.35 * e, earOutL: 0.2 * e, earOutR: 0.2 * e, whisk: -0.6 * e, spine2: 0.05 + 0.05 * e };
    },
  },
  groom: {
    label: 'Умывается', posture: 'sit', duration: 4.4, lockHead: true, pose: t => {
      const e = env(t, 4.4, 0.4, 0.5), lick = Math.max(0, wave(t, 1.3));
      return { frRaise: e, frA1: 0.95, frA2: 2.25 + lick * 0.15, frA3: 2.9, headPitch: -0.2 + lick * 0.25 * e, headYaw: 0.35 * e, headRoll: -0.15 * e, jaw: 0.25 * lick * e, lidUp: 0.12 + 0.55 * e };
    },
  },
  arch: {
    label: 'Рижская поза (дугой)', posture: 'stand', duration: 3.4, pose: t => {
      const e = env(t, 3.4, 0.35, 0.5);
      return { bodyY: 0.07 * e, hips: 0.5 * e, spine1: -0.42 * e, spine2: -0.32 * e, neck: 0.12 + 0.32 * e, headPitch: -0.08 - 0.1 * e, headYaw: -1.05 * e, tailLift: 0.35 + 0.95 * e, tailCurl: 0.5 - 0.9 * e, tailWave: 0.02, tailPuff: 1 + 0.55 * e, earBackL: 0.8 * e, earBackR: 0.8 * e, earOutL: 0.35 * e, earOutR: 0.35 * e, jaw: 0.55 * smooth(0.6, 0.9, t) * (1 - smooth(2.4, 2.9, t)), pupil: 0.38 - 0.25 * e, lidTilt: 0.7 * e };
    },
  },
  nod: { label: 'Кивает «да»', posture: 'sit', duration: 1.8, lockHead: true, pose: t => ({ headPitch: -0.38 - Math.max(0, wave(t, 1.7)) * 0.3 * env(t, 1.8, 0.2, 0.3), earBackL: -0.1, earBackR: -0.1 }) },
  shake: { label: 'Мотает «нет»', posture: 'sit', duration: 1.8, lockHead: true, pose: t => ({ headYaw: wave(t, 2.2, 0.38) * env(t, 1.8, 0.2, 0.3), lidUp: 0.3, earOutL: 0.2, earOutR: 0.2 }) },
  dance: {
    label: 'Танцует', posture: 'sit', duration: 4.8, pose: t => {
      const e = env(t, 4.8, 0.4, 0.5), b = wave(t, 1.5);
      return { bodyRoll: b * 0.12 * e, bodyY: -0.31 + Math.abs(b) * 0.04 * e, headRoll: -b * 0.22 * e, headYaw: b * 0.2 * e, frRaise: e, flRaise: e, frA1: 0.6 + b * 0.3, frA2: 1.6 + b * 0.3, frA3: 1.8, flA1: 0.6 - b * 0.3, flA2: 1.6 - b * 0.3, flA3: 1.8, tailWave: 0.4, tailSpeed: 1.5, lidLow: 0.35, lidUp: 0.35 };
    },
    sprites: [[0.4, 'note'], [1.6, 'note'], [2.8, 'note'], [3.9, 'note']],
  },
  think: {
    label: 'Думает', posture: 'sit', duration: 3.6, lockHead: true, pose: t => {
      const e = env(t, 3.6, 0.4, 0.5);
      return { frRaise: e, frA1: 0.85, frA2: 2.0, frA3: 2.45, headPitch: -0.38 + 0.25 * e, headYaw: -0.25 * e, headRoll: 0.18 * e, lookX: -0.6 * e, lookY: 0.7 * e, earBackR: 0.3 * e, tailWave: 0.25 };
    },
    sprites: [[0.5, 'dots']],
  },
  lookAround: { label: 'Оглядывается', posture: 'sit', duration: 3.6, lockHead: true, pose: t => ({ headYaw: Math.sin(t * 1.6) * 0.7 * env(t, 3.6, 0.3, 0.6), lookX: Math.sin(t * 1.6) * 0.8, earTurnL: Math.sin(t * 1.6) * 0.3, earTurnR: Math.sin(t * 1.6) * 0.3 }) },
  sleep: { label: 'Спит', posture: 'lie', duration: 0, lockHead: true, pose: t => ({ headPitch: -0.3, neck: -0.05, headRoll: 0.25, headYaw: 0.35, lidUp: 1, lidLow: 0.3, spine1: 0.02 + wave(t, 0.2, 0.018), earOutL: 0.25, earOutR: 0.25, tailWave: 0.02 }), sprites: [[0.6, 'zzz'], [2.4, 'zzz'], [4.2, 'zzz']] },
  hop: {
    label: 'Подпрыгивает от радости', posture: 'sit', duration: 1.6, pose: t => {
      const h = Math.max(0, Math.sin(Math.min(1, t / 0.75) * Math.PI));
      return { bodyY: -0.31 + h * 0.28 - (t < 0.1 ? 0.05 : 0), squash: 1 + h * 0.06 - (t > 0.75 && t < 0.95 ? 0.08 : 0), frRaise: h, flRaise: h, frA1: 0.3, frA2: 0.6, frA3: 0.9, flA1: 0.3, flA2: 0.6, flA3: 0.9, tailLift: 0.9, lidUp: 0.6, lidLow: 0.45, jaw: 0.5 * h };
    },
    sprites: [[0.2, 'sparkle']],
  },
  bow: { label: 'Кланяется (учитель)', posture: 'sit', duration: 2.2, lockHead: true, pose: t => { const e = env(t, 2.2, 0.5, 0.6); return { spine2: 0.05 - 0.35 * e, neck: -0.5 - 0.2 * e, headPitch: -0.38 - 0.35 * e, lidUp: 0.12 + 0.5 * e }; } },
  beg: {
    label: 'Встаёт столбиком', posture: 'sit', duration: 3.2, pose: t => {
      const e = env(t, 3.2, 0.45, 0.5);
      return { hips: 0.82 + 0.55 * e, spine1: 0.08 + 0.1 * e, bodyY: -0.31 + 0.1 * e, neck: -0.5 - 0.45 * e, headPitch: -0.38 - 0.1 * e, frRaise: e, flRaise: e, frA1: -0.35, frA2: -1.55, frA3: -0.9, flA1: -0.35, flA2: -1.55, flA3: -0.9, earTurnL: -0.1, earTurnR: -0.1, pupil: 0.62 };
    },
  },
  knead: { label: 'Мнёт лапками (мурчит)', posture: 'lie', duration: 4, pose: t => ({ flY: 0.03 + Math.max(0, wave(t, 1.6)) * 0.045, frY: 0.03 + Math.max(0, -wave(t, 1.6)) * 0.045, lidUp: 0.75, purr: 1, earOutL: 0.15, earOutR: 0.15 }), sprites: [[0.5, 'heart'], [2, 'heart']] },
  scared: { label: 'Пугается', posture: 'crouch', duration: 2.4, pose: t => ({ bodyY: -0.13 - 0.06 * env(t, 2.4), tailPuff: 1.6, tailLift: -0.4, earBackL: 0.9, earBackR: 0.9, earOutL: 0.7, earOutR: 0.7, pupil: 0.95, lidUp: -0.15, twist: wave(t, 9, 0.015) }), sprites: [[0.1, 'exclaim'], [0.6, 'sweat']] },
} satisfies Record<string, ActionDef>;
export type ActionName = keyof typeof ACTIONS;
export const getAction = (name: ActionName): ActionDef => ACTIONS[name];

type EmotionDef = { label: string; pose: PartialPose; tailWave?: number; sprites?: SpriteKind[]; every?: number };
export const EMOTIONS = {
  neutral: { label: 'Спокойный', pose: {} },
  happy: { label: 'Рад', pose: { lidLow: 0.38, lidUp: 0.22, pupil: 0.55, tailLift: 0.75, tailCurl: 0.9, earBackL: -0.12, earBackR: -0.12, jaw: 0.12, whisk: 0.3 }, sprites: ['sparkle'], every: 4 },
  delight: { label: 'Счастлив ^^', pose: { happyEyes: 1, lidUp: 1, lidLow: 0.4, jaw: 0.5, blush: 0.9, headRoll: 0.1, headPitch: 0.06, tailLift: 0.95, tailCurl: 1.3, tailWave: 0.3, tailSpeed: 1.8, earBackL: -0.22, earBackR: -0.22, whisk: 0.5 }, sprites: ['sparkle', 'heart'], every: 1.3 },
  joy: { label: 'Восторг', pose: { lidLow: 0.55, lidUp: 0.62, pupil: 0.6, jaw: 0.65, tailLift: 0.95, tailCurl: 1.2, earBackL: -0.2, earBackR: -0.2, whisk: 0.5, blush: 0.6 }, sprites: ['sparkle', 'note'], every: 1.6 },
  love: { label: 'Любовь', pose: { lidUp: 0.6, lidLow: 0.25, pupil: 0.75, blush: 1, tailLift: 0.8, tailCurl: 1.3, purr: 1, headRoll: 0.12 }, sprites: ['heart'], every: 1.1 },
  surprised: { label: 'Удивлён', pose: { lidUp: -0.25, pupil: 0.88, jaw: 0.3, earBackL: -0.3, earBackR: -0.3, whisk: 0.7, tailPuff: 1.15, headPitch: 0.05 }, sprites: ['exclaim'], every: 6 },
  scared: { label: 'Испуган', pose: { lidUp: -0.2, pupil: 1, earBackL: 0.9, earBackR: 0.9, earOutL: 0.75, earOutR: 0.75, tailPuff: 1.6, tailLift: -0.5, whisk: -0.8 }, sprites: ['sweat'], every: 2.5 },
  sad: { label: 'Грустит', pose: { lidUp: 0.42, lidTilt: -0.9, pupil: 0.55, lookY: -0.5, headPitch: -0.2, earOutL: 1.05, earOutR: 1.05, earBackL: 0.2, earBackR: 0.2, tailLift: -0.6, tailWave: 0.02, whisk: -0.4 }, sprites: ['tear', 'gloom'], every: 2.2 },
  angry: { label: 'Злится', pose: { lidUp: 0.38, lidTilt: 1, pupil: 0.1, jaw: 0.45, earBackL: 0.85, earBackR: 0.85, earOutL: 0.5, earOutR: 0.5, whisk: -0.6, tailWave: 0.55, tailSpeed: 3 }, sprites: ['anger'], every: 1.6 },
  thinking: { label: 'Размышляет', pose: { lookX: -0.5, lookY: 0.6, headRoll: 0.16, earBackR: 0.3, earTurnL: 0.2, lidUp: 0.25, tailWave: 0.3 }, sprites: ['dots'], every: 3.5 },
  confused: { label: 'Не понимает', pose: { headRoll: -0.32, earBackL: 0.45, earBackR: -0.2, earOutL: 0.35, lidUp: 0.1, wink: 0.35, pupil: 0.5, whisk: 0.2 }, sprites: ['question'], every: 3 },
  sleepy: { label: 'Сонный', pose: { lidUp: 0.72, lidLow: 0.2, pupil: 0.6, headPitch: -0.14, earOutL: 0.4, earOutR: 0.4, tailWave: 0.03 }, sprites: ['zzz'], every: 2.6 },
  proud: { label: 'Гордый', pose: { lidUp: 0.48, lidLow: 0.2, headPitch: 0.22, headRoll: 0.05, spine2: 0.1, tailLift: 1.1, tailCurl: 0.6, earBackL: -0.1, earBackR: -0.1, whisk: 0.4 }, sprites: ['sparkle'], every: 3 },
  embarrassed: { label: 'Смущён', pose: { blush: 1, lookX: 0.6, lookY: -0.4, lidUp: 0.35, earBackL: 0.4, earBackR: 0.4, earOutL: 0.3, earOutR: 0.3, headRoll: -0.12, tailWave: 0.3 }, sprites: ['sweat'], every: 3 },
  bored: { label: 'Скучает', pose: { lidUp: 0.55, lidLow: 0.1, headRoll: 0.3, headPitch: -0.1, earOutL: 0.3, earOutR: 0.5, tailWave: 0.25, tailSpeed: 0.5, lookX: 0.5 }, sprites: ['dots'], every: 5 },
} satisfies Record<string, EmotionDef>;
export type EmotionName = keyof typeof EMOTIONS;
export const getEmotion = (name: EmotionName): EmotionDef => EMOTIONS[name];

/** Parameters that ease faster (face) or slower (body); everything else uses the default rate. */
export const RATE: Partial<Record<PoseKey, number>> = {
  lidUp: 22, lidLow: 18, happyEyes: 14, wink: 18, pupil: 8, lookX: 12, lookY: 12, jaw: 16, blush: 4, pointer: 10,
  earBackL: 14, earBackR: 14, earOutL: 12, earOutR: 12, earTurnL: 12, earTurnR: 12,
};
/** Values added on top of the target rather than replacing it (look-at, emotions on actions). */
export const ADDITIVE: ReadonlySet<PoseKey> = new Set<PoseKey>(['headPitch', 'headYaw', 'headRoll', 'lookX', 'lookY']);
