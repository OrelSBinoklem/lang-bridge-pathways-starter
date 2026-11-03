import TableCard from '../../TableCard.jsx';
import './TableWord26.css';
export default function TableWord26() {
  return (
    <TableCard>
      <div className="card table-word26" id="word26-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word26-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD26</div>
    </div>
    <h2 className="word26-title" id="word26-title">DIVDABJA TEICIENS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Причастный оборот)</span></h2>
    <div id="word26-content">
      {/* Заполняется через JavaScript */}
    <p className="word26-definition">Divdabja teiciens ir savrupināta vairāku vārdu grupa, kuras pamatā ir divdabis. Divdabja teicienā ir divdabis un vismaz viens to paskaidrojošs teikuma palīgloceklis.</p><p className="word26-intro">Divdabja teicienu veido šādi divdabji:</p><div className="word26-table-wrapper"><div className="word26-table"><div className="word26-header"><div>Lokāmais darāmās kārtas pagātnes divdabis ar</div><div>Lokāmais ciešamās kārtas pagātnes divdabis ar</div><div>Daļēji lokāmais divdabis ar</div><div>Nelokāmais divdabis ar</div></div><div className="word26-row"><div className="word26-cell"><div className="word26-cell-endings" style={{marginBottom: '12px'}}>-is, -usi, -ies, -usies</div><div className="word26-cell-example">Jau no mazotnes pie tādas dzīves <span className="word26-bold">pieradusi</span>, viņa prata samierināties.</div></div><div className="word26-cell"><div className="word26-cell-endings" style={{marginBottom: '12px'}}>-ts, -ta</div><div className="word26-cell-example">Dusmu <span className="word26-bold">pārņemts</span>, devos viņu virzienā.</div></div><div className="word26-cell"><div className="word26-cell-endings" style={{marginBottom: '12px'}}>-dams, -dama, -damies, -damās</div><div className="word26-cell-example">Bērni, pie zariem <span className="word26-bold">turēdamies</span>, kāpa lejup no kalna.</div></div><div className="word26-cell"><div className="word26-cell-endings" style={{marginBottom: '12px'}}>-ot, -oties</div><div className="word26-cell-example">Saulei <span className="word26-bold">austot</span>, mēs devāmies ceļā.</div></div></div></div></div><div className="word26-punctuation-heading">Divdabju teicienu no pārējā teikuma atdala ar komatiem:</div><div className="word26-rules"><div className="word26-rule">1) ja divdabja teiciens atrodas teikuma sākumā, komatu liek aiz divdabja teiciena;</div><div className="word26-rule">2) ja divdabja teiciens atrodas teikuma beigās, komatu liek pirms divdabja teiciena;</div><div className="word26-rule">3) ja divdabja teiciens atrodas teikuma vidū, komatu liek gan pirms divdabja teiciena, gan aiz divdabja teiciena.</div></div></div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word26-table-image-container" style={{marginTop: '8px'}}>
        <div className="word26-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word26-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word26-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



