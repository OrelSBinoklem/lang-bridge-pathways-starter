import type { CanvasSceneDef, SceneCtx, SceneInstance } from './types';
import { LIFELONG_CATALOG } from './cinematic/catalog';
import { STORY_COPY, storyLayout, storyPhotoSource, type LifeStory } from './lifelongState';
import { ensureLifeStory } from './lifelongSelection';

type G = CanvasRenderingContext2D;
const keys: LifeStory[] = ['postcards', 'choir', 'workshop', 'neighbours'];
const HAND = '"Segoe Print", "Bradley Hand", cursive';
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Segoe UI", sans-serif';
function text(g: G, value: string, x: number, y: number, size: number, color: string, font = SANS) {
  g.font = `${size}px ${font}`; g.fillStyle = color; g.fillText(value, x, y);
}

/** Lettering is baked once. No pointer gestures, animated replies or assembly games. */
function makeSheet(story: LifeStory, locale: 'ru' | 'uk', ratio: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(600 * ratio); canvas.height = Math.ceil(720 * ratio);
  const g = canvas.getContext('2d')!;
  g.scale(ratio, ratio); g.translate(300, 350);
  g.save(); g.shadowColor = '#180e0b90'; g.shadowBlur = 24; g.shadowOffsetY = 14;
  const paper = g.createLinearGradient(-250, -300, 250, 310);
  paper.addColorStop(0, '#fff9eb'); paper.addColorStop(1, '#e9dbbc');
  g.fillStyle = paper; g.fillRect(-250, -300, 500, 610); g.restore();
  for (let i = 0; i < 350; i++) {
    g.fillStyle = i % 3 ? '#7055290b' : '#ffffff50';
    g.fillRect(-248 + (i * 173.83) % 495, -298 + (i * 93.77) % 605, 2, .6);
  }
  const copy = STORY_COPY[story], local = copy[locale];
  text(g, local.eyebrow, -205, -245, 12, '#8f7258');
  const font = story === 'workshop' ? SANS : HAND;
  copy.title.forEach((value, i) => text(g, value, -205, -185 + i * 36, 27, '#415346', SERIF));
  copy.lines.forEach((value, i) => text(g, value, -205, -65 + i * 43, 22, '#465a61', font));
  text(g, copy.signature, -205, 132, 18, '#8a614b', font);
  g.strokeStyle = '#a4896450'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-205, 167); g.lineTo(205, 167); g.stroke();
  local.caption.forEach((value, i) => text(g, value, -205, 214 + i * 31, 22, '#634a34', SERIF));
  text(g, local.footer, -205, 285, 12, '#8b7965');
  return canvas;
}

function buildScene(c: SceneCtx, story: LifeStory, plate: string): SceneInstance {
  const { width: W, height: H } = c;
  const locale = c.locale ?? 'ru';
  const layout = storyLayout(W, H, c.body, c.contentVisible === true);
  const sheet = makeSheet(story, locale, Math.max(1, Math.min(2, c.dpr * layout.scale)));
  const backdrop = document.createElement('canvas');
  backdrop.width = Math.ceil(W * c.dpr); backdrop.height = Math.ceil(H * c.dpr);
  const bg = backdrop.getContext('2d')!;
  let loaded = false, failed = false, disposed = false;
  const image = new Image(); image.decoding = 'async';
  const photoSource = storyPhotoSource(plate, W, c.body, c.dpr);
  image.onload = () => {
    if (disposed) return;
    bg.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
    const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
    bg.drawImage(image, (W - image.naturalWidth * scale) / 2, (H - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
    loaded = true;
  };
  image.onerror = () => {
    if (!disposed) { failed = true; console.error(`Unable to load lifelong story photo: ${photoSource}`); }
  };
  image.src = photoSource;
  return {
    ready: () => loaded || failed,
    update() {},
    draw(g) {
      g.clearRect(0, 0, W, H);
      if (loaded) g.drawImage(backdrop, 0, 0, W, H);
      else { g.fillStyle = '#493b2b'; g.fillRect(0, 0, W, H); }
      g.save(); g.translate(layout.x, layout.y); g.scale(layout.scale, layout.scale); g.rotate(-.025);
      g.drawImage(sheet, -300, -350, 600, 720);
      if (failed) text(g, locale === 'uk' ? 'Не вдалося завантажити зображення.' : 'Не удалось загрузить изображение.', -250, -321, 15, '#fff1d8');
      g.restore();
    },
    dispose() {
      disposed = true; image.onload = image.onerror = null; image.src = '';
      sheet.width = sheet.height = backdrop.width = backdrop.height = 0;
    },
  };
}

/** Standalone stills also remain in the test gallery. */
const individualStories: CanvasSceneDef[] = LIFELONG_CATALOG.map((meta, index) => ({
  kind: 'canvas', id: meta.id, label: meta.ru, palettes: [['#33271e', '#f2dfba', '#617c68']],
  static: true, pixelRatioCap: 2, warmupFrames: 1,
  defaultParams: { speed: 1, react: 0, intensity: 1 },
  create: c => buildScene(c, keys[index], meta.plate),
}));
export const LIFELONG_SCENES: CanvasSceneDef[] = [...individualStories, {
  kind: 'canvas', id: 'late-stories', label: 'Никогда не поздно · четыре истории',
  palettes: [['#33271e', '#f2dfba', '#617c68']], static: true, pixelRatioCap: 2, warmupFrames: 1,
  defaultParams: { speed: 1, react: 0, intensity: 1, lifeStory: -1 },
  create(c) {
    let index = ensureLifeStory(c.params);
    let instance = individualStories[index].create(c);
    let visible = true;
    return {
      ready: () => instance.ready?.() ?? true,
      setVisible(value) { visible = value; instance.setVisible?.(value); },
      update(dt, time, pointer) {
        const chosen = ensureLifeStory(c.params);
        if (chosen !== index) {
          instance.dispose?.(); index = chosen;
          instance = individualStories[index].create(c);
          instance.setVisible?.(visible);
        }
        instance.update(dt, time, pointer);
      },
      draw: g => instance.draw(g),
      dispose: () => instance.dispose?.(),
    };
  },
}];
