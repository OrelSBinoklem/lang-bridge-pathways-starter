'use client';

import { useCallback, useRef, useState } from 'react';
import type { LearnLang } from '@/lib/learn-lang';
import styles from '@/components/language-banner.module.css';

type Props = {
  code: LearnLang;
  title: string;
  level?: string;
  active?: boolean;
  onSelect: () => void;
};

const ASSETS: Record<LearnLang, { color: string; effect: string; stroke: string }> = {
  lv: {
    color: '/lang/lv.jpg',
    effect: '/lang/lv-effect.jpg',
    stroke: '#0C80A3',
  },
  en: {
    color: '/lang/en.jpg',
    effect: '/lang/en-effect.jpg',
    stroke: '#FFDE7A',
  },
};

export function LanguageBanner({ code, title, level = 'B2', active, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const maskImgRef = useRef<HTMLImageElement>(null);
  const [hover, setHover] = useState(false);
  const assets = ASSETS[code];

  const moveMask = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    const mask = maskRef.current;
    const img = maskImgRef.current;
    if (!container || !mask || !img) return;

    const rect = container.getBoundingClientRect();
    const left = clientX - rect.left - mask.offsetWidth / 2;
    const top = clientY - rect.top - mask.offsetHeight / 2;

    mask.style.left = `${left}px`;
    mask.style.top = `${top}px`;
    img.style.left = `${-left}px`;
    img.style.top = `${-top}px`;
    img.style.width = `${container.offsetWidth}px`;
    img.style.height = `${container.offsetHeight}px`;
  }, []);

  const activeClass =
    active && code === 'en'
      ? styles.activeEn
      : active
        ? styles.active
        : '';

  return (
    <button
      type="button"
      className={`${styles.banner} ${activeClass}`}
      data-lang={code.toUpperCase()}
      onClick={onSelect}
    >
      <div className={styles.inner}>
        <h2 className={styles.title}>
          <span className={styles.wrapH2}>
            {title}
            <span className={styles.small}>{`(${level})`}</span>
          </span>
        </h2>

        <div
          ref={containerRef}
          className={styles.imageContainer}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onMouseMove={(e) => moveMask(e.clientX, e.clientY)}
        >
          <img src={assets.color} alt={title} className={styles.img} draggable={false} />

          <svg className={styles.lineAnimation} viewBox="0 0 100 100" aria-hidden>
            <rect
              x="2"
              y="2"
              width="96"
              height="96"
              rx="5"
              ry="5"
              className={styles.line}
              style={{ stroke: assets.stroke }}
            />
          </svg>

          <div ref={maskRef} className={styles.cursorMask} style={{ opacity: hover ? 1 : 0 }}>
            <img ref={maskImgRef} src={assets.effect} alt="" draggable={false} />
          </div>
        </div>
      </div>
    </button>
  );
}
