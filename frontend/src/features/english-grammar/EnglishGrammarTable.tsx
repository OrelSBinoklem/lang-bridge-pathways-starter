'use client';

import { Fragment, useEffect } from 'react';
import type { EnglishTable, ReferenceGrid, Token } from './types';
import { ROLE_LABELS } from './types';
import styles from './english-tables.module.css';

/** Supports emphasis only, never HTML from editorial content. A lone dash means "no such part in this example". */
function CellText({ text }: { text: string }) {
  if (text.trim() === '—') return <span className={styles.none}>—</span>;
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>)}</>;
}
export function SentenceTokens({ tokens, formula = false }: { tokens: Token[]; formula?: boolean }) {
  return <span className={`${styles.tokens} ${formula ? styles.formula : ''}`} lang="en">{tokens.map((part, i) => <Fragment key={`${i}:${part.role}`}><span className={`${styles.token} tt-role-${part.role}`} data-role={part.role} title={ROLE_LABELS[part.role]}>{part.text}</span>{i < tokens.length - 1 ? ' ' : null}</Fragment>)}</span>;
}
/** Formula pieces in the short rule ("кто + do/does not + V1", "кто → be → место") get the colours of the table roles. */
function chipRole(text: string) {
  if (/^(кто|кто-то|S|подлежащее|человек|адресат|исполнитель)$/i.test(text)) return 'subject';
  if (/V1|V2|V3|V-s|-ing|-s\/-es|глагол|инфинитив/i.test(text)) return 'verb';
  if (/(^|[\s/])(do|does|did|be|am|is|are|was|were|have|has|had|will|would|not|can|could|must|should|might|may|to|been|get|got)(?=$|[\s/])/i.test(text)) return 'auxiliary';
  return 'object';
}
function RuleSegment({ text }: { text: string }) {
  if (!/\s(\+|→)\s/.test(text)) return <>{text}</>;
  const lead = text.match(/^\s*/)![0], tail = text.match(/[?!…]*\s*$/)![0];
  const pieces = text.slice(lead.length, text.length - tail.length).split(/\s(\+|→)\s/);
  return <>{lead}<span className={styles.formulaChain}>{pieces.map((piece, i) => i % 2
    ? <span key={i} className={styles.op}>{` ${piece} `}</span>
    : <span key={i} className={styles.chip} data-role={chipRole(piece)}>{piece}</span>)}</span>{tail}</>;
}
/** The short rule as separate lines; "Отрицание: …" prefixes become labels and formulas become chips. */
function RuleLines({ text }: { text: string }) {
  return <>{text.split(/(?<=[.!?])\s+(?=[A-ZА-ЯЁ«])/).map((sentence, i) => {
    const head = sentence.match(/^([^:.;]{2,34}):\s/);
    const body = head ? sentence.slice(head[0].length) : sentence;
    return <span key={i} className={styles.ruleLine}>{head && <b className={styles.ruleHead}><RuleSegment text={head[1]} />: </b>}
      {body.split(/([,;:—()«»]|\.\s|\.$)/).map((segment, k) => <RuleSegment key={k} text={segment} />)}{' '}</span>;
  })}</>;
}
const SIGNS: Record<string, string> = { positive: '+', negative: '−', question: '?' };
/** Every column keeps one colour: + / − / ? by meaning, other comparisons by position. */
function columnTone(key: string, index: number) { return columnKind(key) ?? `c${index % 4}`; }
function ColumnHead({ label, tone }: { label: string; tone: string }) {
  if (!SIGNS[tone]) return <>{label}</>;
  const [first, ...rest] = label.split(' ');
  return <><span className={styles.headWord}><span className={styles.sign} aria-hidden="true">{SIGNS[tone]}</span>{first}</span>{rest.length ? ` ${rest.join(' ')}` : ''}</>;
}
const groupOf = (label?: string) => label?.includes(' · ') ? label.split(' · ')[0] : undefined;
/** "Сейчас · he / she / it": a first part shared by several rows is printed once, as a caption (kept for screen readers). */
function RowLabel({ label, previous, next }: { label: string; previous?: string; next?: string }) {
  const group = groupOf(label);
  if (!group) return <>{label}</>;
  const repeated = group === groupOf(previous), shared = repeated || group === groupOf(next);
  return <><span className={repeated ? styles.srOnly : shared ? styles.rowGroup : styles.rowLead}>{group}<span className={styles.srOnly}> · </span></span>
    <span className={styles.rowItem}>{label.slice(group.length + 3)}</span></>;
}
function FormsReference({ grid, primary = true }: { grid: ReferenceGrid; primary?: boolean }) {
  return <div className={`tt-reference ${primary ? 'tt-grid' : ''} ${styles.tableScroll} ${grid.rows.length > 20 ? styles.longReference : ''}`} tabIndex={0} role="region" aria-label={grid.title}>
    <table className={styles.formsTable}><caption className={styles.srOnly}>{grid.title}</caption>
      <thead><tr>{grid.columns.map((column, index) => <th scope="col" key={column.key} className={`tt-ref-col-${column.key}`} data-tone={index ? columnTone(column.key, index - 1) : undefined}>{column.label}</th>)}</tr></thead>
      <tbody>{grid.rows.map((row, i) => <tr key={row.id} className={`tt-ref-row-${row.id}`} data-stripe={i % 2 === 1} data-tutor-target={`ref_row_${row.id}`}>
        {grid.columns.map((column, index) => index === 0
          ? <th scope="row" key={column.key} className={`tt-ref-col-${column.key}`}>{row.values[column.key]}</th>
          : <td key={column.key} className={`tt-ref-col-${column.key}`} data-tone={columnTone(column.key, index - 1)}>{row.values[column.key]}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
function columnKind(key: string) {
  return /negative|negation/.test(key) ? 'negative' : /question/.test(key) ? 'question' : /affirmative|positive/.test(key) ? 'positive' : undefined;
}
function ComparisonGrid({ table }: { table: EnglishTable }) {
  const grid = table.grid;
  if (grid?.use_reference && table.reference) return <FormsReference grid={table.reference} />;
  if (!grid?.columns || !grid.rows) return null;
  return <div className={`tt-grid ${styles.tableScroll}`} role="region" tabIndex={0} aria-label={`Таблица ${grid.title}`}>
    <table className={styles.matrixTable}><caption className={styles.srOnly}>{grid.title}</caption>
      <thead><tr><th scope="col" className={styles.corner}>{grid.row_label ?? 'Сравнение'}</th>{grid.columns.map((column, index) => <th scope="col" key={column.key} className={`tt-grid-col-${column.key}`} data-kind={columnKind(column.key)} data-tone={columnTone(column.key, index)}><ColumnHead label={column.label} tone={columnTone(column.key, index)} /></th>)}</tr></thead>
      <tbody>{grid.rows.map((row, i) => { const previous = grid.rows![i - 1]?.label;
        return <tr key={row.id} className={`tt-grid-row-${row.id}`} data-group-start={i > 0 && !!groupOf(row.label) && groupOf(row.label) !== groupOf(previous) && groupOf(row.label) === groupOf(grid.rows![i + 1]?.label) || undefined}>
        <th scope="row"><RowLabel label={row.label} previous={previous} next={grid.rows![i + 1]?.label} /></th>{grid.columns!.map((column, index) => <td key={column.key} className={`tt-grid-col-${column.key}`} data-tone={columnTone(column.key, index)}><CellText text={row.cells[column.key]} /></td>)}
      </tr>; })}</tbody>
    </table>
  </div>;
}
export function EnglishGrammarTable({ table, tables, withinGallery = false }: { table: EnglishTable; tables: EnglishTable[]; withinGallery?: boolean }) {
  useEffect(() => {
    const reveal = (event: Event) => {
      if ((event as CustomEvent<{ tableKey?: string }>).detail?.tableKey !== table.key) return;
      const root = document.getElementById(table.id);
      root?.querySelectorAll('details').forEach(details => { details.open = true; });
      // The table can also live inside a closed exercise reference, outside the gallery.
      for (let parent = root?.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
    };
    window.addEventListener('grammar.table.reveal', reveal);
    return () => window.removeEventListener('grammar.table.reveal', reveal);
  }, [table.id, table.key]);
  return <div id={withinGallery ? undefined : `table-${table.id}`}><article id={table.id} className={styles.card} data-grammar-table-key={table.key} data-grammar-table-id={table.id} data-language="en" data-family={table.presentation?.family} data-layout={table.presentation?.layout} data-accent={table.presentation?.accent} aria-labelledby={`${table.id}-title`}>
    <header className={styles.cardHeader}><h2 id={`${table.id}-title`} className="tt-title"><span className={styles.level} data-level={table.level}>{table.level.toUpperCase()}</span>{table.grid?.title ?? table.title}</h2>
      <a className={styles.permalink} href={`/grammar/english?level=${table.level}#${table.id}`} aria-label={`Ссылка на таблицу «${table.grid?.title ?? table.title}»`}>#</a></header>
    <ComparisonGrid table={table} />
    <p className={`${styles.gridNote} tt-grid-summary`}><RuleLines text={table.grid?.summary ?? table.rule} /></p>
    <details className={`${styles.explanation} tt-explanation`}><summary>Правило и примеры</summary><div>
      <p className={`${styles.rule} tt-rule`}>{table.rule}</p><p className={`${styles.when} tt-when`}>{table.when}</p>
      {table.reference?.note && <p>{table.reference.note}</p>}
      {table.reference && !table.grid?.use_reference && <FormsReference grid={table.reference} primary={false} />}
      <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={`Примеры: ${table.title}`}><table className={styles.detailTable}>
        <thead><tr><th scope="col">Когда</th><th scope="col">Порядок слов</th><th scope="col">Пример и перевод</th></tr></thead>
        <tbody>{table.rows.map(row => <tr key={row.id} className={`tt-row-${row.id}`} data-tutor-target={`row_${row.id}`}><th scope="row" className="tt-label">{row.label}</th>
          <td className="tt-pattern"><SentenceTokens tokens={row.pattern} formula /></td><td className="tt-example"><SentenceTokens tokens={row.example} /><p className="tt-translation">{row.translation}</p>{row.note && <p className="tt-row-note">{row.note}</p>}</td>
        </tr>)}</tbody>
      </table></div>
      <div className={`${styles.pitfalls} tt-pitfalls`}><h3>Частые ошибки</h3>{table.pitfalls.map(item => <div className={styles.pitfall} key={item.wrong}><span className={styles.wrong}><s>{item.wrong}</s></span><span className={styles.right}>{item.right}</span><p>{item.why}</p></div>)}</div>
      <details className={`${styles.notes} tt-notes`}><summary>Уточнения и источники</summary><ul>{table.notes.map(note => <li key={note}>{note}</li>)}</ul><ul>{table.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
      {table.related.length > 0 && <nav className={styles.related} aria-label="Связанные таблицы">{table.related.map(id => { const related = tables.find(item => item.id === id); return related ? <a key={id} href={`/grammar/english?level=${related.level}#${id}`}>{related.grid?.title ?? related.title}</a> : null; })}</nav>}
    </div></details>
  </article></div>;
}
