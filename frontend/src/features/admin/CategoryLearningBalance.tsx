'use client';

import { useLocale } from 'next-intl';
import { useState } from 'react';
import styles from './category-vocabulary-audit.module.css';
import { TaskWordInspector, type WordInspectionContext } from './TaskWordInspector';
import { LearningLoadDetails, type LearningLoad } from './LearningLoadDetails';

type Bucket = 'dictionary' | 'elaipa_extra' | 'future' | 'unmatched' | 'ambiguous';
type Relation = 'current' | 'previous' | 'future' | 'elsewhere' | 'missing' | 'ambiguous';
type Evidence = { id: number; word: string; relation: Relation; categories: { id: number; path: string }[] };
type Word = { word: string; count: number; bucket: Bucket; lemmas: string[]; matches: Evidence[]; review_required: boolean; elaipa_present: boolean };
type Metric = { total: number; buckets: Record<Bucket, number>; dictionary_percent: number | null; whole_dictionary_count: number; whole_dictionary_percent: number | null; combined_percent: number | null; words?: Word[] };
type Task = { block_id: number; variant_id: number | null; variant: number; skill: string; title: string; url: string; scope: string; learner_text: string; metric: Metric; learning_load?: LearningLoad };
type ReverseWord = { word: string; forms: string[]; frequency: number; status: Relation; matches: Evidence[]; review_required: boolean };
export type LearningBalanceReport = {
  course_group: { title: string; level: string } | null; topic_available: boolean; order_available: boolean;
  source_basis: string; tasks_counted: number | null;
  reverse: { total: number; missing_before_and_now: number; summary: Record<Relation, number>; words: ReverseWord[] };
  comparisons: Record<'receptive' | 'productive', { rows: Task[]; without_text: number }>;
};

