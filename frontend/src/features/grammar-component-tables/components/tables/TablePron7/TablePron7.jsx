import TableCard from '../../TableCard.jsx';
import { GENDER_NUMBER_CLASSES, caseClass } from '../../tutorClasses.js';
import './TablePron7.css';

const ROWS = [
  {
    q: 'Kas?',
    cells: ['šis', 'šie', 'šī', 'šīs, šās'],
  },
  {
    q: 'Kā?',
    cells: ['šī, šā', 'šo', 'šīs, šās', 'šo'],
  },
  {
    q: 'Kam?',
    cells: ['šim', 'šiem', 'šai', 'šīm'],
  },
  {
    q: 'Ko?',
    cells: ['šo', 'šos', 'šo', 'šīs'],
  },
  {
    q: 'Kur?',
    cells: [
      'šinī, šajā, šai',
      'šinīs, šajos, šais',
      'šinī, šajā, šai',
      'šinīs, šajās, šais',
    ],
  },
];

export default function TablePron7() {
  return (
    <TableCard>
      <div className="card table-pron7" id="pron7-table-container">
        <div className="pron7-intro">
          <strong>šis</strong>, <strong>šī</strong>, <strong>šie</strong>, <strong>šīs</strong> — этот,
          эта, эти (м.р.), эти (ж.р.)
        </div>
        <div className="pron7-flex-table" id="pron7-table">
          <div className="pron7-header">
            <div>Jautājums</div>
            <div className="tt-masculine tt-gender-head" style={{ flex: 2 }}>Vīriešu dzimte</div>
            <div className="tt-feminine tt-gender-head" style={{ flex: 2 }}>Sieviešu dzimte</div>
          </div>
          <div className="pron7-subheader">
            <div />
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
            <div className="tt-singular tt-number-head" style={{ flex: 1 }}>Vienskaitlis</div>
            <div className="tt-plural tt-number-head" style={{ flex: 1 }}>Daudzskaitlis</div>
          </div>
          <div id="pron7-table-body">
            {ROWS.map((row) => (
              <div className={`pron7-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron7-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                {row.cells.map((text, i) => (
                  <div className={`pron7-cell ${caseClass(row.q)} ${GENDER_NUMBER_CLASSES[i]}`} key={`${row.q}-${i}`}>
                    {text}
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