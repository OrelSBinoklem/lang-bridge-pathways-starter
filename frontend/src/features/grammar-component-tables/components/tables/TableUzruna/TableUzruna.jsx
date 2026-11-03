import TableCard from '../../TableCard.jsx';
import './TableUzruna.css';

/**
 * The rule is "address is always set off by commas", so rows vary its position
 * in the sentence. [[…]] marks the address; commas are highlighted automatically.
 */
const ROWS = [
  {
    id: 'start',
    pos: 'в начале',
    single: { lv: '[[Kārli]], nāc vakariņās!', ru: 'Карлис, иди ужинать!' },
    group: { lv: '[[Godātie viesi]], laipni lūdzam!', ru: 'Уважаемые гости, добро пожаловать!' },
  },
  {
    id: 'middle',
    pos: 'в середине',
    single: { lv: 'Vai tu, [[Anna]], zini atbildi?', ru: 'Анна, ты знаешь ответ?' },
    group: { lv: 'Priecājos, [[mīļais brāli]], tevi redzēt!', ru: 'Рад тебя видеть, дорогой брат!' },
  },
  {
    id: 'end',
    pos: 'в конце',
    single: { lv: 'Paldies, [[tēv]]!', ru: 'Спасибо, папа!' },
    group: { lv: 'Uz redzēšanos, [[dārgie klausītāji]]!', ru: 'До свидания, дорогие слушатели!' },
  },
];

function Sentence({ text }) {
  return text.split(/(\[\[.+?\]\]|,)/).map((part, i) => {
    if (part === ',') return <span className="uz-comma" key={i}>,</span>;
    if (part.startsWith('[[')) return <span className="uz-addr" key={i}>{part.slice(2, -2)}</span>;
    return part;
  });
}

function Cell({ data, kind }) {
  return (
    <td className={`tt-${kind}`}>
      <span className="uz-lv"><Sentence text={data.lv} /></span>
      <span className="uz-ru">{data.ru}</span>
    </td>
  );
}

export default function TableUzruna() {
  return (
    <TableCard>
      <div className="card table-uzruna">
        <header className="vs-head">
          <h2 className="vs-title">Обращение и группа обращения</h2>
        </header>

        <div className="uz-defs">
          <div className="uz-def tt-def-uzruna">
            <span className="uz-def-name">Uzruna</span>
            <span className="uz-def-text">
              одно слово, которым обращаются к человеку (реже — к предмету). Всегда в звательном падеже:{' '}
              <em>Kārli! Anna! tēv! māt!</em>
            </span>
          </div>
          <div className="uz-def tt-def-group">
            <span className="uz-def-name">Uzrunas grupa</span>
            <span className="uz-def-text">
              обращение + поясняющее слово: <em>Godātie viesi! Mīļais brāli!</em>
            </span>
          </div>
        </div>

        <table className="uz-table">
          <thead>
            <tr>
              <th className="uz-corner">Где стоит</th>
              <th>Uzruna</th>
              <th>Uzrunas grupa</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.pos} className={`tt-pos-${row.id}`}>
                <th className="uz-rowhead" scope="row">{row.pos}</th>
                <Cell data={row.single} kind="single" />
                <Cell data={row.group} kind="group" />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="uz-note">
          💡 Где бы ни стояло обращение, его отделяют запятыми <span className="uz-comma">,</span> с обеих сторон
          (в начале и в конце — с одной).
        </div>
      </div>
    </TableCard>
  );
}
