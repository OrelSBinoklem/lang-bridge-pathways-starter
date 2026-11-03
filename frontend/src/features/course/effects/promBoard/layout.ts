/**
 * The board of «Автомат световых эффектов на ППЗУ»: every part of the schematic (Радиохобби 6/98, рис. 1), where it
 * sits and which of its pins joins which net. The magazine printed no board, so the placement is ours: a 190 × 125 mm
 * two-layer board — channel columns (LED, R27–R34, VT3–VT10, R19–R26/R11–R18) along the front, the logic behind
 * them, the input and the generator on the left, the supply and the triacs on the right.
 *
 * Millimetres; x to the right, y from the front edge to the back; rotations in degrees, counter-clockwise.
 * scripts/route-prom-board.cjs routes the nets (routes.json); the scene builds the parts and the copper from both.
 */

export const BOARD = { w: 190, h: 125, thickness: 1.6 };

export type Package =
  | { kind: 'dip'; pins: number; row: number; socket?: boolean }
  | { kind: 'axial'; pitch: number; body: 'mlt' | 'glass' }
  | { kind: 'kt13' }
  | { kind: 'to39' }
  | { kind: 'to126' }
  | { kind: 'radial'; pitch: number; d: number; h: number }
  | { kind: 'ceramic' }
  | { kind: 'led'; color: 'red' | 'green' | 'yellow' }
  | { kind: 'pot' }
  | { kind: 'toggle'; poles: 2 | 3 }
  | { kind: 'bridge' }
  | { kind: 'triac' }
  | { kind: 'xfmrSmall' }
  | { kind: 'xfmrPower' }
  | { kind: 'terminal'; pins: number }
  | { kind: 'jack' };

export type Part = {
  ref: string;
  pkg: Package;
  /** Marking printed on the part (type, value). */
  label: string;
  x: number;
  y: number;
  rot: number;
};

const DIP = (pins: number, row = 7.62, socket = false): Package => ({ kind: 'dip', pins, row, socket });
const MLT: Package = { kind: 'axial', pitch: 10.16, body: 'mlt' };

/** Channel k (0..7) sits in a column at this x, from the LED at the front to the resistors feeding its transistor. */
export const channelX = (k: number) => 64 + k * 10.5;

