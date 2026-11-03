export type CascadeKind = 'domino' | 'ball' | 'lever' | 'pendulum' | 'rotor' | 'bell';
export type CascadeNode = {
  id: number; kind: CascadeKind; x: number; z: number; endX: number; endZ: number;
  lane: number; next: number[]; q: number; velocity: number; active: boolean; fired: boolean; age: number;
};

/** A constrained mechanical graph. Transfers happen at contact positions, never on a global timeline. */
export function createCascade() {
  const nodes: CascadeNode[] = [];
  const add = (kind: CascadeKind, x: number, z: number, lane: number, endX = x, endZ = z) => {
    const id = nodes.length;
    nodes.push({ id, kind, x, z, endX, endZ, lane, next: [], q: 0, velocity: 0, active: false, fired: false, age: 0 });
    return id;
  };
  const link = (a: number, b: number) => { nodes[a].next.push(b); };
  const line = (x: number, z: number, ex: number, ez: number, lane: number) => {
    const count = Math.max(2, Math.ceil(Math.hypot(ex - x, ez - z) / .56) + 1);
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(add('domino', x + (ex - x) * i / (count - 1), z + (ez - z) * i / (count - 1), lane));
      if (i) link(ids[i - 1], ids[i]);
    }
    return { first: ids[0], last: ids[count - 1] };
  };
  const a = line(-9, -6, 7.4, -6, 0);
  const ball = add('ball', 8, -6, 0, 8, -2); link(a.last, ball);
  const b = line(7.4, -2, 1.5, -2, 1); link(ball, b.first);
  const lever = add('lever', 0, -2, 1, -1.5, -2); link(b.last, lever);
  const c = line(-2, -2, -8, -2, 1); link(lever, c.first);
  const pendulum = add('pendulum', -9, -1, 1, -8, 2); link(c.last, pendulum);
  const d = line(-8, 2, -2.3, 2, 2); link(pendulum, d.first);
  const rotor = add('rotor', -1, 2, 2, .4, 2); link(d.last, rotor);
  const upper = line(.6, 1.6, 3, .7, 2), lower = line(.6, 2.4, 3, 3.3, 3);
  link(rotor, upper.first); link(rotor, lower.first);
  const upEnd = line(3.5, .8, 5, 1.7, 2), lowEnd = line(3.5, 3.2, 5, 2.3, 3);
  link(upper.last, upEnd.first); link(lower.last, lowEnd.first);
  const e = line(5.6, 2, 8, 2, 2); link(upEnd.last, e.first); link(lowEnd.last, e.first);
  const ball2 = add('ball', 9, 2, 2, 9, 6); link(e.last, ball2);
  const f = line(8.2, 6, -6.5, 6, 3); link(ball2, f.first);
  const bell = add('bell', -8, 6, 3); link(f.last, bell);
  let accumulator = 0, time = 0, started = false;
  const impacts: number[] = [];
  const clear = (n: CascadeNode) => { n.q = n.velocity = n.age = 0; n.active = n.fired = false; };
  function kick(id: number) {
    const n = nodes[id]; if (!n || n.active) return;
    n.active = true;
    n.velocity = n.kind === 'domino' ? .75 : n.kind === 'pendulum' ? 1.7 : n.kind === 'rotor' ? 2 : .15;
    impacts.push(id);
  }
  function trigger(id: number) {
    if (!nodes[id]) return;
    started = true;
    // A spent object can be used again: re-arm its descendants only, not unrelated/upstream activity.
    if (nodes[id].fired) {
      const pending = [id], seen = new Set<number>();
      while (pending.length) {
        const key = pending.pop()!; if (seen.has(key)) continue; seen.add(key);
        clear(nodes[key]); pending.push(...nodes[key].next);
      }
    }
    kick(id);
  }
  return {
    nodes, impacts, trigger,
    get time() { return time; },
    get started() { return started; },
    reset() { nodes.forEach(clear); impacts.length = 0; accumulator = time = 0; started = false; },
    update(dt: number) {
      if (!Number.isFinite(dt)) return;
      impacts.length = 0;
      accumulator += Math.max(0, Math.min(.1, dt));
      while (accumulator + 1e-10 >= 1 / 120) {
        const h = 1 / 120; accumulator -= h; time += h;
        for (const n of nodes) {
          if (!n.active) continue;
          n.age += h;
          const stop = n.kind === 'domino' ? 1.42 : n.kind === 'pendulum' ? 1.95 : n.kind === 'rotor' ? 2.8 : 1;
          if (n.q < stop) {
            const force = n.kind === 'domino' ? 10 * Math.sin(n.q + .08) : n.kind === 'pendulum' ? -4 * Math.sin(n.q - 1) : n.kind === 'rotor' ? 0 : n.kind === 'ball' ? .52 : 2.6;
            n.velocity = Math.max(.08, n.velocity + (force - n.velocity * .22) * h);
            n.q = Math.min(stop, n.q + n.velocity * h);
          }
          const contact = n.kind === 'domino' ? .52 : n.kind === 'pendulum' ? 1.8 : n.kind === 'rotor' ? 1.1 : .94;
          if (!n.fired && n.q >= contact) { n.fired = true; for (const next of n.next) kick(next); }
        }
      }
    },
  };
}
