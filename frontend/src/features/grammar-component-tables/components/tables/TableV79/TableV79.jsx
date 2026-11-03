import TableCard from '../../TableCard.jsx';
import './TableV79.css';
export default function TableV79() {
  return (
    <TableCard>
      <div className="card table-v79" id="v79-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v79-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V79</div>
      <div style={{flex: 1, marginLeft: '12px', textAlign: 'center'}}>
        <h2 style={{margin: 0, color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>ATSTĀSTĪJUMA IZTEIKSME</h2>
        <p style={{margin: '4px 0 0 0', fontStyle: 'italic', color: '#7b2cbf'}}>Vienkāršie laiki</p>
      </div>
    </div>
    <div className="v79-flex-table" id="v79-table">
      <div className="v79-header">
        <div>Kas?<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Кто?)</small></div>
        <div>Īstenības izteiksmes tagadnes 1. persona<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Изъявительное наклонение, настоящее время, 1-е лицо)</small></div>
        <div>Īstenības izteiksmes nākotnes 1. persona<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Изъявительное наклонение, будущее время, 1-е лицо)</small></div>
        <div className="v79-header-group">
          <div>Atstāstījuma izteiksme<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Наклонение косвенной речи)</small></div>
          <div style={{display: 'flex'}}>
            <div className="v79-subheader">Tagadne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Настоящее время)</small><br /><small style={{fontWeight: 'normal', color: 'var(--muted)', fontSize: '0.85rem'}}>+ -ot, -oties</small></div>
            <div className="v79-subheader">Nākotne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Будущее время)</small><br /><small style={{fontWeight: 'normal', color: 'var(--muted)', fontSize: '0.85rem'}}>+ -ot, -oties</small></div>
          </div>
        </div>
      </div>
      <div id="v79-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v79-row"><div className="v79-cell">es</div><div className="v79-cell">zin-u</div><div className="v79-cell">zināš-u</div><div className="v79-cell">zin+ot</div><div className="v79-cell">zināš+ot</div></div><div className="v79-row"><div className="v79-cell">tu</div><div className="v79-cell">ved-u</div><div className="v79-cell">vedīš-u</div><div className="v79-cell">ved+ot</div><div className="v79-cell">vedīš+ot</div></div><div className="v79-row"><div className="v79-cell">viņš, viņa</div><div className="v79-cell">las-u</div><div className="v79-cell">lasīš-u</div><div className="v79-cell">las+ot</div><div className="v79-cell">lasīš+ot</div></div><div className="v79-row"><div className="v79-cell">viņi, viņas</div><div className="v79-cell">velk-u</div><div className="v79-cell">vilkš-u</div><div className="v79-cell">velk+ot</div><div className="v79-cell">vilkš+ot</div></div><div className="v79-row"><div className="v79-cell">mēs</div><div className="v79-cell">redz-u</div><div className="v79-cell">redzēš-u</div><div className="v79-cell">redz+ot</div><div className="v79-cell">redzēš+ot</div></div><div className="v79-row"><div className="v79-cell">jūs</div><div className="v79-cell">skat-os</div><div className="v79-cell">skatīš-os</div><div className="v79-cell">skat+oties</div><div className="v79-cell">skatīš+oties</div></div><div className="v79-row"><div className="v79-cell">jūs</div><div className="v79-cell">brīn-os</div><div className="v79-cell">brīnīš-os</div><div className="v79-cell">brīn+oties</div><div className="v79-cell">brīnīš+oties</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v79-table-image-container" style={{marginTop: '8px'}}>
        <div className="v79-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v79-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v79-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



