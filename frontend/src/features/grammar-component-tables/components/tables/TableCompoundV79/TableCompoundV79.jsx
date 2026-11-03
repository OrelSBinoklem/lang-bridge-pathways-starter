import TableCard from '../../TableCard.jsx';
import './TableCompoundV79.css';
export default function TableCompoundV79() {
  return (
    <TableCard>
      <div className="card table-compound-v79" id="compound-v79-table-container">
    <div className="compound-section-title">Atstāstījuma izteiksme saliktie laiki (Сложные времена пересказного наклонения)</div>
    <table>
      <thead>
        <tr>
          <th className="tt-col-person">Kas?</th>
          <th className="tt-col-present">Tagadne<br /><span className="tt-auxiliary" style={{color: '#ff9800'}}>esot</span> + divdabis ar<br />-<span className="compound-ending-masc">is</span>, -<span className="compound-ending-fem">usi</span>, -<span className="compound-ending-masc">ies</span>, -<span className="compound-ending-fem">usies</span></th>
          <th className="tt-col-future">Nākotne<br /><span className="tt-auxiliary" style={{color: '#ff9800'}}>būšot</span> +divdabis ar<br />-<span className="compound-ending-masc">is</span>, -<span className="compound-ending-fem">usi</span>, -<span className="compound-ending-masc">ies</span>, -<span className="compound-ending-fem">usies</span></th>
        </tr>
      </thead>
      <tbody>
        <tr className="tt-persons-sg tt-row-plain">
          <td rowSpan="2" className="tt-col-person">es<br />tu<br />viņš, viņa</td>
          <td className="tt-col-present"><span className="tt-auxiliary" style={{color: '#ff9800'}}>esot</span> zināj-<span className="compound-ending-masc">is</span>, zināj-<span className="compound-ending-fem">usi</span></td>
          <td className="tt-col-future"><span className="tt-auxiliary" style={{color: '#ff9800'}}>būšot</span> zināj-<span className="compound-ending-masc">is</span>, zināj-<span className="compound-ending-fem">usi</span></td>
        </tr>
        <tr className="tt-persons-sg tt-row-reflexive">
          <td className="tt-col-present"><span className="tt-auxiliary" style={{color: '#ff9800'}}>esot</span> skatīj-<span className="compound-ending-masc">ies</span>, skatīj-<span className="compound-ending-fem">usies</span></td>
          <td className="tt-col-future"><span className="tt-auxiliary" style={{color: '#ff9800'}}>būšot</span> skatīj-<span className="compound-ending-masc">ies</span>, skatīj-<span className="compound-ending-fem">usies</span></td>
        </tr>
        <tr className="tt-persons-pl tt-row-plain">
          <td rowSpan="2" className="tt-col-person">mēs<br />jūs<br />viņi, viņas</td>
          <td className="tt-col-present"><span className="tt-auxiliary" style={{color: '#ff9800'}}>esot</span> zināj-<span className="compound-ending-masc">uši</span>, zināj-<span className="compound-ending-fem">ušas</span></td>
          <td className="tt-col-future"><span className="tt-auxiliary" style={{color: '#ff9800'}}>būšot</span> zināj-<span className="compound-ending-masc">uši</span>, zināj-<span className="compound-ending-fem">ušas</span></td>
        </tr>
        <tr className="tt-persons-pl tt-row-reflexive">
          <td className="tt-col-present"><span className="tt-auxiliary" style={{color: '#ff9800'}}>esot</span> skatīj-<span className="compound-ending-masc">ušies</span>, skatīj-<span className="compound-ending-fem">ušās</span></td>
          <td className="tt-col-future"><span className="tt-auxiliary" style={{color: '#ff9800'}}>būšot</span> skatīj-<span className="compound-ending-masc">ušies</span>, skatīj-<span className="compound-ending-fem">ušās</span></td>
        </tr>
      </tbody>
    </table>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="compound-v79-table-image-container" style={{marginTop: '8px'}}>
        <div className="compound-v79-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="compound-v79-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn compound-v79-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