const labels = {
  ru: {
    reverse: 'Недостающие слова', receptive: 'Чтение и слушание', productive: 'Письмо и говорение',
    needs: 'Нет в текущей и предыдущих категориях', all: 'Все слова темы', search: 'Найти слово',
    word: 'Слово E-Laipa', relation: 'В нашем словаре', frequency: 'Употреблений в теме', forms: 'Формы в теме',
    current: 'Есть сейчас', previous: 'Есть раньше', future: 'Есть только дальше', elsewhere: 'Есть вне последовательности', missing: 'Нет в словаре', ambiguous: 'Нужна проверка',
    noTopic: 'Выберите тему E-Laipa для обратного сравнения.', noGroup: 'Категория не привязана к одной группе курса. Порядок предыдущих категорий и задания группы не определены.',
    source: 'Источник: все употребления в текстовой разметке заданий E-Laipa; озвучка без расшифровки не входит в индекс.',
    fallback: 'Полный индекс тем недоступен: показаны только первые появления из прежнего JSON.',
    review: 'Начальная форма получена без контекста; проверьте совпадение.', empty: 'Нет записей по выбранному фильтру.',
    task: 'Задание', variant: 'Вариант', allVariants: 'Все варианты', allSkills: 'Оба навыка',
    dictionary: 'Введено к этому этапу', whole: 'Есть во всём словаре', combined: 'Словарь + E-Laipa до текущей темы', elaipa_extra: 'Добавляет E-Laipa', unmatched: 'Не подтверждено',
    allTaskWords: 'Все слова задания', intersection: 'Есть в E-Laipa (любая тема)', wordFilter: 'Слова задания',
    input: 'Вопросы и тексты задания',
    load: 'Нагрузка', loadAll: 'Все задания', loadReview: 'Есть превышения', loadMeasured: 'Измерено', loadUnmapped: 'Порядок не определён',
    noText: 'В сохранённом задании нет текста на латышском', noTasks: 'Опубликованных заданий этой группы нет.',
    reading: 'Чтение', listening: 'Слушание', writing: 'Письмо', speaking: 'Говорение',
    showWords: 'Слова и источники', tokens: 'Словоупотреблений', gap: 'Пробел словаря, а не доказательство незнания ученика.',
    receptiveNote: 'Сравниваются тексты, диалоги, вопросы и варианты ответа. Новая лексика здесь может быть частью учебной задачи.',
    productiveNote: 'Сравниваются вопросы и условия, которые получает ученик, включая латышские слова в русских инструкциях.',
  },
  uk: {
    reverse: 'Відсутні слова', receptive: 'Читання і слухання', productive: 'Письмо і говоріння',
    needs: 'Немає в поточній і попередніх категоріях', all: 'Усі слова теми', search: 'Знайти слово',
    word: 'Слово E-Laipa', relation: 'У нашому словнику', frequency: 'Уживань у темі', forms: 'Форми в темі',
    current: 'Є зараз', previous: 'Є раніше', future: 'Є лише далі', elsewhere: 'Є поза послідовністю', missing: 'Немає у словнику', ambiguous: 'Потрібна перевірка',
    noTopic: 'Виберіть тему E-Laipa для зворотного порівняння.', noGroup: 'Категорія не прив’язана до однієї групи курсу. Порядок попередніх категорій і завдання групи не визначені.',
    source: 'Джерело: всі вживання в текстовій розмітці завдань E-Laipa; озвучка без розшифровки не входить до індексу.',
    fallback: 'Повний індекс тем недоступний: показано лише перші появи з попереднього JSON.',
    review: 'Початкову форму визначено без контексту; перевірте збіг.', empty: 'Немає записів за вибраним фільтром.',
    task: 'Завдання', variant: 'Варіант', allVariants: 'Усі варіанти', allSkills: 'Обидві навички',
    dictionary: 'Введено до цього етапу', whole: 'Є в усьому словнику', combined: 'Словник + E-Laipa до поточної теми', elaipa_extra: 'Додає E-Laipa', unmatched: 'Не підтверджено',
    allTaskWords: 'Усі слова завдання', intersection: 'Є в E-Laipa (будь-яка тема)', wordFilter: 'Слова завдання',
    input: 'Запитання і тексти завдання',
    load: 'Навантаження', loadAll: 'Усі завдання', loadReview: 'Є перевищення', loadMeasured: 'Виміряно', loadUnmapped: 'Порядок не визначено',
    noText: 'У збереженому завданні немає тексту латиською', noTasks: 'Опублікованих завдань цієї групи немає.',
    reading: 'Читання', listening: 'Слухання', writing: 'Письмо', speaking: 'Говоріння',
    showWords: 'Слова і джерела', tokens: 'Слововживань', gap: 'Прогалина словника, а не доказ незнання учня.',
    receptiveNote: 'Порівнюються тексти, діалоги, запитання та варіанти відповіді. Нова лексика тут може бути частиною навчального завдання.',
    productiveNote: 'Порівнюються запитання та умови, які отримує учень, зокрема латиські слова в російських інструкціях.',
  },
};
type Labels = typeof labels.ru;
const buckets: Bucket[] = ['dictionary', 'elaipa_extra', 'future', 'unmatched', 'ambiguous'];
const percent = (value: number | null) => value === null ? '—' : `${value}%`;

