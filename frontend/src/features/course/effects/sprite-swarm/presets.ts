export const SWARM_PRESETS = [
  { id: 1, label: 'Мягкий свет' }, { id: 2, label: 'Кольца' }, { id: 3, label: 'Искристая пыль' },
  { id: 4, label: 'Горизонтальные блики' }, { id: 5, label: 'Четыре луча' }, { id: 6, label: 'Полумесяцы' },
  { id: 7, label: 'Прицелы' }, { id: 8, label: 'Звёздные блики' }, { id: 9, label: 'Восемь лучей' },
  { id: 10, label: 'Сердца' }, { id: 11, label: 'Звёзды' }, { id: 12, label: 'Световые полосы' }, { id: 13, label: 'Острые блики' },
] as const;

export const swarmSpritePath = (id: number) => `/course/effects/sprite-swarm/${id}.png`;
export type SwarmSettings = { count: number; size: number; speed: number; amplitude: number; paused: boolean; coloredImage: boolean };
export const SWARM_DEFAULTS: SwarmSettings = { count: 1000, size: .5, speed: 1, amplitude: 1, paused: false, coloredImage: false };
