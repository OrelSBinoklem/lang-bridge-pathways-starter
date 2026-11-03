import TableCard from '../../TableCard.jsx';
import './TableNetiesaRuna.css';

/**
 * Inline markup keeps the examples readable as plain sentences:
 * [[…]] marks what changes (ka, the verb), {{…}} the reported-mood ending.
 */
const ROWS = [
  {
    source: 'Līga: „Rīt es braukšu uz Rīgu.”',
    sourceRu: '«Завтра я поеду в Ригу».',
    ist: 'Līga teica, [[ka]] viņa rīt [[brauks]] uz Rīgu.',
    ats: 'Līga teica, [[ka]] rīt [[braukš]]{{ot}} uz Rīgu.',
  },
  {
    source: 'Toms: „Es strādāju bankā.”',
    sourceRu: '«Я работаю в банке».',
    ist: 'Toms teica, [[ka]] viņš [[strādā]] bankā.',
    ats: 'Toms teica, [[ka]] [[strādāj]]{{ot}} bankā.',
  },
];

function Marked({ text }) {
  return text.split(/(\[\[.+?\]\]|\{\{.+?\}\})/).map((part, i) => {
    if (part.startsWith('[[')) return <span className="nr-hit" key={i}>{part.slice(2, -2)}</span>;
    if (part.startsWith('{{')) return <span className="nr-end" key={i}>{part.slice(2, -2)}</span>;
    return part;
  });
}

export default function TableNetiesaRuna() {
  return (
    <TableCard>
      <div className="card table-netiesa-runa">
        <header className="vs-head">
          <h2 className="vs-title">Косвенная речь</h2>
        </header>

        <div className="nr-intro">
          Netiešā runa — пересказ чужих слов. Кавычки исчезают, появляется <strong>ka</strong>, «я» становится
          «он/она». Форма глагола зависит от того, ручается ли рассказчик за правду.
        </div>

        <table className="nr-table">
          <thead>
            <tr>
              <th className="nr-th-source">
                Tiešā runa
                <span className="nr-th-ru">прямая речь</span>
              </th>
              <th className="nr-th-ist">
                Īstenības izteiksme
                <span className="nr-th-ru">уверен, что это правда</span>
              </th>
              <th className="nr-th-ats">
                Atstāstījuma izteiksme
                <span className="nr-th-ru">передаю с чужих слов</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, index) => (
              <tr key={row.source} className={`tt-row-${index + 1}`}>
                <td className="nr-source">
                  <span className="nr-lv">{row.source}</span>
                  <span className="nr-ru">{row.sourceRu}</span>
                </td>
                <td className="nr-ist">
                  <span className="nr-lv"><Marked text={row.ist} /></span>
                </td>
                <td className="nr-ats">
                  <span className="nr-lv"><Marked text={row.ats} /></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="nr-note">
          💡 Пересказывательное наклонение узнаётся по окончанию <span className="nr-end">-ot</span>:{' '}
          <em>strādājot</em>, <em>braukšot</em>, <em>esot</em>. Оно звучит как «говорят, что…» — рассказчик за
          точность не отвечает.
        </div>
      </div>
    </TableCard>
  );
}
