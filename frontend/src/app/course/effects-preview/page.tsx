'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { pointerStateFromEvent } from '@/features/course/effects/pointerState';
import { getGroupEffect, getGroupEffectVariants, getHiddenGroupEffectVariants, type GroupEffectDefinition } from '@/features/course/effects/groupEffects.config';
import categoryIcons from '@/features/course/category-icons.json';
import type { PointerState } from '@/features/course/effects/engine';
import { ALL_SCENES, getScene } from '@/features/course/effects/scenes/registry';
import { type SceneDef } from '@/features/course/effects/scenes/types';
import { createTuningState, type EffectTuningState } from '@/features/course/effects/tuning/types';
import { EffectTuningPanel } from '@/features/course/effects/tuning/EffectTuningPanel';
import { EffectDebugToggle } from '@/features/course/effects/EffectPreviewControls';
import { StandaloneEffectPreview, StandaloneEffectStage, STANDALONE_EFFECT_IDS, isStandaloneEffectId, type StandaloneEffectId } from '@/features/course/effects/StandaloneEffectPreview';
import appShellStyles from '@/components/app-shell.module.css';
import { FoilPreviewCard } from '@/features/holographic-foil/FoilPreviewCard';
import { ShaderLab, ShaderLabLauncher } from '@/features/course/effects/shader-lab/ShaderLab';
import { EffectPreviewPoster } from '@/features/course/effects/EffectPreviewPoster';
import { getEffectPoster } from '@/features/course/effects/effectPosters';
import { EffectSurface } from '@/features/course/effects/EffectSurface';
import { effectStageKey, resolveEffectStage } from '@/features/course/effects/effectStageKey';

const BodyLanternWaterEffect = dynamic(() => import('@/features/course/effects/BodyLanternWaterEffect').then((m) => m.BodyLanternWaterEffect), { ssr: false });
const BodySakuraEffect = dynamic(() => import('@/features/course/effects/BodySakuraEffect').then((m) => m.BodySakuraEffect), { ssr: false });
const BodyPhotoEffect = dynamic(() => import('@/features/course/effects/BodyPhotoEffect').then((m) => m.BodyPhotoEffect), { ssr: false });
const BodyNatureEffect = dynamic(() => import('@/features/course/effects/BodyNatureEffect').then((m) => m.BodyNatureEffect), { ssr: false });
const BodySceneEffect = dynamic(() => import('@/features/course/effects/scenes/BodySceneEffect').then((m) => m.BodySceneEffect), { ssr: false });
const BodyGridEffect = dynamic(() => import('@/features/course/effects/BodyGridEffect').then((m) => m.BodyGridEffect), { ssr: false });
const FluidEffect = dynamic(() => import('@/features/course/effects/FluidEffect').then((m) => m.FluidEffect), { ssr: false });
const BodyLiquidGlassEffect = dynamic(() => import('@/features/course/effects/BodyLiquidGlassEffect').then((m) => m.BodyLiquidGlassEffect), { ssr: false });
const LiquidDropsEffect = dynamic(() => import('@/features/course/effects/LiquidDropsEffect').then((m) => m.LiquidDropsEffect), { ssr: false });
const PotteryEffect = dynamic(() => import('@/features/course/effects/pottery/PotteryEffect'), { ssr: false });

