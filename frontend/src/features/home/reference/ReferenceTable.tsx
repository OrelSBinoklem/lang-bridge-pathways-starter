'use client';

import { useId, useState } from 'react';
import { grammarTableComponents } from '@/features/grammar/componentRegistry';
import { tablesData } from '@/features/grammar/data/tablesData';
import { ScaledTableEmbed } from '@/features/grammar/ScaledTableEmbed';
import type { ReferenceLocale, ReferenceTableSpec } from './types';
import styles from './reference.module.css';

export default function ReferenceTable({ tableKey, highlights, locale }: {
  tableKey: ReferenceTableSpec['key'];
  highlights: ReferenceTableSpec['focus'];
  locale: ReferenceLocale;
}) {
  const id = `reference-table-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [selected, setSelected] = useState<string | null>(highlights[0]?.selector ?? null);
  const Component = grammarTableComponents[tableKey];
  const table = Object.values(tablesData).flat().find(item => item.componentKey === tableKey);
  const selectedIndex = highlights.findIndex(target => target.selector === selected);
  const explanation = highlights[selectedIndex]?.description?.[locale];
  // Only named tutor targets are accepted; styles are scoped to this one embed instance.
  const selector = selected && /^\.tt-[a-z0-9-]+(?:\s+\.tt-[a-z0-9-]+)*$/.test(selected) ? selected : null;
  if (!Component) return null;
  return <div className={styles.tableExample}>
    <div className={styles.walkthroughHeading}>
      <strong>{locale === 'uk' ? 'Розбір таблиці' : 'Разбор таблицы'}</strong>
      <div className={styles.focusTools}>
        <button type="button" aria-label={locale === 'uk' ? 'Попереднє пояснення' : 'Предыдущее пояснение'} title={locale === 'uk' ? 'Попереднє пояснення' : 'Предыдущее пояснение'} disabled={selectedIndex <= 0} onClick={() => setSelected(highlights[selectedIndex - 1].selector)}><i className="pi pi-chevron-left" aria-hidden="true" /></button>
        <span>{selectedIndex + 1} / {highlights.length}</span>
        <button type="button" aria-label={locale === 'uk' ? 'Наступне пояснення' : 'Следующее пояснение'} title={locale === 'uk' ? 'Наступне пояснення' : 'Следующее пояснение'} disabled={selectedIndex >= highlights.length - 1} onClick={() => setSelected(highlights[selectedIndex + 1].selector)}><i className="pi pi-chevron-right" aria-hidden="true" /></button>
        <button type="button" title={locale === 'uk' ? 'Зняти виділення' : 'Убрать выделение'} aria-label={locale === 'uk' ? 'Зняти виділення' : 'Убрать выделение'} onClick={() => setSelected(null)} disabled={!selected}><i className="pi pi-times" aria-hidden="true" /></button>
      </div>
    </div>
    <ol className={styles.explanationList} aria-label={locale === 'uk' ? 'Пояснення до таблиці' : 'Пояснения к таблице'}>
      {highlights.map((target, index) => <li key={target.selector}><button type="button" aria-pressed={selected === target.selector} aria-controls={id} onClick={() => setSelected(target.selector)}><span>{index + 1}</span><strong>{target.label[locale]}</strong><i className="pi pi-search-plus" aria-hidden="true" /></button></li>)}
    </ol>
    <div className={styles.focusExplanation} role="status" aria-live="polite"><i className="pi pi-lightbulb" aria-hidden="true" /><p>{explanation ?? (locale === 'uk' ? 'Таблиця без виділення.' : 'Таблица без выделения.')}</p></div>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={locale === 'uk' ? 'Граматична таблиця' : 'Грамматическая таблица'}>
      <div id={id} className={styles.tableWidth} data-reference-table={tableKey}>
        {selector && <style>{`#${id} ${selector}, #${id} ${selector} > td, #${id} ${selector} > th { background: #fff0b8 !important; color: #292416 !important; box-shadow: inset 0 -3px #ae7205; }`}</style>}
        <ScaledTableEmbed fontScalePercent={100} className="grammar-component-tables-page grammar-component-table-embed"><Component /></ScaledTableEmbed>
      </div>
    </div>
    {table && <a className={styles.tableLink} href={`/grammar?table=${encodeURIComponent(String(table.id))}`} target="_blank" rel="noreferrer"><i className="pi pi-external-link" aria-hidden="true" />{locale === 'uk' ? 'Усі форми в граматиці' : 'Все формы в грамматике'}</a>}
  </div>;
}
