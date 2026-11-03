import TableCard from '../../TableCard.jsx';
import './TableAdjectivesIi.css';
export default function TableAdjectivesIi() {
  return (
    <TableCard>
      <div className="card table-adjectives-ii" id="adjectives-ii-table-container">
    <h2>II. DEKLINĀCIJAS ĪPAŠĪBAS VĀRDS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Прилагательные II склонения)</span></h2>
    <div className="adjectives-note">
      <strong>Определённые окончания</strong> (Noteiktā galotne) — используются для образования определённой формы прилагательных.
    </div>
    <table className="decl">
      <thead>
        <tr className="groups"><th></th><th colSpan="3">Vīriešu dzimte (M)</th><th colSpan="3">Sieviešu dzimte (F)</th></tr>
      </thead>
      <tbody>
        <tr className="subhead"><td className="sub" colSpan="1">Vienskaitlis — ед. число</td><td colSpan="6"></td></tr>
        <tr className="domrow"><td></td><td className="dom">a</td><td className="dom">i</td><td className="dom">u</td><td className="dom">a</td><td className="dom">e</td><td className="dom">i</td></tr>
        <tr className="types"><th></th><th>-ais</th><th>-ais</th><th>-ais</th><th>-ā</th><th>-ā</th><th>-ā</th></tr>
        <tr>
          <td className="case"><div className="lv">kas?</div><div className="ru">кто? что?</div></td>
          <td>-ais</td>
          <td>-ais</td>
          <td>-ais</td>
          <td>-ā</td>
          <td>-ā</td>
          <td>-ā</td>
        </tr>
        <tr>
          <td className="case"><div className="lv">kā?</div><div className="ru">кого? чего?</div></td>
          <td>-ā</td>
          <td>-ā</td>
          <td>-ā</td>
          <td>-ās</td>
          <td>-ās</td>
          <td>-ās</td>
        </tr>
        <tr>
          <td className="case"><div className="lv">kam?</div><div className="ru">кому? чему?</div></td>
          <td>-ajam</td>
          <td>-ajam</td>
          <td>-ajam</td>
          <td>-ajai</td>
          <td>-ajai</td>
          <td>-ajai</td>
        </tr>
        <tr>
          <td className="case"><div className="lv">ko?</div><div className="ru">кого? что?</div></td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
        </tr>
        <tr>
          <td className="case"><div className="lv">kur? kad?</div><div className="ru">где? когда?</div></td>
          <td>-ajā</td>
          <td>-ajā</td>
          <td>-ajā</td>
          <td>-ajā</td>
          <td>-ajā</td>
          <td>-ajā</td>
        </tr>
        <tr className="subhead"><td className="sub" colSpan="1">Daudzskaitlis — множественное число</td><td colSpan="6"></td></tr>
        <tr className="domrow"><td></td><td className="dom">a</td><td className="dom">i</td><td className="dom">u</td><td className="dom">a</td><td className="dom">e</td><td className="dom">i</td></tr>
        <tr className="types"><th></th><th>-ie</th><th>-ie</th><th>-ie</th><th>-ās</th><th>-ās</th><th>-ās</th></tr>
        <tr>
          <td className="case"><div className="lv">kas?</div><div className="ru">кто? что?</div></td>
          <td>-ie</td>
          <td>-ie</td>
          <td>-ie</td>
          <td>-ās</td>
          <td>-ās</td>
          <td>-ās</td>
        </tr>
        <tr>
          <td className="case"><div className="lv">kā?</div><div className="ru">кого? чего?</div></td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
        </tr>
        <tr>
          <td className="case"><div className="lv">kam?</div><div className="ru">кому? чему?</div></td>
          <td>-ajiem</td>
          <td>-ajiem</td>
          <td>-ajiem</td>
          <td>-ajām</td>
          <td>-ajām</td>
          <td>-ajām</td>
        </tr>
        <tr>
          <td className="case"><div className="lv">ko?</div><div className="ru">кого? что?</div></td>
          <td>-os</td>
          <td>-os</td>
          <td>-os</td>
          <td>-ās</td>
          <td>-ās</td>
          <td>-ās</td>
        </tr>
        <tr>
          <td className="case"><div className="lv">kur? kad?</div><div className="ru">где? когда?</div></td>
          <td>-ajos</td>
          <td>-ajos</td>
          <td>-ajos</td>
          <td>-ajās</td>
          <td>-ajās</td>
          <td>-ajās</td>
        </tr>
      </tbody>
    </table>
  </div>
    </TableCard>
  );
}



