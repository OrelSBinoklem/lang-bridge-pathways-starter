'use client';

import { useEffect, useRef } from 'react';
import { buildBookPageFrame, PAGE_COLUMNS, PAGE_ROWS } from './bookPageGeometry';

const REST_FRAME = buildBookPageFrame(0);

export function BookPageTurn() {
  const root = useRef<SVGGElement>(null);
  const patches = useRef<Array<SVGPathElement | null>>([]);
  const outline = useRef<SVGPathElement>(null);
  const ink = useRef<SVGPathElement>(null);
  const shadow = useRef<SVGPathElement>(null);

  useEffect(() => {
    const element = root.current, link = element?.closest('a');
    if (!element || !link) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    let startedAt: number | null = null;
    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; startedAt = null;
      element.style.opacity = '0';
    };
    const tick = (now: number) => {
      startedAt ??= now;
      const elapsed = (now - startedAt) / 2150;
      const t = Math.min(1, elapsed);
      // One smooth angular sweep; there are no intermediate stops or changing pivots.
      const progress = t * t * (3 - 2 * t);
      const pose = buildBookPageFrame(progress);
      for (let i = 0; i < pose.patches.length; i++) {
        patches.current[i]?.setAttribute('d', pose.patches[i].path);
        patches.current[i]?.setAttribute('fill', pose.patches[i].fill);
        patches.current[i]?.setAttribute('stroke', pose.patches[i].fill);
      }
      outline.current?.setAttribute('d', pose.outline);
      ink.current?.setAttribute('d', pose.ink);
      ink.current?.setAttribute('opacity', String(.28 + .22 * Math.abs(Math.cos(Math.PI * progress))));
      shadow.current?.setAttribute('opacity', String(.035 + .12 * Math.sin(Math.PI * progress)));
      element.style.opacity = String(Math.min(1, t / .055, (1 - t) / .08));
      if (elapsed < 1) frame = requestAnimationFrame(tick);
      else stop();
    };
    const play = () => {
      if (frame !== null || reducedMotion.matches || document.hidden) return;
      startedAt = null; frame = requestAnimationFrame(tick);
    };
    const focus = () => { if (link.matches(':focus-visible')) play(); };
    const visibility = () => { if (document.hidden) stop(); };
    const preference = () => { if (reducedMotion.matches) stop(); };
    link.addEventListener('pointerenter', play);
    link.addEventListener('focus', focus);
    reducedMotion.addEventListener('change', preference);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop();
      link.removeEventListener('pointerenter', play);
      link.removeEventListener('focus', focus);
      reducedMotion.removeEventListener('change', preference);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  return <g ref={root} opacity="0" data-book-leaf="projected">
    <path ref={shadow} d={REST_FRAME.outline} fill="#5b3c25" opacity=".035" />
    {Array.from({ length: PAGE_COLUMNS * PAGE_ROWS }, (_, i) => <path key={i} ref={node => { patches.current[i] = node; }} d={REST_FRAME.patches[i].path} fill={REST_FRAME.patches[i].fill} stroke={REST_FRAME.patches[i].fill} strokeWidth=".35" strokeLinejoin="round" />)}
    <path ref={outline} d={REST_FRAME.outline} fill="none" stroke="#dfc6a2" strokeWidth=".65" strokeLinejoin="round" />
    <path ref={ink} d={REST_FRAME.ink} fill="none" stroke="#ad8a62" strokeWidth="3.2" strokeLinecap="round" opacity=".5" />
  </g>;
}
