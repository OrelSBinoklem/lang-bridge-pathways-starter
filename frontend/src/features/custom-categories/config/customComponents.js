/**
 * Привязка кастомных React-шаблонов к словарям/категориям.
 *
 * Ключ:
 * - 'dictionary_id:category_id' — точное совпадение
 * - 'category_id' — категория в любом словаре
 */

import VerbConjugationCategory from '../categories/VerbConjugationCategory';
import VerbConjugationCategory1 from '../categories/VerbConjugationCategory1';
import VerbConjugationCategory2 from '../categories/VerbConjugationCategory2';
import VerbConjugationCategory3 from '../categories/VerbConjugationCategory3';
import NounDeclensionCategory from '../categories/NounDeclensionCategory';
import { CUSTOM_CATEGORY_KEYS } from './customComponentKeys';

/** @type {Record<string, import('react').ComponentType<any>>} */
export const customCategoryComponents = {
  // Старый WP-словарь 20
  '20:1721': VerbConjugationCategory,
  '20:1733': VerbConjugationCategory,
  '20:1736': VerbConjugationCategory1,
  '20:1737': VerbConjugationCategory2,
  '20:1983': VerbConjugationCategory3,
  '20:1984': NounDeclensionCategory,

  // Текущий словарь 21 (те же category id после импорта)
  '21:1721': VerbConjugationCategory,
  '21:1733': VerbConjugationCategory,
  '21:1736': VerbConjugationCategory1,
  '21:1737': VerbConjugationCategory2,
  '21:1983': VerbConjugationCategory3,
  '21:1984': NounDeclensionCategory,

  // Fallback по category id
  1721: VerbConjugationCategory,
  1733: VerbConjugationCategory,
  1736: VerbConjugationCategory1,
  1737: VerbConjugationCategory2,
  1983: VerbConjugationCategory3,
  1984: NounDeclensionCategory,
};

export const usesInlineFieldTraining = (dictionaryId, categoryId) => {
  const exact = `${dictionaryId}:${categoryId}`;
  return (
    CUSTOM_CATEGORY_KEYS.has(exact) || CUSTOM_CATEGORY_KEYS.has(`${categoryId}`)
  );
};

export const getCustomCategoryComponent = (dictionaryId, categoryId) => {
  const exactKey = `${dictionaryId}:${categoryId}`;
  if (customCategoryComponents[exactKey]) return customCategoryComponents[exactKey];
  const categoryKey = `${categoryId}`;
  if (customCategoryComponents[categoryKey]) return customCategoryComponents[categoryKey];
  return null;
};
