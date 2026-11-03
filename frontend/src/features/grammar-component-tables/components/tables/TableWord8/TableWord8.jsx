import TableCard from '../../TableCard.jsx';
import './TableWord8.css';
export default function TableWord8() {
  return (
    <TableCard>
      <div className="card table-word8" id="word8-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word8-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD8</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'center', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>LIETVĀRDU SKAITĻU <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Числа существительных)</span></h2>
    </div>
    <div className="word8-flex-table" id="word8-table">
      <div className="word8-header">
        <div className="word8-header-corner">
          <div style={{marginBottom: '4px'}}>Skaitlis</div>
          <div>Jautājums</div>
        </div>
        <div className="word8-header-group">
          <div className="word8-header-main">
            <div style={{flex: 1, padding: '8px', borderRight: '1px solid var(--border-strong)'}}>Vienskaitlis</div>
            <div style={{flex: 1, padding: '8px'}}>Vienskaitlis</div>
          </div>
          <div className="word8-header-main">
            <div style={{flex: 1, padding: '8px', borderRight: '1px solid var(--border-strong)'}}>Daudzskaitlis</div>
            <div style={{flex: 1, padding: '8px'}}>Daudzskaitlis</div>
          </div>
        </div>
      </div>
      <div style={{display: 'flex', width: '100%', borderBottom: '1px solid var(--border-strong)', background: 'var(--table-head)'}}>
        <div style={{width: '120px', flex: '0 0 120px', padding: '4px 8px', borderRight: '1px solid var(--border-strong)'}}></div>
        <div style={{display: 'flex', flex: 1}}>
          <div style={{flex: 1, padding: '4px 8px', textAlign: 'center', borderRight: '1px solid var(--border-strong)', fontWeight: 600, fontSize: '0.9em'}}>simt</div>
          <div style={{flex: 1, padding: '4px 8px', textAlign: 'center', borderRight: '1px solid var(--border-strong)', fontWeight: 600, fontSize: '0.9em'}}>tūkstot</div>
          <div style={{flex: 1, padding: '4px 8px', textAlign: 'center', borderRight: '1px solid var(--border-strong)', fontWeight: 600, fontSize: '0.9em'}}>simt</div>
          <div style={{flex: 1, padding: '4px 8px', textAlign: 'center', fontWeight: 600, fontSize: '0.9em'}}>tūkstot</div>
        </div>
      </div>
      <div id="word8-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word8-row"><div className="word8-cell">Kas?</div><div className="word8-cell">simt-<span className="word8-ending">s</span></div><div className="word8-cell">tūkstot-<span className="word8-ending">is</span></div><div className="word8-cell">simt-<span className="word8-ending">i</span></div><div className="word8-cell">tūkstoš-<span className="word8-ending">i</span></div></div><div className="word8-row"><div className="word8-cell">Kā?</div><div className="word8-cell">simt-<span className="word8-ending">a</span></div><div className="word8-cell">tūkstoš-<span className="word8-ending">a</span></div><div className="word8-cell">simt-<span className="word8-ending">u</span></div><div className="word8-cell">tūkstoš-<span className="word8-ending">u</span></div></div><div className="word8-row"><div className="word8-cell">Kam?</div><div className="word8-cell">simt-<span className="word8-ending">am</span></div><div className="word8-cell">tūkstot-<span className="word8-ending">im</span></div><div className="word8-cell">simt-<span className="word8-ending">iem</span></div><div className="word8-cell">tūkstoš-<span className="word8-ending">iem</span></div></div><div className="word8-row"><div className="word8-cell">Ko?</div><div className="word8-cell">simt-<span className="word8-ending">u</span></div><div className="word8-cell">tūkstot-<span className="word8-ending">i</span></div><div className="word8-cell">simt-<span className="word8-ending">us</span></div><div className="word8-cell">tūkstoš-<span className="word8-ending">us</span></div></div><div className="word8-row"><div className="word8-cell">Kur?</div><div className="word8-cell">simt-<span className="word8-ending">ā</span></div><div className="word8-cell">tūkstot-<span className="word8-ending">ī</span></div><div className="word8-cell">simt-<span className="word8-ending">os</span></div><div className="word8-cell">tūkstoš-<span className="word8-ending">os</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word8-table-image-container" style={{marginTop: '8px'}}>
        <div className="word8-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word8-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word8-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



