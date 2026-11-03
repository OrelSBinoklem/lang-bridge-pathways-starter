import { collectDescendantIds, getCategoryProgress } from '@/features/training/helpers';
import type { CategoryNode } from '@/features/dictionaries/category-tree';
import type { CategoryPreviewData, CategoryPreviewGroup } from './types';
import topicArt from './topic-art.json';

export const normalizeCategoryText = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const categoryArtKey = (value: string) => normalizeCategoryText(value.replace(/^\d+[.)]\s*/, ''));
const thematicArtwork: Record<string, string> = Object.fromEntries(Object.entries(topicArt).map(([name, path]) => [categoryArtKey(name), path]));
export const thematicCategoryArt = (value: string) => thematicArtwork[categoryArtKey(value)] ?? null;
// Same level illustrations as the home-page studies, independent of category order.
const LEVEL_ART: Record<string, number> = { A1: 1763, A2: 1766, B1: 1765, B2: 1774 };
const ENGLISH_REFERENCE_ICONS: Record<string, string> = Object.fromEntries([
  ['Артикли', 'pi-tag'], ['Местоимения', 'pi-users'], ['Предлоги', 'pi-directions'],
  ['Числа', 'pi-hashtag'], ['Числительные', 'pi-hashtag'], ['Наречия', 'pi-gauge'],
  ['Союзы', 'pi-link'], ['Частицы', 'pi-sliders-h'], ['Междометия', 'pi-comment'],
  ['Вопросы', 'pi-question-circle'], ['Определители (дополнительно)', 'pi-filter'],
  ['Вспомогательные и модальные', 'pi-cog'], ['Частые глаголы · A1–A2', 'pi-bolt'],
  ['Обсуждать и решать · B1–B2', 'pi-comments'], ['Фразовые глаголы', 'pi-sitemap'],
  ['Неправильные глаголы', 'pi-sort-alt'], ['Узнаём прошедшее время', 'pi-history'],
  ['Третья форма глагола', 'pi-list'], ['Необычное множественное число', 'pi-clone'],
].map(([name, icon]) => [categoryArtKey(name), icon]));

function ordered(nodes: CategoryNode[]) {
  return [...nodes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
}

export function buildCategoryGroups(data: CategoryPreviewData, locale: string, artwork: Record<string, string>): CategoryPreviewGroup[] {
  const progress = Object.fromEntries((data.progress ?? []).map(row => [row.dict_word_id, row]));
  const localized = (node: CategoryNode) => node.name_translations?.[locale]?.trim() || node.name;
  const stats = (node: CategoryNode) => getCategoryProgress(data.words, progress, node.id, collectDescendantIds(node));
  // Rounding must not mark a nearly finished category as fully learned.
  const percent = (value: number) => value >= 1 ? 100 : Math.min(99, Math.round(value * 100));
  const art = (node: CategoryNode) => artwork[categoryArtKey(node.name)] ?? thematicCategoryArt(node.name);
  const uk = locale === 'uk';
  const descriptions: Record<string, string> = uk
    ? { A1: 'Перші розмови', A2: 'Повсякденне життя', B1: 'Впевнене спілкування', B2: 'Свобода висловлювання' }
    : { A1: 'Первые разговоры', A2: 'Повседневная жизнь', B1: 'Уверенное общение', B2: 'Свобода выражения' };
  return ordered(data.nodes).map(group => {
    const spansLevels = /\b[ABC][12]\s*[–—-]\s*[ABC][12]\b/i.test(group.name);
    const level = spansLevels ? '' : group.name.match(/\b[ABC][12]\b/i)?.[0].toUpperCase() ?? '';
    // Reference/lesson collections may mention B1/B2 without being a thematic course level.
    const courseLevel = /^(?:(?:тематический|тематичний)\s+)?[ABC][12]$/i.test(group.name.trim());
    const groupStats = stats(group);
    const children = ordered(group.children?.length ? group.children : [group]);
    const items = children.map(node => {
      const title = localized(node);
      const number = node.name.match(/^(\d+)[.)]\s*/)?.[1] ?? '';
      const itemStats = stats(node);
      const itemArt = art(node);
      return {
        id: node.id, title, number, label: title.replace(/^\d+[.)]\s*/, ''),
        wordCount: itemStats.total / 2,
        percent: data.progress === null ? null : percent(itemStats.progress),
        art: itemArt,
        icon: !itemArt && data.dictionary.learn_lang?.toLowerCase() === 'en' ? ENGLISH_REFERENCE_ICONS[categoryArtKey(node.name)] : undefined,
        href: `/dictionaries/${data.dictionary.id}/category/${node.id}`,
      };
    });
    return {
      id: group.id, level, title: localized(group), description: courseLevel ? descriptions[level] ?? localized(group) : localized(group),
      wordCount: groupStats.total / 2,
      percent: data.progress === null ? null : percent(groupStats.progress),
      items, art: courseLevel && LEVEL_ART[level] ? `/course/categories/transparent/${LEVEL_ART[level]}-light.webp`
        : art(group) ?? items.find(item => item.art)?.art ?? '/course/categories/transparent/1774-light.webp',
    };
  });
}

export function filterCategoryGroups(groups: CategoryPreviewGroup[], search: string, level: string): CategoryPreviewGroup[] {
  const tokens = normalizeCategoryText(search).split(' ').filter(Boolean);
  return groups.filter(group => !level || group.level === level).map(group => {
    const groupText = normalizeCategoryText(`${group.level} ${group.title}`);
    const items = group.items.filter(item => {
      const text = `${groupText} ${normalizeCategoryText(item.title)}`;
      return tokens.every(token => text.includes(token));
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);
}
