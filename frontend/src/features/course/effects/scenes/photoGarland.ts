import type { CanvasSceneDef } from './types';
import { TAU, clamp, mixHex, rgba } from './kit';

/**
 * "Me, my family and friends": polaroids pinned with wooden clothespins to a twine garland wound with warm fairy
 * lights, on a dusky wall. Every photo is a little illustration — mum at the sea, dad and me in the park, granny at
 * home, friends by a campfire, the cat, the dog in the snow, us in Riga, little sister's birthday — with a caption
 * handwritten in Latvian, warm film colours, a vignette, grain and a light leak. The photos hang as pendulums: the
 * breeze sways them, the cursor brushes them aside, and a click shakes a photo (as people shake a polaroid) — it goes
 * dark and slowly develops into another picture. The bulbs twinkle and warm the photos near them.
 */

const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive';
const INK = '#2b1d16';

type Look = { skin: string; hair: string; style: 'short' | 'long' | 'bun' | 'curly' | 'bob'; shirt: string; glasses?: boolean; happy?: boolean };

function person(g: CanvasRenderingContext2D, x: number, y: number, r: number, o: Look) {
  g.fillStyle = o.hair;
  if (o.style === 'long') {
    g.beginPath();
    g.ellipse(x, y + r * 0.7, r * 1.2, r * 1.5, 0, 0, TAU);
    g.fill();
  } else if (o.style === 'bob') {
    g.beginPath();
    g.ellipse(x, y + r * 0.15, r * 1.2, r * 1.1, 0, 0, TAU);
    g.fill();
  } else if (o.style === 'bun') {
    g.beginPath();
    g.arc(x, y - r * 1.02, r * 0.42, 0, TAU);
    g.fill();
  }
  // Hair that falls behind the shoulders goes first, then the shoulders and the neck in front of it.
  g.fillStyle = o.shirt;
  g.beginPath();
  g.ellipse(x, y + r * 2.45, r * 1.6, r * 1.3, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath();
  g.ellipse(x - r * 0.5, y + r * 1.8, r * 0.6, r * 0.35, -0.4, 0, TAU);
  g.fill();
  g.fillStyle = mixHex(o.skin, '#000000', 0.15);
  g.fillRect(x - r * 0.3, y + r * 0.6, r * 0.6, r * 0.75);
  const sk = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.05);
  sk.addColorStop(0, mixHex(o.skin, '#ffffff', 0.18));
  sk.addColorStop(1, mixHex(o.skin, '#000000', 0.12));
  g.fillStyle = sk;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = o.hair;
  if (o.style === 'curly') {
    for (let i = 0; i < 10; i += 1) {
      const a = Math.PI * (1.0 + i * 0.11);
      g.beginPath();
      g.arc(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.88, r * 0.34, 0, TAU);
      g.fill();
    }
  } else {
    const e = o.style === 'short' ? -0.05 * r : 0.25 * r;
    g.beginPath();
    g.moveTo(x - 1.03 * r, y + e);
    g.bezierCurveTo(x - 1.05 * r, y - 1.32 * r, x + 1.05 * r, y - 1.32 * r, x + 1.03 * r, y + e);
    g.bezierCurveTo(x + 0.8 * r, y - 0.35 * r, x + 0.1 * r, y - 0.58 * r, x - 0.25 * r, y - 0.5 * r);
    g.quadraticCurveTo(x - 0.8 * r, y - 0.35 * r, x - 1.03 * r, y + e);
    g.fill();
  }
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineCap = 'round';
  g.lineWidth = r * 0.09;
  for (const sx of [-1, 1]) {
    g.beginPath();
    if (o.happy) {
      g.arc(x + sx * 0.36 * r, y + 0.04 * r, 0.13 * r, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    } else {
      g.ellipse(x + sx * 0.36 * r, y, 0.09 * r, 0.12 * r, 0, 0, TAU);
      g.fill();
    }
  }
  g.fillStyle = 'rgba(255,110,110,0.28)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(x + sx * 0.56 * r, y + 0.3 * r, 0.17 * r, 0, TAU);
    g.fill();
  }
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(x, y + 0.2 * r, 0.32 * r, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  if (o.glasses) {
    g.strokeStyle = '#6a5040';
    g.lineWidth = r * 0.06;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.arc(x + sx * 0.36 * r, y + 0.02 * r, 0.23 * r, 0, TAU);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(x - 0.13 * r, y);
    g.lineTo(x + 0.13 * r, y);
    g.stroke();
  }
}

function cat(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const fur = '#e8913a';
  g.fillStyle = fur;
  g.beginPath();
  g.ellipse(x, y + r * 1.5, r * 1.15, r * 1.05, 0, 0, TAU);
  g.fill();
  for (const sx of [-1, 1]) {
    g.fillStyle = fur;
    g.beginPath();
    g.moveTo(x + sx * 0.9 * r, y - 0.2 * r);
    g.lineTo(x + sx * 0.78 * r, y - 1.25 * r);
    g.lineTo(x + sx * 0.18 * r, y - 0.78 * r);
    g.fill();
    g.fillStyle = '#f7b8b0';
    g.beginPath();
    g.moveTo(x + sx * 0.74 * r, y - 0.4 * r);
    g.lineTo(x + sx * 0.7 * r, y - 1.0 * r);
    g.lineTo(x + sx * 0.35 * r, y - 0.72 * r);
    g.fill();
  }
  const head = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.05);
  head.addColorStop(0, '#f6b566');
  head.addColorStop(1, '#d9772a');
  g.fillStyle = head;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.86, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#b8601f';
  g.lineWidth = r * 0.08;
  g.lineCap = 'round';
  for (const dx of [-0.22, 0, 0.22]) {
    g.beginPath();
    g.moveTo(x + dx * r, y - 0.8 * r);
    g.lineTo(x + dx * 1.2 * r, y - 0.48 * r);
    g.stroke();
  }
  g.fillStyle = '#fff4e6';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + sx * 0.2 * r, y + 0.36 * r, 0.28 * r, 0.2 * r, 0, 0, TAU);
    g.fill();
  }
  for (const sx of [-1, 1]) {
    g.fillStyle = '#7fc24a';
    g.beginPath();
    g.ellipse(x + sx * 0.4 * r, y - 0.05 * r, 0.17 * r, 0.2 * r, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#10140c';
    g.beginPath();
    g.ellipse(x + sx * 0.4 * r, y - 0.05 * r, 0.05 * r, 0.17 * r, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(x + sx * 0.4 * r - 0.05 * r, y - 0.12 * r, 0.04 * r, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#e46a7a';
  g.beginPath();
  g.moveTo(x - 0.1 * r, y + 0.16 * r);
  g.lineTo(x + 0.1 * r, y + 0.16 * r);
  g.lineTo(x, y + 0.28 * r);
  g.fill();
  g.strokeStyle = 'rgba(60,40,30,0.55)';
  g.lineWidth = r * 0.025;
  for (const sx of [-1, 1]) {
    for (const k of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(x + sx * 0.35 * r, y + 0.36 * r + k * 0.05 * r);
      g.lineTo(x + sx * 1.1 * r, y + 0.3 * r + k * 0.14 * r);
      g.stroke();
    }
  }
}

function dog(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const fur = '#a8743f';
  g.fillStyle = fur;
  g.beginPath();
  g.ellipse(x, y + r * 1.6, r * 1.25, r * 1.05, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#f2e2c8';
  g.beginPath();
  g.ellipse(x, y + r * 1.45, r * 0.5, r * 0.6, 0, 0, TAU);
  g.fill();
  const head = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  head.addColorStop(0, '#c89058');
  head.addColorStop(1, '#8e5c2c');
  g.fillStyle = head;
  g.beginPath();
  g.ellipse(x, y, r * 0.95, r * 0.9, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#f2e2c8';
  g.beginPath();
  g.ellipse(x, y + r * 0.42, r * 0.52, r * 0.4, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#ef7a8a';
  g.beginPath();
  g.ellipse(x, y + r * 0.78, r * 0.15, r * 0.22, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#1a120c';
  g.beginPath();
  g.ellipse(x, y + r * 0.24, r * 0.18, r * 0.12, 0, 0, TAU);
  g.fill();
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(x + sx * 0.36 * r, y - 0.15 * r, 0.1 * r, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#ffffff';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(x + sx * 0.36 * r - 0.03 * r, y - 0.19 * r, 0.035 * r, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#5e3818';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + sx * 0.92 * r, y + 0.15 * r, 0.3 * r, 0.72 * r, sx * 0.25, 0, TAU);
    g.fill();
  }
}

function bokeh(g: CanvasRenderingContext2D, s: number, rand: () => number, cols: string[], n: number, alpha: number) {
  for (let i = 0; i < n; i += 1) {
    const x = rand() * s;
    const y = rand() * s * 0.7;
    const r = s * (0.04 + rand() * 0.08);
    g.fillStyle = rgba(cols[i % cols.length], alpha * (0.5 + rand() * 0.5));
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
}

function vgrad(g: CanvasRenderingContext2D, s: number, y0: number, y1: number, stops: string[]) {
  const gr = g.createLinearGradient(0, y0 * s, 0, y1 * s);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  g.fillStyle = gr;
  g.fillRect(0, y0 * s, s, (y1 - y0) * s);
}

type Picture = { caption: string; paint: (g: CanvasRenderingContext2D, s: number, rand: () => number) => void };

const PICTURES: Picture[] = [
  {
    caption: 'mamma',
    paint(g, s) {
      vgrad(g, s, 0, 0.56, ['#86cbf5', '#e6f5ff']);
      const sun = g.createRadialGradient(0.8 * s, 0.18 * s, 0, 0.8 * s, 0.18 * s, 0.25 * s);
      sun.addColorStop(0, 'rgba(255,248,210,1)');
      sun.addColorStop(0.3, 'rgba(255,240,190,0.7)');
      sun.addColorStop(1, 'rgba(255,240,190,0)');
      g.fillStyle = sun;
      g.fillRect(0, 0, s, s);
      vgrad(g, s, 0.52, 0.74, ['#2f86bd', '#6cc0de']);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 8; i += 1) g.fillRect(((i * 37) % 100) / 100 * s, (0.56 + (i % 4) * 0.04) * s, 0.12 * s, 0.006 * s);
      vgrad(g, s, 0.74, 1, ['#f3dcaa', '#e2c48e']);
      person(g, 0.5 * s, 0.47 * s, 0.2 * s, { skin: '#f1c7a5', hair: '#6b3b22', style: 'long', shirt: '#f06a80', happy: true });
    },
  },
  {
    caption: 'tētis un es',
    paint(g, s, rand) {
      vgrad(g, s, 0, 1, ['#a8d98c', '#5e9e5a']);
      bokeh(g, s, rand, ['#f4ffb0', '#d8ff9a', '#ffffff'], 14, 0.35);
      g.fillStyle = '#6b4a2e';
      g.fillRect(0.02 * s, 0, 0.08 * s, s);
      g.fillRect(0.88 * s, 0, 0.1 * s, s);
      person(g, 0.36 * s, 0.42 * s, 0.19 * s, { skin: '#e8b894', hair: '#3a2a1e', style: 'short', shirt: '#3a7bd5' });
      person(g, 0.7 * s, 0.62 * s, 0.15 * s, { skin: '#f3cfae', hair: '#c98a3a', style: 'bob', shirt: '#ffcc33', happy: true });
    },
  },
  {
    caption: 'vecmāmiņa',
    paint(g, s) {
      vgrad(g, s, 0, 1, ['#f3dfc0', '#e2c69e']);
      g.fillStyle = 'rgba(180,130,80,0.12)';
      for (let x = 0; x < s; x += s * 0.08) g.fillRect(x, 0, s * 0.03, s);
      g.fillStyle = '#ffffff';
      g.fillRect(0.62 * s, 0.06 * s, 0.34 * s, 0.44 * s);
      vgrad(g, s, 0.08, 0.48, ['#9fd0f2', '#d8eefc']);
      g.fillStyle = '#ffffff';
      g.fillRect(0.62 * s, 0.06 * s, 0.03 * s, 0.44 * s);
      g.fillRect(0.93 * s, 0.06 * s, 0.03 * s, 0.44 * s);
      g.fillRect(0.62 * s, 0.26 * s, 0.34 * s, 0.025 * s);
      g.fillRect(0.775 * s, 0.06 * s, 0.025 * s, 0.44 * s);
      const lamp = g.createRadialGradient(0.12 * s, 0.2 * s, 0, 0.12 * s, 0.2 * s, 0.4 * s);
      lamp.addColorStop(0, 'rgba(255,220,150,0.8)');
      lamp.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = lamp;
      g.fillRect(0, 0, s, s);
      person(g, 0.46 * s, 0.47 * s, 0.2 * s, { skin: '#efc3a0', hair: '#d8d8dc', style: 'bun', shirt: '#8a5a9a', glasses: true, happy: true });
    },
  },
  {
    caption: 'draugi',
    paint(g, s, rand) {
      vgrad(g, s, 0, 0.8, ['#2a2150', '#6a3a6a', '#e0784a']);
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 18; i += 1) g.fillRect(rand() * s, rand() * s * 0.35, 0.008 * s, 0.008 * s);
      vgrad(g, s, 0.78, 1, ['#2a1c14', '#150e0a']);
      person(g, 0.24 * s, 0.56 * s, 0.14 * s, { skin: '#8d5a3b', hair: '#1b1b1b', style: 'curly', shirt: '#35b58a', happy: true });
      person(g, 0.76 * s, 0.57 * s, 0.14 * s, { skin: '#d9a47a', hair: '#4a2a1a', style: 'short', shirt: '#4a6ad5' });
      person(g, 0.5 * s, 0.48 * s, 0.15 * s, { skin: '#f3cfb0', hair: '#e0b050', style: 'long', shirt: '#e05050', happy: true });
      g.globalCompositeOperation = 'lighter';
      const fire = g.createRadialGradient(0.5 * s, 1.05 * s, 0, 0.5 * s, 1.05 * s, 0.7 * s);
      fire.addColorStop(0, 'rgba(255,170,60,0.75)');
      fire.addColorStop(0.5, 'rgba(255,110,40,0.25)');
      fire.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = fire;
      g.fillRect(0, 0, s, s);
      g.fillStyle = 'rgba(255,200,90,0.9)';
      for (let i = 0; i < 12; i += 1) g.fillRect(0.3 * s + rand() * 0.4 * s, 0.55 * s + rand() * 0.4 * s, 0.01 * s, 0.01 * s);
      g.globalCompositeOperation = 'source-over';
    },
  },
  {
    caption: 'kaķis Muris',
    paint(g, s) {
      vgrad(g, s, 0, 1, ['#efe6d6', '#dcd0bc']);
      g.fillStyle = '#2f7f86';
      g.beginPath();
      g.roundRect(0.02 * s, 0.4 * s, 0.96 * s, 0.4 * s, 0.08 * s);
      g.fill();
      g.fillStyle = '#28707a';
      g.fillRect(0, 0.72 * s, s, 0.3 * s);
      g.fillStyle = '#f0c24a';
      g.beginPath();
      g.roundRect(0.72 * s, 0.46 * s, 0.24 * s, 0.24 * s, 0.05 * s);
      g.fill();
      cat(g, 0.45 * s, 0.46 * s, 0.22 * s);
    },
  },
  {
    caption: 'suns Reksis',
    paint(g, s, rand) {
      vgrad(g, s, 0, 0.7, ['#a9cdf0', '#eaf4ff']);
      g.fillStyle = '#2f5a3a';
      for (const [x, h] of [[0.08, 0.5], [0.2, 0.36], [0.86, 0.46]]) {
        g.beginPath();
        g.moveTo(x * s, (0.72 - h) * s);
        g.lineTo((x + 0.12) * s, 0.74 * s);
        g.lineTo((x - 0.12) * s, 0.74 * s);
        g.fill();
      }
      vgrad(g, s, 0.7, 1, ['#ffffff', '#e2ecf6']);
      dog(g, 0.5 * s, 0.44 * s, 0.22 * s);
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 26; i += 1) {
        g.beginPath();
        g.arc(rand() * s, rand() * s, (0.006 + rand() * 0.01) * s, 0, TAU);
        g.fill();
      }
    },
  },
  {
    caption: 'mēs Rīgā',
    paint(g, s) {
      vgrad(g, s, 0, 0.8, ['#6a5aa0', '#ff7a8a', '#ffc070']);
      const sil = '#3a2a4a';
      g.fillStyle = sil;
      // St Peter's spire and the Dome's tower over the rooftops of the Old Town.
      g.fillRect(0.22 * s, 0.42 * s, 0.1 * s, 0.4 * s);
      g.fillRect(0.245 * s, 0.3 * s, 0.05 * s, 0.14 * s);
      g.beginPath();
      g.moveTo(0.255 * s, 0.3 * s);
      g.lineTo(0.27 * s, 0.06 * s);
      g.lineTo(0.285 * s, 0.3 * s);
      g.fill();
      g.fillRect(0.7 * s, 0.4 * s, 0.1 * s, 0.4 * s);
      g.beginPath();
      g.ellipse(0.75 * s, 0.38 * s, 0.05 * s, 0.06 * s, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(0.74 * s, 0.34 * s);
      g.lineTo(0.75 * s, 0.2 * s);
      g.lineTo(0.76 * s, 0.34 * s);
      g.fill();
      for (let x = 0; x < s; x += 0.09 * s) {
        const h = 0.58 + ((x * 7.3) % 0.1);
        g.beginPath();
        g.moveTo(x, 0.82 * s);
        g.lineTo(x, h * s);
        g.lineTo(x + 0.045 * s, (h - 0.06) * s);
        g.lineTo(x + 0.09 * s, h * s);
        g.lineTo(x + 0.09 * s, 0.82 * s);
        g.fill();
      }
      vgrad(g, s, 0.8, 1, ['#5a4a7a', '#2a2040']);
      person(g, 0.36 * s, 0.6 * s, 0.14 * s, { skin: '#f1c7a5', hair: '#8a4a2a', style: 'long', shirt: '#2f9e8e', happy: true });
      person(g, 0.63 * s, 0.57 * s, 0.15 * s, { skin: '#e2b08a', hair: '#2a1a12', style: 'short', shirt: '#e8a23a' });
    },
  },
  {
    caption: 'mazā māsa',
    paint(g, s) {
      vgrad(g, s, 0, 1, ['#ffd6e4', '#f7b8cf']);
      const flags = ['#ff5a7a', '#ffd24a', '#4ac0e0', '#7ad06a', '#b07aff'];
      g.strokeStyle = '#8a5a6a';
      g.lineWidth = 0.008 * s;
      g.beginPath();
      g.moveTo(0, 0.08 * s);
      g.quadraticCurveTo(0.5 * s, 0.22 * s, s, 0.08 * s);
      g.stroke();
      for (let i = 0; i < 7; i += 1) {
        const u = (i + 0.5) / 7;
        const x = u * s;
        const y = (0.08 + 0.28 * u * (1 - u)) * s;
        g.fillStyle = flags[i % flags.length];
        g.beginPath();
        g.moveTo(x - 0.05 * s, y);
        g.lineTo(x + 0.05 * s, y);
        g.lineTo(x, y + 0.1 * s);
        g.fill();
      }
      person(g, 0.5 * s, 0.44 * s, 0.19 * s, { skin: '#f6d2b6', hair: '#2a1a12', style: 'bob', shirt: '#ff8ac0', happy: true });
      g.fillStyle = '#fff7f0';
      g.beginPath();
      g.roundRect(0.28 * s, 0.8 * s, 0.44 * s, 0.24 * s, 0.03 * s);
      g.fill();
      g.fillStyle = '#ff7aa8';
      g.fillRect(0.28 * s, 0.8 * s, 0.44 * s, 0.05 * s);
      for (let i = 0; i < 4; i += 1) {
        const x = (0.35 + i * 0.1) * s;
        g.fillStyle = ['#5ab0ff', '#ffd24a', '#7ad06a', '#ff5a7a'][i];
        g.fillRect(x - 0.012 * s, 0.7 * s, 0.024 * s, 0.1 * s);
        const fl = g.createRadialGradient(x, 0.67 * s, 0, x, 0.67 * s, 0.05 * s);
        fl.addColorStop(0, 'rgba(255,250,200,1)');
        fl.addColorStop(0.4, 'rgba(255,190,70,0.8)');
        fl.addColorStop(1, 'rgba(255,160,40,0)');
        g.fillStyle = fl;
        g.fillRect(x - 0.05 * s, 0.62 * s, 0.1 * s, 0.1 * s);
      }
    },
  },
];

// A separate album for the left side of the large composition. Card/right keep the original pictures.
const LEFT_PICTURES: Picture[] = [
  {
    caption: 'vectēvs pie ezera',
    paint(g, s, rand) {
      vgrad(g, s, 0, 1, ['#e9c39d', '#87b3ba', '#386b75']);
      bokeh(g, s, rand, ['#ffebad', '#b3e1ce'], 12, 0.16);
      person(g, s * 0.36, s * 0.45, s * 0.18, { skin: '#dcb18f', hair: '#b4b7ae', style: 'short', shirt: '#a06a40', glasses: true, happy: true });
      g.strokeStyle = '#423e2b'; g.lineWidth = s * 0.018;
      g.beginPath(); g.moveTo(s * 0.48, s * 0.86); g.lineTo(s * 0.79, s * 0.2); g.stroke();
      g.strokeStyle = '#e1d8b7'; g.lineWidth = s * 0.004;
      g.beginPath(); g.moveTo(s * 0.79, s * 0.2); g.quadraticCurveTo(s * 0.94, s * 0.4, s * 0.88, s * 0.77); g.stroke();
      g.strokeStyle = '#eac58c';
      for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(s * 0.86, s * 0.8, s * (0.04 + i * 0.018), s * (0.008 + i * 0.004), 0, 0, TAU); g.stroke(); }
    },
  },
  {
    caption: 'ģimenes pikniks',
    paint(g, s, rand) {
      vgrad(g, s, 0, 1, ['#9ec5a1', '#dddc83', '#64824a']);
      bokeh(g, s, rand, ['#ffffc0', '#d9ffae'], 18, 0.4);
      person(g, s * 0.28, s * 0.39, s * 0.14, { skin: '#e9b492', hair: '#583728', style: 'long', shirt: '#da6b67', happy: true });
      person(g, s * 0.69, s * 0.4, s * 0.16, { skin: '#bc8a6c', hair: '#342a25', style: 'curly', shirt: '#52887c', happy: true });
      g.fillStyle = '#f1dcc1'; g.fillRect(0, s * 0.78, s, s * 0.22);
      g.fillStyle = 'rgba(180,70,64,.45)';
      for (let i = 0; i < 10; i++) { g.fillRect(i * s * 0.13, s * 0.78, s * 0.045, s * 0.22); g.fillRect(0, s * (0.8 + i * 0.065), s, s * 0.02); }
      g.fillStyle = '#fff3ca'; g.beginPath(); g.ellipse(s * 0.5, s * 0.88, s * 0.18, s * 0.07, 0, 0, TAU); g.fill();
      g.fillStyle = '#c95d45'; for (const x of [0.43, 0.52, 0.58]) { g.beginPath(); g.arc(s * x, s * 0.86, s * 0.035, 0, TAU); g.fill(); }
    },
  },
  {
    caption: 'mūsu pārgājiens',
    paint(g, s) {
      vgrad(g, s, 0, 1, ['#9ebed6', '#f4cbbb', '#9aaf87']);
      for (const [x, y, col] of [[0.2, 0.3, '#6e8991'], [0.75, 0.19, '#829b9b'], [0.5, 0.46, '#486f68']] as const) {
        g.fillStyle = col; g.beginPath(); g.moveTo((x - 0.55) * s, s); g.lineTo(x * s, y * s); g.lineTo((x + 0.55) * s, s); g.fill();
      }
      person(g, s * 0.34, s * 0.61, s * 0.13, { skin: '#d4a07f', hair: '#332e28', style: 'short', shirt: '#d58b43', happy: true });
      person(g, s * 0.67, s * 0.64, s * 0.12, { skin: '#f0c4a4', hair: '#a45c36', style: 'bob', shirt: '#6894be', happy: true });
    },
  },
  {
    caption: 'izlaidums',
    paint(g, s, rand) {
      vgrad(g, s, 0, 1, ['#e5d4bd', '#a38e9d']);
      bokeh(g, s, rand, ['#ffe9a8', '#fff6dc'], 20, 0.5);
      person(g, s * 0.5, s * 0.47, s * 0.21, { skin: '#d5a07d', hair: '#382724', style: 'long', shirt: '#283653', happy: true });
      g.fillStyle = '#222c43'; g.beginPath(); g.moveTo(s * 0.17, s * 0.19); g.lineTo(s * 0.5, s * 0.1); g.lineTo(s * 0.83, s * 0.19); g.lineTo(s * 0.5, s * 0.29); g.fill();
      g.strokeStyle = '#edc46c'; g.lineWidth = s * 0.016; g.beginPath(); g.moveTo(s * 0.76, s * 0.21); g.lineTo(s * 0.78, s * 0.43); g.stroke();
      g.fillStyle = '#f6e9c9'; g.save(); g.translate(s * 0.5, s * 0.85); g.rotate(-0.18); g.fillRect(-s * 0.23, -s * 0.055, s * 0.46, s * 0.11); g.fillStyle = '#b04d56'; g.fillRect(-s * 0.02, -s * 0.06, s * 0.04, s * 0.12); g.restore();
    },
  },
  {
    caption: 'sniega diena',
    paint(g, s, rand) {
      vgrad(g, s, 0, 1, ['#8cabc9', '#e9eef3']);
      for (const [y, r] of [[0.77, 0.22], [0.49, 0.16]]) { g.fillStyle = '#f8f3e7'; g.beginPath(); g.arc(s * 0.68, s * y, s * r, 0, TAU); g.fill(); }
      g.fillStyle = '#342f3c'; g.fillRect(s * 0.48, s * 0.34, s * 0.4, s * 0.025); g.fillRect(s * 0.56, s * 0.21, s * 0.23, s * 0.14);
      g.fillStyle = '#d7803a'; g.beginPath(); g.moveTo(s * 0.65, s * 0.48); g.lineTo(s * 0.47, s * 0.53); g.lineTo(s * 0.65, s * 0.54); g.fill();
      g.fillStyle = '#be5858'; g.fillRect(s * 0.52, s * 0.59, s * 0.31, s * 0.06); g.fillRect(s * 0.72, s * 0.62, s * 0.055, s * 0.2);
      person(g, s * 0.24, s * 0.59, s * 0.12, { skin: '#efbda0', hair: '#6a4934', style: 'bob', shirt: '#728fa9', happy: true });
      g.fillStyle = '#fff'; for (let i = 0; i < 36; i++) { g.beginPath(); g.arc(rand() * s, rand() * s, s * 0.008, 0, TAU); g.fill(); }
    },
  },
  {
    caption: 'mazais brālītis',
    paint(g, s, rand) {
      vgrad(g, s, 0, 1, ['#f4dcae', '#e2b2a9']);
      bokeh(g, s, rand, ['#ffefb9', '#fff'], 12, 0.25);
      g.fillStyle = '#e8eeee'; g.beginPath(); g.ellipse(s * 0.5, s * 0.72, s * 0.32, s * 0.42, -0.18, 0, TAU); g.fill();
      person(g, s * 0.48, s * 0.42, s * 0.17, { skin: '#f1c6a6', hair: '#c29463', style: 'short', shirt: '#b0c9cd', happy: true });
      g.strokeStyle = '#f7f3e8'; g.lineWidth = s * 0.09; g.beginPath(); g.moveTo(s * 0.22, s * 0.66); g.quadraticCurveTo(s * 0.55, s * 0.91, s * 0.78, s * 0.64); g.stroke();
    },
  },
];

/** Hash-based generator so each picture's grain and bokeh stay the same on every repaint. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole polaroid: the white card with a soft shadow, the picture with film look, the handwritten caption.
 * The sprite's origin (the clothespin) is at (pad + w/2, pad). */
function paintPolaroid(pic: Picture, index: number, w: number, S: number) {
  const pad = w * 0.14;
  const h = w * 1.216;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((w + pad * 2) * S);
  cv.height = Math.ceil((h + pad * 2) * S);
  const g = cv.getContext('2d')!;
  g.scale(S, S);
  g.translate(pad, pad);
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = w * 0.08;
  g.shadowOffsetY = w * 0.05;
  g.shadowOffsetX = w * 0.02;
  g.fillStyle = '#f7f3ea';
  g.fillRect(0, 0, w, h);
  g.shadowColor = 'transparent';
  const paper = g.createLinearGradient(0, 0, w, h);
  paper.addColorStop(0, 'rgba(255,255,255,0.5)');
  paper.addColorStop(1, 'rgba(200,190,170,0.25)');
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  const ix = w * 0.051;
  const iy = w * 0.06;
  const s = w * 0.898;
  g.save();
  g.translate(ix, iy);
  g.beginPath();
  g.rect(0, 0, s, s);
  g.clip();
  const rand = seeded(index * 7919 + 13);
  pic.paint(g, s, rand);
  // Film look: warm cast, light leak, vignette, grain.
  g.fillStyle = 'rgba(255,190,120,0.1)';
  g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'lighter';
  const leak = g.createRadialGradient(s * (index % 2 ? 1 : 0), 0, 0, s * (index % 2 ? 1 : 0), 0, s * 0.6);
  leak.addColorStop(0, 'rgba(255,120,60,0.28)');
  leak.addColorStop(1, 'rgba(255,120,60,0)');
  g.fillStyle = leak;
  g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'source-over';
  const vig = g.createRadialGradient(s / 2, s / 2, s * 0.35, s / 2, s / 2, s * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(30,15,10,0.42)');
  g.fillStyle = vig;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 500; i += 1) {
    g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
    g.fillRect(rand() * s, rand() * s, s * 0.008, s * 0.008);
  }
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = Math.max(0.5, w * 0.006);
  g.strokeRect(ix, iy, s, s);
  g.save();
  g.translate(w / 2, iy + s + (h - iy - s) * 0.55);
  g.rotate((rand() - 0.5) * 0.08);
  g.fillStyle = 'rgba(40,40,70,0.88)';
  g.font = `${Math.round(w * 0.12)}px ${HAND}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(pic.caption, 0, 0, w * 0.9);
  g.restore();
  return { cv, pad, w, h, ix, iy, s };
}

type Photo = { x: number; pic: number; pool: number[]; ang: number; av: number; base: number; dev: number; shake: number };

export const PHOTO_GARLAND: CanvasSceneDef = {
  kind: 'canvas',
  id: 'polaroids',
  label: 'Гирлянда фото',
  palettes: [
    ['#2a1a26', '#140c14', '#ffcf7a', '#ff9a5a'],
    ['#1a2230', '#0a0e16', '#ffe0a8', '#9ad0ff'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [wallTop, wallLow, bulbCol, bokehCol] = c.palette;
    const pw = c.body ? clamp(Math.min(W, H) * 0.16, 70, 170) : clamp(H * 0.46, 40, 150);
    const u = pw / 80;
    const x0 = W * (c.body ? 0.04 : 0.32);
    const x1 = W * (c.body ? 0.96 : 1.02);
    const y0 = H * (c.body ? 0.06 : 0.1);
    const y1 = H * (c.body ? 0.05 : 0.06);
    const sag = c.body ? H * 0.06 : H * 0.12;

    // The wall: dusk-dark plaster with far fairy lights out of focus.
    const wall = document.createElement('canvas');
    wall.width = Math.ceil(W * S);
    wall.height = Math.ceil(H * S);
    {
      const g = wall.getContext('2d')!;
      g.scale(S, S);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, wallTop);
      gr.addColorStop(1, wallLow);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      const warm = g.createRadialGradient(W * 0.7, H * 0.2, 0, W * 0.7, H * 0.2, Math.max(W, H) * 0.6);
      warm.addColorStop(0, rgba(bulbCol, 0.14));
      warm.addColorStop(1, rgba(bulbCol, 0));
      g.fillStyle = warm;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i += 1) {
        const x = W * (c.body ? rand() : 0.25 + rand() * 0.75);
        const y = rand() * H;
        const r = pw * (0.1 + rand() * 0.25);
        const col = rand() < 0.7 ? bulbCol : bokehCol;
        const b = g.createRadialGradient(x, y, r * 0.6, x, y, r);
        b.addColorStop(0, rgba(col, 0.09 + rand() * 0.08));
        b.addColorStop(1, rgba(col, 0));
        g.fillStyle = b;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 1400; i += 1) {
        g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.05)';
        g.fillRect(rand() * W, rand() * H, 1.5, 1.5);
      }
    }

    const pictures = [...PICTURES, ...LEFT_PICTURES];
    const sprites = new Map<number, ReturnType<typeof paintPolaroid>>();
    const spriteOf = (i: number) => {
      let sp = sprites.get(i);
      if (!sp) {
        sp = paintPolaroid(pictures[i], i, pw, S);
        sprites.set(i, sp);
      }
      return sp;
    };
    const spacing = pw * 1.02;
    const n = Math.max(1, Math.floor((Math.min(x1, W) - x0 - pw * 0.2) / spacing));
    const order = PICTURES.map((_, i) => i).sort(() => rand() - 0.5);
    const leftOrder = LEFT_PICTURES.map((_, i) => i + PICTURES.length).sort(() => rand() - 0.5);
    const photos: Photo[] = Array.from({ length: n }, (_, i) => {
      const left = c.body && (c.region === 'left' || ((!c.region || c.region === 'full') && i < n / 2));
      const pool = left ? leftOrder : order;
      return {
        x: x0 + pw * 0.6 + (Math.min(x1, W) - x0 - pw * 1.2) * (n === 1 ? 0.5 : i / (n - 1)) + (rand() - 0.5) * pw * 0.12,
        pic: pool[i % pool.length],
        pool,
        ang: 0,
        av: 0,
        base: (rand() - 0.5) * 0.12,
        dev: 1,
        shake: 0,
      };
    });
    let next = n % PICTURES.length;
    const bulbs = Math.max(4, Math.round((x1 - x0) / (22 * u)));
    let clock = 0;
    let sagNow = sag;
    let hover = -1;

    const stringY = (x: number) => {
      const f = clamp((x - x0) / (x1 - x0), 0, 1);
      return y0 + (y1 - y0) * f + sagNow * 4 * f * (1 - f);
    };
    const slopeAt = (x: number) => (stringY(x + 1) - stringY(x - 1)) / 2;
    const localOf = (ph: Photo, px: number, py: number) => {
      const dx = px - ph.x;
      const dy = py - stringY(ph.x);
      const ca = Math.cos(ph.ang + ph.base);
      const sa = Math.sin(ph.ang + ph.base);
      return { lx: dx * ca + dy * sa, ly: -dx * sa + dy * ca };
    };

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.033) * clamp(c.params.speed, 0.2, 3);
        clock += sdt;
        const react = clamp(c.params.react, 0, 3);
        sagNow = sag * (1 + 0.03 * Math.sin(clock * 0.9));
        hover = -1;
        for (let i = 0; i < photos.length; i += 1) {
          const ph = photos[i];
          const wind = (Math.sin(clock * 0.7 + ph.x * 0.01) * 0.6 + Math.sin(clock * 1.9 + ph.x * 0.03) * 0.25) * 0.5;
          let acc = -6 * Math.sin(ph.ang) - 1.1 * ph.av + wind;
          if (p.active) {
            const { lx, ly } = localOf(ph, p.x, p.y);
            if (Math.abs(lx) < pw * 0.6 && ly > -pw * 0.1 && ly < pw * 1.3) {
              hover = i;
              acc += clamp(p.vx, -3000, 3000) * 0.012 * react * (ly / (pw * 1.2));
            }
          }
          if (ph.shake > 0) {
            ph.shake = Math.max(0, ph.shake - sdt);
            acc += Math.sin(clock * 38) * 40 * ph.shake;
          }
          ph.av += acc * sdt;
          ph.ang = clamp(ph.ang + ph.av * sdt, -0.7, 0.7);
          if (ph.dev < 1) ph.dev = Math.min(1, ph.dev + sdt / 3.2);
        }
        // The click is tested at the raw cursor: the smoothed one may still be catching up.
        const hit = p.active && p.clicked
          ? photos.findIndex((ph) => {
              const { lx, ly } = localOf(ph, p.rawX, p.rawY);
              return Math.abs(lx) < pw * 0.55 && ly > -pw * 0.1 && ly < pw * 1.25;
            })
          : -1;
        if (hit >= 0) {
          const ph = photos[hit];
          ph.shake = 0.6;
          ph.dev = 0;
          const used = new Set(photos.map((q) => q.pic));
          for (let k = 0; k < ph.pool.length; k += 1) {
            const cand = ph.pool[(next + k) % ph.pool.length];
            if (!used.has(cand)) {
              ph.pic = cand;
              next += k + 1;
              break;
            }
          }
        }
      },
      draw(g) {
        g.drawImage(wall, 0, 0, W, H);
        // The twine.
        g.strokeStyle = '#8a6a48';
        g.lineWidth = 1.4 * u;
        g.beginPath();
        for (let k = 0; k <= 60; k += 1) {
          const x = x0 + ((x1 - x0) * k) / 60;
          if (k === 0) g.moveTo(x, stringY(x));
          else g.lineTo(x, stringY(x));
        }
        g.stroke();
        const order2 = photos.map((_, i) => i).filter((i) => i !== hover);
        if (hover >= 0) order2.push(hover);
        for (const i of order2) {
          const ph = photos[i];
          const sp = spriteOf(ph.pic);
          const py = stringY(ph.x);
          g.save();
          g.translate(ph.x, py);
          g.rotate(ph.ang + ph.base + Math.atan(slopeAt(ph.x)) * 0.3);
          const lift = i === hover ? 1.03 : 1;
          g.scale(lift, lift);
          g.drawImage(sp.cv, -sp.pad - sp.w / 2, -sp.pad - pw * 0.02, sp.cv.width / S, sp.cv.height / S);
          if (ph.dev < 1) {
            // A fresh polaroid: the picture comes up out of a blue-grey murk.
            const a = (1 - ph.dev) ** 1.6;
            g.fillStyle = `rgba(52,64,70,${a})`;
            g.fillRect(-sp.w / 2 + sp.ix, sp.iy - pw * 0.02, sp.s, sp.s);
            g.fillStyle = `rgba(120,90,60,${a * 0.25 * Math.sin(ph.dev * Math.PI)})`;
            g.fillRect(-sp.w / 2 + sp.ix, sp.iy - pw * 0.02, sp.s, sp.s);
          }
          // The clothespin.
          const cw = pw * 0.11;
          const top = -pw * 0.16;
          const wood = g.createLinearGradient(-cw / 2, 0, cw / 2, 0);
          wood.addColorStop(0, '#c89a62');
          wood.addColorStop(0.5, '#e8c28a');
          wood.addColorStop(1, '#b0804a');
          g.fillStyle = wood;
          g.beginPath();
          g.roundRect(-cw / 2, top, cw, pw * 0.3, cw * 0.25);
          g.fill();
          g.strokeStyle = 'rgba(90,60,30,0.55)';
          g.lineWidth = Math.max(0.6, pw * 0.008);
          g.beginPath();
          g.moveTo(0, top + pw * 0.02);
          g.lineTo(0, top + pw * 0.29);
          g.stroke();
          g.fillStyle = '#b8bcc4';
          g.fillRect(-cw * 0.62, top + pw * 0.1, cw * 1.24, pw * 0.028);
          g.restore();
        }
        // Fairy lights on a thin green wire, twinkling in a slow chase, warming whatever is near.
        g.strokeStyle = 'rgba(40,70,40,0.9)';
        g.lineWidth = 0.7 * u;
        g.beginPath();
        for (let k = 0; k <= 120; k += 1) {
          const x = x0 + ((x1 - x0) * k) / 120;
          const y = stringY(x) + Math.sin(k * 0.9) * 1.6 * u;
          if (k === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
        const intensity = clamp(c.params.intensity, 0.2, 2);
        g.globalCompositeOperation = 'lighter';
        for (let k = 0; k < bulbs; k += 1) {
          const x = x0 + ((x1 - x0) * (k + 0.5)) / bulbs;
          const y = stringY(x) + 3.2 * u;
          const tw = (0.62 + 0.38 * Math.sin(clock * 1.6 - k * 0.55)) * (0.85 + 0.15 * Math.sin(clock * 7.3 + k * 2.1)) * intensity;
          const halo = g.createRadialGradient(x, y, 0, x, y, 34 * u);
          halo.addColorStop(0, rgba(bulbCol, 0.22 * tw));
          halo.addColorStop(0.25, rgba(bulbCol, 0.07 * tw));
          halo.addColorStop(1, rgba(bulbCol, 0));
          g.fillStyle = halo;
          g.fillRect(x - 34 * u, y - 34 * u, 68 * u, 68 * u);
          const core = g.createRadialGradient(x, y, 0, x, y, 4 * u);
          core.addColorStop(0, rgba('#ffffff', 0.95 * Math.min(1, tw)));
          core.addColorStop(0.4, rgba(bulbCol, 0.8 * Math.min(1, tw)));
          core.addColorStop(1, rgba(bulbCol, 0));
          g.fillStyle = core;
          g.fillRect(x - 4 * u, y - 4 * u, 8 * u, 8 * u);
        }
        g.globalCompositeOperation = 'source-over';
      },
    };
  },
};