const parts: Part[] = [
  // Logic.
  { ref: 'DD1', pkg: DIP(16), label: 'К564ИЕ10', x: 54, y: 113, rot: 0 },
  { ref: 'DD2', pkg: DIP(14), label: 'К555ЛА3', x: 28, y: 76, rot: 0 },
  { ref: 'DD3', pkg: DIP(16), label: 'К564ИЕ10', x: 66, y: 74, rot: 0 },
  { ref: 'DD4', pkg: DIP(16), label: 'К564ИЕ10', x: 40, y: 95, rot: 0 },
  { ref: 'DD5', pkg: DIP(14), label: 'К564ЛА8', x: 68, y: 95, rot: 0 },
  { ref: 'DD6', pkg: DIP(24, 15.24, true), label: 'КР556РТ5', x: 102, y: 74, rot: 0 },
  { ref: 'R10', pkg: MLT, label: '2к', x: 101, y: 90, rot: 0 },
  // Input: X1 → T1 → VT1.
  { ref: 'X1', pkg: { kind: 'jack' }, label: 'Вход', x: 9, y: 111, rot: 0 },
  { ref: 'T1', pkg: { kind: 'xfmrSmall' }, label: 'T1', x: 20, y: 113, rot: 0 },
  { ref: 'R1', pkg: MLT, label: '3к9', x: 30, y: 104, rot: 0 },
  { ref: 'R2', pkg: MLT, label: '30к', x: 20, y: 99, rot: 0 },
  { ref: 'R3', pkg: MLT, label: '5к1', x: 40, y: 110, rot: 90 },
  { ref: 'VT1', pkg: { kind: 'to39' }, label: 'КТ608Б', x: 31, y: 115, rot: 0 },
  // Generator: DD2 + VT2, R4 sets the rate.
  { ref: 'R4', pkg: { kind: 'pot' }, label: '22к', x: 14, y: 32, rot: 0 },
  { ref: 'R5', pkg: MLT, label: '1к', x: 7, y: 62, rot: 90 },
  { ref: 'VT2', pkg: { kind: 'kt13' }, label: 'КТ315Б', x: 16, y: 58, rot: 0 },
  { ref: 'C1', pkg: { kind: 'radial', pitch: 2.5, d: 6, h: 11 }, label: '50,0×6В', x: 8, y: 48, rot: 0 },
  { ref: 'R6', pkg: MLT, label: '160', x: 22, y: 49, rot: 0 },
  { ref: 'R7', pkg: MLT, label: '820', x: 30, y: 58, rot: 0 },
  { ref: 'R8', pkg: MLT, label: '560', x: 42, y: 66, rot: 0 },
  { ref: 'C2', pkg: { kind: 'ceramic' }, label: '1000', x: 46, y: 76, rot: 90 },
  { ref: 'R9', pkg: MLT, label: '10к', x: 28, y: 88, rot: 0 },
  // Switches along the front left, SB5 (mains) at the front right.
  { ref: 'SB1', pkg: { kind: 'toggle', poles: 3 }, label: 'SB1', x: 12, y: 9, rot: 0 },
  { ref: 'SB2', pkg: { kind: 'toggle', poles: 3 }, label: 'SB2', x: 26, y: 9, rot: 0 },
  { ref: 'SB3', pkg: { kind: 'toggle', poles: 3 }, label: 'SB3', x: 40, y: 9, rot: 0 },
  { ref: 'SB4', pkg: { kind: 'toggle', poles: 3 }, label: 'SB4', x: 54, y: 9, rot: 0 },
  { ref: 'SB5', pkg: { kind: 'toggle', poles: 2 }, label: 'SB5', x: 180, y: 9, rot: 0 },
  // Supply: T2 → VD2–VD5 → C4 → VT11 (+ VD1, R35) → C3.
  { ref: 'T2', pkg: { kind: 'xfmrPower' }, label: 'T2', x: 166, y: 34, rot: 0 },
  { ref: 'VD2', pkg: { kind: 'bridge' }, label: 'КЦ405', x: 147, y: 60, rot: 0 },
  { ref: 'C4', pkg: { kind: 'radial', pitch: 7.5, d: 18, h: 36 }, label: '2000,0×16В', x: 166, y: 64, rot: 0 },
  { ref: 'VT11', pkg: { kind: 'to126' }, label: 'КТ817', x: 181, y: 62, rot: 0 },
  { ref: 'R35', pkg: MLT, label: '100', x: 176, y: 77, rot: 0 },
  { ref: 'VD1', pkg: { kind: 'axial', pitch: 7.62, body: 'glass' }, label: 'КС156А', x: 184, y: 82, rot: 90 },
  { ref: 'C3', pkg: { kind: 'radial', pitch: 5, d: 10, h: 17 }, label: '200,0×16В', x: 150, y: 74, rot: 0 },
  // Mains: X2 in, X3 to the lamps HL9–HL16.
  { ref: 'X2', pkg: { kind: 'terminal', pins: 2 }, label: '~220В', x: 179, y: 119, rot: 0 },
  { ref: 'X3', pkg: { kind: 'terminal', pins: 8 }, label: 'HL9–HL16', x: 148, y: 119, rot: 0 },
];

// Triacs VS1–VS8 in two rows of four.
for (let k = 0; k < 8; k += 1) {
  parts.push({ ref: `VS${k + 1}`, pkg: { kind: 'triac' }, label: 'КУ208Г', x: 132 + (k % 4) * 15, y: k < 4 ? 106 : 91, rot: 0 });
}
// The eight channels.
const LED_COLORS = ['red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green'] as const;
for (let k = 0; k < 8; k += 1) {
  const x = channelX(k);
  parts.push({ ref: `HL${k + 1}`, pkg: { kind: 'led', color: LED_COLORS[k] }, label: 'АЛ307', x, y: 6, rot: 0 });
  parts.push({ ref: `R${27 + k}`, pkg: MLT, label: '100', x, y: 19, rot: 90 });
  parts.push({ ref: `VT${3 + k}`, pkg: { kind: 'kt13' }, label: 'КТ361Б', x, y: 30, rot: 0 });
  parts.push({ ref: `R${19 + k}`, pkg: MLT, label: '1к5', x: x - 2.4, y: 44, rot: 90 });
  parts.push({ ref: `R${11 + k}`, pkg: MLT, label: '1к', x: x + 2.6, y: 44, rot: 90 });
}

export const PARTS: readonly Part[] = parts;

