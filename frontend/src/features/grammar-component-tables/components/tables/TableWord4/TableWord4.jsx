import TableCard from '../../TableCard.jsx';
import './TableWord4.css';
export default function TableWord4() {
  return (
    <TableCard>
      <div className="card table-word4" id="word4-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word4-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD4</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'center', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>SALIKTENI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Сложные слова)</span></h2>
    </div>
    <div style={{padding: '0 12px 12px 12px'}}>
      <p style={{margin: '0 0 8px 0', color: '#333'}}>Salikteņus darina, apvienojot vismaz divus patstāvīgus vārdus vai to daļas.</p>
      <p style={{margin: '0 0 12px 0', color: '#333'}}>Ir vairāki salikteņu darināšanas veidi</p>
    </div>
    <div className="word4-flex-table" id="word4-table">
      <div className="word4-header">
        <div>Darināšanas veids<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Способ образования)</small></div>
        <div>Piemēri<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Примеры)</small></div>
      </div>
      <div id="word4-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word4-row"><div className="word4-cell">Abi vārdi pilnībā saglabā savu formu.</div><div className="word4-cell"><div className="word4-example">saules + puķe<span className="word4-arrow">→</span> saulespuķe</div><div className="word4-example">ūdens + roze<span className="word4-arrow">→</span> ūdensroze</div></div></div><div className="word4-row"><div className="word4-cell">Pirmais vārds zaudē galotni.</div><div className="word4-cell"><div className="word4-example">saruna + biedrs<span className="word4-arrow">→</span> sarunbiedrs</div><div className="word4-example">viedais + tālrunis<span className="word4-arrow">→</span> viedtālrunis</div><div className="word4-example">mašīna + tulks<span className="word4-arrow">→</span> mašīntulks</div></div></div><div className="word4-row"><div className="word4-cell">Otrais vārds iegūst citu galotni.</div><div className="word4-cell"><div className="word4-example">bērzs + lapa<span className="word4-arrow">→</span> bērzlape</div><div className="word4-example">brūns + acs<span className="word4-arrow">→</span> brūnacis / brūnace</div></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word4-table-image-container" style={{marginTop: '8px'}}>
        <div className="word4-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word4-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word4-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



