import TableCard from '../../TableCard.jsx';
import './TableV77.css';
export default function TableV77() {
  return (
    <TableCard>
      <div className="card table-v77" id="v77-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v77-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V77</div>
      <div style={{flex: 1, marginLeft: '12px', textAlign: 'right'}}>
        <h2 style={{margin: 0, color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>VĒLĒJUMA IZTEIKSME</h2>
        <p style={{margin: '4px 0 0 0', fontStyle: 'italic', color: '#333'}}>Vienkāršā tagadne</p>
      </div>
    </div>
    <div className="v77-flex-table" id="v77-table">
      <div className="v77-header">
        <div>Nenoteiksme<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Инфинитив)</small></div>
        <div>Kas?<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Кто?)</small></div>
        <div>Vēlējuma izteiksme<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Желательное наклонение)</small><br /><small style={{fontWeight: 'normal', color: 'var(--muted)', fontSize: '0.85rem'}}>Nenoteiksme + -tu, -tos</small></div>
      </div>
      <div id="v77-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v77-row"><div className="v77-cell">ie-t</div><div className="v77-cell">es</div><div className="v77-cell">ie+<span className="v77-suffix-tu">tu</span></div></div><div className="v77-row"><div className="v77-cell">gribē-t</div><div className="v77-cell">tu</div><div className="v77-cell">gribē+<span className="v77-suffix-tu">tu</span></div></div><div className="v77-row"><div className="v77-cell">lasī-t</div><div className="v77-cell">viņš, viņa,</div><div className="v77-cell">lasī+<span className="v77-suffix-tu">tu</span></div></div><div className="v77-row"><div className="v77-cell">apmeklē-t</div><div className="v77-cell">viņi, viņas</div><div className="v77-cell">apmeklē+<span className="v77-suffix-tu">tu</span></div></div><div className="v77-row"><div className="v77-cell">interesē-ties</div><div className="v77-cell">mēs</div><div className="v77-cell">interesē+<span className="v77-suffix-tos">tos</span></div></div><div className="v77-row"><div className="v77-cell">vēlē-ties</div><div className="v77-cell">jūs</div><div className="v77-cell">vēlē+<span className="v77-suffix-tos">tos</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v77-table-image-container" style={{marginTop: '8px'}}>
        <div className="v77-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v77-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v77-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



