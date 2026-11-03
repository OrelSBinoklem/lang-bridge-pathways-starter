import { ROM } from './rom';

/**
 * The automaton, simulated edge by edge, at the level of its schematic (Радиохобби 6/98, рис. 1):
 *
 *   clock  — the generator DD2.1–DD2.4 + VT2 (rate set by R4), or the input: the signal through T1/VT1 counted by
 *            DD1.1 → DD1.2 (÷16 · ÷16, SB1 takes Q1 or Q4 of DD1.2, i.e. ÷32 or ÷256); SB2 picks one of them;
 *   DD3.1  — counts the clock: the step A0–A3;
 *   DD5.1  — NAND of the step: rises when the step wraps 15 → 0 (the end of a program's 16 steps);
 *   DD4.1  — counts those wraps (SB3 in «1»); DD5.2 rises when it wraps too (16 repetitions done);
 *   DD3.2  — the program A4–A7, clocked by DD5.2 (SB4 in «1», after 16 repetitions) or straight by DD5.1 (SB4 in «2»,
 *            the quick search); SB3 in «2» stops both, holding one program;
 *   DD6    — the PROM: Q1–Q8 = ROM[program·16 + step]; a 0 opens VT3–VT10: LED HL1–HL8 and triac VS1–VS8 (lamp).
 *
 * Besides the logic it gives every net of the board a level (volts) and a current (amperes, signed along the net's
 * pin order), for lighting up the copper.
 */

export type Switches = {
  /** SB1: which output of the input divider DD1.2 — 0: Q1 (÷32), 1: Q4 (÷256). */
  sb1: 0 | 1;
  /** SB2: clock source — the generator or the input (tape recorder, receiver). */
  sb2: 'gen' | 'input';
  /** SB3: 1 — programs change by themselves, 2 — one program repeats. */
  sb3: 1 | 2;
  /** SB4: 1 — next program after 16 repetitions, 2 — right after one (quick search). */
  sb4: 1 | 2;
  /** SB5: mains. */
  sb5: boolean;
};

export type NetState = { v: number; i: number; ac?: boolean };

export type MachineEvents = { clocks: number; wraps: number; programChanged: boolean };

