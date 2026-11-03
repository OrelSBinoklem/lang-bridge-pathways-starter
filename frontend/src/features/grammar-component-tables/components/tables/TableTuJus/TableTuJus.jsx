import TableCard from '../../TableCard.jsx';
import './TableTuJus.css';

/**
 * Two independent axes the source text mixes into one paragraph: whom you
 * address (tu / jūs) and where you write it (plain text / letter → lower or
 * capital first letter).
 */
const FORMS = [
  {
    id: 'tu',
    word: 'tu',
    abbr: 'vsk.',
    ru: 'ты',
    who: 'к близкому или знакомому человеку',
    plain: { head: 'tu', rest: '' },
    letter: { head: 'T', rest: 'u' },
    sample: { lv: 'Vai tu brauksi līdzi?', ru: 'Ты поедешь с нами?' },
  },
  {
    id: 'jus',
    word: 'jūs',
    abbr: 'dsk.',
    ru: 'вы / Вы',
    who: 'к незнакомому человеку или к нескольким сразу',
    plain: { head: 'jūs', rest: '' },
    letter: { head: 'J', rest: 'ūs' },
    sample: { lv: 'Vai jūs runājat latviski?', ru: 'Вы говорите по-латышски?' },
  },
];

export default function TableTuJus() {
  return (
    <TableCard>
      <div className="card table-tu-jus">
        <header className="vs-head">
          <h2 className="vs-title">Использование местоимений tu и jūs</h2>
        </header>

        <div className="tj-cols">
          {FORMS.map((form) => (
            <section className={`tj-col tj-col--${form.id}`} key={form.id}>
              <div className="tj-col-head">
                <span className="tj-word">{form.word}</span>
                <span className="tj-meta">
                  <span className="tj-abbr">{form.abbr}</span>
                  <span className="tj-ru">{form.ru}</span>
                </span>
              </div>

              <p className="tj-who">{form.who}</p>

              <table className="tj-table">
                <tbody>
                  <tr>
                    <td className="tj-where">обычный текст</td>
                    <td className="tj-form">{form.plain.head}</td>
                  </tr>
                  <tr>
                    <td className="tj-where">в письме</td>
                    <td className="tj-form">
                      <span className="tj-cap">{form.letter.head}</span>
                      {form.letter.rest}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p className="tj-sample">
                <span className="tj-sample-lv">{form.sample.lv}</span>
                <span className="tj-sample-ru">{form.sample.ru}</span>
              </p>
            </section>
          ))}
        </div>

        <p className="tj-note">
          💡 Как в русском: <em>tu</em> — ты, <em>jūs</em> — вы и вежливое Вы. В письме обе формы пишут с
          большой буквы — это знак уважения к читателю, в обычном тексте с маленькой.
        </p>
      </div>
    </TableCard>
  );
}
