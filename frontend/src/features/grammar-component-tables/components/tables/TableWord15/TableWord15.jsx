import TableCard from '../../TableCard.jsx';
import './TableWord15.css';
export default function TableWord15() {
  return (
    <TableCard>
      <div className="card table-word15" id="word15-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word15-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD15</div>
    </div>
    <h2 className="word15-title">DARBĪBAS VĀRDA KĀRTAS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Залоги глагола)</span></h2>
    <p className="word15-intro">Darbības vārda kārta izsaka sakarus starp darītāju, darbību un darbības objektu.</p>
    <div className="word15-flex-table" id="word15-table">
      <div className="word15-header">
        <div>Darāmā kārta</div>
        <div>Ciešamā kārta</div>
      </div>
      <div id="word15-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word15-row"><div className="word15-cell">
      <span className="word15-description">Izsaka darbību, kas iziet no darītāja un var pāriet uz darbības objektu. Teikumā ir minēts darbības veicējs.</span>
      <span className="word15-examples">
        <span className="word15-example">Zēns lasa grāmatu.</span>
        <span className="word15-example">Skolēni priecīgi smejas un skatās filmu.</span>
      </span>
    </div><div className="word15-cell">
      <span className="word15-description">Izsaka darbību, kuras veicējs teikumā nav minēts. Ciešamo kārtu veido, savienojot palīgdarbības vārdu <span className="word15-bold">tikt</span>, <span className="word15-bold">tapt</span>, <span className="word15-bold">kļūt</span>, <span className="word15-bold">būt</span> un pagātnes ciešamās kārtas divdabi ar <span className="word15-bold">-ts</span>.</span>
      <span className="word15-examples">
        <span className="word15-example">Grāmata tiek lasīta.</span>
        <span className="word15-example">Skola top celta.</span>
        <span className="word15-example">Dziesma ir veltīta mammai.</span>
      </span>
    </div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word15-table-image-container" style={{marginTop: '8px'}}>
        <div className="word15-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word15-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word15-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



