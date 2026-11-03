import { wordId } from '../../tutorClasses.js';
import './TablePaligteikumi.css';

/** Where the subordinate clause may stand relative to the main clause. */
const POSITIONS = { aiz: 'после', starp: 'внутри', pirms: 'перед' };

/** [[…]] marks the subordinate clause; commas are highlighted everywhere. */
export function Marked({ text }) {
  return text.split(/(\[\[.+?\]\]|,)/).map((part, i) => {
    if (part === ',') return <span className="pt-comma" key={i}>,</span>;
    if (part.startsWith('[[')) return <span className="pt-sub" key={i}>{part.slice(2, -2)}</span>;
    return part;
  });
}

export function TypeCard({ t }) {
  return (
    <section className={`pt-type tt-type-${wordId(t.lv)}`}>
      <div className="pt-type-head">
        <span className="pt-type-name">
          <span className="pt-lv">{t.lv}</span>
          <span className="pt-ru">{t.ru}</span>
        </span>
        <span className="pt-pos">
          {Object.keys(POSITIONS).map((k) => (
            <span className={`pt-pill${t.pos.includes(k) ? ' pt-pill--on' : ''}`} key={k}>
              {POSITIONS[k]}
            </span>
          ))}
        </span>
      </div>
      <div className="pt-q">
        <span className="pt-q-mark">?</span> {t.q}
      </div>
      <div className="pt-words tt-card-words">{t.words}</div>
      <div className="pt-sample">
        <span className="pt-sample-lv"><Marked text={t.lv_s} /></span>
        <span className="pt-sample-ru">{t.ru_s}</span>
      </div>
    </section>
  );
}

export function Legend() {
  return (
    <div className="pt-legend">
      <span><span className="pt-sub">palīgteikums</span> — придаточное</span>
      <span>
        <span className="pt-pill pt-pill--on">после</span> — где может стоять относительно главного
      </span>
    </div>
  );
}
