/** In-memory colour + depth + reflection bake, retained until the view/lighting actually changes.
 * Water time, foam and caustics must never invalidate the expensive limestone pass. */
export function createFountainStaticBake() {
  let revision = 0;
  let bakedRevision = -1;
  let sun = NaN;
  let count = 0;
  return {
    invalidate() { revision++; },
    needsBake(strength: number) { return revision !== bakedRevision || strength !== sun; },
    commit(strength: number) { bakedRevision = revision; sun = strength; count++; },
    get count() { return count; },
  };
}
