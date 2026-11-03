import TableCard from '../../TableCard.jsx';
import './TableConsonant.css';

const ROWS = [
  { type: 'сущ.', pairs: ['c - č', 'n - ņ', 'p - pj', 'zl - žļ'] },
  { type: 'гл.', pairs: ['c - k', 's - š', 'b - bj', 'sn - šņ'] },
  { type: 'сущ.', pairs: ['dz - dž', 'z - ž', 'm - mj', 'zn - žņ'] },
  { type: 'гл.', pairs: ['dz - g', 't - š', 'v - vj', 'ln - ļņ'] },
  { type: '', pairs: ['l - ļ', 'd - ž', 'sl - šļ', ''] },
];

/** Kind of alternation, for the tutor bot (tt-kind-* classes on the pair cells). */
const PAIR_KIND = {
  'c - č': 'hushing', 's - š': 'hushing', 'dz - dž': 'hushing', 'z - ž': 'hushing', 't - š': 'hushing', 'd - ž': 'hushing',
  'n - ņ': 'softening', 'l - ļ': 'softening',
  'p - pj': 'labial-j', 'b - bj': 'labial-j', 'm - mj': 'labial-j', 'v - vj': 'labial-j',
  'zl - žļ': 'cluster', 'sn - šņ': 'cluster', 'zn - žņ': 'cluster', 'ln - ļņ': 'cluster', 'sl - šļ': 'cluster',
  'c - k': 'velar', 'dz - g': 'velar',
};

const rowKind = (type) => (type === 'сущ.' ? 'tt-nouns' : type === 'гл.' ? 'tt-verbs' : 'tt-unlabeled');

function Row({ type, pairs }) {
  return (
    <div className={`consonant-row ${rowKind(type)}`}>
      <div className="consonant-cell consonant-cell-type">{type}</div>
      {pairs.map((pair, i) => (
        <div key={i} className={`consonant-cell consonant-cell-pair${PAIR_KIND[pair] ? ` tt-kind-${PAIR_KIND[pair]}` : ''}`}>
          {pair}
        </div>
      ))}
    </div>
  );
}

export default function TableConsonant() {
  return (
    <TableCard>
      <div className="card table-consonant" id="consonant-table-container">
        <div className="consonant-flex-table" id="consonant-table">
          <div className="consonant-header">
            <div className="consonant-header-title">
              LĪDZSKAŅU MIJA (ЧЕРЕДОВАНИЕ СОГЛАСНЫХ)
            </div>
          </div>
          <div id="consonant-table-body">
            {ROWS.map((row, i) => (
              <Row key={i} type={row.type} pairs={row.pairs} />
            ))}
          </div>
        </div>
      </div>
    </TableCard>
  );
}