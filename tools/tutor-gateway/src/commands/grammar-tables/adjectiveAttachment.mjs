import { sel } from './shared/pronoun.mjs';

export default {
  tableKey: 'adjectiveAttachment',
  summaryRu: "Jaunā brāļa māja · brāļa jaunā māja. Сначала выбираем, кого описывает прилагательное. Если человека-владельца, оно принимает генитив вместе с ним: jaunā brāļa, jaunās māsas. Если предмет, согласуется с предметом: jaunā māja, jaunais skapis, jaunajā mājā.",
  notesRu: ["Здесь специально тренируем определённые окончания и заданные связи, а не правило «в латышском всегда один порядок слов». Jauns о человеке — молодой, о предмете — новый. Генитив владельца не становится местным только потому, что главное слово стоит в местном.","Кружки подэтапов и личный прогресс не являются частью таблицы."],
  highlightTargets: {
    'all': { labelRu: "Jaunā brāļa māja · brāļa jaunā māja", selectors: sel('.table-adjective-attachment') },
    'rule': { labelRu: "Правило", selectors: sel('.tt-rule') },
    'warning': { labelRu: "Ограничение модели", selectors: sel('.tt-warning') },
    'target': { labelRu: "Признак", selectors: sel('.tt-target') },
    'person': { labelRu: "Человек", selectors: sel('.tt-person') },
    'thing': { labelRu: "Предмет", selectors: sel('.tt-thing') },
    'phrase': { labelRu: "Фраза", selectors: sel('.tt-phrase') },
    'youngbrother': { labelRu: "молодой брат · jaunā brāļa · māja · jaunā brāļa māja", selectors: sel('.tt-row-youngbrother') },
    'newhouse': { labelRu: "новый дом · brāļa · jaunā māja · brāļa jaunā māja", selectors: sel('.tt-row-newhouse') },
    'youngsister': { labelRu: "молодая сестра · jaunās māsas · skapis · jaunās māsas skapis", selectors: sel('.tt-row-youngsister') },
    'newwardrobe': { labelRu: "новый шкаф · māsas · jaunais skapis · māsas jaunais skapis", selectors: sel('.tt-row-newwardrobe') },
    'youngplace': { labelRu: "молодой брат · jaunā brāļa · mājā · jaunā brāļa mājā", selectors: sel('.tt-row-youngplace') },
    'newplace': { labelRu: "новый дом · brāļa · jaunajā mājā · brāļa jaunajā mājā", selectors: sel('.tt-row-newplace') },
  },
};

