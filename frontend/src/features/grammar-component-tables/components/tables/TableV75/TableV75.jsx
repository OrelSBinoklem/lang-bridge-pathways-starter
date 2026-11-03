import TableCard from '../../TableCard.jsx';
import './TableV75.css';
export default function TableV75() {
  return (
    <TableCard>
      <div className="card table-v75" id="v75-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v75-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V75</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Ciešamās kārtas saliktie laiki</h2>
    </div>
    <div className="v75-flex-table" id="v75-table">
      <div className="v75-header">
        <div>Vietniekvārds<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Местоимение)</small></div>
        <div>Tagadne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Настоящее время)</small></div>
        <div>Pagātne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Прошедшее время)</small></div>
        <div>Nākotne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Будущее время)</small></div>
        <div>Vīriešu dzimte<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Мужской род)</small></div>
        <div>Sieviešu dzimte<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Женский род)</small></div>
      </div>
      <div id="v75-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v75-row"><div className="v75-cell">es</div><div className="v75-cell">esmu</div><div className="v75-cell">biju</div><div className="v75-cell">būšu</div><div className="v75-cell">uzaicinā-<span className="v75-ending-masc">ts</span></div><div className="v75-cell">uzaicinā-<span className="v75-ending-fem">ta</span></div></div><div className="v75-row"><div className="v75-cell">tu</div><div className="v75-cell">esi</div><div className="v75-cell">biji</div><div className="v75-cell">būsi</div><div className="v75-cell">uzaicinā-<span className="v75-ending-masc">ts</span></div><div className="v75-cell">uzaicinā-<span className="v75-ending-fem">ta</span></div></div><div className="v75-row"><div className="v75-cell">viņš</div><div className="v75-cell">ir</div><div className="v75-cell">bija</div><div className="v75-cell">būs</div><div className="v75-cell">uzaicinā-<span className="v75-ending-masc">ts</span></div><div className="v75-cell"></div></div><div className="v75-row"><div className="v75-cell">viņa</div><div className="v75-cell"></div><div className="v75-cell"></div><div className="v75-cell"></div><div className="v75-cell"></div><div className="v75-cell">uzaicinā-<span className="v75-ending-fem">ta</span></div></div><div className="v75-row"><div className="v75-cell">mēs</div><div className="v75-cell">esam</div><div className="v75-cell">bijām</div><div className="v75-cell">būsim</div><div className="v75-cell">uzaicinā-<span className="v75-ending-masc">ti</span></div><div className="v75-cell">uzaicinā-<span className="v75-ending-fem">tas</span></div></div><div className="v75-row"><div className="v75-cell">jūs</div><div className="v75-cell">esat</div><div className="v75-cell">bijāt</div><div className="v75-cell">būsiet</div><div className="v75-cell">uzaicinā-<span className="v75-ending-masc">ti</span></div><div className="v75-cell">uzaicinā-<span className="v75-ending-fem">tas</span></div></div><div className="v75-row"><div className="v75-cell">viņi</div><div className="v75-cell">ir</div><div className="v75-cell">bija</div><div className="v75-cell">būs</div><div className="v75-cell">uzaicinā-<span className="v75-ending-masc">ti</span></div><div className="v75-cell"></div></div><div className="v75-row"><div className="v75-cell">viņas</div><div className="v75-cell"></div><div className="v75-cell"></div><div className="v75-cell"></div><div className="v75-cell"></div><div className="v75-cell">uzaicinā-<span className="v75-ending-fem">tas</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v75-table-image-container" style={{marginTop: '8px'}}>
        <div className="v75-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v75-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v75-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



