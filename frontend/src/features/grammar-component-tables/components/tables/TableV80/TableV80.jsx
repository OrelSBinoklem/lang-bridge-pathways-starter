import TableCard from '../../TableCard.jsx';
import './TableV80.css';
export default function TableV80() {
  return (
    <TableCard>
      <div className="card table-v80" id="v80-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v80-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V80</div>
      <div style={{flex: 1, marginLeft: '12px', textAlign: 'right'}}>
        <p style={{margin: 0, fontStyle: 'italic', color: '#333'}}>Saliktie laiki</p>
      </div>
    </div>
    <div className="v80-flex-table" id="v80-table">
      <div className="v80-header">
        <div>Kas?<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Кто?)</small></div>
        <div>Tagadne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Настоящее время)</small><br /><span className="v80-header-sub">esot+divdabis ar</span><br /><span className="v80-header-sub"><span className="v80-ending-masc">-is</span>, <span className="v80-ending-fem">-usi</span>,<br /><span className="v80-ending-masc">-ies</span>, <span className="v80-ending-fem">-usies</span></span></div>
        <div>Nākotne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Будущее время)</small><br /><span className="v80-header-sub">būšot+divdabis ar</span><br /><span className="v80-header-sub"><span className="v80-ending-masc">-is</span>, <span className="v80-ending-fem">-usi</span>,<br /><span className="v80-ending-masc">-ies</span>, <span className="v80-ending-fem">-usies</span></span></div>
      </div>
      <div id="v80-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v80-row"><div className="v80-cell">es, tu, viņš, viņa</div><div className="v80-cell">esot zināj-<span className="v80-ending-masc">is</span>, zināj-<span className="v80-ending-fem">usi</span><br />esot skatīj-<span className="v80-ending-masc">ies</span>, skatīj-<span className="v80-ending-fem">usies</span></div><div className="v80-cell">būšot zināj-<span className="v80-ending-masc">is</span>, zināj-<span className="v80-ending-fem">usi</span><br />būšot skatīj-<span className="v80-ending-masc">ies</span>, skatīj-<span className="v80-ending-fem">usies</span></div></div><div className="v80-row"><div className="v80-cell">mēs, jūs, viņi, viņas</div><div className="v80-cell">esot zināj-<span className="v80-ending-masc">uši</span>, zināj-<span className="v80-ending-fem">ušas</span><br />esot skatīj-<span className="v80-ending-masc">ušies</span>, skatīj-<span className="v80-ending-fem">ušās</span></div><div className="v80-cell">būšot zināj-<span className="v80-ending-masc">uši</span>, zināj-<span className="v80-ending-fem">ušas</span><br />būšot skatīj-<span className="v80-ending-masc">ušies</span>, skatīj-<span className="v80-ending-fem">ušās</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v80-table-image-container" style={{marginTop: '8px'}}>
        <div className="v80-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v80-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v80-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



