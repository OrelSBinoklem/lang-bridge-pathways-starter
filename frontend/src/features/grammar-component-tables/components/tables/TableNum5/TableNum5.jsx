import TableCard from '../../TableCard.jsx';
import './TableNum5.css';
export default function TableNum5() {
  return (
    <TableCard>
      <div className="card table-num5" id="num5-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="num5-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>NUM5</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Vienkāršās skaitļa vārdi <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Простые числительные)</span></h2>
    </div>
    <div className="num5-flex-table" id="num5-table">
      <div className="num5-header">
        <div className="masc">Vīriešu dzimte</div>
        <div className="fem">Sieviešu dzimte</div>
      </div>
      <div className="num5-subheader">Vienskaitlis</div>
      <div id="num5-table-body">
        {/* Заполняется через JavaScript */}
      <div className="num5-row"><div className="num5-cell"><span className="num5-number">1.</span>pirm<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">1.</span>pirm<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">2.</span>otr<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">2.</span>otr<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">3.</span>treš<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">3.</span>treš<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">4.</span>ceturt<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">4.</span>ceturt<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">5.</span>piekt<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">5.</span>piekt<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">6.</span>sest<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">6.</span>sest<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">7.</span>septīt<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">7.</span>septīt<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">8.</span>astot<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">8.</span>astot<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">9.</span>devīt<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">9.</span>devīt<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">10.</span>desmit<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">10.</span>desmit<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">11.</span>vienpadsmit<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">11.</span>vienpadsmit<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">12.</span>divpadsmit<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">12.</span>divpadsmit<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">19.</span>deviņpadsmit<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">19.</span>deviņpadsmit<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">20.</span>divdesmit<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">20.</span>divdesmit<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">21.</span>divdesmit pirm<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">21.</span>divdesmit pirm<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">30.</span>trīsdesmit<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">30.</span>trīsdesmit<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">100.</span>simt<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">100.</span>simt<span className="num5-ending-fem">ā</span></div></div><div className="num5-row"><div className="num5-cell"><span className="num5-number">200.</span>divsimt<span className="num5-ending-masc">ais</span></div><div className="num5-cell"><span className="num5-number">200.</span>divsimt<span className="num5-ending-fem">ā</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="num5-table-image-container" style={{marginTop: '8px'}}>
        <div className="num5-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="num5-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn num5-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



