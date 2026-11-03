'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import siteCharacter from '@/config/site-character.json';
import type { CatMascot, EmotionName, HighlightMode } from '@/features/cat-mascot/catMascot';
import { getCharacterTour, noCharacterTour, registerSiteCharacter, subscribeCharacterTour } from './characterRuntime';
import styles from './characters.module.css';

/** Uses the existing tour cat engine. Only one owner renders it while a tour is running. */
export function SiteKeeper({ active, state, analyser }: {
  active: boolean; state: 'idle' | 'listening' | 'thinking' | 'speaking'; analyser?: AnalyserNode | null;
}) {
  const touring = useSyncExternalStore(subscribeCharacterTour, getCharacterTour, noCharacterTour);
  const catRef = useRef<CatMascot | null>(null);
  const stateRef = useRef(state);
  const analyserRef = useRef(analyser);
  useEffect(() => { stateRef.current = state; analyserRef.current = analyser; }, [state, analyser]);
  useEffect(() => {
    if (!active || touring) return;
    let disposed = false, frame = 0;
    let cat: CatMascot | null = null;
    let dockObserver: ResizeObserver | null = null;
    let pointing = false;
    let pointVersion = 0;
    const highlights = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    const host = document.querySelector<HTMLElement>('[data-site-character-chat]');
    const size = innerWidth < 600 ? 110 : 180;
    const dockPoint = () => {
      const rect = host?.getBoundingClientRect();
      return rect ? { x: scrollX + Math.max(70, Math.min(innerWidth - 140, rect.right - 140)), y: scrollY + Math.max(size + 60, rect.top - 12) }
        : { x: scrollX + innerWidth - 150, y: scrollY + innerHeight - 16 };
    };
    const ready = import('@/features/cat-mascot/catMascot').then(async ({ CatMascot }) => {
      if (disposed) return null;
      const start = dockPoint();
      cat = new CatMascot({ size, outfit: 'professor', quality: 'medium',
        layer: 12000, autonomy: false, followCursor: true, start, keepOnScreen: true,
        avoid: 'button, a[href], input, select, textarea' });
      await cat.init();
      if (disposed) { cat.dispose(); return null; }
      catRef.current = cat;
      if (host) {
        let last = JSON.stringify(start);
        dockObserver = new ResizeObserver(() => {
          const point = dockPoint(), key = JSON.stringify(point);
          if (disposed || pointing || key === last) return;
          last = key;
          void cat?.goTo(point);
        });
        dockObserver.observe(host);
      }
      return cat;
    }).catch(error => { console.error('[Site keeper] avatar initialization failed', error); cat?.dispose(); return null; });
    const unregister = registerSiteCharacter(async action => {
      if (disposed) return { matched: 0, reason: 'avatar_unavailable' };
      const ms = Math.min(15000, Math.max(1000, Number(action.durationMs) || 5000));
      if (action.operation === 'emotion') {
        if (!siteCharacter.emotions.includes(action.emotion || '')) return { matched: 0, reason: 'unknown_emotion' };
        const current = catRef.current;
        if (current) current.setEmotion(action.emotion as EmotionName, ms / 1000);
        else void ready.then(cat => { if (!disposed) cat?.setEmotion(action.emotion as EmotionName, ms / 1000); });
        return { matched: 1, queued: !current };
      }
      const target = siteCharacter.targets.find(target => target.id === action.target);
      if (!target) return { matched: 0, reason: 'unknown_target' };
      const targets = Array.from(document.querySelectorAll<HTMLElement>(target.selector)).filter(el => {
        const rect = el.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      });
      if (!targets.length) return { matched: 0, reason: 'target_not_visible_open_page_or_menu_first' };
      pointing = true;
      const mode = (['ring', 'spotlight', 'marker', 'laser'].includes(action.mode || '') ? action.mode : 'ring') as HighlightMode;
      // DOM feedback must not await WebGL initialization or animation frames in a hidden browser tab.
      const targetElement = targets[0];
      clearTimeout(highlights.get(targetElement));
      targetElement.classList.add(styles.siteTarget);
      highlights.set(targetElement, setTimeout(() => { targetElement.classList.remove(styles.siteTarget); highlights.delete(targetElement); }, ms));
      const version = ++pointVersion, expires = Date.now() + ms;
      void ready.then(current => {
        if (!current || disposed || version !== pointVersion || Date.now() >= expires) return;
        current.highlight(targetElement, mode, ms);
        return current.pointAt(targetElement, mode, undefined, ms);
      }).catch(error => {
        if (!disposed) console.error('[Site keeper] pointing animation failed', error);
      });
      return { matched: 1 };
    });
    let lastState = '';
    const samples = new Uint8Array(256);
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const current = catRef.current;
      if (!current || document.hidden) return;
      const state = stateRef.current;
      if (state !== lastState) {
        current.setEmotion(state === 'thinking' ? 'thinking' : state === 'listening' ? 'happy' : 'neutral', 4);
        lastState = state;
      }
      const source = analyserRef.current;
      if (state === 'speaking' && source) {
        source.getByteTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
        current.setMouth(Math.min(1, rms * 5));
      } else current.setMouth(null);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true; unregister(); dockObserver?.disconnect(); cancelAnimationFrame(frame); catRef.current = null; cat?.dispose();
      for (const [element, timer] of highlights) { clearTimeout(timer); element.classList.remove(styles.siteTarget); }
      highlights.clear();
    };
  }, [active, touring]);
  return null;
}
