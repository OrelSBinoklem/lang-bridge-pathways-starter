import TableCard from '../../TableCard.jsx';
import './TableSaikli.css';

/**
 * The source's footnote (*no comma / **comma) is the real lesson, so every
 * cell leads with a comma badge. `hit` marks the conjunction together with its
 * comma, so the learner sees exactly where the comma goes — or that there is none.
 */
const GROUPS = [
  {
    id: 'join',
    words: 'un · vai · jeb',
    ru: 'соединяют, выбирают',
    between: {
      comma: false,
      samples: [
        { pre: 'maize ', hit: 'un', post: ' piens' },
        { pre: 'šodien ', hit: 'vai', post: ' rīt' },
        { pre: 'ārsts ', hit: 'jeb', post: ' dakteris' },
      ],
      extra: {
        text: 'но если un повторяется — запятая:',
        sample: { pre: 'mamma un tētis', hit: ', un', post: ' vecmāmiņa' },
      },
    },
    clauses: {
      comma: true,
      samples: [
        { pre: 'Viņš strādā', hit: ', un', post: ' viņa mācās.' },
        { pre: 'Nezinu', hit: ', vai', post: ' viņš atnāks.' },
      ],
    },
  },
  {
    id: 'contrast',
    words: 'bet · tomēr · taču · ne vien…, bet arī · gan…, gan',
    ru: 'противопоставляют, перечисляют парой',
    between: {
      comma: true,
      samples: [
        { pre: 'mazs', hit: ', bet', post: ' ērts dzīvoklis' },
        { pre: 'dārgs', hit: ', tomēr', post: ' kvalitatīvs' },
        { pre: 'ne vien skaists', hit: ', bet arī', post: ' gudrs' },
        { pre: 'gan pilsētā', hit: ', gan', post: ' laukos' },
      ],
    },
    clauses: {
      comma: true,
      samples: [
        { pre: 'Gribēju braukt', hit: ', bet', post: ' sāka līt.' },
        { pre: 'Bija auksts', hit: ', tomēr', post: ' gājām pastaigā.' },
      ],
    },
  },
];

function Sample({ s }) {
  return (
    <span className="sa-sample">
      {s.pre}
      <span className="sa-hit">{s.hit}</span>
      {s.post}
    </span>
  );
}

function Cell({ data, kind }) {
  return (
    <td className={`sa-cell tt-${kind}`}>
      <span className={`sa-badge ${data.comma ? 'sa-badge--yes' : 'sa-badge--no'}`}>
        {data.comma ? '✓ с запятой' : '✗ без запятой'}
      </span>
      <span className="sa-samples">
        {data.samples.map((s) => <Sample s={s} key={s.pre + s.hit} />)}
      </span>
      {data.extra ? (
        <span className="sa-extra">
          <span className="sa-extra-text">{data.extra.text}</span>
          <Sample s={data.extra.sample} />
        </span>
      ) : null}
    </td>
  );
}

export default function TableSaikli() {
  return (
    <TableCard>
      <div className="card table-saikli">
        <header className="vs-head">
          <h2 className="vs-title">Использование союзов</h2>
        </header>

        <table className="sa-table">
          <thead>
            <tr>
              <th className="sa-corner">Saikļi</th>
              <th>
                Starp vārdiem
                <span className="sa-th-ru">между словами</span>
              </th>
              <th>
                Starp teikuma daļām
                <span className="sa-th-ru">между частями предложения</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <tr key={group.id} className={`tt-group-${group.id}`}>
                <th className="sa-rowhead" scope="row">
                  <span className="sa-words">{group.words}</span>
                  <span className="sa-row-ru">{group.ru}</span>
                </th>
                <Cell data={group.between} kind="between-words" />
                <Cell data={group.clauses} kind="between-clauses" />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sa-note">
          💡 Коротко: между частями предложения запятая нужна всегда. Между словами её не ставят только с одиночными{' '}
          <em>un · vai · jeb</em>.
        </div>
      </div>
    </TableCard>
  );
}
