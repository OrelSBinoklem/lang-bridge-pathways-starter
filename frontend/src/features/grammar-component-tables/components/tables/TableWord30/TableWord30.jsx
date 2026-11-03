import TableCard from '../../TableCard.jsx';
import './TableWord30.css';
export default function TableWord30() {
  return (
    <TableCard>
      <div className="card table-word30" id="word30-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word30-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD30</div>
    </div>
    <h2 className="word30-title" id="word30-title">
      BIEŽĀK LIETOTIE PALĪGTEIKUMU<span className="word30-title-line2">IEVADĪTĀJVĀRDI</span> <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Наиболее часто используемые союзы и вводные слова)</span>
    </h2>
    <div id="word30-content">
      {/* Заполняется через JavaScript */}
    <div className="word30-table-wrapper"><div className="word30-table"><div className="word30-header"><div>Pakārtojuma saikļi</div><div>Attieksmes vietniekvārdi</div><div>Apstākļa vārdi</div><div>Vārdu savienojumi</div></div><div className="word30-row"><div className="word30-cell">ka, vai, ja, lai, jo, līdz, lai,<br />gan, tā kā, lai arī, kaut<br />arī, kaut gan, tā ka,<br />tāpēc ka, tiklīdz, tādēļ ka</div><div className="word30-cell">kas, kurš, kura, kāds,<br />kāda <span className="word30-parentheses">(visos locījumos)</span></div><div className="word30-cell">kad, kur, cik, kā, kamēr,<br />kāpēc, kādēļ</div><div className="word30-cell">uz kurieni, no kurienes,<br />līdz kurienei</div></div></div></div></div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word30-table-image-container" style={{marginTop: '8px'}}>
        <div className="word30-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word30-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word30-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



