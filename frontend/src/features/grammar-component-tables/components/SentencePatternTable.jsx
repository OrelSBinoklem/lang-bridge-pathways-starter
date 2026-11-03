import TableCard from './TableCard.jsx';
import './sentencePatternTable.css';

export default function SentencePatternTable({ tableClass, title, subtitle, columns, rows, rule, warning }) {
  return (
    <TableCard>
      <div className={`card sentence-pattern-table ${tableClass}`}>
        <table>
          <caption className="tt-title">{title}<span>{subtitle}</span></caption>
          <colgroup>{columns.map(column => <col key={column.key} style={{ width: `${column.width}%` }} />)}</colgroup>
          <thead><tr className="tt-headings">{columns.map(column => <th scope="col" key={column.key} className={`tt-${column.key}`}>{column.title}</th>)}</tr></thead>
          <tbody>
            {rows.map(row => <tr key={row.key} className={`tt-row-${row.key} ${row.classes ?? ''}`}>
              {row.cells.map((text, index) => <td key={columns[index].key} className={`tt-${columns[index].key}`}>{text}</td>)}
            </tr>)}
          </tbody>
          <tfoot>
            <tr className="tt-rule"><td colSpan={columns.length}>{rule}</td></tr>
            {warning && <tr className="tt-warning"><td colSpan={columns.length}>{warning}</td></tr>}
          </tfoot>
        </table>
      </div>
    </TableCard>
  );
}
