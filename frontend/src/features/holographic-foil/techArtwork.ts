/*
 * The second label for the holographic foil (owner: «вариант с картинкой более техничной и монотонной, как на картридже
 * Соника»): a monochrome, technical print meant for silver foil, drawn once on a 2D canvas (no image file). A checkered
 * plane running to the horizon, engraved mountains, two checkered hills (palms on the left, a loop on the right), a
 * winged emblem with a faceted star and a ribbon in the middle, a banknote-like guilloche rosette and sunburst behind it,
 * and drafting marks over everything: a frame, registration marks, rulers, a dimension line, callouts, a barcode. Only
 * greys (the shader turns the tone into the metal's brightness); a fine grain at the end. The middle third holds the
 * emblem, so a portrait crop still reads.
 */
const W = 2400;
const H = 1600;
const HORIZON = 980;
const CX = 1200;
const CY = 600;
const MONO = '600 22px Consolas, "Courier New", monospace';

const tone = (v: number, a = 1) => `rgba(${Math.round(v * 0.97)},${Math.round(v * 0.985)},${Math.round(v)},${a})`;

function rand(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function sky(g: CanvasRenderingContext2D) {
    const grad = g.createLinearGradient(0, 0, 0, HORIZON);
    grad.addColorStop(0, tone(128));
    grad.addColorStop(0.55, tone(196));
    grad.addColorStop(1, tone(236));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, HORIZON);
    const glow = g.createRadialGradient(CX, CY, 40, CX, CY, 900);
    glow.addColorStop(0, tone(255, 0.9));
    glow.addColorStop(1, tone(255, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, W, HORIZON);
    // The sunburst: alternate wedges a little lighter.
    g.save();
    g.beginPath();
    g.rect(0, 0, W, HORIZON);
    g.clip();
    const n = 56;
    for (let i = 0; i < n; i += 2) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        g.beginPath();
        g.moveTo(CX, CY);
        g.lineTo(CX + Math.cos(a0) * 2600, CY + Math.sin(a0) * 2600);
        g.lineTo(CX + Math.cos(a1) * 2600, CY + Math.sin(a1) * 2600);
        g.closePath();
        g.fillStyle = tone(255, 0.13);
        g.fill();
    }
    // Fine engraved lines across the sky.
    g.fillStyle = tone(40, 0.05);
    for (let y = 0; y < HORIZON; y += 5) g.fillRect(0, y, W, 1.4);
    g.restore();
}

