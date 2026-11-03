export type LcdProgram = { name: string; start(): void; tick(dt: number, t: number): void; draw(t: number): void };

type Display = {
  cols: number;
  rows: number;
  put(x: number, y: number, shade: number): void;
  line(x0: number, y0: number, x1: number, y1: number, shade: number): void;
  rect(x: number, y: number, width: number, height: number, shade: number, fill?: boolean): void;
  text(value: string, x: number, y: number, shade: number): void;
  rand(): number;
};

/** Extra 2-bit programs. All work stays on the LCD's small pixel grid, independently of monitor resolution. */
export function createExtraLcdPrograms({ cols, rows, put, line, rect, text, rand }: Display): LcdProgram[] {
  const tau = Math.PI * 2;
  const radius = Math.max(4, (rows - 4) / 2);
  const cx = Math.min(cols / 2, radius + 2), cy = rows / 2;
  const targets = Array.from({ length: 6 }, () => ({ angle: rand() * tau, radius: radius * (.25 + rand() * .62), drift: (rand() - .5) * .08 }));
  const radar: LcdProgram = {
    name: 'radar', start() {}, tick() {},
    draw(t) {
      const sweep = t * 1.7;
      for (let y = 0; y < rows; y++) for (let x = 0; x < Math.min(cols, cx + radius + 2); x++) {
        const dx = x - cx, dy = y - cy, distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const angle = Math.atan2(dy, dx);
        const age = ((sweep - angle) % tau + tau) % tau;
        if (Math.abs(distance - radius) < .65 || Math.abs(distance - radius * .5) < .45 || Math.abs(dx) < .5 || Math.abs(dy) < .5) put(x, y, 1);
        if (age < .3) put(x, y, age < .08 ? 3 : 2);
      }
      for (const target of targets) {
        const angle = target.angle + t * target.drift;
        const age = ((sweep - angle) % tau + tau) % tau;
        if (age < 2.8) {
          const x = cx + Math.cos(angle) * target.radius, y = cy + Math.sin(angle) * target.radius;
          rect(Math.round(x), Math.round(y), 2, 2, age < .7 ? 3 : age < 1.6 ? 2 : 1);
        }
      }
      const side = Math.ceil(cx + radius + 4);
      if (cols - side >= 30) {
        text('RADAR', side, 1, 3);
        text('SCAN', side, 11, 2);
        const width = cols - side - 2;
        line(side, rows - 3, cols - 2, rows - 3, 1);
        for (let x = 0; x < width; x++) {
          const h = Math.exp(-(((x / width - ((t * .15) % 1)) * 16) ** 2)) * (rows - 23);
          line(side + x, rows - 4, side + x, rows - 4 - h, 2);
        }
      }
    },
  };

  // Terrain and craters are generated once; the lander's landing pad is always level.
  const padX = Math.round(cols * .64), padHalf = Math.max(5, Math.round(cols * .06));
  const ground = new Uint8Array(cols);
  for (let x = 0; x < cols; x++) ground[x] = Math.abs(x - padX) < padHalf + 2 ? rows - 5 : Math.round(rows - 5 - Math.abs(Math.sin(x * .14) * 2 + Math.sin(x * .39) * 1.4));
  const stars = Array.from({ length: 18 }, () => ({ x: Math.floor(rand() * cols), y: Math.floor(rand() * rows * .46) }));
  let landingTime = 0;
  const lander: LcdProgram = {
    name: 'lander', start() { landingTime = 0; }, tick(dt) { landingTime += dt; },
    draw() {
      const phase = landingTime % 10;
      const approach = Math.min(1, phase / 6);
      const eased = 1 - (1 - approach) ** 2;
      const x = cols * .18 + (padX - cols * .18) * eased;
      const y = 5 + (rows - 13) * eased;
      for (const star of stars) put(star.x, star.y, 1);
      for (let xx = 0; xx < cols; xx++) {
        put(xx, ground[xx], 3);
        for (let yy = ground[xx] + 1; yy < rows; yy++) if ((xx + yy * 3) % 5 === 0) put(xx, yy, 1);
      }
      line(padX - padHalf, rows - 5, padX + padHalf, rows - 5, 3);
      line(padX - padHalf, rows - 7, padX - padHalf, rows - 5, 3);
      line(padX + padHalf, rows - 7, padX + padHalf, rows - 5, 3);
      rect(Math.round(x - 2), Math.round(y - 2), 5, 4, 3);
      put(x, y - 1, 0);
      line(x - 2, y + 1, x - 4, y + 3, 3);
      line(x + 2, y + 1, x + 4, y + 3, 3);
      line(x - 5, y + 3, x - 3, y + 3, 3);
      line(x + 3, y + 3, x + 5, y + 3, 3);
      if (approach < 1) {
        const flame = 2 + Math.floor((Math.sin(landingTime * 40) + 1) * 1.5);
        for (let f = 0; f < flame; f++) line(x - (flame - f) * .3, y + 3 + f, x + (flame - f) * .3, y + 3 + f, f % 2 ? 2 : 3);
      } else if (phase > 6.4) {
        text(cols >= 66 ? 'LANDED' : 'OK', Math.max(1, padX - 18), 0, 3);
        // Dust settles after touchdown instead of flickering throughout the stop.
        if (phase < 7.8) for (let n = 0; n < 6; n++) put(x + (n - 2.5) * (phase - 6) * 5, rows - 6 - Math.sin(n) * (7.8 - phase), 1);
      }
    },
  };

  const nodes = [
    { x: .09, y: .52 }, { x: .31, y: .2 }, { x: .32, y: .8 },
    { x: .58, y: .5 }, { x: .81, y: .2 }, { x: .9, y: .78 },
  ].map(node => ({ x: Math.round(node.x * (cols - 8)) + 3, y: Math.round(node.y * (rows - 10)) + 6 }));
  const routes = [[0, 1, 3, 4], [2, 3, 5], [4, 3, 2, 0], [5, 3, 1]];
  const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]];
  const network: LcdProgram = {
    name: 'network', start() {}, tick() {},
    draw(t) {
      text('LINK', 1, -2, 2);
      for (const [a, b] of edges) line(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, 1);
      for (const node of nodes) {
        rect(node.x - 2, node.y - 2, 5, 5, 3, false);
        put(node.x, node.y, 1);
      }
      for (let n = 0; n < routes.length; n++) {
        const route = routes[n], progress = (t * .9 + n * .73) % (route.length - 1);
        const step = Math.floor(progress), f = progress - step;
        const a = nodes[route[step]], b = nodes[route[step + 1]];
        const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
        rect(Math.round(x - 1), Math.round(y - 1), 3, 3, 3);
        put(x - (b.x - a.x) * .12, y - (b.y - a.y) * .12, 2);
        if (f < .22) rect(a.x - 3, a.y - 3, 7, 7, 2, false);
      }
    },
  };
  return [radar, lander, network];
}
