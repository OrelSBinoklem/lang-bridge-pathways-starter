import TableCard from '../../TableCard.jsx';
import { GENDER_NUMBER_CLASSES, caseClass } from '../../tutorClasses.js';
import './TablePron13.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'pron13-ending-fem' : 'pron13-ending-masc';
  return <span className={cls}>{children}</span>;
}

function Pronoun({ stem, ending }) {
  return (
    <>
      {stem}
      <span className="pron13-pronoun-ending">{ending}</span>
    </>
  );
}

function Noun({ stem, ending, gender }) {
  return (
    <>
      {stem}
      <Ending gender={gender}>{ending}</Ending>
    </>
  );
}

const ROWS = [
  {
    pronoun: { stem: 'mūs-', ending: 'u' },
    question: 'Kas?',
    nouns: [
      { stem: 'brāl-', ending: 'is', gender: 'masc' },
      { stem: 'brāl-', ending: 'i', gender: 'masc' },
      { stem: 'mās-', ending: 'a', gender: 'fem' },
      { stem: 'mās-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    pronoun: { stem: 'jūs-', ending: 'u' },
    question: 'Kā?',
    nouns: [
      { stem: 'brāļ-', ending: 'a', gender: 'masc' },
      { stem: 'brāļ-', ending: 'u', gender: 'masc' },
      { stem: 'mās-', ending: 'as', gender: 'fem' },
      { stem: 'mās-', ending: 'u', gender: 'fem' },
    ],
  },
  {
    pronoun: { stem: 'viņ-', ending: 'a' },
    question: 'Kam?',
    nouns: [
      { stem: 'brāl-', ending: 'im', gender: 'masc' },
      { stem: 'brāl-', ending: 'iem', gender: 'masc' },
      { stem: 'mās-', ending: 'ai', gender: 'fem' },
      { stem: 'mās-', ending: 'ām', gender: 'fem' },
    ],
  },
  {
    pronoun: { stem: 'viņ-', ending: 'as' },
    question: 'Ko?',
    nouns: [
      { stem: 'brāl-', ending: 'i', gender: 'masc' },
      { stem: 'brāl-', ending: 'us', gender: 'masc' },
      { stem: 'mās-', ending: 'u', gender: 'fem' },
      { stem: 'mās-', ending: 'as', gender: 'fem' },
    ],
  },
  {
    pronoun: { stem: 'viņ-', ending: 'u' },
    question: 'Kur?',
    nouns: [
      { stem: 'brāl-', ending: 'ī', gender: 'masc' },
      { stem: 'brāl-', ending: 'os', gender: 'masc' },
      { stem: 'mās-', ending: 'ā', gender: 'fem' },
      { stem: 'mās-', ending: 'ās', gender: 'fem' },
    ],
  },
];

export default function TablePron13() {
  return (
    <TableCard>
      <div className="card table-pron13" id="pron13-table-container">
        <div className="pron13-intro">
          <strong>mūsu</strong>, <strong>jūsu</strong>, <strong>viņa</strong>, <strong>viņas</strong>,{' '}
          <strong>viņu</strong> — наш, ваш, его, её, их (ж.р.)/их (м.р.)
        </div>
        <table className="pron13-table" id="pron13-table">
          <colgroup>
            <col style={{ width: '70px', minWidth: '70px' }} />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} />
              <th rowSpan={2}>Vietniekvārds</th>
              <th rowSpan={2}>Jautājums</th>
              <th colSpan={2} className="pron13-gender-header-masc tt-masculine tt-gender-head">
                Vīriešu dzimte
              </th>
              <th colSpan={2} className="pron13-gender-header-fem tt-feminine tt-gender-head">
                Sieviešu dzimte
              </th>
            </tr>
            <tr>
              <th className="pron13-subheader-masc tt-singular tt-number-head">Vienskaitlis</th>
              <th className="pron13-subheader-masc tt-plural tt-number-head">Daudzskaitlis</th>
              <th className="pron13-subheader-fem tt-singular tt-number-head">Vienskaitlis</th>
              <th className="pron13-subheader-fem tt-plural tt-number-head">Daudzskaitlis</th>
            </tr>
            <tr>
              <th colSpan={3} />
              <th colSpan={4} className="pron13-noun-cell">
                Lietvārds
              </th>
            </tr>
          </thead>
          <tbody id="pron13-table-body">
            {ROWS.map((row, index) => (
              <tr className={caseClass(row.question)} key={row.question}>
                {index === 0 ? (
                  <td rowSpan={ROWS.length} className="pron13-left-cell">
                    Kā?
                  </td>
                ) : null}
                <td className="pron13-pronoun">
                  <Pronoun stem={row.pronoun.stem} ending={row.pronoun.ending} />
                </td>
                <td className="pron13-left-cell">{row.question}</td>
                {row.nouns.map((noun, i) => (
                  <td className={`pron13-noun-data ${caseClass(row.question)} ${GENDER_NUMBER_CLASSES[i]}`} key={`${row.question}-${i}`}>
                    <Noun stem={noun.stem} ending={noun.ending} gender={noun.gender} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}