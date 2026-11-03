import TableCard from '../../TableCard.jsx';
import './TableWord9.css';
export default function TableWord9() {
  return (
    <TableCard>
      <div className="card table-word9" id="word9-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word9-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD9</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'center', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>GADSKAITĻU LOCĪŠANA <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Склонение числительных)</span></h2>
    </div>
    <div id="word9-tables">
      {/* Заполняется через JavaScript */}
    <div className="word9-subtable"><p style={{margin: '0px 0px 8px 12px', fontWeight: 600}}>1998. gads</p><div className="word9-flex-table"><div className="word9-header">
        <div>Jautājums<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Вопрос)</small></div>
        <div>Skaitlis</div>
        <div>Teksts</div>
      </div><div><div className="word9-row"><div className="word9-cell">Kas?</div><div className="word9-cell">1998. gads</div><div className="word9-cell">tūkstoš deviņi simti / deviņsimt deviņdesmit astot-<span className="word9-ending">ais</span> gads</div></div><div className="word9-row"><div className="word9-cell">Kā?</div><div className="word9-cell">1998. gada</div><div className="word9-cell">tūkstoš deviņi simti / deviņsimt deviņdesmit astot-<span className="word9-ending">ā</span> gada</div></div><div className="word9-row"><div className="word9-cell">Kam?</div><div className="word9-cell">1998. gadam</div><div className="word9-cell">tūkstoš deviņi simti / deviņsimt deviņdesmit astot-<span className="word9-ending">ajam</span> gadam</div></div><div className="word9-row"><div className="word9-cell">Ko?</div><div className="word9-cell">1998. gadu</div><div className="word9-cell">tūkstoš deviņi simti / deviņsimt deviņdesmit astot-<span className="word9-ending">o</span> gadu</div></div><div className="word9-row"><div className="word9-cell">Kur?</div><div className="word9-cell">1998. gadā</div><div className="word9-cell">tūkstoš deviņi simti / deviņsimt deviņdesmit astot-<span className="word9-ending">ajā</span> gadā</div></div></div></div></div><div className="word9-subtable"><p style={{margin: '0px 0px 8px 12px', fontWeight: 600}}>2020. gada 1. marts</p><div className="word9-flex-table"><div className="word9-header">
        <div>Jautājums<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Вопрос)</small></div>
        <div>Skaitlis</div>
        <div>Teksts</div>
      </div><div><div className="word9-row"><div className="word9-cell">Kas?</div><div className="word9-cell">2020. gada 1. marts</div><div className="word9-cell">divi tūkstoši / divtūkstoš divdesmit-<span className="word9-ending">ā</span> gada pirm-<span className="word9-ending">ais</span> marts</div></div><div className="word9-row"><div className="word9-cell">Kā?</div><div className="word9-cell">2020. gada 1. marta</div><div className="word9-cell">divi tūkstoši / divtūkstoš divdesmit-<span className="word9-ending">ā</span> gada pirm-<span className="word9-ending">ā</span> marta</div></div><div className="word9-row"><div className="word9-cell">Kam?</div><div className="word9-cell">2020. gada 1. martam</div><div className="word9-cell">divi tūkstoši / divtūkstoš divdesmit-<span className="word9-ending">ā</span> gada pirm-<span className="word9-ending">ajam</span> martam</div></div><div className="word9-row"><div className="word9-cell">Ko?</div><div className="word9-cell">2020. gada 1. martu</div><div className="word9-cell">divi tūkstoši / divtūkstoš divdesmit-<span className="word9-ending">ā</span> gada pirm-<span className="word9-ending">o</span> martu</div></div><div className="word9-row"><div className="word9-cell">Kur?</div><div className="word9-cell">2020. gada 1. martā</div><div className="word9-cell">divi tūkstoši / divtūkstoš divdesmit-<span className="word9-ending">ā</span> gada pirm-<span className="word9-ending">ajā</span> martā</div></div></div></div></div></div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word9-table-image-container" style={{marginTop: '8px'}}>
        <div className="word9-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word9-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word9-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



