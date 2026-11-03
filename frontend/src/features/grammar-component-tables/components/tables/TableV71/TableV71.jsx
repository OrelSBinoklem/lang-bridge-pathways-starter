import TableCard from '../../TableCard.jsx';
import './TableV71.css';
export default function TableV71() {
  return (
    <TableCard>
      <div className="card table-v71" id="v71-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v71-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V71</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Nelokāmais divdabis (-ot, -oties)</h2>
    </div>
    <div className="v71-flex-table" id="v71-table">
      <div className="v71-header">
        <div>Īstenības izteiksmes tagadnes 1. persona<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Изъявительное наклонение, настоящее время, 1-е лицо)</small></div>
        <div>Divdabis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Деепричастие)</small></div>
      </div>
      <div id="v71-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v71-row"><div className="v71-cell">dibin-u</div><div className="v71-cell">dibin+ot</div></div><div className="v71-row"><div className="v71-cell">domāj-u</div><div className="v71-cell">domāj+ot</div></div><div className="v71-row"><div className="v71-cell">gatavoj-os</div><div className="v71-cell">gatavoj+oties</div></div><div className="v71-row"><div className="v71-cell">klaus-os</div><div className="v71-cell">klaus+oties</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v71-table-image-container" style={{marginTop: '8px'}}>
        <div className="v71-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v71-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v71-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



