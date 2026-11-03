import TableCard from '../../TableCard.jsx';
import './TableWord16.css';
export default function TableWord16() {
  return (
    <TableCard>
      <div className="card table-word16" id="word16-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word16-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD16</div>
    </div>
    <h2 className="word16-title">TEIKUMS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Предложение)</span></h2>
    <h3 className="word16-subtitle">TEIKUMU IEDALĪJUMS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Классификация предложений)</span></h3>
    <div className="word16-flex-table" id="word16-table">
      <div className="word16-header-row">
        <div>Vienkārši teikumi<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Простые предложения)</small></div>
        <div>Salikti teikumi<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Сложные предложения)</small></div>
      </div>
      <div className="word16-subheader-row">
        <div></div>
        <div>Salikts sakārtots teikums<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Сложносочиненное предложение)</small></div>
        <div>Salikts pakārtots teikums<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Сложноподчиненное предложение)</small></div>
      </div>
      <div id="word16-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word16-content-row"><div className="word16-cell">
      <span className="word16-example">Laiks kļūst siltāks.</span>
      <span className="word16-example">Saule silda.</span>
    </div><div className="word16-cell">
      <span className="word16-example">Saule silda, un laiks kļūst siltāks.</span>
      <span className="word16-example">Saule silda, laiks kļūst siltāks.</span>
    </div><div className="word16-cell">
      <span className="word16-example">Laiks kļūst siltāks, jo silda saule.</span>
      <span className="word16-example">Tā kā silda saule, laiks kļūst siltāks.</span>
    </div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word16-table-image-container" style={{marginTop: '8px'}}>
        <div className="word16-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word16-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word16-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



