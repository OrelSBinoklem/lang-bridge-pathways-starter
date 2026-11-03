'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { grammarSections } from './grammar';
import { conceptSections } from './concepts';
import { tableExplanations } from './explanations';
import type { ReferenceLocale, ReferenceSection } from './types';
import styles from './reference.module.css';

const ReferenceTable = dynamic(() => import('./ReferenceTable'));
const levels = ['all', 'A1', 'A2', 'B1', 'B2'] as const;

export function searchableText(section: ReferenceSection, locale: ReferenceLocale): string {
  return [section.title[locale], section.summary[locale], ...section.paragraphs.map(p => p[locale]),
    ...section.examples.flatMap(e => ['en' in e ? e.en : e.lv, e.translation[locale], e.note?.[locale] ?? '']), section.remember[locale],
    ...(section.comparison?.rows.flatMap(row => row.map(cell => cell[locale])) ?? []),
    ...(section.table?.focus.flatMap(target => [target.label[locale], tableExplanations[section.table!.key]?.[target.selector]?.[locale] ?? '']) ?? [])].join(' ').toLocaleLowerCase();
}

export default function ReferenceReader({ kind, locale, language = 'lv', sections: customSections }: {
  kind: 'grammar' | 'concepts'; locale: ReferenceLocale; language?: 'lv' | 'en'; sections?: ReferenceSection[];
}) {
  const uk = locale === 'uk';
  const source = customSections ?? (kind === 'grammar' ? grammarSections : conceptSections);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<typeof levels[number]>('all');
  const [openTables, setOpenTables] = useState<Set<string>>(() => new Set());
  const [tocOpen, setTocOpen] = useState(false);
  const [activeId, setActiveId] = useState(source[0].id);
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const root = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => kind === 'grammar' ? source : source.filter(section => (level === 'all' || section.level === level) && searchableText(section, locale).includes(query.trim().toLocaleLowerCase())), [kind, source, level, query, locale]);
  const current = sections.find(section => section.id === activeId) ?? sections[0];
  useEffect(() => {
    const reader = root.current;
    const scroller = reader?.closest('.p-dialog-content');
    if (!reader || !scroller) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const chapters = Array.from(reader.querySelectorAll<HTMLElement>('[data-reference-section]'));
        const edge = scroller.getBoundingClientRect().top + 24;
        const visible = chapters.filter(chapter => chapter.getBoundingClientRect().top <= edge).at(-1) ?? chapters[0];
        if (visible?.dataset.referenceSection) setActiveId(visible.dataset.referenceSection);
      });
    };
    scroller.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(reader);
    update();
    return () => { scroller.removeEventListener('scroll', update); resize.disconnect(); cancelAnimationFrame(frame); };
  }, [sections]);
  const jump = (id: string) => {
    setActiveId(id);
    setTocOpen(false);
    requestAnimationFrame(() => {
      const section = root.current?.querySelector<HTMLElement>(`#${prefix}-${id}`);
      section?.scrollIntoView({ block: 'start', behavior: 'auto' });
      section?.focus({ preventScroll: true });
    });
  };

  return <div className={styles.reader} ref={root} data-reference-reader={kind} data-reference-language={language} lang={uk ? 'uk' : 'ru'}>
    {kind === 'concepts' && <>
    <header className={styles.intro}>
      <div className={styles.eyebrow}>A1 · A2 · B1 · B2</div>
      <h2>{uk ? 'Граматика зрозумілими словами' : 'Грамматика понятными словами'}</h2>
      <p>{uk ? 'Терміни не ускладнюють мову: вони дають назви тому, що ви вже робите, коли говорите. Тут кожне поняття має приклад.' : 'Термины не усложняют язык: они дают названия тому, что вы уже делаете, когда говорите. Здесь у каждого понятия есть пример.'}</p>
    </header>
    <div className={styles.toolbar}>
      <label className={styles.search}><i className="pi pi-search" aria-hidden="true" /><input type="search" aria-label={uk ? 'Пошук у довіднику' : 'Поиск в справочнике'} placeholder={language === 'en' ? (uk ? 'Тема, термін або англійське слово' : 'Тема, термин или английское слово') : (uk ? 'Тема, термін або латиське слово' : 'Тема, термин или латышское слово')} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className={styles.levels} role="group" aria-label={uk ? 'Рівень теми' : 'Уровень темы'}>{levels.map(value => <button type="button" key={value} aria-pressed={level === value} onClick={() => setLevel(value)}>{value === 'all' ? (uk ? 'Усі' : 'Все') : value}</button>)}</div>
      <button type="button" className={styles.tocToggle} aria-expanded={tocOpen} aria-controls={`${prefix}-contents`} onClick={() => setTocOpen(!tocOpen)}><i className="pi pi-list" aria-hidden="true" />{uk ? 'Зміст' : 'Оглавление'}</button>
    </div>
    <p className={styles.count} role="status">{uk ? 'Розділи' : 'Разделы'}: {sections.length} / {source.length}</p>
    </>}
    {kind === 'grammar' && <button type="button" className={styles.tocToggle} aria-expanded={tocOpen} aria-controls={`${prefix}-contents`} onClick={() => setTocOpen(!tocOpen)}><i className="pi pi-list" aria-hidden="true" />{uk ? 'Зміст' : 'Оглавление'}</button>}
    <div className={styles.layout}>
      <nav className={`${styles.contents} ${tocOpen ? styles.contentsOpen : ''}`} id={`${prefix}-contents`} aria-label={uk ? 'Зміст довідника' : 'Оглавление справочника'}>
        <strong>{uk ? 'Зміст' : 'Оглавление'}</strong>
        {sections.map(section => <a key={section.id} href={`#${prefix}-${section.id}`} aria-current={current?.id === section.id ? 'location' : undefined} onClick={e => { e.preventDefault(); jump(section.id); }}><span>{section.level}</span>{section.title[locale]}{section.table && <i className="pi pi-table" aria-label={uk ? 'З розбором таблиці' : 'С разбором таблицы'} />}</a>)}
      </nav>
      <div className={styles.chapters}>
        {sections.length === 0 && <div className={styles.empty}><h3>{uk ? 'Нічого не знайдено' : 'Ничего не найдено'}</h3><button type="button" onClick={() => {setQuery('');setLevel('all');}}>{uk ? 'Скинути фільтри' : 'Сбросить фильтры'}</button></div>}
        {sections.map(section => <section className={styles.chapter} id={`${prefix}-${section.id}`} key={section.id} data-reference-section={section.id} tabIndex={-1}>
          <div className={styles.chapterTitle}><span className={styles.level} data-level={section.level}>{section.level}</span><h3>{section.title[locale]}</h3></div>
          <p className={styles.summary}>{section.summary[locale]}</p>
          {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph[locale]}</p>)}
          {section.comparison && <div className={styles.comparisonScroll} role="region" tabIndex={0} aria-label={section.title[locale]}><table className={styles.comparison}><thead><tr>{section.comparison.headings.map((heading, index) => <th scope="col" key={index}>{heading[locale]}</th>)}</tr></thead><tbody>{section.comparison.rows.map((row, index) => <tr key={index}>{row.map((cell, col) => col === 0 ? <th scope="row" key={col}>{cell[locale]}</th> : <td key={col}>{cell[locale]}</td>)}</tr>)}</tbody></table></div>}
          <div className={styles.examples}>{section.examples.map((example, index) => <div key={index}><p lang={'en' in example ? 'en' : 'lv'}>{'en' in example ? example.en : example.lv}</p><p>{example.translation[locale]}</p>{example.note && <small className={styles.exampleNote}>{example.note[locale]}</small>}</div>)}</div>
          <p className={styles.remember}><i className="pi pi-lightbulb" aria-hidden="true" /><span>{section.remember[locale]}</span></p>
          {section.table && <details className={styles.tableDetails} onToggle={event => {const open = event.currentTarget.open; setOpenTables(previous => {const next = new Set(previous); if (open) next.add(section.id); else next.delete(section.id); return next;});}}>
            <summary><i className="pi pi-table" aria-hidden="true" />{uk ? 'Розбір на таблиці' : 'Разбор на таблице'} · {section.table.focus.length}</summary>
            {openTables.has(section.id) && <ReferenceTable tableKey={section.table.key} highlights={section.table.focus.map(target => ({ ...target, description: target.description ?? tableExplanations[section.table!.key]?.[target.selector] }))} locale={locale} />}
          </details>}
          {section.tableLinks && <div className={styles.relatedTables}>
            <strong>{uk ? 'Докладніше в таблицях' : 'Подробнее в таблицах'}</strong>
            {section.tableLinks.map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={styles.tableLink}>{link.label[locale]} <i className="pi pi-arrow-up-right" aria-hidden="true" /></a>)}
          </div>}
        </section>)}
        <footer className={styles.sources}>
          <h3>{uk ? 'Джерела для звірки' : 'Источники для сверки'}</h3>
          <p>{uk ? 'Пояснення й приклади цього огляду авторські. Позначки A1–B2 показують рекомендований етап знайомства з темою, а не гарантію складання іспиту.' : 'Объяснения и примеры этого обзора авторские. Метки A1–B2 показывают рекомендуемый этап знакомства с темой, а не гарантию сдачи экзамена.'}</p>
          {language === 'en' ? <a href="https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference" target="_blank" rel="noreferrer">British Council · English grammar reference</a> : <>
          <a href="https://maciunmacies.valoda.lv/maci/pieaugusajiem" target="_blank" rel="noreferrer">Latviešu valodas aģentūra · A1–B2</a>
          <a href="https://valoda.lv/pareizrakstba/" target="_blank" rel="noreferrer">LVA · Pareizrakstība</a>
          <a href="https://valodasrokasgramata.lv/materials/1/4765DC25-7435-7D3D-935A-A8BE5C348E7B" target="_blank" rel="noreferrer">Latviešu valodas rokasgrāmata · Divdabja teiciens</a>
          <a href="https://valoda.lv/vrdu-lietojums/" target="_blank" rel="noreferrer">LVA · Vārdu lietojums</a>
          </>}
        </footer>
      </div>
    </div>
  </div>;
}
