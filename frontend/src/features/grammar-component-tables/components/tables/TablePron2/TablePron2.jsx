import TableCard from '../../TableCard.jsx';
import { GENDER_NUMBER_CLASSES, caseClass } from '../../tutorClasses.js';
import './TablePron2.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'pron2-ending-fem' : 'pron2-ending-masc';
  return <span className={cls}>{children}</span>;
}

const ROWS = [
  {
    q: 'Kas?',
    cells: [
      { stem: 'man-', ending: 's', gender: 'masc', noun: 'brālis' },
      { stem: 'man-', ending: 'i', gender: 'masc', noun: 'brāļi' },
      { stem: 'man-', ending: 'a', gender: 'fem', noun: 'māsa' },
      { stem: 'man-', ending: 'as', gender: 'fem', noun: 'māsas' },
    ],
  },
  {
    q: 'Kā?',
    cells: [
      { stem: 'man-', ending: 'a', gender: 'masc', noun: 'brāļa' },
      { stem: 'man-', ending: 'u', gender: 'masc', noun: 'brāļu' },
      { stem: 'man-', ending: 'as', gender: 'fem', noun: 'māsas' },
      { stem: 'man-', ending: 'u', gender: 'fem', noun: 'māsu' },
    ],
  },
  {
    q: 'Kam?',
    cells: [
      { stem: 'man-', ending: 'am', gender: 'masc', noun: 'brālim' },
      { stem: 'man-', ending: 'iem', gender: 'masc', noun: 'brāļiem' },
      { stem: 'man-', ending: 'ai', gender: 'fem', noun: 'māsai' },
      { stem: 'man-', ending: 'ām', gender: 'fem', noun: 'māsām' },
    ],
  },
  {
    q: 'Ko?',
    cells: [
      { stem: 'man-', ending: 'u', gender: 'masc', noun: 'brāli' },
      { stem: 'man-', ending: 'us', gender: 'masc', noun: 'brāļus' },
      { stem: 'man-', ending: 'u', gender: 'fem', noun: 'māsu' },
      { stem: 'man-', ending: 'as', gender: 'fem', noun: 'māsas' },
    ],
  },
  {
    q: 'Kur?',
    cells: [
      { stem: 'man-', ending: 'ā', gender: 'masc', noun: 'brālī' },
      { stem: 'man-', ending: 'os', gender: 'masc', noun: 'brāļos' },
      { stem: 'man-', ending: 'ā', gender: 'fem', noun: 'māsā' },
      { stem: 'man-', ending: 'ās', gender: 'fem', noun: 'māsās' },
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

export default function TablePron2() {
  return (
    <TableCard>
      <div className="card table-pron2" id="pron2-table-container">
        <div className="pron2-intro">
          <strong>mans</strong>, <strong>mana</strong>, <strong>mani</strong>, <strong>manas</strong> — мой,
          моя, мои (м.р.), мои (ж.р.)
        </div>
        <div className="pron2-flex-table" id="pron2-table">
          <div className="pron2-header">
            <div>Jautājums</div>
            <div className="tt-masculine tt-gender-head" style={{ flex: 2 }}>Vīriešu dzimte</div>
            <div className="tt-feminine tt-gender-head" style={{ flex: 2 }}>Sieviešu dzimte</div>
          </div>
          <div className="pron2-subheader">
            <div />
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
          </div>
          <div id="pron2-table-body">
            {ROWS.map((row) => (
              <div className={`pron2-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron2-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                {row.cells.map((cell, i) => (
                  <div className={`pron2-cell ${caseClass(row.q)} ${GENDER_NUMBER_CLASSES[i]}`} key={`${row.q}-${i}`}>
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