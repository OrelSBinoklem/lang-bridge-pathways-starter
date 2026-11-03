import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'ageDative',
  summaryRu: "Cik tev ir gadu?. Человек стоит в дательном: man, tev, brālim, māsai. В модели возраста 1/21/31… — gads; 2–9 и составные числа с такой последней частью — gadi. С несклоняемыми 10–19, 20/30… принимаются gadu и gadi.",
  notesRu: ["Не смешивай эту модель с «он X лет от роду»: Viņam ir 5 gadi, но Viņš ir piecus gadus vecs. Все числа и люди в заданиях вымышленные; дробные возраста и другие падежные конструкции здесь не проверяются.", 'Кнопки подэтапов и личный прогресс не являются частью таблицы.'],
  highlightTargets: {
    'all': { labelRu: "Cik tev ir gadu?", selectors: sel('.table-age-dative') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'holder': { labelRu: "Кому?", selectors: sel('.tt-holder') },
    'number': { labelRu: "Число", selectors: sel('.tt-number') },
    'form': { labelRu: "Год / годы", selectors: sel('.tt-form') },
    'sentence': { labelRu: "Предложение", selectors: sel('.tt-sentence') },
    'one': { labelRu: "dēlam · 1 · gads · Dēlam ir 1 gads.", selectors: sel('.tt-row-one') },
    'two': { labelRu: "meitai · 2 · gadi · Meitai ir 2 gadi.", selectors: sel('.tt-row-two') },
    'eleven': { labelRu: "brālim · 11 · gadu / gadi · Brālim ir 11 gadu.", selectors: sel('.tt-row-eleven') },
    'twenty': { labelRu: "māsai · 20 · gadu / gadi · Māsai ir 20 gadi.", selectors: sel('.tt-row-twenty') },
    'twenty-one': { labelRu: "man · 21 · gads · Man ir 21 gads.", selectors: sel('.tt-row-twenty-one') },
    'twenty-two': { labelRu: "tev · 22 · gadi · Tev ir 22 gadi.", selectors: sel('.tt-row-twenty-two') },
  },
};