export function createMachine() {
  const sw: Switches = { sb1: 0, sb2: 'gen', sb3: 1, sb4: 1, sb5: true };
  let rate = 0.35;
  let step = 0;
  let repeat = 0;
  let program = 0;
  let divider = 0;
  let genPhase = 0;
  let audioTime = 0;
  let clockLevel = 0;
  let clockFlash = 0;
  let carryFlash = 0;
  let programFlash = 0;
  let ns: Record<string, NetState> = {};

  /** Generator rate for R4 in 0..1 (the pot's travel): about 0.7 … 25 steps a second, exponential like the RC. */
  const genHz = () => 0.7 * Math.pow(36, rate);

  const clockOnce = (ev: MachineEvents) => {
    ev.clocks += 1;
    clockFlash = 1;
    const was = step;
    step = (step + 1) & 15;
    if (was === 15 && step === 0 && sw.sb3 === 1) {
      ev.wraps += 1;
      carryFlash = 1;
      const rep = repeat;
      repeat = (repeat + 1) & 15;
      const carry2 = rep === 15 && repeat === 0;
      if (sw.sb4 === 2 || carry2) {
        program = (program + 1) & 15;
        ev.programChanged = true;
        programFlash = 1;
      }
    }
  };

  /** A made-up piece of music: a beat, louder and quieter bars; while it is loud VT1 switches at the tone's pitch. */
  const audioPulses = (dt: number) => {
    audioTime += dt;
    const t = audioTime;
    const beat = (t * 2.1) % 1;
    const bar = 0.55 + 0.45 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1);
    const env = Math.max(0, 1 - beat * 3.2) * bar + 0.25 * Math.max(0, Math.sin(t * 13.7)) * bar;
    const pitch = 220 + 180 * Math.sin(t * 0.9) + 120 * Math.sin(t * 2.3);
    return env > 0.35 ? pitch * dt : 0;
  };

  const update = (dt: number): MachineEvents => {
    const ev: MachineEvents = { clocks: 0, wraps: 0, programChanged: false };
    clockFlash = Math.max(0, clockFlash - dt * 6);
    carryFlash = Math.max(0, carryFlash - dt * 3);
    programFlash = Math.max(0, programFlash - dt * 1.5);
    if (!sw.sb5) {
      clockLevel = 0;
      computeNets();
      return ev;
    }
    if (sw.sb2 === 'gen') {
      genPhase += genHz() * dt;
      while (genPhase >= 1) {
        genPhase -= 1;
        clockOnce(ev);
      }
      clockLevel = genPhase < 0.5 ? 1 : 0;
    } else {
      // DD1 as one 8-bit counter; its bit 4 (Q1 of DD1.2) or bit 7 (Q4) clocks DD3.1 on every rise.
      const bit = sw.sb1 === 0 ? 4 : 7;
      const before = divider;
      divider += audioPulses(dt);
      const period = 2 ** (bit + 1);
      const rises = Math.floor((divider - 2 ** bit) / period) - Math.floor((before - 2 ** bit) / period);
      for (let k = 0; k < rises; k += 1) clockOnce(ev);
      clockLevel = Math.floor(divider / 2 ** bit) & 1;
      if (divider > 1e6) divider -= 1e6 - (1e6 % period);
    }
    computeNets();
    return ev;
  };

  /** Levels and currents of the nets named in layout.ts. */
  const computeNets = () => {
    const on = sw.sb5;
    const V = on ? 5 : 0;
    const out: Record<string, NetState> = {};
    const set = (name: string, v: number, i = 0, ac = false) => {
      out[name] = { v, i, ac };
    };
    const data = ROM[program * 16 + step];
    let supply = 0.006;
    for (let k = 0; k < 8; k += 1) {
      const lit = on && ((data >> k) & 1) === 0;
      // PROM output: low sinks the base current through R19+k; high is open, pulled up through R11+k/R19+k.
      set(`Q${k + 1}`, lit ? 0.35 : V, lit ? 0.0029 : 0);
      set(`B${k + 1}`, lit ? 4.3 : V, lit ? 0.0036 : 0);
      set(`COL${k + 1}`, lit ? 4.8 : 0, lit ? 0.03 : 0);
      set(`LED${k + 1}`, lit ? 1.9 : 0, lit ? 0.028 : 0);
      set(`LAMP${k + 1}`, lit ? 220 : 0, lit ? 0.11 : 0, true);
      if (lit) supply += 0.034;
    }
    const lamps = [...Array(8).keys()].filter((k) => on && ((data >> k) & 1) === 0).length;
    const address = program * 16 + step;
    for (let b = 0; b < 8; b += 1) set(`A${b}`, on && (address >> b) & 1 ? V : 0);
    for (let b = 0; b < 4; b += 1) set(`RQ${b + 1}`, on && (repeat >> b) & 1 ? V : 0);
    set('CLK', on ? clockLevel * V : 0, on ? clockFlash * 0.002 : 0);
    set('GEN', on && sw.sb2 === 'gen' ? clockLevel * V : on ? V : 0, 0);
    set('DIV1', on ? ((Math.floor(divider / 16) & 1) * V) : 0);
    set('DIV8', on ? ((Math.floor(divider / 128) & 1) * V) : 0);
    set('SB1C', on ? ((Math.floor(divider / (sw.sb1 === 0 ? 16 : 128)) & 1) * V) : 0);
    set('CARRY1', on && step !== 15 ? V : 0, on ? carryFlash * 0.002 : 0);
    set('CARRY2', on && repeat !== 15 ? V : 0);
    set('PCLK', on ? V : 0, on ? programFlash * 0.002 : 0);
    set('SB3C', on && sw.sb3 === 1 && step !== 15 ? V : 0);
    set('CS12', V, 0);
    set('VCC', V, on ? supply : 0);
    set('GND', 0, on ? supply : 0);
    set('VRAW', on ? 9.5 : 0, on ? supply + 0.004 : 0);
    set('VT11B', on ? 5.6 : 0, on ? 0.02 : 0);
    set('T2S1', on ? 9 : 0, on ? supply : 0, true);
    set('T2S2', on ? 9 : 0, on ? supply : 0, true);
    set('T2P', on ? 220 : 0, on ? 0.02 : 0, true);
    set('MAINS_N', on ? 220 : 0, on ? 0.11 * lamps + 0.02 : 0, true);
    set('MAINS_L', on ? 220 : 0, on ? 0.02 : 0, true);
    // The input and generator's inner nets: just "alive" when powered.
    for (const n of ['IN1', 'T1S', 'VT1B', 'VT1C', 'DD1Q4A', 'OSC_TOP', 'OSC_A', 'VT2B', 'VT2C', 'VT2E', 'DD2_3', 'DD2_8', 'DD2_13']) {
      set(n, on ? (n === 'OSC_TOP' || n === 'DD2_3' ? clockLevel * V : V * 0.6) : 0, 0);
    }
    ns = out;
  };
  computeNets();

  return {
    sw,
    get rate() {
      return rate;
    },
    set rate(v: number) {
      rate = Math.min(1, Math.max(0, v));
    },
    get genHz() {
      return genHz();
    },
    get step() {
      return step;
    },
    get repeat() {
      return repeat;
    },
    get program() {
      return program;
    },
    get divider() {
      return divider;
    },
    get address() {
      return program * 16 + step;
    },
    get data() {
      return ROM[program * 16 + step];
    },
    /** Lamp k (0..7) lit (a 0 in the cell, and mains on). */
    lit(k: number) {
      return sw.sb5 && ((ROM[program * 16 + step] >> k) & 1) === 0;
    },
    get clockFlash() {
      return clockFlash;
    },
    get carryFlash() {
      return carryFlash;
    },
    get programFlash() {
      return programFlash;
    },
    get nets() {
      return ns;
    },
    /** Jump straight to a cell (a click on the dump). */
    goto(address: number) {
      program = (address >> 4) & 15;
      step = address & 15;
      programFlash = 1;
      computeNets();
    },
    reset() {
      step = 0;
      repeat = 0;
      program = 0;
      divider = 0;
      computeNets();
    },
    update,
  };
}

export type Machine = ReturnType<typeof createMachine>;
