import TableCard from '../../TableCard.jsx';
import './TableTeikumi.css';

/**
 * All examples are built from the same two clauses, so the only thing that
 * changes between the types is how they are joined — `hit` marks the joint.
 */
const TYPES = [
  {
    id: 'simple',
    lv: 'Vienkāršs teikums',
    ru: 'простое',
    func: 'одна грамматическая основа',
    scheme: 'simple',
    samples: [
      { pre: 'Līst lietus.', hit: '', post: '' },
      { pre: 'Mēs paliekam mājās.', hit: '', post: '' },
    ],
  },
  {
    id: 'coord',
    lv: 'Salikts sakārtots',
    ru: 'сложносочинённое',
    func: 'части равноправны — каждая может стоять сама по себе',
    scheme: 'coord',
    joints: 'un · bet · vai · ,',
    samples: [
      { pre: 'Līst lietus', hit: ', un', post: ' mēs paliekam mājās.' },
      { pre: 'Līst lietus', hit: ',', post: ' mēs paliekam mājās.' },
    ],
  },
  {
    id: 'sub',
    lv: 'Salikts pakārtots',
    ru: 'сложноподчинённое',
    func: 'одна часть зависит от другой и объясняет её',
    scheme: 'sub',
    joints: 'jo · tā kā · kad · ka',
    samples: [
      { pre: 'Mēs paliekam mājās, ', hit: 'jo', post: ' līst lietus.' },
      { pre: '', hit: 'Tā kā', post: ' līst lietus, mēs paliekam mājās.' },
    ],
  },
];

function Scheme({ kind }) {
  if (kind === 'simple') {
    return (
      <div className="tk-scheme">
        <span className="tk-block">teikums</span>
      </div>
    );
  }
  if (kind === 'coord') {
    return (
      <div className="tk-scheme">
        <span className="tk-block">A</span>
        <span className="tk-link">=</span>
        <span className="tk-block">B</span>
      </div>
    );
  }
  return (
    <div className="tk-scheme">
      <span className="tk-block">galvenais</span>
      <span className="tk-link">←</span>
      <span className="tk-block tk-block--dep">palīgteikums</span>
    </div>
  );
}

export default function TableTeikumi() {
  return (
    <TableCard>
      <div className="card table-teikumi">
        <header className="vs-head">
          <h2 className="vs-title">Предложение и классификация предложений</h2>
        </header>

        <div className="tk-cols">
          {TYPES.map((type) => (
            <section className={`tk-col tk-col--${type.id}`} key={type.id}>
              <div className="tk-col-head">
                <span className="tk-lv">{type.lv}</span>
                <span className="tk-ru">{type.ru}</span>
              </div>

              <Scheme kind={type.scheme} />

              <p className="tk-func">{type.func}</p>

              {type.joints ? (
                <div className="tk-joints">
                  <span className="tk-joints-label">связь:</span> {type.joints}
                </div>
              ) : null}

              <div className="tk-samples">
                {type.samples.map((s) => (
                  <span className="tk-sample" key={s.pre + s.hit + s.post}>
                    {s.pre}
                    {s.hit ? <span className="tk-hit">{s.hit}</span> : null}
                    {s.post}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="tk-note">
          💡 Оба <em>salikti</em> — «Идёт дождь» + «Мы остаёмся дома». Разница в связи: <strong>un</strong> ставит части
          рядом на равных, <strong>jo</strong> делает одну причиной другой.
        </div>
      </div>
    </TableCard>
  );
}
