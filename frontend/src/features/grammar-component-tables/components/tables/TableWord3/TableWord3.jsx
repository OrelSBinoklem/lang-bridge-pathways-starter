import TableCard from '../../TableCard.jsx';
import './TableWord3.css';
export default function TableWord3() {
  return (
    <TableCard>
      <div className="card table-word3" id="word3-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word3-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD3</div>
      <h2 className="word3-title" style={{margin: 0, flex: 1, textAlign: 'center'}}>AR PRIEDĒKĻIEM ATVASINĀTI DARBĪBAS VĀRDI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Глаголы, образованные с приставками)</span></h2>
    </div>
    <div className="word3-content" id="word3-content">
      {/* Заполняется через JavaScript */}
    <p className="word3-paragraph">Priedēklis maina darbības vārda nozīmi: darbības vārds ar priedēkli nenozīmē to pašu, ko darbības vārds bez priedēkļa, lai gan pamata nozīme parasti ir līdzīga.</p><p className="word3-paragraph">Darbības vārdu priedēkļi ir šādi: <span className="word3-prefix">aiz-</span>, <span className="word3-prefix">ap-</span>, <span className="word3-prefix">at-</span>, <span className="word3-prefix">ie-</span>, <span className="word3-prefix">iz-</span>, <span className="word3-prefix">no-</span>, <span className="word3-prefix">pa-</span>, <span className="word3-prefix">pār-</span>, <span className="word3-prefix">pie-</span>, <span className="word3-prefix">sa-</span>, <span className="word3-prefix">uz-</span>. Ne katrs priedēklis var savienoties ar jebkuru darbības vārdu. Daudzus darbības vārdus lieto ar vairākiem priedēkļiem.</p><p className="word3-paragraph">Darbības vārds ar priedēkli bieži norāda, ka darbība ir pabeigta un tai bijis rezultāts. Pabeigtības nozīme var būt visiem priedēkļiem.</p><div className="word3-examples"><div className="word3-example-item"><span className="word3-verb-base">rakstīt: </span><span>rakstīja → </span><span>uzrakstīja</span>, <span>sarakstīja</span>, <span>pierakstīja</span>, <span>norakstīja</span>, <span>aizrakstīja</span>, <span>atrakstīja</span>, <span>ierakstīja</span>, <span>pārrakstīja</span></div><div className="word3-example-item"><span className="word3-verb-base">sūtīt: </span><span>sūtīja → </span><span>aizsūtīja</span>, <span>izsūtīja</span>, <span>nosūtīja</span>, <span>pasūtīja</span>, <span>pārsūtīja</span></div><div className="word3-example-item"><span className="word3-verb-base">ēst: </span><span>ēda → </span><span>paēda</span>, <span>apēda</span>, <span>izēda</span></div><div className="word3-example-item"><span className="word3-verb-base">stāstīt: </span><span>stāstīja → </span><span>pastāstīja</span>, <span>izstāstīja</span>, <span>pārstāstīja</span></div><div className="word3-example-item"><span className="word3-verb-base">darīt: </span><span>darīja → </span><span>padarīja</span>, <span>izdarīja</span></div><div className="word3-example-item"><span className="word3-verb-base">klausīties: </span><span>klausījās → </span><span>noklausījās</span></div><div className="word3-example-item"><span className="word3-verb-base">skatīties: </span><span>skatījās → </span><span>apskatījās</span>, <span>noskatījās</span></div><div className="word3-example-item"><span className="word3-verb-base">mazgāties: </span><span>mazgājās → </span><span>nomazgājās</span></div><div className="word3-example-item"><span className="word3-verb-base">peldēties: </span><span>peldējās → </span><span>izpeldējās</span>, <span>nopeldējās</span></div></div></div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word3-table-image-container" style={{marginTop: '8px'}}>
        <div className="word3-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word3-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word3-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



