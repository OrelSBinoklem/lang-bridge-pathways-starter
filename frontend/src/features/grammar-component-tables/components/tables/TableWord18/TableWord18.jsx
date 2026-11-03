import TableCard from '../../TableCard.jsx';
import './TableWord18.css';
export default function TableWord18() {
  return (
    <TableCard>
      <div className="card table-word18" id="word18-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word18-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD18</div>
    </div>
    <h2 className="word18-title">TIEŠĀ RUNA <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Прямая речь)</span></h2>
    <p className="word18-intro">Tiešā runa ir precīzs personas runas vai domu atkārtojums, ko no pārējā teksta nošķir ar pēdiņām. Latviešu valodā svarīga ir pieturzīmju lietošana.</p>
    <div className="word18-flex-table" id="word18-table">
      <div id="word18-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word18-header-row"><div>Piebilde</div><div>Tiešā runa</div></div><div className="word18-row word18-row-two"><div className="word18-cell word18-cell-piebilde">māte teica:</div><div className="word18-cell word18-cell-speech">„Mums šodien pusdienās būs kāpostu zupa."</div></div><div className="word18-header-row"><div>Tiešā runa</div><div>Piebilde</div></div><div className="word18-row word18-row-two"><div className="word18-cell word18-cell-speech">„Taču mums mājās nav maizes. Kas aizies uz veikalu un nopirks maizi?"</div><div className="word18-cell word18-cell-piebilde">viņa jautāja.</div></div><div className="word18-row word18-row-two"><div className="word18-cell word18-cell-speech">„Taču mājās nav maizes,"</div><div className="word18-cell word18-cell-piebilde">viņa secināja.</div></div><div className="word18-header-row"><div>Tiešā runa</div><div>Piebilde</div><div>Tiešā runa</div></div><div className="word18-row word18-row-three"><div className="word18-cell word18-cell-speech">„Tādā gadījumā,"</div><div className="word18-cell word18-cell-piebilde">māte secināja,</div><div className="word18-cell word18-cell-speech">„man būs jāiet pašai."</div></div><div className="word18-row word18-row-three"><div className="word18-cell word18-cell-speech">„Nekas,</div><div className="word18-cell word18-cell-piebilde">māte nosprieda.</div><div className="word18-cell word18-cell-speech">„iešu pati."</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word18-table-image-container" style={{marginTop: '8px'}}>
        <div className="word18-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word18-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word18-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



