import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clampPreview, type HoverTarget, type TracePreview } from './tracePreview';
import styles from './context-studio.module.css';

const STATUS = { running: 'Выполняется', completed: 'Завершён', skipped: 'Пропущен', failed: 'Ошибка', 'not-run': 'Нет данных запуска', unconfirmed: 'Передача не подтверждена' };
export function TraceHoverCard({ target, preview, title, id, onClose }: { target: HoverTarget; preview: TracePreview; title: string; id: string; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 380, height: 330 });
  const [viewport, setViewport] = useState(() => ({ width: typeof window === 'undefined' ? 1000 : window.innerWidth, height: typeof window === 'undefined' ? 800 : window.innerHeight }));
  useEffect(() => {
    const observer = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect) setSize(old => Math.abs(old.height - (rect.height + 30)) < 1 ? old : { width: 380, height: rect.height + 30 }); });
    if (ref.current) observer.observe(ref.current);
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  if (typeof document === 'undefined') return null;
  const dialogs = document.querySelectorAll('dialog[open]');
  return createPortal(<aside ref={ref} id={id} data-tutor-trace-preview role="dialog" aria-modal="false" aria-label={`Данные запуска: ${title}`} className={`${styles.page} ${styles.hoverPreview}`} style={clampPreview(target, size, viewport)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className={styles.hoverHeading}><h3>{title}</h3><button type="button" onClick={onClose} aria-label="Закрыть данные запуска">×</button></div>
    <p className={styles.hoverStatus} data-status={preview.status}>{STATUS[preview.status]}{preview.durationMs != null ? ` · ${preview.durationMs} мс` : ''}{preview.branch !== undefined ? ` · ветка «${preview.branch ? 'да' : 'нет'}»` : ''}</p>
    <p className={styles.timelineOrigin}>{preview.note}</p>
    {preview.error && <p className={styles.danger}>{preview.error}</p>}
    {preview.input && <div><h4>Вход</h4><pre tabIndex={0}>{preview.input.text}</pre></div>}
    {preview.output && <div><h4>Выход</h4><pre tabIndex={0}>{preview.output.text}</pre></div>}
    {(preview.input?.truncated || preview.output?.truncated) && <p className={styles.timelineOrigin}>Показан сокращённый фрагмент трассы. Усечённый JSON сохраняется как текст.</p>}
  </aside>, dialogs.item(dialogs.length - 1) ?? document.body);
}
