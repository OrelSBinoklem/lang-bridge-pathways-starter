import TableCard from '../../TableCard.jsx';
import './TableNum8.css';
export default function TableNum8() {
  return (
    <TableCard>
      <div className="card table-num8" id="num8-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="num8-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>NUM8</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}></h2>
    </div>
    <div className="num8-flex-table" id="num8-table">
      <div className="num8-header">
        <div>Laiks</div>
        <div>Pulkstenis ir ... (cik?)</div>
        <div>Pulksten ... (cikos?)</div>
      </div>
      <div id="num8-table-body">
        {/* Заполняется через JavaScript */}
      <div className="num8-row"><div className="num8-cell">1.00</div><div className="num8-cell" style={{flex: '1 1 0%'}}>vien-<span className="num8-ending">s</span></div><div className="num8-cell" style={{flex: '1 1 0%'}}>vien-<span className="num8-ending">os</span></div></div><div className="num8-row"><div className="num8-cell">2.00</div><div className="num8-cell" style={{flex: '1 1 0%'}}>div-<span className="num8-ending">i</span></div><div className="num8-cell" style={{flex: '1 1 0%'}}>div-<span className="num8-ending">os</span></div></div><div className="num8-row"><div className="num8-cell">5.00</div><div className="num8-cell" style={{flex: '1 1 0%'}}>piec-<span className="num8-ending">i</span></div><div className="num8-cell" style={{flex: '1 1 0%'}}>piec-<span className="num8-ending">os</span></div></div><div className="num8-row"><div className="num8-cell">10.00</div><div className="num8-cell" style={{flex: '1 1 0%'}}>desmit</div><div className="num8-cell" style={{flex: '1 1 0%'}}>desmit-<span className="num8-ending">os</span></div></div><div className="num8-row"><div className="num8-cell">17.00</div><div className="num8-cell" style={{flex: '1 1 0%'}}>septiņpadsmit</div><div className="num8-cell" style={{flex: '1 1 0%'}}>septiņpadsmit-<span className="num8-ending">os</span></div></div><div className="num8-row"><div className="num8-cell">20.00</div><div className="num8-cell" style={{flex: '1 1 0%'}}>divdesmit</div><div className="num8-cell" style={{flex: '1 1 0%'}}>divdesmit-<span className="num8-ending">os</span></div></div><div className="num8-row"><div className="num8-cell">23.00</div><div className="num8-cell" style={{flex: '1 1 0%'}}>divdesmit trīs</div><div className="num8-cell" style={{flex: '1 1 0%'}}>divdesmit trij-<span className="num8-ending">os</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="num8-table-image-container" style={{marginTop: '8px'}}>
        <div className="num8-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="num8-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn num8-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



