import TableCard from '../../TableCard.jsx';
import './TableWord19.css';
export default function TableWord19() {
  return (
    <TableCard>
      <div className="card table-word19" id="word19-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word19-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD19</div>
    </div>
    <h2 className="word19-title">NETIEŠĀ RUNA <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Косвенная речь)</span></h2>
    <p className="word19-intro">Netiešā runa ir teiktā atstāstījums. Netiešajai runai ir īstenības vai atstāstījuma izteiksmes forma atkarībā no atstāstītāja attieksmes pret teiktā patiesumu: ja runātājs par to ir pārliecināts, tad parasti lieto īstenības izteiksmi.</p>
    <div className="word19-grid-table" id="word19-table">
      <div id="word19-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word19-cell word19-cell-direct">Andris: „Vasarā es ceļošu pa Latviju."</div><div className="word19-cell word19-cell-reported">Andris teica, ka viņš vasarā ceļos pa Latviju.</div><div className="word19-cell word19-cell-type">ĪSTENĪBAS IZTEIKSME</div><div className="word19-cell word19-cell-reported">Andris teica, ka vasarā ceļošot pa Latviju.</div><div className="word19-cell word19-cell-type">ATSTĀSTĪJUMA IZTEIKSME</div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word19-table-image-container" style={{marginTop: '8px'}}>
        <div className="word19-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word19-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word19-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



