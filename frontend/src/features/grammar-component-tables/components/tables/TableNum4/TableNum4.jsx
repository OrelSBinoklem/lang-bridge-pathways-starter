import TableCard from '../../TableCard.jsx';
import './TableNum4.css';
export default function TableNum4() {
  return (
    <TableCard>
      <div className="card table-num4" id="num4-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="num4-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>NUM4</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>SIMTI UN TŪKSTOŠI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Сотни и тысячи)</span></h2>
    </div>
    <div className="num4-flex-table" id="num4-table">
      <div className="num4-header">
        <div>SIMTI</div>
        <div>TŪKSTOŠI</div>
      </div>
      <div id="num4-table-body">
        {/* Заполняется через JavaScript */}
      <div className="num4-row"><div className="num4-cell"><span className="num4-number">100:</span>simts/simt</div><div className="num4-cell"><span className="num4-number">1000:</span>tūkstotis/tūkstoš</div></div><div className="num4-row"><div className="num4-cell"><span className="num4-number">200:</span>divi simti/divsimt</div><div className="num4-cell"><span className="num4-number">2000:</span>divi tūkstoši/divtūkstoš</div></div><div className="num4-row"><div className="num4-cell"><span className="num4-number">300:</span>trīs simti/trīssimt</div><div className="num4-cell"><span className="num4-number">3000:</span>trīs tūkstoši/trīstūkstoš</div></div><div className="num4-row"><div className="num4-cell"><span className="num4-number">400:</span>četri simti/četrsimt</div><div className="num4-cell"><span className="num4-number">4000:</span>četri tūkstoši/četrtūkstoš</div></div><div className="num4-row"><div className="num4-cell"><span className="num4-number">500:</span>pieci simti/piecsimt</div><div className="num4-cell"><span className="num4-number">5000:</span>pieci tūkstoši/piectūkstoš</div></div><div className="num4-row"><div className="num4-cell"><span className="num4-number">600:</span>seši simti/sešsimt</div><div className="num4-cell"><span className="num4-number">6000:</span>seši tūkstoši/seštūkstoš</div></div><div className="num4-row"><div className="num4-cell"><span className="num4-number">700:</span>septiņi simti/septiņsimt</div><div className="num4-cell"><span className="num4-number">7000:</span>septiņi tūkstoši/septiņtūkstoš</div></div><div className="num4-row"><div className="num4-cell"><span className="num4-number">800:</span>astoņi simti/astoņsimt</div><div className="num4-cell"><span className="num4-number">8000:</span>astoņi tūkstoši/astoņtūkstoš</div></div><div className="num4-row"><div className="num4-cell"><span className="num4-number">900:</span>deviņi simti/deviņsimt</div><div className="num4-cell"><span className="num4-number">9000:</span>deviņi tūkstoši/deviņtūkstoš</div></div></div>
    </div>
    <p style={{marginTop: '16px', fontSize: '14px', lineHeight: '1.6', color: 'var(--text)', padding: '0 12px'}}>
      Skaitļa vārdus <strong>desmits, simts, miljons, miljards</strong> loka kā 1. deklinācijas vīriešu dzimtes lietvārdus.
    </p>
    <p style={{marginTop: '8px', fontSize: '14px', lineHeight: '1.6', color: 'var(--text)', padding: '0 12px'}}>
      Skaitļa vārdu <strong>tūkstotis</strong> loka kā 2. deklinācijas vīriešu dzimtes lietvārdu, savukārt <strong>tūkstoš</strong> ir nelokāms skaitļa vārds.
    </p>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="num4-table-image-container" style={{marginTop: '8px'}}>
        <div className="num4-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="num4-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn num4-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



