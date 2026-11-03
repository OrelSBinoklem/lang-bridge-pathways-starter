import TableCard from '../../TableCard.jsx';
import './TableWord10.css';
export default function TableWord10() {
  return (
    <TableCard>
      <div className="card table-word10" id="word10-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word10-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD10</div>
      <h2 className="word10-title" style={{margin: 0, flex: 1, textAlign: 'center'}}>DECIMĀLDAĻSKAITĻI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Десятичные дроби)</span></h2>
    </div>
    <div className="word10-content" id="word10-content">
      {/* Заполняется через JavaScript */}
    <p className="word10-paragraph" style={{marginTop: '0px'}}>Decimāldaļskaitļi ir tādi skaitļi, kam parasti aiz komata seko citi cipari.</p><p className="word10-paragraph">Parasti tos raksta ar cipariem.</p><p className="word10-paragraph">Tie ir tādi skaitļi, ko veido pamata skaitļa vārds veselā skaitļa nosaukšanai, komats un pamata skaitļa vārds daļu nosaukšanai, piemēram, 3,5.</p><p className="word10-paragraph">Ja tos pieraksta ar vārdiem, lietvārdu komats liek komatos, piemēram, 20,35 – divdesmit, komats, trīsdesmit pieci.</p></div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word10-table-image-container" style={{marginTop: '8px'}}>
        <div className="word10-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word10-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word10-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



