import TableCard from '../../TableCard.jsx';
import './TableDecimali.css';

/**
 * Decimals in Latvian: digits after a comma, and when spoken/written in words
 * the noun "komats" sits between the whole and the fractional part.
 */
const EXAMPLES = [
  {
    id: 'example-3-5',
    digits: '3,5',
    words: ['trīs', 'komats', 'pieci'],
    ru: 'три, запятая, пять',
  },
  {
    id: 'example-20-35',
    digits: '20,35',
    words: ['divdesmit', 'komats', 'trīsdesmit pieci'],
    ru: 'двадцать, запятая, тридцать пять',
  },
];

export default function TableDecimali() {
  return (
    <TableCard>
      <div className="card table-decimali">
        <header className="vs-head">
          <h2 className="vs-title">Десятичные дроби</h2>
        </header>

        <div className="td-formula" aria-label="Схема десятичного числа">
          <span className="td-part td-part--whole">
            <span className="td-part-label">veselā daļa</span>
            <span className="td-part-value">20</span>
            <span className="td-part-ru">целая часть</span>
          </span>
          <span className="td-plus" aria-hidden="true">
            +
          </span>
          <span className="td-part td-part--komats">
            <span className="td-part-label">komats</span>
            <span className="td-part-value">,</span>
            <span className="td-part-ru">запятая</span>
          </span>
          <span className="td-plus" aria-hidden="true">
            +
          </span>
          <span className="td-part td-part--frac">
            <span className="td-part-label">daļa</span>
            <span className="td-part-value">35</span>
            <span className="td-part-ru">дробная часть</span>
          </span>
        </div>

        <p className="td-rule">
          Обычно пишут <strong>цифрами</strong>. Если произносят или пишут словами — между частями ставят
          существительное <em>komats</em> (и выделяют его запятыми).
        </p>

        <div className="td-examples">
          {EXAMPLES.map((ex) => (
            <article className={`td-ex tt-${ex.id}`} key={ex.digits}>
              <div className="td-ex-digits">{ex.digits}</div>
              <div className="td-ex-words">
                {ex.words.map((w, i) => (
                  <span key={`${ex.digits}-${w}-${i}`} className={w === 'komats' ? 'td-komats' : undefined}>
                    {i > 0 ? ', ' : ''}
                    {w}
                  </span>
                ))}
              </div>
              <div className="td-ex-ru">{ex.ru}</div>
            </article>
          ))}
        </div>

        <p className="td-note">
          Схема: <em>pamata skaitļa vārds</em> (целая) + <em>komats</em> + <em>pamata skaitļa vārds</em>{' '}
          (дробная), piemēram <strong>3,5</strong>.
        </p>
      </div>
    </TableCard>
  );
}
