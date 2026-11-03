/** Normalized, continuous phases shared by the miniature and the full-screen scene. */
const smooth = (x: number) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
export function pizzaPhases(time: number) {
  const t = ((time % 24) + 24) % 24;
  return {
    t,
    dough: smooth(t / .6),
    conveyor: smooth((t - 3.4) / 3.6),
    lift: smooth((t - 7) / 3) * (1 - smooth((t - 15) / 3)),
    pickup: smooth((t - 10) / 2),
    stretch: smooth((t - 10) / 2),
    flight: t < 12 ? 0 : 1 - (1 - Math.min(1, (t - 12) / 5)) ** 3,
    release: smooth((t - 17) / 1),
    returning: smooth((t - 18.5) / 5.5),
    // The customer brings the served pizza inside before the next dough appears.
    servedScale: 1 - smooth((t - 21) / 1.5),
  };
}

/** Two-link arm in the conveyor plane. Returns joint angles and a reachable tip. */
export function pizzaArmPose(x: number, y: number, l1 = 1.15, l2 = 1.1) {
  const distance = Math.hypot(x, y), radius = Math.max(Math.abs(l1 - l2) + .001, Math.min(l1 + l2 - .001, distance));
  const direction = Math.atan2(y, x);
  const elbow = -Math.acos(Math.max(-1, Math.min(1, (radius * radius - l1 * l1 - l2 * l2) / (2 * l1 * l2))));
  const shoulder = direction - Math.atan2(l2 * Math.sin(elbow), l1 + l2 * Math.cos(elbow));
  return { shoulder, elbow, tipX: Math.cos(direction) * radius, tipY: Math.sin(direction) * radius };
}
