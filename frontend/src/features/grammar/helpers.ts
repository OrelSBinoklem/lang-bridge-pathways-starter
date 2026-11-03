import type { GrammarTableItem } from './data/tablesData';
import { GRAMMAR_FONT_COOKIE, isGrammarFontLarge } from '@/lib/grammar-font-preference';

const LEVEL_RANK: Record<string, number> = { a1: 0, a2: 1, b1: 2, b2: 3 };

export type FilterLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'super';
export type ViewMode = 'horizontal' | 'vertical';

export function getStorage(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Gallery view settings the server also needs: they are mirrored into cookies so the first
 * server-rendered markup already has the visitor's own column count, level and layout, instead of
 * rendering the defaults and rebuilding the whole board after hydration.
 */
export const GALLERY_COOKIE_KEYS = ['gallery-columns', 'gallery-level', 'view-mode'] as const;
export type GalleryCookieKey = (typeof GALLERY_COOKIE_KEYS)[number];
export type GalleryInitialSettings = Partial<Record<GalleryCookieKey, string>>;

function isGalleryCookieKey(key: string): key is GalleryCookieKey {
  return (GALLERY_COOKIE_KEYS as readonly string[]).includes(key);
}

export function mirrorToCookie(key: string, value: string) {
  if (typeof document === 'undefined' || !isGalleryCookieKey(key)) return;
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function setStorage(key: string, value: string) {
  if (typeof window === 'undefined') return;
  mirrorToCookie(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function isLargeFontEnabled(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.documentElement.classList.contains('lbp-font-large')) return true;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${GRAMMAR_FONT_COOKIE}=([^;]+)`));
  return isGrammarFontLarge(m?.[1]);
}

export function filterTablesByLevel(
  tables: GrammarTableItem[],
  selectedLevel: FilterLevel,
): GrammarTableItem[] {
  if (selectedLevel === 'super') {
    return tables.filter((img) => String(img.id).startsWith('super-'));
  }

  const currentRank = LEVEL_RANK[selectedLevel];
  if (currentRank === undefined) return tables;

  return tables.filter((img) => {
    const imgLevel = String(img.level || '').toLowerCase();
    if (!imgLevel) return false;

    if (imgLevel.includes('-')) {
      const [startLevel, endLevel] = imgLevel.split('-');
      const startRank = LEVEL_RANK[startLevel];
      const endRank = LEVEL_RANK[endLevel];
      if (startRank !== undefined && endRank !== undefined) {
        return currentRank >= startRank && currentRank <= endRank;
      }
      return false;
    }

    const imgRank = LEVEL_RANK[imgLevel];
    return imgRank !== undefined ? imgRank <= currentRank : false;
  });
}

export function getLevelClass(level?: string): string {
  if (!level) return 'a1';
  const normalized = level.toLowerCase();
  const base = normalized.includes('-') ? normalized.split('-')[0] : normalized;
  return ['a1', 'a2', 'b1', 'b2', 'super'].includes(base) ? base : 'a1';
}

export function getLevelLabel(level?: string, description?: string): string {
  if (description) return description;
  if (!level) return 'A1';
  const base = level.includes('-') ? level.split('-')[0] : level;
  return base.toUpperCase();
}

export function resolveImageSrc(item: GrammarTableItem, useMobile: boolean): string {
  if (!useMobile || !item.src || String(item.id).startsWith('super-')) {
    return item.src;
  }
  const parts = item.src.split('/');
  const fileName = parts.pop();
  if (!fileName) return item.src;
  return `${parts.join('/')}/mobile/${fileName}`;
}

export function resolveHintPath(
  item: GrammarTableItem | { id: string | number; hintId?: string | number },
  locale: string = 'ru',
): string {
  const idString = String(item.hintId ?? item.id);
  const isSuper = idString.startsWith('super-') || String(item.id).startsWith('super-');
  const cleanId = idString.replace(/^super-/, '');
  const uk = locale === 'uk' ? 'uk/' : '';
  return isSuper
    ? `/grammar/hints-super-tables/${uk}${cleanId}.html`
    : `/grammar/hints/${uk}${cleanId}.html`;
}

export function hintPayloadFromItem(item: GrammarTableItem): string {
  if (String(item.id).startsWith('super-')) {
    return `super-${item.hintId ?? String(item.id).replace(/^super-/, '')}`;
  }
  return String(item.hintId ?? item.id);
}
