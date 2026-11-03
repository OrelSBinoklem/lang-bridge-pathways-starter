/**
 * Ключи 'dictionary_id:category_id' / 'category_id' категорий с кастомным React-шаблоном.
 *
 * Держим отдельно от customComponents.js (который импортирует сами тяжёлые компоненты)
 * намеренно: CategoryLayout.jsx -> utils/examenViewMode.js нужно только "есть ли шаблон",
 * а сами Category*.jsx компоненты (через VerbConjugationBase.jsx/NounDeclensionBase.jsx)
 * импортируют CategoryLayout.jsx. Если examenViewMode.js тянет полный customComponents.js
 * с самими компонентами, получается кольцевой импорт — в проде Turbopack иногда бандлит
 * это так, что default-экспорт компонента читается до его инициализации
 * ("Cannot access '<var>' before initialization" при SSR). Этот файл — без импортов
 * React-компонентов, только данные, чтобы кольца не было.
 */
export const CUSTOM_CATEGORY_KEYS = new Set([
  // Старый WP-словарь 20
  '20:1721',
  '20:1733',
  '20:1736',
  '20:1737',
  '20:1983',
  '20:1984',

  // Текущий словарь 21 (те же category id после импорта)
  '21:1721',
  '21:1733',
  '21:1736',
  '21:1737',
  '21:1983',
  '21:1984',

  // Fallback по category id
  '1721',
  '1733',
  '1736',
  '1737',
  '1983',
  '1984',
]);

export function hasCustomCategoryKey(dictionaryId, categoryId) {
  const exactKey = `${dictionaryId}:${categoryId}`;
  if (CUSTOM_CATEGORY_KEYS.has(exactKey)) return true;
  return CUSTOM_CATEGORY_KEYS.has(`${categoryId}`);
}
