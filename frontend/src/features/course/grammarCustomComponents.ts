import type { ComponentType } from 'react';
import NounDeclensionCategory from '@/features/custom-categories/categories/NounDeclensionCategory';
import VerbConjugationCategory from '@/features/custom-categories/categories/VerbConjugationCategory';
import VerbConjugationCategory1 from '@/features/custom-categories/categories/VerbConjugationCategory1';
import VerbConjugationCategory2 from '@/features/custom-categories/categories/VerbConjugationCategory2';
import VerbConjugationCategory3 from '@/features/custom-categories/categories/VerbConjugationCategory3';

/**
 * Реестр «черновых» интерактивных тренажёров, которые можно подставить вместо статичной
 * картинки таблицы у грамматического этапа курса (course_steps.custom_component) или
 * у блока custom_category в конструкторе уроков. Ключи должны совпадать с
 * App\Models\CourseStep::CUSTOM_COMPONENTS на бэкенде. Компоненты самодостаточны — без
 * обязательных props, безопасно монтировать где угодно.
 */
export const grammarCustomComponents: Record<string, ComponentType<Record<string, unknown>>> = {
  noun_declension: NounDeclensionCategory,
  verb_conjugation: VerbConjugationCategory,
  verb_conjugation_1: VerbConjugationCategory1,
  verb_conjugation_2: VerbConjugationCategory2,
  verb_conjugation_3: VerbConjugationCategory3,
};

export function getGrammarCustomComponent(key: string | null | undefined): ComponentType<Record<string, unknown>> | null {
  if (!key) return null;
  return grammarCustomComponents[key] ?? null;
}
