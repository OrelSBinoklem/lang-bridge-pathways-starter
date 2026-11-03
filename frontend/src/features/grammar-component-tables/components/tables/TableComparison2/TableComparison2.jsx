import TableCard from '../../TableCard.jsx';
export default function TableComparison2() {
  return (
    <TableCard>
      <div className="card table-comparison" id="comparison-table-container">
      <table className="comparison" id="comparison-table">
        <thead>
          <tr>
            <th colSpan="7" style={{textAlign: 'left', padding: '12px 16px', fontWeight: 700, fontSize: '0.95rem'}}>
              SALĪDZINĀMĀS PAKĀPES (Степени сравнения)
            </th>
          </tr>
          <tr>
            <th rowSpan="2" style={{width: '120px'}}></th>
            <th colSpan="3">Vienskaitlis</th>
            <th colSpan="3">Daudzskaitlis</th>
          </tr>
          <tr>
            <th>Pamata</th>
            <th>Pārākā</th>
            <th>Vispārākā</th>
            <th>Pamata</th>
            <th>Pārākā</th>
            <th>Vispārākā</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="case" rowSpan="2" style={{background: 'rgba(0, 102, 204, 0.1)'}}>Vīriešu dzimte</td>
            <td>lab<span className="comparison-ending-masc">s</span></td>
            <td>lab-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-masc">s</span></td>
            <td><span className="comparison-prefix-vis">vis</span>-lab-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-masc">ais</span></td>
            <td>lab<span className="comparison-ending-masc">i</span></td>
            <td>lab-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-masc">i</span></td>
            <td><span className="comparison-prefix-vis">vis</span>-lab-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-masc">ie</span></td>
          </tr>
          <tr>
            <td>dārg<span className="comparison-ending-masc">s</span></td>
            <td>dārg-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-masc">s</span></td>
            <td><span className="comparison-prefix-vis">vis</span>-dārg-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-masc">ais</span></td>
            <td>dārg<span className="comparison-ending-masc">i</span></td>
            <td>dārg-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-masc">i</span></td>
            <td><span className="comparison-prefix-vis">vis</span>-dārg-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-masc">ie</span></td>
          </tr>
          <tr>
            <td className="case" rowSpan="2" style={{background: 'rgba(204, 0, 102, 0.1)'}}>Sieviešu dzimte</td>
            <td>lab<span className="comparison-ending-fem">a</span></td>
            <td>lab-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-fem">a</span></td>
            <td><span className="comparison-prefix-vis">vis</span>-lab-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-fem">ā</span></td>
            <td>lab<span className="comparison-ending-fem">as</span></td>
            <td>lab-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-fem">as</span></td>
            <td><span className="comparison-prefix-vis">vis</span>-lab-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-fem">ās</span></td>
          </tr>
          <tr>
            <td>dārg<span className="comparison-ending-fem">a</span></td>
            <td>dārg-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-fem">a</span></td>
            <td><span className="comparison-prefix-vis">vis</span>-dārg-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-fem">ā</span></td>
            <td>dārg<span className="comparison-ending-fem">as</span></td>
            <td>dārg-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-fem">as</span></td>
            <td><span className="comparison-prefix-vis">vis</span>-dārg-<span className="comparison-suffix-ak">āk</span>-<span className="comparison-ending-fem">ās</span></td>
          </tr>
        </tbody>
      </table>
      <details style={{marginTop: '12px'}}>
        <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
        <div className="comparison-table-image-container" style={{marginTop: '8px'}}>
          <div className="comparison-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
          <img className="comparison-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
          <a className="btn comparison-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
        </div>
      </details>
    </div>
    </TableCard>
  );
}



