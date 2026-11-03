// node tools/avatar/convert-mixamo.mjs <fbx dir> <out dir> [--vrm=<model.vrm>] [--info]
// With --vrm the arms are fitted to that model: they no longer pass through its bare body (armFix.mjs).
// Retargets Mixamo FBX animations to the VRM normalized humanoid (T-pose, faces +Z) and writes compact JSON clips:
// { name, duration, fps, frames, bones: { vrmBone: base64 Int16 x,y,z,w per frame (one quaternion when constant) }, hips }
// Quaternions are stored as value * 32767; hips positions as value / first-frame hips height * 8192 (so the player multiplies by the
// model's own hips height).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';

// FBXLoader only needs a DOM for embedded textures; the images are never used here.
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {} }) };
globalThis.window = globalThis;
globalThis.self = globalThis;
const three = new URL('../../frontend/node_modules/three/', import.meta.url);
const THREE = await import(new URL('build/three.module.js', three));
const { FBXLoader } = await import(new URL('examples/jsm/loaders/FBXLoader.js', three));

const MAP = {
  Hips: 'hips', Spine: 'spine', Spine1: 'chest', Spine2: 'upperChest', Neck: 'neck', Head: 'head',
  LeftShoulder: 'leftShoulder', LeftArm: 'leftUpperArm', LeftForeArm: 'leftLowerArm', LeftHand: 'leftHand',
  RightShoulder: 'rightShoulder', RightArm: 'rightUpperArm', RightForeArm: 'rightLowerArm', RightHand: 'rightHand',
  LeftUpLeg: 'leftUpperLeg', LeftLeg: 'leftLowerLeg', LeftFoot: 'leftFoot', LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg', RightLeg: 'rightLowerLeg', RightFoot: 'rightFoot', RightToeBase: 'rightToes',
};
for (const side of ['Left', 'Right']) {
  const s = side.toLowerCase();
  Object.assign(MAP, { [`${side}HandThumb1`]: `${s}ThumbMetacarpal`, [`${side}HandThumb2`]: `${s}ThumbProximal`, [`${side}HandThumb3`]: `${s}ThumbDistal` });
  for (const [mx, vrm] of [['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Pinky', 'Little']]) {
    Object.assign(MAP, { [`${side}Hand${mx}1`]: `${s}${vrm}Proximal`, [`${side}Hand${mx}2`]: `${s}${vrm}Intermediate`, [`${side}Hand${mx}3`]: `${s}${vrm}Distal` });
  }
}

const args = process.argv.slice(2);
const [inDir, outDir] = args.filter(a => !a.startsWith('--'));
const flag = args.includes('--info') ? '--info' : '';
const vrmPath = args.find(a => a.startsWith('--vrm='))?.slice(6);
const { readVrmBody } = await import('./vrmBody.mjs');
const { bakeArmFix } = await import('./armFix.mjs');
const body = vrmPath ? readVrmBody(vrmPath, THREE) : null;
const FPS = 30;
const round = v => Math.round(v * 1000) / 1000;
const pack = (values, scale) => Buffer.from(Int16Array.from(values, v => Math.max(-32767, Math.min(32767, Math.round(v * scale)))).buffer).toString('base64');
const slug = name => name.toLowerCase().replace(/\(|\)/g, '').trim().replace(/\s+/g, '-');
mkdirSync(outDir, { recursive: true });
const index = [];

