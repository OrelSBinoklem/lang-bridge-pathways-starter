import { caseTargets, introTarget, sel } from './shared/pronoun.mjs';

/**
 * pron11 — reflexive pronoun "sev" (себя): one form column next to the case questions; the
 * nominative row has a dash because the pronoun has no nominative form.
 */
export default {
  tableKey: 'pron11',
  summaryRu:
    'Возвратное местоимение sev («себя»). Две колонки: вопрос падежа и форма. В именительном падеже прочерк, потому что у sev нет формы Kas?; остальные формы: sevis (Kā?), sev (Kam? — «себе»), sevi (Ko? — «себя»), sevī (Kur? — «в себе»).',
  notesRu: [
    'Именительный падеж отсутствует (в таблице стоит прочерк).',
    'Окончания выделены цветом; рядом с формой дан русский перевод.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица sev', selectors: sel('.card.table-pron11') },
    ...introTarget('pron11', 'Строка с местоимением sev и переводом'),
    ...caseTargets('.pron11-row'),
    endings: { labelRu: 'Цветные окончания форм sev', selectors: sel('.pron11-ending') },
    glosses: { labelRu: 'Русский перевод рядом с формами', selectors: sel('.pron11-gloss') },
  },
};
