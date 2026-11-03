import { SHADER_SCENES } from '../scenes/shaderScenes';
import { SHOWCASE_SCENES, STUDY_SCENES } from './scenes';

export const LAB_SCENES = [...SHOWCASE_SCENES, ...STUDY_SCENES, ...SHADER_SCENES];
export const BENCHMARK_WARMUP_MS = 1000;
export const BENCHMARK_SAMPLE_MS = 3000;
export const RESOLUTIONS = [
  { label: '960 × 540', width: 960, height: 540 },
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
];
