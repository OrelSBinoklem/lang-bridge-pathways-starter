export function lessonDraftKey(userId: number, blockId: number, variantId: number | null) {
  return `lbp:lesson-draft:v1:${userId}:${blockId}:${variantId ?? 'default'}`;
}

export function lessonSelectionKey(userId: number, slug: string) {
  return `lbp:lesson-selection:v1:${userId}:${encodeURIComponent(slug)}`;
}

export function readDraft<T>(storage: Pick<Storage, 'getItem'>, key: string, fallback: T, accepts: (value: unknown) => value is T): T {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return accepts(value) ? value : fallback;
  } catch {
    console.warn('Lesson draft could not be restored.');
    return fallback;
  }
}

export function isVariantSelection(value: unknown): value is Record<number, number> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.entries(value).every(([key, id]) => /^\d+$/.test(key) && Number.isSafeInteger(id) && Number(id) > 0);
}
