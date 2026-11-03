import TableCard from '../../TableCard.jsx';
import './TableWord20.css';
export default function TableWord20() {
  return (
    <TableCard>
      <div className="card table-word20" id="word20-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word20-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD20</div>
    </div>
    <h2 className="word20-title">UZRUNA UN UZRUNAS GRUPA <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Обращение и группа обращения)</span></h2>
    <div className="word20-flex-table" id="word20-table">
      <div className="word20-header-row">
        <div>Uzruna<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Обращение)</small></div>
        <div>Uzrunas grupa<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Группа обращения)</small></div>
      </div>
      <div id="word20-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word20-row"><div className="word20-cell">
      <span className="word20-example">Vārds, ar kuru teikumā uzrunā kādu personu, retāk – priekšmetu vai parādību.</span>
      <span className="word20-example">Uzruna vienmēr ir vokatīvā.</span>
    </div><div className="word20-cell">
      <span className="word20-example">Vārdu, ar kuru teikumā uzrunā kādu personu, priekšmetu vai parādību, raksturo kāds cits patstāvīgs vārds.</span>
    </div></div><div className="word20-row"><div className="word20-cell">
      <span className="word20-example">Jāni!</span>
      <span className="word20-example">Marija!</span>
      <span className="word20-example">Jāni Anderson!</span>
      <span className="word20-example">draugs!</span>
      <span className="word20-example">māt!</span>
      <span className="word20-example">kaķīti!</span>
    </div><div className="word20-cell">
      <span className="word20-example">Dārgais draugs!</span>
      <span className="word20-example">Hokeja fani!</span>
      <span className="word20-example">Mīļā māte Zeme!</span>
      <span className="word20-example">Cienījamie klienti!</span>
    </div></div><div className="word20-spanning-header">Uzrunu un uzrunas grupu teikumā atdala ar komatu.</div><div className="word20-row"><div className="word20-cell"><span className="word20-example">Šodien, kolēģi, mums sapulcē ir vairāki svarīgi jautājumi!</span></div><div className="word20-cell"><span className="word20-example">Šodien, cienījamie kolēģi, mums sapulcē ir vairāki svarīgi jautājumi!</span></div></div><div className="word20-row"><div className="word20-cell"><span className="word20-example">Marija, kad beidzot tu atbrauksi pie mums ciemos?</span></div><div className="word20-cell"><span className="word20-example">Priecāšos, dārgais draugs, tevi atkal satikt Latvijā!</span></div></div><div className="word20-row"><div className="word20-cell"><span className="word20-example">Jāni Anderson, ienāciet, lūdzu, pie manis kabinetā uz pārrunām!</span></div><div className="word20-cell"><span className="word20-example">Aicinu jūs, hokeja fani, visus šodien sagaidīt Latvijas izlasi lidostā!</span></div></div><div className="word20-row"><div className="word20-cell"><span className="word20-example">Ko tu, draugs, domā darīt pēc skolas beigšanas?</span></div><div className="word20-cell"><span className="word20-example">Cienījamie klienti, ievērojiet klusumu!</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word20-table-image-container" style={{marginTop: '8px'}}>
        <div className="word20-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word20-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word20-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