/** A banknote-style rosette: bands of modulated closed curves. */
function rosette(g: CanvasRenderingContext2D) {
    const band = (count: number, r0: number, step: number, a: number, m: number, b: number, k2: number, width: number, alpha: number) => {
        g.lineWidth = width;
        g.strokeStyle = tone(60, alpha);
        for (let k = 0; k < count; k += 1) {
            g.beginPath();
            for (let s = 0; s <= 720; s += 1) {
                const t = (s / 720) * Math.PI * 2;
                const r = r0 + k * step + a * Math.sin(m * t + k * 0.21) + b * Math.sin(k2 * t - k * 0.37);
                const x = CX + Math.cos(t) * r;
                const y = CY + Math.sin(t) * r;
                if (s === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.closePath();
            g.stroke();
        }
    };
    g.save();
    g.beginPath();
    g.rect(0, 0, W, HORIZON);
    g.clip();
    band(30, 560, 2.2, 56, 9, 16, 27, 1.5, 0.3);
    band(22, 300, 2.4, 26, 15, 9, 30, 1.3, 0.32);
    // Outer dotted rim.
    g.fillStyle = tone(50, 0.45);
    for (let i = 0; i < 360; i += 1) {
        const t = (i / 360) * Math.PI * 2;
        g.beginPath();
        g.arc(CX + Math.cos(t) * 700, CY + Math.sin(t) * 700, 2.4, 0, Math.PI * 2);
        g.fill();
    }
    g.restore();
}

function mountains(g: CanvasRenderingContext2D, r: () => number) {
    const layer = (base: number, lo: number, hi: number, step: number, fill: number, hatch: number, gap: number) => {
        const pts: [number, number][] = [[-40, HORIZON]];
        for (let x = -40; x <= W + 40; x += step * (0.6 + r() * 0.8)) pts.push([x, base - lo - r() * (hi - lo)]);
        pts.push([W + 40, HORIZON]);
        g.save();
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fillStyle = tone(fill);
        g.fill();
        g.clip();
        // Engraving: horizontal lines, closer together lower down.
        g.fillStyle = tone(hatch, 0.8);
        for (let y = base - hi; y < HORIZON; y += gap * (0.5 + (0.5 * (HORIZON - y)) / hi)) g.fillRect(0, y, W, 1.6);
        // The lit slopes: lighter on the left of each peak.
        g.fillStyle = tone(255, 0.18);
        for (let i = 1; i < pts.length - 1; i += 1) {
            const [x, y] = pts[i];
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x - 140, HORIZON);
            g.lineTo(x - 10, HORIZON);
            g.closePath();
            g.fill();
        }
        g.restore();
        g.lineWidth = 2.5;
        g.strokeStyle = tone(50, 0.7);
        g.beginPath();
        pts.slice(1, -1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
    };
    layer(HORIZON, 110, 250, 120, 205, 165, 7);
    layer(HORIZON, 30, 110, 90, 172, 128, 6);
}

/** Stacked strip clouds near the horizon. */
function clouds(g: CanvasRenderingContext2D, x: number, y: number, w: number) {
    const rows = [0.55, 0.8, 1, 0.7, 0.4];
    rows.forEach((f, i) => {
        const ww = w * f;
        const yy = y + i * 16;
        g.fillStyle = tone(i % 2 ? 228 : 248);
        g.beginPath();
        g.roundRect(x - ww / 2, yy, ww, 14, 7);
        g.fill();
        g.strokeStyle = tone(120, 0.5);
        g.lineWidth = 1.5;
        g.stroke();
    });
}

/** The checkered plane to the horizon, in perspective, hazing into the sky. */
function floor(g: CanvasRenderingContext2D) {
    const f = 900;
    const h = 1.0;
    const sy = (z: number) => HORIZON + (f * h) / z;
    const sx = (x: number, z: number) => CX + (x * f) / z;
    for (let zi = 0; zi < 70; zi += 1) {
        const z0 = 0.9 + zi * 0.9;
        const z1 = z0 + 0.9;
        const y0 = sy(z0);
        const y1 = sy(z1);
        if (y1 > H + 10) continue;
        const fog = 1 - Math.exp(-z0 / 16);
        for (let xi = -60; xi < 60; xi += 1) {
            const dark = (xi + zi) % 2 === 0;
            const v = (dark ? 82 : 196) * (1 - fog) + 226 * fog;
            g.fillStyle = tone(v);
            g.beginPath();
            g.moveTo(sx(xi, z0), y0);
            g.lineTo(sx(xi + 1, z0), y0);
            g.lineTo(sx(xi + 1, z1), y1);
            g.lineTo(sx(xi, z1), y1);
            g.closePath();
            g.fill();
        }
    }
    // A haze band at the horizon.
    const haze = g.createLinearGradient(0, HORIZON, 0, HORIZON + 70);
    haze.addColorStop(0, tone(232, 1));
    haze.addColorStop(1, tone(232, 0));
    g.fillStyle = haze;
    g.fillRect(0, HORIZON, W, 70);
    g.fillStyle = tone(40, 0.6);
    g.fillRect(0, HORIZON - 1, W, 2);
}

/** A hill: a checkered face (rounded by shading) under a scalloped grass cap. */
function hill(g: CanvasRenderingContext2D, path: (g: CanvasRenderingContext2D) => void, top: (x: number) => number, x0: number, x1: number) {
    g.save();
    g.beginPath();
    path(g);
    g.clip();
    const s = 76;
    for (let y = 600; y < H; y += s) {
        for (let x = x0 - s; x < x1 + s; x += s) {
            const dark = (Math.floor(x / s) + Math.floor(y / s)) % 2 === 0;
            g.fillStyle = tone(dark ? 104 : 150);
            g.fillRect(x, y, s, s);
            // A bevel on each block.
            g.fillStyle = tone(255, 0.16);
            g.fillRect(x, y, s, 5);
            g.fillStyle = tone(0, 0.14);
            g.fillRect(x, y + s - 5, s, 5);
        }
    }
    const round = g.createLinearGradient(x0, 0, x1, 0);
    round.addColorStop(0, tone(0, 0.35));
    round.addColorStop(0.35, tone(255, 0.08));
    round.addColorStop(0.75, tone(0, 0.05));
    round.addColorStop(1, tone(0, 0.45));
    g.fillStyle = round;
    g.fillRect(x0 - 100, 0, x1 - x0 + 200, H);
    // Halftone getting denser towards the bottom.
    g.fillStyle = tone(0, 0.28);
    for (let y = 900; y < H; y += 14) {
        const rr = ((y - 900) / (H - 900)) * 4.2;
        for (let x = x0 + ((y / 14) % 2) * 7; x < x1; x += 14) {
            g.beginPath();
            g.arc(x, y, rr, 0, Math.PI * 2);
            g.fill();
        }
    }
    // The grass cap: a dark band with a scalloped lower edge and a bright lip.
    g.beginPath();
    for (let x = x0 - 20; x <= x1 + 20; x += 6) {
        const y = top(x);
        if (x === x0 - 20) g.moveTo(x, y);
        else g.lineTo(x, y);
    }
    for (let x = x1 + 20; x >= x0 - 20; x -= 18) {
        g.arc(x - 9, top(x - 9) + 44, 9, 0, Math.PI, false);
    }
    g.closePath();
    g.fillStyle = tone(58);
    g.fill();
    g.strokeStyle = tone(220);
    g.lineWidth = 4;
    g.beginPath();
    for (let x = x0 - 20; x <= x1 + 20; x += 6) {
        const y = top(x) + 3;
        if (x === x0 - 20) g.moveTo(x, y);
        else g.lineTo(x, y);
    }
    g.stroke();
    // Blades.
    g.strokeStyle = tone(30);
    g.lineWidth = 2;
    for (let x = x0; x < x1; x += 11) {
        const y = top(x) + 8;
        g.beginPath();
        g.moveTo(x, y + 26);
        g.lineTo(x + 4, y + 6);
        g.stroke();
    }
    g.restore();
    g.lineWidth = 5;
    g.strokeStyle = tone(30);
    g.beginPath();
    path(g);
    g.stroke();
}

function palm(g: CanvasRenderingContext2D, x: number, y: number, h: number, lean: number) {
    const top = { x: x + lean, y: y - h };
    const segs = 16;
    for (let i = 0; i < segs; i += 1) {
        const t0 = i / segs;
        const t1 = (i + 1) / segs;
        const p = (t: number) => ({ x: x + lean * t * t, y: y - h * t });
        const a = p(t0);
        const b = p(t1);
        const w0 = 20 - 9 * t0;
        const w1 = 20 - 9 * t1;
        g.beginPath();
        g.moveTo(a.x - w0, a.y);
        g.lineTo(a.x + w0, a.y);
        g.lineTo(b.x + w1 * 1.15, b.y);
        g.lineTo(b.x - w1 * 1.15, b.y);
        g.closePath();
        g.fillStyle = tone(i % 2 ? 92 : 132);
        g.fill();
        g.strokeStyle = tone(28);
        g.lineWidth = 2;
        g.stroke();
    }
    const fronds = [-2.75, -2.25, -1.85, -1.3, -0.85, -0.4, 0.05];
    fronds.forEach((a, i) => {
        const len = h * (0.55 + 0.12 * Math.sin(i * 2.3));
        const droop = 0.55;
        const ex = top.x + Math.cos(a) * len;
        const ey = top.y + Math.sin(a) * len * 0.6 + len * droop * 0.5;
        const mx = top.x + Math.cos(a) * len * 0.55;
        const my = top.y + Math.sin(a) * len * 0.55 - len * 0.12;
        // The leaf: a fat curve, then leaflets along it.
        g.lineCap = 'round';
        g.strokeStyle = tone(40);
        g.lineWidth = 14;
        g.beginPath();
        g.moveTo(top.x, top.y);
        g.quadraticCurveTo(mx, my, ex, ey);
        g.stroke();
        g.lineWidth = 3;
        for (let k = 1; k < 16; k += 1) {
            const t = k / 16;
            const qx = (1 - t) * (1 - t) * top.x + 2 * (1 - t) * t * mx + t * t * ex;
            const qy = (1 - t) * (1 - t) * top.y + 2 * (1 - t) * t * my + t * t * ey;
            const tx = 2 * (1 - t) * (mx - top.x) + 2 * t * (ex - mx);
            const ty = 2 * (1 - t) * (my - top.y) + 2 * t * (ey - my);
            const l = Math.hypot(tx, ty) || 1;
            const nx = -ty / l;
            const ny = tx / l;
            const ll = 34 * Math.sin(Math.PI * t) + 6;
            g.strokeStyle = tone(k % 2 ? 54 : 78);
            for (const side of [-1, 1]) {
                g.beginPath();
                g.moveTo(qx, qy);
                g.lineTo(qx + nx * ll * side + (tx / l) * 14, qy + ny * ll * side + (ty / l) * 14 + 10);
                g.stroke();
            }
        }
        g.strokeStyle = tone(170);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(top.x, top.y);
        g.quadraticCurveTo(mx, my, ex, ey);
        g.stroke();
        g.lineCap = 'butt';
    });
    // Coconuts.
    for (const [dx, dy] of [[-12, 8], [10, 10], [0, 18]]) {
        g.beginPath();
        g.arc(top.x + dx, top.y + dy, 12, 0, Math.PI * 2);
        g.fillStyle = tone(70);
        g.fill();
        g.strokeStyle = tone(20);
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = tone(220, 0.6);
        g.beginPath();
        g.arc(top.x + dx - 4, top.y + dy - 4, 3.5, 0, Math.PI * 2);
        g.fill();
    }
}

/** A loop of track: a checkered band in a ring. */
function loop(g: CanvasRenderingContext2D, x: number, y: number, R: number, band: number) {
    const n = 44;
    for (let i = 0; i < n; i += 1) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        for (let j = 0; j < 2; j += 1) {
            const r0 = R - band + (j * band) / 2;
            const r1 = r0 + band / 2;
            g.beginPath();
            g.arc(x, y, r1, a0, a1);
            g.arc(x, y, r0, a1, a0, true);
            g.closePath();
            g.fillStyle = tone((i + j) % 2 ? 84 : 200);
            g.fill();
        }
    }
    g.lineWidth = 5;
    g.strokeStyle = tone(26);
    for (const r of [R, R - band]) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.stroke();
    }
    g.strokeStyle = tone(240, 0.7);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, R - 5, Math.PI * 1.05, Math.PI * 1.7);
    g.stroke();
}

