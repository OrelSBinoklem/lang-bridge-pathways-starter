import TableCard from '../../TableCard.jsx';
import { Marked } from './Vienlidzigi.jsx';

const RULES = [
  {
    id: 'none',
    when: 'без союза',
    comma: true,
    samples: [{ lv: 'Vecais vīrs sniedza {{lielu}}, {{sastrādātu}} roku.', ru: 'Старик протянул большую, натруженную руку.' }],
  },
  {
    id: 'un',
    when: 'un · vai · jeb',
    comma: false,
    samples: [{ lv: 'Vecais vīrs sniedza {{lielu}} un {{sastrādātu}} roku.', ru: 'Старик протянул большую и натруженную руку.' }],
    extra: {
      text: 'но если союз повторяется — запятая перед повтором:',
      lv: 'Vīrietis {{atskatījās}} un {{pamāja}}, un {{devās}} tālāk.',
    },
  },
  {
    id: 'bet',
    when: 'bet · taču · tomēr · toties · kā arī · nevis · lai gan · tāpat',
    comma: true,
    samples: [
      { lv: 'Nopirku {{maizi}}, kā arī {{pienu}}.', ru: 'Купил хлеб, а также молоко.' },
      { lv: 'Tas ir {{lēts}}, taču {{kvalitatīvs}} telefons.', ru: 'Это дешёвый, но качественный телефон.' },
    ],
  },
];

export default function TableVienlidzigi1() {
  return (
    <TableCard>
      <div className="card table-vienlidzigi">
        <header className="vs-head">
          <h2 className="vs-title">Однородные члены предложения</h2>
        </header>

        <div className="vl-intro">
          Однородные члены отвечают на один и тот же вопрос и относятся к одному слову:
          <span className="vl-lv vl-block">
            <Marked text="Jaunieši reti apmeklē {{teātri}}, {{operu}} vai {{izstādes}}." />
          </span>
          <span className="vl-ru">Ko apmeklē? — театр, оперу или выставки.</span>
        </div>

        <div className="vl-rows">
          {RULES.map((r) => (
            <section className={`vl-row tt-rule-${r.id}`} key={r.id}>
              <div className="vl-row-head">
                <span className="vl-when">{r.when}</span>
                <span className={`vl-badge ${r.comma ? 'vl-badge--yes' : 'vl-badge--no'}`}>
                  {r.comma ? '✓ с запятой' : '✗ без запятой'}
                </span>
              </div>
              {r.samples.map((s) => (
                <div className="vl-sample" key={s.lv}>
                  <span className="vl-lv"><Marked text={s.lv} /></span>
                  <span className="vl-ru">{s.ru}</span>
                </div>
              ))}
              {r.extra ? (
                <div className="vl-extra">
                  <span className="vl-extra-text">{r.extra.text}</span>
                  <span className="vl-lv"><Marked text={r.extra.lv} /></span>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </TableCard>
  );
}
