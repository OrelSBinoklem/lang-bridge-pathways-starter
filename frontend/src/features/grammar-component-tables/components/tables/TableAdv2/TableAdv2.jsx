import TableCard from '../../TableCard.jsx';
import './TableAdv2.css';
export default function TableAdv2() {
  return (
    <TableCard>
      <div className="card table-adv2" id="adv2-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="adv2-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>ADV2</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>SALĪDZINĀMĀS PAKĀPES <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Степени сравнения)</span></h2>
    </div>
    <div className="adv2-flex-table" id="adv2-table">
      <div className="adv2-header">
        <div>Pamata pakāpe<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Положительная степень)</small></div>
        <div>Pārākā pakāpe<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Сравнительная степень)</small></div>
        <div>Vispārākā pakāpe<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Превосходная степень)</small></div>
      </div>
      <div id="adv2-table-body">
        {/* Заполняется через JavaScript */}
      <div className="adv2-row"><div className="adv2-cell">labi</div><div className="adv2-cell">lab-<span className="adv2-suffix-ak">-āk</span></div><div className="adv2-cell"><span className="adv2-prefix-vis">vis-</span>lab-<span className="adv2-suffix-ak">-āk</span></div></div><div className="adv2-row"><div className="adv2-cell">auksti</div><div className="adv2-cell">aukst-<span className="adv2-suffix-ak">-āk</span></div><div className="adv2-cell"><span className="adv2-prefix-vis">vis-</span>aukst-<span className="adv2-suffix-ak">-āk</span></div></div><div className="adv2-row"><div className="adv2-cell">dārgi</div><div className="adv2-cell">dārg-<span className="adv2-suffix-ak">-āk</span></div><div className="adv2-cell"><span className="adv2-prefix-vis">vis-</span>dārg-<span className="adv2-suffix-ak">-āk</span></div></div><div className="adv2-row"><div className="adv2-cell">ilgi</div><div className="adv2-cell">ilg-<span className="adv2-suffix-ak">-āk</span></div><div className="adv2-cell"><span className="adv2-prefix-vis">vis-</span>ilg-<span className="adv2-suffix-ak">-āk</span></div></div><div className="adv2-row"><div className="adv2-cell">ātri</div><div className="adv2-cell">ātr-<span className="adv2-suffix-ak">-āk</span></div><div className="adv2-cell"><span className="adv2-prefix-vis">vis-</span>ātr-<span className="adv2-suffix-ak">-āk</span></div></div><div className="adv2-row"><div className="adv2-cell">daudz</div><div className="adv2-cell">vair-<span className="adv2-suffix-ak">-āk</span></div><div className="adv2-cell"><span className="adv2-prefix-vis">vis-</span>vair-<span className="adv2-suffix-ak">-āk</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="adv2-table-image-container" style={{marginTop: '8px'}}>
        <div className="adv2-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="adv2-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn adv2-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