/** The winged emblem: feathers, a ring with lettering, a faceted star, a ribbon. */
function emblem(g: CanvasRenderingContext2D) {
    const ringR = 232;
    // Wings.
    const feathers: [number, number][] = [[-0.62, 420], [-0.36, 470], [-0.1, 455], [0.16, 400], [0.42, 320]];
    for (const side of [-1, 1]) {
        [...feathers].reverse().forEach(([a, len]) => {
            const ang = side > 0 ? a : Math.PI - a;
            const ux = Math.cos(ang);
            const uy = Math.sin(ang);
            const nx = -uy;
            const ny = ux;
            const b = 150;
            const w = 50;
            const bx = CX + ux * b;
            const by = CY + uy * b;
            const tx = CX + ux * (b + len);
            const ty = CY + uy * (b + len);
            g.beginPath();
            g.moveTo(bx + nx * w, by + ny * w);
            g.lineTo(tx - ux * 70 + nx * w * 0.7, ty - uy * 70 + ny * w * 0.7);
            g.quadraticCurveTo(tx + nx * w * 0.2, ty + ny * w * 0.2, tx, ty);
            g.lineTo(tx - ux * 40 - nx * w * 0.55, ty - uy * 40 - ny * w * 0.55);
            g.lineTo(bx - nx * w, by - ny * w);
            g.closePath();
            const grad = g.createLinearGradient(bx, by, tx, ty);
            grad.addColorStop(0, tone(160));
            grad.addColorStop(0.5, tone(250));
            grad.addColorStop(1, tone(196));
            g.fillStyle = grad;
            g.fill();
            g.lineWidth = 5;
            g.strokeStyle = tone(30);
            g.stroke();
            // Vein and fine barbs.
            g.lineWidth = 2;
            g.strokeStyle = tone(90);
            g.beginPath();
            g.moveTo(bx, by);
            g.lineTo(tx - ux * 30, ty - uy * 30);
            g.stroke();
            g.strokeStyle = tone(120, 0.6);
            g.lineWidth = 1.3;
            for (let t = 0.1; t < 0.85; t += 0.045) {
                const px = bx + (tx - bx) * t;
                const py = by + (ty - by) * t;
                const ww = w * (1 - t * 0.35) * 0.85;
                g.beginPath();
                g.moveTo(px, py);
                g.lineTo(px + nx * ww + ux * 18, py + ny * ww + uy * 18);
                g.moveTo(px, py);
                g.lineTo(px - nx * ww * 0.8 + ux * 18, py - ny * ww * 0.8 + uy * 18);
                g.stroke();
            }
        });
    }
    // The ring.
    g.save();
    g.shadowColor = tone(0, 0.45);
    g.shadowBlur = 30;
    g.shadowOffsetY = 12;
    g.beginPath();
    g.arc(CX, CY, ringR, 0, Math.PI * 2);
    g.fillStyle = tone(48);
    g.fill();
    g.restore();
    const rim = g.createLinearGradient(CX - ringR, CY - ringR, CX + ringR, CY + ringR);
    rim.addColorStop(0, tone(250));
    rim.addColorStop(0.5, tone(150));
    rim.addColorStop(1, tone(232));
    g.lineWidth = 14;
    g.strokeStyle = rim;
    g.beginPath();
    g.arc(CX, CY, ringR - 7, 0, Math.PI * 2);
    g.stroke();
    // Lettering around the band.
    const text = 'HOLOGRAPHIC ✦ SECURITY FOIL ✦ 16-BIT ✦ ORIGINAL ✦ DIFFRACTION ✦ ';
    g.font = 'bold 26px Arial, sans-serif';
    g.fillStyle = tone(228);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tr = ringR - 36;
    let ang = -Math.PI / 2;
    const total = g.measureText(text).width;
    const scale = (Math.PI * 2 * tr) / total;
    for (const ch of text) {
        const cw = g.measureText(ch).width * scale;
        ang += cw / tr / 2;
        g.save();
        g.translate(CX + Math.cos(ang) * tr, CY + Math.sin(ang) * tr);
        g.rotate(ang + Math.PI / 2);
        g.fillText(ch, 0, 0);
        g.restore();
        ang += cw / tr / 2;
    }
    // The inner disc: fine concentric grooves.
    const inner = ringR - 62;
    const disc = g.createRadialGradient(CX - 50, CY - 60, 10, CX, CY, inner);
    disc.addColorStop(0, tone(250));
    disc.addColorStop(1, tone(140));
    g.beginPath();
    g.arc(CX, CY, inner, 0, Math.PI * 2);
    g.fillStyle = disc;
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = tone(60, 0.18);
    for (let r = 8; r < inner; r += 5) {
        g.beginPath();
        g.arc(CX, CY, r, 0, Math.PI * 2);
        g.stroke();
    }
    g.lineWidth = 5;
    g.strokeStyle = tone(26);
    g.beginPath();
    g.arc(CX, CY, inner, 0, Math.PI * 2);
    g.stroke();
    // A faceted star: each point two triangles, lit from the upper left.
    const R = 130;
    const r = 54;
    const pt = (i: number, rad: number) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return [CX + Math.cos(a) * rad, CY + Math.sin(a) * rad] as const;
    };
    for (let i = 0; i < 10; i += 1) {
        const a = pt(i, i % 2 ? r : R);
        const b = pt(i + 1, (i + 1) % 2 ? r : R);
        const mid = -Math.PI / 2 + ((i + 0.5) * Math.PI) / 5;
        const lit = Math.cos(mid - (-2.3));
        g.beginPath();
        g.moveTo(CX, CY);
        g.lineTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.closePath();
        g.fillStyle = tone(170 + 80 * lit);
        g.fill();
    }
    g.beginPath();
    for (let i = 0; i <= 10; i += 1) {
        const p = pt(i, i % 2 ? r : R);
        if (i) g.lineTo(p[0], p[1]);
        else g.moveTo(p[0], p[1]);
    }
    g.lineWidth = 5;
    g.strokeStyle = tone(24);
    g.stroke();
    g.lineWidth = 1.5;
    g.strokeStyle = tone(40, 0.6);
    for (let i = 0; i < 10; i += 1) {
        const p = pt(i, i % 2 ? r : R);
        g.beginPath();
        g.moveTo(CX, CY);
        g.lineTo(p[0], p[1]);
        g.stroke();
    }
    // The ribbon.
    const by = CY + 215;
    const bw = 980;
    const bh = 150;
    const skew = 40;
    for (const side of [-1, 1]) {
        const ex = CX + side * (bw / 2 - 20);
        g.beginPath();
        g.moveTo(ex, by + 30);
        g.lineTo(ex + side * 150, by + 30);
        g.lineTo(ex + side * 100, by + bh / 2 + 34);
        g.lineTo(ex + side * 150, by + bh + 38);
        g.lineTo(ex, by + bh + 38);
        g.closePath();
        g.fillStyle = tone(70);
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = tone(20);
        g.stroke();
    }
    g.beginPath();
    g.moveTo(CX - bw / 2 + skew, by);
    g.lineTo(CX + bw / 2 + skew, by);
    g.lineTo(CX + bw / 2 - skew, by + bh);
    g.lineTo(CX - bw / 2 - skew, by + bh);
    g.closePath();
    const rib = g.createLinearGradient(0, by, 0, by + bh);
    rib.addColorStop(0, tone(70));
    rib.addColorStop(0.5, tone(28));
    rib.addColorStop(1, tone(52));
    g.fillStyle = rib;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = tone(16);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = tone(225, 0.85);
    g.beginPath();
    g.moveTo(CX - bw / 2 + skew + 16, by + 12);
    g.lineTo(CX + bw / 2 + skew - 18, by + 12);
    g.lineTo(CX + bw / 2 - skew - 14, by + bh - 12);
    g.lineTo(CX - bw / 2 - skew + 20, by + bh - 12);
    g.closePath();
    g.stroke();
    g.save();
    g.translate(CX, by + bh / 2 + 4);
    g.transform(1, 0, -0.27, 1, 0, 0);
    g.font = '900 104px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 14;
    g.strokeStyle = tone(10);
    g.strokeText('HOLO ISLAND', 0, 0);
    const letters = g.createLinearGradient(0, -48, 0, 48);
    letters.addColorStop(0, tone(255));
    letters.addColorStop(0.48, tone(225));
    letters.addColorStop(0.52, tone(150));
    letters.addColorStop(1, tone(235));
    g.fillStyle = letters;
    g.fillText('HOLO ISLAND', 0, 0);
    g.restore();
    g.font = MONO;
    g.textAlign = 'center';
    g.fillStyle = tone(40);
    g.fillText('DIFFRACTION FOIL  ·  d = 600–1000 nm  ·  m = 1, 2, 3', CX, by + bh + 74);
}

