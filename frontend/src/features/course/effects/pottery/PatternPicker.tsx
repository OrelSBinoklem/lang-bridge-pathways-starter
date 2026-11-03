'use client';

import { useEffect, useRef } from 'react';
import { drawPattern, PALETTES, PATTERNS, type PatternKind, type PatternOptions } from './model';
import styles from './pottery.module.css';

function Preview({ palette, pattern, seed, options }: { palette: number; pattern: PatternKind; seed: number; options: PatternOptions }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) drawPattern(ref.current, seed, palette, pattern, options); }, [palette, pattern, seed, options]);
  return <canvas ref={ref} width={128} height={128} aria-hidden="true" />;
}

const CONTROLS = [
  { key: 'scale', ru: 'Масштаб мотивов', uk: 'Масштаб мотивів', min: .6, max: 1.8, step: .05 },
  { key: 'petals', ru: 'Симметрия / детали', uk: 'Симетрія / деталі', min: 4, max: 20, step: 1 },
  { key: 'rotation', ru: 'Поворот', uk: 'Поворот', min: -90, max: 90, step: 5 },
  { key: 'stroke', ru: 'Толщина линий', uk: 'Товщина ліній', min: .4, max: 2, step: .1 },
  { key: 'border', ru: 'Кайма', uk: 'Облямівка', min: 0, max: 2, step: .1 },
] as const;

export default function PatternPicker({ uk, palette, pattern, seed, painted, options, onOptions, onSelect, onRandom, onClose }: {
  uk: boolean; palette: number; pattern: PatternKind; seed: number; painted: boolean; options: PatternOptions;
  onOptions: (options: PatternOptions) => void;
  onSelect: (palette: number, pattern: PatternKind) => void; onRandom: () => void; onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const title = uk ? 'Розпис кераміки' : 'Роспись керамики';
  return <div ref={root} className={styles.picker} role="dialog" aria-label={title} data-pattern-picker="" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('button,input,summary') ?? []).filter(el => el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    event.stopPropagation();
  }}>
    <div className={styles.pickerHeader}><strong>{title}</strong><button type="button" onClick={onClose} aria-label={uk ? 'Закрити розпис' : 'Закрыть роспись'}><i className="pi pi-times" aria-hidden="true" /></button></div>
    <div className={styles.pickerScroll}>
      <div className={styles.paletteChoices} role="group" aria-label={uk ? 'Палітра' : 'Палитра'}>{PALETTES.map((p,i)=><button key={p.ru} type="button" title={uk?p.uk:p.ru} aria-label={uk?p.uk:p.ru} aria-pressed={palette===i} onClick={()=>onSelect(i,pattern)}>{p.colors.map(color=><span key={color} style={{background:color}} />)}</button>)}</div>
      <div className={styles.patternChoices} role="group" aria-label={uk ? 'Візерунок' : 'Узор'}>{PATTERNS.map(kind=><button key={kind.id} type="button" aria-pressed={painted&&pattern===kind.id} onClick={()=>onSelect(palette,kind.id)}><Preview palette={palette} pattern={kind.id} seed={seed} options={options} /><span>{uk?kind.uk:kind.ru}</span></button>)}</div>
      <details className={styles.patternSettings}><summary>{uk?'Налаштувати візерунок':'Настроить узор'}</summary><div className={styles.shapeGrid}>{CONTROLS.filter(control=>control.key!=='petals'||pattern!=='ikat').map(({key,ru,uk:ua,min,max,step})=><label key={key}><span>{uk?ua:ru}<span>{options[key]}</span></span><input type="range" min={min} max={max} step={step} value={options[key]} onChange={event=>onOptions({...options,[key]:Number(event.target.value)})} /></label>)}</div></details>
    </div>
    <div className={styles.pickerFooter}><button type="button" onClick={onRandom}><i className="pi pi-sparkles" aria-hidden="true" />{uk ? 'Нові варіації' : 'Новые вариации'}</button><button type="button" className={styles.generate} onClick={onClose}>Готово</button></div>
  </div>;
}
