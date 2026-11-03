import { sel, caseTargets } from './shared/pronoun.mjs';

/**
 * adjEndings — Īpašības vārdu galotnes (окончания прилагательных). Columns: case question | masculine (V)
 * indefinite + definite | feminine (S) indefinite + definite. Upper block is the singular, below the
 * "Daudzskaitlis" sub-header comes the plural. The table has no column captions for indefinite/definite:
 * the second column of each gender is the one with the inserted -aj- (definite form).
 * Component classes (TableAdjEndings.jsx):
 *   rows:   tt-nominative | tt-genitive | tt-dative | tt-accusative | tt-locative  +  tt-singular | tt-plural
 *   cells:  tt-case-head | tt-masculine | tt-feminine  +  tt-indefinite | tt-definite
 *   header: th.tt-masculine (V), th.tt-feminine (S); sub-header row tt-plural-head
 */
const CASES = {
  nominative: 'именительный (kas?)',
  genitive: 'родительный (kā?)',
  dative: 'дательный (kam?)',
  accusative: 'винительный (ko?)',
  locative: 'местный (kur? kad?)',
};
const GENDERS = { masculine: 'мужской род (V)', feminine: 'женский род (S)' };
const DEFINITENESS = { indefinite: 'без -aj- (неопределённая форма)', definite: 'с -aj- (определённая форма)' };
const NUMBERS = { singular: 'единственное число', plural: 'множественное число' };

const grid = {};
for (const [number, numberRu] of Object.entries(NUMBERS)) {
  for (const [kase, caseRu] of Object.entries(CASES)) {
    for (const [gender, genderRu] of Object.entries(GENDERS)) {
      for (const [definiteness, definitenessRu] of Object.entries(DEFINITENESS)) {
        grid[`ending_${number}_${kase}_${gender}_${definiteness}`] = {
          labelRu: `Окончание: ${numberRu}, ${caseRu}, ${genderRu}, ${definitenessRu}`,
          selectors: sel(`tr.tt-${number}.tt-${kase} td.tt-${gender}.tt-${definiteness}`),
        };
      }
    }
  }
}

const caseRows = {};
for (const [number, numberRu] of Object.entries(NUMBERS)) {
  for (const [kase, caseRu] of Object.entries(CASES)) {
    caseRows[`${number}_${kase}`] = { labelRu: `Строка: ${numberRu}, ${caseRu}`, selectors: sel(`tr.tt-${number}.tt-${kase}`) };
  }
}

export default {
  tableKey: 'adjEndings',
  summaryRu:
    'Окончания прилагательных (īpašības vārdu galotnes) по падежам, родам и числам. Столбцы: V (мужской род) и S (женский род), у каждого две колонки — обычная форма и форма со вставкой -aj- (определённая). Единственное число: nominatīvs -s/-š, -ais (м.), -a, -ā (ж.); ģenitīvs -a, -ā, -as, -ās; datīvs -am, -ajam, -ai, -ajai; akuzatīvs -u, -o, -u, -o; lokatīvs -ā, -ajā, -ā, -ajā. Ниже блок «Daudzskaitlis» (множественное число): -i, -ie, -as, -ās; -u, -o, -u, -o; -iem, -ajiem, -ām, -ajām; -us, -os, -as, -ās; -os, -ajos, -ās, -ajās.',
  notesRu: [
    'У колонок нет подписей «неопределённая / определённая»: вторая колонка каждого рода — форма со вставкой -aj- (она выделена в самой таблице).',
    'Цветом в таблице выделены окончание -o и вставка aj.',
  ],
  highlightTargets: {
    reference_indefinite: { labelRu: 'Неопределённые окончания в справочнике', selectors: sel('.tt-indefinite') },
    reference_locative: { labelRu: 'Местный падеж в справочнике', selectors: sel('.tt-locative') },
    all: { labelRu: 'Вся таблица окончаний прилагательных', selectors: sel('.card.table-adj-endings') },
    masculine: { labelRu: 'Мужской род (V): заголовок и обе колонки', selectors: sel('.tt-masculine') },
    feminine: { labelRu: 'Женский род (S): заголовок и обе колонки', selectors: sel('.tt-feminine') },
    header_gender: { labelRu: 'Заголовки V и S', selectors: sel('thead th.tt-masculine', 'thead th.tt-feminine') },
    singular: { labelRu: 'Единственное число (верхний блок)', selectors: sel('tr.tt-singular') },
    plural: { labelRu: 'Множественное число («Daudzskaitlis»)', selectors: sel('tr.tt-plural', 'tr.tt-plural-head') },
    plural_header: { labelRu: 'Подзаголовок «Daudzskaitlis»', selectors: sel('tr.tt-plural-head') },
    indefinite: { labelRu: 'Колонки без вставки -aj- (обычные формы)', selectors: sel('td.tt-indefinite') },
    definite: { labelRu: 'Колонки со вставкой -aj- (определённые формы)', selectors: sel('td.tt-definite') },
    aj_insert: { labelRu: 'Вставка «aj» в определённых формах (-ajam, -ajai, -ajā, -ajiem, -ajām, -ajos, -ajās)', selectors: sel('.aj') },
    o_endings: { labelRu: 'Окончание -o, выделенное цветом', selectors: sel('.c3') },
    ...caseTargets('tbody tr'),
    ...caseRows,
    ...grid,
  },
};
