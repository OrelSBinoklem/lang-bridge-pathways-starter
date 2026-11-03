import assert from 'node:assert/strict';

// Compare source identity and bytes, not just public filenames.
export function assertExclusivePhotos(variants, assets, expectedCount) {
  const byImage = new Map(assets.map(asset => [asset.image, asset]));
  assert.equal(byImage.size, assets.length, 'Duplicate asset URL');
  const used = {id: new Map(), source_url: new Map(), source_sha256: new Map(), sha256: new Map()};
  const assignments = [];
  function visit(value, location) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.image === 'string') {
      const asset = byImage.get(value.image);
      assert(asset, `Unknown photograph at ${location}: ${value.image}`);
      for (const [field, seen] of Object.entries(used)) {
        const key = asset[field];
        assert(key, `Missing ${field} for ${value.image}`);
        assert(!seen.has(key), `Repeated photograph (${field}) at ${location}; already used at ${seen.get(key)}`);
        seen.set(key, location);
      }
      assignments.push({location, photo_id: asset.id, image: asset.image});
    }
    for (const [key, child] of Object.entries(value)) visit(child, `${location}/${key}`);
  }
  for (const entry of variants) visit(entry.replace_sections, `${entry.level}-${entry.position}`);
  assert.equal(assignments.length, assets.length, 'Unused assets in release manifest');
  if (expectedCount !== undefined) assert.equal(assignments.length, expectedCount, 'Unexpected number of photographs');
  return assignments;
}