const H2: CSSProperties = { flexBasis: '100%', margin: '24px 0 0', font: '600 16px sans-serif' };
// Headings and the toolbar keep a dark backing: with a whole-page effect on, the page itself turns transparent.
const PILL: CSSProperties = { display: 'inline-block', padding: '5px 12px', borderRadius: 8, background: 'rgba(14,17,20,0.88)', color: '#dfe5ea' };
// Opaque, so the buttons stay readable over any whole-page effect.
const BUTTON: CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)', background: '#222a31', color: '#eef2f5', font: '500 14px sans-serif', cursor: 'pointer', position: 'relative', zIndex: 2 };
const BUTTON_ON: CSSProperties = { ...BUTTON, background: '#3b4957', border: '1px solid #8fd0ff', boxShadow: '0 0 0 2px rgba(143,208,255,0.35)', color: '#ffffff' };
// One representative category id per effect `kind`, pulled from the real production config
// (groupEffects.config.ts) so this page never drifts from what actually ships on /course.
const DEMO: { categoryId: number | null; title: string; variantId?: string }[] = [
  { categoryId: null, title: 'Введение (compass)' },
  { categoryId: 1778, title: 'На природе (sakura · большая сакура на весь фон, за ней пейзаж)' },
  { categoryId: 1778, variantId: 'sakura-landscape', title: 'На природе (sakura · две сакуры на весь фон, отложено)' },
  { categoryId: 1778, variantId: 'sakura', title: 'На природе (sakura · в карточке, отложено)' },
  { categoryId: 1778, variantId: 'leaves', title: 'На природе (ambient · листья в карточке, отложено)' },
  { categoryId: 1778, variantId: 'leaves-full', title: 'На природе (ambient · листья, весь фон)' },
  { categoryId: 1797, title: 'Окружающая среда и погода (storm)' },
  { categoryId: 1782, variantId: 'lantern-water', title: 'Путешествие (фонари на воде · 3D, вариант в карточке)' },
  { categoryId: 1797, variantId: 'sun-water', title: 'Окружающая среда и погода (солнце и вода)' },
  { categoryId: 1767, title: 'Транспорт (scene · карта маршрута)' },
  { categoryId: 1796, title: 'Связь и технологии (circuit)' },
  { categoryId: 1794, title: 'Стань счастливым! (scene · калейдоскоп на весь фон)' },
  { categoryId: 1794, variantId: 'glitter-full', title: 'Стань счастливым! (scene · блёстки на весь фон)' },
  { categoryId: 1773, title: 'Будь здоров! (scene · мандала на весь фон)' },
  { categoryId: 1765, title: 'В городе и в деревне (на весь фон · фонтан справа, статуя с водой слева)' },
  { categoryId: 1780, title: 'Покупки и услуги (scene · драгоценные камни на весь фон)' },
  { categoryId: 1777, title: 'Моё место жительства (голографический остров на весь фон)' },
  { categoryId: 1777, variantId: 'holo-silver', title: 'Моё место жительства (серебряная голограмма на весь фон)' },
  { categoryId: 1772, variantId: 'street-relight', title: 'Я путешествую… (улица после дождя на весь фон)' },
  { categoryId: 1787, title: 'Среди своих (scene · светлячки)' },
  { categoryId: 1787, variantId: 'fireflies-full', title: 'Среди своих (scene · светлячки на весь фон)' },
  { categoryId: 1789, title: 'Когда заканчивается рабочий день (scene · запотевшее стекло на весь фон)' },
  { categoryId: 1791, title: 'Земля, воздух, вода (water · рябь в карточке, курильницы на весь фон: дракон и скала)' },
  { categoryId: 1764, title: 'Со всего мира (scene · гирлянда лампочек, холодильник с магнитиками)' },
  { categoryId: 1783, title: 'Время праздников (scene · светодиодный куб)' },
  { categoryId: 1783, variantId: 'fireworks', title: 'Время праздников (scene · фейерверк над Ригой)' },
  { categoryId: 1798, title: 'Работа и финансы (mine · 3D-шахта)' },
  { categoryId: 1763, title: 'Знакомство (scene · приветствия)' },
  { categoryId: 1774, title: 'Учёба и работа (scene · оптика: кристаллы и капли)' },
  { categoryId: 1774, variantId: 'optics-bench', title: 'Учёба и работа (scene · оптика: оптическая скамья)' },
  { categoryId: 1779, title: 'Планировщик (scene · стикеры)' },
  { categoryId: 1786, title: 'Никогда не поздно (scene · часовой вихрь)' },
  { categoryId: 1792, title: 'Техника и информация (scene · LED-экран, панель с выбором заставки)' },
  { categoryId: 1792, variantId: 'digital-rain', title: 'Техника и информация (scene · код-дождь)' },
  { categoryId: 1793, title: 'Ремёсла (scene · кузница)' },
];

