import TableCard from '../../TableCard.jsx';
import './TableWord6.css';
export default function TableWord6() {
  return (
    <TableCard>
      <div className="card table-word6" id="word6-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word6-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD6</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'center', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>VIENSKAITLINIEKI UN DAUDZSKAITLINIEKI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Существительные единственного и множественного числа)</span></h2>
    </div>
    <div className="word6-flex-table" id="word6-table">
      <div className="word6-header">
        <div>Vienskaitlinieki<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Существительные единственного числа)</small></div>
        <div>Daudzskaitlinieki<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Существительные множественного числа)</small></div>
      </div>
      <div id="word6-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word6-row"><div className="word6-cell">Lietvārdi, kuri parasti lietojami tikai vienskaitlī.</div><div className="word6-cell">Lietvārdi, kuri parasti lietojami tikai daudzskaitlī.</div></div><div className="word6-row"><div className="word6-cell">Vienskaitlinieki parasti ir atsevišķu vielu (piens, sviests), abstraktu jēdzienu (brīvība), rakstura iezīmju (čaklums, slinkums, uzņēmība) un vietvārdu (Saldus) nosaukumi.</div><div className="word6-cell">Daudzskaitlinieki parasti ir daži vietvārdu (Vidriži, Ādaži), mājvārdu („Ceļapīteri"), labības (mieži, kvieši), svētku un notikumu (Jāņi, Ziemassvētki, saulgrieži) nosaukumi, izjūtu (bēdas, skumjas) apzīmējumi, to rīku un priekšmetu apzīmēji, kuri lietojami pārī (apavi, bikses, brilles).</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word6-table-image-container" style={{marginTop: '8px'}}>
        <div className="word6-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word6-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word6-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



