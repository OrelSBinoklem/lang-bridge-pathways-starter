import TableCard from '../../TableCard.jsx';
import './TableWord21.css';
export default function TableWord21() {
  return (
    <TableCard>
      <div className="card table-word21" id="word21-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word21-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD21</div>
    </div>
    <h2 className="word21-title">UZRUNAS FORMAS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Формы обращения)</span></h2>
    <p className="word21-text">Latviešu valodā kā uzrunas formā izmanto dažādus locījumus. Tas var būt gan vokatīvs (lietvārdam, arī lietvārda funkcijā lietotam īpašības vārdam vai lokāmajam divdabim), gan nominatīvs, gan akuzatīvs (2. un 3. deklinācijas lietvārdiem, galvenokārt sarunvalodā).</p>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word21-table-image-container" style={{marginTop: '8px'}}>
        <div className="word21-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word21-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word21-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