// Effects that belong to no group yet: tried out here first, shown in larger cards.
const EXPERIMENTS: { title: string; effect: GroupEffectDefinition }[] = [
  {
    title: 'Skyline — объёмный пинбол · рампы, качающийся мост и магнитный выбрасыватель',
    effect: { kind: 'scene', sceneId: 'pinball-skyline', bodyEffect: { scene: 'pinball-skyline' }, accent: '#53d9ff', background: '#03040a', glow: '#53d9ff' },
  },
  {
    title: 'Хроматический реактор — сохранённый плоский пинбол с кубом (22.10.2026)',
    effect: { kind: 'scene', sceneId: 'pinball-reactor-classic', bodyEffect: { scene: 'pinball-reactor-classic' }, accent: '#ff5e9c', background: '#03040a', glow: '#55e6ff' },
  },
  {
    title: 'Импульс III — архипелаг механизмов · колыбель Ньютона, обратный финиш и сон фишек',
    effect: { kind: 'scene', sceneId: 'domino-archipelago', accent: '#f9bd44', background: '#122332', glow: '#22c8ba' },
  },
  {
    title: 'Импульс II — винтовая мастерская · сохранённая версия с трением (19.10.2026)',
    effect: { kind: 'scene', sceneId: 'domino-workshop', accent: '#e8b953', background: '#122332', glow: '#51bfb2' },
  },
  {
    title: 'Мастерская импульсов I — сохранённая ровная трасса · упрощённая механика',
    effect: { kind: 'scene', sceneId: 'domino-cascade', accent: '#e9bd63', background: '#122432', glow: '#5ec8be' },
  },
  {
    title: 'Невесомость — большая капля · клик вызывает вмятину и волны',
    effect: { kind: 'scene', sceneId: 'zero-gravity-drop', accent: '#a2e1f5', background: '#0e1b28', glow: '#d1edff' },
  },
  {
    title: 'Жидкостный таймер — две жидкости, прозрачные ступеньки и капли-линзы',
    effect: { kind: 'scene', sceneId: 'liquid-cascade-timer', accent: '#12b2ca', background: '#74726c', glow: '#ed4387' },
  },
  {
    title: 'Парк над облаками — сохранённая живая 3D-версия · шары и колонки',
    effect: { kind: 'scene', sceneId: 'cloud-carnival-party-v1', accent: '#ffca79', background: '#0b1529', glow: '#ffca79' },
  },
  {
    title: 'Парк над облаками — исходная версия без шаров и колонок (06.10.2026)',
    effect: { kind: 'scene', sceneId: 'cloud-carnival-original', accent: '#ffca79', background: '#0b1529', glow: '#ffca79' },
  },
  {
    title: 'Песочная картина (sand-art)',
    effect: { kind: 'scene', sceneId: 'sand-art', accent: '#b07aff', background: '#15131c', glow: 'rgba(176,122,255,0.4)' },
  },
  {
    title: 'Узоры-калейдоскоп (mandala)',
    effect: { kind: 'scene', sceneId: 'mandala', accent: '#e8b923', background: '#221541', glow: 'rgba(232,185,35,0.4)' },
  },
  {
    title: 'Калейдоскоп (kaleidoscope)',
    effect: { kind: 'scene', sceneId: 'kaleidoscope', accent: '#ffd27a', background: '#0b0910', glow: 'rgba(255,210,122,0.4)' },
  },
  {
    title: 'Фонтан во дворе усадьбы, 3D (fountain)',
    effect: { kind: 'scene', sceneId: 'fountain', accent: '#9fd3e0', background: '#0d0f0c', glow: 'rgba(159,211,224,0.4)' },
  },
  {
    title: 'Неоновый стеклянный фонтанчик, трассировка (glass-fountain)',
    effect: { kind: 'scene', sceneId: 'glass-fountain', accent: '#b89aff', background: '#050508', glow: 'rgba(184,154,255,0.4)' },
  },
  {
    title: 'Дракон-курильница на замке, дым — жидкость на сетке (dragon-burner)',
    effect: { kind: 'scene', sceneId: 'dragon-burner', accent: '#9fc9b4', background: '#0b0a09', glow: 'rgba(159,201,180,0.4)' },
  },
  {
    title: 'Дракон и стекающий дым (dragon-smoke)',
    effect: { kind: 'scene', sceneId: 'dragon-smoke', accent: '#d8d2c4', background: '#0d0c0b', glow: 'rgba(216,210,196,0.4)' },
  },
  {
    title: 'Драгоценные камни: соты, свет от курсора (gems)',
    effect: { kind: 'scene', sceneId: 'gems', accent: '#ffd27a', background: '#08070a', glow: 'rgba(255,210,122,0.4)' },
  },
  {
    title: 'Запотевшее стекло, капли и огни города (fogged-glass)',
    effect: { kind: 'scene', sceneId: 'fogged-glass', accent: '#9fd3e0', background: '#05060a', glow: 'rgba(159,211,224,0.4)' },
  },
  {
    title: 'Новогодний фонарь: сцена в воде, блёстки в вихре насоса, свечи (snow-lantern)',
    effect: { kind: 'scene', sceneId: 'snow-lantern', accent: '#ffd27a', background: '#0a0807', glow: 'rgba(255,210,122,0.4)' },
  },
  {
    title: 'Светодиодный куб и новогодние фигурки: снеговик, олень, витрина (voxel-led-cube)',
    effect: { kind: 'scene', sceneId: 'voxel-led-cube', accent: '#ffcf5a', background: '#03040a', glow: 'rgba(255,207,90,0.4)' },
  },
  {
    title: 'Автомат световых эффектов на ППЗУ, 3D (prom-board)',
    effect: { kind: 'scene', sceneId: 'prom-board', accent: '#8fffe0', background: '#07080a', glow: 'rgba(143,255,224,0.4)' },
  },
];

function collectUnassignedScenes(): SceneDef[] {
  const used = new Set(EXPERIMENTS.map(({ effect }) => effect.sceneId).filter((id): id is string => !!id));
  const ids = Object.keys(categoryIcons).map(Number);
  const hidden = getHiddenGroupEffectVariants();
  for (const id of ids) {
    const effects = [
      getGroupEffect({ categoryId: id, title: null }),
      ...(getGroupEffectVariants(id) ?? []).map((variant) => variant.effect),
      ...hidden.filter((entry) => entry.categoryId === id).map((entry) => entry.variant.effect),
    ];
    for (const effect of effects) {
      if (effect?.sceneId) used.add(effect.sceneId);
      if (effect?.bodyEffect && typeof effect.bodyEffect === 'object') used.add(effect.bodyEffect.scene);
    }
  }
  const available: SceneDef[] = [];
  for (const scene of ALL_SCENES) {
    if (used.has(scene.id)) continue;
    used.add(scene.id);
    available.push(scene);
  }
  return available;
}

