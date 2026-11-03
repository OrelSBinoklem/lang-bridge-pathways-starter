import TableCard from '../../TableCard.jsx';
import './TableVocative2.css';
export default function TableVocative2() {
  return (
    <TableCard>
      <div className="card table-vocative2" id="vocative2-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="vocative2-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px 0 0 4px', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'}}>S2</div>
      <h2 style={{margin: 0, color: '#1a3a52', fontWeight: 600, fontFamily: 'sans-serif'}}>VOKATĪVS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Звательный падеж)</span></h2>
    </div>
    <div className="vocative2-flex-table" id="vocative2-table">
      <div className="vocative2-header">
        <div style={{flex: 1}}>1.</div>
        <div style={{flex: 1}}>2.</div>
        <div style={{flex: 1}}>3.</div>
        <div style={{flex: 1}}>4.</div>
        <div style={{flex: 1}}>5.</div>
        <div style={{flex: 1}}>6.</div>
      </div>
      <div className="vocative2-body-wrapper">
        <div className="vocative2-sidebar">
          <div className="vocative2-sidebar-label">Jautājums</div>
          <div className="vocative2-sidebar-section">
            <div className="vocative2-sidebar-item">Vokatīvs. Uzrunas forma.</div>
          </div>
          <div className="vocative2-sidebar-section">
            <div className="vocative2-sidebar-item">Bez jautājuma</div>
          </div>
        </div>
        <div id="vocative2-table-body"><div className="vocative2-section-header"><div className="section-title" style={{width: '100%'}}>Vienskaitlis</div></div><div className="vocative2-row"><div className="vocative2-cell">tēv!</div><div className="vocative2-cell">brāl!,</div><div className="vocative2-cell">liet<span className="vocative2-ending-masc">u!</span></div><div className="vocative2-cell">mās!</div><div className="vocative2-cell">māt!</div><div className="vocative2-cell">gov<span className="vocative2-ending-fem">s!</span></div></div><div className="vocative2-row"><div className="vocative2-cell" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}><div>tēv<span className="vocative2-ending-masc">s!</span></div><div className="vocative2-example">Kaspar!</div></div><div className="vocative2-cell" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}><div>brāl<span className="vocative2-ending-masc">i!</span></div><div className="vocative2-example">Jān<span className="vocative2-ending-masc">i!</span></div></div><div className="vocative2-cell" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}><div>Mik<span className="vocative2-ending-masc">u!</span></div></div><div className="vocative2-cell" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}><div>mās<span className="vocative2-ending-fem">a!</span></div><div className="vocative2-example">Ann<span className="vocative2-ending-fem">a!</span></div></div><div className="vocative2-cell" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}><div>māt<span className="vocative2-ending-fem">e!</span></div><div className="vocative2-example">Ilz<span className="vocative2-ending-fem">e!</span></div></div><div className="vocative2-cell" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}></div></div><div className="vocative2-section-header"><div className="section-title" style={{width: '100%'}}>Daudzskaitlis</div></div><div className="vocative2-row"><div className="vocative2-cell">tēv<span className="vocative2-ending-masc">i!</span></div><div className="vocative2-cell">brāļ<span className="vocative2-ending-masc">i!</span></div><div className="vocative2-cell">liet<span className="vocative2-ending-masc">i!-</span></div><div className="vocative2-cell">mās<span className="vocative2-ending-fem">as!</span></div><div className="vocative2-cell">māt<span className="vocative2-ending-fem">es!</span></div><div className="vocative2-cell">gov<span className="vocative2-ending-fem">is!</span></div></div><div className="vocative2-row"><div className="vocative2-cell">Kaspar<span className="vocative2-ending-masc">i!</span></div><div className="vocative2-cell">Jāņ<span className="vocative2-ending-masc">i!</span></div><div className="vocative2-cell">Mik<span className="vocative2-ending-masc">i!</span></div><div className="vocative2-cell">Ann<span className="vocative2-ending-fem">as!</span></div><div className="vocative2-cell">Ilz<span className="vocative2-ending-fem">es!</span></div><div className="vocative2-cell"></div></div></div>
      </div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="vocative2-table-image-container" style={{marginTop: '8px'}}>
        <div className="vocative2-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="vocative2-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn vocative2-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



