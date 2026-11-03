import TableCard from '../../TableCard.jsx';
import { Marked, Sample } from './Savrupinajumi.jsx';

const TYPES = [
  {
    id: 'attr',
    lv: 'Savrupināts apzīmētājs',
    ru: 'обособленное определение',
    func: 'определение ставят не перед словом, а после него — чтобы выделить признак',
    shift: { from: 'dziļš un tumšs ezers', to: 'ezers[[, dziļš un tumšs,]]' },
    samples: [
      { lv: 'Ezers[[, dziļš un tumšs,]] vilināja peldētājus.', ru: 'Озеро, глубокое и тёмное, манило купальщиков.' },
      { lv: 'Pie mājas auga ozols[[ — vecs, bet vēl spēcīgs]].', ru: 'У дома рос дуб — старый, но ещё крепкий.' },
    ],
  },
  {
    id: 'appos',
    lv: 'Savrupināts pielikums',
    ru: 'обособленное приложение',
    func: 'существительное, которое поясняет слово перед ним: должность, профессия, кто это',
    shift: { from: 'kaimiņš', to: 'kaimiņš[[, ārsts,]]' },
    samples: [
      { lv: 'Mūsu kaimiņš[[, pieredzējis ārsts,]] mums palīdzēja.', ru: 'Наш сосед, опытный врач, нам помог.' },
      { lv: 'Pie durvīm stāvēja viesis[[ — mans vecais skolotājs]].', ru: 'У двери стоял гость — мой старый учитель.' },
    ],
  },
];

export default function TableSavrupinajumi1() {
  return (
    <TableCard>
      <div className="card table-savrupinajumi">
        <header className="vs-head">
          <h2 className="vs-title">Обособленные члены предложения</h2>
        </header>

        <div className="sv-intro">
          Обособление — член предложения, выделенный <span className="sv-pn">,</span> запятыми или{' '}
          <span className="sv-pn">—</span> тире (в речи — паузой), чтобы уточнить или пояснить его.
        </div>

        <div className="sv-cols">
          {TYPES.map((t) => (
            <section className={`sv-col sv-col--${t.id}`} key={t.id}>
              <div className="sv-col-head">
                <span className="sv-lv">{t.lv}</span>
                <span className="sv-ru">{t.ru}</span>
              </div>
              <div className="sv-func">{t.func}</div>
              <div className="sv-shift">
                <span className="sv-shift-from">{t.shift.from}</span>
                <span className="sv-arrow">→</span>
                <span className="sv-shift-to"><Marked text={t.shift.to} /></span>
              </div>
              <div className="sv-samples">
                {t.samples.map((s) => <Sample s={s} key={s.lv} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </TableCard>
  );
}
