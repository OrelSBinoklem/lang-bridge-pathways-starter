import TableCard from '../../TableCard.jsx';
import './TableV76.css';
export default function TableV76() {
  return (
    <TableCard>
      <div className="card table-v76" id="v76-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v76-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V76</div>
      <div style={{flex: 1, marginLeft: '12px'}}>
        <h2 style={{margin: 0, color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>VAJADZĪBAS IZTEIKSME</h2>
        <p style={{margin: '4px 0 0 0', fontStyle: 'italic', color: '#333'}}>Vienkāršie laiki</p>
      </div>
    </div>
    <div className="v76-flex-table" id="v76-table">
      <div className="v76-header">
        <div>Kam?<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Кому?)</small></div>
        <div>Īstenības izteiksmes tagadnes 3. persona<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Изъявительное наклонение, настоящее время, 3-е лицо)</small></div>
        <div className="v76-header-group">
          <div>Vajadzības izteiksme<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Наклонение необходимости)</small></div>
          <div style={{display: 'flex'}}>
            <div className="v76-subheader">Tagadne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Настоящее время)</small></div>
            <div className="v76-subheader">Pagātne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Прошедшее время)</small></div>
            <div className="v76-subheader">Nākotne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Будущее время)</small></div>
          </div>
        </div>
        <div>jā- + tagadnes 3. persona<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(jā- + настоящее время, 3-е лицо)</small></div>
      </div>
      <div id="v76-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v76-row"><div className="v76-cell">man</div><div className="v76-cell">pēta</div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"><span className="v76-prefix-ja">jā</span>+pēta</div></div><div className="v76-row"><div className="v76-cell">tev</div><div className="v76-cell">meklē</div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"><span className="v76-prefix-ja">jā</span>+meklē</div></div><div className="v76-row"><div className="v76-cell">viņam, viņai, viņiem, viņām</div><div className="v76-cell">iet</div><div className="v76-cell">ir</div><div className="v76-cell">bija</div><div className="v76-cell">būs</div><div className="v76-cell"><span className="v76-prefix-ja">jā</span>+iet</div></div><div className="v76-row"><div className="v76-cell">mums</div><div className="v76-cell">brauc</div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"><span className="v76-prefix-ja">jā</span>+brauc</div></div><div className="v76-row"><div className="v76-cell">jums</div><div className="v76-cell">nāk</div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"><span className="v76-prefix-ja">jā</span>+nāk</div></div><div className="v76-row"><div className="v76-cell"></div><div className="v76-cell">domā</div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"></div><div className="v76-cell"><span className="v76-prefix-ja">jā</span>+domā</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v76-table-image-container" style={{marginTop: '8px'}}>
        <div className="v76-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v76-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v76-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



