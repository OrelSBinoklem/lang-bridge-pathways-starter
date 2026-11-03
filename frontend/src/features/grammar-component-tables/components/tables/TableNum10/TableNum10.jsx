import TableCard from '../../TableCard.jsx';
import './TableNum10.css';
export default function TableNum10() {
  return (
    <TableCard>
      <div className="card table-num10" id="num10-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="num10-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>NUM10</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Cik minūšu? <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Сколько минут?)</span></h2>
    </div>
    <div className="num10-flex-table" id="num10-table">
      <div className="num10-header">
        <div>Cik?</div>
        <div>1 minūte</div>
        <div>2-9 minūtes</div>
        <div>11-19 minūtes</div>
        <div>10, 20, 30 ... minūtes</div>
      </div>
      <div id="num10-table-body">
        {/* Заполняется через JavaScript */}
      <div className="num10-row"><div className="num10-cell" style={{width: '120px'}}><span className="num10-number-masc">Viens</span> un</div><div className="num10-cell" style={{flex: '1 1 0%'}}>vien-<span className="num10-ending-fem">a</span> minūte (01.01)</div><div className="num10-cell" style={{flex: '1 1 0%'}}>div-<span className="num10-ending-fem">as</span> minūtes (01.02)</div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">vienpadsmit</span> minūtes (01.11)</div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">desmit</span> minūtes (01.10)</div></div><div className="num10-row"><div className="num10-cell" style={{width: '120px'}}></div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">divdesmit</span> vien-<span className="num10-ending-fem">a</span> minūte (01.21)</div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">trīs</span> minūtes (01.03)</div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">divpadsmit</span> minūtes (01.12)</div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">divdesmit</span> minūtes (01.20)</div></div><div className="num10-row"><div className="num10-cell" style={{width: '120px'}}></div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">trīsdesmit</span> vien-<span className="num10-ending-fem">a</span> minūte (01.31)</div><div className="num10-cell" style={{flex: '1 1 0%'}}>četr-<span className="num10-ending-fem">as</span> minūtes (01.04)</div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">trīspadsmit</span> minūtes (01.13)</div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">trīsdesmit</span> minūtes (01.30)</div></div><div className="num10-row"><div className="num10-cell" style={{width: '120px'}}></div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">četrdesmit</span> vien-<span className="num10-ending-fem">a</span> minūte (01.41)</div><div className="num10-cell" style={{flex: '1 1 0%'}}>piec-<span className="num10-ending-fem">as</span> minūtes (01.05)</div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">četrpadsmit</span> minūtes (01.14)</div><div className="num10-cell" style={{flex: '1 1 0%'}}><span className="num10-ending-fem">četrdesmit</span> minūtes (01.40)</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="num10-table-image-container" style={{marginTop: '8px'}}>
        <div className="num10-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="num10-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn num10-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