/** Drafting marks: frame, registration marks, rulers, a dimension line, callouts, a barcode. */
function drafting(g: CanvasRenderingContext2D, r: () => number) {
    g.strokeStyle = tone(30, 0.85);
    g.lineWidth = 3;
    g.strokeRect(36, 36, W - 72, H - 72);
    g.lineWidth = 1.2;
    g.strokeRect(50, 50, W - 100, H - 100);
    const reg = (x: number, y: number) => {
        g.lineWidth = 2;
        g.strokeStyle = tone(20);
        g.beginPath();
        g.arc(x, y, 20, 0, Math.PI * 2);
        g.moveTo(x - 36, y);
        g.lineTo(x + 36, y);
        g.moveTo(x, y - 36);
        g.lineTo(x, y + 36);
        g.stroke();
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.fillStyle = tone(20);
        g.fill();
    };
    reg(110, 110);
    reg(W - 110, 110);
    reg(110, H - 110);
    reg(W - 110, H - 110);
    // Rulers.
    g.font = '600 16px Consolas, "Courier New", monospace';
    g.fillStyle = tone(30);
    g.strokeStyle = tone(30);
    g.lineWidth = 1.5;
    g.textAlign = 'center';
    for (let x = 200, i = 0; x < W - 200; x += 12, i += 1) {
        const l = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 8;
        g.beginPath();
        g.moveTo(x, H - 50);
        g.lineTo(x, H - 50 - l);
        g.stroke();
        if (i % 10 === 0) g.fillText(String(i), x, H - 82);
    }
    g.textAlign = 'left';
    for (let y = 200, i = 0; y < H - 200; y += 12, i += 1) {
        const l = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 8;
        g.beginPath();
        g.moveTo(50, y);
        g.lineTo(50 + l, y);
        g.stroke();
        if (i % 10 === 0) g.fillText(String(i), 78, y + 5);
    }
    // The emblem's dimension line.
    const dy = CY - 300;
    g.lineWidth = 2;
    g.strokeStyle = tone(30);
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(CX - 232, CY - 40);
    g.lineTo(CX - 232, dy - 20);
    g.moveTo(CX + 232, CY - 40);
    g.lineTo(CX + 232, dy - 20);
    g.moveTo(CX, dy - 60);
    g.lineTo(CX, CY + 360);
    g.moveTo(CX - 760, CY);
    g.lineTo(CX + 760, CY);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(CX - 232, dy);
    g.lineTo(CX + 232, dy);
    g.stroke();
    for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(CX + s * 232, dy);
        g.lineTo(CX + s * 206, dy - 9);
        g.lineTo(CX + s * 206, dy + 9);
        g.closePath();
        g.fillStyle = tone(30);
        g.fill();
    }
    g.font = MONO;
    g.textAlign = 'center';
    g.fillStyle = tone(255, 0.9);
    g.fillRect(CX - 70, dy - 34, 140, 30);
    g.fillStyle = tone(25);
    g.fillText('Ø 46.40', CX, dy - 12);
    // Specification blocks.
    g.font = MONO;
    g.textAlign = 'left';
    g.fillStyle = tone(25);
    ['λ = d · |sin θi + sin θo| / m', 'LOT   94-HG-0731', 'FOIL  SILVER / 3 ORDERS', 'SCALE 1 : 1'].forEach((l, i) => g.fillText(l, 170, 160 + i * 28));
    // A barcode and serial.
    let x = W - 520;
    while (x < W - 170) {
        const w = 2 + Math.floor(r() * 4) * 2;
        g.fillStyle = tone(18);
        g.fillRect(x, 160, w, 74);
        x += w + 3 + Math.floor(r() * 3) * 3;
    }
    g.textAlign = 'right';
    g.fillText('SERIAL 0042 7781 · HG-16', W - 170, 266);
}

