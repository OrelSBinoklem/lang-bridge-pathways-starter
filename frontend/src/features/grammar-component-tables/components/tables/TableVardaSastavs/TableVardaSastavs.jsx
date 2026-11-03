import TableCard from '../../TableCard.jsx';
import './TableVardaSastavs.css';

function Cell({ kind, children, empty }) {
  if (empty) {
    return <td className={`vs-m vs-m--empty vs-m--${kind || 'root'}`}><span className="vs-empty">·</span></td>;
  }
  return (
    <td className={`vs-m vs-m--${kind}`}>
      <span className={`vs-chip vs-chip--${kind}`}>{children}</span>
    </td>
  );
}

function LabelCell({ kind, children }) {
  return (
    <td className={`vs-lab vs-lab--${kind}`}>
      {children}
    </td>
  );
}

export default function TableVardaSastavs() {
  return (
    <TableCard>
      <div className="card table-varda-sastavs">
        <header className="vs-head">
          <h2 className="vs-title">Структура слова</h2>
        </header>

        <table className="vs-table">
          <tbody>
            <tr className="vs-word-row tt-word-neparrakstija">
              <Cell kind="prefix">ne</Cell>
              <Cell kind="prefix">pār</Cell>
              <Cell kind="root">rakst</Cell>
              <Cell kind="suffix" empty />
              <Cell kind="suffix">īj</Cell>
              <Cell kind="ending">a</Cell>
            </tr>

            <tr className="vs-word-row tt-word-macitajs">
              <Cell kind="prefix" empty />
              <Cell kind="prefix" empty />
              <Cell kind="root">māc</Cell>
              <Cell kind="suffix">īt</Cell>
              <Cell kind="suffix">āj</Cell>
              <Cell kind="ending">s</Cell>
            </tr>

            <tr className="vs-colheads">
              <th className="vs-lab vs-lab--prefix">priedēklis</th>
              <th className="vs-lab vs-lab--prefix">priedēklis</th>
              <th className="vs-lab vs-lab--root">sakne</th>
              <th className="vs-lab vs-lab--suffix">piedēklis</th>
              <th className="vs-lab vs-lab--suffix">piedēklis</th>
              <th className="vs-lab vs-lab--ending">galotne</th>
            </tr>

            <tr className="vs-label-row">
              <LabelCell kind="prefix">приставка</LabelCell>
              <LabelCell kind="prefix">приставка</LabelCell>
              <LabelCell kind="root">корень</LabelCell>
              <LabelCell kind="suffix">суффикс</LabelCell>
              <LabelCell kind="suffix">суффикс</LabelCell>
              <LabelCell kind="ending">окончание</LabelCell>
            </tr>

            <tr className="vs-group-row vs-group-row--stem">
              <td className="vs-group vs-group--stem" colSpan={5}>
                <strong>celms</strong> — основа
              </td>
              <td className="vs-group-pad" />
            </tr>
            <tr className="vs-group-row vs-group-row--tail">
              <td className="vs-group-pad" />
              <td className="vs-group-pad" />
              <td className="vs-group-pad" />
              <td className="vs-group-pad" />
              <td className="vs-group vs-group--tail" colSpan={2}>
                <strong>izskaņa</strong> — финальная часть
              </td>
            </tr>
          </tbody>
        </table>

        <div className="vs-notes">
          <div className="vs-note tt-note-saliktenis">
            <strong>saliktenis</strong> — составное слово с <em>двумя корнями</em> (и больше), напр. <em>saules</em>+<em>puķe</em> → saulespuķe
          </div>
          <div className="vs-note tt-note-pamatvards">
            <strong>pamatvārds</strong> — простое / исходное слово (одна основа без приставок и суффиксов)
          </div>
          <div className="vs-note tt-note-atvasinatais">
            <strong>atvasinātais vārds</strong> — производное слово (от основы с приставками / суффиксами)
          </div>
        </div>

      </div>
    </TableCard>
  );
}
