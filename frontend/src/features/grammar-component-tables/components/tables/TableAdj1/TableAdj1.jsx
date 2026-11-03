import TableCard from '../../TableCard.jsx';
import './TableAdj1.css';
export default function TableAdj1() {
  return (
    <TableCard>
      <div className="card table-adj1" id="adj1-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="adj1-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>ADJ1</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>I. DEKLINĀCIJAS ĪPAŠĪBAS VĀRDS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Прилагательные I склонения)</span></h2>
    </div>
    <div className="adj1-flex-table" id="adj1-table">
      {/* Секция Vienskaitlis */}
      <div className="adj1-section">
        <div className="adj1-header">
          <div style={{width: '100px'}}>Jautājums</div>
          <div style={{flex: 1, textAlign: 'center', fontWeight: 600}}>Vienskaitlis</div>
        </div>
        <div className="adj1-header-sub">
          <div style={{width: '100px'}}></div>
          <div style={{flex: 1, display: 'flex'}}>
            <div style={{flex: 1, textAlign: 'center', padding: '4px', borderRight: '1px solid var(--border-strong)', fontWeight: 600}}>Vīriešu dzimte</div>
            <div style={{flex: 1, textAlign: 'center', padding: '4px', fontWeight: 600}}>Sieviešu dzimte</div>
          </div>
        </div>
        <div id="adj1-table-body-singular"><div className="adj1-row"><div className="adj1-cell jautajums-cell">Kas?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">s</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēvs</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brālis</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgus</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">a</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsa</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māte</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivs</div></div><div className="adj1-row"><div className="adj1-cell jautajums-cell">Kā?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">a</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēva</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brāļa</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgus</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">as</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsas</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>mātes</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivs</div></div><div className="adj1-row"><div className="adj1-cell jautajums-cell">Kam?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">am</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēvam</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brālim</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgum</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">ai</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsai</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>mātei</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivij</div></div><div className="adj1-row"><div className="adj1-cell jautajums-cell">Ko?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">u</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēvu</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brāli</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgu</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">u</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsu</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māti</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivi</div></div><div className="adj1-row"><div className="adj1-cell jautajums-cell">Kur?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">ā</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēvā</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brālī</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgū</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">ā</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsā</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>mātē</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivī</div></div></div>
      </div>
      {/* Секция Daudzskaitlis */}
      <div className="adj1-section">
        <div className="adj1-header">
          <div style={{width: '100px'}}>Jautājums</div>
          <div style={{flex: 1, textAlign: 'center', fontWeight: 600}}>Daudzskaitlis</div>
        </div>
        <div className="adj1-header-sub">
          <div style={{width: '100px'}}></div>
          <div style={{flex: 1, display: 'flex'}}>
            <div style={{flex: 1, textAlign: 'center', padding: '4px', borderRight: '1px solid var(--border-strong)', fontWeight: 600}}>Vīriešu dzimte</div>
            <div style={{flex: 1, textAlign: 'center', padding: '4px', fontWeight: 600}}>Sieviešu dzimte</div>
          </div>
        </div>
        <div id="adj1-table-body-plural"><div className="adj1-row"><div className="adj1-cell jautajums-cell">Kas?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">i</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēvi</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brāļi</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgi</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">as</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsas</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>mātes</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivis</div></div><div className="adj1-row"><div className="adj1-cell jautajums-cell">Kā?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">u</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēvu</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brāļu</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgu</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">u</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsu</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māšu</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivju</div></div><div className="adj1-row"><div className="adj1-cell jautajums-cell">Kam?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">iem</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēviem</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brāļiem</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgiem</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">ām</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsām</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>mātēm</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivīm</div></div><div className="adj1-row"><div className="adj1-cell jautajums-cell">Ko?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">us</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēvus</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brāļus</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgus</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">as</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsas</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>mātes</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivis</div></div><div className="adj1-row"><div className="adj1-cell jautajums-cell">Kur?</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-masc">os</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tēvos</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>brāļos</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>tirgos</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>lab<span className="adj1-ending-fem">ās</span></div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>māsās</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>mātēs</div><div className="adj1-cell" style={{flex: '0.5 1 0%'}}>zivīs</div></div></div>
      </div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="adj1-table-image-container" style={{marginTop: '8px'}}>
        <div className="adj1-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="adj1-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn adj1-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



