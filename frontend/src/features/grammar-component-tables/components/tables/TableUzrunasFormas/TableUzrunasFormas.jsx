import TableCard from '../../TableCard.jsx';
import './TableUzrunasFormas.css';

/**
 * Each example is `stem` + ending: `from` is the dictionary ending, `to` the one
 * used in address. When they differ, the old one is struck and the new one lit.
 */
const CASES = [
  {
    id: 'voc',
    lv: 'Vokatīvs',
    ru: 'звательный',
    when: 'основная форма обращения: окончание отпадает или сокращается',
    words: [
      { stem: 'tēv', from: 's', to: '' },
      { stem: 'Pēter', from: 'is', to: 'i' },
      { stem: 'māt', from: 'e', to: '' },
    ],
  },
  {
    id: 'nom',
    lv: 'Nominatīvs',
    ru: 'именительный',
    when: 'слово остаётся как есть — часто у женских имён, во множественном числе и в группах',
    words: [
      { stem: 'Ann', from: 'a', to: 'a' },
      { stem: 'draug', from: 's', to: 's' },
      { stem: 'bērn', from: 'i', to: 'i' },
    ],
  },
  {
    id: 'acc',
    lv: 'Akuzatīvs',
    ru: 'винительный',
    when: 'у слов 2-го и 3-го склонения, в основном в разговорной речи',
    words: [
      { stem: 'Ing', from: 'us', to: 'u' },
      { stem: 'Mik', from: 'us', to: 'u' },
    ],
  },
];

function Word({ w }) {
  const same = w.from === w.to;
  return (
    <span className="uf-word">
      <span className="uf-base">
        {w.stem}
        <span className={same ? '' : 'uf-cut'}>{w.from}</span>
      </span>
      <span className="uf-arrow">→</span>
      <span className="uf-form">
        {w.stem}
        {w.to ? <span className={same ? '' : 'uf-new'}>{w.to}</span> : null}!
      </span>
    </span>
  );
}

export default function TableUzrunasFormas() {
  return (
    <TableCard>
      <div className="card table-uzrunas-formas">
        <header className="vs-head">
          <h2 className="vs-title">Формы обращения</h2>
        </header>

        <div className="uf-intro">В обращении в латышском используют три разных падежа.</div>

        <div className="uf-cols">
          {CASES.map((c) => (
            <section className={`uf-col uf-col--${c.id}`} key={c.id}>
              <div className="uf-col-head">
                <span className="uf-lv">{c.lv}</span>
                <span className="uf-ru">{c.ru}</span>
              </div>
              <div className="uf-when">{c.when}</div>
              <div className="uf-words">
                {c.words.map((w) => <Word w={w} key={w.stem} />)}
              </div>
            </section>
          ))}
        </div>

        <div className="uf-note">
          💡 Звательный падеж бывает не только у существительных — его получают и прилагательные или причастия,
          употреблённые вместо существительного.
        </div>
      </div>
    </TableCard>
  );
}
