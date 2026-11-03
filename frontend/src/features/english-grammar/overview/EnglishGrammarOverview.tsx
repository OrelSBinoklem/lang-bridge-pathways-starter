'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { englishGrammarOverviewSections as sections, overviewTableHref, overviewTables } from './sections';
import styles from './overview.module.css';

/** Dialog body only. The caller owns the Dialog and loads this component on demand. */
export default function EnglishGrammarOverview({ locale = 'ru' }: { locale?: 'ru' | 'uk' }) {
  const prefix = `english-overview-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const root = useRef<HTMLDivElement>(null);
  const jumpFrame = useRef(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeId, setActiveId] = useState(sections[0].id);
  const current = sections.find(section => section.id === activeId) ?? sections[0];

  useEffect(() => {
    const reader = root.current;
    // Observe the Dialog's own scroller, never the page behind the modal.
    const scroller = reader?.closest('.p-dialog-content');
    if (!reader || !scroller) return;
    const chapters = Array.from(reader.querySelectorAll<HTMLElement>('[data-overview-section]'));
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mobileToolbar = reader.querySelector<HTMLElement>('[data-overview-toolbar]');
        const edge = scroller.getBoundingClientRect().top + (mobileToolbar?.getBoundingClientRect().height ?? 0) + 28;
        const visible = chapters.filter(chapter => chapter.getBoundingClientRect().top <= edge).at(-1) ?? chapters[0];
        if (visible?.dataset.overviewSection) setActiveId(visible.dataset.overviewSection);
      });
    };
    scroller.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(reader);
    resize.observe(scroller);
    update();
    return () => {
      scroller.removeEventListener('scroll', update);
      resize.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(jumpFrame.current);
    };
  }, []);

  function jump(id: string) {
    setTocOpen(false);
    setActiveId(id);
    cancelAnimationFrame(jumpFrame.current);
    // Wait for the mobile contents to collapse before measuring/scrolling.
    jumpFrame.current = requestAnimationFrame(() => {
      const chapter = root.current?.querySelector<HTMLElement>(`#${prefix}-${id}`);
      chapter?.scrollIntoView({ block: 'start', behavior: 'auto' });
      chapter?.focus({ preventScroll: true });
    });
  }

  return <div className={styles.reader} ref={root} lang="ru" data-english-grammar-overview>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>АНГЛИЙСКИЙ · A1–B2</p>
      <h2>Обзорная грамматика</h2>
      <p>От простой фразы к связной речи: {sections.length} главы о том, как выбирать и соединять конструкции.
        Читайте по порядку или найдите нужную тему в оглавлении.</p>
      <p className={styles.readingNote}>Уровни показывают рекомендуемый этап знакомства с темой.
        В конце каждой главы — ссылки на подробные таблицы; они открываются в новой вкладке.</p>
      {locale === 'uk' && <p className={styles.languageNote} role="note" lang="uk">
        Цей огляд поки доступний російською мовою. Нижче показано російський текст і переклади прикладів російською.
      </p>}
    </header>

    <div className={styles.mobileToolbar} data-overview-toolbar>
      <button type="button" className={styles.tocToggle} aria-expanded={tocOpen} aria-controls={`${prefix}-contents`}
        onClick={() => setTocOpen(open => !open)}>
        <i className={`pi ${tocOpen ? 'pi-times' : 'pi-list'}`} aria-hidden="true" />
        {tocOpen ? 'Скрыть оглавление' : 'Оглавление'}
      </button>
      <span className={styles.currentChapter}>{current.title}</span>
    </div>

    <div className={styles.layout}>
      <nav className={`${styles.contents} ${tocOpen ? styles.contentsOpen : ''}`} id={`${prefix}-contents`}
        aria-label="Оглавление английской грамматики">
        <strong>Оглавление</strong>
        <ol>
          {sections.map((section, index) => <li key={section.id}>
            <a href={`#${prefix}-${section.id}`} aria-current={activeId === section.id ? 'location' : undefined}
              onClick={event => { event.preventDefault(); jump(section.id); }}>
              <span className={styles.chapterNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span>{section.title}<small>{section.level}{section.through ? `–${section.through}` : ''}</small></span>
            </a>
          </li>)}
        </ol>
      </nav>

      <div className={styles.chapters}>
        {sections.map((section, index) => <section key={section.id} className={styles.chapter}
          id={`${prefix}-${section.id}`} data-overview-section={section.id} tabIndex={-1}
          aria-labelledby={`${prefix}-${section.id}-title`}>
          <div className={styles.chapterTitle}>
            <span className={styles.level} data-level={section.level}>{section.level}{section.through ? `–${section.through}` : ''}</span>
            <h3 id={`${prefix}-${section.id}-title`}>{index + 1}. {section.title}</h3>
          </div>
          <p className={styles.summary}>{section.summary}</p>
          {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
          <div className={styles.examples} aria-label="Примеры с переводом">
            {section.examples.map(item => <div className={styles.example} key={`${item.table_id}-${item.row_id}`}
              data-example-table={item.table_id} data-example-row={item.row_id}>
              <p lang="en">{item.english}</p>
              <p>{item.translation}</p>
              {item.note && <small>{item.note}</small>}
            </div>)}
          </div>
          <p className={styles.remember}><i className="pi pi-lightbulb" aria-hidden="true" /><span>{section.remember}</span></p>
          <div className={styles.tableLinks}>
            <h4>Подробнее в таблицах</h4>
            <ul>{section.tableIds.map(table_id => <li key={table_id}>
              <a href={overviewTableHref(table_id)} target="_blank" rel="noopener noreferrer" data-table-id={table_id}>
                <span>{overviewTables[table_id].title}</span><i className="pi pi-arrow-up-right" aria-hidden="true" />
              </a>
            </li>)}</ul>
          </div>
        </section>)}
        <footer className={styles.footer}>
          <p>Не обязательно запоминать все формы сразу. Найдите смысл, который хотите передать,
            выберите конструкцию и проверьте её на коротком примере. Подробные формы и ограничения — в связанных таблицах.</p>
          <button type="button" onClick={() => jump(sections[0].id)}>К первой главе <i className="pi pi-arrow-up" aria-hidden="true" /></button>
        </footer>
      </div>
    </div>
  </div>;
}
