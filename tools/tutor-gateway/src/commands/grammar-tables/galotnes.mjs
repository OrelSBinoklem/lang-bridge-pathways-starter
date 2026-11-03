import { sel } from './shared/pronoun.mjs';

/**
 * galotnes — «Основные условия использования неопределенных и определенных окончаний» (TableGalotnes): two columns
 * gl-col--indef (Nenoteiktā galotne, -s · -a) and gl-col--def (Noteiktā galotne, -ais · -ā), each a list of rules
 * (gl-rule + tt-rule-<id>) with a label, sentences (gl-sentence) or words (gl-word); the ending is marked gl-end.
 * NB: the rule "после mans, tavs, savs, mūsu, jūsu" has no examples in the component.
 */
const RULES = {
  'first-mention': ['indef', 'объект назван впервые (Ceļa malā aug liels ozols.)'],
  'after-quantifier': ['indef', 'после dažs, kāds, viens, jebkurš, šāds, tāds (kāda interesanta doma; viens sarkans krēsls)'],
  comparisons: ['indef', 'в сравнениях и устойчивых выражениях (Balts kā sniegs. Viegls kā spalva.)'],
  'already-mentioned': ['def', 'объект уже упоминался (Lielais ozols ir ļoti vecs.)'],
  'after-possessive': ['def', 'после mans, tavs, savs, mūsu, jūsu (примеров в таблице нет)'],
  ordinals: ['def', 'порядковые числительные (ceturtais, piektais)'],
  position: ['def', 'прилагательные положения и порядка (vidējais, tuvākais)'],
  terms: ['def', 'термины и названия видов (melnais caurums, zaļā tēja)'],
  geographic: ['def', 'географические названия (Klusais okeāns, Sarkanā jūra)'],
  institutions: ['def', 'названия учреждений (Nacionālā bibliotēka, Centrālā banka)'],
  nominalized: ['def', 'существительные от прилагательных (dzeramais, jaunākais)'],
};

export default {
  tableKey: 'galotnes',
  summaryRu:
    'Когда использовать неопределённые (-s, -a) и определённые (-ais, -ā) окончания прилагательных. Nenoteiktā galotne (неопределённое, -s · -a): объект назван впервые — Ceļa malā aug liels ozols.; после dažs, kāds, viens, jebkurš, šāds, tāds — Man ir kāda interesanta doma. / Viens sarkans krēsls stāv stūrī.; в сравнениях и устойчивых выражениях — Balts kā sniegs. / Viegls kā spalva. Noteiktā galotne (определённое, -ais · -ā): объект уже упоминался — Lielais ozols ir ļoti vecs.; после mans, tavs, savs, mūsu, jūsu; порядковые числительные (ceturtais, piektais); прилагательные положения и порядка (vidējais, tuvākais); термины и названия видов (melnais caurums, zaļā tēja); географические названия (Klusais okeāns, Sarkanā jūra); названия учреждений (Nacionālā bibliotēka, Centrālā banka); существительные от прилагательных (dzeramais, jaunākais).',
  notesRu: [
    'Окончания в примерах выделены отдельным цветом.',
    'В правиле «после mans, tavs, savs, mūsu, jūsu» примеров в таблице нет.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про определённые и неопределённые окончания', selectors: sel('.card.table-galotnes') },
    title: { labelRu: 'Заголовок таблицы', selectors: sel('.vs-head') },
    column_indefinite: { labelRu: 'Колонка Nenoteiktā galotne (неопределённое, -s · -a)', selectors: sel('.gl-col--indef') },
    column_definite: { labelRu: 'Колонка Noteiktā galotne (определённое, -ais · -ā)', selectors: sel('.gl-col--def') },
    column_heads: { labelRu: 'Названия колонок с окончаниями', selectors: sel('.gl-col-head') },
    endings_summary: { labelRu: 'Плашки окончаний в шапках колонок (-s · -a и -ais · -ā)', selectors: sel('.gl-endings') },
    rules: { labelRu: 'Все правила', selectors: sel('.gl-rule') },
    rule_labels: { labelRu: 'Формулировки правил', selectors: sel('.gl-label') },
    sentences: { labelRu: 'Предложения-примеры', selectors: sel('.gl-sentence') },
    words: { labelRu: 'Слова-примеры', selectors: sel('.gl-word') },
    endings_in_examples: { labelRu: 'Окончания, выделенные в примерах', selectors: sel('.gl-end') },
    translations: { labelRu: 'Русские переводы примеров', selectors: sel('.gl-gloss') },
    ...Object.fromEntries(
      Object.entries(RULES).map(([id, [col, ru]]) => [
        `rule_${id.replace(/-/g, '_')}`,
        { labelRu: `${col === 'indef' ? 'Неопределённое' : 'Определённое'}: ${ru}`, selectors: sel(`.tt-rule-${id}`) },
      ]),
    ),
  },
};
