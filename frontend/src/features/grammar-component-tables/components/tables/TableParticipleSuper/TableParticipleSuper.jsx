import TableCard from '../../TableCard.jsx';
import './TableParticipleSuper.css';
export default function TableParticipleSuper() {
  return (
    <TableCard>
      <div className="card table-participle-super" id="participle-super-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left'}}>ПРИЧАСТИЯ <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Divdabji)</span></h2>
    </div>
    <div className="participle-super-flex-table" id="participle-super-table">
      <div className="participle-super-header">
        <div>Тип причастия<br /><small style={{fontWeight: 'normal', color: 'var(--text)', opacity: '0.8'}}>(Divdabja veids)</small></div>
        <div>Базовая форма<br /><small style={{fontWeight: 'normal', color: 'var(--text)', opacity: '0.8'}}>(Pamatforma)</small></div>
        <div style={{flex: 2}}>Причастие (неопределенное и определенное)<br /><small style={{fontWeight: 'normal', color: 'var(--text)', opacity: '0.8'}}>(Divdabis (nenoteiktā un noteiktā galotne))</small></div>
      </div>
      <div className="participle-super-subheader">
        <div></div>
        <div></div>
        <div style={{flex: 1}}>Vienskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--text)', opacity: '0.8'}}>(Единственное число)</small></div>
        <div style={{flex: 1}}>Daudzskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--text)', opacity: '0.8'}}>(Множественное число)</small></div>
      </div>
      <div id="participle-super-table-body">
        {/* Заполняется через JavaScript */}
      <div className="participle-super-row participle-super-section-header"><div className="participle-super-cell"><small style={{fontWeight: 'normal', color: 'var(--muted)', fontSize: '0.85rem'}}>Действ. залог, наст. время</small></div><div className="participle-super-cell">top-u</div><div className="participle-super-cell">top+<span className="participle-super-ending-masc">ošs</span>, top+<span className="participle-super-ending-fem">oša</span><br />top+<span className="participle-super-ending-masc">ošais</span>, top+<span className="participle-super-ending-fem">ošā</span></div><div className="participle-super-cell">top+<span className="participle-super-ending-masc">oši</span>, top+<span className="participle-super-ending-fem">ošas</span><br />top+<span className="participle-super-ending-masc">ošie</span>, top+<span className="participle-super-ending-fem">ošās</span></div></div><div className="participle-super-row participle-super-section-header"><div className="participle-super-cell"><small style={{fontWeight: 'normal', color: 'var(--muted)', fontSize: '0.85rem'}}>Действ. залог, прош. время</small></div><div className="participle-super-cell">nes-u</div><div className="participle-super-cell">nes+<span className="participle-super-ending-masc">is</span>, nes+<span className="participle-super-ending-fem">usi</span></div><div className="participle-super-cell">nes+<span className="participle-super-ending-masc">uši</span>, nes+<span className="participle-super-ending-fem">ušas</span></div></div><div className="participle-super-row"><div className="participle-super-cell"></div><div className="participle-super-cell">skatīj-os</div><div className="participle-super-cell">skatīj+<span className="participle-super-ending-masc">ies</span>, skatīj+<span className="participle-super-ending-fem">usies</span></div><div className="participle-super-cell">skatīj+<span className="participle-super-ending-masc">ušies</span>, skatīj+<span className="participle-super-ending-fem">ušās</span></div></div><div className="participle-super-row participle-super-section-header"><div className="participle-super-cell"><small style={{fontWeight: 'normal', color: 'var(--muted)', fontSize: '0.85rem'}}>Страдат. залог, наст. время</small></div><div className="participle-super-cell">ved-u</div><div className="participle-super-cell">ved+<span className="participle-super-ending-masc">ams</span>, ved+<span className="participle-super-ending-fem">ama</span><br />ved+<span className="participle-super-ending-masc">amais</span>, ved+<span className="participle-super-ending-fem">amā</span></div><div className="participle-super-cell">ved+<span className="participle-super-ending-masc">ami</span>, ved+<span className="participle-super-ending-fem">amas</span><br />ved+<span className="participle-super-ending-masc">amie</span>, ved+<span className="participle-super-ending-fem">amās</span></div></div><div className="participle-super-row"><div className="participle-super-cell"></div><div className="participle-super-cell">skat-os</div><div className="participle-super-cell">skat+<span className="participle-super-ending-masc">āms</span>, skat+<span className="participle-super-ending-fem">āma</span><br />skat+<span className="participle-super-ending-masc">āmais</span>, skat+<span className="participle-super-ending-fem">āmā</span></div><div className="participle-super-cell">skat+<span className="participle-super-ending-masc">āmi</span>, skat+<span className="participle-super-ending-fem">āmas</span><br />skat+<span className="participle-super-ending-masc">āmie</span>, skat+<span className="participle-super-ending-fem">āmās</span></div></div><div className="participle-super-row"><div className="participle-super-cell"></div><div className="participle-super-cell">las-u</div><div className="participle-super-cell">las+<span className="participle-super-ending-masc">āms</span>, las+<span className="participle-super-ending-fem">āma</span><br />las+<span className="participle-super-ending-masc">āmais</span>, las+<span className="participle-super-ending-fem">āmā</span></div><div className="participle-super-cell">las+<span className="participle-super-ending-masc">āmi</span>, las+<span className="participle-super-ending-fem">āmas</span><br />las+<span className="participle-super-ending-masc">āmie</span>, las+<span className="participle-super-ending-fem">āmās</span></div></div><div className="participle-super-row participle-super-section-header"><div className="participle-super-cell"><small style={{fontWeight: 'normal', color: 'var(--muted)', fontSize: '0.85rem'}}>Страдат. залог, прош. время</small></div><div className="participle-super-cell">lasi-t</div><div className="participle-super-cell">lasī+<span className="participle-super-ending-masc">ts</span>, lasī+<span className="participle-super-ending-fem">ta</span><br />lasī+<span className="participle-super-ending-masc">tais</span>, lasī+<span className="participle-super-ending-fem">tā</span></div><div className="participle-super-cell">lasī+<span className="participle-super-ending-masc">ti</span>, lasī+<span className="participle-super-ending-fem">tas</span><br />lasī+<span className="participle-super-ending-masc">tie</span>, lasī+<span className="participle-super-ending-fem">tās</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="participle-super-table-image-container" style={{marginTop: '8px'}}>
        <div className="participle-super-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="participle-super-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn participle-super-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



