import type { CanvasSceneDef, ScenePointer } from './types';
import { createOrbit } from './orbitControl';
import { createMachine } from '../promBoard/logic';
import { drawPanel, type PanelUi, type Region } from '../promBoard/panel';
import type { BoardRenderer, CameraState } from '../promBoard/renderer';

/** The tree stands here (world mm) — kept in step with TREE_POSITION in renderer.ts, which loads later. */
const TREE = { x: -207, z: -8 };

/**
 * An experimental effect: «Автомат световых эффектов на ППЗУ» (В. Василенко, Радиохобби 6/98) as a working 3D board.
 * The schematic runs in logic.ts (generator, counters, PROM, switches), three.js draws the board with every part
 * (promBoard/renderer.ts) and the current along its copper; the panel beside it shows the PROM's dump and the cell
 * being read, the counters' flip-flops, the buses. Drag to turn the board, click a toggle switch to flip it, drag
 * the rate knob (R4) sideways. three.js is loaded only when the scene starts.
 */

type Tracer = { update(dt: number): void; dispose(): void; mode: 'baked' | 'live' };

export const PROM_BOARD: CanvasSceneDef = {
  kind: 'canvas',
  id: 'prom-board',
  label: 'Автомат световых эффектов на ППЗУ (3D)',
  palettes: [['#07080a']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const machine = createMachine();
    const wide = W >= 900;
    let panelOpen = wide;
    const panelW = () => (panelOpen ? (wide ? Math.min(440, Math.max(360, W * 0.3)) : Math.min(W - 20, 420)) : 0);
    const viewW = () => (wide && panelOpen ? W - panelW() : W);
    let renderer: BoardRenderer | null = null;
    let failed = '';
    let tracer: Tracer | null = null;
    // Holiday preset keeps the tree in the small course composition too; the experimental default is unchanged.
    const ui: PanelUi = { paused: false, glow: true, traced: 'off', status: 'загрузка…', hover: null, progMenu: false, tree: c.params.preset === 1 || W >= 1200, treeUp: true, star: 'red' };
    let regions: Region[] = [];
    let THREEVec: (typeof import('three'))['Vector3'] | null = null;
    const cam: CameraState & { goal: { yaw: number; pitch: number; dist: number; tx: number; ty: number; tz: number } } = {
      yaw: 0.28,
      pitch: 0.78,
      dist: 360,
      target: null as unknown as CameraState['target'],
      goal: { yaw: 0.28, pitch: 0.78, dist: 360, tx: 0, ty: 4, tz: 8 },
    };
    const vw0 = viewW();
    const fit = W / H < 1.3 ? 1.35 : 1;
    cam.goal.dist *= fit;
    cam.dist = cam.goal.dist;
    const overview = () => (ui.tree
      ? { yaw: 0.12, pitch: 0.5, dist: 700 * fit, tx: -62, ty: 78, tz: 0 }
      : { yaw: 0.28, pitch: 0.78, dist: 360 * fit, tx: 0, ty: 4, tz: 8 });
    Object.assign(cam.goal, overview());
    cam.yaw = cam.goal.yaw;
    cam.pitch = cam.goal.pitch;
    cam.dist = cam.goal.dist;
    const presets = [
      { yaw: 0.28, pitch: 0.78, dist: 360 * fit, tx: 0, ty: 4, tz: 8 },
      { yaw: -0.2, pitch: 0.95, dist: 150, tx: 7, ty: 10, tz: -8 },
      { yaw: 0.0, pitch: 0.42, dist: 170, tx: 6, ty: 8, tz: 40 },
      { yaw: -0.6, pitch: 0.7, dist: 170, tx: 68, ty: 12, tz: 5 },
      { yaw: 0.3, pitch: 0.3, dist: 380, tx: TREE.x, ty: 95, tz: TREE.z },
    ];

    import('../promBoard/renderer')
      .then(async (mod) => {
        const three = await import('three');
        THREEVec = three.Vector3;
        cam.target = new three.Vector3(cam.goal.tx, cam.goal.ty, cam.goal.tz);
        renderer = await mod.createBoardRenderer(vw0, H, Math.min(c.dpr, 2));
        ui.status = '';
        // Tracing asked for while the board was still being built.
        if (ui.traced !== 'off') setTraced(ui.traced);
      })
      .catch((e: unknown) => {
        failed = e instanceof Error ? e.message : String(e);
      });

    const setTraced = (mode: PanelUi['traced']) => {
      ui.traced = mode;
      tracer?.dispose();
      tracer = null;
      if (mode === 'off' || !renderer) {
        if (renderer) renderer.boardUniforms.uTracedOn.value = 0;
        return;
      }
      const r = renderer;
      import('../promBoard/raytrace')
        .then((mod) => {
          if (ui.traced !== mode || renderer !== r) return;
          tracer = mod.createTracer(r, mode);
        })
        .catch((e: unknown) => {
          ui.status = `трассировка: ${e instanceof Error ? e.message : String(e)}`;
          ui.traced = 'off';
        });
    };

    const act = (id: string, value?: number) => {
      const sw = machine.sw;
      if (id !== 'progMenu') ui.progMenu = false;
      // Choosing a program sets DD3.2 by hand and holds it (SB3 in «2»), as the quick search does on the real board.
      const choose = (p: number) => {
        machine.goto(((p + 16) % 16) * 16);
        sw.sb3 = 2;
      };
      switch (id) {
        case 'progMenu': ui.progMenu = !ui.progMenu; break;
        case 'prog': if (value !== undefined) choose(value); break;
        case 'progPrev': choose(machine.program - 1); break;
        case 'progNext': choose(machine.program + 1); break;
        case 'cell':
          if (value !== undefined) machine.goto(value);
          break;
        case 'SB1': sw.sb1 = sw.sb1 === 0 ? 1 : 0; break;
        case 'SB2': sw.sb2 = sw.sb2 === 'gen' ? 'input' : 'gen'; break;
        case 'SB3': sw.sb3 = sw.sb3 === 1 ? 2 : 1; break;
        case 'SB4': sw.sb4 = sw.sb4 === 1 ? 2 : 1; break;
        case 'SB5': sw.sb5 = !sw.sb5; break;
        case 'pause': ui.paused = !ui.paused; break;
        case 'step': ui.paused = true; machine.goto((machine.address & 0xf0) | ((machine.step + 1) & 15)); break;
        case 'reset': machine.reset(); break;
        case 'glow': ui.glow = !ui.glow; break;
        case 'traced': setTraced(ui.traced === 'off' ? 'baked' : ui.traced === 'baked' ? 'live' : 'off'); break;
        case 'zin': cam.goal.dist = Math.max(60, cam.goal.dist * 0.8); break;
        case 'zout': cam.goal.dist = Math.min(900, cam.goal.dist * 1.25); break;
        case 'panel': panelOpen = !panelOpen; break;
        case 'tree': ui.tree = !ui.tree; Object.assign(cam.goal, overview()); break;
        case 'treeDir': ui.treeUp = !ui.treeUp; break;
        case 'star': ui.star = ui.star === 'red' ? 'white' : 'red'; break;
        case 'v0': Object.assign(cam.goal, overview()); break;
        default:
          if (id[0] === 'v') Object.assign(cam.goal, presets[Number(id.slice(1))]);
      }
    };

    // Pointer: press → drag turns the board (or the knob, or the rate slider); a press that did not move clicks.
    let press: { x: number; y: number; moved: boolean; mode: 'orbit' | 'knob' | 'rate' | 'panel'; yaw: number; pitch: number; rate: number; region: Region | null } | null = null;
    const regionAt = (x: number, y: number) => regions.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ?? null;
    const handlePointer = (p: ScenePointer) => {
      const x = p.rawX, y = p.rawY;
      const reg = p.active ? regionAt(x, y) : null;
      ui.hover = reg ? reg.id + (reg.value ?? '') : null;
      if (p.clicked) {
        const inView = x < viewW() && !(panelOpen && !wide && reg);
        let mode: 'orbit' | 'knob' | 'rate' | 'panel' = reg ? (reg.id === 'rate' ? 'rate' : 'panel') : 'orbit';
        if (!reg && inView && renderer && renderer.pick(x, y, viewW(), H) === 'R4') mode = 'knob';
        press = { x, y, moved: false, mode, yaw: cam.goal.yaw, pitch: cam.goal.pitch, rate: machine.rate, region: reg };
      }
      if (press && p.pressed) {
        const dx = x - press.x, dy = y - press.y;
        if (Math.hypot(dx, dy) > 4) press.moved = true;
        if (press.mode === 'orbit' && press.moved) {
          cam.goal.yaw = press.yaw - dx * 0.006;
          cam.goal.pitch = Math.min(1.45, Math.max(0.12, press.pitch + dy * 0.004));
        } else if (press.mode === 'knob' && press.moved) machine.rate = press.rate + dx / 300;
        else if (press.mode === 'rate' && press.region) machine.rate = (x - press.region.x) / press.region.w;
      }
      if (press && !p.pressed) {
        if (!press.moved) {
          if (press.region && press.mode !== 'rate') act(press.region.id, press.region.value);
          else if (press.mode === 'orbit' && renderer) {
            ui.progMenu = false;
            const hit = renderer.pick(press.x, press.y, viewW(), H);
            if (hit && hit.startsWith('SB')) act(hit);
          } else if (press.mode === 'rate' && press.region) machine.rate = (press.x - press.region.x) / press.region.w;
        }
        press = null;
      }
    };

    let time = 0;
    let lastW = vw0;
    // It turns by dragging already; the camera control adds the wheel (its button at the bottom right of the board's
    // view: the top right corner has the panel's button).
    const orbit = createOrbit(c, {
      ownDrag: true,
      onWheel: (f) => { cam.goal.dist = Math.min(900, Math.max(60, cam.goal.dist / f)); },
      place: () => ({ right: viewW() - 10, top: H - 36 }),
    });
    return {
      isControlPoint: (x, y) => !!regionAt(x, y),
      update(dt, _t, pIn) {
        const p = orbit.update(pIn);
        const sdt = Math.min(dt, 0.1);
        time += sdt;
        handlePointer(p);
        machine.update(ui.paused ? 0 : sdt * Math.max(0.05, c.params.speed));
        // Ease the camera towards its goal.
        const k = 1 - Math.exp(-sdt * 8);
        cam.yaw += (cam.goal.yaw - cam.yaw) * k;
        cam.pitch += (cam.goal.pitch - cam.pitch) * k;
        cam.dist += (cam.goal.dist - cam.dist) * k;
        if (renderer && cam.target && THREEVec) {
          cam.target.x += (cam.goal.tx - cam.target.x) * k;
          cam.target.y += (cam.goal.ty - cam.target.y) * k;
          cam.target.z += (cam.goal.tz - cam.target.z) * k;
          const vw = viewW();
          if (vw !== lastW) {
            lastW = vw;
            renderer.resize(vw, H);
          }
          renderer.update(machine, sdt, time, cam, { glow: ui.glow ? c.params.intensity : 0, exposure: 1, bloom: 1, tree: ui.tree, treeUp: ui.treeUp, star: ui.star });
          tracer?.update(sdt);
        }
      },
      draw(g) {
        g.fillStyle = '#07080a';
        g.fillRect(0, 0, W, H);
        const vw = viewW();
        if (renderer) {
          renderer.render();
          g.drawImage(renderer.canvas, 0, 0, vw, H);
        } else {
          g.fillStyle = 'rgba(190,255,230,0.8)';
          g.font = '14px ui-monospace, Consolas, monospace';
          g.textAlign = 'center';
          g.fillText(failed ? `Не удалось запустить 3D: ${failed}` : 'Собираю плату…', vw / 2, H / 2);
        }
        regions = [];
        if (panelOpen) {
          const pw = panelW();
          regions = drawPanel(g, W - pw, wide ? 0 : 44, pw, wide ? H : H - 44, machine, ui);
        }
        if (!wide) {
          // A small corner readout and the button that opens the panel over the board.
          g.fillStyle = 'rgba(10,13,16,0.8)';
          g.beginPath();
          g.roundRect(8, 8, 150, 44, 8);
          g.fill();
          g.font = 'bold 14px ui-monospace, Consolas, monospace';
          g.textAlign = 'left';
          g.textBaseline = 'middle';
          g.fillStyle = '#ffe2a0';
          g.fillText(`A ${machine.address.toString(16).toUpperCase().padStart(2, '0')}`, 16, 22);
          g.fillStyle = '#8fffe0';
          g.fillText(`Q ${machine.data.toString(16).toUpperCase().padStart(2, '0')}`, 82, 22);
          g.font = '10px ui-monospace, Consolas, monospace';
          g.fillStyle = 'rgba(190,220,210,0.7)';
          g.fillText(`прогр. ${machine.program.toString(16).toUpperCase()} · шаг ${machine.step.toString(16).toUpperCase()}`, 16, 41);
          const bx = W - 96;
          g.fillStyle = panelOpen ? 'rgba(255,214,120,0.25)' : 'rgba(10,13,16,0.8)';
          g.beginPath();
          g.roundRect(bx, 8, 88, 28, 7);
          g.fill();
          g.fillStyle = '#dfe8e4';
          g.textAlign = 'center';
          g.font = '12px ui-monospace, Consolas, monospace';
          g.fillText(panelOpen ? 'Скрыть' : 'Код и схема', bx + 44, 23);
          regions.push({ id: 'panel', x: bx, y: 8, w: 88, h: 28 });
        }
        orbit.draw(g);
      },
      dispose() {
        orbit.dispose();
        tracer?.dispose();
        renderer?.dispose();
      },
    };
  },
};
