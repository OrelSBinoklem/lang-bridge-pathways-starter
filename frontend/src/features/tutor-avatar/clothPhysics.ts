/**
 * Cloth behaviour for VRoid clothes that have no spring bones of their own (here the cardigan and the shorts).
 *
 * Sway: a few spring points ("anchors") are spread over the loose lower part of each garment, each riding on the
 * bone that carries that spot. Every frame they lag, overshoot and settle behind their bones, and bump off the
 * forearms and hands; the vertices around them follow by distance weights, more toward the hem, none near the top.
 *
 * Dent: arms and thighs are capsules on the skinned bones; a cloth vertex inside one slides out to its surface with a
 * soft edge, so a hand on the cardigan presses it in instead of passing through. Vertices that belong to the limb
 * itself (sleeves weighted to the arm, trouser legs to the leg) are left alone.
 *
 * Both run in the vertex shader of the cloth materials and their MToon outlines; the spring points run on the CPU.
 */
import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

type Kind = 'arm' | 'leg';
type Capsule = { a: VRMHumanBoneName; b: VRMHumanBoneName | null; radius: number; kind: Kind; reach?: number; swing?: boolean };
const CAPSULES: Capsule[] = (['left', 'right'] as const).flatMap(s => [
  { a: `${s}UpperArm`, b: `${s}LowerArm`, radius: 0.05, kind: 'arm' },
  { a: `${s}LowerArm`, b: `${s}Hand`, radius: 0.045, kind: 'arm', swing: true },
  { a: `${s}Hand`, b: null, radius: 0.04, kind: 'arm', reach: 0.08, swing: true },
  { a: `${s}UpperLeg`, b: `${s}LowerLeg`, radius: 0.075, kind: 'leg' },
] satisfies Capsule[]);
const CAPS = CAPSULES.length;
// Shoulders are not the limb: the cardigan's chest is skinned to them and should still give way.
const LIMB: Record<Kind, RegExp> = { arm: /UpperArm|LowerArm|Hand|Thumb|Index|Middle|Ring|Little/, leg: /Leg|Foot|Toes/ };
/** Garments that move (VRoid material names): how many spring points, how far they may swing, how loose. */
const GARMENTS = [
  { match: /Tops/, anchors: 16, reach: 0.07, amount: 1 },
  { match: /Bottoms/, anchors: 8, reach: 0.025, amount: 0.5 },
];
const ANCHORS = GARMENTS.reduce((n, g) => n + g.anchors, 0);
const STIFFNESS = 140, DAMPING = 9;

const PARS = /* glsl */ `
uniform vec4 uCapA[${CAPS}];
uniform vec4 uCapB[${CAPS}];
uniform vec3 uSway[${ANCHORS}];
attribute float aArmFree;
attribute float aLegFree;
attribute vec4 aSwayIndex;
attribute vec4 aSwayWeight;
vec3 clothSway() {
  return aSwayWeight.x * uSway[ int( aSwayIndex.x ) ] + aSwayWeight.y * uSway[ int( aSwayIndex.y ) ]
    + aSwayWeight.z * uSway[ int( aSwayIndex.z ) ] + aSwayWeight.w * uSway[ int( aSwayIndex.w ) ];
}
vec3 clothDent( vec3 p ) {
  for ( int i = 0; i < ${CAPS}; i ++ ) {
    float free = uCapB[ i ].w < 0.5 ? aArmFree : aLegFree;
    if ( free < 0.01 ) continue;
    vec3 a = uCapA[ i ].xyz, ab = uCapB[ i ].xyz - a;
    float r = uCapA[ i ].w;
    vec3 c = a + ab * clamp( dot( p - a, ab ) / max( dot( ab, ab ), 1e-6 ), 0.0, 1.0 );
    vec3 d = p - c;
    float dist = length( d );
    if ( dist > r + 0.04 || dist < 1e-5 ) continue;
    // Smooth max( dist, r ): untouched further out, pressed to the surface inside.
    float soft = 0.012;
    float target = r + soft * log( 1.0 + exp( ( dist - r ) / soft ) );
    p = c + d / dist * mix( dist, target, free );
  }
  return p;
}
`;

