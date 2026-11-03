import TableCard from '../../TableCard.jsx';
import { caseClass } from '../../tutorClasses.js';
import './TablePron10.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'pron10-ending-fem' : 'pron10-ending-masc';
  return <span className={cls}>{children}</span>;
}

const ROWS = [
  {
    q: 'Kas?',
    cells: [
      { stem: 'pat-', ending: 's', gender: 'masc' },
      { stem: 'paš-', ending: 'i', gender: 'masc' },
      { stem: 'pat-', ending: 'i', gender: 'fem' },
      { stem: 'paš-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    q: 'Kā?',
    cells: [
      { stem: 'paš-', ending: 'a', gender: 'masc' },
      { stem: 'paš-', ending: 'u', gender: 'masc' },
      { stem: 'paš-', ending: 'as', gender: 'fem' },
      { stem: 'paš-', ending: 'u', gender: 'fem' },
    ],
  },
  {
    q: 'Kam?',
    cells: [
      { stem: 'paš-', ending: 'am', gender: 'masc' },
      { stem: 'paš-', ending: 'iem', gender: 'masc' },
      { stem: 'paš-', ending: 'ai', gender: 'fem' },
      { stem: 'paš-', ending: 'ām', gender: 'fem' },
    ],
  },
  {
    q: 'Ko?',
    cells: [
      { stem: 'paš-', ending: 'u', gender: 'masc' },
      { stem: 'paš-', ending: 'us', gender: 'masc' },
      { stem: 'paš-', ending: 'u', gender: 'fem' },
      { stem: 'paš-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    q: 'Kur?',
    cells: [
      { stem: 'paš-', ending: 'ā', gender: 'masc' },
      { stem: 'paš-', ending: 'os', gender: 'masc' },
      { stem: 'paš-', ending: 'ā', gender: 'fem' },
      { stem: 'paš-', ending: 'ās', gender: 'fem' },
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

export default function TablePron10() {
  return (
    <TableCard>
      <div className="card table-pron10" id="pron10-table-container">
        <div className="pron10-intro">
          <strong>pats, pati</strong> — сам, сама
        </div>
        <div className="pron10-flex-table" id="pron10-table">
          <div className="pron10-header">
            <div>Skaitlis</div>
            <div style={{ flex: 2 }}>Vienskaitlis</div>
            <div style={{ flex: 2 }}>Daudzskaitlis</div>
          </div>
          <div className="pron10-subheader">
            <div>Jautājums</div>
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
          </div>
          <div id="pron10-table-body">
            {ROWS.map((row) => (
              <div className={`pron10-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron10-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                {row.cells.map((cell, i) => (
                  <div className={`pron10-cell ${caseClass(row.q)} ${i % 2 === 0 ? 'tt-singular' : 'tt-plural'}`} key={`${row.q}-${i}`}>
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