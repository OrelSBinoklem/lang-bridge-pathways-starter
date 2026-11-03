'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ENGLISH_TABLES } from '@/features/english-grammar/catalog';
import { EnglishGrammarTable } from '@/features/english-grammar/EnglishGrammarTable';
import tableStyles from '@/features/english-grammar/english-tables.module.css';
import { tentacle, touchPoint, unionRect, type Pt } from './tentacle';
import { OCTO_VOICES, OctoVoice, octoText, type OctoLine } from './octoVoice';
import styles from './table-bot.module.css';
import { OctopusFace } from './OctopusFace';

/**
 * Visual demo of the multi-table tutor action (`grammar_lesson_present`): an octopus pulls several real grammar
 * tables off the shelf onto one workbench and points at several areas at once, one tentacle and colour each.
 * Nothing is connected to the tutor; the scenarios are hard-coded.
 */
const SHELF = ['en-be', 'en-present-simple', 'en-questions', 'en-past-simple', 'en-there-and-it', 'en-articles-noun-phrase', 'en-future-plans', 'en-present-simple-continuous'];
const COLORS = ['#ff4f7b', '#2f9bff', '#22b573', '#ff9f1a', '#9b5cff', '#10bfc4', '#ff6b3d', '#c7458f'];
const TENTACLES = 8;
type Mark = { table: string; selector: string; label: string };
/** The scenario id is also the key of its spoken line (resources/table-bot/octopus-lines.json). */
type Scenario = { id: OctoLine; title: string; tables: string[]; marks: Mark[]; link?: boolean };
const SCENARIOS: Scenario[] = [
  {
    id: 'negative', title: 'Отрицание в трёх таблицах', link: true,
    tables: ['en-be', 'en-present-simple', 'en-past-simple'],
    marks: [
      { table: 'en-be', selector: '.tt-grid-col-negative', label: 'be + not' },
      { table: 'en-present-simple', selector: '.tt-grid-col-negative', label: 'do / does not + V1' },
      { table: 'en-past-simple', selector: '.tt-grid-col-negative', label: 'did not + V1' },
      { table: 'en-present-simple', selector: '.tt-grid-summary', label: 'правило' },
    ],
  },
  {
    id: 'question', title: 'Вопрос в четырёх таблицах', link: true,
    tables: ['en-questions', 'en-be', 'en-present-simple', 'en-there-and-it'],
    marks: [
      { table: 'en-questions', selector: '.tt-grid-col-yes-no', label: 'да / нет' },
      { table: 'en-be', selector: '.tt-grid-col-question', label: 'Am / Is / Are…?' },
      { table: 'en-present-simple', selector: '.tt-grid-col-question', label: 'Do / Does…?' },
      { table: 'en-there-and-it', selector: '.tt-grid-col-question', label: 'Is there…?' },
    ],
  },
  {
    id: 'third', title: 'he / she / it: строки',
    tables: ['en-be', 'en-present-simple'],
    marks: [
      { table: 'en-be', selector: '.tt-grid-row-present-singular', label: 'he / she / it is' },
      { table: 'en-present-simple', selector: '.tt-grid-row-work-third-person', label: 'works' },
      { table: 'en-present-simple', selector: '.tt-grid-row-have-third-person', label: 'has' },
      { table: 'en-present-simple', selector: '.tt-grid-row-study-third-person', label: 'studies' },
      { table: 'en-present-simple', selector: '.tt-grid-row-watch-third-person', label: 'watches' },
    ],
  },
  {
    id: 'six', title: 'Шесть областей сразу', link: true,
    tables: ['en-be', 'en-past-simple', 'en-there-and-it'],
    marks: [
      { table: 'en-be', selector: '.tt-grid-col-affirmative', label: 'утверждение' },
      { table: 'en-be', selector: '.tt-grid-row-past-singular', label: 'was' },
      { table: 'en-past-simple', selector: '.tt-grid-row-irregular-action', label: 'неправильный глагол' },
      { table: 'en-past-simple', selector: '.tt-grid-col-question', label: 'Did…?' },
      { table: 'en-there-and-it', selector: '.tt-grid-row-weather', label: 'погода: it' },
      { table: 'en-there-and-it', selector: '.tt-grid-row-several-items', label: 'there are' },
    ],
  },
];

