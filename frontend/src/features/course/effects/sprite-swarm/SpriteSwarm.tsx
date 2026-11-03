'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { SWARM_DEFAULTS, SWARM_PRESETS, swarmSpritePath } from './presets';
import type { SpriteSwarmController } from './renderer';
import styles from './sprite-swarm.module.css';

export default function SpriteSwarm({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null), file = useRef<HTMLInputElement>(null);
  const controller = useRef<SpriteSwarmController | null>(null), settings = useRef({ ...SWARM_DEFAULTS }), imageRequest = useRef({ revision: 0 });
  const [values, setValues] = useState({ ...SWARM_DEFAULTS }), [preset, setPreset] = useState(10);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('Загрузка частиц…');
  useEffect(() => {
    let cancelled = false;
    const element = host.current!;
    const requests = imageRequest.current;
    import('./renderer').then(async ({ createSpriteSwarm }) => {
      if (cancelled) return;
      const instance = createSpriteSwarm(element, settings.current); controller.current = instance;
      await instance.setImage(swarmSpritePath(10));
      if (!cancelled) { setReady(true); setStatus('Сердца'); }
    }).catch(cause => {
      if (!cancelled) { console.error('Sprite swarm initialization failed', cause); setError('Не удалось запустить эффект. Проверьте поддержку WebGL.'); }
    });
    const lost = (event: Event) => { event.preventDefault(); setError('Графический контекст потерян. Откройте эффект заново.'); };
    element.addEventListener('webglcontextlost', lost, true);
    return () => { cancelled = true; requests.revision++; element.removeEventListener('webglcontextlost', lost, true); controller.current?.dispose(); controller.current = null; };
  }, []);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow, previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden'; root.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onExit(); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', escape); previousFocus?.focus(); };
  }, [onExit]);

  const change = <K extends keyof typeof values>(key: K, value: typeof values[K]) => {
    settings.current[key] = value; setValues(previous => ({ ...previous, [key]: value }));
  };
  const choose = async (id: number) => {
    const request = ++imageRequest.current.revision; setError('');
    try {
      if (await controller.current?.setImage(swarmSpritePath(id)) && request === imageRequest.current.revision) {
        setPreset(id); change('coloredImage', false); setStatus(SWARM_PRESETS.find(item => item.id === id)!.label);
      }
    } catch (cause) { if (request === imageRequest.current.revision) { console.error('Sprite preset failed', cause); setError('Не удалось открыть выбранную картинку.'); } }
  };
  const upload = async (image?: File) => {
    if (!image || !controller.current) return;
    if (!/^image\/(png|jpeg|webp|gif|avif|bmp)$/i.test(image.type)) { setError('Выберите PNG, JPEG, WebP, GIF, AVIF или BMP.'); return; }
    if (image.size > 20 * 1024 * 1024) { setError('Картинка должна быть не больше 20 МБ.'); return; }
    const request = ++imageRequest.current.revision; setError(''); setStatus('Открываю картинку…');
    try {
      if (await controller.current.setImage(image) && request === imageRequest.current.revision) {
        setPreset(0); change('coloredImage', false); setStatus(image.name);
      }
    } catch (cause) { if (request === imageRequest.current.revision) { console.error('Local sprite decoding failed', cause); setError('Не удалось прочитать картинку. Выберите другой файл.'); setStatus('Предыдущая картинка сохранена'); } }
  };
  const drop = (event: DragEvent) => { event.preventDefault(); void upload(event.dataTransfer.files[0]); };
  const fullscreen = () => { void root.current?.requestFullscreen?.().catch(cause => { console.error('Swarm fullscreen failed', cause); setError('Браузер не разрешил полноэкранный режим.'); }); };
  return <div ref={root} className={styles.root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Рой картинок" onDragOver={event => event.preventDefault()} onDrop={drop}>
    <div ref={host} className={styles.scene} />
    <header className={styles.header}><div><h1>Рой картинок</h1><p>Тяните — вращение · колесо — приближение · можно перетащить картинку</p></div><button type="button" onClick={onExit} aria-label="Закрыть эффект">✕</button></header>
    <aside className={styles.panel} aria-label="Настройки роя">
      <button type="button" className={styles.upload} disabled={!ready} onClick={() => file.current?.click()}>
        <span className={styles.uploadIcon} aria-hidden="true">↑</span>
        <span><strong>Своя картинка</strong><span className={styles.uploadHint}>Нажмите или перетащите файл сюда</span></span>
      </button>
      <div className={styles.presets} role="group" aria-label="Стандартные картинки">{SWARM_PRESETS.map(item => <button key={item.id} type="button" disabled={!ready} title={item.label} aria-label={item.label} aria-pressed={preset === item.id} onClick={() => void choose(item.id)} style={{ backgroundImage: `url(${swarmSpritePath(item.id)})` }} />)}</div>
      <div className={styles.actions}><button type="button" onClick={() => change('paused', !values.paused)}>{values.paused ? 'Продолжить' : 'Пауза'}</button><button type="button" onClick={() => controller.current?.resetCamera()}>Камера</button><button type="button" onClick={fullscreen}>Весь монитор</button></div>
      <input ref={file} className={styles.file} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" aria-label="Загрузить свою картинку" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
      <div className={styles.sliders}>
        <label>Количество <output>{values.count}</output><input type="range" min="100" max="5000" step="100" value={values.count} onChange={e => change('count', Number(e.target.value))} /></label>
        <label>Размер <output>{values.size.toFixed(2)}</output><input type="range" min=".08" max="1.5" step=".02" value={values.size} onChange={e => change('size', Number(e.target.value))} /></label>
        <label>Скорость <output>{values.speed.toFixed(1)}</output><input type="range" min="0" max="3" step=".1" value={values.speed} onChange={e => change('speed', Number(e.target.value))} /></label>
        <label>Высота волны <output>{values.amplitude.toFixed(1)}</output><input type="range" min="0" max="3" step=".1" value={values.amplitude} onChange={e => change('amplitude', Number(e.target.value))} /></label>
      </div>
      <div className={styles.bottom}><label><input type="checkbox" checked={values.coloredImage} onChange={e => change('coloredImage', e.target.checked)} /> Цвета картинки</label><button type="button" onClick={() => controller.current?.randomize()}>Перемешать</button></div>
      <p className={styles.status} role="status">{status}</p><small>Своя картинка остаётся в этом окне и не отправляется на сервер.</small>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </aside>
  </div>;
}
