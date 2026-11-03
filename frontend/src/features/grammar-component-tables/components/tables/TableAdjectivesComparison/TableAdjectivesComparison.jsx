import TableCard from '../../TableCard.jsx';
import './TableAdjectivesComparison.css';
export default function TableAdjectivesComparison() {
  return (
    <TableCard>
      <div className="card table-adjectives-comparison" id="adjectives-comparison-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left'}}>
        SALĪDZINĀMĀS PAKĀPES
        <span className="comparison-title-banner">ADJ3</span>
        <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Degrees of Comparison)</span>
      </h2>
    </div>
    <table className="comparison">
      <thead>
        <tr>
          <th rowSpan="2" style={{width: '150px'}}></th>
          <th colSpan="3">Vienskaitlis</th>
          <th colSpan="3">Daudzskaitlis</th>
        </tr>
        <tr>
          <th>Pamata pakāpe</th>
          <th>Pārākā pakāpe</th>
          <th>Vispārākā pakāpe</th>
          <th>Pamata pakāpe</th>
          <th>Pārākā pakāpe</th>
          <th>Vispārākā pakāpe</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="gender-header masc">Vīriešu dzimte</td>
          <td>lab<span className="comparison-ending-masc">s</span></td>
          <td>lab<span className="comparison-ending-masc">āks</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-lab<span className="comparison-ending-masc">ākais</span></td>
          <td>lab<span className="comparison-ending-masc">i</span></td>
          <td>lab<span className="comparison-ending-masc">āki</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-lab<span className="comparison-ending-masc">ākie</span></td>
        </tr>
        <tr>
          <td className="gender-header masc"></td>
          <td>aukst<span className="comparison-ending-masc">s</span></td>
          <td>aukst<span className="comparison-ending-masc">āks</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-aukst<span className="comparison-ending-masc">ākais</span></td>
          <td>aukst<span className="comparison-ending-masc">i</span></td>
          <td>aukst<span className="comparison-ending-masc">āki</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-aukst<span className="comparison-ending-masc">ākie</span></td>
        </tr>
        <tr>
          <td className="gender-header masc"></td>
          <td>dārg<span className="comparison-ending-masc">s</span></td>
          <td>dārg<span className="comparison-ending-masc">āks</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-dārg<span className="comparison-ending-masc">ākais</span></td>
          <td>dārg<span className="comparison-ending-masc">i</span></td>
          <td>dārg<span className="comparison-ending-masc">āki</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-dārg<span className="comparison-ending-masc">ākie</span></td>
        </tr>
        <tr>
          <td className="gender-header fem">Sieviešu dzimte</td>
          <td>lab<span className="comparison-ending-fem">a</span></td>
          <td>lab<span className="comparison-ending-fem">āka</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-lab<span className="comparison-ending-fem">ākā</span></td>
          <td>lab<span className="comparison-ending-fem">as</span></td>
          <td>lab<span className="comparison-ending-fem">ākas</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-lab<span className="comparison-ending-fem">ākās</span></td>
        </tr>
        <tr>
          <td className="gender-header fem"></td>
          <td>aukst<span className="comparison-ending-fem">a</span></td>
          <td>aukst<span className="comparison-ending-fem">āka</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-aukst<span className="comparison-ending-fem">ākā</span></td>
          <td>aukst<span className="comparison-ending-fem">as</span></td>
          <td>aukst<span className="comparison-ending-fem">ākas</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-aukst<span className="comparison-ending-fem">ākās</span></td>
        </tr>
        <tr>
          <td className="gender-header fem"></td>
          <td>dārg<span className="comparison-ending-fem">a</span></td>
          <td>dārg<span className="comparison-ending-fem">āka</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-dārg<span className="comparison-ending-fem">ākā</span></td>
          <td>dārg<span className="comparison-ending-fem">as</span></td>
          <td>dārg<span className="comparison-ending-fem">ākas</span></td>
          <td><span className="comparison-prefix-vis">vis</span>-dārg<span className="comparison-ending-fem">ākās</span></td>
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



