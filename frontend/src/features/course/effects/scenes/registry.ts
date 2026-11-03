import type { SceneDef } from './types';
import { ALL_SCENES } from './sceneCatalog.generated';
export { ALL_SCENES };
const BY_ID = new Map<string, SceneDef>(ALL_SCENES.map(scene => [scene.id, scene]));
export function getScene(id: string): SceneDef | null { return BY_ID.get(id) ?? null; }
