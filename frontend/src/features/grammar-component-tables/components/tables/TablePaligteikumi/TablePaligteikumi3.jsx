import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TablePaligteikumi.css';

/** Synonyms share a row so the list stays short: learn one meaning, several words. */
const GROUPS = [
  {
    id: 'conj',
    lv: 'Pakārtojuma saikļi',
    ru: 'подчинительные союзы',
    rows: [
      { lv: 'ka', ru: 'что' },
      { lv: 'vai', ru: 'ли' },
      { lv: 'ja', ru: 'если' },
      { lv: 'lai', ru: 'чтобы' },
      { lv: 'jo · tāpēc ka · tādēļ ka', ru: 'потому что' },
      { lv: 'tā kā', ru: 'так как (причина)', trap: true },
      { lv: 'tā ka', ru: 'так что (следствие)', trap: true },
      { lv: 'līdz', ru: 'пока, до того как' },
      { lv: 'tiklīdz', ru: 'как только' },
      { lv: 'lai gan · lai arī · kaut gan · kaut arī', ru: 'хотя' },
    ],
  },
  {
    id: 'pron',
    lv: 'Attieksmes vietniekvārdi',
    ru: 'относительные местоимения',
    note: 'во всех падежах',
    rows: [
      { lv: 'kas', ru: 'кто, что, который' },
      { lv: 'kurš · kura', ru: 'который, которая' },
      { lv: 'kāds · kāda', ru: 'какой, какая' },
    ],
  },
  {
    id: 'adv',
    lv: 'Apstākļa vārdi',
    ru: 'наречия',
    rows: [
      { lv: 'kad', ru: 'когда' },
      { lv: 'kur', ru: 'где' },
      { lv: 'kā', ru: 'как' },
      { lv: 'cik', ru: 'сколько' },
      { lv: 'kamēr', ru: 'пока' },
      { lv: 'kāpēc · kādēļ', ru: 'почему, зачем' },
    ],
  },
  {
    id: 'comb',
    lv: 'Vārdu savienojumi',
    ru: 'сочетания',
    rows: [
      { lv: 'uz kurieni', ru: 'куда' },
      { lv: 'no kurienes', ru: 'откуда' },
      { lv: 'līdz kurienei', ru: 'докуда' },
    ],
  },
];

export default function TablePaligteikumi3() {
  return (
    <TableCard>
      <div className="card table-paligteikumi">
        <header className="vs-head">
          <h2 className="vs-title">Наиболее часто используемые вводные слова придаточных предложений</h2>
        </header>

        <div className="pt-groups">
          {GROUPS.map((g) => (
            <section className={`pt-group pt-group--${g.id}`} key={g.id}>
              <div className="pt-group-head">
                <span className="pt-lv">{g.lv}</span>
                <span className="pt-ru">{g.ru}{g.note ? ` · ${g.note}` : ''}</span>
              </div>
              <ul className="pt-list">
                {g.rows.map((r) => (
                  <li className={`pt-li tt-word-${g.id}-${wordId(r.lv)}${r.trap ? ' pt-li--trap' : ''}`} key={r.lv}>
                    <span className="pt-li-lv">{r.lv}</span>
                    <span className="pt-li-ru">{r.ru}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="pt-foot pt-foot--warn">
          ⚠ <strong>tā kā</strong> и <strong>tā ka</strong> отличаются одной долготой, но смысл противоположный:
          причина («так как») и следствие («так что»).
        </div>
      </div>
    </TableCard>
  );
}
