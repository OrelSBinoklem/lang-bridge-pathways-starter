import { sel } from './shared/pronoun.mjs';

/**
 * divdabjaTeiciens — «Причастный оборот» (TableDivdabjaTeiciens): intro, four participle types
 * (dt-type + tt-type-act | pas | dams | ot) each with name/endings/example, and a block "Запятые" with the phrase in
 * three positions (dt-pos + tt-pos-start | end | middle). In examples the phrase is dt-phrase, the participle dt-part,
 * commas dt-comma.
 */
export default {
  tableKey: 'divdabjaTeiciens',
  summaryRu:
    'Причастный оборот (divdabja teiciens) — обособленная группа слов, в основе которой причастие и хотя бы одно зависящее от него слово. Четыре типа: 1) Lokāmais darāmās kārtas pagātnes (-is · -usi · -ies · -usies): Jau no mazotnes pie tādas dzīves pieradusi, viņa prata samierināties. 2) Lokāmais ciešamās kārtas pagātnes (-ts · -ta): Dusmu pārņemts, devos viņu virzienā. 3) Daļēji lokāmais (-dams · -dama · -damies · -damās): Bērni, pie zariem turēdamies, kāpa lejup no kalna. 4) Nelokāmais (-ot · -oties): Saulei austot, mēs devāmies ceļā. Запятые: оборот отделяют всегда — в начале (запятая после), в конце (запятая перед), в середине (запятые с обеих сторон): Saulei austot, mēs devāmies ceļā. / Mēs devāmies ceļā, saulei austot. / Mēs, saulei austot, devāmies ceļā.',
  notesRu: ['В примерах оборот выделен цветом целиком, причастие внутри него — отдельно, запятые тоже отмечены.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про причастный оборот', selectors: sel('.card.table-divdabja-teiciens') },
    title: { labelRu: 'Заголовок «Причастный оборот»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Определение причастного оборота', selectors: sel('.dt-intro') },
    types: { labelRu: 'Все четыре типа причастий', selectors: sel('.dt-type') },
    type_active_past: { labelRu: 'Lokāmais darāmās kārtas pagātnes (-is, -usi, -ies, -usies)', selectors: sel('.tt-type-act') },
    type_passive_past: { labelRu: 'Lokāmais ciešamās kārtas pagātnes (-ts, -ta)', selectors: sel('.tt-type-pas') },
    type_dams: { labelRu: 'Daļēji lokāmais (-dams, -dama, -damies, -damās)', selectors: sel('.tt-type-dams') },
    type_ot: { labelRu: 'Nelokāmais (-ot, -oties)', selectors: sel('.tt-type-ot') },
    type_names: { labelRu: 'Названия типов причастий', selectors: sel('.dt-name') },
    endings: { labelRu: 'Окончания причастий каждого типа', selectors: sel('.dt-endings') },
    examples_lv: { labelRu: 'Латышские примеры', selectors: sel('.dt-type .dt-lv') },
    translations: { labelRu: 'Русские переводы примеров', selectors: sel('.dt-ru') },
    phrases: { labelRu: 'Причастные обороты в примерах (выделены)', selectors: sel('.dt-phrase') },
    participles: { labelRu: 'Сами причастия внутри оборотов (выделены)', selectors: sel('.dt-part') },
    commas: { labelRu: 'Запятые около оборотов', selectors: sel('.dt-comma') },
    comma_block: { labelRu: 'Блок «Запятые: оборот отделяют всегда»', selectors: sel('.dt-commas') },
    position_start: { labelRu: 'Оборот в начале — запятая после', selectors: sel('.tt-pos-start') },
    position_end: { labelRu: 'Оборот в конце — запятая перед', selectors: sel('.tt-pos-end') },
    position_middle: { labelRu: 'Оборот в середине — запятые с обеих сторон', selectors: sel('.tt-pos-middle') },
  },
};
