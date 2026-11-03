'use client';

import { useLocale } from 'next-intl';
import styles from './category-vocabulary-audit.module.css';

export type LearningLoad = {
  status: 'review' | 'not_certified' | 'unmapped';
  context: { level: string; phase: 'start' | 'early' | 'working' | 'exit'; topic_number: number; topics_in_level: number } | null;
  metrics: { body_words: number; condition_words: number; longest_sentence_words: number; longest_question_words: number; question_count: number; longest_turn_words: number | null };
  flags: { code: string; actual: number; limit: number; evidence: string }[];
  grammar_cues: string[];
  grammar_review: string;
  answer_requirement: string | null;
};

const labels = {
  ru: {
    title: 'Учебная нагрузка', topic: 'Тема', phases: { start: 'Старт с нуля', early: 'Начало уровня', working: 'Основная часть', exit: 'Завершение уровня' },
    body: 'Слов в тексте', sentence: 'Самое длинное предложение', question: 'Самый длинный вопрос', questions: 'Утверждений', turn: 'Самая длинная реплика', conditions: 'Слов в условии',
    limit: 'ориентир', codes: { body_length: 'Объём текста', sentence_length: 'Длина предложения', question_length: 'Длина вопроса', question_count: 'Число утверждений', turn_length: 'Длина реплики', condition_length: 'Объём условия' },
    warning: 'Это редакционные ориентиры, не оценка CEFR или знаний ученика.', grammar: 'Последовательность грамматики ещё требует редакторской проверки.', cues: 'Наблюдаемые связки',
    unmapped: 'Место задания в уровне не определено; ограничения не назначены.', noFlags: 'Превышений по измеренным параметрам нет. Понятность текста этим не подтверждается.',
    productive: 'Требования к самостоятельному ответу здесь не вычисляются: анализируются только сохранённые вопросы и условия.',
  },
  uk: {
    title: 'Навчальне навантаження', topic: 'Тема', phases: { start: 'Старт з нуля', early: 'Початок рівня', working: 'Основна частина', exit: 'Завершення рівня' },
    body: 'Слів у тексті', sentence: 'Найдовше речення', question: 'Найдовше запитання', questions: 'Тверджень', turn: 'Найдовша репліка', conditions: 'Слів в умові',
    limit: 'орієнтир', codes: { body_length: 'Обсяг тексту', sentence_length: 'Довжина речення', question_length: 'Довжина запитання', question_count: 'Кількість тверджень', turn_length: 'Довжина репліки', condition_length: 'Обсяг умови' },
    warning: 'Це редакційні орієнтири, не оцінка CEFR або знань учня.', grammar: 'Послідовність граматики ще потребує редакторської перевірки.', cues: 'Спостережувані зв’язки',
    unmapped: 'Місце завдання в рівні не визначено; обмеження не призначені.', noFlags: 'Перевищень за виміряними параметрами немає. Зрозумілість тексту цим не підтверджується.',
    productive: 'Вимоги до самостійної відповіді тут не обчислюються: аналізуються лише збережені запитання та умови.',
  },
};

export function LearningLoadDetails({ report }: { report: LearningLoad }) {
  const t = labels[useLocale() === 'uk' ? 'uk' : 'ru'];
  const m = report.metrics;
  return <section className={styles.learningLoad} aria-label={t.title}>
    <h4>{t.title}</h4>
    {report.context ? <p>{report.context.level} · {t.topic} {report.context.topic_number}/{report.context.topics_in_level} · {t.phases[report.context.phase]}</p> : <p>{t.unmapped}</p>}
    <dl className={styles.loadMetrics}>
      {[[t.body, m.body_words], [t.sentence, m.longest_sentence_words], [t.question, m.longest_question_words],
        [t.questions, m.question_count], [t.conditions, m.condition_words], ...(m.longest_turn_words === null ? [] : [[t.turn, m.longest_turn_words]])].map(([label, value]) =>
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    {report.flags.length ? <ul className={styles.loadFlags}>{report.flags.map(flag => <li key={flag.code}>
      <strong>{t.codes[flag.code as keyof typeof t.codes] ?? flag.code}: {flag.actual}</strong> ({t.limit}: {flag.limit})
      {flag.evidence && <blockquote>{flag.evidence}</blockquote>}
    </li>)}</ul> : report.context && <p>{t.noFlags}</p>}
    {report.grammar_cues.length > 0 && <p>{t.cues}: {report.grammar_cues.join(', ')}</p>}
    <p className={styles.sourceNote}>{t.grammar} {t.warning}</p>
    {report.answer_requirement && <p className={styles.sourceNote}>{t.productive}</p>}
  </section>;
}
