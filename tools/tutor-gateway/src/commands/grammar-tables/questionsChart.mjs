import { sel } from './shared/pronoun.mjs';

/**
 * questionsChart — вопросительные слова. Two tables side by side (tt-questions-left /
 * tt-questions-right); each row is one question with its Russian meaning and examples.
 * Component classes: tt-q-<id> on every row, ids listed below.
 */
const QUESTIONS = {
  kas: 'Kas? — Кто? Что?',
  vai: 'Vai? — вопрос без вопросительного слова («А …?»), на него отвечают да или нет',
  ka: 'Kā? — Как? Чьё? Кого? Чего?',
  kam: 'Kam? — Кому? Чему? у кого?',
  ko: 'Ko? — Кого? Что?',
  'ar-ko': 'Ar ko? — С кем? Чем? на чём?',
  'par-ko': 'Par ko? — О ком? о чём?',
  kur: 'Kur? — Где? в чём?',
  kad: 'Kad? — Когда?',
  'ko-dara': 'Ko dara? — Что делают?',
  cik: 'Cik? — Сколько?',
  cikos: 'Cikos? — Во сколько?',
  kapec: 'Kāpēc? — Почему?',
  kadel: 'Kādēļ? — Из-за чего?',
  'no-kurienes': 'No kurienes? — Откуда?',
  'uz-kurieni': 'Uz kurieni? — Куда?',
  kads: 'Kāds? Kāda? Kādi? Kādas? — Какой? Какая? Какие?',
  kurs: 'Kurš? Kura? Kuri? Kuras? — Который? Которая? Которые?',
};

const rows = (...ids) => ids.map((id) => ({ selector: `.tt-q-${id}` }));

const questionTargets = Object.fromEntries(
  Object.entries(QUESTIONS).map(([id, labelRu]) => [`question_${id.replace(/-/g, '_')}`, { labelRu, selectors: rows(id) }]),
);

export default {
  tableKey: 'questionsChart',
  summaryRu:
    'Вопросительные слова латышского языка: 18 вопросов в двух таблицах. Слева падежные вопросы (Kas? Kā? Kam? Ko? Ar ko? Par ko? Kur?) и Vai?, Kad?, Ko dara?; справа Cik?, Cikos?, Kāpēc?, Kādēļ?, No kurienes?, Uz kurieni?, Kāds?, Kurš?. К каждому вопросу даны русский перевод и примеры предложений.',
  notesRu: [
    'В русских переводах цветом выделены особые значения: «А .....?» у Vai?, «Чьё?» у Kā?, «у кого?» у Kam?, «на чём?» у Ar ko?, «в чём?» у Kur?.',
    'Kur? (где), No kurienes? (откуда) и Uz kurieni? (куда) образуют вопросы места и направления.',
    'В строке Cik? дан вопрос о возрасте: Cik tev ir gadu? — Сколько тебе лет? Задания возраста привязаны сюда; их подробное правило остаётся в уроке.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица вопросов', selectors: sel('.card.table-questions-chart') },
    left_table: { labelRu: 'Левая таблица: падежные и основные вопросы', selectors: sel('.tt-questions-left') },
    right_table: { labelRu: 'Правая таблица: количество, время, причина, направление, какой/который', selectors: sel('.tt-questions-right') },
    questions: { labelRu: 'Колонка с латышскими вопросами', selectors: sel('.q-lv') },
    translations: { labelRu: 'Колонка с русским переводом вопросов', selectors: sel('.q-ru') },
    examples: { labelRu: 'Колонка с примерами предложений', selectors: sel('.q-ex') },
    special_meanings: {
      labelRu: 'Особые значения в переводе, выделенные цветом (Чьё? у кого? на чём? в чём? А …?)',
      selectors: sel('.q-ru-highlight'),
    },
    case_questions: {
      labelRu: 'Падежные вопросы: Kas? Kā? Kam? Ko? Ar ko? Par ko? Kur?',
      selectors: rows('kas', 'ka', 'kam', 'ko', 'ar-ko', 'par-ko', 'kur'),
    },
    time_questions: { labelRu: 'Вопросы времени: Kad? и Cikos?', selectors: rows('kad', 'cikos') },
    reason_questions: { labelRu: 'Вопросы причины: Kāpēc? и Kādēļ?', selectors: rows('kapec', 'kadel') },
    place_and_direction: {
      labelRu: 'Вопросы места и направления: Kur? No kurienes? Uz kurieni?',
      selectors: rows('kur', 'no-kurienes', 'uz-kurieni'),
    },
    adjective_questions: {
      labelRu: 'Вопросы «какой» и «который»: Kāds? и Kurš?',
      selectors: rows('kads', 'kurs'),
    },
    ...questionTargets,
  },
};
