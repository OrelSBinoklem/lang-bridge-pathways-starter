import TableCard from '../../TableCard.jsx';
import './TableVocative.css';

function Ending({ gender, children }) {
  const cls = gender === 'fem' ? 'vocative-ending-fem' : 'vocative-ending-masc';
  return <span className={cls}>{children}</span>;
}

function Example({ gender, base, ending }) {
  return (
    <div className={`vocative-example${ending ? '' : ' tt-zero-ending'}`}>
      {base}
      {ending ? <Ending gender={gender}>{ending}</Ending> : null}
    </div>
  );
}

function Cell({ gender, end, endingLabel, examples }) {
  return (
    <div className={`vocative-cell content-cell tt-${gender === 'fem' ? 'feminine' : 'masculine'} tt-ending-${end}`}>
      {endingLabel ? (
        <div>
          <Ending gender={gender}>{endingLabel}</Ending>
        </div>
      ) : null}
      {examples.map((ex, i) => (
        <Example key={i} gender={gender} base={ex.base} ending={ex.ending} />
      ))}
    </div>
  );
}

const SINGULAR = [
  {
    gender: 'masc',
    endingLabel: '-s/-[Ø]',
    end: 's',
    examples: [
      { base: 'tēv', ending: 's!' },
      { base: 'tēv!', ending: '' },
    ],
  },
  {
    gender: 'masc',
    endingLabel: '-i',
    end: 'i',
    examples: [{ base: 'brāl', ending: 'i!' }],
  },
  {
    gender: 'masc',
    endingLabel: '-u',
    end: 'u',
    examples: [{ base: 'Mik', ending: 'u!' }],
  },
  {
    gender: 'fem',
    endingLabel: '-a/-[Ø]',
    end: 'a',
    examples: [
      { base: 'mās', ending: 'a!' },
      { base: 'mās!', ending: '' },
    ],
  },
  {
    gender: 'fem',
    endingLabel: '-e/-[Ø]',
    end: 'e',
    examples: [
      { base: 'māt', ending: 'e!' },
      { base: 'māt!', ending: '' },
    ],
  },
  {
    gender: 'fem',
    endingLabel: '-s',
    end: 's',
    examples: [{ base: 'ziv', ending: 's!' }],
  },
];

const PLURAL = [
  {
    gender: 'masc',
    endingLabel: '',
    end: 'i',
    examples: [{ base: 'tēv', ending: 'i!' }],
  },
  {
    gender: 'masc',
    endingLabel: '-i',
    end: 'i',
    examples: [{ base: 'brāļ', ending: 'i!' }],
  },
  {
    gender: 'masc',
    endingLabel: '',
    end: 'i',
    examples: [{ base: 'Mik', ending: 'i!' }],
  },
  {
    gender: 'fem',
    endingLabel: '-as',
    end: 'as',
    examples: [{ base: 'mās', ending: 'as!' }],
  },
  {
    gender: 'fem',
    endingLabel: '-es',
    end: 'es',
    examples: [{ base: 'ārst', ending: 'es!' }],
  },
  {
    gender: 'fem',
    endingLabel: '-is',
    end: 'is',
    examples: [{ base: 'pil', ending: 'is!' }],
  },
];

export default function TableVocative() {
  return (
    <TableCard>
      <div className="card table-vocative" id="vocative-table-container">
        <div className="vocative-flex-table" id="vocative-table">
          <div className="vocative-body-wrapper">
            <div className="vocative-sidebar">Uzrunas forma (звательный падеж)</div>
            <div id="vocative-table-body">
              <div className="vocative-section-header tt-singular">
                <div className="section-title">Vienskaitlis</div>
              </div>
              <div className="vocative-row tt-singular">
                {SINGULAR.map((cell, i) => (
                  <Cell key={`s-${i}`} {...cell} />
                ))}
              </div>
              <div className="vocative-section-header tt-plural">
                <div className="section-title">Daudzskaitlis</div>
              </div>
              <div className="vocative-row tt-plural">
                {PLURAL.map((cell, i) => (
                  <Cell key={`p-${i}`} {...cell} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TableCard>
  );
}