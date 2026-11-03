'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_VESSEL, DEFAULT_PATTERN_OPTIONS, VESSEL_PARAMETERS, randomPainting, randomVessel, type VesselParameters, type PatternKind, type PatternOptions } from './model';
import PatternPicker from './PatternPicker';
import type { PotterySettings } from './renderer';
import styles from './pottery.module.css';
import { useEffectHost } from '../EffectHost';

export default function PotteryEffect({ focused, uk, onClose }: { focused: boolean; uk: boolean; onClose: () => void }) {
  const host = useEffectHost();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [palette, setPalette] = useState(0);
  const [patterned, setPatterned] = useState(false);
  const [band, setBand] = useState(50);
  const [brush, setBrush] = useState(.38);
  const [softness, setSoftness] = useState(.65);
  const [stage, setStage] = useState<'clay' | 'paint'>('clay');
  const [pattern, setPattern] = useState<PatternKind>('mandala');
  const [seed, setSeed] = useState(317);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sculptMode, setSculptMode] = useState<'narrow' | 'widen'>('narrow');
  const [shape, setShape] = useState<VesselParameters>({ ...DEFAULT_VESSEL });
  const [patternOptions, setPatternOptions] = useState<PatternOptions>({ ...DEFAULT_PATTERN_OPTIONS });
  const [shapeOpen, setShapeOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const settings = useRef<PotterySettings>({ focused, paused: false, brush: .38, speed: 1.6, softness: .65, stage: 'clay', sculptMode: 'narrow', pattern: 'mandala', palette: 0, seed: 317, patterned: false, reset: 0, undo: 0, band: 50, adjustment: 0, shape: { ...DEFAULT_VESSEL }, shapeRevision: 0, shapeTransaction: 0, onShapeChange: setShape, patternOptions: { ...DEFAULT_PATTERN_OPTIONS } });
  useEffect(() => { settings.current.focused = focused; }, [focused]);
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import('./renderer').then(({ createPottery }) => {
      if (cancelled || !canvasRef.current) return;
      try { dispose = createPottery(canvasRef.current, settings.current); }
      catch (cause) { console.error('Pottery renderer initialization failed', cause); setError(true); }
    }).catch(cause => { console.error('Pottery renderer loading failed', cause); if (!cancelled) setError(true); });
    const canvas = canvasRef.current;
    const lost = (event: Event) => { event.preventDefault(); setError(true); };
    canvas?.addEventListener('webglcontextlost', lost);
    return () => { cancelled = true; dispose?.(); canvas?.removeEventListener('webglcontextlost', lost); };
  }, []);
  useEffect(() => {
    if (!focused) return;
    const previous = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button, select, input, summary') ?? []).filter(el => el.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [focused]);
  const label = (ru: string, ua: string) => uk ? ua : ru;
  useEffect(() => {
    if (!shapeOpen && !toolsOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLButtonElement>('[data-pottery-panel] button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [shapeOpen, toolsOpen]);
  const randomize = () => {
    const values = crypto.getRandomValues(new Uint32Array(6)), next = values[0];
    const options = { scale: .7 + (values[1] % 19) * .05, petals: 4 + (values[2] % 9) * 2, rotation: -45 + values[3] % 19 * 5, stroke: .6 + (values[4] % 10) * .1, border: (values[5] % 15) * .1 };
    settings.current.patternOptions = options; setPatternOptions(options);
    settings.current.seed = next; settings.current.patterned = true; setSeed(next); setPatterned(true);
  };
  // «Новый»: a new jug and a new painting for it (family, palette, seed and every pattern control).
  const paintAnew = () => {
    const next = randomPainting(crypto.getRandomValues(new Uint32Array(1))[0]);
    settings.current.pattern = next.kind; settings.current.palette = next.palette; settings.current.seed = next.seed;
    settings.current.patternOptions = next.options; settings.current.patterned = true;
    setPattern(next.kind); setPalette(next.palette); setSeed(next.seed); setPatternOptions(next.options); setPatterned(true);
  };
  const generate = (next: VesselParameters) => {
    settings.current.shape = next; settings.current.shapeRevision++; setShape(next);
  };
  return createPortal(<div ref={rootRef} className={`${styles.root} ${focused ? styles.focused : ''}`} role={focused ? 'dialog' : undefined} aria-modal={focused || undefined} aria-hidden={!focused || undefined} aria-label={label('Гончарная мастерская', 'Гончарна майстерня')} data-pottery="" onKeyDownCapture={event => {
    if (event.key === 'Escape' && (pickerOpen || shapeOpen || toolsOpen)) { event.preventDefault(); event.stopPropagation(); setPickerOpen(false); setShapeOpen(false); setToolsOpen(false); }
  }}>
    <canvas ref={canvasRef} className={styles.canvas} aria-label={label('Кувшин и стол керамиста', 'Глечик і стіл кераміста')} />
    {focused && <>
      <header className={styles.header}><span>{label('Гончарная мастерская', 'Гончарна майстерня')}<small>{label('Слева — образец росписи · справа — лепка кувшина', 'Ліворуч — зразок розпису · праворуч — ліплення глечика')}</small></span><button type="button" onClick={onClose} aria-label={label('Вернуться к курсу', 'Повернутися до курсу')}><i className="pi pi-times" aria-hidden="true" /></button></header>
      {shapeOpen && <section data-pottery-panel="" className={`${styles.picker} ${styles.shapePanel}`} aria-label={label('Форма кувшина', 'Форма глечика')}>
        <div className={styles.pickerHeader}><strong>{label('Форма кувшина', 'Форма глечика')}</strong><button type="button" onClick={()=>setShapeOpen(false)} aria-label={label('Закрыть форму', 'Закрити форму')}><i className="pi pi-times" aria-hidden="true" /></button></div>
        <div className={styles.pickerScroll}><div className={styles.shapeGrid}>{VESSEL_PARAMETERS.map(({key,ru,uk:ua,min,max})=><label key={key}><span>{label(ru,ua)}<span>{Math.round((shape[key]-min)/(max-min)*100)}%</span></span><input aria-label={label(ru,ua)} type="range" min={min} max={max} step="0.005" value={shape[key]} onPointerDown={()=>settings.current.shapeTransaction++} onKeyDown={()=>settings.current.shapeTransaction++} onChange={event=>generate({...settings.current.shape,[key]:Number(event.target.value)})} /></label>)}</div></div>
      </section>}
      {toolsOpen && <section data-pottery-panel="" className={`${styles.picker} ${styles.toolsPanel}`} aria-label={label('Инструменты лепки', 'Інструменти ліплення')}>
        <div className={styles.pickerHeader}><strong>{label('Инструменты лепки', 'Інструменти ліплення')}</strong><button type="button" onClick={()=>setToolsOpen(false)} aria-label={label('Закрыть инструменты', 'Закрити інструменти')}><i className="pi pi-times" aria-hidden="true" /></button></div>
        <div className={styles.shapeGrid}>
          <label>{label('Вращение','Обертання')}<input type="range" min="0.3" max="2.8" step="0.1" defaultValue="1.6" onChange={event=>{settings.current.speed=Number(event.target.value);}} /></label>
          <label>{label('Ширина пояса','Ширина пояса')}<input type="range" min="0.15" max="0.8" step="0.01" value={brush} onChange={event=>{settings.current.brush=Number(event.target.value);setBrush(Number(event.target.value));}} /></label>
          <label>{label('Мягкость','М’якість')}<input type="range" min="0.1" max="1" step="0.05" value={softness} onChange={event=>{settings.current.softness=Number(event.target.value);setSoftness(Number(event.target.value));}} /></label>
          <label>{label('Высота пояса','Висота пояса')}<input type="range" min="5" max="100" value={band} onChange={event=>{settings.current.band=Number(event.target.value);setBand(Number(event.target.value));}} /></label>
        </div>
        <div className={styles.pickerFooter}><button type="button" aria-label={label('Сузить на выбранной высоте','Звузити на вибраній висоті')} onClick={()=>settings.current.adjustment--}>−</button><button type="button" aria-label={label('Расширить на выбранной высоте','Розширити на вибраній висоті')} onClick={()=>settings.current.adjustment++}>+</button><button type="button" onClick={()=>settings.current.reset++}>{label('Сбросить форму','Скинути форму')}</button></div>
      </section>}
      <div className={styles.controls} onTouchMove={event=>event.stopPropagation()}>
        <button type="button" aria-label={paused?label('Вращать','Обертати'):label('Пауза','Пауза')} aria-pressed={paused} onClick={()=>{settings.current.paused=!paused;setPaused(!paused);}}><i className={`pi ${paused?'pi-play':'pi-pause'}`} aria-hidden="true" /></button>
        <div className={styles.modes} role="group" aria-label={label('Действие при нажиме','Дія при натисканні')}>{(['narrow','widen'] as const).map(mode=><button key={mode} type="button" aria-pressed={stage==='clay'&&sculptMode===mode} onClick={()=>{settings.current.stage='clay';settings.current.sculptMode=mode;setStage('clay');setSculptMode(mode);setPickerOpen(false);}}>{mode==='narrow'?'−':'+'}<span>{mode==='narrow'?label('Сузить','Звузити'):label('Расширить','Розширити')}</span></button>)}</div>
        <button type="button" className={styles.generate} onClick={()=>{settings.current.shapeTransaction++;settings.current.stage='clay';setStage('clay');generate(randomVessel(crypto.getRandomValues(new Uint32Array(1))[0]));paintAnew();}}><i className="pi pi-sparkles" aria-hidden="true" />{label('Новый','Новий')}</button>
        <button type="button" aria-expanded={shapeOpen} onClick={()=>{setShapeOpen(!shapeOpen);setPickerOpen(false);setToolsOpen(false);}}>{label('Форма','Форма')}</button>
        <button type="button" aria-expanded={pickerOpen} onClick={()=>{settings.current.stage='paint';setStage('paint');setPickerOpen(!pickerOpen);setShapeOpen(false);setToolsOpen(false);}}><i className="pi pi-palette" aria-hidden="true" />{label('Узоры','Візерунки')}</button>
        <button type="button" aria-label={label('Отменить изменение формы','Скасувати зміну форми')} onClick={()=>settings.current.undo++}><i className="pi pi-undo" aria-hidden="true" /></button>
        <button type="button" aria-label={label('Инструменты лепки','Інструменти ліплення')} aria-expanded={toolsOpen} onClick={()=>{setToolsOpen(!toolsOpen);setPickerOpen(false);setShapeOpen(false);}}><i className="pi pi-sliders-h" aria-hidden="true" /></button>
        {patterned&&<button type="button" aria-label={label('Стереть роспись','Стерти розпис')} onClick={()=>{settings.current.patterned=false;setPatterned(false);}}><i className="pi pi-eraser" aria-hidden="true" /></button>}
      </div>
      {pickerOpen&&<PatternPicker uk={uk} palette={palette} pattern={pattern} seed={seed} painted={patterned} options={patternOptions} onOptions={options=>{settings.current.patternOptions=options;settings.current.patterned=true;setPatternOptions(options);setPatterned(true);}} onClose={()=>setPickerOpen(false)} onRandom={randomize} onSelect={(nextPalette,nextPattern)=>{settings.current.palette=nextPalette;settings.current.pattern=nextPattern;settings.current.patterned=true;setPalette(nextPalette);setPattern(nextPattern);setPatterned(true);}} />}
    </>}
    {error&&<div className={styles.error} role="alert">{label('Не удалось запустить 3D. Обновите страницу или включите аппаратное ускорение браузера.','Не вдалося запустити 3D. Оновіть сторінку або ввімкніть апаратне прискорення браузера.')}</div>}
  </div>,host??document.body);
}
