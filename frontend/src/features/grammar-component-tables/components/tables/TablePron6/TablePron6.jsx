import TableCard from '../../TableCard.jsx';
import { GENDER_NUMBER_CLASSES, caseClass } from '../../tutorClasses.js';
import './TablePron6.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'pron6-ending-fem' : 'pron6-ending-masc';
  return <span className={cls}>{children}</span>;
}

const ROWS = [
  {
    q: 'Kas?',
    cells: [
      { text: 'tas' },
      { text: 'tie' },
      { text: 'tā' },
      { text: 'tās' },
    ],
  },
  {
    q: 'Kā?',
    cells: [
      { text: 'tā' },
      { text: 'to' },
      { text: 'tās' },
      { text: 'to' },
    ],
  },
  {
    q: 'Kam?',
    cells: [
      { text: 'tam' },
      { text: 'tiem' },
      { text: 'tai' },
      { text: 'tām' },
    ],
  },
  {
    q: 'Ko?',
    cells: [
      { text: 'to' },
      { text: 'tos' },
      { text: 'to' },
      { text: 'tās' },
    ],
  },
  {
    q: 'Kur?',
    cells: [
      { stem: 'taj-', ending: 'ā', gender: 'masc' },
      { stem: 'taj-', ending: 'os', gender: 'masc' },
      { stem: 'taj-', ending: 'ā', gender: 'fem' },
      { stem: 'taj-', ending: 'ās', gender: 'fem' },
    ],
  },
];

function CellContent({ cell }) {
  if (cell.text) {
    return <>{cell.text}</>;
  }
  return (
    <>
      {cell.stem}
      <Ending gender={cell.gender}>{cell.ending}</Ending>
    </>
  );
}

export default function TablePron6() {
  return (
    <TableCard>
      <div className="card table-pron6" id="pron6-table-container">
        <div className="pron6-intro">
          <strong>tas</strong>, <strong>tā</strong>, <strong>tie</strong>, <strong>tās</strong> — этот,
          эта, эти (м.р.), эти (ж.р.)
        </div>
        <div className="pron6-flex-table" id="pron6-table">
          <div className="pron6-header">
            <div>Jautājums</div>
            <div className="tt-masculine tt-gender-head" style={{ flex: 2 }}>Vīriešu dzimte</div>
            <div className="tt-feminine tt-gender-head" style={{ flex: 2 }}>Sieviešu dzimte</div>
          </div>
          <div className="pron6-subheader">
            <div />
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
          </div>
          <div id="pron6-table-body">
            {ROWS.map((row) => (
              <div className={`pron6-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron6-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                {row.cells.map((cell, i) => (
                  <div className={`pron6-cell ${caseClass(row.q)} ${GENDER_NUMBER_CLASSES[i]}`} key={`${row.q}-${i}`}>
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