/** Pin positions of a package, local (before rotation), by pin name. */
export function packagePins(pkg: Package): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  switch (pkg.kind) {
    case 'dip': {
      const half = pkg.pins / 2;
      for (let k = 1; k <= half; k += 1) out[k] = [-(half / 2 - 0.5) * 2.54 + (k - 1) * 2.54, -pkg.row / 2];
      for (let k = half + 1; k <= pkg.pins; k += 1) out[k] = [(half / 2 - 0.5) * 2.54 - (k - half - 1) * 2.54, pkg.row / 2];
      break;
    }
    case 'axial':
      out[1] = [-pkg.pitch / 2, 0];
      out[2] = [pkg.pitch / 2, 0];
      break;
    case 'kt13':
      Object.assign(out, { E: [-2.5, 0], C: [0, 0], B: [2.5, 0] });
      break;
    case 'to39':
      Object.assign(out, { E: [-2.54, 0], B: [0, 2.54], C: [2.54, 0] });
      break;
    case 'to126':
      Object.assign(out, { E: [-2.29, 0], C: [0, 0], B: [2.29, 0] });
      break;
    case 'radial':
      out['+'] = [-pkg.pitch / 2, 0];
      out['-'] = [pkg.pitch / 2, 0];
      break;
    case 'ceramic':
      out[1] = [-2.5, 0];
      out[2] = [2.5, 0];
      break;
    case 'led':
      out.A = [-1.27, 0];
      out.K = [1.27, 0];
      break;
    case 'pot':
      Object.assign(out, { 1: [-5, -2.5], 2: [0, -2.5], 3: [5, -2.5] });
      break;
    case 'toggle':
      if (pkg.poles === 3) Object.assign(out, { 1: [-4.7, 0], C: [0, 0], 2: [4.7, 0] });
      else Object.assign(out, { 1: [-2.35, 0], 2: [2.35, 0] });
      break;
    case 'bridge':
      Object.assign(out, { '~1': [-7.5, 0], '+': [-2.5, 0], '-': [2.5, 0], '~2': [7.5, 0] });
      break;
    case 'triac':
      Object.assign(out, { MT1: [-5.5, -2], G: [5.5, -2], MT2: [0, 0] });
      break;
    case 'xfmrSmall':
      Object.assign(out, { P1: [-5, -3.5], P2: [-5, 3.5], S1: [5, -3.5], S2: [5, 3.5] });
      break;
    case 'xfmrPower':
      Object.assign(out, { S1: [-17, -8], S2: [-17, 8], P1: [17, -8], P2: [17, 8] });
      break;
    case 'terminal':
      for (let k = 1; k <= pkg.pins; k += 1) out[k] = [(k - 1 - (pkg.pins - 1) / 2) * 5.08, 0];
      break;
    case 'jack':
      Object.assign(out, { 1: [0, -3], 2: [0, 3] });
      break;
  }
  return out;
}

