import type { MutableRefObject } from 'react';
import type { PointerState } from '../engine';
import type { GroupEffectDefinition } from '../groupEffects.config';
import type { EffectTuningState } from '../tuning/types';

export type FullscreenEffectProps = {
  effect: GroupEffectDefinition;
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  tuning: EffectTuningState | null;
  contentVisible?: boolean;
  region?: 'full' | 'left' | 'right';
};