function collectRemainingGroupEffects(): { key: string; title: string; effect: GroupEffectDefinition }[] {
  const names = categoryIcons as Record<string, { name: string }>;
  const shown = new Set(DEMO.map(({ categoryId, variantId }) => `${categoryId}:${variantId ?? 'default'}`));
  const remaining: { key: string; title: string; effect: GroupEffectDefinition }[] = [];
  for (const id of Object.keys(names).map(Number).sort((a, b) => a - b)) {
    const effect = getGroupEffect({ categoryId: id, title: null });
    if (!effect) continue;
    const name = names[String(id)].name;
    if (!shown.has(`${id}:default`)) remaining.push({ key: `${id}:default`, title: `${name} (${id})`, effect });
    for (const variant of getGroupEffectVariants(id) ?? []) {
      if (variant.effect === effect || shown.has(`${id}:${variant.id}`)) continue;
      remaining.push({ key: `${id}:${variant.id}`, title: `${name} · ${variant.label.ru}`, effect: variant.effect });
    }
  }
  return remaining;
}

/** The whole-page looks (`bodyEffect`) of every group and variant, put-aside ones included, one entry per distinct look. */
type BodyEntry = { key: string; variantId: string | null; label: string; effect: GroupEffectDefinition };

const BODY_KIND_LABEL: Record<string, string> = {
  grid: 'сетка-подсветка',
  fluid: 'радужная жидкость',
  'liquid-glass': 'жидкое стекло',
  'liquid-drops': 'капли, жидкое стекло',
  'lantern-water': 'фонари на воде',
  sakura: 'сакура',
  'sakura-card': 'сакура из карточки',
  leaves: 'листопад',
};

