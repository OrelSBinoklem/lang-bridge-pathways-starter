import TableCard from '../../TableCard.jsx';
import './TableWord1.css';
export default function TableWord1() {
  return (
    <TableCard>
      <div className="card table-word1" id="word1-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word1-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD1</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'center', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>VĀRDA SASTĀVS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Состав слова)</span></h2>
    </div>
    <p style={{margin: '0 0 12px 12px', color: '#333'}}>Latviešu valodā vārdiem ir sakne un galotne. Tiem var būt arī priedēklis un piedēklis.</p>
    <div className="word1-flex-table" id="word1-table">
      <div className="word1-header">
        <div>Vārda sastāvdaļas<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Компоненты слова)</small></div>
        <div>Raksturojums<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Описание)</small></div>
        <div>Piemērs<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Пример)</small></div>
      </div>
      <div id="word1-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word1-row"><div className="word1-cell">Sakne</div><div className="word1-cell">Vārda daļa, kas ir kopīga radniecīgu vārdu saimei. Šī kopība izpaužas vārda leksiskās nozīmes ziņā. Sakne ir obligāta vārda sastāvdaļa. Vārdiem var būt vairākas saknes.</div><div className="word1-cell">valde, valdīt, pārvaldīt, valdnieks, valdība, pārvalde, pārvaldnieks</div></div><div className="word1-row"><div className="word1-cell">Galotne</div><div className="word1-cell">Vārda daļa, kas atrodas vārda beigās un, vārdu lokot, mainās.</div><div className="word1-cell">saulespuķes<br />kok-<span className="word1-ending">s</span>, kok-<span className="word1-ending">a</span>, kok-<span className="word1-ending">am</span>, kok-<span className="word1-ending">u</span>, kok-<span className="word1-ending">ā</span></div></div><div className="word1-row"><div className="word1-cell">Priedēklis</div><div className="word1-cell">Vārda daļa, kas atrodas saknes priekšā. Vārdiem var būt vairāki priedēkļi.</div><div className="word1-cell"><span className="word1-prefix">pa</span>-saule, <span className="word1-prefix">aiz</span>-krāsne, <span className="word1-prefix">ie</span>-pa-tikties, <span className="word1-prefix">jā</span>-no-raksta</div></div><div className="word1-row"><div className="word1-cell">Piedēklis</div><div className="word1-cell">Vārda daļa, kas atrodas starp sakni un galotni. Vārdiem var būt vairāki piedēkļi.</div><div className="word1-cell">dej-<span className="word1-suffix">o</span>-t, skol-<span className="word1-suffix">niek</span>-s, run-<span className="word1-suffix">ā</span>-<span className="word1-suffix">j</span>-a</div></div><div className="word1-row"><div className="word1-cell">Celms</div><div className="word1-cell">Viss vārds bez galotnes.</div><div className="word1-cell">strādniek-<span className="word1-ending">s</span>, pasaul-<span className="word1-ending">e</span></div></div><div className="word1-row"><div className="word1-cell">Izskaņa</div><div className="word1-cell">Vārda daļa, kurā ietilpst vārda pēdējais piedēklis kopā ar galotni.</div><div className="word1-cell"><span className="word1-suffix">strād</span>-<span className="word1-ending">nieks</span>, <span className="word1-suffix">soļo</span>-<span className="word1-ending">tājs</span>, <span className="word1-suffix">aizzīmog</span>-<span className="word1-ending">ot</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word1-table-image-container" style={{marginTop: '8px'}}>
        <div className="word1-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word1-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word1-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



