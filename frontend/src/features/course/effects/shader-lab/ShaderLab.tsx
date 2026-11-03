'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LAB_SCENES, RESOLUTIONS, BENCHMARK_SAMPLE_MS, BENCHMARK_WARMUP_MS } from './catalog';
import { SHOWCASE_NOTES } from './scenes';
import { LabRenderer } from './renderer';
import { previewSize, summarize, type Samples, type Statistics } from './metrics';
import styles from './ShaderLab.module.css';

type Config = { selected: number; count: number; quality: number; speed: number; palette: number; paused: boolean; tour: boolean };
type Result = Statistics & { id: string; label: string; width: number; height: number; measuredAt: string };
type Run = { ids: number[]; index: number; start: number; last: number; epoch: number; samples: Samples; size: typeof RESOLUTIONS[number] };
const empty = (): Samples => ({ frames: [], cpu: [], gpu: [] });
const number = (n: number | null | undefined, suffix = '') => n == null ? '—' : n.toFixed(1) + suffix;

export function ShaderLabLauncher({ onOpen }: { onOpen: (id: string) => void }) {
  return <section className={styles.launcher} aria-labelledby="shader-lab-title">
    <div className={styles.intro}><div><span className={styles.eyebrow}>LIGHT LAB / EXPERIMENTS 001—023</span><h2 id="shader-lab-title">За пределами обычного фона</h2><p>Три новых мира. Девять шейдерных этюдов. И стенд, на котором можно столкнуть их вместе.</p></div>
      <button onClick={() => onOpen('mercury-iris')} className={styles.primary}>Открыть лабораторию ↗</button></div>
    <div className={styles.cards}>{SHOWCASE_NOTES.map(note => <button key={note.id} onClick={() => onOpen(note.id)} className={`${styles.poster} ${styles[note.id]}`}>
      <span className={styles.art} aria-hidden="true"><i/><i/><i/></span><span className={styles.serial}>{note.number} / REALTIME</span>
      <span className={styles.caption}><strong>{LAB_SCENES.find(s => s.id === note.id)?.label}</strong><small>{note.subtitle}</small><span>{note.description}</span><b>Исследовать ↗</b></span>
    </button>)}</div>
    <p className={styles.footnote}>Сцен: {LAB_SCENES.length} · мозаика 2×2 / 3×3 / 4×4 · фиксированное разрешение в тестах · всё локально, без загрузки моделей</p>
  </section>;
}

