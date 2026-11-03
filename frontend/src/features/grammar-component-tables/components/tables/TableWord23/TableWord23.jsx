import TableCard from '../../TableCard.jsx';
import './TableWord23.css';
export default function TableWord23() {
  return (
    <TableCard>
      <div className="card table-word23" id="word23-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word23-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD23</div>
    </div>
    <div className="word23-intro" id="word23-intro">
      {/* Заполняется через JavaScript */}
    <p>Rakstot iespraudumus atdala ar komatiem, iekavām.</p><p>Plašākus iespraudumus var ievadīt vārdi vai vārdu grupas, ko no pārējā teikuma atdala ar pieturzīmēm.</p><p>Tā veidojas paskaidrojošas vārdu grupas.</p></div>
    <div className="word23-flex-table" id="word23-table">
      <div className="word23-header">
        <div>Ar pieturzīmēm atdala<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Отделяются знаками препинания)</small></div>
        <div>Ar pieturzīmēm neatdala<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Не отделяются знаками препинания)</small></div>
      </div>
      <div id="word23-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word23-row"><div className="word23-cell"><span className="word23-example">protams</span></div><div className="word23-cell"><span className="word23-example">savukārt</span></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">cerams</span></div><div className="word23-cell"><span className="word23-example">patiesībā</span></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">šķiet</span></div><div className="word23-cell"><span className="word23-example">retāk</span></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">kā mēdz teikt</span></div><div className="word23-cell"><span className="word23-example">tāpat kā</span></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">tiesa</span></div><div className="word23-cell"><span className="word23-example">galvenokārt</span></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">pēc viņa domām</span></div><div className="word23-cell"><span className="word23-example">laikam</span></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">manuprāt</span></div><div className="word23-cell"><span className="word23-example">varbūt</span></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">pirmkārt</span></div><div className="word23-cell"></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">proti</span></div><div className="word23-cell"></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">respektīvi</span></div><div className="word23-cell"></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">tas ir</span></div><div className="word23-cell"></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">paldies Dievam</span></div><div className="word23-cell"></div></div><div className="word23-row"><div className="word23-cell"><span className="word23-example">ja atmiņa neviļ</span></div><div className="word23-cell"></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word23-table-image-container" style={{marginTop: '8px'}}>
        <div className="word23-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word23-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word23-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