/** How each candidate voice comes across (owner's casting notes, resources/course/voice-previews/). */
const VOICE_NOTES: Record<string, string> = { Algenib: 'с игринкой', Puck: 'болтливый', Rasalgethi: 'учитель', Autonoe: 'женский' };
const byId = new Map(ENGLISH_TABLES.map(t => [t.id, t]));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
type Tentacle = { tip: Pt; target: (() => Pt | null) | null; color: string | null };
type ActiveMark = Mark & { color: string; tentacle: number };
type Mood = 'idle' | 'busy' | 'happy' | 'talk';

export function TableBotLab() {
  const [bench, setBench] = useState<string[]>([]);
  const [marks, setMarks] = useState<ActiveMark[]>([]);
  const [links, setLinks] = useState(false);
  const [mood, setMood] = useState<Mood>('idle');
  const [speech, setSpeech] = useState(() => octoText('hello'));
  const [busy, setBusy] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(OCTO_VOICES[0]);
  const [underWater, setUnderWater] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voice] = useState(() => new OctoVoice(setSpeaking));
  useEffect(() => () => voice.dispose(), [voice]);
  /** Shows the line in the bubble and says it in the chosen voice. */
  const talk = (key: OctoLine, name = voiceName, water = underWater) => { setSpeech(octoText(key)); void voice.say(key, name, water); };
  const [picked, setPicked] = useState<string[]>([]);
  const [benchWidth, setBenchWidth] = useState(1100);
  const [viewHeight, setViewHeight] = useState(900);
  const benchRef = useRef<HTMLElement>(null);
  const shelfRef = useRef<HTMLElement>(null);
  const shelfRefs = useRef(new Map<string, HTMLElement>());
  const benchRefs = useRef(new Map<string, HTMLElement>());
  const bodyRef = useRef<HTMLDivElement>(null);
  const pupils = useRef<SVGGElement>(null);
  const armPaths = useRef<(SVGPathElement | null)[]>([]);
  const cupPaths = useRef<(SVGPathElement | null)[]>([]);
  const tipRings = useRef<(SVGCircleElement | null)[]>([]);
  const markRefs = useRef<(SVGGElement | null)[]>([]);
  const linkRef = useRef<SVGPathElement>(null);
  const arms = useRef<Tentacle[]>(Array.from({ length: TENTACLES }, () => ({ tip: { x: -1, y: -1 }, target: null, color: null })));
  const marksRef = useRef<ActiveMark[]>([]);
  const linksRef = useRef(false);
  useEffect(() => { marksRef.current = marks; linksRef.current = links; }, [marks, links]);

  useEffect(() => {
    const el = benchRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { setBenchWidth(e.contentRect.width); setViewHeight(innerHeight); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Up to three tables in a row, four as two by two; the zoom fits them into the bench width and, below the
  // shelf, into the window height (a table is roughly 560 px tall at full size).
  const perRow = bench.length <= 3 ? Math.max(1, bench.length) : 2, rows = Math.ceil(Math.max(1, bench.length) / perRow);
  const zoom = Math.min(0.8, Math.max(0.3, Math.min((benchWidth - (perRow - 1) * 26) / (perRow * 620), (viewHeight - 300 - (rows - 1) * 26) / (rows * 560))));

  // One animation loop moves every tentacle, highlight box and link; React only changes the cast.
  useEffect(() => {
    let raf = 0, last = performance.now();
    const markRect = (m: ActiveMark) => {
      const card = benchRefs.current.get(m.table);
      return card ? unionRect(Array.from(card.querySelectorAll(m.selector), el => el.getBoundingClientRect())) : null;
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
      const body = bodyRef.current?.getBoundingClientRect();
      if (!body) return;
      const cx = body.left + body.width / 2, cy = body.top + body.height * 0.62;
      let look: Pt | null = null;
      arms.current.forEach((arm, i) => {
        const a = Math.PI * (0.12 + (0.76 * i) / (TENTACLES - 1));
        const base = { x: cx - Math.cos(a) * body.width * 0.3, y: cy + Math.sin(a) * body.height * 0.1 };
        const side = i < TENTACLES / 2 ? -1 : 1, k = Math.abs(i - (TENTACLES - 1) / 2);
        const rest = { x: base.x + side * (18 + k * 16) + Math.sin(t * 1.3 + i) * 8, y: base.y + 46 + Math.cos(t * 1.1 + i * 1.7) * 10 - k * 4 };
        const goal = arm.target?.() ?? rest;
        if (arm.target) look = goal;
        if (arm.tip.x < 0) arm.tip = { ...rest };
        const ease = 1 - Math.exp(-(arm.target ? 7 : 5) * dt);
        arm.tip = { x: arm.tip.x + (goal.x - arm.tip.x) * ease, y: arm.tip.y + (goal.y - arm.tip.y) * ease };
        const g = tentacle(base, arm.tip, t, i, 17 - k * 0.8, 3.2);
        armPaths.current[i]?.setAttribute('d', g.d);
        cupPaths.current[i]?.setAttribute('d', g.cups);
        const ring = tipRings.current[i];
        if (ring) {
          ring.setAttribute('cx', arm.tip.x.toFixed(1)); ring.setAttribute('cy', arm.tip.y.toFixed(1));
          ring.setAttribute('r', (7 + Math.sin(t * 6 + i) * 2).toFixed(1));
          ring.style.opacity = arm.color ? '1' : '0'; if (arm.color) ring.setAttribute('stroke', arm.color);
        }
      });
      // Highlight boxes and the chain linking them in order.
      const centers: Pt[] = [];
      marksRef.current.forEach((m, i) => {
        const g = markRefs.current[i], r = markRect(m);
        if (!g || !r) return;
        const pad = 4, box = g.firstElementChild as SVGRectElement, badge = g.children[1] as SVGGElement;
        box.setAttribute('x', String(r.left - pad)); box.setAttribute('y', String(r.top - pad));
        box.setAttribute('width', String(r.right - r.left + pad * 2)); box.setAttribute('height', String(r.bottom - r.top + pad * 2));
        badge.setAttribute('transform', `translate(${r.left - pad} ${r.top - pad})`);
        centers.push({ x: (r.left + r.right) / 2, y: r.top - pad });
      });
      if (linkRef.current) {
        linkRef.current.setAttribute('d', linksRef.current && centers.length > 1
          ? centers.map((p, i) => i ? `Q${((centers[i - 1].x + p.x) / 2).toFixed(1)} ${(Math.min(centers[i - 1].y, p.y) - 60).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') : '');
      }
      // Pupils follow the busiest tentacle, else the cursor-free centre of the bench.
      const l = look as Pt | null;
      if (pupils.current) {
        const dx = l ? Math.max(-1, Math.min(1, (l.x - cx) / 500)) : Math.sin(t * 0.5) * 0.3;
        const dy = l ? Math.max(-1, Math.min(1, (l.y - cy) / 400)) : 0.2;
        pupils.current.setAttribute('transform', `translate(${(dx * 5).toFixed(2)} ${(dy * 5).toFixed(2)})`);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rectOf = (el: HTMLElement | undefined) => el?.getBoundingClientRect();
  const topOf = (el: HTMLElement | undefined): Pt | null => { const r = rectOf(el); return r ? { x: r.left + r.width / 2, y: r.top + 10 } : null; };
  const body = () => { const r = bodyRef.current!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  /** Tentacles are handed out by the horizontal position of their job, so they do not cross. */
  const order = (count: number) => Array.from({ length: count }, (_, i) => Math.round(count === 1 ? 4 : (i * (TENTACLES - 1)) / Math.max(1, count - 1)));

  const fly = (el: HTMLElement, from: DOMRect, ms: number) => {
    const to = el.getBoundingClientRect();
    el.style.transformOrigin = '0 0';
    return el.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` }, { transform: 'none' }], { duration: ms, easing: 'cubic-bezier(.3,.75,.2,1)' }).finished;
  };

  const grab = async (arm: number, id: string, delay: number) => {
    await sleep(delay);
    const shelf = shelfRefs.current.get(id);
    arms.current[arm].target = () => topOf(shelf);
    await sleep(520);
    const from = shelf!.getBoundingClientRect();
    flushSync(() => setBench(b => (b.includes(id) ? b : [...b, id])));
    const card = benchRefs.current.get(id)!;
    arms.current[arm].target = () => topOf(card);
    await fly(card, from, 820);
    arms.current[arm].target = null;
  };

  const clear = async () => {
    flushSync(() => { setMarks([]); setLinks(false); });
    arms.current.forEach(a => { a.target = null; a.color = null; });
    const ids = [...benchRefs.current.keys()].filter(id => document.body.contains(benchRefs.current.get(id)!));
    if (!ids.length) return;
    const from = new Map(ids.map(id => [id, benchRefs.current.get(id)!.getBoundingClientRect()]));
    const slots = order(ids.length);
    ids.forEach((id, i) => { arms.current[slots[i]].target = () => topOf(benchRefs.current.get(id) ?? shelfRefs.current.get(id)); });
    await sleep(380);
    flushSync(() => setBench([]));
    await Promise.all(ids.map((id, i) => { const el = shelfRefs.current.get(id)!; arms.current[slots[i]].target = () => topOf(el); return fly(el, from.get(id)!, 700); }));
    arms.current.forEach(a => { a.target = null; });
  };

  const present = async (tables: string[], list: Mark[], line: OctoLine, link = false) => {
    if (busy) return;
    voice.unlock();
    setBusy(true); setMood('busy');
    const top = (shelfRef.current?.getBoundingClientRect().top ?? 0) + scrollY - 84;
    if (Math.abs(top - scrollY) > 20) { window.scrollTo({ top, behavior: 'smooth' }); await sleep(450); }
    await clear();
    talk(line); setMood('talk');
    const slots = order(tables.length);
    await Promise.all(tables.map((id, i) => grab(slots[i], id, i * 170)));
    await sleep(250);
    // One tentacle per area; sorted left to right so they fan out without crossing.
    const placed = list.map((m, i) => ({ ...m, color: COLORS[i % COLORS.length], x: rectOf(benchRefs.current.get(m.table))?.left ?? 0, i }))
      .sort((a, b) => a.x - b.x || a.i - b.i);
    const armFor = order(placed.length);
    for (const [k, m] of placed.entries()) {
      const mark: ActiveMark = { table: m.table, selector: m.selector, label: m.label, color: m.color, tentacle: armFor[k] };
      flushSync(() => setMarks(prev => [...prev, mark]));
      const arm = arms.current[armFor[k]];
      arm.color = m.color;
      arm.target = () => {
        const card = benchRefs.current.get(m.table);
        const r = card && unionRect(Array.from(card.querySelectorAll(m.selector), el => el.getBoundingClientRect()));
        return r ? touchPoint(r, body()) : null;
      };
      await sleep(430);
    }
    if (link) setLinks(true);
    setMood('happy'); setBusy(false);
  };

  const shelfTables = SHELF.map(id => byId.get(id)!).filter(Boolean);
  return <div className={styles.page}>
    <header className={styles.head}>
      <h1>Бот-табличник: осьминог</h1>
      <p>Визуальный пример общего действия бота «показать несколько таблиц и выделить несколько областей». Таблицы настоящие, с полки английской грамматики; к боту ничего не подключено.</p>
      <div className={styles.controls}>
        {SCENARIOS.map(s => <button key={s.id} type="button" disabled={busy} onClick={() => void present(s.tables, s.marks, s.id, s.link)}>{s.title}</button>)}
        <button type="button" disabled={busy || picked.length === 0} onClick={() => void present(picked, picked.map(id => ({ table: id, selector: '.tt-grid', label: byId.get(id)?.grid?.title ?? id })), 'picked').then(() => setPicked([]))}>Собрать выбранные ({picked.length})</button>
        <button type="button" disabled={busy} onClick={() => { voice.unlock(); setBusy(true); setMood('busy'); void clear().then(() => { talk('shelf'); setMood('idle'); setBusy(false); }); }}>Вернуть на полку</button>
      </div>
      <div className={styles.controls} role="group" aria-label="Голос осьминога">
        <span className={styles.controlsLabel}>Голос:</span>
        {[...OCTO_VOICES.map(v => [v, `${v} · ${VOICE_NOTES[v] ?? ''}`] as const), [null, 'Без голоса'] as const].map(([v, label]) =>
          <button key={v ?? 'none'} type="button" aria-pressed={voiceName === v} onClick={() => { voice.unlock(); setVoiceName(v); if (v) talk('hello', v); else voice.stop(); }}>{label}</button>)}
        <button type="button" aria-pressed={underWater} disabled={!voiceName} onClick={() => { voice.unlock(); setUnderWater(!underWater); talk('hello', voiceName, !underWater); }}>Под водой</button>
      </div>
    </header>

    <section ref={shelfRef} className={styles.shelf} aria-label="Полка таблиц">
      {shelfTables.map(table => {
        const away = bench.includes(table.id), sel = picked.includes(table.id);
        const toggle = () => { if (!busy && !away) setPicked(p => (p.includes(table.id) ? p.filter(x => x !== table.id) : [...p, table.id])); };
        return <div role="button" tabIndex={away ? -1 : 0} aria-pressed={sel} key={table.id} className={styles.slot} data-away={away} data-picked={sel}
          onClick={toggle} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
          ref={el => { if (el) shelfRefs.current.set(table.id, el); }}>
          <span className={styles.slotTitle}>{table.grid?.title ?? table.title}</span>
          {!away && <div className={styles.thumb} aria-hidden="true" inert><div className={`${tableStyles.page} ${tableStyles.courseEmbed}`}><EnglishGrammarTable table={table} tables={ENGLISH_TABLES} withinGallery /></div></div>}
        </div>;
      })}
    </section>

    <section ref={benchRef} className={styles.bench} aria-label="Рабочий стол" data-count={bench.length}>
      {bench.length === 0 && <p className={styles.benchEmpty}>Рабочий стол пуст — осьминог положит сюда таблицы.</p>}
      {bench.map(id => {
        const table = byId.get(id)!;
        return <div key={id} className={styles.card} ref={el => { if (el) benchRefs.current.set(id, el); else benchRefs.current.delete(id); }}>
          <div className={styles.cardZoom} style={{ zoom }}><div className={`${tableStyles.page} ${tableStyles.courseEmbed}`}><EnglishGrammarTable table={table} tables={ENGLISH_TABLES} withinGallery /></div></div>
        </div>;
      })}
    </section>

    <svg className={styles.overlay} aria-hidden="true">
      <path ref={linkRef} className={styles.link} />
      {marks.map((m, i) => <g key={`${m.table}${m.selector}`} ref={el => { markRefs.current[i] = el; }} className={styles.mark} style={{ ['--c' as string]: m.color }}>
        <rect rx="8" />
        <g><circle cx="0" cy="0" r="13" /><text x="0" y="5">{i + 1}</text><text className={styles.markLabel} x="18" y="-6">{m.label}</text></g>
      </g>)}
      {Array.from({ length: TENTACLES }, (_, i) => <g key={i}>
        <path ref={el => { armPaths.current[i] = el; }} className={styles.arm} />
        <path ref={el => { cupPaths.current[i] = el; }} className={styles.cups} />
        <circle ref={el => { tipRings.current[i] = el; }} className={styles.tipRing} />
      </g>)}
    </svg>

    <div className={styles.octopus} data-mood={mood} data-speaking={speaking}>
      <div className={styles.bubble}>{speech}</div>
      <div ref={bodyRef} className={styles.body}>
        <OctopusFace pupils={pupils} />
      </div>
    </div>
  </div>;
}
