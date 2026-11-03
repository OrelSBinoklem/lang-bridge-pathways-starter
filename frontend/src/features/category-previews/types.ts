import type { CategoryNode, Dictionary } from '@/features/dictionaries/category-tree';
import type { DictWord, ProgressRow } from '@/features/training/helpers';

export const CATEGORY_DESIGNS = ['original', 'glass-shelves', 'paper-catalog', 'editorial-atlas', 'product-vitrines', 'color-ribbons', 'glass-mastery', 'paper-mastery', 'vitrines-mastery', 'clean-progress', 'diamond-lab'] as const;
export type CategoryDesign = typeof CATEGORY_DESIGNS[number];
export type VisualCategoryDesign = Exclude<CategoryDesign, 'clean-progress' | 'original'>;

export const DESIGN_TITLES: Record<CategoryDesign, { ru: string; uk: string; subtitle: string; subtitleUk: string }> = {
  original: { ru: 'Старое оформление', uk: 'Попереднє оформлення', subtitle: '', subtitleUk: '' },
  'glass-shelves': { ru: 'Стеклянные полки', uk: 'Скляні полиці', subtitle: 'Цвет, свет и немного воздуха.', subtitleUk: 'Колір, світло й трохи повітря.' },
  'paper-catalog': { ru: 'Картотека путешественника', uk: 'Картотека мандрівника', subtitle: 'У каждой темы — своя история.', subtitleUk: 'У кожної теми — своя історія.' },
  'editorial-atlas': { ru: 'Редакционный атлас', uk: 'Редакційний атлас', subtitle: 'Большая картина. Маленькие открытия.', subtitleUk: 'Велика картина. Маленькі відкриття.' },
  'product-vitrines': { ru: 'Витрины тем', uk: 'Вітрини тем', subtitle: 'Слова начинаются с любопытства.', subtitleUk: 'Слова починаються з цікавості.' },
  'color-ribbons': { ru: 'Цветные ленты', uk: 'Кольорові стрічки', subtitle: 'Твой язык связывает всё.', subtitleUk: 'Твоя мова поєднує все.' },
  'glass-mastery': { ru: 'Стекло · достижения', uk: 'Скло · досягнення', subtitle: 'Твой прогресс меняет всю картину.', subtitleUk: 'Твій прогрес змінює всю картину.' },
  'paper-mastery': { ru: 'Картотека · металлы', uk: 'Картотека · метали', subtitle: 'Знания обретают свой цвет.', subtitleUk: 'Знання набувають свого кольору.' },
  'vitrines-mastery': { ru: 'Витрины · драгоценности', uk: 'Вітрини · коштовності', subtitle: 'От первых слов — до бриллианта.', subtitleUk: 'Від перших слів — до діаманта.' },
  'clean-progress': { ru: 'Чистый · новые полоски', uk: 'Чистий · нові смужки', subtitle: '', subtitleUk: '' },
  'diamond-lab': { ru: 'Бриллиант · три оправы', uk: 'Діамант · три оправи', subtitle: 'Штамп, камни по углам и переливающаяся оправа.', subtitleUk: 'Штамп, камені в кутах та переливчаста оправа.' },
};

export type CategoryPreviewItem = {
  id: number; title: string; number: string; label: string;
  wordCount: number; percent: number | null; art: string | null; icon?: string; href: string;
};
export type CategoryPreviewGroup = {
  id: number; level: string; title: string; description: string;
  percent: number | null; wordCount: number; items: CategoryPreviewItem[]; art: string | null;
};
export type DiamondTreatment = 'stamp' | 'corners' | 'setting';
export type LayoutProps = { groups: CategoryPreviewGroup[]; uk: boolean; mastery?: boolean; diamondTreatment?: DiamondTreatment };
export type CategoryPreviewData = {
  dictionary: Dictionary; nodes: CategoryNode[]; words: DictWord[]; progress: ProgressRow[] | null;
};
export type CategoryPreviewContent = {
  dictionary: Dictionary; groups: CategoryPreviewGroup[]; progressAvailable: boolean;
};
