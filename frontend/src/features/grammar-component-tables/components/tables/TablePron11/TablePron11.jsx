import TableCard from '../../TableCard.jsx';
import { caseClass } from '../../tutorClasses.js';
import './TablePron11.css';

const ROWS = [
  { q: 'Kas?', form: 'dash', gloss: null },
  { q: 'Kā?', form: 'stem', stem: 'sev-', ending: 'is', gloss: 'себя' },
  { q: 'Kam?', form: 'plain', text: 'sev', gloss: 'себе' },
  { q: 'Ko?', form: 'stem', stem: 'sev-', ending: 'i', gloss: 'себя' },
  { q: 'Kur?', form: 'stem', stem: 'sev-', ending: 'ī', gloss: 'в себе' },
];

function FormCell({ row }) {
  if (row.form === 'dash') {
    return <>—</>;
  }
  if (row.form === 'plain') {
    return (
      <>
        {row.text}{' '}
        <span className="pron11-gloss">— {row.gloss}</span>
      </>
    );
  }
  return (
    <>
      {row.stem}
      <span className="pron11-ending">{row.ending}</span>{' '}
      <span className="pron11-gloss">— {row.gloss}</span>
    </>
  );
}

export default function TablePron11() {
  return (
    <TableCard>
      <div className="card table-pron11" id="pron11-table-container">
        <div className="pron11-intro">
          <strong>sev</strong> — себя
        </div>
        <div className="pron11-flex-table" id="pron11-table">
          <div className="pron11-header">
            <div>Jautājums</div>
            <div>Forma</div>
          </div>
          <div id="pron11-table-body">
            {ROWS.map((row) => (
              <div className={`pron11-row ${caseClass(row.q)}`} key={row.q}>
                <div className={`pron11-cell tt-case-head ${caseClass(row.q)}`}>{row.q}</div>
                <div className={`pron11-cell ${caseClass(row.q)}`}>
                  <FormCell row={row} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TableCard>
  );
}