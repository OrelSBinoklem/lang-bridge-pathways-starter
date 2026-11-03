import TableCard from '../../TableCard.jsx';
import './TableV78.css';
export default function TableV78() {
  return (
    <TableCard>
      <div className="card table-v78" id="v78-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v78-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V78</div>
      <div style={{flex: 1, marginLeft: '12px'}}>
        <h2 style={{margin: 0, color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>PAVĒLES IZTEIKSME</h2>
      </div>
    </div>
    <div className="v78-flex-table" id="v78-table">
      <div className="v78-header">
        <div>Kas?<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Кто?)</small></div>
        <div>Īstenības izteiksmes vienkāršā tagadne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Изъявительное наклонение, простое настоящее время)</small></div>
        <div>Pavēles izteiksme<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Повелительное наклонение)</small></div>
      </div>
      <div id="v78-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v78-row"><div className="v78-cell">es</div><div className="v78-cell">nāk-<span className="v78-ending">u</span>, cel-<span className="v78-ending">os</span></div><div className="v78-cell">—</div></div><div className="v78-row"><div className="v78-cell">tu</div><div className="v78-cell">nāc, cel-<span className="v78-ending">ies</span></div><div className="v78-cell">nāc!, celies!</div></div><div className="v78-row"><div className="v78-cell">viņš, viņa, viņi, viņas</div><div className="v78-cell">nāk, cel-<span className="v78-ending">as</span></div><div className="v78-cell">lai nāk!, lai ceļas!</div></div><div className="v78-row"><div className="v78-cell">mēs</div><div className="v78-cell">nāk-<span className="v78-ending">am</span>, cel-<span className="v78-ending">amies</span></div><div className="v78-cell">nāksim!, celsimies!</div></div><div className="v78-row"><div className="v78-cell">jūs</div><div className="v78-cell">nāk-<span className="v78-ending">at</span>, cel-<span className="v78-ending">aties</span></div><div className="v78-cell">nāciet!, celieties!</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v78-table-image-container" style={{marginTop: '8px'}}>
        <div className="v78-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v78-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v78-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



