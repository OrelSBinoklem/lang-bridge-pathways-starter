import TableCard from '../../TableCard.jsx';
import { GENDER_NUMBER_CLASSES, caseClass } from '../../tutorClasses.js';
import './TablePron4.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'pron4-ending-fem' : 'pron4-ending-masc';
  return <span className={cls}>{children}</span>;
}

const ROWS = [
  {
    q: 'Kas?',
    cells: [
      { stem: 'sav-', ending: 's', gender: 'masc', noun: 'brālis' },
      { stem: 'sav-', ending: 'i', gender: 'masc', noun: 'brāļi' },
      { stem: 'sav-', ending: 'a', gender: 'fem', noun: 'māsa' },
      { stem: 'sav-', ending: 'as', gender: 'fem', noun: 'māsas' },
    ],
  },
  {
    q: 'Kā?',
    cells: [
      { stem: 'sav-', ending: 'a', gender: 'masc', noun: 'brāļa' },
      { stem: 'sav-', ending: 'u', gender: 'masc', noun: 'brāļu' },
      { stem: 'sav-', ending: 'as', gender: 'fem', noun: 'māsas' },
      { stem: 'sav-', ending: 'u', gender: 'fem', noun: 'māsu' },
    ],
  },
  {
    q: 'Kam?',
    cells: [
      { stem: 'sav-', ending: 'am', gender: 'masc', noun: 'brālim' },
      { stem: 'sav-', ending: 'iem', gender: 'masc', noun: 'brāļiem' },
      { stem: 'sav-', ending: 'ai', gender: 'fem', noun: 'māsai' },
      { stem: 'sav-', ending: 'ām', gender: 'fem', noun: 'māsām' },
    ],
  },
  {
    q: 'Ko?',
    cells: [
      { stem: 'sav-', ending: 'u', gender: 'masc', noun: 'brāli' },
      { stem: 'sav-', ending: 'us', gender: 'masc', noun: 'brāļus' },
      { stem: 'sav-', ending: 'u', gender: 'fem', noun: 'māsu' },
      { stem: 'sav-', ending: 'as', gender: 'fem', noun: 'māsas' },
    ],
  },
  {
    q: 'Kur?',
    cells: [
      { stem: 'sav-', ending: 'ā', gender: 'masc', noun: 'brālī' },
      { stem: 'sav-', ending: 'os', gender: 'masc', noun: 'brāļos' },
      { stem: 'sav-', ending: 'ā', gender: 'fem', noun: 'māsā' },
      { stem: 'sav-', ending: 'ās', gender: 'fem', noun: 'māsās' },
    ],
  },
];

function CellContent({ cell }) {
  return (
    <>
      {cell.stem}
      <Ending gender={cell.gender}>{cell.ending}</Ending> <span className="tt-example-noun">{cell.noun}</span>
    </>
  );
}

export default function TablePron4() {
  return (
    <TableCard>
      <div className="card table-pron4" id="pron4-table-container">
        <div className="pron4-intro">
          <strong>savs</strong>, <strong>sava</strong>, <strong>savi</strong>, <strong>savas</strong> — свой,
          своя, свои (м.р.), свои (ж.р.)
        </div>
        <div className="pron4-flex-table" id="pron4-table">
          <div className="pron4-header">
            <div>Jautājums</div>
            <div className="tt-masculine tt-gender-head" style={{ flex: 2 }}>Vīriešu dzimte</div>
            <div className="tt-feminine tt-gender-head" style={{ flex: 2 }}>Sieviešu dzimte</div>
          </div>
          <div className="pron4-subheader">
            <div />
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
          </div>
          <div id="pron4-table-body">
            {ROWS.map((row) => (
              <div className={`pron4-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron4-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                {row.cells.map((cell, i) => (
                  <div className={`pron4-cell ${caseClass(row.q)} ${GENDER_NUMBER_CLASSES[i]}`} key={`${row.q}-${i}`}>
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