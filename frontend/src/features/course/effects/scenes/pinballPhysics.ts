export const PINBALL_COLORS = ['#ff5e9c', '#55e6ff', '#ffd05a'] as const;
export const PINBALL_BUMPERS = [{ x: .31, y: .48, r: .084 }, { x: .69, y: .48, r: .084 }, { x: .5, y: .79, r: .09 }];
export const PINBALL_TARGETS = [{ x: .27, y: .27 }, { x: .5, y: .22 }, { x: .73, y: .27 }];
export type PinballEvent = { kind: 'target' | 'multiball' | 'spinner' | 'sling'; x: number; y: number; color: number; points: number };
export const PINBALL_RAILS = [
  [.09, 1.33, .05, .3], [.05, .3, .16, .12], [.16, .12, .5, .06], [.5, .06, .84, .12], [.84, .12, .95, .3],
  [.95, .3, .95, 1.67], [.86, 1.6, .86, .46], [.09, 1.33, .235, 1.43], [.765, 1.43, .84, 1.36],
  [.16, .94, .26, 1.15], [.84, .94, .74, 1.15], [.05, 1.68, .3, 1.76], [.95, 1.68, .7, 1.76],
] as const;
export type PinballControl = { launch: boolean; left: boolean; right: boolean; nudge?: boolean };