/** Board position of a part's pin. */
export function pinAt(part: Part, pin: string): [number, number] {
  const p = packagePins(part.pkg)[pin];
  if (!p) throw new Error(`${part.ref} has no pin ${pin}`);
  const a = (part.rot * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return [part.x + p[0] * c - p[1] * s, part.y + p[0] * s + p[1] * c];
}

export type Net = {
  name: string;
  /** Pins, "REF.pin"; the first is where the current comes from (the copper's flow runs away from it). */
  pins: string[];
  /** Copper width, mm. */
  width: number;
  /** GND is not routed: it is the copper pour on both layers. */
  pour?: boolean;
};

const nets: Net[] = [];
const net = (name: string, pins: string[], width = 0.6) => nets.push({ name, pins, width });

// Power.
const vccPins = [
  'VT11.E', 'C3.+', 'DD1.16', 'DD1.2', 'DD1.10', 'DD2.14', 'DD3.16', 'DD3.2', 'DD3.10', 'DD4.16', 'DD4.2', 'DD5.14',
  'DD6.24', 'DD6.22', 'R10.2', 'R2.1', 'R3.2', 'R9.2',
];
for (let k = 0; k < 8; k += 1) vccPins.push(`R${11 + k}.2`, `VT${3 + k}.E`, `VS${k + 1}.MT1`);
vccPins.push('X2.1', 'SB5.1');
net('VCC', vccPins, 1.0);
const gndPins = [
  'C3.-', 'C4.-', 'VD2.-', 'VD1.1', 'DD1.8', 'DD1.7', 'DD1.15', 'DD2.7', 'DD3.8', 'DD3.7', 'DD3.15', 'DD4.8', 'DD4.7',
  'DD4.9', 'DD4.10', 'DD4.15', 'DD5.7', 'DD6.12', 'DD6.20', 'DD6.21', 'DD6.23', 'VT1.E', 'T1.S2', 'X1.2', 'T1.P2',
  'C1.-', 'R6.2', 'C2.2', 'SB3.2',
];
for (let k = 0; k < 8; k += 1) gndPins.push(`HL${k + 1}.K`);
nets.push({ name: 'GND', pins: gndPins, width: 1.0, pour: true });
net('VRAW', ['VD2.+', 'C4.+', 'VT11.C', 'R35.1'], 1.2);
net('VT11B', ['R35.2', 'VT11.B', 'VD1.2'], 0.6);
net('T2S1', ['T2.S1', 'VD2.~1'], 1.2);
net('T2S2', ['T2.S2', 'VD2.~2'], 1.2);
net('T2P', ['SB5.2', 'T2.P1'], 1.6);
net('MAINS_N', ['X2.2', 'T2.P2'], 1.6);
// Input.
net('IN1', ['X1.1', 'T1.P1']);
net('T1S', ['T1.S1', 'R1.1']);
net('VT1B', ['R2.2', 'R1.2', 'VT1.B']);
net('VT1C', ['R3.1', 'VT1.C', 'DD1.1']);
net('DD1Q4A', ['DD1.6', 'DD1.9']);
net('DIV1', ['DD1.11', 'SB1.1']);
net('DIV8', ['DD1.14', 'SB1.2']);
net('SB1C', ['SB1.C', 'SB2.1']);
// Generator.
net('OSC_TOP', ['DD2.6', 'DD2.9', 'DD2.10', 'DD2.12', 'R7.2', 'R4.3', 'R4.2']);
net('OSC_A', ['R4.1', 'R5.2']);
net('VT2B', ['R5.1', 'C1.+', 'VT2.B']);
net('VT2C', ['VT2.C', 'DD2.1', 'DD2.2']);
net('VT2E', ['VT2.E', 'R6.1', 'R7.1']);
net('DD2_3', ['DD2.3', 'DD2.4', 'DD2.5']);
net('DD2_8', ['DD2.8', 'R8.1']);
net('DD2_13', ['R8.2', 'C2.1', 'DD2.13']);
net('GEN', ['DD2.11', 'R9.1', 'SB2.2']);
net('CLK', ['SB2.C', 'DD3.1']);
// Step counter DD3.1 → A0–A3 (and DD5.1), the carries, DD4.1 → DD5.2, DD3.2 → A4–A7.
net('A0', ['DD3.3', 'DD6.8', 'DD5.2']);
net('A1', ['DD3.4', 'DD6.7', 'DD5.3']);
net('A2', ['DD3.5', 'DD6.6', 'DD5.4']);
net('A3', ['DD3.6', 'DD6.5', 'DD5.5']);
net('CARRY1', ['DD5.1', 'SB3.1', 'SB4.2']);
net('SB3C', ['SB3.C', 'DD4.1']);
net('RQ1', ['DD4.3', 'DD5.9']);
net('RQ2', ['DD4.4', 'DD5.10']);
net('RQ3', ['DD4.5', 'DD5.11']);
net('RQ4', ['DD4.6', 'DD5.12']);
net('CARRY2', ['DD5.13', 'SB4.1']);
net('PCLK', ['SB4.C', 'DD3.9']);
net('A4', ['DD3.11', 'DD6.4']);
net('A5', ['DD3.12', 'DD6.3']);
net('A6', ['DD3.13', 'DD6.2']);
net('A7', ['DD3.14', 'DD6.1']);
net('CS12', ['R10.1', 'DD6.18', 'DD6.19']);
// PROM outputs → channels.
const Q_PINS = [9, 10, 11, 13, 14, 15, 16, 17];
for (let k = 0; k < 8; k += 1) {
  net(`Q${k + 1}`, [`R${19 + k}.2`, `DD6.${Q_PINS[k]}`]);
  net(`B${k + 1}`, [`R${11 + k}.1`, `R${19 + k}.1`, `VT${3 + k}.B`]);
  net(`COL${k + 1}`, [`VT${3 + k}.C`, `R${27 + k}.2`, `VS${k + 1}.G`], 0.6);
  net(`LED${k + 1}`, [`R${27 + k}.1`, `HL${k + 1}.A`]);
  net(`LAMP${k + 1}`, [`VS${k + 1}.MT2`, `X3.${k + 1}`], 1.6);
}

export const NETS: readonly Net[] = nets;

export function partByRef(ref: string): Part {
  const p = PARTS.find((q) => q.ref === ref);
  if (!p) throw new Error(`no part ${ref}`);
  return p;
}
