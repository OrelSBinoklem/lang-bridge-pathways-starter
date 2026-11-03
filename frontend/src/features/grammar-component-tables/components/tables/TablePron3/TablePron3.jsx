import TableCard from '../../TableCard.jsx';
import { GENDER_NUMBER_CLASSES, caseClass } from '../../tutorClasses.js';
import './TablePron3.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'pron3-ending-fem' : 'pron3-ending-masc';
  return <span className={cls}>{children}</span>;
}

const ROWS = [
  {
    q: 'Kas?',
    cells: [
      { stem: 'tav-', ending: 's', gender: 'masc', noun: 'brālis' },
      { stem: 'tav-', ending: 'i', gender: 'masc', noun: 'brāļi' },
      { stem: 'tav-', ending: 'a', gender: 'fem', noun: 'māsa' },
      { stem: 'tav-', ending: 'as', gender: 'fem', noun: 'māsas' },
    ],
  },
  {
    q: 'Kā?',
    cells: [
      { stem: 'tav-', ending: 'a', gender: 'masc', noun: 'brāļa' },
      { stem: 'tav-', ending: 'u', gender: 'masc', noun: 'brāļu' },
      { stem: 'tav-', ending: 'as', gender: 'fem', noun: 'māsas' },
      { stem: 'tav-', ending: 'u', gender: 'fem', noun: 'māsu' },
    ],
  },
  {
    q: 'Kam?',
    cells: [
      { stem: 'tav-', ending: 'am', gender: 'masc', noun: 'brālim' },
      { stem: 'tav-', ending: 'iem', gender: 'masc', noun: 'brāļiem' },
      { stem: 'tav-', ending: 'ai', gender: 'fem', noun: 'māsai' },
      { stem: 'tav-', ending: 'ām', gender: 'fem', noun: 'māsām' },
    ],
  },
  {
    q: 'Ko?',
    cells: [
      { stem: 'tav-', ending: 'u', gender: 'masc', noun: 'brāli' },
      { stem: 'tav-', ending: 'us', gender: 'masc', noun: 'brāļus' },
      { stem: 'tav-', ending: 'u', gender: 'fem', noun: 'māsu' },
      { stem: 'tav-', ending: 'as', gender: 'fem', noun: 'māsas' },
    ],
  },
  {
    q: 'Kur?',
    cells: [
      { stem: 'tav-', ending: 'ā', gender: 'masc', noun: 'brālī' },
      { stem: 'tav-', ending: 'os', gender: 'masc', noun: 'brāļos' },
      { stem: 'tav-', ending: 'ā', gender: 'fem', noun: 'māsā' },
      { stem: 'tav-', ending: 'ās', gender: 'fem', noun: 'māsās' },
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

export default function TablePron3() {
  return (
    <TableCard>
      <div className="card table-pron3" id="pron3-table-container">
        <div className="pron3-intro">
          <strong>tavs</strong>, <strong>tava</strong>, <strong>tavi</strong>, <strong>tavas</strong> — твой,
          твоя, твои (м.р.), твои (ж.р.)
        </div>
        <div className="pron3-flex-table" id="pron3-table">
          <div className="pron3-header">
            <div>Jautājums</div>
            <div className="tt-masculine tt-gender-head" style={{ flex: 2 }}>Vīriešu dzimte</div>
            <div className="tt-feminine tt-gender-head" style={{ flex: 2 }}>Sieviešu dzimte</div>
          </div>
          <div className="pron3-subheader">
            <div />
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
          </div>
          <div id="pron3-table-body">
            {ROWS.map((row) => (
              <div className={`pron3-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron3-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                {row.cells.map((cell, i) => (
                  <div className={`pron3-cell ${caseClass(row.q)} ${GENDER_NUMBER_CLASSES[i]}`} key={`${row.q}-${i}`}>
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