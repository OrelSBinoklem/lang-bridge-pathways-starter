import { sel } from './pronoun.mjs';

/**
 * Cards of the two "Части речи" tables. Card class: vk-card + tt-pos-<wordId(lv)>; inside: vk-card-head, vk-lv, vk-term,
 * vk-def, vk-examples with vk-chip.
 * items: [id, lv, term, ru, definition, examples]
 */
export function partTargets(items) {
  const targets = {};
  for (const [id, lv, term, ru, def, examples] of items) {
    const key = id.replace(/-/g, '_');
    targets[`pos_${key}`] = { labelRu: `Карточка «${lv}» (${term}, ${ru}): ${def} Примеры: ${examples.join(', ')}`, selectors: sel(`.tt-pos-${id}`) };
    targets[`pos_${key}_examples`] = { labelRu: `Примеры слов в карточке «${lv}»: ${examples.join(', ')}`, selectors: sel(`.tt-pos-${id} .vk-examples`) };
    targets[`pos_${key}_definition`] = { labelRu: `Определение в карточке «${lv}»`, selectors: sel(`.tt-pos-${id} .vk-def`) };
  }
  return targets;
}

export function commonPartTargets() {
  return {
    title: { labelRu: 'Заголовок таблицы', selectors: sel('.vs-head') },
    cards: { labelRu: 'Все карточки частей речи', selectors: sel('.vk-card') },
    card_titles: { labelRu: 'Названия частей речи (латышское, термин, русское)', selectors: sel('.vk-card-titles') },
    definitions: { labelRu: 'Определения частей речи', selectors: sel('.vk-def') },
    example_chips: { labelRu: 'Все примеры слов (чипсы)', selectors: sel('.vk-chip') },
  };
}
