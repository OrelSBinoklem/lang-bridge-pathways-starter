import { PINBALL_BUMPERS, PINBALL_COLORS, PINBALL_RAILS, PINBALL_TARGETS } from './pinballPhysics';

export const PINBALL_TOP = .24;
export const PINBALL_ASPECT = 2.16;
export function pinballRound(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
}

/** Cabinet machining, printed art, lamp halos and glass reflections are baked once. */
export function bakePinballArtwork() {
  const canvas = document.createElement('canvas'); canvas.width = 1100; canvas.height = Math.ceil(1100 * PINBALL_ASPECT);
  const g = canvas.getContext('2d')!; g.scale(1100, 1100);
  const circle = (x: number, y: number, r: number) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const metal = g.createLinearGradient(0, 0, 1, 0);
  for (const [p, color] of [[0, '#111827'], [.025, '#8b9caa'], [.045, '#293348'], [.09, '#182031'], [.91, '#172032'], [.95, '#63718a'], [.98, '#c5d9e2'], [1, '#111520']] as const) metal.addColorStop(p, color);
  g.fillStyle = '#00040b'; pinballRound(g, .008, .012, .99, 2.14, .07); g.fill();
  g.fillStyle = metal; pinballRound(g, 0, 0, .985, 2.13, .065); g.fill();
  g.lineWidth = .003; g.strokeStyle = '#a9b6c7'; g.stroke();
  const field = g.createLinearGradient(.1, .25, .9, 1.95); field.addColorStop(0, '#1b2644'); field.addColorStop(.45, '#10162b'); field.addColorStop(1, '#1a1331');
  g.fillStyle = field; pinballRound(g, .038, .25, .91, 1.78, .04); g.fill();
  g.save(); pinballRound(g, .038, .25, .91, 1.78, .04); g.clip();
  g.lineWidth = .001;
  for (let i = 0; i < 32; i++) {
    g.strokeStyle = i % 4 ? 'rgba(95,167,216,.10)' : 'rgba(173,115,255,.24)';
    g.beginPath(); g.moveTo(.04, .3 + i * .052); g.lineTo(.94, .3 + i * .052); g.stroke();
  }
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = 'rgba(98,189,205,.12)'; const x = .065 + i * .041;
    g.beginPath(); g.moveTo(x, .3); g.lineTo(x, .91); g.lineTo(.5 + (x - .5) * .6, 1.3); g.lineTo(.5 + (x - .5) * .6, 1.99); g.stroke();
  }
  for (let i = 0; i < 9; i++) {
    g.lineWidth = i % 3 ? .002 : .005; g.strokeStyle = i % 3 ? '#2c3351' : '#415476'; circle(.5, 1.02, .13 + i * .027); g.stroke();
  }
  g.font = '800 .062px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#3c4266'; g.save(); g.translate(.5, 1.51); g.rotate(-.13); g.fillText('CHROMA', 0, 0); g.font = '600 .032px monospace'; g.fillText('REACTOR / 03', 0, .046); g.restore();
  g.restore();
  const post = (x: number, y: number, r = .014) => {
    g.fillStyle = 'rgba(0,0,0,.6)'; circle(x + .007, y + .012, r * 1.25); g.fill();
    const grad = g.createRadialGradient(x - r * .3, y - r * .4, 0, x, y, r); grad.addColorStop(0, '#f7fbff'); grad.addColorStop(.35, '#b2c4d2'); grad.addColorStop(.6, '#344459'); grad.addColorStop(1, '#cedbe5');
    g.fillStyle = grad; circle(x, y, r); g.fill(); g.strokeStyle = '#283547'; g.lineWidth = .002; g.beginPath(); g.moveTo(x - r * .4, y); g.lineTo(x + r * .4, y); g.stroke();
  };
  for (let i = 0; i < PINBALL_RAILS.length; i++) {
    const [x, y0, xx, yy0] = PINBALL_RAILS[i], y = y0 + PINBALL_TOP, yy = yy0 + PINBALL_TOP, color = PINBALL_COLORS[i % 3];
    g.lineCap = 'round'; g.strokeStyle = '#02040b'; g.lineWidth = .043;
    g.beginPath(); g.moveTo(x + .005, y + .014); g.lineTo(xx + .005, yy + .014); g.stroke();
    g.beginPath(); g.moveTo(x, y); g.lineTo(xx, yy); g.lineWidth = .029; g.strokeStyle = '#58677f'; g.stroke();
    g.shadowColor = color; g.shadowBlur = 18; g.lineWidth = .014; g.strokeStyle = color; g.stroke(); g.shadowBlur = 0;
    g.lineWidth = .004; g.strokeStyle = '#e2f6ff'; g.stroke(); post(x, y, .011);
  }
  // Rubber faces follow exactly the same collision segments as the physics.
  for (const sign of [-1, 1]) {
    const x = (v: number) => .5 + sign * v;
    g.beginPath(); g.moveTo(x(.34), .94 + PINBALL_TOP); g.lineTo(x(.24), 1.15 + PINBALL_TOP); g.lineTo(x(.39), 1.16 + PINBALL_TOP); g.closePath();
    g.fillStyle = sign < 0 ? '#4f193e' : '#114653'; g.fill(); g.strokeStyle = sign < 0 ? '#ff68ac' : '#4edef9'; g.lineWidth = .006; g.stroke();
    post(x(.35), 1.11 + PINBALL_TOP, .012);
  }
  PINBALL_BUMPERS.forEach((bumper, i) => {
    const { x, r } = bumper, y = bumper.y + PINBALL_TOP, color = PINBALL_COLORS[i];
    g.fillStyle = '#030612'; g.beginPath(); g.ellipse(x + .006, y + .02, r * 1.24, r, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#27364b'; circle(x, y, r * 1.2); g.fill(); g.strokeStyle = '#acbac5'; g.lineWidth = .007; g.stroke();
    const grad = g.createRadialGradient(x - .023, y - .03, .003, x, y, r);
    grad.addColorStop(0, '#fff7fa'); grad.addColorStop(.18, color); grad.addColorStop(.6, '#25374e'); grad.addColorStop(.86, '#617e90'); grad.addColorStop(1, '#dceaf2');
    g.fillStyle = grad; circle(x, y, r); g.fill();
    g.shadowColor = color; g.shadowBlur = 27; g.strokeStyle = color; g.lineWidth = .008; circle(x, y, r * .74); g.stroke(); g.shadowBlur = 0;
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; post(x + Math.cos(a) * r * 1.07, y + Math.sin(a) * r * 1.07, .006); }
    g.fillStyle = '#050c1c'; circle(x, y, r * .38); g.fill(); g.fillStyle = '#ecf7ff'; g.font = '600 .028px monospace'; g.fillText(['R', 'G', 'B'][i], x, y + .01);
  });
  for (const t of PINBALL_TARGETS) { g.fillStyle = '#02040b'; pinballRound(g, t.x - .052, t.y + PINBALL_TOP - .021, .104, .052, .007); g.fill(); }
  g.fillStyle = 'rgba(125,196,237,.07)'; pinballRound(g, .875, .67, .06, 1.26, .024); g.fill(); g.strokeStyle = '#9aabc2'; g.lineWidth = .003; g.stroke();
  for (let i = 0; i < 16; i++) { g.beginPath(); g.ellipse(.905, 1.91 + i * .006, .022, .005, 0, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#030610'; pinballRound(g, .075, .035, .83, .2, .022); g.fill(); g.strokeStyle = '#384f68'; g.lineWidth = .005; g.stroke();
  for (let iy = 0; iy < 15; iy++) for (let ix = 0; ix < 70; ix++) { g.fillStyle = 'rgba(53,137,153,.12)'; circle(.095 + ix * .0113, .051 + iy * .0115, .0021); g.fill(); }
  g.fillStyle = '#9cacc6'; g.font = '600 .023px monospace'; g.fillText('CHROMA • REACTOR', .49, .075);
  g.fillStyle = '#0c1122'; pinballRound(g, .055, 2.025, .88, .075, .012); g.fill();
  g.fillStyle = '#9aaec4'; g.font = '.019px sans-serif'; g.fillText('КЛИК — ПУСК / ТОЛЧОК · УДЕРЖИВАЙ ЛОПАТКИ', .49, 2.07);
  for (const x of [.02, .965]) for (const y of [.045, .24, .84, 1.42, 2.095]) post(x, y, .008);
  const glass = g.createLinearGradient(0, .3, 1, 1.8); glass.addColorStop(0, 'rgba(219,246,255,.08)'); glass.addColorStop(.31, 'rgba(255,255,255,0)'); glass.addColorStop(.6, 'rgba(255,255,255,.018)'); glass.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glass; pinballRound(g, .044, .26, .9, 1.76, .035); g.fill();
  return canvas;
}

/** Metal and lamp sprites: no gradients or blurred shadows allocated in the live draw. */
export function bakePinballSprites() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const metal = g.createRadialGradient(49, 43, 1, 64, 64, 49);
  for (const [p, c] of [[0, '#fff'], [.15, '#e6faff'], [.34, '#8bacc2'], [.56, '#1b2c43'], [.73, '#496477'], [.85, '#d5e9f0'], [1, '#203249']] as const) metal.addColorStop(p, c);
  g.fillStyle = metal; g.beginPath(); g.arc(64, 64, 49, 0, Math.PI * 2); g.fill();
  PINBALL_COLORS.forEach((color, i) => {
    const x = 192 + i * 128, glow = g.createRadialGradient(x, 64, 0, x, 64, 63);
    glow.addColorStop(0, '#ffffff'); glow.addColorStop(.07, color); glow.addColorStop(.23, color + 'b0'); glow.addColorStop(1, color + '00');
    g.fillStyle = glow; g.fillRect(x - 64, 0, 128, 128);
  });
  return canvas;
}
