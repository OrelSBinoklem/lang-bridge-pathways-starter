import TableCard from '../../TableCard.jsx';
import './TableWord22.css';
export default function TableWord22() {
  return (
    <TableCard>
      <div className="card table-word22" id="word22-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word22-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD22</div>
    </div>
    <h2 className="word22-title">IESPRAUDUMI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Вставные конструкции)</span></h2>
    <p className="word22-intro">Iespraudumi ir vārdi vai vārdu grupas, kas norāda runātāja attieksmi pret izsacīto, izsaka kādu piezīmi par teikuma saturu vai precizē, paskaidro teikuma saturu.</p>
    <div className="word22-flex-table" id="word22-table">
      <div className="word22-header">
        <div>Iesprausti vārdi<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Вводные слова)</small></div>
        <div>Iespraustu vārdu grupas<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Группы вводных слов)</small></div>
        <div>Iespraustas teikuma daļas<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Вводные части предложения)</small></div>
      </div>
      <div id="word22-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word22-row"><div className="word22-cell"><span className="word22-example">pirmkārt</span></div><div className="word22-cell"><span className="word22-example">paldies Dievam</span></div><div className="word22-cell"><span className="word22-example">kaut kas neticams</span></div></div><div className="word22-row"><div className="word22-cell"><span className="word22-example">manuprāt</span></div><div className="word22-cell"><span className="word22-example">taisnību sakot</span></div><div className="word22-cell"><span className="word22-example">ja atmiņa neviļ</span></div></div><div className="word22-row"><div className="word22-cell"><span className="word22-example">liekas</span></div><div className="word22-cell"><span className="word22-example">tavu laimi</span></div><div className="word22-cell"><span className="word22-example">tas nevar būt</span></div></div><div className="word22-row"><div className="word22-cell"><span className="word22-example">iespējams</span></div><div className="word22-cell"><span className="word22-example">citiem vārdiem</span></div><div className="word22-cell"><span className="word22-example">tas sen zināms</span></div></div><div className="word22-row"><div className="word22-cell"><span className="word22-example">šķiet</span></div><div className="word22-cell"><span className="word22-example">pēc manām domām</span></div><div className="word22-cell"></div></div><div className="word22-row"><div className="word22-cell"><span className="word22-example">zināms</span></div><div className="word22-cell"></div><div className="word22-cell"></div></div><div className="word22-row"><div className="word22-cell"><span className="word22-example">protams</span></div><div className="word22-cell"></div><div className="word22-cell"></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word22-table-image-container" style={{marginTop: '8px'}}>
        <div className="word22-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word22-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word22-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



