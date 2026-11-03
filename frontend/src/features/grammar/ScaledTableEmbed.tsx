'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  GRAMMAR_EMBED_FONT_SCALE_PERCENT,
  embedFontPx,
} from './grammarEmbedFonts';

/** CSS design width from MOBILE trainer content (~748). */
const COMPONENT_DESIGN_WIDTH = 748;
/** If unscaled height/width exceeds this, fit by width and scroll vertically. */
const TALL_ASPECT_SCROLL_RATIO = 2;
/** Match MOBILE trainer / system UI stack (gallery root previously used bare Arial). */
const TRAINER_FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

type FitMode = 'column' | 'contain';

type ScaledTableEmbedProps = {
  /** Kept for API compatibility; sizing uses COMPONENT_DESIGN_WIDTH. */
  designWidth?: number;
  /** column = scale to parent width; contain = object-fit:contain inside parent box. */
  fitMode?: FitMode;
  /** Optional embed font scale percent (100/120/130). Default = GRAMMAR_EMBED_FONT_SCALE_PERCENT. */
  fontScalePercent?: number;
  className?: string;
  style?: CSSProperties;
  /**
   * Height this embed had last time it was on screen. Used for the very first frame so a card that
   * mounts mid-scroll never flashes at its unscaled design size before the measurement lands.
   */
  initialHeight?: number;
  children: ReactNode;
  'aria-label'?: string;
  'data-grammar-table-id'?: string | number;
  'data-grammar-table-key'?: string;
  onMetricsChange?: () => void;
};

/**
 * Fixed design-width table + CSS transform scale.
 * - column: scale to parent width (gallery).
 * - contain: like object-fit:contain; if taller than 2× width → fit width + vertical scroll.
 */
