import * as T from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PointerState } from '../engine';
import type { AmberParams } from './params';

export const AMBER_WORD_LIMIT = 25;
export const finite = (n: number, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : fallback));

export function amberSettings(p: AmberParams) {
  return {
    words: Math.round(finite(p.words, 9, 1, AMBER_WORD_LIMIT)), lamp: finite(p.lamp, 1, .4, 2),
    glow: finite(p.glow, 1, 0, 2), parallax: finite(p.parallax, 1, 0, 2), inclusions: finite(p.inclusions, 1, 0, 2),
    sparkle: finite(p.sparkle, 1, 0, 2), cloud: finite(p.cloud, .35, 0, 2), depth: finite(p.depth, 1, .4, 1.8),
    sss: finite(p.sss, 1, 0, 2), quality: finite(p.quality, .85, .35, 1),
  };
}

/** One physical composition, reframed rather than rebuilt when a card expands. */
export function amberLayout(width: number, height: number) {
  const aspect = Math.max(.15, width / Math.max(1, height));
  const wide = aspect > 3, tall = aspect < .8;
  const halfHeight = wide ? 1.7 : tall ? 4.3 : 2.7;
  const halfWidth = wide ? 3.4 : tall ? 2.25 : 5.15;
  return {
    mode: wide ? 'wide' : tall ? 'tall' : 'normal',
    distance: Math.max(halfHeight, halfWidth / aspect) / Math.tan(19 * Math.PI / 180),
    main: new T.Vector3(wide ? aspect * .48 : 0, tall ? .65 : .25, 0),
    scale: new T.Vector3(wide ? 1.65 : tall ? 1.65 : 2.05, wide ? 1.08 : tall ? 1.8 : 1.42, .78),
    satellites: wide ? [[-2.9, -.15, -.4], [-.6, -.55, .3], [aspect * .48 + 2.6, -.35, -.6]]
      : tall ? [[-1.1, -2.1, .2], [1.04, -1.65, -.3], [.3, 2.8, -.9]]
      : [[-3.1, -.9, -.4], [2.9, -.65, .15], [3.7, 1.2, -.9]],
  };
}

/** A closed, non-self-intersecting nugget with a polished front and irregular natural back. */
export function amberGeometry(seed: number, detail = 8) {
  const geometry = new T.IcosahedronGeometry(1, detail), p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rind = Math.max(0, -z);
    const r = 1 + Math.sin(x * 3.7 + z * 2.9 + seed) * .073 + Math.cos(y * 5.1 - z * 3.9 + seed) * .042
      + Math.sin(x * 19 + y * 13 + seed) * .011 * rind;
    p.setXYZ(i, x * r * (1 + y * .045), y * r, z * r);
  }
  const smooth=mergeVertices(geometry);geometry.dispose();
  smooth.computeVertexNormals(); smooth.computeBoundingSphere();
  return smooth;
}

export function amberWordPosition(index: number) {
  const first = [[-.43,.38],[.28,.4],[-.06,.08],[-.5,-.12],[.43,-.05],[-.28,-.43],[.27,-.4],[.05,.66],[.02,-.65]];
  const pair = first[index] ?? [Math.cos(index * 2.4) * .64, Math.sin(index * 2.4) * .65];
  return new T.Vector3(pair[0], pair[1], .26 + Math.sin(index * 1.7) * .12);
}

/** Weathered back of the same mesh, slightly offset to avoid coplanar flicker. */
export function amberRindGeometry(source: T.BufferGeometry) {
  const flat=source.toNonIndexed(),p=flat.attributes.position,n=flat.attributes.normal,uv=flat.attributes.uv;
  const positions:number[]=[],normals:number[]=[],coords:number[]=[];
  for(let i=0;i<p.count;i+=3) {
    const z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
    if(z>-.43)continue;
    for(let j=0;j<3;j++){const k=i+j;positions.push(p.getX(k)*1.001,p.getY(k)*1.001,p.getZ(k)*1.001);normals.push(n.getX(k),n.getY(k),n.getZ(k));coords.push(uv.getX(k),uv.getY(k));}
  }
  flat.dispose();const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(coords,2));return geometry;
}

export function createAmberMotion() {
  return { yaw: -.12, pitch: .08, vx: 0, vy: 0, lastX: 0, lastY: 0, pressed: false, serial: 0, travel: 0, click: false, time: 0 };
}
export type AmberMotion = ReturnType<typeof createAmberMotion>;

/** Press/release is consumed once, including a complete quick tap between frames. */
export function stepAmberMotion(s: AmberMotion, dt: number, p: PointerState, height: number, reduced: boolean) {
  dt = finite(dt, 0, 0, .05); s.time += reduced ? 0 : dt; s.click = false;
  const down = !!p.pressed && p.active;
  const fresh = !!p.press && p.press.serial !== s.serial;
  if (fresh) { s.serial = p.press!.serial; s.lastX = p.press!.x; s.lastY = p.press!.y; s.travel = 0; s.vx = s.vy = 0; }
  if (down && (s.pressed || fresh)) {
    const dx = p.x - s.lastX, dy = p.y - s.lastY;
    s.travel += Math.hypot(dx, dy);
    const unit = 3 / Math.max(120, height);
    s.yaw += dx * unit; s.pitch -= dy * unit;
    s.vx = dx * unit / Math.max(.008, dt); s.vy = -dy * unit / Math.max(.008, dt);
  } else if (!down) {
    if(s.pressed||fresh)s.travel+=Math.hypot(p.x-s.lastX,p.y-s.lastY);
    s.click = (s.pressed || fresh) && p.active && s.travel < 8;
    if (!reduced) { s.yaw += s.vx * dt; s.pitch += s.vy * dt; }
    s.vx *= Math.exp(-dt * 7); s.vy *= Math.exp(-dt * 7);
  }
  if(Math.abs(s.yaw)>Math.PI)s.yaw = ((s.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  s.pitch = Math.max(-.65, Math.min(.65, s.pitch));
  if (!p.active) { s.vx *= .5; s.vy *= .5; }
  s.lastX = p.x; s.lastY = p.y; s.pressed = down;
}
