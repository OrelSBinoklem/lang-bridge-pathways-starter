import TableCard from '../../TableCard.jsx';
import './TableV72.css';
export default function TableV72() {
  return (
    <TableCard>
      <div className="card table-v72" id="v72-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v72-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V72</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>ĪSTENĪBAS IZTEIKSME</h2>
    </div>
    <div className="v72-flex-table" id="v72-table">
      <div className="v72-header">
        <div>Vietniekvārds<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Местоимение)</small></div>
        <div>Darbības vārds būt tagadnes formā<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Глагол 'быть' в настоящем времени)</small></div>
        <div>Darbības vārds būt pagātnes formā<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Глагол 'быть' в прошедшем времени)</small></div>
        <div>Darbības vārds būt nākotnes formā<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Глагол 'быть' в будущем времени)</small></div>
        <div>Vīriešu dzimte<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Мужской род)</small></div>
        <div>Sieviešu dzimte<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Женский род)</small></div>
      </div>
      <div id="v72-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v72-section-header">Darāmās kārtas vienkāršie laiki</div><div className="v72-row"><div className="v72-cell">es</div><div className="v72-cell">esmu</div><div className="v72-cell">biju</div><div className="v72-cell">būšu</div><div className="v72-cell">rakstīj-<span className="v72-ending-masc">is</span></div><div className="v72-cell">rakstīj-<span className="v72-ending-fem">usi</span></div></div><div className="v72-row"><div className="v72-cell">tu</div><div className="v72-cell">esi</div><div className="v72-cell">biji</div><div className="v72-cell">būsi</div><div className="v72-cell">rakstīj-<span className="v72-ending-masc">is</span></div><div className="v72-cell">rakstīj-<span className="v72-ending-fem">usi</span></div></div><div className="v72-row"><div className="v72-cell">viņš, viņa</div><div className="v72-cell">ir</div><div className="v72-cell">bija</div><div className="v72-cell">būs</div><div className="v72-cell">rakstīj-<span className="v72-ending-masc">is</span></div><div className="v72-cell">rakstīj-<span className="v72-ending-fem">usi</span></div></div><div className="v72-row"><div className="v72-cell">mēs</div><div className="v72-cell">esam</div><div className="v72-cell">bijām</div><div className="v72-cell">būsim</div><div className="v72-cell">rakstīj-<span className="v72-ending-masc">uši</span></div><div className="v72-cell">rakstīj-<span className="v72-ending-fem">ušas</span></div></div><div className="v72-row"><div className="v72-cell">jūs</div><div className="v72-cell">esat</div><div className="v72-cell">bijāt</div><div className="v72-cell">būsiet</div><div className="v72-cell">rakstīj-<span className="v72-ending-masc">uši</span></div><div className="v72-cell">rakstīj-<span className="v72-ending-fem">ušas</span></div></div><div className="v72-row"><div className="v72-cell">viņi, viņas</div><div className="v72-cell">ir</div><div className="v72-cell">bija</div><div className="v72-cell">būs</div><div className="v72-cell">rakstīj-<span className="v72-ending-masc">uši</span></div><div className="v72-cell">rakstīj-<span className="v72-ending-fem">ušas</span></div></div><div className="v72-section-header">Darāmās kārtas saliktie laiki</div><div className="v72-row"><div className="v72-cell">es</div><div className="v72-cell">esmu</div><div className="v72-cell">biju</div><div className="v72-cell">būšu</div><div className="v72-cell">bij-<span className="v72-ending-masc">is</span></div><div className="v72-cell">bij-<span className="v72-ending-fem">usi</span></div></div><div className="v72-row"><div className="v72-cell">tu</div><div className="v72-cell">esi</div><div className="v72-cell">biji</div><div className="v72-cell">būsi</div><div className="v72-cell">bij-<span className="v72-ending-masc">is</span></div><div className="v72-cell">bij-<span className="v72-ending-fem">usi</span></div></div><div className="v72-row"><div className="v72-cell">viņš, viņa</div><div className="v72-cell">ir</div><div className="v72-cell">bija</div><div className="v72-cell">būs</div><div className="v72-cell">bij-<span className="v72-ending-masc">is</span></div><div className="v72-cell">bij-<span className="v72-ending-fem">usi</span></div></div><div className="v72-row"><div className="v72-cell">mēs</div><div className="v72-cell">esam</div><div className="v72-cell">bijām</div><div className="v72-cell">būsim</div><div className="v72-cell">bij-<span className="v72-ending-masc">uši</span></div><div className="v72-cell">bij-<span className="v72-ending-fem">ušas</span></div></div><div className="v72-row"><div className="v72-cell">jūs</div><div className="v72-cell">esat</div><div className="v72-cell">bijāt</div><div className="v72-cell">būsiet</div><div className="v72-cell">bij-<span className="v72-ending-masc">uši</span></div><div className="v72-cell">bij-<span className="v72-ending-fem">ušas</span></div></div><div className="v72-row"><div className="v72-cell">viņi, viņas</div><div className="v72-cell">ir</div><div className="v72-cell">bija</div><div className="v72-cell">būs</div><div className="v72-cell">bij-<span className="v72-ending-masc">uši</span></div><div className="v72-cell">bij-<span className="v72-ending-fem">ušas</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v72-table-image-container" style={{marginTop: '8px'}}>
        <div className="v72-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v72-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v72-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



