import TableCard from '../../TableCard.jsx';
import './TableNounAdjAgreement.css';

const columns = [
  { key: 'm-sg', label: 'V · vienskaitlis', translation: 'М. р. · ед. ч.', classes: 'tt-masculine tt-singular' },
  { key: 'm-pl', label: 'V · daudzskaitlis', translation: 'М. р. · мн. ч.', classes: 'tt-masculine tt-plural' },
  { key: 'f-sg', label: 'S · vienskaitlis', translation: 'Ж. р. · ед. ч.', classes: 'tt-feminine tt-singular' },
  { key: 'f-pl', label: 'S · daudzskaitlis', translation: 'Ж. р. · мн. ч.', classes: 'tt-feminine tt-plural' },
];

const rows = [
  { key: 'nominative', question: 'Kas?', translation: 'Кто? Что?', forms: [['liels', 'dārzs'], ['lieli', 'dārzi'], ['liela', 'māja'], ['lielas', 'mājas']] },
  { key: 'accusative', question: 'Ko?', translation: 'Кого? Что?', forms: [['lielu', 'dārzu'], ['lielus', 'dārzus'], ['lielu', 'māju'], ['lielas', 'mājas']] },
  { key: 'locative', question: 'Kur?', translation: 'Где?', forms: [['lielā', 'dārzā'], ['lielos', 'dārzos'], ['lielā', 'mājā'], ['lielās', 'mājās']] },
];

export default function TableNounAdjAgreement() {
  return (
    <TableCard>
      <div className="card table-noun-adj-agreement">
        <table>
          <caption className="tt-title">Liels dārzs · liela māja<span>Прилагательное + существительное</span></caption>
          <colgroup><col style={{ width: '16%' }} />{columns.map(column => <col key={column.key} style={{ width: '21%' }} />)}</colgroup>
          <thead>
            <tr className="tt-headings">
              <th scope="col" className="tt-question">Вопрос</th>
              {columns.map(column => <th key={column.key} scope="col" className={column.classes}>{column.label}<small>{column.translation}</small></th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className={`tt-${row.key}`}>
                <th scope="row" className="tt-question">{row.question}<small>{row.translation}</small></th>
                {row.forms.map(([adjective, noun], index) => (
                  <td key={columns[index].key} className={columns[index].classes}>
                    <span className="tt-adjective">{adjective}</span>{' '}<span className="tt-noun">{noun}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tt-rule"><td colSpan={5}>Одинаковые род, число и падеж. Окончания не обязательно совпадают: <strong>liela māja</strong>.</td></tr>
            <tr className="tt-warning"><td colSpan={5}><strong>Lielā mājā</strong> — местный падеж с неопределённым окончанием. Определённое: <strong>lielajā mājā</strong>.</td></tr>
          </tfoot>
        </table>
      </div>
    </TableCard>
  );
}
