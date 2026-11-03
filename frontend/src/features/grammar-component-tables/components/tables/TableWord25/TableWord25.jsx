import TableCard from '../../TableCard.jsx';
import './TableWord25.css';
export default function TableWord25() {
  return (
    <TableCard>
      <div className="card table-word25" id="word25-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word25-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD25</div>
    </div>
    <div className="word25-content-wrapper">
      <div className="word25-left-column">
        <div className="word25-left-title" id="word25-left-title">Savrupināts apstāklis un savrupināta pielikuma grupa</div>
      </div>
      <div className="word25-right-column">
        <div id="word25-content">
          {/* Заполняется через JavaScript */}
        <div className="word25-explanation">Ja teikumā vēlas precizēt, paskaidrot, precizēt kādu apstākli, tad veidojas savrupināts apstāklis vai tā grupa. Tas veidojas tikai aiz tāda paša nosaukuma apstākļa (vietas apstākļa savrupinājums aiz vietas apstākļa, laika apstākļa savrupinājums aiz laika apstākļa, veida apstākļa savrupinājums aiz veida apstākļa).</div><div className="word25-examples"><span className="word25-example">Tur, <span className="word25-underlined">ārā</span>, gaiss ir svaigs un smaržīgs.</span><span className="word25-example">Mamma pa purva taku nāca lēnām, <span className="word25-underlined">soli pa solītim</span>.</span><span className="word25-example">Tas notika nesen – <span className="word25-underlined">pirms dažiem gadiem</span>.</span></div><div className="word25-notes"><div className="word25-note"><span className="word25-note-marker">!</span> Nesavrupina pulksteņa laika apzīmējumu aiz dienas nosaukuma vai datuma, piemēram, <span className="word25-underlined">18. novembrī plkst. 21.00</span> būs lielā uguņošana.</div><div className="word25-note"><span className="word25-note-marker">!</span> Nesavrupina dažādus apstākļus, piemēram, <span className="word25-underlined">Šodien Vecrīgā</span> notiks orientēšanās sacensības.</div></div></div>
      </div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word25-table-image-container" style={{marginTop: '8px'}}>
        <div className="word25-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word25-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word25-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



