import TableCard from '../../TableCard.jsx';
import './TableV74.css';
export default function TableV74() {
  return (
    <TableCard>
      <div className="card table-v74" id="v74-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v74-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V74</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Ciešamās kārtas vienkāršie laiki</h2>
    </div>
    <div className="v74-flex-table" id="v74-table">
      <div className="v74-header">
        <div>Vietniekvārds<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Местоимение)</small></div>
        <div>Tagadne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Настоящее время)</small></div>
        <div>Pagātne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Прошедшее время)</small></div>
        <div>Nākotne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Будущее время)</small></div>
        <div>Vīriešu dzimte<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Мужской род)</small></div>
        <div>Sieviešu dzimte<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Женский род)</small></div>
      </div>
      <div id="v74-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v74-row"><div className="v74-cell">es</div><div className="v74-cell">tieku</div><div className="v74-cell">tiku</div><div className="v74-cell">tikšu</div><div className="v74-cell">aicinā-<span className="v74-ending-masc">ts</span></div><div className="v74-cell">aicinā-<span className="v74-ending-fem">ta</span></div></div><div className="v74-row"><div className="v74-cell">tu</div><div className="v74-cell">tiec</div><div className="v74-cell">tiki</div><div className="v74-cell">tiksi</div><div className="v74-cell">aicinā-<span className="v74-ending-masc">ts</span></div><div className="v74-cell">aicinā-<span className="v74-ending-fem">ta</span></div></div><div className="v74-row"><div className="v74-cell">viņš</div><div className="v74-cell">tiek</div><div className="v74-cell">tika</div><div className="v74-cell">tiks</div><div className="v74-cell">aicinā-<span className="v74-ending-masc">ts</span></div><div className="v74-cell"></div></div><div className="v74-row"><div className="v74-cell">viņa</div><div className="v74-cell"></div><div className="v74-cell"></div><div className="v74-cell"></div><div className="v74-cell"></div><div className="v74-cell">aicinā-<span className="v74-ending-fem">ta</span></div></div><div className="v74-row"><div className="v74-cell">mēs</div><div className="v74-cell">tiekam</div><div className="v74-cell">tikām</div><div className="v74-cell">tiksim</div><div className="v74-cell">aicinā-<span className="v74-ending-masc">ti</span></div><div className="v74-cell">aicinā-<span className="v74-ending-fem">tas</span></div></div><div className="v74-row"><div className="v74-cell">jūs</div><div className="v74-cell">tiekat</div><div className="v74-cell">tikāt</div><div className="v74-cell">tiksiet</div><div className="v74-cell">aicinā-<span className="v74-ending-masc">ti</span></div><div className="v74-cell">aicinā-<span className="v74-ending-fem">tas</span></div></div><div className="v74-row"><div className="v74-cell">viņi</div><div className="v74-cell">tiek</div><div className="v74-cell">tika</div><div className="v74-cell">tiks</div><div className="v74-cell">aicinā-<span className="v74-ending-masc">ti</span></div><div className="v74-cell"></div></div><div className="v74-row"><div className="v74-cell">viņas</div><div className="v74-cell"></div><div className="v74-cell"></div><div className="v74-cell"></div><div className="v74-cell"></div><div className="v74-cell">aicinā-<span className="v74-ending-fem">tas</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v74-table-image-container" style={{marginTop: '8px'}}>
        <div className="v74-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v74-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v74-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



