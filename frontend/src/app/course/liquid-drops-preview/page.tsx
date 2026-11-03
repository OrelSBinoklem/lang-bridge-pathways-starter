import { LiquidDropsPreview } from './LiquidDropsPreview';
import {
  LIQUID_DROPS_PRESETS,
  LIQUID_DROPS_SCENE_LABELS,
  type LiquidDropsScene,
} from '@/features/course/effects/liquidDrops/params';

const SCENES = (Object.keys(LIQUID_DROPS_SCENE_LABELS) as LiquidDropsScene[]).filter((scene) => scene !== 'custom');

/**
 * Dev page for the "Красота и здоровье" liquid-glass background. The course itself needs the
 * backend's course data, this page does not. `?scene=sauna&cols=45&image=/path&preset=dew` starts it in another setup.
 */
export default async function LiquidDropsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const scene = SCENES.find((item) => item === query.scene);
  const cols = Number(query.cols);
  // `?image=/course/effects/curiosity-art.webp` puts a picture from public/ under the drops.
  const image = typeof query.image === 'string' && query.image.startsWith('/') ? query.image : undefined;
  const preset = typeof query.preset === 'string' && query.preset in LIQUID_DROPS_PRESETS ? query.preset : undefined;
  return (
    <LiquidDropsPreview
      scene={scene}
      columns={Number.isFinite(cols) && cols >= 10 ? cols : undefined}
      image={image}
      preset={preset}
    />
  );
}
