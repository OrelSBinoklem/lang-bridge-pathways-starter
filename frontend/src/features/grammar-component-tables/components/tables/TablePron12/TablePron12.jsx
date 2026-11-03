import TableCard from '../../TableCard.jsx';
import { GENDER_NUMBER_CLASSES, caseClass } from '../../tutorClasses.js';
import './TablePron12.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'pron12-ending-fem' : 'pron12-ending-masc';
  return <span className={cls}>{children}</span>;
}

const ROWS = [
  {
    q: 'Kas?',
    cells: [
      { stem: 'kād-', ending: 's', gender: 'masc' },
      { stem: 'kād-', ending: 'i', gender: 'masc' },
      { stem: 'kād-', ending: 'a', gender: 'fem' },
      { stem: 'kād-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    q: 'Kā?',
    cells: [
      { stem: 'kād-', ending: 'a', gender: 'masc' },
      { stem: 'kād-', ending: 'u', gender: 'masc' },
      { stem: 'kād-', ending: 'as', gender: 'fem' },
      { stem: 'kād-', ending: 'u', gender: 'fem' },
    ],
  },
  {
    q: 'Kam?',
    cells: [
      { stem: 'kād-', ending: 'am', gender: 'masc' },
      { stem: 'kād-', ending: 'iem', gender: 'masc' },
      { stem: 'kād-', ending: 'ai', gender: 'fem' },
      { stem: 'kād-', ending: 'ām', gender: 'fem' },
    ],
  },
  {
    q: 'Ko?',
    cells: [
      { stem: 'kād-', ending: 'u', gender: 'masc' },
      { stem: 'kād-', ending: 'us', gender: 'masc' },
      { stem: 'kād-', ending: 'u', gender: 'fem' },
      { stem: 'kād-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    q: 'Kur?',
    cells: [
      { stem: 'kād-', ending: 'ā', gender: 'masc' },
      { stem: 'kād-', ending: 'os', gender: 'masc' },
      { stem: 'kād-', ending: 'ā', gender: 'fem' },
      { stem: 'kād-', ending: 'ās', gender: 'fem' },
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

export default function TablePron12() {
  return (
    <TableCard>
      <div className="card table-pron12" id="pron12-table-container">
        <div className="pron12-intro">
          <strong>kāds</strong>, <strong>kāda</strong>, <strong>kādi</strong>, <strong>kādas</strong> — какой,
          какая, какие (м.р.), какие (ж.р.)
        </div>
        <div className="pron12-flex-table" id="pron12-table">
          <div className="pron12-header">
            <div>Jautājums</div>
            <div className="tt-masculine tt-gender-head" style={{ flex: 2 }}>Vīriešu dzimte</div>
            <div className="tt-feminine tt-gender-head" style={{ flex: 2 }}>Sieviešu dzimte</div>
          </div>
          <div className="pron12-subheader">
            <div />
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
          </div>
          <div id="pron12-table-body">
            {ROWS.map((row) => (
              <div className={`pron12-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron12-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                {row.cells.map((cell, i) => (
                  <div className={`pron12-cell ${caseClass(row.q)} ${GENDER_NUMBER_CLASSES[i]}`} key={`${row.q}-${i}`}>
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