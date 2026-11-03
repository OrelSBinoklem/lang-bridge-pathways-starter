'use client';

import dynamic from 'next/dynamic';
import type { GroupEffectDefinition } from './groupEffects.config';
import type { EffectTuningState } from './tuning/types';
import { PageEffectHost } from './EffectHost';

const Grid = dynamic(() => import('./BodyGridEffect').then(m => m.BodyGridEffect), { ssr: false });
const Fluid = dynamic(() => import('./FluidEffect').then(m => m.FluidEffect), { ssr: false });
const Glass = dynamic(() => import('./BodyLiquidGlassEffect').then(m => m.BodyLiquidGlassEffect), { ssr: false });
const Drops = dynamic(() => import('./LiquidDropsEffect').then(m => m.LiquidDropsEffect), { ssr: false });
const Lanterns = dynamic(() => import('./BodyLanternWaterEffect').then(m => m.BodyLanternWaterEffect), { ssr: false });
const Sakura = dynamic(() => import('./BodySakuraEffect').then(m => m.BodySakuraEffect), { ssr: false });
const Nature = dynamic(() => import('./BodyNatureEffect').then(m => m.BodyNatureEffect), { ssr: false });
const Photo = dynamic(() => import('./BodyPhotoEffect').then(m => m.BodyPhotoEffect), { ssr: false });
const Pottery = dynamic(() => import('./pottery/PotteryEffect'), { ssr: false });

type Props = {
  effect: GroupEffectDefinition; tuning?: EffectTuningState | null; focused?: boolean; uk?: boolean; onClose?: () => void;
};
export function BodyEffectContent(props: Props) {
  return <PageEffectHost><BodyEffectEngine {...props} /></PageEffectHost>;
}

function BodyEffectEngine({ effect, tuning, focused = false, uk = false, onClose = () => {} }: Props) {
  const body = effect.bodyEffect;
  const accent = effect.accent ?? effect.glow;
  switch (body) {
    case 'grid': return <Grid accent={accent} />;
    case 'fluid': return <Fluid accent={accent} />;
    case 'liquid-glass': return <Glass />;
    case 'liquid-drops': return <Drops params={tuning?.kind === 'liquid-drops' ? tuning.params : undefined} />;
    case 'lantern-water': return <Lanterns params={tuning?.kind === 'lantern-water' ? tuning.params : undefined} />;
    case 'sakura': return <Sakura params={tuning?.kind === 'sakura' ? tuning.params : undefined} />;
    case 'sakura-card': case 'leaves': return <Nature effect={effect} tuning={tuning} />;
    case 'holo-island': case 'holo-silver': case 'street-relight': return <Photo kind={body} />;
    case 'pottery': return <Pottery focused={focused} uk={uk} onClose={onClose} />;
    default: return null;
  }
}
