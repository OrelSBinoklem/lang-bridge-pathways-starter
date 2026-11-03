import { HEIGHT, RINGS, type VesselParameters } from './model';
import { CLAY_ROWS, CLAY_SIDES, clayNode, createClayMesh, sampleClay } from './clayMesh';
import { TetraBody } from './tetraBody';

export type ClayContact = { height: number; angle: number; width: number; pressure: number; direction: number; lift?: number; ring?: boolean };

export function levelingSpeed(radius: number, target: number, direction: number, feed: number) {
  const sign = Math.sign(direction);
  return sign * Math.max(0, Math.min(feed * 3, feed + sign * (target - radius) * 6));
}

/** Volumetric XPBD wall with local yielding; rest volumes never change during sculpting. */
export class ClayPhysics {
  body: TetraBody;
  readonly profile = new Float32Array(RINGS + 1);
  private initial: Float32Array;
  private contact: ClayContact | null = null;
  private accumulator = 0;
  private activeTime = 0;
  private rejectedSteps = 0;
  private influence: Float32Array;
  private rowRadius = new Float32Array(CLAY_ROWS + 1);
  private surfaceRadius = new Float32Array((CLAY_ROWS + 1) * CLAY_SIDES);
  // The wheel (ring tool) works on the jug as a solid of revolution: per row the inner and outer radius and the
  // height, and per segment between two rows its volume of clay, which a stroke only moves, never loses.
  private ringInner = new Float64Array(CLAY_ROWS + 1);
  private ringOuter = new Float64Array(CLAY_ROWS + 1);
  private ringY = new Float64Array(CLAY_ROWS + 1);
  private segment = new Float64Array(CLAY_ROWS);
  private ringActive = false;
  private lastRing = false;
  softness = .65;
  constructor(shape?: VesselParameters) {
    const mesh = createClayMesh(shape);
    this.body = new TetraBody(mesh.positions, mesh.tets, mesh.edges, mesh.inverseMass);
    this.initial = this.snapshot(); this.influence = new Float32Array(mesh.inverseMass.length); this.updateProfile();
  }
  get positions() { return this.body.pos; }
  get height() {
    let height = 0;
    for (let i = 1; i < this.positions.length; i += 3) height = Math.max(height, this.positions[i]);
    return height;
  }
  generate(shape: VesselParameters) {
    const mesh = createClayMesh(shape);
    this.body = new TetraBody(mesh.positions, mesh.tets, mesh.edges, mesh.inverseMass);
    this.freeze(); this.updateProfile();
  }
  snapshot() {
    const b = this.body, state = new Float32Array(b.pos.length + b.restLengths.length + b.restVolumes.length);
    state.set(b.pos); state.set(b.restLengths, b.pos.length); state.set(b.restVolumes, b.pos.length + b.restLengths.length); return state;
  }
  restore(state: Float32Array) {
    const b = this.body, volumesAt = b.pos.length + b.restLengths.length;
    if (state.length !== volumesAt + b.restVolumes.length) throw new Error('Invalid clay snapshot');
    b.pos.set(state.subarray(0, b.pos.length)); b.restLengths.set(state.subarray(b.pos.length, volumesAt)); b.restVolumes.set(state.subarray(volumesAt));
    this.body.prev.set(this.body.pos); this.body.velocity.fill(0); this.contact = null; this.ringActive = false; this.lastRing = false; this.accumulator = 0; this.activeTime = 0; this.updateProfile();
  }
  reset() { this.restore(this.initial); }
  freeze() { this.contact = null; this.ringActive = false; this.lastRing = false; this.body.velocity.fill(0); this.activeTime = 0; this.accumulator = 0; }
  setContact(contact: ClayContact | null) {
    if (!contact && this.contact) { this.body.bake(); this.activeTime = 1.5; this.lastRing = !!this.contact.ring; }
    if (contact?.ring && !this.ringActive) this.beginRing();
    this.ringActive = !!contact?.ring;
    this.contact = contact; if (contact) this.activeTime = 1.5;
  }
  sample(height: number, angle: number, target: { x: number; y: number; z: number }) {
    const side = angle / (Math.PI * 2) * CLAY_SIDES;
    let best = 0, distance = Infinity;
    const nearest = Math.round((side % CLAY_SIDES + CLAY_SIDES) % CLAY_SIDES) % CLAY_SIDES;
    for (let row = 0; row <= CLAY_ROWS; row++) {
      const dy = Math.abs(this.positions[clayNode(row, nearest, 1) * 3 + 1] - height);
      if (dy < distance) { distance = dy; best = row; }
    }
    sampleClay(this.positions, best, side, 1, target); target.y = height;
  }
  private updateProfile() {
    for (let i = 0; i <= RINGS; i++) {
      const row = Math.round(i / RINGS * CLAY_ROWS); let radius = 0;
      for (let side = 0; side < CLAY_SIDES; side++) { const n = clayNode(row, side, 1) * 3; radius += Math.hypot(this.positions[n], this.positions[n + 2]); }
      this.profile[i] = radius / CLAY_SIDES;
    }
  }
  step(seconds: number) {
    if (!this.contact && this.activeTime <= 0) return false;
    this.accumulator += Math.min(.05, Math.max(0, seconds));
    const dt = 1 / 120, b = this.body, p = b.pos;
    let changed = false;
    while (this.accumulator + 1e-9 >= dt) {
      this.accumulator -= dt;
      if (this.contact?.ring) { this.stepRing(dt, this.contact); changed = true; this.activeTime -= dt; continue; }
      if (this.ringActive || (!this.contact && this.activeTime > 0 && this.lastRing)) { this.activeTime -= dt; continue; }
      b.predict(dt, -.35); this.influence.fill(0);
      const contact = this.contact;
      if (contact) {
        const width = Math.max(.18, contact.width), pressure = Math.max(0, Math.min(1.5, contact.pressure));
        // Read the whole circumference before moving anything; both wall layers share a target.
        for (let row = 0; row <= CLAY_ROWS; row++) {
          let total = 0;
          for (let side = 0; side < CLAY_SIDES; side++) {
            const i = clayNode(row, side, 1) * 3, radius = Math.hypot(p[i], p[i + 2]);
            this.surfaceRadius[row * CLAY_SIDES + side] = radius; total += radius;
          }
          this.rowRadius[row] = total / CLAY_SIDES;
        }
        for (let n = 0; n < b.inverseMass.length; n++) {
          if (!b.inverseMass[n]) continue;
          const pair = Math.floor(n / 2), row = Math.floor(pair / CLAY_SIDES), outer = (pair * 2 + 1) * 3;
          const i = n * 3, radius = Math.hypot(p[i], p[i + 2]), angle = Math.atan2(p[outer], p[outer + 2]);
          const arc = contact.ring ? 0 : Math.atan2(Math.sin(angle - contact.angle), Math.cos(angle - contact.angle)) * this.surfaceRadius[pair];
          const dy = p[outer + 1] - contact.height, weight = Math.exp(-2 * (dy * dy + arc * arc) / (width * width));
          this.influence[n] = weight;
          const feed = .18 + this.softness * .35;
          const motion = feed * pressure * weight * dt;
          const radial = levelingSpeed(this.surfaceRadius[pair], this.rowRadius[row], contact.direction, feed) * pressure * weight * dt;
          p[i] += p[i] / radius * radial; p[i + 2] += p[i + 2] / radius * radial;
          p[i + 1] += Math.max(-1, Math.min(1, contact.lift ?? 0)) * motion * 1.8;
        }
        // Yield around the tool while keeping the original material volume targets.
        for (let e = 0; e < b.restLengths.length; e++) {
          const influence = Math.max(this.influence[b.edges[e * 2]], this.influence[b.edges[e * 2 + 1]]);
          if (influence < .015) continue;
          const length = b.edgeLength(e), rest = b.restLengths[e];
          if (Math.abs(length - rest) > rest * .002) b.restLengths[e] += (length - rest) * Math.min(1, dt * (24 + this.softness * 50) * influence);
        }
      }
      for (let iteration = 0; iteration < 4; iteration++) { b.solveEdges(dt, .00001 + this.softness * .00003); b.solveVolumes(); this.boundaries(); }
      let valid = true;
      for (let t = 0; t < b.restVolumes.length; t++) if (!(b.volume(t) > b.restVolumes[t] * .1)) { valid = false; break; }
      if (!valid) {
        p.set(b.prev); b.velocity.fill(0); b.bake(); this.contact = null; this.activeTime = 0; this.rejectedSteps++;
        if (this.rejectedSteps === 1) console.warn('Clay deformation reached the element inversion guard; invalid substep rolled back.');
      }
      else b.finish(dt);
      changed = true; this.activeTime -= dt;
    }
    if (!this.contact && this.activeTime <= 0) this.freeze();
    if (changed) this.updateProfile(); return changed;
  }
/**
   * Start of a stroke on the wheel (owner, 2026-10-30: «воздействуй по всему радиусу кольца одинаково, а то со временем
   * кувшин превращается в 3D-месиво странной формы, которую никак не исправить»): read the jug as rings — the mean
   * radius of each wall layer and the mean height of each row — and the clay volume of each segment between rows.
   */
  private beginRing() {
    const p = this.body.pos;
    for (let row = 0; row <= CLAY_ROWS; row++) {
      let ri = 0, ro = 0, y = 0;
      for (let side = 0; side < CLAY_SIDES; side++) {
        const a = clayNode(row, side, 0) * 3, c = clayNode(row, side, 1) * 3;
        ri += Math.hypot(p[a], p[a + 2]); ro += Math.hypot(p[c], p[c + 2]); y += (p[a + 1] + p[c + 1]) / 2;
      }
      this.ringInner[row] = ri / CLAY_SIDES; this.ringOuter[row] = ro / CLAY_SIDES; this.ringY[row] = y / CLAY_SIDES;
    }
    for (let k = 0; k < CLAY_ROWS; k++) this.segment[k] = this.segmentArea(k) * Math.max(.02, this.ringY[k + 1] - this.ringY[k]);
  }
  /** The segment's cross-section per unit height: a hollow frustum between its two rows (exact for straight walls). */
  private segmentArea(k: number) {
    const o = this.ringOuter, i = this.ringInner;
    return Math.PI / 3 * ((o[k] * o[k] + o[k] * o[k + 1] + o[k + 1] * o[k + 1]) - (i[k] * i[k] + i[k] * i[k + 1] + i[k + 1] * i[k + 1]));
  }
  /**
   * One step of the hands on the wheel. Every node of a row gets exactly the same change (it is the row's), so the
   * jug stays round however long it is worked. Pressing in narrows the rows under the hands (both wall layers alike,
   * the wall keeps its thickness) and the clay goes up — each segment keeps its volume, so a narrower ring grows taller;
   * pressing out does the reverse. Lifting carries clay from the segments under the hands to the ones above (or below).
   * The base rows stay fixed; the wall stays at least .09 thick, rows at least .05 apart: nothing can fold over.
   */
  private stepRing(dt: number, contact: ClayContact) {
    const width = Math.max(.18, contact.width), pressure = Math.max(0, Math.min(1.5, contact.pressure));
    const feed = .18 + this.softness * .35, sign = Math.sign(contact.direction), lift = Math.max(-1, Math.min(1, contact.lift ?? 0));
    const ri = this.ringInner, ro = this.ringOuter, y = this.ringY, weight = (h: number) => Math.exp(-2 * (h - contact.height) ** 2 / (width * width));
    for (let row = 2; row <= CLAY_ROWS; row++) {
      const w = weight(y[row]);
      if (w < 1e-4) continue;
      const d = sign * feed * pressure * w * dt;
      ro[row] = Math.max(.24, Math.min(1.52, ro[row] + d));
      ri[row] = Math.max(.15, Math.min(ro[row] - .09, ri[row] + d));
      // The hands smooth what they touch: a little of the neighbours' mean.
      if (row < CLAY_ROWS) {
        const s = Math.min(.5, w * pressure * dt * 3);
        ro[row] += ((ro[row - 1] + ro[row + 1]) / 2 - ro[row]) * s;
        ri[row] += ((ri[row - 1] + ri[row + 1]) / 2 - ri[row]) * s;
        ri[row] = Math.min(ri[row], ro[row] - .09);
      }
    }
    if (lift) for (let k = 1; k < CLAY_ROWS; k++) {
      const w = weight((y[k] + y[k + 1]) / 2), to = lift > 0 ? k + 1 : k - 1;
      if (w < 1e-4 || to < 1 || to >= CLAY_ROWS) continue;
      // (A segment always keeps enough clay for its minimum height, so no clay is created by the height floor.)
      const spare = Math.max(0, this.segment[k] - this.segmentArea(k) * .06);
      const moved = Math.min(spare, this.segment[k] * Math.min(.3, Math.abs(lift) * feed * pressure * w * dt * 1.2));
      this.segment[k] -= moved; this.segment[to] += moved;
    }
    // Heights from the volumes, up from the fixed base.
    const rise = () => { for (let k = 1; k < CLAY_ROWS; k++) y[k + 1] = y[k] + Math.max(.05, this.segment[k] / Math.max(1e-4, this.segmentArea(k))); };
    rise();
    // No taller than the old limit: past it the clay thickens the wall instead (the inner radius comes in), so it is kept.
    const cap = HEIGHT * 1.22;
    if (y[CLAY_ROWS] > cap) {
      const f = (cap - y[1]) / (y[CLAY_ROWS] - y[1]);
      for (let row = 2; row <= CLAY_ROWS; row++) ri[row] = Math.sqrt(Math.max(.15 * .15, ro[row] * ro[row] - (ro[row] * ro[row] - ri[row] * ri[row]) / f));
      rise();
      if (y[CLAY_ROWS] > cap) { const g = (cap - y[1]) / (y[CLAY_ROWS] - y[1]); for (let row = 2; row <= CLAY_ROWS; row++) y[row] = y[1] + (y[row] - y[1]) * g; }
    }
    const p = this.body.pos;
    for (let row = 2; row <= CLAY_ROWS; row++) for (let side = 0; side < CLAY_SIDES; side++) {
      const a = side / CLAY_SIDES * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      for (const [layer, radius] of [[0, ri[row]], [1, ro[row]]] as const) {
        const i = clayNode(row, side, layer) * 3;
        p[i] = radius * s; p[i + 1] = y[row]; p[i + 2] = radius * c;
      }
    }
    this.body.prev.set(p); this.body.velocity.fill(0);
    for (let n = 0; n < this.influence.length; n++) this.influence[n] = weight(p[n * 3 + 1]);
  }
  private boundaries() {
    const b = this.body, p = b.pos;
    for (let n = 0; n < b.inverseMass.length; n++) {
      if (!b.inverseMass[n]) continue;
      const i = n * 3, radius = Math.hypot(p[i], p[i + 2]), bounded = Math.max(.22, Math.min(1.52, radius));
      if (radius > 1e-8) { p[i] *= bounded / radius; p[i + 2] *= bounded / radius; }
      p[i + 1] = Math.max(.12, Math.min(HEIGHT * 1.22, p[i + 1]));
    }
  }
  diagnostics() {
    let rest = 0, volume = 0, minRatio = Infinity;
    for (let t = 0; t < this.body.restVolumes.length; t++) { const v = this.body.volume(t), r = this.body.restVolumes[t]; rest += r; volume += v; minRatio = Math.min(minRatio, v / r); }
    return { volumeError: Math.abs(volume - rest) / rest, minRatio, rejectedSteps: this.rejectedSteps, nodes: this.body.inverseMass.length, tets: this.body.restVolumes.length };
  }
  dispose() { this.freeze(); }
}
