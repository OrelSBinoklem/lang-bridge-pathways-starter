import TableCard from '../../TableCard.jsx';
import './TableAdv1.css';
export default function TableAdv1() {
  return (
    <TableCard>
      <div className="card table-adv1" id="adv1-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="adv1-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>ADV1</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Apstākļa vārds <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Наречие)</span></h2>
    </div>
    <div className="adv1-flex-table" id="adv1-table">
      <div className="adv1-header">
        <div>Jautājums<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Вопрос)</small></div>
        <div>Apstākļa vārds<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Наречие)</small></div>
      </div>
      <div id="adv1-table-body">
        {/* Заполняется через JavaScript */}
      <div className="adv1-row"><div className="adv1-cell">Kad?</div><div className="adv1-cell">agrāk, agri, aizvakar, atkal, bieži, dažreiz, drīz, jau, kad, nekad, parasti, parīt, joprojām, pašlaik, pašreiz, reizēm, reti, rīt, šobrīd, šodien, šorīt, šovakar, tad, tagad, tikko, tūlīt, vakar, vēlāk, vēlu, vienmēr, pirmdien, otrdien, trešdien, ceturtdien, piektdien, sestdien, svētdien</div></div><div className="adv1-row"><div className="adv1-cell">Kur?</div><div className="adv1-cell">ārā, blakus, citur, iekšā, klāt, kur, pretī, šeit, te, tur, turpat</div></div><div className="adv1-row"><div className="adv1-cell">Kā?</div><div className="adv1-cell">ātri, auksti, brīnišķīgi, diezgan, eleganti, ērti, jauki, jautri, kārtīgi, kopā, labi, labprāt, latviski, lēni, skaisti, slikti</div></div><div className="adv1-row"><div className="adv1-cell">Cik?</div><div className="adv1-cell">apmēram, aptuveni, daudz, diezgan, dārgi, gandrīz, ilgi, ļoti, maz, mazliet, tikpat, vēl</div></div><div className="adv1-row"><div className="adv1-cell">Kāpēc?</div><div className="adv1-cell">tāpēc</div></div><div className="adv1-row"><div className="adv1-cell">Kādēļ?</div><div className="adv1-cell">tādēļ</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="adv1-table-image-container" style={{marginTop: '8px'}}>
        <div className="adv1-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="adv1-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn adv1-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



