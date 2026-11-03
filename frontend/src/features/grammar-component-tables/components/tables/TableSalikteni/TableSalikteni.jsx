import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TableSalikteni.css';

/**
 * Examples are stored as segments, not as finished words: `aCut`/`bCut` are the
 * endings that fall away and `tail` is the new one. The compound is assembled
 * from the same segments, so the arrow always matches what is shown on its left.
 */
const RULES = [
  {
    id: 'keep',
    ru: 'Оба слова целиком',
    lv: 'Abi vārdi saglabā savu formu',
    examples: [
      { a: 'saules', b: 'puķe' },
      { a: 'ūdens', b: 'roze' },
    ],
  },
  {
    id: 'cut',
    ru: 'Первое теряет окончание',
    lv: 'Pirmais vārds zaudē galotni',
    examples: [
      { a: 'sarun', aCut: 'a', b: 'biedrs' },
      { a: 'vied', aCut: 'ais', b: 'tālrunis' },
      { a: 'mašīn', aCut: 'a', b: 'tulks' },
    ],
  },
  {
    id: 'tail',
    ru: 'Второе меняет окончание',
    lv: 'Otrais vārds iegūst citu galotni',
    examples: [
      { a: 'bērz', aCut: 's', b: 'lap', bCut: 'a', tail: 'e' },
      { a: 'brūn', aCut: 's', b: 'ac', bCut: 's', tail: 'is' },
    ],
  },
];

function Source({ stem, cut, tone }) {
  return (
    <span className={`sk-word sk-part--${tone}`}>
      {stem}
      {cut ? <span className="sk-cut">{cut}</span> : null}
    </span>
  );
}

function Compound({ a, b, tail }) {
  return (
    <span className="sk-word sk-word--res">
      <span className="sk-part--a">{a}</span>
      <span className="sk-part--b">{b}</span>
      {tail ? <span className="sk-tail">{tail}</span> : null}
    </span>
  );
}

export default function TableSalikteni() {
  return (
    <TableCard>
      <div className="card table-salikteni">
        <header className="vs-head">
          <h2 className="vs-title">Составные слова</h2>
        </header>

        <div className="sk-hero">
          <span className="sk-word sk-part--a">vārds</span>
          <span className="sk-op">+</span>
          <span className="sk-word sk-part--b">vārds</span>
          <span className="sk-op">=</span>
          <span className="sk-word sk-word--res">
            <span className="sk-part--a">salik</span>
            <span className="sk-part--b">tenis</span>
          </span>
        </div>

        <div className="sk-rules">
          {RULES.map((rule, i) => (
            <section key={rule.id} className={`sk-rule tt-rule-${rule.id}`}>
              <div className="sk-rule-head">
                <span className="sk-num">{i + 1}</span>
                <span className="sk-rule-ru">{rule.ru}</span>
              </div>
              <p className="sk-rule-lv">{rule.lv}</p>
              <div className="sk-examples">
                {rule.examples.map((ex) => (
                  <div className={`sk-formula tt-formula-${wordId(ex.a + ' ' + ex.b)}`} key={ex.a + ex.b}>
                    <Source stem={ex.a} cut={ex.aCut} tone="a" />
                    <span className="sk-op">+</span>
                    <Source stem={ex.b} cut={ex.bCut} tone="b" />
                    <span className="sk-op">→</span>
                    <Compound a={ex.a} b={ex.b} tail={ex.tail} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="sk-legend">
          <span className="sk-legend-item"><span className="sk-part--a">синий</span> — первое слово</span>
          <span className="sk-legend-item"><span className="sk-part--b">оранжевый</span> — второе слово</span>
          <span className="sk-legend-item"><span className="sk-cut">зачёркнуто</span> — отпадает</span>
          <span className="sk-legend-item"><span className="sk-tail">зелёное</span> — новое окончание</span>
        </div>
      </div>
    </TableCard>
  );
}
