import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TableIespraudumiKomati.css';

/**
 * `trap` marks words whose Russian equivalents *are* set off by commas —
 * exactly where a Russian speaker will put a wrong comma in Latvian.
 */
const WITH = [
  { lv: 'protams', ru: 'конечно' },
  { lv: 'cerams', ru: 'надеюсь' },
  { lv: 'šķiet', ru: 'кажется' },
  { lv: 'manuprāt', ru: 'по-моему' },
  { lv: 'pirmkārt', ru: 'во-первых' },
  { lv: 'proti', ru: 'а именно' },
  { lv: 'tas ir', ru: 'то есть' },
  { lv: 'kā mēdz teikt', ru: 'как говорится' },
  { lv: 'pēc viņa domām', ru: 'по его мнению' },
  { lv: 'ja atmiņa neviļ', ru: 'если память не изменяет' },
];

const WITHOUT = [
  { lv: 'varbūt', ru: 'может быть', trap: true },
  { lv: 'laikam', ru: 'наверное', trap: true },
  { lv: 'patiesībā', ru: 'на самом деле', trap: true },
  { lv: 'savukārt', ru: 'в свою очередь', trap: true },
  { lv: 'galvenokārt', ru: 'главным образом' },
  { lv: 'tāpat kā', ru: 'так же как' },
  { lv: 'retāk', ru: 'реже' },
];

function Marked({ text }) {
  return text.split(/(\[\[.+?\]\]|,)/).map((part, i) => {
    if (part === ',') return <span className="ik-comma" key={i}>,</span>;
    if (part.startsWith('[[')) return <span className="ik-hit" key={i}>{part.slice(2, -2)}</span>;
    return part;
  });
}

function Column({ id, title, ru, badge, items }) {
  return (
    <section className={`ik-col ik-col--${id}`}>
      <div className="ik-col-head">
        <span className="ik-badge">{badge}</span>
        <span className="ik-titles">
          <span className="ik-lv">{title}</span>
          <span className="ik-ru">{ru}</span>
        </span>
      </div>
      <ul className="ik-items">
        {items.map((it) => (
          <li className={`ik-item tt-word-${wordId(it.lv)}${it.trap ? ' ik-item--trap' : ''}`} key={it.lv}>
            <span className="ik-item-lv">
              {it.trap ? <span className="ik-warn" aria-label="ловушка">⚠</span> : null}
              {it.lv}
            </span>
            <span className="ik-item-ru">{it.ru}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TableIespraudumiKomati() {
  return (
    <TableCard>
      <div className="card table-iespraudumi-komati">
        <header className="vs-head">
          <h2 className="vs-title">Пунктуация с вводными словами</h2>
        </header>

        <div className="ik-cols">
          <Column id="with" title="Ar pieturzīmēm atdala" ru="выделяем запятыми" badge="✓ ," items={WITH} />
          <Column id="without" title="Ar pieturzīmēm neatdala" ru="не выделяем" badge="✗" items={WITHOUT} />
        </div>

        <div className="ik-pair">
          <span className="ik-pair-row tt-pair-with-commas">
            <span className="ik-pair-lv"><Marked text="Viņš, [[protams]], nāks." /></span>
            <span className="ik-pair-ru">Он, конечно, придёт.</span>
          </span>
          <span className="ik-pair-row tt-pair-without-commas">
            <span className="ik-pair-lv"><Marked text="Viņš [[varbūt]] nāks." /></span>
            <span className="ik-pair-ru">Он, может быть, придёт.</span>
          </span>
        </div>

        <div className="ik-note">
          ⚠ Ловушка: <em>varbūt, laikam, patiesībā, savukārt</em> — в русском их аналоги выделяются запятыми, а в
          латышском нет.
        </div>
      </div>
    </TableCard>
  );
}
