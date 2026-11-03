import Link from 'next/link';
import styles from './course-continue.module.css';

export type CourseSuggestionItem = { href: string; level: string; group_title: string; skill: string; title?: string; percent?: number; block_id?: number; group_id?: number };
export type CourseSuggestion = { target: number; status: 'ready' | 'rest' | 'complete'; next_available_at: string | null; next: CourseSuggestionItem | null; available?: CourseSuggestionItem[] };
type SuggestionCategory = { kind: 'words' | 'grammar' | 'practice'; items: CourseSuggestionItem[] };
type SuggestionGroup = { key: string; level: string; title: string; categories: SuggestionCategory[] };

function groupSuggestions(items: CourseSuggestionItem[]): SuggestionGroup[] {
  const groups = new Map<string, SuggestionGroup>();
  for (const item of items) {
    const kind = item.skill === 'words' ? 'words' : item.skill === 'grammar' ? 'grammar' : 'practice';
    const key = JSON.stringify([item.level, item.group_id ?? item.group_title]);
    if (!groups.has(key)) groups.set(key, { key, level: item.level.toUpperCase(), title: item.group_title, categories: [] });
    const group = groups.get(key)!;
    let category = group.categories.find(category => category.kind === kind);
    if (!category) {
      category = { kind, items: [] };
      group.categories.push(category);
    }
    category.items.push(item);
  }
  return [...groups.values()];
}

export function CourseContinueSuggestions({ value, loading, error, uk, onNavigate }: { value?: CourseSuggestion; loading: boolean; error: boolean; uk: boolean; onNavigate: () => void }) {
  const skills: Record<string, string> = uk
    ? { words: 'Слова', grammar: 'Граматика', listening: 'Слухання', reading: 'Читання', writing: 'Письмо', speaking: 'Говоріння' }
    : { words: 'Слова', grammar: 'Грамматика', listening: 'Слушание', reading: 'Чтение', writing: 'Письмо', speaking: 'Говорение' };
  if (error) return <p role="status" className={styles.error}>{uk ? 'Не вдалося перевірити доступні завдання. Спробуйте навести ще раз.' : 'Не удалось проверить доступные задания. Попробуйте навести ещё раз.'}</p>;
  if (!value) return <p role="status">{uk ? 'Перевіряємо доступні завдання…' : 'Проверяем доступные задания…'}</p>;
  const items = value.available ?? (value.next ? [value.next] : []);
  const categories = uk ? { words: 'Словник', grammar: 'Граматика', practice: 'Практика' } : { words: 'Словарь', grammar: 'Грамматика', practice: 'Практика' };
  return <>
    <p className={styles.suggestionsHint}>{uk ? 'Від старих груп до нових. Кнопка відкриє перше завдання.' : 'От старых групп к новым. Кнопка откроет первое задание.'}</p>
    {loading && <p role="status" className={styles.suggestionsHint}>{uk ? 'Оновлюємо список…' : 'Обновляем список…'}</p>}
    {items.length > 0 ? <ol className={styles.suggestionList}>{groupSuggestions(items).map(group => <li key={group.key}>
      <div className={styles.suggestionHeading}><span className={styles.suggestionLevel}>{group.level}</span><span aria-hidden="true"> · </span><span>{group.title}</span></div>
      <ul className={styles.suggestionCategories}>{group.categories.map(category => <li key={category.kind}>
        <strong className={styles.suggestionCategory}>{categories[category.kind]}</strong>
        <ul className={styles.suggestionTasks}>{category.items.map((item, index) => {
          const skill = skills[item.skill] ?? item.skill;
          const label = category.kind === 'practice' ? item.title && item.title !== skill ? `${skill} — ${item.title}` : skill : item.title || (uk ? 'Відкрити завдання' : 'Открыть задание');
          return <li key={`${item.href}:${index}`}><Link href={item.href} onClick={onNavigate}>{label}</Link></li>;
        })}</ul>
      </li>)}</ul>
    </li>)}</ol> : <p role="status" className={styles.notice}>{value.status === 'rest'
      ? uk ? 'Час відпочити! Решта завдань на паузі.' : 'Пора отдохнуть! Оставшиеся задания на откате.'
      : uk ? 'Усі доступні завдання досягли вибраної цілі.' : 'Все доступные задания достигли выбранной цели.'}
      {value.next_available_at && <> {uk ? 'Наступний залік:' : 'Следующий зачёт:'} <time dateTime={value.next_available_at}>{new Date(value.next_available_at).toLocaleString(uk ? 'uk-UA' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></>}
    </p>}
  </>;
}
