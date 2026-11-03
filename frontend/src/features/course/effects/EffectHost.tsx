'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { effectClientPoint, type EffectPointerInput } from './touchAim';

const EffectHostContext = createContext<HTMLElement | null>(null);

/** Native renderers share their engine, not a second application document. */
export function ContainedEffectHost({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return <div ref={setHost} data-contained-effect="" style={{ position: 'absolute', inset: 0, contain: 'layout paint', overflow: 'hidden', pointerEvents: 'auto' }}>
    <EffectHostContext.Provider value={host}>{host && children}</EffectHostContext.Provider>
  </div>;
}

export const useEffectHost = () => useContext(EffectHostContext);

/** The footer may overlap at the end of a page; only the visible app header reserves effect space. */
export function effectHeaderInset(header: Pick<DOMRect, 'bottom'> | null, viewportHeight: number) {
  return Math.max(0, Math.min(viewportHeight, header?.bottom ?? 0));
}

export function observeEffectHeaderInset(update: (top: number) => void) {
  const header = document.querySelector('[data-app-header]');
  const measure = () => {
    const style = header ? window.getComputedStyle(header) : null;
    const visible = style?.visibility !== 'hidden' && style?.display !== 'none';
    update(effectHeaderInset(visible ? header?.getBoundingClientRect() ?? null : null, window.innerHeight));
  };
  measure();
  const observer = new ResizeObserver(measure);
  if (header) observer.observe(header);
  const visibility = new MutationObserver(measure);
  visibility.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  if (header) visibility.observe(header, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', measure, { passive: true });
  return () => {
    observer.disconnect();
    visibility.disconnect();
    window.removeEventListener('resize', measure);
    window.removeEventListener('scroll', measure);
  };
}

/** A common page viewport for every course engine. Existing contained card previews keep their own host. */
export function PageEffectHost({ children }: { children: ReactNode }) {
  const parent = useEffectHost();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [top, setTop] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (parent) return;
    return observeEffectHeaderInset(inset => { setTop(inset); setMounted(true); });
  }, [parent]);
  if (parent) return <>{children}</>;
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(<div ref={setHost} data-effect-page-viewport=""
    style={{ position: 'fixed', top, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none', contain: 'layout paint', overflow: 'hidden' }}>
    <EffectHostContext.Provider value={host}>{host && children}</EffectHostContext.Provider>
  </div>, document.body);
}

export function effectBounds(host: HTMLElement | null) {
  return host?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

export function effectPoint(host: HTMLElement | null, event: EffectPointerInput) {
  const rect = effectBounds(host);
  const point = effectClientPoint(event, rect);
  const x = point.clientX - rect.left, y = point.clientY - rect.top;
  return { x, y, inside: event.clientX >= rect.left && event.clientX <= rect.left + rect.width && event.clientY >= rect.top && event.clientY <= rect.top + rect.height };
}

export function observeEffectSize(host: HTMLElement | null, update: () => void) {
  update();
  if (host) {
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }
  window.addEventListener('resize', update);
  return () => window.removeEventListener('resize', update);
}
