import type { CanvasSceneDef } from './types';
import { clamp, fillGradient, glow, rgba } from './kit';
import { createPixelSand, LEDS, stepPixelSand, type Led } from './pixelHourglassPhysics';
import { createPixelHourglassAutoFlip } from './pixelHourglassAutoFlip';

const OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [-0.60, -1.18], [0.60, -1.18], [0.76, -1.02], [0.76, -0.49],
  [0.10, -0.02], [0.10, 0.10], [0.66, 0.43], [0.66, 1.06],
  [0.54, 1.17], [-0.54, 1.17], [-0.66, 1.06], [-0.66, 0.43],
  [-0.10, 0.10], [-0.10, -0.02], [-0.76, -0.49], [-0.76, -1.02],
];

function outline(g: CanvasRenderingContext2D) {
  g.beginPath();
  OUTLINE.forEach(([x, y], index) => index ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath();
}

function diamond(g: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  g.beginPath();
  g.moveTo(x, y - radius);
  g.lineTo(x + radius, y);
  g.lineTo(x, y + radius);
  g.lineTo(x - radius, y);
  g.closePath();
}

export const PIXEL_HOURGLASS: CanvasSceneDef = {
  kind: 'canvas',
  id: 'pixel-hourglass',
  label: 'Пиксельные часы',
  palettes: [
    ['#0d0c0e', '#ffad11', '#ffe28d', '#605955'],
    ['#0b1018', '#68d8ff', '#daf6ff', '#52636d'],
  ],
  create(c) {
    const { width: W, height: H } = c;
    const scale = Math.min(H * 0.4, W * 0.22);
    const cx = W * (c.body ? 0.5 : 0.72);
    const cy = H * 0.5;
    let angle = 0;
    let pressed = false;
    let lastPointerAngle = 0;
    let physicsTime = 0;
    let clock = 0;
    const sand = createPixelSand();
    const autoFlip = createPixelHourglassAutoFlip();

    function drawLed(g: CanvasRenderingContext2D, led: Led, lit: boolean, index: number) {
      diamond(g, led.x, led.y, 0.074);
      g.fillStyle = '#090809';
      g.fill();
      diamond(g, led.x, led.y, 0.064);
      if (lit) {
        const shimmer = 0.92 + 0.08 * Math.sin(clock * 5.2 + index * 2.7);
        g.shadowColor = c.palette[1];
        g.shadowBlur = 0.07 * scale;
        g.fillStyle = rgba(c.palette[1], clamp(shimmer * c.params.intensity, 0, 1));
      } else g.fillStyle = rgba(c.palette[3], 0.72);
      g.fill();
      g.shadowBlur = 0;
    }

    return {
      update(dt, t, pointer) {
        clock = t;
        if (pointer.pressed && pointer.active) {
          const pointerAngle = Math.atan2(pointer.rawY - cy, pointer.rawX - cx);
          const distance = Math.hypot(pointer.rawX - cx, pointer.rawY - cy);
          if (!pressed) {
            pressed = true;
            lastPointerAngle = pointerAngle;
          } else if (distance > scale * 0.32) {
            const delta = Math.atan2(
              Math.sin(pointerAngle - lastPointerAngle),
              Math.cos(pointerAngle - lastPointerAngle),
            );
            angle += delta * c.params.react;
            lastPointerAngle = pointerAngle;
          }
        } else pressed = false;

        angle = autoFlip.update(dt, angle, sand.cells, pointer.pressed && pointer.active);
        // Gravity stays down on screen; rotate it into the face-on clock's plane.
        const gx = Math.sin(angle);
        const gy = Math.cos(angle);
        physicsTime = Math.min(physicsTime + dt * c.params.speed, 0.12);
        while (physicsTime >= 1 / 60) {
          stepPixelSand(sand, gx, gy, 1 / 60);
          physicsTime -= 1 / 60;
        }
      },
      draw(g) {
        fillGradient(g, W, H, c.palette[0], '#040406');
        glow(g, cx, cy + scale * 0.25, scale * 1.95, c.palette[1], 0.16);
        g.imageSmoothingEnabled = false;
        g.save();
        g.translate(cx, cy);
        g.rotate(angle);
        g.scale(scale, scale);

        outline(g);
        const body = g.createLinearGradient(-0.8, -1.18, 0.8, 1.17);
        body.addColorStop(0, '#302925');
        body.addColorStop(0.43, '#221d1b');
        body.addColorStop(1, '#171616');
        g.fillStyle = body;
        g.fill();
        g.strokeStyle = rgba('#ad9a84', 0.24);
        g.lineWidth = 0.015;
        g.stroke();

        // The angular bevel and dark face retain the photographed case silhouette.
        g.fillStyle = '#181615';
        g.beginPath();
        g.moveTo(-0.60, -1.18); g.lineTo(0.60, -1.18);
        g.lineTo(0.54, -1.11); g.lineTo(-0.54, -1.11);
        g.closePath(); g.fill();
        g.beginPath();
        g.moveTo(-0.54, 1.17); g.lineTo(0.54, 1.17);
        g.lineTo(0.49, 1.10); g.lineTo(-0.49, 1.10);
        g.closePath(); g.fill();
        LEDS.forEach((led, index) => drawLed(g, led, !!sand.cells[index], index));
        g.restore();
      },
    };
  },
};
