import TableCard from '../../TableCard.jsx';
import './TableNum9.css';
export default function TableNum9() {
  return (
    <TableCard>
      <div className="card table-num9" id="num9-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="num9-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>NUM9</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}></h2>
    </div>
    <div className="num9-flex-table" id="num9-table">
      <div className="num9-header">
        <div>Laiks</div>
        <div>Pulkstenis ir ... (cik?)</div>
        <div>Pulksten ... (cikos?)</div>
      </div>
      <div id="num9-table-body">
        {/* Заполняется через JavaScript */}
      <div className="num9-row"><div className="num9-cell">1.30 / 13.30</div><div className="num9-cell" style={{flex: '1 1 0%'}}>pusdiv-<span className="num9-ending-masc">i</span><br />vien-<span className="num9-ending-masc">s</span> un trīsdesmit minūt-<span className="num9-ending-fem">es</span><br />trīspadsmit trīsdesmit</div><div className="num9-cell" style={{flex: '1 1 0%'}}>pusdiv-<span className="num9-ending-masc">os</span><br />vien-<span className="num9-ending-masc">os</span> un trīsdesmit minūt-<span className="num9-ending-fem">ēs</span><br />trīspadsmit-<span className="num9-ending-masc">os</span> trīsdesmit</div></div><div className="num9-row"><div className="num9-cell">2.30 / 14.30</div><div className="num9-cell" style={{flex: '1 1 0%'}}>pustrīs<br />div-<span className="num9-ending-masc">i</span> un trīsdesmit minūt-<span className="num9-ending-fem">es</span><br />četrpadsmit trīsdesmit</div><div className="num9-cell" style={{flex: '1 1 0%'}}>pustrij-<span className="num9-ending-masc">os</span><br />div-<span className="num9-ending-masc">os</span> un trīsdesmit minūt-<span className="num9-ending-fem">ēs</span><br />četrpadsmit-<span className="num9-ending-masc">os</span> trīsdesmit</div></div><div className="num9-row"><div className="num9-cell">5.30 / 17.30</div><div className="num9-cell" style={{flex: '1 1 0%'}}>pusseš-<span className="num9-ending-masc">i</span><br />piec-<span className="num9-ending-masc">i</span> un trīsdesmit minūt-<span className="num9-ending-fem">es</span><br />septiņpadsmit trīsdesmit</div><div className="num9-cell" style={{flex: '1 1 0%'}}>pusseš-<span className="num9-ending-masc">os</span><br />piec-<span className="num9-ending-masc">os</span> un trīsdesmit minūt-<span className="num9-ending-fem">ēs</span><br />septiņpadsmit-<span className="num9-ending-masc">os</span> trīsdesmit</div></div><div className="num9-row"><div className="num9-cell">10.30 / 22.30</div><div className="num9-cell" style={{flex: '1 1 0%'}}>pusvienpadsmit<br />desmit un trīsdesmit minūt-<span className="num9-ending-fem">es</span><br />divdesmit div-<span className="num9-ending-masc">i</span> trīsdesmit</div><div className="num9-cell" style={{flex: '1 1 0%'}}>pusvienpadsmit-<span className="num9-ending-masc">os</span><br />desmit-<span className="num9-ending-masc">os</span> un trīsdesmit minūt-<span className="num9-ending-fem">ēs</span><br />divdesmit div-<span className="num9-ending-masc">os</span> trīsdesmit</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="num9-table-image-container" style={{marginTop: '8px'}}>
        <div className="num9-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="num9-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn num9-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



