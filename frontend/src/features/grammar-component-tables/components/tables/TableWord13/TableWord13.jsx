import TableCard from '../../TableCard.jsx';
import './TableWord13.css';
export default function TableWord13() {
  return (
    <TableCard>
      <div className="card table-word13" id="word13-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word13-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD13</div>
      <div style={{flex: 1, textAlign: 'center'}}>
        <h2 style={{margin: 0, color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '1.3em'}}>APSTĀKĻA VĀRDS</h2>
        <h3 style={{margin: '4px 0 0 0', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '1.1em'}}>APSTĀKĻA VĀRDU VEIDI</h3>
      </div>
    </div>
    <div className="word13-flex-table" id="word13-table">
      <div className="word13-header">
        <div>Veids</div>
        <div>Jautājums</div>
        <div>Apstākļa vārds</div>
      </div>
      <div id="word13-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word13-row"><div className="word13-cell">Laika</div><div className="word13-cell word13-question"><em><strong>Kad?</strong></em></div><div className="word13-cell">agrāk, agri, atkal, bieži, dažreiz, drīz, jau, kad, nekad, parasti, joprojām, pašlaik, pašreiz, reizēm, reti, tad, tikko, tūlīt, vēlāk, vēlu, vienmēr<br />šobrīd, tagad, šorīt, šodien, šovakar, rīt, vakar, parīt, aizvakar<br />pirmdien, otrdien, trešdien, ceturtdien, piektdien, sestdien, svētdien</div></div><div className="word13-row"><div className="word13-cell">Vietas</div><div className="word13-cell word13-question"><em><strong>Kur?</strong></em></div><div className="word13-cell">ārā, iekšā, blakus, citur, klāt, pretī, šeit, te, turpat</div></div><div className="word13-row"><div className="word13-cell">Veida</div><div className="word13-cell word13-question"><em><strong>Kā?</strong></em></div><div className="word13-cell">ātri, lēni, auksti, karsti, brīnišķīgi, eleganti, ērti, jauki, kārtīgi, kopā, labi, latviski, skaisti, slikti, soli pa solim, strauji</div></div><div className="word13-row"><div className="word13-cell">Mēra</div><div className="word13-cell word13-question"><em><strong>Cik?</strong></em><br /><em><strong>Cik lielā mērā?</strong></em></div><div className="word13-cell">cik, tik, maz, daudz, vairāk, mazāk, nemaz, diezgan, drusku, gana, gan-drīz, pavisam, pilnīgi, vienreiz, puslīdz, apmēram, aptuveni, ļoti, mazliet, vēl</div></div><div className="word13-row"><div className="word13-cell">Cēloņa</div><div className="word13-cell word13-question"><em><strong>Kāpēc?</strong></em></div><div className="word13-cell">kāpēc, kādēļ, tāpēc, tādēļ</div></div><div className="word13-row"><div className="word13-cell">Nolūka</div><div className="word13-cell word13-question"><em><strong>Kādēļ?</strong></em><br /><em><strong>Kādam nolūkam?</strong></em></div><div className="word13-cell">tādēļ, tālab</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word13-table-image-container" style={{marginTop: '8px'}}>
        <div className="word13-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word13-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word13-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



