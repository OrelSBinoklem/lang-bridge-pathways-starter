import TableCard from '../../TableCard.jsx';
export default function TableDeclensions2() {
  return (
    <TableCard>
      <div className="card table-declensions">
        <h2>Locījumi (M+F) — склонения существительных</h2>
        <p className="muted">
          Таблица склонений существительных мужского и женского рода с доминирующими гласными над
          колонками.
        </p>
        <table>
          <colgroup>
            <col style={{ width: '170px', minWidth: '170px' }} />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="groups">
              <th />
              <th colSpan={2}>V</th>
              <th colSpan={2}>S</th>
            </tr>
          </thead>
          <tbody>
            <tr className="tehnical-row">
              <td className="case">
                <span className="lv">kas?</span>
              </td>
              <td>-s, -š</td>
              <td>-ais</td>
              <td>-a</td>
              <td>-ā</td>
            </tr>
            <tr>
              <td className="case">
                <span className="lv">kā?</span>
              </td>
              <td className="group-ii">-a</td>
              <td>-ā</td>
              <td className="group-ii">-as</td>
              <td>-ās</td>
            </tr>
            <tr>
              <td className="case">
                <span className="lv">kam?</span>
              </td>
              <td className="group-ii">-am</td>
              <td>
                -<span style={{ color: '#9c27b0' }}>aj</span>am
              </td>
              <td className="group-ii">-ai</td>
              <td>
                -<span style={{ color: '#9c27b0' }}>aj</span>ai
              </td>
            </tr>
            <tr>
              <td className="case">
                <span className="lv">ko?</span>
              </td>
              <td className="group-ii">
                -<span>u</span>
              </td>
              <td>
                -<span className="c3" style={{ padding: 0 }}>
                  o
                </span>
              </td>
              <td className="group-ii">
                -<span>u</span>
              </td>
              <td>
                -<span className="c3" style={{ padding: 0 }}>
                  o
                </span>
              </td>
            </tr>
            <tr>
              <td className="case">
                <span className="lv">kur? kad?</span>
              </td>
              <td className="group-ii">-ā</td>
              <td>
                -<span style={{ color: '#9c27b0' }}>aj</span>ā
              </td>
              <td className="group-ii">-ā</td>
              <td>
                -<span style={{ color: '#9c27b0' }}>aj</span>ā
              </td>
            </tr>
            <tr className="subhead">
              <td />
              <td className="sub" colSpan={4} style={{ fontWeight: 'normal', background: '#fff', textAlign: 'center' }}>
                Daudzskaitlis
              </td>
            </tr>
            <tr className="tehnical-row">
              <td className="case">
                <span className="lv">kas?</span>
              </td>
              <td>-i</td>
              <td>-ie</td>
              <td>-as</td>
              <td>-ās</td>
            </tr>
            <tr>
              <td className="case">
                <span className="lv">kā?</span>
              </td>
              <td className="group-ii">-u</td>
              <td>
                -<span className="c3" style={{ padding: 0 }}>
                  o
                </span>
              </td>
              <td className="group-ii">-u</td>
              <td>
                -<span className="c3" style={{ padding: 0 }}>
                  o
                </span>
              </td>
            </tr>
            <tr>
              <td className="case">
                <span className="lv">kam?</span>
              </td>
              <td className="group-ii">-iem</td>
              <td>
                -<span style={{ color: '#9c27b0' }}>aj</span>iem
              </td>
              <td className="group-ii">-ām</td>
              <td>
                -<span style={{ color: '#9c27b0' }}>aj</span>ām
              </td>
            </tr>
            <tr>
              <td className="case">
                <span className="lv">ko?</span>
              </td>
              <td className="group-ii">-us</td>
              <td>-os</td>
              <td className="group-ii">-as</td>
              <td>-ās</td>
            </tr>
            <tr>
              <td className="case">
                <span className="lv">kur? kad?</span>
              </td>
              <td className="group-ii">-os</td>
              <td>
                -<span style={{ color: '#9c27b0' }}>aj</span>os
              </td>
              <td className="group-ii">-ās</td>
              <td>
                -<span style={{ color: '#9c27b0' }}>aj</span>ās
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}



