'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/**
 * Measured card heights, kept for the page's lifetime so a table that scrolls away leaves a
 * placeholder of exactly the height it had. Both gallery layouts (CSS columns when vertical, a
 * wrapping flex column when horizontal) place cards by their height, so an approximate placeholder
 * would reshuffle the whole board; a remembered one keeps it identical.
 */
const heightCache = new Map<string, number>();

/**
 * The embed lays out at its fixed design width first and only then scales down in a rAF. Measuring
 * in that gap caches a height several times too tall, so a card counts as measurable only once its
 * scaled inner box actually fits the card.
 */
function measureCard(el: HTMLElement): number | null {
  const inner = el.querySelector<HTMLElement>('.grammar-component-table-scale-inner');
  if (inner && inner.getBoundingClientRect().width > el.clientWidth * 1.2) return null;
  const height = el.getBoundingClientRect().height;
  return height > 4 ? height : null;
}

export function rememberCardHeight(key: string, height: number) {
  if (height > 4) heightCache.set(key, height);
}

export function getCardHeight(key: string): number | undefined {
  return heightCache.get(key);
}

/**
 * Mounts its children only while the card is near the viewport (or near the slider's visible page),
 * and leaves a same-height placeholder otherwise. Unmounting is what actually pays off: each table
 * is a full component with its own ResizeObserver, so keeping sixty of them alive costs far more
 * than hiding them with `display: none` would ever save, and `visibility: hidden` would still leave
 * them in the layout.
 */
/**
 * mount: always render (warm-up batch), placeholder: never render (still queued for warm-up),
 * auto: follow the intersection observer.
 */
export type LazyMode = 'mount' | 'placeholder' | 'auto';

export function LazyTableBody({
  cacheKey,
  scrollRootRef,
  mode,
  forceMount = false,
  fallbackHeight,
  children,
}: {
  cacheKey: string;
  /** Scroll container to watch against; null means the viewport (vertical mode). */
  scrollRootRef: RefObject<HTMLElement | null>;
  mode: LazyMode;
  /** Keeps the card mounted regardless of mode (the tutor bot asked for this table). */
  forceMount?: boolean;
  /** Used only before the card has ever been measured. */
  fallbackHeight: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Only the observer-driven mode needs state; the warm-up modes are decided by the prop itself.
  const [autoMounted, setAutoMounted] = useState(true);
  const [placeholderHeight, setPlaceholderHeight] = useState(() => getCardHeight(cacheKey) ?? fallbackHeight);
  // A card is only ever swapped for a placeholder once its real height is known. Guessing it would
  // reshuffle both layouts, which place cards by height, so an unmeasured card simply stays mounted.
  const measured = getCardHeight(cacheKey) !== undefined;
  const mounted = forceMount || (mode === 'auto' ? autoMounted || !measured : mode === 'mount' || !measured);

  useEffect(() => {
    if (mode !== 'auto') return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry.isIntersecting) {
          setAutoMounted(true);
          return;
        }
        // Freeze the height we are giving up before the content goes away; a card that has not
        // finished scaling yet is left alone until it has.
        const height = measureCard(el);
        if (height === null) return;
        rememberCardHeight(cacheKey, height);
        setPlaceholderHeight(height);
        setAutoMounted(false);
      },
      // One and a half screens of slack in both directions: by the time a card is scrolled to, it
      // has been mounted for a while and never pops in empty.
      { root: scrollRootRef.current ?? null, rootMargin: '150% 150%' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode, scrollRootRef, cacheKey]);

  /**
   * Track the live height for as long as the card is mounted. A timer would not do: the embed
   * settles its scale in a rAF, and a measurement taken before that (or while the tab is not
   * painting) would cache the unscaled, several-times-too-tall height and wreck the layout.
   */
  useEffect(() => {
    if (!mounted) return;
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const height = measureCard(el);
      if (height !== null) rememberCardHeight(cacheKey, height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, cacheKey]);

  return (
    <div ref={ref} style={mounted ? undefined : { height: placeholderHeight }}>
      {mounted ? children : null}
    </div>
  );
}
