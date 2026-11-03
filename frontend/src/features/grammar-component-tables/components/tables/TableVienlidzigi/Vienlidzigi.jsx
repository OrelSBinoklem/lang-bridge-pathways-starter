import './TableVienlidzigi.css';

/**
 * Shared renderer for the two "vienlīdzīgi teikuma locekļi" cards:
 * {{…}} = homogeneous member (v), [[…]] = generalising word (V),
 * and every , : — outside the markers is highlighted as punctuation.
 */
function Punct({ text }) {
  return text.split(/([,:—])/).map((p, i) =>
    /^[,:—]$/.test(p) ? <span className="vl-pn" key={i}>{p}</span> : p,
  );
}

export function Marked({ text }) {
  return text.split(/(\[\[.+?\]\]|\{\{.+?\}\})/).map((part, i) => {
    if (part.startsWith('[[')) return <span className="vl-gen" key={i}>{part.slice(2, -2)}</span>;
    if (part.startsWith('{{')) return <span className="vl-mem" key={i}>{part.slice(2, -2)}</span>;
    return <Punct text={part} key={i} />;
  });
}
