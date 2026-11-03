import TableCard from '../../TableCard.jsx';
import './TableNum3.css';
export default function TableNum3() {
  return (
    <TableCard>
      <div className="card table-num3" id="num3-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="num3-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>NUM3</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>PAMATA SKAITĻA VĀRDI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Основные числительные)</span></h2>
    </div>
    <p className="muted" style={{margin: '0 0 12px 0', paddingLeft: '12px'}}>11-19 UN 10, 20, 30 utt.</p>
    <div className="num3-flex-table" id="num3-table">
      <div className="num3-header">
        <div>11-19</div>
        <div>10, 20, 30, 40, 50, ...</div>
      </div>
      <div id="num3-table-body">
        {/* Заполняется через JavaScript */}
      <div className="num3-row"><div className="num3-cell"><span className="num3-number">11:</span>vienpadsmit</div><div className="num3-cell"><span className="num3-number">10:</span>desmit</div></div><div className="num3-row"><div className="num3-cell"><span className="num3-number">12:</span>divpadsmit</div><div className="num3-cell"><span className="num3-number">20:</span>divdesmit</div></div><div className="num3-row"><div className="num3-cell"><span className="num3-number">13:</span>trīspadsmit</div><div className="num3-cell"><span className="num3-number">30:</span>trīsdesmit</div></div><div className="num3-row"><div className="num3-cell"><span className="num3-number">14:</span>četrpadsmit</div><div className="num3-cell"><span className="num3-number">40:</span>četrdesmit</div></div><div className="num3-row"><div className="num3-cell"><span className="num3-number">15:</span>piecpadsmit</div><div className="num3-cell"><span className="num3-number">50:</span>piecdesmit</div></div><div className="num3-row"><div className="num3-cell"><span className="num3-number">16:</span>sešpadsmit</div><div className="num3-cell"><span className="num3-number">60:</span>sešdesmit</div></div><div className="num3-row"><div className="num3-cell"><span className="num3-number">17:</span>septiņpadsmit</div><div className="num3-cell"><span className="num3-number">70:</span>septiņdesmit</div></div><div className="num3-row"><div className="num3-cell"><span className="num3-number">18:</span>astoņpadsmit</div><div className="num3-cell"><span className="num3-number">80:</span>astoņdesmit</div></div><div className="num3-row"><div className="num3-cell"><span className="num3-number">19:</span>deviņpadsmit</div><div className="num3-cell"><span className="num3-number">90:</span>deviņdesmit</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="num3-table-image-container" style={{marginTop: '8px'}}>
        <div className="num3-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="num3-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn num3-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



