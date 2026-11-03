import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TableGenitivs.css';

/**
 * Each token carries a `role`: `head` (the main word), `gen` (a noun in the genitive)
 * or `adj` (a Russian adjective). The same colors run through the Russian and the
 * Latvian line, so the reader sees which word ends up where.
 */
const RU_VARIANTS = [
  {
    id: 'right',
    title: 'Главное слово справа',
    hint: 'прилагательное + существительное',
    rows: [
      {
        ru: [{ t: 'рабочий', role: 'adj' }, { t: 'стол', role: 'head' }],
        lv: [{ t: 'darba', role: 'gen' }, { t: 'galds', role: 'head' }],
      },
      {
        ru: [{ t: 'школьная', role: 'adj' }, { t: 'тетрадь', role: 'head' }],
        lv: [{ t: 'skolas', role: 'gen' }, { t: 'burtnīca', role: 'head' }],
      },
    ],
    note: 'Порядок тот же, но прилагательное превращается в существительное в родительном: «рабочий» = «работы».',
  },
  {
    id: 'left',
    title: 'Главное слово слева',
    hint: 'существительное + существительное в родительном',
    rows: [
      {
        ru: [{ t: 'дом', role: 'head' }, { t: 'брата', role: 'gen' }],
        lv: [{ t: 'brāļa', role: 'gen' }, { t: 'māja', role: 'head' }],
      },
      {
        ru: [{ t: 'президент', role: 'head' }, { t: 'Латвии', role: 'gen' }],
        lv: [{ t: 'Latvijas', role: 'gen' }, { t: 'prezidents', role: 'head' }],
      },
    ],
    note: 'Слова меняются местами: родительный идёт вперёд, главное слово — в конец.',
  },
];

function Tokens({ list }) {
  return (
    <span className="gn-tokens">
      {list.map((tok, i) => (
        <span className={`gn-tok gn-tok--${tok.role} ${tok.role === 'head' ? 'tt-head' : tok.role === 'gen' ? 'tt-genitive' : ''}`} key={tok.t + i}>
          {tok.t}
        </span>
      ))}
    </span>
  );
}

export default function TableGenitivs() {
  return (
    <TableCard>
      <div className="card table-genitivs">
        <header className="vs-head">
          <h2 className="vs-title">Генитивный оборот</h2>
        </header>

        <section className="gn-def">
          <div className="gn-def-text">
            <strong>Генитивный оборот</strong> — словосочетание из главного слова и слова в{' '}
            <strong>родительном падеже</strong> («чей? чего?»).
          </div>
          <div className="gn-rule tt-rule-noun-as-adjective">
            По сути это <strong>существительное в роли прилагательного</strong>: оно отвечает на
            «какой? чей?», <strong>всегда стоит в родительном падеже</strong> и{' '}
            <strong>не согласуется</strong> с главным словом.
          </div>
          <div className="gn-rule tt-rule-head-right">
            В латышском <span className="gn-tok gn-tok--head">главное слово</span> всегда стоит{' '}
            <strong>справа</strong>, в конце.
          </div>
        </section>

        <h3 className="gn-h">В русском бывает по-разному</h3>

        {RU_VARIANTS.map((v) => (
          <section className={`gn-block tt-block-${v.id}`} key={v.id}>
            <div className="gn-block-head">
              <span className="gn-block-title">{v.title}</span>
              <span className="gn-block-hint">{v.hint}</span>
            </div>

            <ul className="gn-rows">
              {v.rows.map((r) => (
                <li className={`gn-row tt-row-${wordId(r.lv[0].t + ' ' + r.lv[1].t)}`} key={r.lv[0].t}>
                  <span className="gn-side">
                    <span className="gn-lang">RU</span>
                    <Tokens list={r.ru} />
                  </span>
                  <span className="gn-arrow">→</span>
                  <span className="gn-side">
                    <span className="gn-lang gn-lang--lv">LV</span>
                    <Tokens list={r.lv} />
                  </span>
                </li>
              ))}
            </ul>

            <div className="gn-note">{v.note}</div>
          </section>
        ))}

        <div className="gn-check">
          <span className="gn-bad">✗ māja brāļa</span>
          <span className="gn-good">✓ brāļa māja</span>
        </div>
      </div>
    </TableCard>
  );
}
