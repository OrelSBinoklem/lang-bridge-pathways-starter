import { T, type World } from './world';

const mappedCopies = new WeakMap<T.MeshStandardMaterial, Set<T.MeshStandardMaterial>>();

export function trainMaterials(w: World, maps = true) {
  const loader = maps ? new T.TextureLoader() : null;
  const texture = (file: string, color = true, ready?: (map: T.Texture) => void) => {
    if (!loader) return null;
    const map = w.ownTexture(loader.load(`/course/effects/platskart/${file}?v=3`, map => ready?.(map), undefined, error => console.warn(`[platskart] Texture unavailable: ${file}`, error)));
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.anisotropy = Math.min(8, w.renderer.capabilities.getMaxAnisotropy());
    return map;
  };
  const surface = (kind: string, color: string, roughness: number, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    const apply = (key: 'map' | 'bumpMap' | 'roughnessMap', map: T.Texture) => {
      for (const material of [m, ...(mappedCopies.get(m) ?? [])]) { material[key] = map; material.needsUpdate = true; }
    };
    // Keep the honest solid fallback until each image is ready. Sampling an
    // uninitialized roughness/albedo map briefly made hands black and wet.
    texture(`${kind}.webp`, true, map => apply('map', map));
    texture(`${kind}-height.png`, false, map => apply('bumpMap', map));
    texture(`${kind}-roughness.webp`, false, map => apply('roughnessMap', map));
    m.bumpScale = kind === 'wood' ? .0025 : .001;
    return m;
  };
  const light = (name: string) => { const map = texture(`light-${name}.webp`); if (map) { map.channel = 1; map.wrapS = map.wrapT = T.ClampToEdgeWrapping; } return map; };
  const skin = new T.MeshPhysicalMaterial({ color: '#edd0bb', roughness: .8, bumpScale: .00016, sheen: .14, sheenColor: '#b86f61', sheenRoughness: .85 });
  texture('skin.webp', true, map => { skin.map = map; skin.needsUpdate = true; });
  texture('skin-height.png', false, map => { skin.bumpMap = map; skin.needsUpdate = true; });
  texture('skin-roughness.webp', false, map => { skin.roughnessMap = map; skin.needsUpdate = true; });
  const vinyl = surface('vinyl', '#c7ccc0', .9); vinyl.vertexColors = true;
  return {
    wood: surface('wood', '#e9c8a4', .65), vinyl,
    paint: surface('paint', '#f1efdf', .98), cloth: surface('cloth', '#fffdf6', .98),
    metal: surface('metal', '#bcb8a8', .3, .9), brass: surface('metal', '#b99b61', .33, .83),
    dark: w.metal('#252b24', .18, .9), piping: w.metal('#514b36', .12, .65),
    olive: surface('cloth', '#65705c', .98), skin,
    nail: new T.MeshPhysicalMaterial({ color: '#cba999', roughness: .43, clearcoat: .18, clearcoatRoughness: .5 }),
    crease: w.metal('#a97c68', 0, .98), tendon: w.metal('#c39b82', 0, .9),
    stitch: w.metal('#8f937d', 0, .95), rubber: w.metal('#30382f', 0, .95),
    underside: surface('paint', '#b2b2a2', .98), blanket: surface('cloth', '#707d75', 1),
    porcelain: new T.MeshPhysicalMaterial({ color: '#e2ddc8', roughness: .21, clearcoat: .65 }),
    blue: w.metal('#2c4b5b', .2, .45), tea: new T.MeshPhysicalMaterial({ color: '#552704', roughness: .13, metalness: .08, clearcoat: 1 }),
    glass: new T.MeshPhysicalMaterial({ color: '#cfddcb', transparent: true, opacity: .19, roughness: .07, metalness: .05, side: T.DoubleSide, depthWrite: false, clearcoat: 1 }),
    pine: texture('pine-branch.png'),
    lamp: w.glow('#ffd391', .65), lights: { table: light('table'), partition: light('partition'), floor: light('floor'), ceiling: light('ceiling'), right: light('right') },
  };
}
export type TrainMaterials = ReturnType<typeof trainMaterials>;

export function mappedPlane(w: World, parent: T.Object3D, origin: readonly number[], u: readonly number[], v: readonly number[], normal: readonly number[], source: T.MeshStandardMaterial, light: T.Texture | null) {
  const vertices = [origin, origin.map((x, i) => x + u[i]), origin.map((x, i) => x + u[i] + v[i]), origin.map((x, i) => x + v[i])];
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices.flat(), 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute(Array.from({ length: 4 }, () => [...normal]).flat(), 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setAttribute('uv1', geometry.attributes.uv.clone());
  const cross = new T.Vector3(...u as [number, number, number]).cross(new T.Vector3(...v as [number, number, number]));
  geometry.setIndex(cross.dot(new T.Vector3(...normal as [number, number, number])) < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
  const material = source.clone(); material.side = T.DoubleSide; material.lightMap = light; material.lightMapIntensity = 2;
  const copies = mappedCopies.get(source) ?? new Set<T.MeshStandardMaterial>(); copies.add(material); mappedCopies.set(source, copies);
  return w.mesh(geometry, material, parent);
}
