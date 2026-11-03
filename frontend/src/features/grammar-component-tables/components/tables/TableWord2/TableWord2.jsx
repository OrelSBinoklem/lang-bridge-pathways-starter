import TableCard from '../../TableCard.jsx';
import './TableWord2.css';
export default function TableWord2() {
  return (
    <TableCard>
      <div className="card table-word2" id="word2-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word2-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD2</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'center', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>Vārdi var būt <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Слова могут быть)</span></h2>
    </div>
    <div className="word2-flex-table" id="word2-table">
      <div id="word2-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word2-section"><div className="word2-section-header">Pirmatnīgi</div><div className="word2-section-content"><p style={{margin: '0 0 8px 0'}}>Tos veido sakne un galotne.</p><table className="word2-subtable"><thead><tr><th>Sakne</th><th>Galotne</th></tr></thead><tbody><tr><td><span className="word2-root">saul-</span></td><td><span className="word2-ending">-e</span></td></tr><tr><td><span className="word2-root">snieg-</span></td><td><span className="word2-ending">-ties</span></td></tr><tr><td><span className="word2-root">klieg-</span></td><td><span className="word2-ending">-t</span></td></tr></tbody></table></div></div><div className="word2-section"><div className="word2-section-header">Atvasināti</div><div className="word2-section-content"><p style={{margin: '0 0 8px 0'}}>Bez saknes un galotnes vārdiem ir arī priedēklis un / vai piedēklis.</p><table className="word2-subtable"><colgroup><col style={{width: '70px', minWidth: '70px'}} /><col /><col /><col /></colgroup><thead><tr><th>Priedēklis</th><th>Sakne</th><th>Piedēklis</th><th>Galotne</th></tr></thead><tbody><tr><td><span className="word2-prefix">iz-</span></td><td><span className="word2-root">svaid-</span></td><td><span className="word2-suffix">-ī-</span></td><td><span className="word2-ending">-t</span></td></tr><tr><td><span className="word2-prefix">iz-</span></td><td><span className="word2-root">veid-</span></td><td><span className="word2-suffix">-o-</span></td><td><span className="word2-ending">-t</span></td></tr><tr><td><span className="word2-prefix">iz-</span></td><td><span className="word2-root">strād-</span></td><td><span className="word2-suffix">-niek-</span></td><td><span className="word2-ending">-s</span></td></tr><tr><td><span className="word2-prefix">ne-, pār-</span></td><td><span className="word2-root">do-</span></td><td></td><td><span className="word2-ending">-t</span></td></tr><tr><td><span className="word2-prefix">sa-</span></td><td><span className="word2-root">smaid-</span></td><td><span className="word2-suffix">-ī-</span></td><td><span className="word2-ending">-ties</span></td></tr></tbody></table></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word2-table-image-container" style={{marginTop: '8px'}}>
        <div className="word2-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word2-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word2-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



