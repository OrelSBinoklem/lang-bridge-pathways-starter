import TableCard from '../../TableCard.jsx';
import './TableComparison.css';

function Masc({ children }) {
  return <span className="comparison-ending-masc">{children}</span>;
}

function Fem({ children }) {
  return <span className="comparison-ending-fem">{children}</span>;
}

function Ak({ children }) {
  return <span className="comparison-suffix-ak">{children}</span>;
}

function Vis({ children }) {
  return <span className="comparison-prefix-vis">{children}</span>;
}

export default function TableComparison() {
  return (
    <TableCard>
      <div className="card table-comparison" id="comparison-table-container">
        <table className="comparison" id="comparison-table">
          <thead>
            <tr>
              <th colSpan={7} className="comparison-title">
                SALĪDZINĀMĀS PAKĀPES (Степени сравнения)
              </th>
            </tr>
            <tr>
              <th rowSpan={2} className="comparison-corner" />
              <th className="tt-singular" colSpan={3}>Vienskaitlis</th>
              <th className="tt-plural" colSpan={3}>Daudzskaitlis</th>
            </tr>
            <tr>
              <th className="tt-singular tt-positive">Pamata</th>
              <th className="tt-singular tt-comparative">Pārākā</th>
              <th className="tt-singular tt-superlative">Vispārākā</th>
              <th className="tt-plural tt-positive">Pamata</th>
              <th className="tt-plural tt-comparative">Pārākā</th>
              <th className="tt-plural tt-superlative">Vispārākā</th>
            </tr>
          </thead>
          <tbody>
            <tr className="tt-masculine tt-word-lab">
              <td className="case case-masc tt-gender-cell" rowSpan={2}>
                V
              </td>
              <td className="tt-singular tt-positive">
                lab
                <Masc>s</Masc>
              </td>
              <td className="tt-singular tt-comparative">
                lab-
                <Ak>āk</Ak>-
                <Masc>s</Masc>
              </td>
              <td className="tt-singular tt-superlative">
                <Vis>vis</Vis>-lab-
                <Ak>āk</Ak>-
                <Masc>ais</Masc>
              </td>
              <td className="tt-plural tt-positive">
                lab
                <Masc>i</Masc>
              </td>
              <td className="tt-plural tt-comparative">
                lab-
                <Ak>āk</Ak>-
                <Masc>i</Masc>
              </td>
              <td className="tt-plural tt-superlative">
                <Vis>vis</Vis>-lab-
                <Ak>āk</Ak>-
                <Masc>ie</Masc>
              </td>
            </tr>
            <tr className="tt-masculine tt-word-darg">
              <td className="tt-singular tt-positive">
                dārg
                <Masc>s</Masc>
              </td>
              <td className="tt-singular tt-comparative">
                dārg-
                <Ak>āk</Ak>-
                <Masc>s</Masc>
              </td>
              <td className="tt-singular tt-superlative">
                <Vis>vis</Vis>-dārg-
                <Ak>āk</Ak>-
                <Masc>ais</Masc>
              </td>
              <td className="tt-plural tt-positive">
                dārg
                <Masc>i</Masc>
              </td>
              <td className="tt-plural tt-comparative">
                dārg-
                <Ak>āk</Ak>-
                <Masc>i</Masc>
              </td>
              <td className="tt-plural tt-superlative">
                <Vis>vis</Vis>-dārg-
                <Ak>āk</Ak>-
                <Masc>ie</Masc>
              </td>
            </tr>
            <tr className="tt-feminine tt-word-lab">
              <td className="case case-fem tt-gender-cell" rowSpan={2}>
                S
              </td>
              <td className="tt-singular tt-positive">
                lab
                <Fem>a</Fem>
              </td>
              <td className="tt-singular tt-comparative">
                lab-
                <Ak>āk</Ak>-
                <Fem>a</Fem>
              </td>
              <td className="tt-singular tt-superlative">
                <Vis>vis</Vis>-lab-
                <Ak>āk</Ak>-
                <Fem>ā</Fem>
              </td>
              <td className="tt-plural tt-positive">
                lab
                <Fem>as</Fem>
              </td>
              <td className="tt-plural tt-comparative">
                lab-
                <Ak>āk</Ak>-
                <Fem>as</Fem>
              </td>
              <td className="tt-plural tt-superlative">
                <Vis>vis</Vis>-lab-
                <Ak>āk</Ak>-
                <Fem>ās</Fem>
              </td>
            </tr>
            <tr className="tt-feminine tt-word-darg">
              <td className="tt-singular tt-positive">
                dārg
                <Fem>a</Fem>
              </td>
              <td className="tt-singular tt-comparative">
                dārg-
                <Ak>āk</Ak>-
                <Fem>a</Fem>
              </td>
              <td className="tt-singular tt-superlative">
                <Vis>vis</Vis>-dārg-
                <Ak>āk</Ak>-
                <Fem>ā</Fem>
              </td>
              <td className="tt-plural tt-positive">
                dārg
                <Fem>as</Fem>
              </td>
              <td className="tt-plural tt-comparative">
                dārg-
                <Ak>āk</Ak>-
                <Fem>as</Fem>
              </td>
              <td className="tt-plural tt-superlative">
                <Vis>vis</Vis>-dārg-
                <Ak>āk</Ak>-
                <Fem>ās</Fem>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}