import TableCard from '../../TableCard.jsx';
import './TableDarbibasLaiki.css';

/**
 * A 2×3 matrix: simple / compound × present / past / future. Every example uses
 * the same verb and object, so the only thing that changes across a row is the
 * form being taught — `hit` marks it for highlighting.
 */
const ROWS = [
  {
    id: 'present',
    lv: 'Tagadne',
    ru: 'настоящее',
    simple: {
      lv: 'Vienkāršā tagadne',
      func: 'происходит сейчас, повторяется или вообще',
      pre: 'Es las',
      hit: 'u',
      post: ' grāmatu.',
      ru: 'Я читаю книгу.',
    },
    compound: {
      lv: 'Saliktā tagadne',
      func: 'действие завершено, результат виден сейчас',
      pre: 'Es ',
      hit: 'esmu',
      post: ' izlasījis grāmatu.',
      ru: 'Я прочитал книгу — она прочитана.',
    },
  },
  {
    id: 'past',
    lv: 'Pagātne',
    ru: 'прошедшее',
    simple: {
      lv: 'Vienkāršā pagātne',
      func: 'действие происходило раньше',
      pre: 'Vakar es las',
      hit: 'īju',
      post: ' grāmatu.',
      ru: 'Вчера я читал книгу.',
    },
    compound: {
      lv: 'Saliktā pagātne',
      func: 'завершилось раньше другого действия в прошлом',
      pre: 'Es jau ',
      hit: 'biju',
      post: ' izlasījis grāmatu, kad viņš to ieteica.',
      ru: 'Я уже прочитал книгу, когда он её посоветовал.',
    },
  },
  {
    id: 'future',
    lv: 'Nākotne',
    ru: 'будущее',
    simple: {
      lv: 'Vienkāršā nākotne',
      func: 'действие произойдёт потом',
      pre: 'Rīt es las',
      hit: 'īšu',
      post: ' grāmatu.',
      ru: 'Завтра я буду читать книгу.',
    },
    compound: {
      lv: 'Saliktā nākotne',
      func: 'завершится раньше другого действия в будущем',
      pre: 'Kad es ',
      hit: 'būšu',
      post: ' izlasījis grāmatu, iedošu tev.',
      ru: 'Когда я прочитаю книгу, дам тебе.',
    },
  },
];

function Cell({ data, kind }) {
  return (
    <td className={`dl-cell dl-cell--${kind}`}>
      <span className="dl-name">{data.lv}</span>
      <span className="dl-func">{data.func}</span>
      <span className="dl-sample">
        {data.pre}
        <span className="dl-hit">{data.hit}</span>
        {data.post}
      </span>
      <span className="dl-gloss">{data.ru}</span>
    </td>
  );
}

export default function TableDarbibasLaiki() {
  return (
    <TableCard>
      <div className="card table-darbibas-laiki">
        <header className="vs-head">
          <h2 className="vs-title">Времена глагола</h2>
        </header>

        <table className="dl-table">
          <thead>
            <tr>
              <th className="dl-corner" />
              <th className="dl-th dl-th--simple">
                Vienkāršie laiki
                <span className="dl-th-ru">простые</span>
              </th>
              <th className="dl-th dl-th--compound">
                Saliktie laiki
                <span className="dl-th-ru">сложные</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.id} className={`tt-row-${row.id}`}>
                <th className="dl-rowhead" scope="row">
                  <span className="dl-rowhead-lv">{row.lv}</span>
                  <span className="dl-rowhead-ru">{row.ru}</span>
                </th>
                <Cell data={row.simple} kind="simple" />
                <Cell data={row.compound} kind="compound" />
              </tr>
            ))}
          </tbody>
        </table>

        <p className="dl-note">
          💡 Сложное время — это <strong>būt</strong> в нужном времени плюс причастие:{' '}
          <em>esmu</em> / <em>biju</em> / <em>būšu</em> + <strong>izlasījis</strong>. Причастие не
          меняется — меняется только вспомогательный глагол.
        </p>
      </div>
    </TableCard>
  );
}
