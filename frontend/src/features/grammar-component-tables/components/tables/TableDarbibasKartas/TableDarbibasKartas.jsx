import TableCard from '../../TableCard.jsx';
import './TableDarbibasKartas.css';

const ACTIVE = {
  id: 'active',
  lv: 'Darāmā kārta',
  ru: 'действительный залог',
  func: 'Деятель назван в предложении. Действие идёт от него и может переходить на объект.',
  samples: [
    { pre: '', hit: 'Brālis', post: ' remontē velosipēdu.', ru: 'Брат чинит велосипед.' },
    { pre: '', hit: 'Bērni', post: ' zīmē mājas.', ru: 'Дети рисуют дома.' },
  ],
};

const PASSIVE = {
  id: 'passive',
  lv: 'Ciešamā kārta',
  ru: 'страдательный залог',
  func: 'Деятель не назван. Важно само действие или его результат.',
  samples: [
    { pre: 'Velosipēds ', hit: 'tiek remontēts', post: '.', ru: 'Велосипед чинят.' },
    { pre: 'Darbs ', hit: 'ir pabeigts', post: '.', ru: 'Работа завершена.' },
  ],
};

function Samples({ data }) {
  return (
    <div className="dk-samples">
      {data.samples.map((sample) => (
        <p className="dk-sample" key={sample.hit}>
          <span className="dk-sample-lv">
            {sample.pre}
            <span className="dk-hit">{sample.hit}</span>
            {sample.post}
          </span>
          <span className="dk-sample-ru">{sample.ru}</span>
        </p>
      ))}
    </div>
  );
}

export default function TableDarbibasKartas() {
  return (
    <TableCard>
      <div className="card table-darbibas-kartas">
        <header className="vs-head">
          <h2 className="vs-title">Залоги глагола</h2>
        </header>

        <p className="dk-intro">
          Залог показывает связь между деятелем, действием и объектом.
        </p>

        {/* One and the same event, said both ways — the clearest way in. */}
        <div className="dk-hero">
          <span className="dk-hero-side tt-hero-active">
            <span className="dk-hero-lv">Brālis remontē velosipēdu.</span>
            <span className="dk-hero-note">кто делает — назван</span>
          </span>
          <span className="dk-hero-arrow">→</span>
          <span className="dk-hero-side tt-hero-passive">
            <span className="dk-hero-lv">Velosipēds tiek remontēts.</span>
            <span className="dk-hero-note">кто делает — не назван</span>
          </span>
        </div>

        <div className="dk-cols">
          <section className="dk-col dk-col--active">
            <div className="dk-col-head">
              <span className="dk-lv">{ACTIVE.lv}</span>
              <span className="dk-ru">{ACTIVE.ru}</span>
            </div>
            <p className="dk-func">{ACTIVE.func}</p>
            <Samples data={ACTIVE} />
          </section>

          <section className="dk-col dk-col--passive">
            <div className="dk-col-head">
              <span className="dk-lv">{PASSIVE.lv}</span>
              <span className="dk-ru">{PASSIVE.ru}</span>
            </div>
            <p className="dk-func">{PASSIVE.func}</p>

            <div className="dk-formula">
              <span className="dk-formula-label">как образуется</span>
              <span className="dk-formula-body">
                <span className="dk-aux">tikt · tapt · kļūt · būt</span>
                <span className="dk-plus">+</span>
                <span className="dk-part">
                  divdabis на <span className="dk-hit">-ts</span>
                </span>
              </span>
            </div>

            <Samples data={PASSIVE} />
          </section>
        </div>
      </div>
    </TableCard>
  );
}
