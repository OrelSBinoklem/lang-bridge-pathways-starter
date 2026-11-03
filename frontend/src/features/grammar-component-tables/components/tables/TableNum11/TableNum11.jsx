import TableCard from '../../TableCard.jsx';
import './TableNum11.css';
export default function TableNum11() {
  return (
    <TableCard>
      <div className="card table-num11" id="num11-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="num11-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>NUM11</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Cik minūtēs? <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Во сколько минут?)</span></h2>
    </div>
    <div className="num11-flex-table" id="num11-table">
      <div className="num11-header">
        <div>Cikos?</div>
        <div>1 minūtē</div>
        <div>2-9 minūtēs</div>
        <div>11-19 minūtēs</div>
        <div>10, 20, 30 ... minūtēs</div>
      </div>
      <div id="num11-table-body">
        {/* Заполняется через JavaScript */}
      <div className="num11-row"><div className="num11-cell" style={{width: '120px'}}><span className="num11-number-masc">Vienos</span> un</div><div className="num11-cell" style={{flex: '1 1 0%'}}>vien-<span className="num11-ending-fem">ā</span> minūt<span className="num11-ending-fem">ē</span> (01.01)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>div-<span className="num11-ending-fem">ās</span> minūt<span className="num11-ending-fem">ēs</span> (01.02)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>vienpadsmit minūt<span className="num11-ending-fem">ēs</span> (01.11)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>desmit minūt<span className="num11-ending-fem">ēs</span> (01.10)</div></div><div className="num11-row"><div className="num11-cell" style={{width: '120px'}}></div><div className="num11-cell" style={{flex: '1 1 0%'}}>divdesmit vien-<span className="num11-ending-fem">ā</span> minūt<span className="num11-ending-fem">ē</span> (01.21)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>tr<span className="num11-ending-fem">īs</span> minūt<span className="num11-ending-fem">ēs</span> (01.03)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>divpadsmit minūt<span className="num11-ending-fem">ēs</span> (01.12)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>divdesmit minūt<span className="num11-ending-fem">ēs</span> (01.20)</div></div><div className="num11-row"><div className="num11-cell" style={{width: '120px'}}></div><div className="num11-cell" style={{flex: '1 1 0%'}}>trīsdesmit vien-<span className="num11-ending-fem">ā</span> minūt<span className="num11-ending-fem">ē</span> (01.31)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>četr-<span className="num11-ending-fem">ās</span> minūt<span className="num11-ending-fem">ēs</span> (01.04)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>trīspadsmit minūt<span className="num11-ending-fem">ēs</span> (01.13)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>trīsdesmit minūt<span className="num11-ending-fem">ēs</span> (01.30)</div></div><div className="num11-row"><div className="num11-cell" style={{width: '120px'}}></div><div className="num11-cell" style={{flex: '1 1 0%'}}>četrdesmit vien-<span className="num11-ending-fem">ā</span> minūt<span className="num11-ending-fem">ē</span> (01.41)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>piec-<span className="num11-ending-fem">ās</span> minūt<span className="num11-ending-fem">ēs</span> (01.05)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>četrpadsmit minūt<span className="num11-ending-fem">ēs</span> (01.14)</div><div className="num11-cell" style={{flex: '1 1 0%'}}>četrdesmit minūt<span className="num11-ending-fem">ēs</span> (01.40)</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="num11-table-image-container" style={{marginTop: '8px'}}>
        <div className="num11-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="num11-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn num11-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



