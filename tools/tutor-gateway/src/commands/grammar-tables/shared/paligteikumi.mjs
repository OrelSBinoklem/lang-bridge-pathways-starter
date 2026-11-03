import { sel } from './pronoun.mjs';
import { wordId } from './words.mjs';

/**
 * Shared targets of the three "palīgteikumi" tables (component classes, see TablePaligteikumi/Paligteikumi.jsx):
 * every type card is `pt-type tt-type-<wordId(lv)>` with head (pt-type-head), position pills (pt-pill, active one
 * pt-pill--on: после / внутри / перед), question (pt-q), conjunctions (pt-words), sample (pt-sample; the subordinate
 * clause is pt-sub, commas pt-comma).
 */
export const POSITION_RU = { aiz: 'после главного', starp: 'внутри главного', pirms: 'перед главным' };

/** types: [lv, ru, q, words, [positions]] */
export function typeTargets(types) {
  const targets = {};
  for (const [lv, ru, q, words, pos] of types) {
    const id = wordId(lv).replace(/-/g, '_');
    targets[`type_${id}`] = {
      labelRu: `${lv} (${ru}): вопрос ${q}; союзы: ${words}; может стоять: ${pos.map((p) => POSITION_RU[p]).join(', ')}`,
      selectors: sel(`.tt-type-${wordId(lv)}`),
    };
  }
  return targets;
}

/** Targets common to the tables with type cards. */
export function commonCardTargets() {
  return {
    reference_conjunctions: { labelRu: 'Связующие слова в справочнике', selectors: sel('.tt-card-words') },
    legend: { labelRu: 'Легенда: palīgteikums — придаточное, плашка позиции', selectors: sel('.pt-legend') },
    cards: { labelRu: 'Все карточки типов придаточных', selectors: sel('.pt-type') },
    type_names: { labelRu: 'Названия типов придаточных', selectors: sel('.pt-type-name') },
    positions: { labelRu: 'Плашки позиций придаточного (после / внутри / перед)', selectors: sel('.pt-pos') },
    active_positions: { labelRu: 'Только активные позиции (где придаточное может стоять)', selectors: sel('.pt-pill--on') },
    questions: { labelRu: 'Вопросы, по которым определяют тип придаточного', selectors: sel('.pt-q') },
    conjunctions: { labelRu: 'Союзы и союзные слова каждого типа', selectors: sel('.pt-words') },
    samples: { labelRu: 'Примеры предложений', selectors: sel('.pt-sample') },
    subordinate_clauses: { labelRu: 'Придаточные части в примерах (выделены)', selectors: sel('.pt-sub') },
    commas: { labelRu: 'Запятые в примерах', selectors: sel('.pt-comma') },
    translations: { labelRu: 'Русские переводы примеров', selectors: sel('.pt-sample-ru') },
  };
}
