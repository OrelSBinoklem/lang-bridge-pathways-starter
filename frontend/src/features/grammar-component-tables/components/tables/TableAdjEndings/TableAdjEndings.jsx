import TableCard from '../../TableCard.jsx';
import './TableAdjEndings.css';

function Aj() {
  return <span className="aj">aj</span>;
}

export default function TableAdjEndings() {
  return (
    <TableCard>
      <div className="card table-declensions table-adj-endings" id="adj-endings-table-container">
        <table className="adj-endings-table" id="adj-endings-table">
          <colgroup>
            <col style={{ width: '170px', minWidth: '170px' }} />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
<tr className="groups">
              <th />
              <th className="tt-masculine" colSpan={2}>V</th>
              <th className="tt-feminine" colSpan={2}>S</th>
            </tr>
          </thead>
          <tbody>
            <tr className="tehnical-row tt-nominative tt-singular">
              <td className="case tt-case-head">
                <span className="lv">kas?</span>
              </td>
              <td className="tt-masculine tt-indefinite">-s, -š</td>
              <td className="tt-masculine tt-definite">-ais</td>
              <td className="tt-feminine tt-indefinite">-a</td>
              <td className="tt-feminine tt-definite">-ā</td>
            </tr>
            <tr className="tt-genitive tt-singular">
              <td className="case tt-case-head">
                <span className="lv">kā?</span>
              </td>
              <td className="group-ii tt-masculine tt-indefinite">-a</td>
              <td className="tt-masculine tt-definite">-ā</td>
              <td className="group-ii tt-feminine tt-indefinite">-as</td>
              <td className="tt-feminine tt-definite">-ās</td>
            </tr>
            <tr className="tt-dative tt-singular">
              <td className="case tt-case-head">
                <span className="lv">kam?</span>
              </td>
              <td className="group-ii tt-masculine tt-indefinite">-am</td>
              <td className="tt-masculine tt-definite">
                -<Aj />am
              </td>
              <td className="group-ii tt-feminine tt-indefinite">-ai</td>
              <td className="tt-feminine tt-definite">
                -<Aj />ai
              </td>
            </tr>
            <tr className="tt-accusative tt-singular">
              <td className="case tt-case-head">
                <span className="lv">ko?</span>
              </td>
              <td className="group-ii tt-masculine tt-indefinite">
                -<span>u</span>
              </td>
              <td className="tt-masculine tt-definite">
                -<span className="c3" style={{ padding: 0 }}>
                  o
                </span>
              </td>
              <td className="group-ii tt-feminine tt-indefinite">
                -<span>u</span>
              </td>
              <td className="tt-feminine tt-definite">
                -<span className="c3" style={{ padding: 0 }}>
                  o
                </span>
              </td>
            </tr>
            <tr className="tt-locative tt-singular">
              <td className="case tt-case-head">
                <span className="lv">kur? kad?</span>
              </td>
              <td className="group-ii tt-masculine tt-indefinite">-ā</td>
              <td className="tt-masculine tt-definite">
                -<Aj />ā
              </td>
              <td className="group-ii tt-feminine tt-indefinite">-ā</td>
              <td className="tt-feminine tt-definite">
                -<Aj />ā
              </td>
            </tr>
            <tr className="subhead tt-plural-head">
              <td />
              <td className="sub" colSpan={4}>
                Daudzskaitlis
              </td>
            </tr>
            <tr className="tehnical-row tt-nominative tt-plural">
              <td className="case tt-case-head">
                <span className="lv">kas?</span>
              </td>
              <td className="tt-masculine tt-indefinite">-i</td>
              <td className="tt-masculine tt-definite">-ie</td>
              <td className="tt-feminine tt-indefinite">-as</td>
              <td className="tt-feminine tt-definite">-ās</td>
            </tr>
            <tr className="tt-genitive tt-plural">
              <td className="case tt-case-head">
                <span className="lv">kā?</span>
              </td>
              <td className="group-ii tt-masculine tt-indefinite">-u</td>
              <td className="tt-masculine tt-definite">
                -<span className="c3" style={{ padding: 0 }}>
                  o
                </span>
              </td>
              <td className="group-ii tt-feminine tt-indefinite">-u</td>
              <td className="tt-feminine tt-definite">
                -<span className="c3" style={{ padding: 0 }}>
                  o
                </span>
              </td>
            </tr>
            <tr className="tt-dative tt-plural">
              <td className="case tt-case-head">
                <span className="lv">kam?</span>
              </td>
              <td className="group-ii tt-masculine tt-indefinite">-iem</td>
              <td className="tt-masculine tt-definite">
                -<Aj />iem
              </td>
              <td className="group-ii tt-feminine tt-indefinite">-ām</td>
              <td className="tt-feminine tt-definite">
                -<Aj />ām
              </td>
            </tr>
            <tr className="tt-accusative tt-plural">
              <td className="case tt-case-head">
                <span className="lv">ko?</span>
              </td>
              <td className="group-ii tt-masculine tt-indefinite">-us</td>
              <td className="tt-masculine tt-definite">-os</td>
              <td className="group-ii tt-feminine tt-indefinite">-as</td>
              <td className="tt-feminine tt-definite">-ās</td>
            </tr>
            <tr className="tt-locative tt-plural">
              <td className="case tt-case-head">
                <span className="lv">kur? kad?</span>
              </td>
              <td className="group-ii tt-masculine tt-indefinite">-os</td>
              <td className="tt-masculine tt-definite">
                -<Aj />os
              </td>
              <td className="group-ii tt-feminine tt-indefinite">-ās</td>
              <td className="tt-feminine tt-definite">
                -<Aj />ās
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}