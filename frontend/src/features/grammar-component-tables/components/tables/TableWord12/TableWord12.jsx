import TableCard from '../../TableCard.jsx';
import './TableWord12.css';
export default function TableWord12() {
  return (
    <TableCard>
      <div className="card table-word12" id="word12-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word12-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD12</div>
    </div>
    <h2 className="word12-title">VIETNIEKVĀRDU TU UN JŪS LIETOJUMS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Употребление местоимений TU и JŪS)</span></h2>
    <div className="word12-content" id="word12-content">
      <p>2. personas vietniekvārdus <strong>tu</strong> (vsk.) un <strong>jūs</strong> (dsk.) lieto, lai nosauktu vienskaitļa un daudzskaitļa 2. personu. Parasti tekstā šos vietniekvārdus raksta ar mazo burtu.</p>
      <p>Vēstulēs, lai izrādītu cieņu tās lasītājam, vietniekvārdi tiek lietoti ar lielo sākumburtu – <strong>Tu</strong>, <strong>Jūs</strong>.</p>
      <p>Vietniekvārdu <strong>Tu</strong> lieto, lai uzrunātu kādu tuvu, pazīstamu cilvēku, savukārt vietniekvārdu <strong>Jūs</strong> izmanto, lai uzrunātu nepazīstamu personu.</p>
      <div className="word12-example">
        <div><span className="word12-example-label">Piemērs:</span> Vai tu nāksi ciemos? Vai jūs izpildījāt mājasdarbu?</div>
        <div style={{marginTop: '8px'}}><span className="word12-example-label">Vēstulē:</span> Vai <strong>Tu</strong> nāksi ciemos? Vai <strong>Jūs</strong> izpildījāt mājasdarbu?</div>
      </div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word12-table-image-container" style={{marginTop: '8px'}}>
        <div className="word12-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word12-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word12-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