export function ShaderLab({ initialId, onClose }: { initialId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<Config>({ selected: Math.max(0, LAB_SCENES.findIndex(s => s.id === initialId)), count: 1, quality: 1, speed: 1, palette: 0, paused: false, tour: false });
  const configRef = useRef(config), run = useRef<Run | null>(null), epoch = useRef(0), resultsRef = useRef<Result[]>([]);
  const invalidate = useRef(0);
  const pointer = useRef<[number, number, number, number]>([.5, .5, 0, 0]);
  const [resolution, setResolution] = useState(1), [status, setStatus] = useState('Исследуйте сцену: курсор слегка поворачивает камеру.');
  const [running, setRunning] = useState(false), [results, setResults] = useState<Result[]>([]), [error, setError] = useState('');
  const [stats, setStats] = useState<Statistics | null>(null), [pixels, setPixels] = useState(''), [reduced, setReduced] = useState(false);
  const [showResults, setShowResults] = useState(false), [progress, setProgress] = useState(0);
  const [immersive, setImmersive] = useState(false);
  const patch = (next: Partial<Config>) => { const value = { ...configRef.current, ...next }; configRef.current = value; setConfig(value); };

  useEffect(() => {
    const element = dialog.current; const focused = document.activeElement as HTMLElement | null;
    element?.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; focused?.focus(); };
  }, []);

  useEffect(() => {
    if (!canvas.current || !stage.current) return;
    const surface = canvas.current, box = stage.current;
    let renderer: LabRenderer | undefined, raf = 0, disposed = false, clock = 6, last = 0, reportAt = 0, tourAt = 0, dirty = true;
    let previewSamples = empty(); let lastKey = '';
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Reduced motion is respected initially; pressing Play or Benchmark is an explicit opt-in.
    if (media.matches) queueMicrotask(() => { if (!disposed) { setReduced(true); configRef.current = { ...configRef.current, paused: true }; setConfig(configRef.current); } });
    const resize = new ResizeObserver(() => { dirty = true; }); resize.observe(box);
    const stopHidden = () => {
      last = 0;
      if (document.hidden && run.current) { run.current = null; setRunning(false); setStatus('Тест прерван: вкладка ушла в фон. Неполный результат не сохранён.'); }
    };
    const lost = (event: Event) => { event.preventDefault(); run.current = null; setRunning(false); setError('WebGL-контекст потерян. Закройте лабораторию и откройте её снова.'); cancelAnimationFrame(raf); };
    const motionChange = () => { setReduced(media.matches); if (media.matches) { configRef.current = { ...configRef.current, paused: true, tour: false }; setConfig(configRef.current); run.current = null; setRunning(false); dirty = true; } };
    document.addEventListener('visibilitychange', stopHidden); surface.addEventListener('webglcontextlost', lost); media.addEventListener('change', motionChange);
    const tick = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (document.hidden) { last = 0; return; }
      try {
        renderer ??= new LabRenderer(surface);
        let cfg = configRef.current; const active = run.current;
        const dt = last ? now - last : 0; last = now;
        if (!cfg.paused || active) clock += Math.min(dt, 50) / 1000;
        const key = `${JSON.stringify(cfg)}:${invalidate.current}`; if (key !== lastKey) { dirty = true; previewSamples = empty(); lastKey = key; tourAt = now; }
        if (!active && cfg.tour && !cfg.paused && now - tourAt > 10000) {
          cfg = { ...cfg, selected: (cfg.selected + 1) % LAB_SCENES.length }; configRef.current = cfg; setConfig(cfg); tourAt = now; dirty = true;
        }
        for (const sample of renderer.poll()) {
          if (active && sample.tag === `${active.epoch}:${active.index}`) active.samples.gpu.push(sample.ms);
          else if (!active && sample.tag === 'preview') previewSamples.gpu.push(sample.ms);
        }
        if (cfg.paused && !active && !dirty) return;
        const rect = box.getBoundingClientRect();
        const size = active?.size ?? previewSize(rect.width, rect.height, window.devicePixelRatio, cfg.quality);
        const indices = active ? [active.ids[active.index]] : Array.from({ length: cfg.count }, (_, i) => (cfg.selected + i) % LAB_SCENES.length);
        if (active && !active.start) { active.start = now; active.last = 0; }
        const elapsed = active ? now - active.start : 0;
        const measuring = active && elapsed >= BENCHMARK_WARMUP_MS;
        const cpu = renderer.draw({ scenes: indices.map(i => LAB_SCENES[i]), width: size.width, height: size.height, time: active ? 6 + elapsed / 1000 : clock, speed: active ? 1 : cfg.speed, palette: active ? 0 : cfg.palette, intensity: 1, pointer: active ? [.5,.5,0,0] : pointer.current, tag: measuring ? `${active.epoch}:${active.index}` : active ? 'warmup' : 'preview' });
        dirty = false;
        if (measuring) {
          if (active.last) active.samples.frames.push(now - active.last);
          active.last = now; active.samples.cpu.push(cpu);
        } else if (!active && dt > 0) { previewSamples.frames.push(dt); previewSamples.cpu.push(cpu); }
        if (active && elapsed >= BENCHMARK_WARMUP_MS + BENCHMARK_SAMPLE_MS) {
          const scene = LAB_SCENES[active.ids[active.index]];
          const result = { ...summarize(active.samples), id: scene.id, label: scene.label, width: size.width, height: size.height, measuredAt: new Date().toISOString() };
          resultsRef.current = [...resultsRef.current, result]; setResults(resultsRef.current);
          active.index++; active.start = 0; active.last = 0; active.samples = empty();
          if (active.index === active.ids.length) { run.current = null; invalidate.current++; setRunning(false); setProgress(1); setStatus('Замер завершён. Результаты ниже; FPS ограничен частотой экрана и работой браузера.'); setShowResults(true); }
        }
        if (now - reportAt > 500 || cfg.paused) {
          reportAt = now; setPixels(`${size.width} × ${size.height}`);
          if (active && run.current) {
            setStats(summarize(active.samples));
            setProgress((active.index + Math.min(1, elapsed / (BENCHMARK_WARMUP_MS + BENCHMARK_SAMPLE_MS))) / active.ids.length);
            setStatus(`${active.index + 1}/${active.ids.length} · ${LAB_SCENES[active.ids[active.index]].label} · ${elapsed < BENCHMARK_WARMUP_MS ? 'прогрев' : 'замер'}`);
          } else { setStats(summarize(previewSamples)); previewSamples = empty(); }
        }
      } catch (cause) {
        console.error('[shader-lab]', cause); cancelAnimationFrame(raf); run.current = null; setRunning(false);
        setError(cause instanceof Error ? cause.message : 'Не удалось запустить лабораторию.');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); document.removeEventListener('visibilitychange', stopHidden); surface.removeEventListener('webglcontextlost', lost); media.removeEventListener('change', motionChange); renderer?.dispose(); run.current = null; };
  }, []);

  const start = (all: boolean) => {
    if (run.current || error) return;
    const ids = all ? LAB_SCENES.map((_, i) => i) : [config.selected];
    resultsRef.current = []; setResults([]); setShowResults(false); setProgress(0);
    run.current = { ids, index: 0, start: 0, last: 0, epoch: ++epoch.current, samples: empty(), size: RESOLUTIONS[resolution] };
    setRunning(true); setStatus('Прогрев. Разрешение, время, палитра и камера зафиксированы.');
  };
  const stop = () => { run.current = null; invalidate.current++; setRunning(false); setStatus('Остановлено. Сохранены только полностью измеренные сцены.'); setShowResults(true); };
  const download = () => {
    const payload = { version: 1, renderer: 'WebGL2 / single canvas', warmupMs: BENCHMARK_WARMUP_MS, sampleMs: BENCHMARK_SAMPLE_MS, browser: navigator.userAgent, dpr: window.devicePixelRatio, palette: 0, speed: 1, results };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'light-lab-benchmark.json'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const titles = Array.from({ length: config.count }, (_, i) => LAB_SCENES[(config.selected + i) % LAB_SCENES.length]);
  return createPortal(<dialog ref={dialog} className={`${styles.dialog} ${immersive ? styles.immersive : ''}`} aria-labelledby="light-lab-heading" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className={styles.header}><div><span className={styles.eyebrow}>REALTIME / LIGHT LAB</span><h2 id="light-lab-heading">Лаборатория света <small>{LAB_SCENES.length} сцены</small></h2></div><div className={styles.headerActions}><button disabled={running} onClick={() => setImmersive(!immersive)}>{immersive ? 'Показать настройки' : 'Только эффект'}</button><button onClick={onClose} className={styles.close}>Закрыть · Esc</button></div></header>
    <div className={styles.workspace}>
      <aside className={styles.sidebar}><span className={styles.eyebrow}>КОЛЛЕКЦИЯ</span><nav aria-label="Шейдерные сцены">{LAB_SCENES.map((scene, i) => <button key={scene.id} disabled={running} aria-pressed={config.selected === i} onClick={() => patch({ selected: i, tour: false })}><span>{String(i + 1).padStart(2, '0')}</span><strong>{scene.label}</strong>{i < 3 && <em>3D</em>}</button>)}</nav></aside>
      <main className={styles.main}>
        <div ref={stage} className={styles.stage} data-testid="shader-lab-stage"
          onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); pointer.current = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 1, e.buttons ? 1 : 0]; }}
          onPointerDown={e => { const r = e.currentTarget.getBoundingClientRect(); pointer.current = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 1, 1]; }}
          onPointerUp={() => { pointer.current[3] = 0; }} onPointerLeave={() => { pointer.current = [.5,.5,0,0]; }}>
          <canvas ref={canvas} aria-label="Шейдерная сцена" style={{ objectFit: 'contain' }}/>
          {!running && <div className={styles.tileLabels} style={{ gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(config.count))},1fr)` }}>{titles.map(s => <span key={s.id}>{s.label}</span>)}</div>}
          {reduced && config.paused && !running && <p className={styles.motionNote}>Уменьшенное движение: показан неподвижный кадр. Запуск — кнопкой «Воспроизвести».</p>}
          {error && <div role="alert" className={styles.error}>{error}</div>}
        </div>
        <div className={styles.controls}>
          <label>Вид<select aria-label="Количество сцен" value={config.count} disabled={running} onChange={e => patch({ count: Number(e.target.value) })}><option value={1}>Одна сцена</option><option value={4}>Мозаика 2 × 2</option><option value={9}>Мозаика 3 × 3</option><option value={16}>Мозаика 4 × 4</option></select></label>
          <label>Чёткость<select aria-label="Чёткость" value={config.quality} disabled={running} onChange={e => patch({ quality: Number(e.target.value) })}>{[.5,.75,1,1.5].map(q => <option key={q} value={q}>{q}×</option>)}</select></label>
          <label>Палитра<select aria-label="Палитра" value={config.palette} disabled={running} onChange={e => patch({ palette: Number(e.target.value) })}><option value={0}>Лёд / золото</option><option value={1}>Ультрафиолет</option><option value={2}>Нефрит</option></select></label>
          <label>Скорость <input aria-label="Скорость" type="range" min="0.25" max="2" step="0.25" value={config.speed} disabled={running} onChange={e => patch({ speed: Number(e.target.value) })}/></label>
          <button disabled={running} onClick={() => patch({ paused: !config.paused })}>{config.paused ? 'Воспроизвести' : 'Пауза'}</button>
          <button disabled={running} aria-pressed={config.tour} onClick={() => patch({ tour: !config.tour, paused: false })}>Автотур · 10 с</button>
        </div>
        <div className={styles.readout}><strong>{pixels || 'Подготовка…'}</strong><span>FPS {number(stats?.fps)}</span><span>P95 {number(stats?.frameP95, ' мс')}</span><span>CPU {number(stats?.cpuMedian, ' мс')}</span><span>GPU {number(stats?.gpuMedian, ' мс')}</span></div>
        {!running && stats?.fps != null && stats.fps < 5 && <p className={styles.throttled}>Кадры приходят редко. Браузер может ограничивать невидимое окно; такой FPS не показывает предельную скорость видеокарты.</p>}
        <section className={styles.bench} aria-labelledby="benchmark-heading"><div className={styles.benchHeading}><div><h3 id="benchmark-heading">Бенчмарк</h3><p>1 с прогрева + 3 с замера на сцену. Один шейдер, одинаковые условия, без адаптивного понижения качества.</p></div><label>Разрешение<select aria-label="Разрешение бенчмарка" disabled={running} value={resolution} onChange={e => setResolution(Number(e.target.value))}>{RESOLUTIONS.map((r,i) => <option key={r.label} value={i}>{r.label}</option>)}</select></label></div>
          <div className={styles.actions}><button disabled={running || !!error} onClick={() => start(false)}>Замерить выбранную · 4 с</button><button className={styles.primary} disabled={running || !!error} onClick={() => start(true)}>Прогнать все {LAB_SCENES.length} · {LAB_SCENES.length * 4} с</button>{running && <button onClick={stop}>Остановить тест</button>}{results.length > 0 && <><button onClick={() => setShowResults(!showResults)}>Результаты ({results.length})</button><button onClick={download}>Скачать JSON</button></>}</div>
          <p role="status" className={styles.status}>{status}</p>{running && <progress value={progress} max={1} aria-label="Ход бенчмарка"/>}
          <p className={styles.disclaimer}>FPS зависит от частоты экрана и других вкладок. CPU — время отправки команд, не загрузка процессора. GPU измеряется таймером видеокарты; «—» означает, что измерений нет. В мозаике цифры относятся ко всему кадру. Просмотр ограничен 4,2 Мп; фактическое разрешение указано над тестом. При уходе вкладки в фон тест прекращается.</p>
          {showResults && <div className={styles.results}>{results.map(result => <article key={result.id}><strong>{result.label}</strong><small>{result.width} × {result.height} · кадров: {result.samples}</small><div><b>{number(result.fps)} <small>FPS</small></b><span>P95 {number(result.frameP95, ' мс')}</span><span>CPU {number(result.cpuMedian, ' мс')}</span><span>GPU {number(result.gpuMedian, ' мс')}</span></div>{!result.reliable && <p>Мало кадров для сравнения. Возможны ограничение фонового окна или сильные задержки.</p>}</article>)}</div>}
        </section>
      </main>
    </div>
  </dialog>, document.body);
}
