import TableCard from '../../TableCard.jsx';
import { GENDER_NUMBER_CLASSES, caseClass } from '../../tutorClasses.js';
import './TablePron5.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'pron5-ending-fem' : 'pron5-ending-masc';
  return <span className={cls}>{children}</span>;
}

const ROWS = [
  {
    q: 'Kas?',
    cells: [
      { stem: 'kur-', ending: 'š', gender: 'masc' },
      { stem: 'kur-', ending: 'i', gender: 'masc' },
      { stem: 'kur-', ending: 'a', gender: 'fem' },
      { stem: 'kur-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    q: 'Kā?',
    cells: [
      { stem: 'kur-', ending: 'a', gender: 'masc' },
      { stem: 'kur-', ending: 'u', gender: 'masc' },
      { stem: 'kur-', ending: 'as', gender: 'fem' },
      { stem: 'kur-', ending: 'u', gender: 'fem' },
    ],
  },
  {
    q: 'Kam?',
    cells: [
      { stem: 'kur-', ending: 'am', gender: 'masc' },
      { stem: 'kur-', ending: 'iem', gender: 'masc' },
      { stem: 'kur-', ending: 'ai', gender: 'fem' },
      { stem: 'kur-', ending: 'ām', gender: 'fem' },
    ],
  },
  {
    q: 'Ko?',
    cells: [
      { stem: 'kur-', ending: 'u', gender: 'masc' },
      { stem: 'kur-', ending: 'us', gender: 'masc' },
      { stem: 'kur-', ending: 'u', gender: 'fem' },
      { stem: 'kur-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    q: 'Kur?',
    cells: [
      { stem: 'kur-', ending: 'ā', gender: 'masc' },
      { stem: 'kur-', ending: 'os', gender: 'masc' },
      { stem: 'kur-', ending: 'ā', gender: 'fem' },
      { stem: 'kur-', ending: 'ās', gender: 'fem' },
    ],
  },
];

function CellContent({ cell }) {
  return (
    <>
      {cell.stem}
      <Ending gender={cell.gender}>{cell.ending}</Ending>
    </>
  );
}

export default function TablePron5() {
  return (
    <TableCard>
      <div className="card table-pron5" id="pron5-table-container">
        <div className="pron5-intro">
          <strong>kurš</strong>, <strong>kura</strong>, <strong>kuri</strong>, <strong>kuras</strong> — который,
          которая, которые (м.р.), которые (ж.р.)
        </div>
        <div className="pron5-flex-table" id="pron5-table">
          <div className="pron5-header">
            <div>Jautājums</div>
            <div className="tt-masculine tt-gender-head" style={{ flex: 2 }}>Vīriešu dzimte</div>
            <div className="tt-feminine tt-gender-head" style={{ flex: 2 }}>Sieviešu dzimte</div>
          </div>
          <div className="pron5-subheader">
            <div />
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
          </div>
          <div id="pron5-table-body">
            {ROWS.map((row) => (
              <div className={`pron5-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron5-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                {row.cells.map((cell, i) => (
                  <div className={`pron5-cell ${caseClass(row.q)} ${GENDER_NUMBER_CLASSES[i]}`} key={`${row.q}-${i}`}>
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