export function CategoryLearningBalance({ report, dictionaryId, categoryId, topicId, descendants }: { report: LearningBalanceReport } & WordInspectionContext) {
  const t: Labels = labels[useLocale() === 'uk' ? 'uk' : 'ru'];
  const [view, setView] = useState<'reverse' | 'receptive' | 'productive'>('reverse');
  const [filter, setFilter] = useState('needs');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const missing = new Set(['future', 'elsewhere', 'missing']);
  const words = report.reverse.words.filter(word => (filter === 'all' || (filter === 'needs' ? missing.has(word.status) : word.status === filter))
    && `${word.word} ${word.forms.join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));

  return <section className={styles.balance}>
    <div role="tablist" className={styles.tabs}>
      {(['reverse', 'receptive', 'productive'] as const).map(id => <button key={id} type="button" role="tab" id={`balance-tab-${id}`}
        aria-selected={view === id} aria-controls={`balance-panel-${id}`} onClick={() => { setView(id); setExpanded(null); }}>
        <i className={`pi ${id === 'reverse' ? 'pi-list-check' : id === 'receptive' ? 'pi-headphones' : 'pi-pencil'}`} aria-hidden="true" /> {t[id]}
      </button>)}
    </div>
    <p className={styles.sourceNote}>{report.source_basis === 'topic_occurrences' ? t.source : t.fallback}</p>
    {!report.order_available && <p role="note">{t.noGroup}</p>}
    {view === 'reverse' ? <div role="tabpanel" id="balance-panel-reverse" aria-labelledby="balance-tab-reverse">
      {!report.topic_available ? <p>{t.noTopic}</p> : <>
        <div className={styles.balanceNumbers}><strong>{report.reverse.missing_before_and_now} / {report.reverse.total}</strong><span>{t.needs}</span></div>
        <div className={styles.balanceFilters}>
          <select aria-label={t.relation} value={filter} onChange={e => { setFilter(e.target.value); setExpanded(null); }}>
            <option value="needs">{t.needs}</option><option value="all">{t.all}</option>
            {(['current', 'previous', 'future', 'elsewhere', 'missing', 'ambiguous'] as const).map(status =>
              <option key={status} value={status}>{t[status]} ({report.reverse.summary[status]})</option>)}
          </select>
          <input type="search" aria-label={t.search} placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className={styles.scroll}><table className={styles.table}>
          <thead><tr><th>{t.word}</th><th>{t.relation}</th><th>{t.frequency}</th></tr></thead>
          <tbody>{words.map(word => <ReverseRow key={word.word} word={word} t={t} dictionaryId={dictionaryId}
            expanded={expanded === word.word} onToggle={() => setExpanded(expanded === word.word ? null : word.word)} />)}</tbody>
        </table></div>
        {!words.length && <p>{t.empty}</p>}
        <p className={styles.sourceNote}>{t.gap}</p>
      </>}
    </div> : <SkillComparison key={view} section={view} report={report} t={t} dictionaryId={dictionaryId} context={{ categoryId, dictionaryId, topicId, descendants }} />}
  </section>;
}

function EvidenceLinks({ matches, dictionaryId }: { matches: Evidence[]; dictionaryId: number }) {
  return <ul>{matches.map(match => <li key={match.id}><strong>{match.word}</strong>{match.categories.map(category =>
    <span key={category.id}> · <a href={`/dictionaries/${dictionaryId}/category/${category.id}`}>{category.path}</a></span>)}</li>)}</ul>;
}

function ReverseRow({ word, t, dictionaryId, expanded, onToggle }: { word: ReverseWord; t: Labels; dictionaryId: number; expanded: boolean; onToggle: () => void }) {
  return <>
    <tr><th scope="row"><button type="button" className={styles.word} aria-expanded={expanded} onClick={onToggle}>
      <i className={`pi pi-chevron-${expanded ? 'down' : 'right'}`} aria-hidden="true" /> {word.word}</button></th>
      <td><span className={styles.status} data-status={word.status}>{t[word.status]}</span></td><td>{word.frequency}</td></tr>
    {expanded && <tr className={styles.details}><td colSpan={3}><div className={styles.wordDetails}>
      <p>{t.forms}: {word.forms.join(', ')}</p>{word.review_required && <p>{t.review}</p>}
      <EvidenceLinks matches={word.matches} dictionaryId={dictionaryId} />
    </div></td></tr>}
  </>;
}

function sumMetrics(rows: Task[]): Metric {
  const result: Metric = { total: 0, buckets: { dictionary: 0, elaipa_extra: 0, future: 0, unmatched: 0, ambiguous: 0 }, dictionary_percent: null, whole_dictionary_count: 0, whole_dictionary_percent: null, combined_percent: null };
  let combined = false;
  for (const row of rows) {
    result.total += row.metric.total;
    result.whole_dictionary_count += row.metric.whole_dictionary_count;
    combined ||= row.metric.combined_percent !== null;
    for (const bucket of buckets) result.buckets[bucket] += row.metric.buckets[bucket];
  }
  if (result.total) {
    result.dictionary_percent = Math.round(1000 * result.buckets.dictionary / result.total) / 10;
    result.whole_dictionary_percent = Math.round(1000 * result.whole_dictionary_count / result.total) / 10;
    if (combined) result.combined_percent = Math.round(1000 * (result.buckets.dictionary + result.buckets.elaipa_extra) / result.total) / 10;
  }
  return result;
}

function Coverage({ metric, t, title }: { metric: Metric; t: Labels; title: string }) {
  return <div className={styles.coverage}>
    <h3>{title}</h3><p>{t.dictionary}: <strong>{percent(metric.dictionary_percent)}</strong> · {t.whole}: <strong>{percent(metric.whole_dictionary_percent)}</strong> · {t.combined}: <strong>{percent(metric.combined_percent)}</strong></p>
    {metric.total ? <>
      <div className={styles.coverageBar} role="img" aria-label={buckets.map(bucket => `${t[bucket]}: ${metric.buckets[bucket]}`).join(', ')}>
        {buckets.filter(bucket => metric.buckets[bucket]).map(bucket => <span key={bucket} data-bucket={bucket}
          style={{ width: `${100 * metric.buckets[bucket] / metric.total}%` }} title={`${t[bucket]}: ${percent(Math.round(1000 * metric.buckets[bucket] / metric.total) / 10)}`} />)}
      </div><div className={styles.legend}>{buckets.map(bucket => <span key={bucket}><i data-bucket={bucket} />{t[bucket]}: {metric.buckets[bucket]}</span>)}</div>
    </> : <p>{t.noText}</p>}
  </div>;
}

function SkillComparison({ section, report, t, dictionaryId, context }: { section: 'receptive' | 'productive'; report: LearningBalanceReport; t: Labels; dictionaryId: number; context: WordInspectionContext }) {
  const [variant, setVariant] = useState('all');
  const [skill, setSkill] = useState('all');
  const [loadFilter, setLoadFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = report.comparisons[section].rows.filter(row => (variant === 'all' || row.variant === Number(variant)) && (skill === 'all' || row.skill === skill)
    && (loadFilter === 'all' || row.learning_load?.status === loadFilter));
  const skills = section === 'receptive' ? ['reading', 'listening'] as const : ['writing', 'speaking'] as const;
  return <div role="tabpanel" id={`balance-panel-${section}`} aria-labelledby={`balance-tab-${section}`}>
    <p>{section === 'receptive' ? t.receptiveNote : t.productiveNote}</p>
    <div className={styles.balanceFilters}>
      <select aria-label={t.variant} value={variant} onChange={e => setVariant(e.target.value)}><option value="all">{t.allVariants}</option>
        {[...new Set(report.comparisons[section].rows.map(row => row.variant))].sort((a, b) => a - b).map(n => <option key={n} value={n}>{t.variant} {n}</option>)}
      </select>
      <select aria-label={t.task} value={skill} onChange={e => setSkill(e.target.value)}><option value="all">{t.allSkills}</option>{skills.map(id => <option key={id} value={id}>{t[id]}</option>)}</select>
      <select aria-label={t.load} value={loadFilter} onChange={e => setLoadFilter(e.target.value)}><option value="all">{t.loadAll}</option><option value="review">{t.loadReview}</option><option value="unmapped">{t.loadUnmapped}</option></select>
    </div>
    <Coverage metric={sumMetrics(rows)} t={t} title={t.input} />
    <div className={styles.scroll}><table className={styles.table}>
      <thead><tr><th>{t.task}</th><th>{t.variant}</th><th>{t.dictionary}</th><th>{t.whole}</th><th>{t.combined}</th><th>{t.load}</th></tr></thead>
      <tbody>{rows.map(row => {
        const key = `${row.block_id}:${row.variant_id ?? 'base'}`;
        return <TaskRow key={key} row={row} t={t} dictionaryId={dictionaryId} context={context} expanded={expanded === key} onToggle={() => setExpanded(expanded === key ? null : key)} />;
      })}</tbody>
    </table></div>
    {!rows.length && <p>{t.noTasks}</p>}
  </div>;
}

function TaskRow({ row, t, dictionaryId, context, expanded, onToggle }: { row: Task; t: Labels; dictionaryId: number; context: WordInspectionContext; expanded: boolean; onToggle: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [wordFilter, setWordFilter] = useState('all');
  const [search, setSearch] = useState('');
  const words = row.metric.words ?? [];
  const keys = new Set(words.map(word => word.word));
  const visible = words.filter(word => (wordFilter === 'all' || word.elaipa_present) && `${word.word} ${word.lemmas.join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));
  const skillName = t[row.skill as 'reading' | 'listening' | 'writing' | 'speaking'];
  return <>
    <tr><th scope="row"><button type="button" className={styles.word} aria-expanded={expanded} onClick={onToggle} title={t.showWords}>
      <i className={`pi pi-chevron-${expanded ? 'down' : 'right'}`} aria-hidden="true" />{skillName} · {row.title}</button></th>
      <td>{row.variant}</td><td>{percent(row.metric.dictionary_percent)}</td><td>{percent(row.metric.whole_dictionary_percent)}</td><td>{!row.metric.total ? t.noText : percent(row.metric.combined_percent)}</td>
      <td>{!row.learning_load ? '—' : row.learning_load.status === 'review' ? `${t.loadReview}: ${row.learning_load.flags.length}` : row.learning_load.status === 'unmapped' ? t.loadUnmapped : t.loadMeasured}</td></tr>
    {expanded && <tr className={styles.details}><td colSpan={6}><div className={styles.wordDetails}>
      <a href={`${row.url}#lesson-block-${row.block_id}`}>{t.task} ↗</a>
      {row.learning_load && <LearningLoadDetails report={row.learning_load} />}
      <p>{t.input}: {row.metric.total} · {t.tokens}</p>
      {row.learner_text && <p className={styles.taskText}>{row.learner_text.split(/([\p{Script=Latin}\p{M}]+(?:[-’'][\p{Script=Latin}\p{M}]+)*)/u).map((part, i) => {
        const key = part.normalize('NFC').toLocaleLowerCase('lv');
        return keys.has(key) ? <button key={i} type="button" className={styles.textWord} aria-pressed={selected === key} onClick={() => setSelected(key)}>{part}</button> : part;
      })}</p>}
      {!row.metric.total && <p>{t.noText}</p>}
      {row.metric.total > 0 && <div className={styles.balanceFilters}>
        <select aria-label={t.wordFilter} value={wordFilter} onChange={e => setWordFilter(e.target.value)}><option value="all">{t.allTaskWords}</option><option value="elaipa">{t.intersection}</option></select>
        <input type="search" aria-label={t.search} placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} />
      </div>}
      {selected && <TaskWordInspector key={selected} word={selected} context={context} onClose={() => setSelected(null)} />}
          <ul>{visible.map(word => <li key={word.word}><button type="button" className={styles.word} aria-pressed={selected === word.word} onClick={() => setSelected(word.word)}><strong>{word.word}</strong></button> ×{word.count} · <span className={styles.status} data-status={word.bucket}>{t[word.bucket]}</span>
            {word.lemmas.length > 0 && <span> · {word.lemmas.join(', ')}</span>}
            {word.review_required && <span title={t.review}> · <i className="pi pi-info-circle" aria-hidden="true" /></span>}
            {word.matches.length > 0 && <EvidenceLinks matches={word.matches} dictionaryId={dictionaryId} />}
          </li>)}</ul>
      {row.metric.total > 0 && !visible.length && <p>{t.empty}</p>}
    </div></td></tr>}
  </>;
}
