'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OctopusFace } from '@/features/table-bot/OctopusFace';
import { tentacle, touchPoint } from '@/features/table-bot/tentacle';
import faceStyles from '@/features/table-bot/table-bot.module.css';
import type { GrammarCharacterFocus } from './characterRuntime';
import styles from './characters.module.css';

/** Subscribes to successfully resolved grammar MCP targets, never fabricated demo selectors. */
export function GrammarOctopus({ speaking = false, tourOnly = false }: { speaking?: boolean; tourOnly?: boolean }) {
  const [focus, setFocus] = useState<GrammarCharacterFocus | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (event: Event) => {
      const detail = (event as CustomEvent<GrammarCharacterFocus>).detail;
      if (!detail?.targets?.length) return;
      // Tour previews have their own renderer, independent of the live chat rollout.
      if (Boolean(detail.layer) !== tourOnly) return;
      clearTimeout(timer);
      setFocus({ ...detail, targets: detail.targets.slice(0, 8) });
      timer = setTimeout(() => setFocus(null), Math.min(15000, Math.max(1000, detail.durationMs || 5000)));
    };
    const clear = () => { clearTimeout(timer); setFocus(null); };
    window.addEventListener('tutor.character.grammar', show);
    window.addEventListener('tutor.character.clear', clear);
    return () => { clearTimeout(timer); window.removeEventListener('tutor.character.grammar', show); window.removeEventListener('tutor.character.clear', clear); };
  }, [tourOnly]);
  return focus ? createPortal(<OctopusFocus key={focus.label + focus.targets.map(el => el.id).join()} focus={focus} speaking={speaking} close={() => setFocus(null)} />, document.body) : null;
}

function OctopusFocus({ focus, speaking, close }: { focus: GrammarCharacterFocus; speaking: boolean; close: () => void }) {
  const body = useRef<HTMLDivElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  useEffect(() => {
    let frame = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) return;
      const box = body.current?.getBoundingClientRect();
      if (!box) return;
      focus.targets.forEach((target, index) => {
        const path = paths.current[index];
        if (!path) return;
        const rect = target.getBoundingClientRect();
        const visible = target.isConnected && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
        path.style.visibility = visible ? 'visible' : 'hidden';
        if (!visible) return;
        const base = { x: box.left + box.width * (0.2 + index * 0.08), y: box.top + box.height * 0.8 };
        const tip = touchPoint(rect, base);
        path.setAttribute('d', tentacle(base, tip, reduced ? 0 : now / 1000, index, 10, 2.5).d);
      });
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [focus]);
  return <div className={styles.octopusLayer} style={focus.layer ? { zIndex: focus.layer } : undefined} data-live-grammar-helper="">
    <svg className={styles.arms} aria-hidden="true">{focus.targets.map((_, i) => <path key={i} ref={el => { paths.current[i] = el; }} fill="#c27af0" fillOpacity=".72" stroke="#65378c" strokeWidth="1.5" />)}</svg>
    <div className={`${styles.octopus} ${faceStyles.octopus}`} data-speaking={speaking}>
      <button className={styles.dismiss} onClick={close} aria-label="Скрыть осьминога">×</button>
      <div className={styles.caption}>{focus.label}</div>
      <div ref={body} className={faceStyles.body}><OctopusFace /></div>
    </div>
  </div>;
}