function collectBodyEffects(): BodyEntry[] {
  const names = categoryIcons as Record<string, { name: string }>;
  const hidden = getHiddenGroupEffectVariants();
  const ids = [...new Set([...Object.keys(names).map(Number), ...hidden.map((h) => h.categoryId)])].sort((a, b) => a - b);
  const seen = new Set<string>();
  const out: BodyEntry[] = [];
  for (const id of ids) {
    // Variants first, for their labels; the group's default is usually one of them.
    const options = [
      ...(getGroupEffectVariants(id) ?? []).map((v) => ({ variantId: v.id as string | null, note: `${v.icon} ${v.label.ru}`, effect: v.effect })),
      ...hidden.filter((h) => h.categoryId === id).map(({ variant: v }) => ({ variantId: v.id as string | null, note: `${v.icon} ${v.label.ru} (отложен)`, effect: v.effect })),
      { variantId: null, note: '', effect: getGroupEffect({ categoryId: id, title: null }) },
    ];
    for (const { variantId, note, effect } of options) {
      const body = effect?.bodyEffect;
      if (!effect || !body) continue;
      // Same look = same bodyEffect and the same starting panel values (optics-lab's variants differ only in those).
      const signature = `${id}:${JSON.stringify([body, effect.sceneParams ?? null])}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      const kind = typeof body === 'object' ? `сцена ${body.scene}` : BODY_KIND_LABEL[body] ?? body;
      out.push({ key: `${id}:${variantId ?? 'default'}`, variantId, label: `${names[String(id)]?.name ?? id} (${id}) · ${note || kind}`, effect });
    }
  }
  return out;
}

/** `?body=` takes an entry key, a variant id, a scene id or a bodyEffect name (`?bodyEffect=` is the old spelling). */
function findBodyEntry(entries: BodyEntry[], query: string): BodyEntry | null {
  return entries.find((e) => e.key === query || e.variantId === query || e.effect.bodyEffect === query || (typeof e.effect.bodyEffect === 'object' && e.effect.bodyEffect.scene === query)) ?? null;
}

/** Mounts one whole-page effect the way ThemedGroupOverlay/CoursePath do on /course. */
function BodyEffectView({ effect, sharedTuning }: { effect: GroupEffectDefinition; sharedTuning?: EffectTuningState | null }) {
  const tuning = useMemo(() => sharedTuning ?? createTuningState(effect), [effect, sharedTuning]);
  const [, bumpTuning] = useReducer((n: number) => n + 1, 0);
  const body = effect.bodyEffect;
  if (!body) return null;
  const accent = effect.accent ?? effect.glow;
  // Only these share the page's panel; grid, fluid and the glass effects carry panels of their own.
  const usesTuning = typeof body === 'object' ? effect.sceneId === body.scene : body === 'lantern-water' || body === 'sakura' || body === 'sakura-card' || body === 'leaves';
  let view = null;
  if (typeof body === 'object') {
    const scene = getScene(body.scene);
    view = scene && <BodySceneEffect scene={scene} palette={body.palette} params={usesTuning && tuning?.kind === 'scene' ? tuning.params : undefined} />;
  } else if (body === 'grid') view = <BodyGridEffect accent={accent} />;
  else if (body === 'fluid') view = <FluidEffect accent={accent} />;
  else if (body === 'liquid-glass') view = <BodyLiquidGlassEffect />;
  else if (body === 'liquid-drops') view = <LiquidDropsEffect />;
  else if (body === 'pottery') view = <PotteryEffect focused uk={false} onClose={() => undefined} />;
  else if (body === 'lantern-water') view = <BodyLanternWaterEffect params={tuning?.kind === 'lantern-water' ? tuning.params : undefined} />;
  else if (body === 'sakura') view = <BodySakuraEffect params={tuning?.kind === 'sakura' ? tuning.params : undefined} />;
  else if (body === 'holo-island' || body === 'holo-silver' || body === 'street-relight') view = <BodyPhotoEffect kind={body} />;
  else view = <BodyNatureEffect effect={effect} tuning={tuning} />;
  return (
    <>
      {view}
      {usesTuning && tuning && <EffectTuningPanel tuning={tuning} onChange={bumpTuning} />}
    </>
  );
}

/** A scene over the whole window (the experiments' "⛶ На весь экран"), closed with ✕ or Esc. */
function FullscreenScene({ effect, onClose, bodyView = false }: { effect: GroupEffectDefinition; onClose: () => void; bodyView?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  // Its own debug panel (⋮): the overlay covers the header's ⋮ and the page's panel slot.
  const tuning = useMemo(() => createTuningState(effect), [effect]);
  const [, bumpTuning] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);
  const feed = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = pointerStateFromEvent(event, ref.current!.getBoundingClientRect(), pointerRef.current);
  };
  return createPortal(
    <div
      ref={ref}
      data-fullscreen-effect={effect.sceneId ?? effectStageKey(effect) ?? effect.kind}
      onPointerDown={(event) => {
        // Keep receiving the drag when it leaves the window's edge.
        event.currentTarget.setPointerCapture(event.pointerId);
        feed(event);
      }}
      onPointerMove={feed}
      onPointerUp={feed}
      onPointerCancel={feed}
      onPointerLeave={() => { pointerRef.current.active = false; }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#000', touchAction: 'none' }}
    >
      {effect.bodyEffect === 'pottery' ? <div onPointerDown={event => event.stopPropagation()}><PotteryEffect focused uk={false} onClose={onClose} /></div>
        : <EffectSurface effect={effect} width={size.width} height={size.height} pointerRef={pointerRef} tuning={tuning} getHost={() => ref.current} bodyView={bodyView || effect.sceneId?.startsWith('late-')} />}
      {tuning && (
        // Presses on the panel stay there: one reaching the overlay would draw or shake in the scene.
        <div onPointerDown={(event) => event.stopPropagation()}>
          <EffectTuningPanel tuning={tuning} onChange={bumpTuning} floating />
        </div>
      )}
      <div onPointerUp={event => event.stopPropagation()} style={{ position: 'absolute', left: 12, bottom: 48, display: 'flex', gap: 8, zIndex: 2 }}>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => ref.current?.requestFullscreen?.().catch(() => undefined)} style={BUTTON}>
          ⛶ Весь монитор
        </button>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onClose} style={BUTTON}>
          ✕ Закрыть (Esc)
        </button>
        {tuning && (
          <EffectDebugToggle />
        )}
      </div>
    </div>,
    document.body,
  );
}

function DemoCard({ effect, title, sharedTuning, width = 340, height = 210, running = false, onStart, onStop, onFullscreen, bodyView = false }: { effect: GroupEffectDefinition; title: string; sharedTuning?: EffectTuningState | null; width?: number; height?: number; running?: boolean; onStart?: () => void; onStop?: () => void; onFullscreen?: () => void; bodyView?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  const [size, setSize] = useState({ width, height });
  useEffect(() => {
    const host = ref.current;
    if (!host || !running) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width + 24, height }));
    observer.observe(host); return () => observer.disconnect();
  }, [height, running]);
  const tuning = useMemo(() => sharedTuning ?? createTuningState(effect), [effect, sharedTuning]);
  const [, bumpTuning] = useReducer((n: number) => n + 1, 0);
  const feedPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = pointerStateFromEvent(event, ref.current!.getBoundingClientRect(), pointerRef.current);
  };
  return (
    <div
      ref={ref}
      onPointerMove={feedPointer}
      data-effect-stage={effectStageKey(effect) ?? undefined}
      data-effect-scene={effect.sceneId}
      data-effect-view={bodyView ? 'body' : 'card'}
      onPointerDown={feedPointer}
      onPointerUp={feedPointer}
      onPointerCancel={feedPointer}
      onPointerLeave={() => { pointerRef.current.active = false; }}
      style={{ position: 'relative', width, maxWidth: '100%', height: size.height, overflow: 'visible', borderRadius: 14, background: '#1c2126', color: 'white', display: 'flex', alignItems: 'flex-end', padding: 12, fontFamily: 'sans-serif', fontSize: 13 }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 14 }}>
        <div style={{ position: 'absolute', inset: 0, background: effect.background }} />
        <EffectPreviewPoster title={title} running={running} stillSrc={getEffectPoster(effect, bodyView)}>
        {running && <EffectSurface effect={effect} width={size.width} height={size.height} pointerRef={pointerRef} tuning={tuning} getHost={() => ref.current} bodyView={bodyView} />}
        </EffectPreviewPoster>
        <div style={{ position: 'absolute', inset: '55% 0 0', background: 'linear-gradient(transparent, rgba(3,7,12,.9))', pointerEvents: 'none' }} />
      </div>
      {running && tuning && <EffectTuningPanel tuning={tuning} onChange={bumpTuning} />}
      {/* The buttons keep their presses to themselves: a press that reached the card would draw or shake in the scene. */}
      {!running && onStart && (
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onStart} style={{ ...BUTTON, position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%, -50%)', zIndex: 3, borderRadius: 999, padding: '10px 22px', background: 'rgba(12,16,20,0.82)' }}>
          ▶ Запустить
        </button>
      )}
      {((running && onStop) || onFullscreen) && (
        <div style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 3, display: 'flex', gap: 6 }}>
          {onFullscreen && (
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onFullscreen} style={{ ...BUTTON, padding: '4px 10px', fontSize: 12, background: 'rgba(12,16,20,0.78)' }}>
              ⛶ На весь экран
            </button>
          )}
          {running && onStop && (
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onStop} style={{ ...BUTTON, padding: '4px 10px', fontSize: 12, background: 'rgba(12,16,20,0.78)' }}>
              ■ Стоп
            </button>
          )}
        </div>
      )}
      <strong style={{ position: 'relative', zIndex: 2, paddingBottom: onFullscreen || (running && onStop) ? 32 : 0 }}>{title}</strong>
    </div>
  );
}

export default function EffectsPreviewPage() {
  // Only an explicit launch mounts a renderer; old saved "all" preferences are deliberately ignored.
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [bodyKey, setBodyKey] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<GroupEffectDefinition | null>(null);
  const [fullscreenBody, setFullscreenBody] = useState(false);
  const [studio, setStudio] = useState<string | null>(null);
  const [embedded, setEmbedded] = useState<string | null>(null);
  const [routeReady, setRouteReady] = useState(false);
  const [isolatedCard, setIsolatedCard] = useState<GroupEffectDefinition | null>(null);
  const [standalone, setStandalone] = useState<StandaloneEffectId | null>(null);
  const closeStandalone = useCallback(() => setStandalone(null), []);
  const closeFullscreen = useCallback(() => setFullscreen(null), []);
  const bodyEntries = useMemo(() => collectBodyEffects(), []);
  const unassignedScenes = useMemo(() => collectUnassignedScenes(), []);
  const remainingGroupEffects = useMemo(() => collectRemainingGroupEffects(), []);
  const bodyEntry = bodyEntries.find((entry) => entry.key === bodyKey) ?? null;
  const sakuraTuning = useMemo(() => createTuningState(getGroupEffect({ categoryId: 1778, title: null, variantId: 'sakura-landscape' })!), []);
  const cardSakuraTuning = useMemo(() => createTuningState(getGroupEffect({ categoryId: 1778, title: null, variantId: 'sakura-card-full' })!), []);
  const leavesTuning = useMemo(() => createTuningState(getGroupEffect({ categoryId: 1778, title: null, variantId: 'leaves-full' })!), []);
  // The card and the page background of the same nature variant share one panel state.
  const sharedTuning = (variantId?: string | null) => (variantId === 'sakura-landscape' ? sakuraTuning : variantId === 'sakura-card-full' ? cardSakuraTuning : variantId === 'leaves-full' ? leavesTuning : undefined);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setRouteReady(true);
      const query = new URLSearchParams(window.location.search);
      if (query.has('embedded')) { setEmbedded(query.get('embedded')); return; }
      const stage = query.get('stage');
      if (stage) {
        const effect = resolveEffectStage(stage);
        if (effect) {
          if (query.get('card') === '1') setIsolatedCard(effect);
          else { setFullscreen(effect); setFullscreenBody(query.get('view') === 'body'); }
          return;
        }
      }
      const requestedEffect = query.get('effect');
      if (requestedEffect === 'sprite-swarm') { setStandalone('sprite-swarm'); return; }
      const experiment = EXPERIMENTS.find(item => item.effect.sceneId === requestedEffect);
      if (experiment) {
        setFullscreen(experiment.effect);
        return;
      }
      const registered = requestedEffect ? getScene(requestedEffect) : null;
      if (registered) {
        setFullscreen({ kind: 'scene', sceneId: registered.id, background: '#101720', glow: 'transparent' }); return;
      }
      if (requestedEffect === 'holographic-foil' || requestedEffect === 'street-relight' || requestedEffect === 'parallax-preview') {
        setActiveCard(`exp:${requestedEffect}`);
        return;
      }
      const requested = query.get('body') ?? query.get('bodyEffect');
      const found = requested ? findBodyEntry(bodyEntries, requested) : null;
      if (found) setBodyKey(found.key);
    });
    return () => cancelAnimationFrame(frame);
  }, [bodyEntries]);
  useEffect(() => {
    document.body.classList.toggle('body-effect-active', !!bodyEntry);
    return () => document.body.classList.remove('body-effect-active');
  }, [bodyEntry]);
  const card = (key: string) => ({ running: activeCard === key, onStart: () => { setActiveCard(key); setBodyKey(null); }, onStop: () => setActiveCard(null) });
  const toggleBody = (key: string) => {
    if (bodyKey === key) {
      setBodyKey(null);
      return;
    }
    setBodyKey(key);
    setActiveCard(null);
  };
  const expand = (effect: GroupEffectDefinition, bodyView = false) => {
    setFullscreenBody(bodyView); setActiveCard(null); setBodyKey(null); setFullscreen(effect);
  };
  // Do not briefly mount the entire gallery (and its WebGL previews) before
  // choosing a direct scene/embedded route after hydration.
  if (!routeReady) return <div role="status" style={{ padding: 24 }}>Открываем эффект…</div>;
  if (embedded !== null) return <EmbeddedBodyStage stageKey={embedded} />;
  if (standalone) return <StandaloneEffectStage id={standalone} onStop={closeStandalone} />;
  if (isolatedCard && !fullscreen) return <div style={{ minHeight: '70vh', padding: 24, background: '#101720', color: '#edf2f4' }}>
    <h1 style={{ fontSize: 18 }}>Отдельная карточка эффекта</h1>
    <DemoCard effect={isolatedCard} title={isolatedCard.sceneId ?? isolatedCard.kind} width={520} height={230} running onFullscreen={() => expand(isolatedCard)} />
    <p><a href="/course/effects-preview">Вернуться в галерею</a></p>
  </div>;
  // Unmount the gallery while measuring: its other effects must not contaminate the benchmark.
  if (studio) return <ShaderLab initialId={studio} onClose={() => setStudio(null)} />;
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: '24px 24px 96px', background: bodyEntry ? 'transparent' : '#0e1114', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {/* Same fixed header-docking slot as CoursePath.tsx, so this demo page shows the panel
            exactly as it appears on the real /course page instead of falling back to floating. */}
        <div id="course-effect-gui-anchor" style={{ position: 'fixed', top: 0, right: 0, zIndex: 9998, pointerEvents: 'none' }} />
        <div style={{ ...PILL, flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, font: '14px sans-serif' }}>
          <span>Галерея эффектов · превью картинками</span>
          <a href="#body-effects" style={{ ...BUTTON, textDecoration: 'none' }}>↓ Эффекты на весь фон</a>
          <span style={{ flexBasis: '100%', color: '#9aa6b1', fontSize: 13 }}>
            Только статичные картинки. Эффект загружается по нажатию «Запустить» или «На весь экран»; одновременно работает один.
          </span>
        </div>
        <ShaderLabLauncher onOpen={id => { setActiveCard(null); setBodyKey(null); setFullscreen(null); setStudio(id); }} />
        <h2 id="experimental" style={{ ...H2, margin: '8px 0 0' }}><span style={PILL}>Экспериментальные эффекты (пока ни в одной группе)</span></h2>
        {!fullscreen && <FoilPreviewCard
          running={activeCard === 'exp:holographic-foil'}
          onStart={() => { setActiveCard('exp:holographic-foil'); setBodyKey(null); }}
          onStop={() => setActiveCard(null)}
        />}
        {!fullscreen && STANDALONE_EFFECT_IDS.map((id) => (
          <StandaloneEffectPreview
            key={id}
            id={id}
            running={activeCard === `exp:${id}`}
            onStart={() => { setActiveCard(`exp:${id}`); setBodyKey(null); }}
            onStop={() => setActiveCard(null)}
          />
        ))}
        {!fullscreen && EXPERIMENTS.map((item) => (
          <DemoCard
            key={item.title}
            effect={item.effect}
            title={item.title}
            width={560}
            height={400}
            {...card(`exp:${item.title}`)}
            onFullscreen={() => {
              // One scene at a time: the card and the page background stop while it runs over the whole window.
              expand(item.effect);
            }}
          />
        ))}
        {unassignedScenes.length > 0 && <h2 style={H2}><span style={PILL}>Свободные сцены без группы курса</span></h2>}
        {!fullscreen && unassignedScenes.map((scene) => (
          <DemoCard
            key={scene.id}
            effect={{ kind: 'scene', sceneId: scene.id, accent: '#88b8c6', background: '#111820', glow: '#88b8c6' }}
            title={`${scene.label} (${scene.id})`}
            {...card(`free:${scene.id}`)}
            onFullscreen={() => expand({ kind: 'scene', sceneId: scene.id, background: '#111820', glow: '#88b8c6' })}
          />
        ))}
        <h2 style={H2}><span style={PILL}>Эффекты групп курса</span></h2>
        {!fullscreen && DEMO.map((item) => {
          const effect = getGroupEffect({ categoryId: item.categoryId, title: item.categoryId === null ? 'Введение' : null, variantId: item.variantId });
          if (!effect) return null;
          return <DemoCard key={item.title} effect={effect} title={item.title} sharedTuning={sharedTuning(item.variantId)} {...card(`demo:${item.title}`)} onFullscreen={() => expand(effect)} />;
        })}
        {remainingGroupEffects.length > 0 && <h2 style={H2}><span style={PILL}>Остальные эффекты групп курса</span></h2>}
        {!fullscreen && remainingGroupEffects.map((item) => (
          <DemoCard key={item.key} effect={item.effect} title={item.title} {...card(`group:${item.key}`)} onFullscreen={() => expand(item.effect)} />
        ))}
        {/* Variants put aside (hidden: true in groupEffects.config.ts): not on the course cards, still viewable here. */}
        <h2 style={H2}><span style={PILL}>Отложенные варианты (на карточках курса их нет)</span></h2>
        {!fullscreen && getHiddenGroupEffectVariants().map(({ categoryId, variant }) => (
          <DemoCard
            key={`hidden:${categoryId}:${variant.id}`}
            effect={variant.effect}
            title={`${categoryId} · ${variant.icon} ${variant.label.ru}${variant.effect.sceneId ? ` (scene: ${variant.effect.sceneId})` : ''}`}
            {...card(`hidden:${categoryId}:${variant.id}`)}
            onFullscreen={() => expand(variant.effect)}
          />
        ))}
        {/* Every group's and variant's whole-page look, straight from groupEffects.config.ts. */}
        <h2 id="body-effects" style={H2}><span style={PILL}>Эффекты на весь фон</span></h2>
        {!fullscreen && bodyEntries.map(entry => <DemoCard key={`body-card:${entry.key}`} effect={entry.effect} title={`Фоновая версия · ${entry.label}`} bodyView {...card(`body-card:${entry.key}`)} onFullscreen={() => expand(entry.effect, true)} />)}
        {bodyEntries.map((entry) => (
          <button key={entry.key} type="button" aria-pressed={bodyKey === entry.key} onClick={() => toggleBody(entry.key)} style={bodyKey === entry.key ? BUTTON_ON : BUTTON}>
            <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, marginRight: 8, background: entry.effect.accent ?? entry.effect.glow }} />
            {entry.label}
          </button>
        ))}
        {bodyEntry && <BodyEffectView key={bodyEntry.key} effect={bodyEntry.effect} sharedTuning={sharedTuning(bodyEntry.variantId)} />}
      </div>
      {/* Wherever the page is scrolled, the running background can be switched off; portalled, since <main> sits under the site footer. */}
      {bodyEntry && createPortal(
        <div style={{ position: 'fixed', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 9997, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 32px)', padding: '8px 8px 8px 14px', borderRadius: 12, background: 'rgba(14,17,20,0.92)', border: '1px solid rgba(255,255,255,0.22)', boxShadow: '0 6px 24px rgba(0,0,0,0.45)', color: '#eef2f5', font: '14px sans-serif' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>На весь фон: {bodyEntry.label}</span>
          <button type="button" onClick={() => setBodyKey(null)} style={BUTTON}>Выключить</button>
        </div>,
        document.body,
      )}
      {fullscreen && <FullscreenScene effect={fullscreen} onClose={closeFullscreen} bodyView={fullscreenBody} />}
    </>
  );
}

function EmbeddedBodyStage({ stageKey }: { stageKey: string }) {
  const effect = resolveEffectStage(stageKey);
  useEffect(() => {
    document.body.classList.add('body-effect-active');
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.parent !== window) window.parent.postMessage({ type: 'course-effect-escape' }, window.location.origin);
    };
    window.addEventListener('keydown', escape);
    return () => { document.body.classList.remove('body-effect-active'); window.removeEventListener('keydown', escape); };
  }, []);
  return createPortal(<>
    {/* Hide only the site shell, not semantic main/header elements inside an effect. */}
    <style>{`body { overflow: hidden !important; background: #101720 !important; } .${appShellStyles.app}, .phpdebugbar, nextjs-portal { display: none !important; }`}</style>
    {stageKey.startsWith('standalone:') && isStandaloneEffectId(stageKey.slice(11))
      ? <StandaloneEffectStage id={stageKey.slice(11) as StandaloneEffectId} onStop={() => window.parent.postMessage({ type: 'course-standalone-stop' }, window.location.origin)} />
      : effect?.bodyEffect ? <BodyEffectView effect={effect} /> : createPortal(<div role="alert" style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>Фоновый эффект не найден</div>, document.body)}
    {effect?.bodyEffect && <EffectDebugToggle settings style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 10000 }} />}
  </>, document.body);
}