type Anchor = { bone: THREE.Object3D; offset: THREE.Vector3; reach: number; pos: THREE.Vector3; vel: THREE.Vector3; target: THREE.Vector3; ready: boolean };

export class ClothPhysics {
  private capA = Array.from({ length: CAPS }, () => new THREE.Vector4());
  private capB = Array.from({ length: CAPS }, () => new THREE.Vector4());
  private sway = Array.from({ length: ANCHORS }, () => new THREE.Vector3());
  private anchors: Anchor[] = [];
  private meshes: THREE.SkinnedMesh[] = [];
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private inverse = new THREE.Matrix4();

  /** Call in the bind pose (right after loading), with world matrices up to date. */
  constructor(private vrm: VRM) {
    const patched = new Set<THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>();
    const garments = GARMENTS.map(() => [] as THREE.SkinnedMesh[]);
    vrm.scene.traverse(o => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.ShaderMaterial[];
      const g = GARMENTS.findIndex(gm => materials.some(m => gm.match.test(m.name)));
      if (g < 0) return;
      this.meshes.push(mesh);
      garments[g].push(mesh);
      if (!geometries.has(mesh.geometry)) { this.addFreeWeights(mesh); geometries.add(mesh.geometry); }
      for (const m of materials) if (!patched.has(m)) { this.patch(m); patched.add(m); }
    });
    let first = 0;
    garments.forEach((meshes, g) => { this.addSway(meshes, GARMENTS[g], first); first += GARMENTS[g].anchors; });
    // Geometries without a garment of their own still need the attributes the patched shader reads.
    for (const mesh of this.meshes) {
      const geo = mesh.geometry;
      if (!geo.getAttribute('aSwayIndex')) {
        geo.setAttribute('aSwayIndex', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 4), 4));
        geo.setAttribute('aSwayWeight', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 4), 4));
      }
    }
  }

  private boneNames() {
    const raw = new Map<THREE.Object3D, string>();
    for (const [name, bone] of Object.entries(this.vrm.humanoid.humanBones)) if (bone?.node) raw.set(bone.node, name);
    return raw;
  }

  /** aArmFree / aLegFree: 1 minus how much a vertex is skinned to arm / leg bones. */
  private addFreeWeights(mesh: THREE.SkinnedMesh) {
    const geo = mesh.geometry, index = geo.getAttribute('skinIndex'), weight = geo.getAttribute('skinWeight');
    const raw = this.boneNames();
    const kindOf = mesh.skeleton.bones.map(b => { const name = raw.get(b) ?? ''; return LIMB.arm.test(name) ? 'arm' : LIMB.leg.test(name) ? 'leg' : ''; });
    const arm = new Float32Array(index.count), leg = new Float32Array(index.count);
    for (let v = 0; v < index.count; v++) {
      let wa = 0, wl = 0;
      for (let k = 0; k < 4; k++) { const kind = kindOf[index.getComponent(v, k)], w = weight.getComponent(v, k); if (kind === 'arm') wa += w; else if (kind === 'leg') wl += w; }
      // Even a little limb weight means the vertex travels with the limb: keep it out of the dent.
      arm[v] = Math.max(0, 1 - wa * 3); leg[v] = Math.max(0, 1 - wl * 3);
    }
    geo.setAttribute('aArmFree', new THREE.BufferAttribute(arm, 1));
    geo.setAttribute('aLegFree', new THREE.BufferAttribute(leg, 1));
  }

  /** Spreads a garment's spring points over its loose part and weights its vertices to them. */
  private addSway(meshes: THREE.SkinnedMesh[], garment: (typeof GARMENTS)[number], first: number) {
    if (!meshes.length) return;
    const mesh = meshes[0], geo = mesh.geometry;
    const pos = geo.getAttribute('position'), arm = geo.getAttribute('aArmFree');
    const skinIndex = geo.getAttribute('skinIndex'), skinWeight = geo.getAttribute('skinWeight');
    // This garment's own vertices (primitives share one vertex buffer), sleeves excluded.
    const own = new Set<number>();
    for (const m of meshes) { const index = m.geometry.index; if (index) for (let i = 0; i < index.count; i++) own.add(index.getX(i)); }
    const verts = [...own].filter(v => arm.getX(v) > 0.5);
    if (!verts.length) return;
    let minY = Infinity, maxY = -Infinity;
    for (const v of verts) { const y = pos.getY(v); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    // Loose from 60 % of the height down to the hem; the top stays put.
    const top = minY + (maxY - minY) * 0.6;
    const loose = (y: number) => { const t = THREE.MathUtils.clamp((top - y) / Math.max(top - minY, 1e-3), 0, 1); return t * t * (3 - 2 * t); };
    // Spring points: farthest-point sampling over the loose vertices.
    const candidates = verts.filter(v => loose(pos.getY(v)) > 0.25);
    const picked: number[] = [];
    const dist = new Float32Array(candidates.length).fill(Infinity);
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    for (let n = 0; n < garment.anchors && candidates.length; n++) {
      let best = 0;
      if (n === 0) { for (let i = 1; i < candidates.length; i++) if (pos.getY(candidates[i]) < pos.getY(candidates[best])) best = i; }
      else for (let i = 1; i < candidates.length; i++) if (dist[i] > dist[best]) best = i;
      picked.push(candidates[best]);
      p.fromBufferAttribute(pos, candidates[best]);
      for (let i = 0; i < candidates.length; i++) dist[i] = Math.min(dist[i], q.fromBufferAttribute(pos, candidates[i]).distanceToSquared(p));
    }
    // Each point rides on the bone that carries most of its vertex.
    const bones = mesh.skeleton.bones;
    for (const v of picked) {
      let bestBone = 0, bestW = -1;
      for (let k = 0; k < 4; k++) { const w = skinWeight.getComponent(v, k); if (w > bestW) { bestW = w; bestBone = skinIndex.getComponent(v, k); } }
      const bone = bones[bestBone];
      const rest = new THREE.Vector3().fromBufferAttribute(pos, v).applyMatrix4(mesh.matrixWorld);
      const offset = rest.clone().applyMatrix4(bone.matrixWorld.clone().invert());
      this.anchors.push({ bone, offset, reach: garment.reach, pos: rest.clone(), vel: new THREE.Vector3(), target: rest.clone(), ready: false });
    }
    // Vertex weights: the three nearest points by inverse square distance, times looseness. Parts the model already
    // moves with its own spring bones (VRoid "J_Sec_…", e.g. shirt tails) are left to them: swaying them twice
    // lifts the hem off the body.
    const index = new Float32Array(pos.count * 4), weight = new Float32Array(pos.count * 4);
    const anchorPos = picked.map(v => new THREE.Vector3().fromBufferAttribute(pos, v));
    const spring = bones.map(b => b.name.startsWith('J_Sec_'));
    for (const v of own) {
      p.fromBufferAttribute(pos, v);
      let sprung = 0;
      for (let k = 0; k < 4; k++) if (spring[skinIndex.getComponent(v, k)]) sprung += skinWeight.getComponent(v, k);
      const amount = loose(p.y) * garment.amount * Math.min(1, arm.getX(v) * 1.5) * Math.max(0, 1 - sprung * 2);
      if (amount < 0.01) continue;
      const near = anchorPos.map((a, i) => [i, a.distanceToSquared(p)] as const).sort((x, y) => x[1] - y[1]).slice(0, 3);
      const inv = near.map(([, d]) => 1 / (d + 0.0004));
      const sum = inv.reduce((s, w) => s + w, 0);
      near.forEach(([i], k) => { index[v * 4 + k] = first + i; weight[v * 4 + k] = (inv[k] / sum) * amount; });
    }
    for (const m of meshes) {
      m.geometry.setAttribute('aSwayIndex', new THREE.BufferAttribute(index, 4));
      m.geometry.setAttribute('aSwayWeight', new THREE.BufferAttribute(weight, 4));
    }
  }

  private patch(material: THREE.ShaderMaterial) {
    material.uniforms.uCapA = { value: this.capA };
    material.uniforms.uCapB = { value: this.capB };
    material.uniforms.uSway = { value: this.sway };
    const compile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `${PARS}\nvoid main() {`)
        .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed = clothDent( transformed + clothSway() );');
    };
    const key = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => `${key()},clothPhysics`;
    material.needsUpdate = true;
  }

  /** Capsules from the posed bones (world space) into `this.capA/B` (mesh space); returns the world ones too. */
  private updateCapsules(world: { a: THREE.Vector3; b: THREE.Vector3; r: number }[]) {
    const h = this.vrm.humanoid;
    CAPSULES.forEach((c, i) => {
      const from = h.getRawBoneNode(c.a), to = c.b ? h.getRawBoneNode(c.b) : null;
      if (!from) { this.capA[i].set(0, -10, 0, 0); this.capB[i].set(0, -10, 0, 1); return; }
      from.getWorldPosition(this.a);
      if (to) to.getWorldPosition(this.b);
      else {
        // The hand: a short capsule along the forearm direction.
        h.getRawBoneNode(c.a.replace('Hand', 'LowerArm') as VRMHumanBoneName)?.getWorldPosition(this.b);
        this.b.sub(this.a).multiplyScalar(-1).setLength(c.reach ?? 0.08).add(this.a);
      }
      // Spring points only bump off forearms and hands; thighs and upper arms rest against the cloth anyway and the dent
      // handles them per vertex.
      if (c.swing) world.push({ a: this.a.clone(), b: this.b.clone(), r: c.radius });
      this.a.applyMatrix4(this.inverse); this.b.applyMatrix4(this.inverse);
      this.capA[i].set(this.a.x, this.a.y, this.a.z, c.radius);
      this.capB[i].set(this.b.x, this.b.y, this.b.z, c.kind === 'arm' ? 0 : 1);
    });
  }

  /** Steps the spring points and refreshes the shader inputs; call after vrm.update(). */
  update(dt: number) {
    const mesh = this.meshes[0];
    if (!mesh) return;
    this.inverse.copy(mesh.matrixWorld).invert();
    const caps: { a: THREE.Vector3; b: THREE.Vector3; r: number }[] = [];
    this.updateCapsules(caps);
    const steps = 2, h = Math.min(dt, 0.05) / steps;
    this.anchors.forEach((an, i) => {
      an.target.copy(an.offset).applyMatrix4(an.bone.matrixWorld);
      if (!an.ready) { an.pos.copy(an.target); an.vel.set(0, 0, 0); an.ready = true; }
      for (let s = 0; s < steps; s++) {
        // Damped spring toward where the cloth would be without inertia.
        this.c.copy(an.target).sub(an.pos).multiplyScalar(STIFFNESS).addScaledVector(an.vel, -DAMPING);
        an.vel.addScaledVector(this.c, h);
        an.pos.addScaledVector(an.vel, h);
        // Bump off arms and thighs.
        for (const cap of caps) {
          const ab = this.b.copy(cap.b).sub(cap.a);
          const t = THREE.MathUtils.clamp(this.c.copy(an.pos).sub(cap.a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1);
          const closest = this.a.copy(cap.a).addScaledVector(ab, t);
          const d = this.c.copy(an.pos).sub(closest), len = d.length(), r = cap.r + 0.008;
          if (len < r && len > 1e-5) {
            d.multiplyScalar(1 / len);
            an.pos.copy(closest).addScaledVector(d, r);
            const into = an.vel.dot(d);
            if (into < 0) an.vel.addScaledVector(d, -into);
          }
        }
        // Cloth is held at its seams: never further than `reach` from where it hangs.
        const off = this.c.copy(an.pos).sub(an.target);
        if (off.length() > an.reach) { off.setLength(an.reach); an.pos.copy(an.target).add(off); }
      }
      // Shader input: the swing in mesh space.
      this.a.copy(an.pos).applyMatrix4(this.inverse);
      this.b.copy(an.target).applyMatrix4(this.inverse);
      this.sway[i].copy(this.a).sub(this.b);
    });
  }
}
