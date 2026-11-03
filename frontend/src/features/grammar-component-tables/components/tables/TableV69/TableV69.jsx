import TableCard from '../../TableCard.jsx';
import './TableV69.css';
export default function TableV69() {
  return (
    <TableCard>
      <div className="card table-v69" id="v69-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v69-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V69</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Lokāmais ciešamās kārtas pagātnes divdabis (-ts, -ta) <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Склоняемое причастие страдательного залога прошедшего времени)</span></h2>
    </div>
    <div className="v69-flex-table" id="v69-table">
      <div className="v69-header">
        <div>Nenoteiksme<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Инфинитив)</small></div>
        <div style={{flex: 2}}>Divdabis (tiek lietota nenoteiktā un noteiktā galotne)<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Причастие (используются неопределенные и определенные окончания))</small></div>
      </div>
      <div className="v69-subheader">
        <div></div>
        <div style={{flex: 1}}>Vienskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Единственное число)</small></div>
        <div style={{flex: 1}}>Daudzskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Множественное число)</small></div>
      </div>
      <div id="v69-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v69-row"><div className="v69-cell">lasi-t</div><div className="v69-cell">lasī+<span className="v69-ending-masc">ts</span>, lasī+<span className="v69-ending-fem">ta</span></div><div className="v69-cell">lasī+<span className="v69-ending-masc">ti</span>, lasī+<span className="v69-ending-fem">tas</span></div></div><div className="v69-row"><div className="v69-cell"></div><div className="v69-cell">lasī+<span className="v69-ending-masc">tais</span>, lasī+<span className="v69-ending-fem">tā</span></div><div className="v69-cell">lasī+<span className="v69-ending-masc">tie</span>, lasī+<span className="v69-ending-fem">tās</span></div></div><div className="v69-row"><div className="v69-cell">būvē-t</div><div className="v69-cell">būvē+<span className="v69-ending-masc">ts</span>, būvē+<span className="v69-ending-fem">ta</span></div><div className="v69-cell">būvē+<span className="v69-ending-masc">ti</span>, būvē+<span className="v69-ending-fem">tas</span></div></div><div className="v69-row"><div className="v69-cell"></div><div className="v69-cell">būvē+<span className="v69-ending-masc">tais</span>, būvē+<span className="v69-ending-fem">tā</span></div><div className="v69-cell">būvē+<span className="v69-ending-masc">tie</span>, būvē+<span className="v69-ending-fem">tās</span></div></div><div className="v69-row"><div className="v69-cell">pārdo-t</div><div className="v69-cell">pārdo+<span className="v69-ending-masc">ts</span>, pārdo+<span className="v69-ending-fem">ta</span></div><div className="v69-cell">pārdo+<span className="v69-ending-masc">ti</span>, pārdo+<span className="v69-ending-fem">tas</span></div></div><div className="v69-row"><div className="v69-cell"></div><div className="v69-cell">pārdo+<span className="v69-ending-masc">tais</span>, pārdo+<span className="v69-ending-fem">tā</span></div><div className="v69-cell">pārdo+<span className="v69-ending-masc">tie</span>, pārdo+<span className="v69-ending-fem">tās</span></div></div><div className="v69-row"><div className="v69-cell">remontē-t</div><div className="v69-cell">remontē+<span className="v69-ending-masc">ts</span>, remontē+<span className="v69-ending-fem">ta</span></div><div className="v69-cell">remontē+<span className="v69-ending-masc">ti</span>, remontē+<span className="v69-ending-fem">tas</span></div></div><div className="v69-row"><div className="v69-cell"></div><div className="v69-cell">remontē+<span className="v69-ending-masc">tais</span>, remontē+<span className="v69-ending-fem">tā</span></div><div className="v69-cell">remontē+<span className="v69-ending-masc">tie</span>, remontē+<span className="v69-ending-fem">tās</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v69-table-image-container" style={{marginTop: '8px'}}>
        <div className="v69-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v69-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v69-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



