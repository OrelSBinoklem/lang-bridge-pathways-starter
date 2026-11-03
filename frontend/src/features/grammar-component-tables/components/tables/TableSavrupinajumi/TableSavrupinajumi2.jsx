import TableCard from '../../TableCard.jsx';
import { Sample } from './Savrupinajumi.jsx';

/** A separated adverbial only follows one of the same kind: place → place, time → time. */
const KINDS = [
  { id: 'place', label: 'место → место', lv: 'Tur[[, kalnos,]] vēl ir sniegs.', ru: 'Там, в горах, ещё лежит снег.' },
  { id: 'time', label: 'время → время', lv: 'Tas bija sen[[ — pirms desmit gadiem]].', ru: 'Это было давно — десять лет назад.' },
  { id: 'manner', label: 'образ действия → образ действия', lv: 'Viņš runāja klusi[[, gandrīz čukstus]].', ru: 'Он говорил тихо, почти шёпотом.' },
];

const NOT_SEPARATED = [
  {
    label: 'время по часам после дня или даты',
    lv: 'Piektdien plkst. 18.00 sāksies koncerts.',
    ru: 'В пятницу в 18:00 начнётся концерт.',
  },
  {
    label: 'разные обстоятельства подряд',
    lv: 'Rīt Siguldā notiks velobrauciens.',
    ru: 'Завтра в Сигулде будет велопробег.',
  },
];

export default function TableSavrupinajumi2() {
  return (
    <TableCard>
      <div className="card table-savrupinajumi">
        <header className="vs-head">
          <h2 className="vs-title">Обособленные обстоятельства</h2>
        </header>

        <div className="sv-intro">
          <strong>Savrupināts apstāklis</strong> уточняет обстоятельство и стоит сразу после обстоятельства{' '}
          <strong>того же вида</strong>.
        </div>

        <div className="sv-kinds">
          {KINDS.map((k) => (
            <div className={`sv-kind tt-kind-${k.id}`} key={k.id}>
              <span className="sv-kind-label">{k.label}</span>
              <Sample s={k} />
            </div>
          ))}
        </div>

        <div className="sv-not">
          <div className="sv-not-head">❗ Не обособляют</div>
          {NOT_SEPARATED.map((n, index) => (
            <div className={`sv-kind tt-not-${index + 1}`} key={n.lv}>
              <span className="sv-kind-label">{n.label}</span>
              <Sample s={n} />
            </div>
          ))}
        </div>
      </div>
    </TableCard>
  );
}
