'use client';
import { useCallback, useRef, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import type { GroupEffectKind } from '../groupEffects.config';
import type { FullscreenEffectProps } from './types';
import { getFullscreenRegions, type FullscreenRegion } from './layout';
import { useFullscreenPointer } from './useFullscreenPointer';
const AmbientFullscreen = dynamic(() => import('./AmbientFullscreen').then(m => m.AmbientFullscreen), { ssr: false });
const CursorFullscreen = dynamic(() => import('./CursorFullscreen').then(m => m.CursorFullscreen), { ssr: false });
const StormFullscreen = dynamic(() => import('./StormFullscreen').then(m => m.StormFullscreen), { ssr: false });
const CompassFullscreen = dynamic<FullscreenEffectProps>(() => import('./CompassFullscreen').then(m => m.CompassFullscreen), { ssr: false });
const CircuitFullscreen = dynamic(() => import('./CircuitFullscreen').then(m => m.CircuitFullscreen), { ssr: false });
const SparkleFullscreen = dynamic(() => import('./SparkleFullscreen').then(m => m.SparkleFullscreen), { ssr: false });
const PulseRingsFullscreen = dynamic(() => import('./PulseRingsFullscreen').then(m => m.PulseRingsFullscreen), { ssr: false });
const OrbitDotsFullscreen = dynamic(() => import('./OrbitDotsFullscreen').then(m => m.OrbitDotsFullscreen), { ssr: false });
const WaterRippleFullscreen = dynamic(() => import('./WaterRippleFullscreen').then(m => m.WaterRippleFullscreen), { ssr: false });
const VideoFullscreen = dynamic(() => import('./VideoFullscreen').then(m => m.VideoFullscreen), { ssr: false });
const MineFullscreen = dynamic(() => import('./MineFullscreen').then(m => m.MineFullscreen), { ssr: false });
const ImageRevealFullscreen = dynamic(() => import('./ImageRevealFullscreen').then(m => m.ImageRevealFullscreen), { ssr: false });
const LatviaCubeFullscreen = dynamic(() => import('./LatviaCubeFullscreen').then(m => m.LatviaCubeFullscreen), { ssr: false });
const SakuraFullscreen = dynamic(() => import('./SakuraFullscreen').then(m => m.SakuraFullscreen), { ssr: false });
const SunWaterFullscreen = dynamic(() => import('./SunWaterFullscreen').then(m => m.SunWaterFullscreen), { ssr: false });
const LanternWaterFullscreen = dynamic(() => import('./LanternWaterFullscreen').then(m => m.LanternWaterFullscreen), { ssr: false });
const EmbroideryFullscreen = dynamic(() => import('./EmbroideryFullscreen').then(m => m.EmbroideryFullscreen), { ssr: false });
const AmberFullscreen = dynamic(() => import('./AmberFullscreen').then(m => m.AmberFullscreen), { ssr: false });
const SongFireFullscreen = dynamic(() => import('./SongFireFullscreen').then(m => m.SongFireFullscreen), { ssr: false });
const SceneFullscreen = dynamic(() => import('./SceneFullscreen').then(m => m.SceneFullscreen), { ssr: false });

export const FULLSCREEN_COMPONENTS: Record<GroupEffectKind, ComponentType<FullscreenEffectProps>> = {
  ambient: AmbientFullscreen, cursor: CursorFullscreen, storm: StormFullscreen, compass: CompassFullscreen,
  circuit: CircuitFullscreen, sparkle: SparkleFullscreen, 'pulse-rings': PulseRingsFullscreen, 'orbit-dots': OrbitDotsFullscreen,
  water: WaterRippleFullscreen, video: VideoFullscreen, mine: MineFullscreen, 'image-reveal': ImageRevealFullscreen,
  'latvia-cube': LatviaCubeFullscreen, sakura: SakuraFullscreen, 'sun-water': SunWaterFullscreen,
  'lantern-water': LanternWaterFullscreen, embroidery: EmbroideryFullscreen, 'amber-words': AmberFullscreen,
  'song-fire': SongFireFullscreen, scene: SceneFullscreen,
};

export function FullscreenSurface(props: FullscreenEffectProps) {
  const Effect = FULLSCREEN_COMPONENTS[props.effect.kind];
  // These backgrounds span the page. The bonfire engine itself places its only fire on the right.
  const continuous = props.effect.kind === 'lantern-water' || props.effect.kind === 'video' || props.effect.kind === 'song-fire' || props.effect.kind === 'image-reveal' || props.effect.kind === 'mine' || props.effect.kind === 'storm' || props.effect.kind === 'sun-water'
    || props.effect.kind === 'scene' && ['highway', 'highway-panorama', 'week-gardens', 'week-book', 'folding-home', 'fireflies'].includes(props.effect.sceneId ?? '');
  const regions = getFullscreenRegions(props.width, props.height, props.contentVisible && !continuous);
  return <div data-fullscreen-component={props.effect.kind} style={{ position: 'absolute', inset: 0 }}>
    {regions.map(region => <Region key={region.id} region={region} effectProps={props} Effect={Effect} />)}
  </div>;
}

function Region({ region, effectProps, Effect }: { region: FullscreenRegion; effectProps: FullscreenEffectProps; Effect: ComponentType<FullscreenEffectProps> }) {
  const host = useRef<HTMLDivElement>(null);
  const getBounds = useCallback(() => host.current?.getBoundingClientRect() ?? null, []);
  const localPointer = useFullscreenPointer(getBounds);
  return <div ref={host} data-fullscreen-region={region.id} style={{ position: 'absolute', left: region.left, top: region.top, width: region.width, height: region.height, overflow: 'hidden' }}>
    <Effect {...effectProps} region={region.id} width={region.width} height={region.height} pointerRef={region.id === 'full' ? effectProps.pointerRef : localPointer} />
  </div>;
}