/** A grey grain over everything (and anything coloured made grey). */
function grain(g: CanvasRenderingContext2D, r: () => number) {
    const img = g.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] + (r() - 0.5) * 12;
        d[i] = v * 0.97;
        d[i + 1] = v * 0.985;
        d[i + 2] = v;
    }
    g.putImageData(img, 0, 0);
}

export const TECH_ASPECT = W / H;

export function drawTechArtwork(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d', { willReadFrequently: true })!;
    const r = rand(1994);
    sky(g);
    rosette(g);
    mountains(g, r);
    clouds(g, 520, 900, 420);
    clouds(g, 1900, 880, 360);
    clouds(g, 300, 330, 300);
    floor(g);
    hill(
        g,
        (c) => {
            c.moveTo(-60, H + 40);
            c.lineTo(-60, 760);
            c.bezierCurveTo(150, 700, 520, 690, 650, 800);
            c.bezierCurveTo(720, 860, 770, 960, 800, H + 40);
            c.closePath();
        },
        (x) => {
            // The cap follows the same curve (sampled).
            const t = Math.min(Math.max((x + 60) / 710, 0), 1);
            const y1 = (1 - t) ** 3 * 760 + 3 * (1 - t) ** 2 * t * 700 + 3 * (1 - t) * t * t * 690 + t ** 3 * 800;
            return y1;
        },
        -60,
        800,
    );
    palm(g, 300, 718, 380, 70);
    palm(g, 540, 722, 290, -50);
    loop(g, 2090, 572, 230, 50);
    hill(
        g,
        (c) => {
            c.moveTo(2460, H + 40);
            c.lineTo(2460, 820);
            c.bezierCurveTo(2250, 790, 1850, 790, 1740, 870);
            c.bezierCurveTo(1680, 920, 1660, 1060, 1640, H + 40);
            c.closePath();
        },
        (x) => {
            const t = Math.min(Math.max((2460 - x) / 720, 0), 1);
            return (1 - t) ** 3 * 820 + 3 * (1 - t) ** 2 * t * 790 + 3 * (1 - t) * t * t * 790 + t ** 3 * 870;
        },
        1640,
        2460,
    );
    emblem(g);
    drafting(g, r);
    grain(g, r);
    return canvas;
}
