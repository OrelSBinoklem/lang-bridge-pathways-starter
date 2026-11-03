import TableCard from '../../TableCard.jsx';
import { PERSON_CLASSES, caseClass } from '../../tutorClasses.js';
import './TablePron1.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'pron1-ending-fem' : 'pron1-ending-masc';
  return <span className={cls}>{children}</span>;
}

const ROWS = [
  {
    q: 'Kas?',
    cells: [
      'es',
      'tu',
      { stem: 'viņ-', ending: 'š', gender: 'masc' },
      { stem: 'viņ-', ending: 'a', gender: 'fem' },
      'mēs',
      'jūs',
      { stem: 'viņ-', ending: 'i', gender: 'masc' },
      { stem: 'viņ-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    q: 'Kā?',
    cells: [
      'man-is',
      'tev-is',
      { stem: 'viņ-', ending: 'a', gender: 'masc' },
      { stem: 'viņ-', ending: 'as', gender: 'fem' },
      'mūs-u',
      'jūs-u',
      { stem: 'viņ-', ending: 'u', gender: 'masc' },
      { stem: 'viņ-', ending: 'u', gender: 'fem' },
    ],
  },
  {
    q: 'Kam?',
    cells: [
      'man',
      'tev',
      { stem: 'viņ-', ending: 'am', gender: 'masc' },
      { stem: 'viņ-', ending: 'ai', gender: 'fem' },
      'mum-s',
      'jum-s',
      { stem: 'viņ-', ending: 'iem', gender: 'masc' },
      { stem: 'viņ-', ending: 'ām', gender: 'fem' },
    ],
  },
  {
    q: 'Ko?',
    cells: [
      'man-i',
      'tev-i',
      { stem: 'viņ-', ending: 'u', gender: 'masc' },
      { stem: 'viņ-', ending: 'u', gender: 'fem' },
      'mūs',
      'jūs',
      { stem: 'viņ-', ending: 'us', gender: 'masc' },
      { stem: 'viņ-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    q: 'Kur?',
    cells: [
      'man-ī',
      'tev-ī',
      { stem: 'viņ-', ending: 'ā', gender: 'masc' },
      { stem: 'viņ-', ending: 'ā', gender: 'fem' },
      'mūs-os',
      'jūs-os',
      { stem: 'viņ-', ending: 'os', gender: 'masc' },
      { stem: 'viņ-', ending: 'ās', gender: 'fem' },
    ],
  },
];

function CellContent({ cell }) {
  if (typeof cell === 'string') return cell;
  return (
    <>
      {cell.stem}
      <Ending gender={cell.gender}>{cell.ending}</Ending>
    </>
  );
}

export default function TablePron1() {
  return (
    <TableCard>
      <div className="card table-pron1" id="pron1-table-container">
        <div className="pron1-intro">
          <strong>es</strong>, <strong>tu</strong>, <strong>viņš</strong>, <strong>viņa</strong>,{' '}
          <strong>mēs</strong>, <strong>jūs</strong>, <strong>viņi</strong>, <strong>viņas</strong> — я, ты,
          он, она, мы, вы, они (м.р.), они (ж.р.)
        </div>
        <div className="pron1-flex-table" id="pron1-table">
          <div className="pron1-header">
            <div>Jautājums</div>
            <div className="tt-singular tt-number-head" style={{ flex: 2 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 2 }}>Daudzskaitlis</div>
          </div>
          <div className="pron1-subheader">
            <div />
            <div className="tt-person-es tt-person-head" style={{ flex: '0.5' }}>es</div>
            <div className="tt-person-tu tt-person-head" style={{ flex: '0.5' }}>tu</div>
            <div className="tt-person-vins tt-person-head" style={{ flex: '0.5' }}>viņš</div>
            <div className="tt-person-vina tt-person-head" style={{ flex: '0.5' }}>viņa</div>
            <div className="tt-person-mes tt-person-head" style={{ flex: '0.5' }}>mēs</div>
            <div className="tt-person-jus tt-person-head" style={{ flex: '0.5' }}>jūs</div>
            <div className="tt-person-vini tt-person-head" style={{ flex: '0.5' }}>viņi</div>
            <div className="tt-person-vinas tt-person-head" style={{ flex: '0.5' }}>viņas</div>
          </div>
          <div id="pron1-table-body">
            {ROWS.map((row) => (
              <div className={`pron1-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron1-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                {row.cells.map((cell, i) => (
                  <div className={`pron1-cell ${caseClass(row.q)} ${PERSON_CLASSES[i]}`} key={`${row.q}-${i}`}>
                    <CellContent cell={cell} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </TableCard>
  );
}