for (const file of readdirSync(inDir).filter(f => f.toLowerCase().endsWith('.fbx')).sort()) {
  const buf = readFileSync(join(inDir, file));
  const asset = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  asset.updateMatrixWorld(true);
  const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') ?? asset.animations[0];
  const hipsNode = asset.getObjectByName('mixamorigHips');
  // Standing hips height from the first frame: files from different Mixamo characters disagree on the rest pose.
  const hipsTrack = clip.tracks.find(t => t.name === 'mixamorigHips.position');
  const hipsHeight = hipsTrack ? hipsTrack.values[1] : hipsNode.position.y;
  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
  const bones = {};
  let hips = null;
  for (const track of clip.tracks) {
    const [nodeName, prop] = track.name.split('.');
    const vrmBone = MAP[nodeName.replace(/^mixamorig/, '')];
    const node = asset.getObjectByName(nodeName);
    if (!vrmBone || !node) continue;
    const interpolant = track.createInterpolant();
    if (prop === 'quaternion') {
      // World-space rest correction: q_vrm = parentRestWorld * q * restWorld^-1 (VRM normalized bones rest at identity).
      const restInverse = node.getWorldQuaternion(new THREE.Quaternion()).invert();
      const parentRest = node.parent.getWorldQuaternion(new THREE.Quaternion());
      const q = new THREE.Quaternion(), out = [];
      for (let i = 0; i < frames; i++) {
        const v = interpolant.evaluate(Math.min(clip.duration, i / FPS));
        q.set(v[0], v[1], v[2], v[3]).premultiply(parentRest).multiply(restInverse).normalize();
        // Keep neighbouring frames on the same hemisphere so the player's interpolation never flips.
        if (out.length && out[out.length - 4] * q.x + out[out.length - 3] * q.y + out[out.length - 2] * q.z + out[out.length - 1] * q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        out.push(q.x, q.y, q.z, q.w);
      }
      bones[vrmBone] = out;
    } else if (prop === 'position' && vrmBone === 'hips') {
      const out = [];
      let x0 = 0, z0 = 0;
      for (let i = 0; i < frames; i++) {
        const v = interpolant.evaluate(Math.min(clip.duration, i / FPS));
        if (i === 0) { x0 = v[0]; z0 = v[2]; }
        // In place: horizontal travel is measured from the first frame.
        out.push((v[0] - x0) / hipsHeight, v[1] / hipsHeight, (v[2] - z0) / hipsHeight);
      }
      hips = out;
    }
  }
  let stats = '';
  if (body && hips) {
    const quat = (name, f) => { const v = bones[name]; return v ? new THREE.Quaternion(v[f * 4], v[f * 4 + 1], v[f * 4 + 2], v[f * 4 + 3]) : new THREE.Quaternion(); };
    const hipsAt = f => new THREE.Vector3(body.hipsRest.x + hips[f * 3] * body.hipsRest.y, hips[f * 3 + 1] * body.hipsRest.y, body.hipsRest.z + hips[f * 3 + 2] * body.hipsRest.y);
    const fixed = bakeArmFix(body, frames, quat, hipsAt, THREE);
    for (const [bone, list] of Object.entries(fixed)) {
      if (!Array.isArray(list)) continue;
      const out = [];
      for (const q of list) { if (out.length && out[out.length - 4] * q.x + out[out.length - 3] * q.y + out[out.length - 2] * q.z + out[out.length - 1] * q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w); out.push(q.x, q.y, q.z, q.w); }
      bones[bone] = out;
    }
    const deg = r => Math.round(r * 57.3);
    stats = `arms L ${deg(fixed.leftStats.upper)}°/${deg(fixed.leftStats.lower)}° R ${deg(fixed.rightStats.upper)}°/${deg(fixed.rightStats.lower)}°`;
  }
  for (const [bone, out] of Object.entries(bones)) {
    const constant = out.every((v, i) => Math.abs(v - out[i % 4]) < 0.003);
    bones[bone] = pack(constant ? out.slice(0, 4) : out, 32767);
  }
  const name = basename(file, '.fbx');
  const id = slug(name);
  const travelOf = h => h ? Math.max(...h.filter((_, i) => i % 3 !== 1).map(Math.abs)) : 0;
  const travel = travelOf(hips);
  const json = JSON.stringify({ name, duration: round(clip.duration), fps: FPS, frames, bones, hips: hips && pack(hips, 8192) });
  if (flag !== '--info') writeFileSync(join(outDir, `${id}.json`), json);
  index.push({ id, name, seconds: round(clip.duration), kb: Math.round(json.length / 1024), bones: Object.keys(bones).length, travel: round(travel) });
  console.log(id.padEnd(26), `${clip.duration.toFixed(2)}s`.padStart(7), `${Math.round(json.length / 1024)}K`.padStart(6), `bones ${Object.keys(bones).length}`, `travel ${travel.toFixed(2)}`, stats);
}
if (flag !== '--info') writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 1));