/** Continuous velocity, substepped circle/segment contacts and moving flipper surfaces. No scripted ball path. */
export function createPinball(onHit: (color: number, x: number, y: number) => void = () => {}, onEvent: (event: PinballEvent) => void = () => {}) {
  const ball = { x: .905, y: 1.58, vx: 0, vy: 0, r: .025, active: false };
  const balls = [ball, { ...ball, active: false }];
  const targets = PINBALL_TARGETS.map(t => ({ ...t, down: false, glow: 0 }));
  const spinner = { x: .5, y: 1.06, angle: -.3, omega: 0, half: .095, glow: 0 };
  const flippers = [{ x: .235, y: 1.43, angle: .42, rest: .42, active: -.52, length: .225, omega: 0 },
    { x: .765, y: 1.43, angle: Math.PI - .42, rest: Math.PI - .42, active: Math.PI + .52, length: .225, omega: 0 }];
  const cooldowns = [0, 0, 0], slingCooldown = [0, 0];
  let score = 0, shots = 0, time = 0, combo = 1, comboUntil = 0, lastBumper = -1, multiballAwarded = false, nudgeUntil = 0;
  const award = (kind: PinballEvent['kind'], x: number, y: number, color: number, points: number) => {
    score += points; onEvent({ kind, x, y, color, points });
  };
  const collide = (ball: typeof balls[number], ax: number, ay: number, bx: number, by: number, radius: number, restitution: number, omega = 0, pivotX = ax, pivotY = ay) => {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((ball.x - ax) * dx + (ball.y - ay) * dy) / Math.max(1e-12, dx * dx + dy * dy)));
    const x = ax + dx * t, y = ay + dy * t, nx0 = ball.x - x, ny0 = ball.y - y, distance = Math.hypot(nx0, ny0), minimum = ball.r + radius;
    if (distance >= minimum) return false;
    const fallbackSpeed = Math.hypot(ball.vx, ball.vy);
    const nx = distance > 1e-8 ? nx0 / distance : fallbackSpeed > 1e-8 ? -ball.vx / fallbackSpeed : 0;
    const ny = distance > 1e-8 ? ny0 / distance : fallbackSpeed > 1e-8 ? -ball.vy / fallbackSpeed : -1;
    ball.x += nx * (minimum - distance + .0001); ball.y += ny * (minimum - distance + .0001);
    const surfaceX = -omega * (y - pivotY), surfaceY = omega * (x - pivotX);
    const normalSpeed = (ball.vx - surfaceX) * nx + (ball.vy - surfaceY) * ny;
    if (normalSpeed < 0) { ball.vx -= (1 + restitution) * normalSpeed * nx; ball.vy -= (1 + restitution) * normalSpeed * ny; }
    return normalSpeed < -.04;
  };
  return { ball, balls, flippers, cooldowns, targets, spinner,
    get score() { return score; }, get shots() { return shots; }, get time() { return time; },
    get combo() { return combo; }, get comboRemaining() { return Math.max(0, comboUntil - time); },
    get activeBalls() { return Number(balls[0].active) + Number(balls[1].active); },
    update(dt: number, control: PinballControl) {
      const elapsed = Math.max(0, Math.min(dt, .05)), count = Math.max(1, Math.ceil(elapsed * 240)), h = elapsed / count;
      if (control.nudge && time >= nudgeUntil && balls.some(b => b.active)) {
        nudgeUntil = time + .8;
        for (const ball of balls) if (ball.active) { ball.vx += ball.x < .5 ? .12 : -.12; ball.vy -= .26; }
      }
      if (control.launch && !balls.some(b => b.active)) {
        Object.assign(ball, { x: .905, y: 1.58, vx: -.05, vy: -3.05, active: true }); shots++;
        for (const target of targets) { target.down = false; target.glow = 0; }
        combo = 1; comboUntil = 0; lastBumper = -1; multiballAwarded = false;
      }
      for (let step = 0; step < count; step++) {
        time += h;
        if (time > comboUntil) { combo = 1; lastBumper = -1; }
        spinner.angle += spinner.omega * h; spinner.omega *= Math.exp(-h * 1.3); spinner.glow = Math.max(0, spinner.glow - h * 2);
        for (const target of targets) target.glow = Math.max(0, target.glow - h * 1.4);
        for (let i = 0; i < 2; i++) slingCooldown[i] = Math.max(0, slingCooldown[i] - h);
        for (let i = 0; i < flippers.length; i++) { const f = flippers[i], target = (i ? control.right : control.left) ? f.active : f.rest;
          const before = f.angle; f.angle += (target - f.angle) * (1 - Math.exp(-h * 30)); f.omega = h ? (f.angle - before) / h : 0; }
        for (let i = 0; i < cooldowns.length; i++) cooldowns[i] = Math.max(0, cooldowns[i] - h);
        for (const ball of balls) {
        if (!ball.active) continue;
        ball.vy += h * 1.75; const rolling = Math.exp(-h * .13); ball.vx *= rolling; ball.vy *= rolling;
        const speed = Math.hypot(ball.vx, ball.vy); if (speed > 4.5) { ball.vx *= 4.5 / speed; ball.vy *= 4.5 / speed; }
        ball.x += ball.vx * h; ball.y += ball.vy * h;
        for (let i = 0; i < PINBALL_RAILS.length; i++) {
          const [ax, ay, bx, by] = PINBALL_RAILS[i];
          if (collide(ball, ax, ay, bx, by, .012, .78) && (i === 9 || i === 10) && !slingCooldown[i - 9]) {
            ball.vx += i === 9 ? .3 : -.3; ball.vy -= .32; slingCooldown[i - 9] = .2;
            award('sling', (ax + bx) / 2, (ay + by) / 2, i === 9 ? 0 : 1, 25);
          }
        }
        for (const f of flippers) collide(ball, f.x, f.y, f.x + Math.cos(f.angle) * f.length, f.y + Math.sin(f.angle) * f.length, .026, .83, f.omega);
        for (let i = 0; i < PINBALL_BUMPERS.length; i++) { const b = PINBALL_BUMPERS[i];
          if (collide(ball, b.x, b.y, b.x, b.y, b.r, .95) && !cooldowns[i]) {
            const dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy) || 1;
            ball.vx += dx / d * .35; ball.vy += dy / d * .35;
            combo = lastBumper >= 0 && lastBumper !== i && time < comboUntil ? Math.min(5, combo + 1) : 1;
            lastBumper = i; comboUntil = time + 3;
            cooldowns[i] = .18; score += 100 * combo; onHit(i, b.x, b.y);
          }
        }
        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          if (!target.down && collide(ball, target.x - .043, target.y, target.x + .043, target.y, .012, .72)) {
            target.down = true; target.glow = 1; award('target', target.x, target.y, i, 250);
          }
        }
        // Freely rotating two-sided spinner: exchange contact impulse with its angular inertia.
        const ux = Math.cos(spinner.angle), uy = Math.sin(spinner.angle);
        const along = Math.max(-spinner.half, Math.min(spinner.half, (ball.x - spinner.x) * ux + (ball.y - spinner.y) * uy));
        const sx = ux * along, sy = uy * along, dx = ball.x - spinner.x - sx, dy = ball.y - spinner.y - sy;
        const distance = Math.hypot(dx, dy), limit = ball.r + .012;
        if (distance < limit) {
          const nx = distance > 1e-8 ? dx / distance : -uy, ny = distance > 1e-8 ? dy / distance : ux;
          ball.x += nx * (limit - distance + .0001); ball.y += ny * (limit - distance + .0001);
          const relative = (ball.vx + spinner.omega * sy) * nx + (ball.vy - spinner.omega * sx) * ny;
          if (relative < 0) {
            const lever = sx * ny - sy * nx, impulse = -1.65 * relative / (1 + lever * lever / .0035);
            ball.vx += impulse * nx; ball.vy += impulse * ny; spinner.omega -= lever * impulse / .0035;
            if (relative < -.12) { spinner.glow = 1; award('spinner', spinner.x, spinner.y, 2, 50); }
          }
        }
        if (ball.y > 1.84) { ball.active = false; ball.vx = ball.vy = 0; }
        }
        // Equal-mass sphere contact in multiball, not independent overlapping sprites.
        if (balls[0].active && balls[1].active) {
          const a = balls[0], b = balls[1], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), min = a.r + b.r;
          if (distance < min && distance > 1e-8) {
            const nx = dx / distance, ny = dy / distance, shift = (min - distance) / 2 + .0001;
            a.x -= nx * shift; a.y -= ny * shift; b.x += nx * shift; b.y += ny * shift;
            const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (relative < 0) { const impulse = -.9 * relative; a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny; }
          }
        }
        if (!multiballAwarded && targets.every(t => t.down)) {
          multiballAwarded = true;
          const extra = balls.find(b => !b.active);
          if (extra) Object.assign(extra, { x: .905, y: 1.58, vx: -.05, vy: -3.05, active: true });
          award('multiball', .5, .35, 2, 1000);
        }
        if (!balls.some(b => b.active)) Object.assign(ball, { x: .905, y: 1.58, vx: 0, vy: 0 });
      }
    },
  };
}
