import './TableSavrupinajumi.css';

/**
 * Shared pieces of the two "savrupinājumi" cards (the source is one table,
 * the gallery splits it in two). [[…]] marks the separated part; commas and
 * dashes are highlighted everywhere so the setting-off is visible.
 */
function Punct({ text }) {
  return text.split(/([,—–])/).map((part, i) =>
    /^[,—–]$/.test(part) ? <span className="sv-pn" key={i}>{part}</span> : part,
  );
}

export function Marked({ text }) {
  return text.split(/(\[\[.+?\]\])/).map((part, i) =>
    part.startsWith('[[') ? (
      <span className="sv-hit" key={i}><Punct text={part.slice(2, -2)} /></span>
    ) : (
      <Punct text={part} key={i} />
    ),
  );
}

export function Sample({ s }) {
  return (
    <span className="sv-sample">
      <span className="sv-sample-lv"><Marked text={s.lv} /></span>
      <span className="sv-sample-ru">{s.ru}</span>
    </span>
  );
}
