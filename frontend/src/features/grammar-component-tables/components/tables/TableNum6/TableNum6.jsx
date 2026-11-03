import TableCard from '../../TableCard.jsx';
import './TableNum6.css';
export default function TableNum6() {
  return (
    <TableCard>
      <div className="card table-num6" id="num6-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="num6-title-banner" style={{background: '#ff6600', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>NUM6</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}></h2>
    </div>
    <div className="num6-flex-table" id="num6-table">
      <div className="num6-header">
        <div>Skaitlis</div>
        <div style={{flex: 1}}></div>
        <div style={{flex: 3}}>Vienskaitlis</div>
        <div style={{flex: 3}}>Vienskaitlis</div>
      </div>
      <div className="num6-subheader">
        <div>Jautājums</div>
        <div style={{flex: 1}}>Skaitļa vārds</div>
        <div style={{flex: 1}}>Lietvārds</div>
        <div style={{flex: 1}}>Lietvārds</div>
        <div style={{flex: 1}}>Lietvārds</div>
        <div style={{flex: 1}}>Lietvārds</div>
        <div style={{flex: 1}}>Lietvārds</div>
        <div style={{flex: 1}}>Lietvārds</div>
      </div>
      <div className="num6-subheader">
        <div></div>
        <div style={{flex: 1}}></div>
        <div style={{flex: 1}}>1.</div>
        <div style={{flex: 1}}>2.</div>
        <div style={{flex: 1}}>3.</div>
        <div style={{flex: 1}}>4.</div>
        <div style={{flex: 1}}>5.</div>
        <div style={{flex: 1}}>6.</div>
      </div>
      <div id="num6-table-body">
        {/* Заполняется через JavaScript */}
      <div className="num6-row"><div className="num6-cell">Kas?</div><div className="num6-cell num6-cell-number">pirm-<span className="num6-ending-masc">ais</span></div><div className="num6-cell num6-cell-noun">tramvajs</div><div className="num6-cell num6-cell-noun">februāris</div><div className="num6-cell num6-cell-noun">lietus</div><div className="num6-cell num6-cell-noun">diena</div><div className="num6-cell num6-cell-noun">spēle</div><div className="num6-cell num6-cell-noun">valsts</div></div><div className="num6-row"><div className="num6-cell">Kā?</div><div className="num6-cell num6-cell-number">pirm-<span className="num6-ending-fem">ā</span></div><div className="num6-cell num6-cell-noun">tramvaja</div><div className="num6-cell num6-cell-noun">februāra</div><div className="num6-cell num6-cell-noun">lietus</div><div className="num6-cell num6-cell-noun">dienas</div><div className="num6-cell num6-cell-noun">spēles</div><div className="num6-cell num6-cell-noun">valsts</div></div><div className="num6-row"><div className="num6-cell">Kam?</div><div className="num6-cell num6-cell-number">pirmaj-<span className="num6-ending-masc">am</span></div><div className="num6-cell num6-cell-noun">tramvajam</div><div className="num6-cell num6-cell-noun">februārim</div><div className="num6-cell num6-cell-noun">lietum</div><div className="num6-cell num6-cell-noun">dienai</div><div className="num6-cell num6-cell-noun">spēlei</div><div className="num6-cell num6-cell-noun">valstij</div></div><div className="num6-row"><div className="num6-cell">Ko?</div><div className="num6-cell num6-cell-number">pirm-<span className="num6-ending-accusative">o</span></div><div className="num6-cell num6-cell-noun">tramvaju</div><div className="num6-cell num6-cell-noun">februāri</div><div className="num6-cell num6-cell-noun">lietu</div><div className="num6-cell num6-cell-noun">dienu</div><div className="num6-cell num6-cell-noun">spēli</div><div className="num6-cell num6-cell-noun">valsti</div></div><div className="num6-row"><div className="num6-cell">Kur?</div><div className="num6-cell num6-cell-number">pirmaj-<span className="num6-ending-fem">ā</span></div><div className="num6-cell num6-cell-noun">tramvajā</div><div className="num6-cell num6-cell-noun">februārī</div><div className="num6-cell num6-cell-noun">lietū</div><div className="num6-cell num6-cell-noun">dienā</div><div className="num6-cell num6-cell-noun">spēlē</div><div className="num6-cell num6-cell-noun">valstī</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="num6-table-image-container" style={{marginTop: '8px'}}>
        <div className="num6-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="num6-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn num6-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



