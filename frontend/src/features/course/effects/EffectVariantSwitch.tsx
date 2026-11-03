'use client';

import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { GroupEffectVariant } from './groupEffects.config';
import styles from './effect-variant-switch.module.css';

/**
 * Small pill of icon buttons in a group card's top-right corner. With several effect variants it picks between them,
 * and a click on the variant already chosen turns "focus on the effect" on or off (the page's content disappears,
 * scrolling stops, only the effect and this pill stay). With a single effect the pill is just the focus button.
 * Control clicks stay out of the scene's pointer input. Card/background placement is automatic.
 */
export function EffectVariantSwitch({
  variants,
  activeId,
  onSelect,
  focused,
  onFocus,
  uk,
  seeThrough = false,
}: {
  variants: GroupEffectVariant[];
  activeId: string | null;
  onSelect: (variantId: string) => void;
  focused: boolean;
  onFocus: () => void;
  uk: boolean;
  /** Half transparent (solid under the cursor), like the rest of the card's controls, so the effect shows through. */
  seeThrough?: boolean;
  /** @deprecated Compatibility with existing callers; placement is automatic, without a format button. */
  cardMode?: boolean;
  /** @deprecated Kept for existing callers only; no manual format control is rendered. */
  onCardMode?: () => void;
}) {
  const focusLabel = focused ? (uk ? 'Повернути вміст' : 'Вернуть содержимое') : uk ? 'Лише ефект' : 'Только эффект';
  const className = `${styles.switch} ${seeThrough ? styles.seeThrough : ''} ${focused ? styles.focused : ''}`;
  const present = (toolbar: ReactNode) => focused && typeof document !== 'undefined' ? createPortal(toolbar, document.body) : toolbar;
  if (variants.length < 2) {
    return present(
      <div data-effect-toolbar="" className={`${className} ${styles.solo}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          aria-pressed={focused}
          aria-label={focusLabel}
          title={focusLabel}
          className={`${styles.option} ${styles.active}`}
          data-effect-return={focused ? 'true' : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onFocus();
          }}
        >
          {variants[0]?.icon === '📷' ? <PhotoIcon /> : <FocusIcon focused={focused} />}
          {focused && <i className={`pi pi-undo ${styles.returnMark}`} aria-hidden="true" />}
        </button>
      </div>
    );
  }
  return present(
    <div data-effect-toolbar="" className={className} role="radiogroup" aria-label={uk ? 'Варіант ефекту' : 'Вариант эффекта'} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      {variants.map((variant) => {
        const label = uk ? variant.label.uk : variant.label.ru;
        const active = variant.id === activeId;
        const title = active ? `${label} — ${focused ? focusLabel.toLowerCase() : uk ? 'натисніть ще раз: лише ефект' : 'нажмите ещё раз: только эффект'}` : label;
        return (
          <button
            key={variant.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={title}
            title={title}
            className={`${styles.option} ${active ? styles.active : ''}`}
            data-effect-return={focused && active ? 'true' : undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (active) onFocus();
              else onSelect(variant.id);
            }}
          >
            <span aria-hidden="true">{variant.icon}</span>
            {focused && active && <i className={`pi pi-undo ${styles.returnMark}`} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

/** Two overlapping instant photos for the garland, without the generic archive arrow. */
function PhotoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 6 3 7l3 15 13-3" />
      <rect x="7" y="2" width="14" height="17" rx="1.5" />
      <path d="M10 14V5h8v9ZM10 12l2.5-3 2 2 1.5-1 2 3M11 16h6" />
      <circle cx="16" cy="7" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Four corner brackets (look at the effect); pointing inwards once the content is hidden (bring it back). */
function FocusIcon({ focused }: { focused: boolean }) {
  const d = focused
    ? 'M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5'
    : 'M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5';
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