export function ScaledTableEmbed({
  designWidth,
  fitMode = 'column',
  fontScalePercent = GRAMMAR_EMBED_FONT_SCALE_PERCENT,
  className = '',
  style,
  initialHeight,
  children,
  onMetricsChange,
  ...rest
}: ScaledTableEmbedProps) {
  void designWidth; // Compatibility prop, not a DOM attribute; layout uses the fixed design width.
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const onMetricsChangeRef = useRef(onMetricsChange);
  onMetricsChangeRef.current = onMetricsChange;
  const lastMetricsRef = useRef({ scale: 1, height: 0, overflowY: 'hidden', spacer: 0, offsetX: 0 });
  const [scale, setScale] = useState(1);
  const [wrapperHeight, setWrapperHeight] = useState<number | undefined>(initialHeight);
  const [overflowY, setOverflowY] = useState<'hidden' | 'auto'>('hidden');
  const [scrollSpacer, setScrollSpacer] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const safeDesignWidth = COMPONENT_DESIGN_WIDTH;
  const fontPx = embedFontPx(fontScalePercent);
  const tableFontSize = `calc(${fontPx}px * var(--grammar-table-font-scale, 1))`;

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    let raf = 0;
    const measure = () => {
      {
        const boxW = Math.max(outer.clientWidth, 1);
        const card =
          (inner.querySelector('.card') as HTMLElement | null) ??
          (inner.firstElementChild as HTMLElement | null) ??
          inner;
        let measuredH = Math.max(
          card.scrollHeight,
          card.offsetHeight,
          inner.scrollHeight,
          inner.offsetHeight,
          1,
        );
        // Alphabet bottom sections (Divskaņi / Afrīkāti) can sit below naive card height.
        const sections = inner.querySelector(
          '.alphabet-sections-wrapper',
        ) as HTMLElement | null;
        if (sections) {
          const cardStyle = window.getComputedStyle(card);
          const padBottom = Number.parseFloat(cardStyle.paddingBottom) || 0;
          measuredH = Math.max(
            measuredH,
            sections.offsetTop + sections.offsetHeight + padBottom,
          );
        }
        const aspect = measuredH / safeDesignWidth;

        let nextScale = 1;
        let nextHeight: number | undefined;
        let nextOverflow: 'hidden' | 'auto' = 'hidden';
        let nextSpacer = 0;
        let nextOffsetX = 0;

        if (fitMode === 'contain') {
          const scaleW = boxW / safeDesignWidth;
          // Available height comes from the parent box, never from `outer`
          // itself: `outer` gets the height we set below, so reading it back
          // made a tiny first measurement (modal still laying out) lock in
          // forever. Until the parent reports a real height, size by width only.
          const availH = outer.parentElement?.clientHeight ?? 0;
          const hasBoxHeight = availH > 40;
          if (aspect > TALL_ASPECT_SCROLL_RATIO) {
            nextScale = scaleW;
            nextHeight = hasBoxHeight ? Math.min(availH, measuredH * scaleW) : measuredH * scaleW;
            nextOverflow = 'auto';
            // Scrollable range must cover the visually scaled height.
            nextSpacer = measuredH * nextScale;
          } else {
            const scaleH = hasBoxHeight ? availH / measuredH : scaleW;
            nextScale = Math.min(scaleW, scaleH);
            nextHeight = measuredH * nextScale;
            nextOverflow = 'hidden';
            nextSpacer = 0;
            // A height-limited scale leaves the table narrower than the box: center it.
            nextOffsetX = Math.max(0, (boxW - safeDesignWidth * nextScale) / 2);
          }
        } else {
          nextScale = boxW / safeDesignWidth;
          nextHeight = measuredH * nextScale;
          nextOverflow = 'hidden';
          nextSpacer = 0;
        }

        const prev = lastMetricsRef.current;
        const changed =
          Math.abs(prev.scale - nextScale) > 0.0001 ||
          Math.abs(prev.height - (nextHeight ?? 0)) > 0.5 ||
          prev.overflowY !== nextOverflow ||
          Math.abs(prev.spacer - nextSpacer) > 0.5 ||
          Math.abs(prev.offsetX - nextOffsetX) > 0.5;
        lastMetricsRef.current = {
          scale: nextScale,
          height: nextHeight ?? 0,
          overflowY: nextOverflow,
          spacer: nextSpacer,
          offsetX: nextOffsetX,
        };
        setScale(nextScale);
        setWrapperHeight(nextHeight);
        setOverflowY(nextOverflow);
        setScrollSpacer(nextSpacer);
        setOffsetX(nextOffsetX);
        if (changed) onMetricsChangeRef.current?.();
      }
    };

    // Later passes (fonts settling, container resizes) can wait for a frame, but the first one
    // must run before this paint: a card mounted mid-scroll would otherwise show one frame at the
    // full design width before shrinking, which reads as a flicker while scrolling.
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    measure();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    if (outer.parentElement) ro.observe(outer.parentElement);
    const cardEl = inner.querySelector('.card') as HTMLElement | null;
    if (cardEl) ro.observe(cardEl);
    const sectionsEl = inner.querySelector(
      '.alphabet-sections-wrapper',
    ) as HTMLElement | null;
    if (sectionsEl) ro.observe(sectionsEl);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [safeDesignWidth, fitMode, children, fontScalePercent]);

  const isContain = fitMode === 'contain';

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        width: '100%',
        maxWidth: isContain ? '100%' : undefined,
        maxHeight: isContain ? '100%' : undefined,
        height: wrapperHeight,
        overflowX: 'hidden',
        overflowY,
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          position: 'relative',
          height: scrollSpacer > 0 ? scrollSpacer : undefined,
          marginLeft: offsetX || undefined,
        }}
      >
        <div
          ref={innerRef}
          className="grammar-component-table-scale-inner"
          style={
            {
              width: safeDesignWidth,
              maxWidth: 'none',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              fontSize: tableFontSize,
              fontFamily: TRAINER_FONT_FAMILY,
              ['--base-font-size' as string]: tableFontSize,
              ['--grammar-embed-font-size' as string]: tableFontSize,
            } as CSSProperties
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
