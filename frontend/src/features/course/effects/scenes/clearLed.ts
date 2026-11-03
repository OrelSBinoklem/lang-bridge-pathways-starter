/** Clear epoxy LED optics. Fixed-resolution sprites keep fine details out of the frame loop. */
const TAU = Math.PI * 2;
const TILE = 128;
const RADIUS = 26;
const COLOURS = 96;
const COLUMNS = 12;

export function createClearLedOptics(colourAt: (phase: number) => string) {
  const housing = document.createElement('canvas');
  housing.width = housing.height = TILE;
  const g = housing.getContext('2d')!;
  g.translate(TILE / 2, TILE / 2);
  g.scale(RADIUS, RADIUS);
  const ellipse = (x: number, y: number, rx: number, ry = rx) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
  };
  // Solder fillets and separate stamped metal electrodes below the encapsulation.
  for (const x of [-0.38, 0.38]) {
    const solder = g.createLinearGradient(x - 0.16, 0, x + 0.16, 0);
    solder.addColorStop(0, '#202a2a');
    solder.addColorStop(0.4, '#b3bdb7');
    solder.addColorStop(0.58, '#e0e7da');
    solder.addColorStop(1, '#384744');
    g.fillStyle = solder;
    ellipse(x, 0.97, 0.19, 0.2);
    g.fillRect(x - 0.065, 0.42, 0.13, 0.63);
  }
  // Moulded flange: a distinct thick edge, not a glowing circular outline.
  let grad = g.createLinearGradient(-0.9, -1, 0.8, 1.1);
  grad.addColorStop(0, '#8c9c9c');
  grad.addColorStop(0.2, '#283332');
  grad.addColorStop(0.6, '#080e10');
  grad.addColorStop(0.86, '#526464');
  grad.addColorStop(1, '#121c20');
  g.fillStyle = grad;
  ellipse(0, 0.05, 1, 0.98);
  grad = g.createRadialGradient(-0.28, -0.4, 0.05, 0, 0, 0.92);
  grad.addColorStop(0, '#485858');
  grad.addColorStop(0.34, '#283637');
  grad.addColorStop(0.78, '#132125');
  grad.addColorStop(0.91, '#384b4e');
  grad.addColorStop(1, '#080f13');
  g.fillStyle = grad;
  ellipse(0, -0.04, 0.91);
  // Asymmetric anvil/cathode cup and thin anode; visible through clear resin.
  grad = g.createLinearGradient(-0.5, -0.3, 0.35, 0.55);
  grad.addColorStop(0, '#b3c0ba');
  grad.addColorStop(0.28, '#506966');
  grad.addColorStop(0.52, '#d0d5c1');
  grad.addColorStop(0.63, '#43534e');
  grad.addColorStop(1, '#18282b');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(-0.51, -0.19); g.lineTo(0.25, -0.19);
  g.lineTo(0.16, 0.27); g.lineTo(-0.24, 0.4);
  g.lineTo(-0.3, 0.75); g.lineTo(-0.48, 0.68);
  g.closePath(); g.fill();
  g.fillRect(0.37, 0.02, 0.12, 0.66);
  g.fillStyle = '#0c181b';
  ellipse(-0.12, -0.11, 0.29, 0.18);
  g.strokeStyle = '#c1cabc'; g.lineWidth = 0.035;
  g.beginPath(); g.ellipse(-0.12, -0.11, 0.31, 0.2, 0, 0, TAU); g.stroke();
  g.fillStyle = '#62746b';
  g.fillRect(-0.21, -0.2, 0.17, 0.14);
  g.strokeStyle = '#d6c89a'; g.lineWidth = 0.025;
  g.beginPath(); g.moveTo(-0.1, -0.16);
  g.bezierCurveTo(0.09, -0.57, 0.47, -0.42, 0.43, 0.06); g.stroke();
  // Reflections of a broad softbox and a narrow rim light on curved resin.
  grad = g.createLinearGradient(-0.6, -0.85, -0.12, -0.16);
  grad.addColorStop(0, 'rgba(240,253,255,.85)');
  grad.addColorStop(0.45, 'rgba(213,238,245,.38)');
  grad.addColorStop(1, 'rgba(200,230,240,0)');
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(-0.34, -0.5, 0.23, 0.36, 0.65, 0, TAU); g.fill();
  g.lineCap = 'round'; g.lineWidth = 0.045;
  g.strokeStyle = 'rgba(220,246,252,.6)';
  g.beginPath(); g.arc(0, -0.04, 0.82, 3.5, 4.6); g.stroke();
  g.strokeStyle = 'rgba(160,214,229,.4)'; g.lineWidth = 0.035;
  g.beginPath(); g.arc(0, -0.04, 0.86, 0.18, 1.18); g.stroke();

  const emission = document.createElement('canvas');
  emission.width = TILE * COLUMNS;
  emission.height = TILE * Math.ceil(COLOURS / COLUMNS);
  const e = emission.getContext('2d')!;
  for (let i = 0; i < COLOURS; i += 1) {
    const color = colourAt(i / COLOURS);
    e.save();
    e.translate((i % COLUMNS + 0.5) * TILE, (Math.floor(i / COLUMNS) + 0.5) * TILE);
    e.scale(RADIUS, RADIUS);
    const disk = (x: number, y: number, radius: number, stops: [number, string][]) => {
      const light = e.createRadialGradient(x, y, 0, x, y, radius);
      for (const [offset, colour] of stops) light.addColorStop(offset, colour);
      e.fillStyle = light;
      e.beginPath(); e.arc(x, y, radius, 0, TAU); e.fill();
    };
    // Very restrained spill outside the lens. Most light stays inside the package.
    disk(0, 0, 2.35, [[0, `${color}24`], [0.42, `${color}10`], [1, `${color}00`]]);
    disk(-0.12, -0.11, 0.8, [[0, `${color}ee`], [0.36, `${color}bb`], [0.7, `${color}55`], [1, `${color}00`]]);
    // Caustic on the lower lens, separated from the square emitting die.
    e.strokeStyle = color; e.lineWidth = 0.055;
    e.globalAlpha = 0.62;
    e.beginPath(); e.ellipse(0, 0.02, 0.79, 0.83, 0, 0.3, 2.5); e.stroke();
    e.globalAlpha = 0.32;
    e.lineWidth = 0.13;
    e.beginPath(); e.ellipse(0, 0.11, 0.55, 0.56, 0, 0.4, 2.3); e.stroke();
    e.globalAlpha = 1;
    disk(-0.12, -0.12, 0.23, [[0, '#fffdefff'], [0.23, '#fff4d9dd'], [0.48, `${color}d0`], [1, `${color}00`]]);
    e.fillStyle = '#fff9e8';
    e.fillRect(-0.22, -0.21, 0.2, 0.17);
    e.restore();
  }
  const draw = (ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, x: number, y: number, r: number, index = 0) => {
    const size = r * TILE / RADIUS;
    ctx.drawImage(source, index % COLUMNS * TILE, Math.floor(index / COLUMNS) * TILE,
      TILE, TILE, x - size / 2, y - size / 2, size, size);
  };
  return {
    housing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
      draw(ctx, housing, x, y, r);
    },
    light(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, phase: number, strength: number) {
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha * Math.max(0, Math.min(1, strength));
      draw(ctx, emission, x, y, r, Math.round(((phase % 1 + 1) % 1) * COLOURS) % COLOURS);
      ctx.globalAlpha = alpha;
    },
  };
}
