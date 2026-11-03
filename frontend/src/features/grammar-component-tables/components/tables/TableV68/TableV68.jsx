import TableCard from '../../TableCard.jsx';
import './TableV68.css';
export default function TableV68() {
  return (
    <TableCard>
      <div className="card table-v68" id="v68-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v68-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V68</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Lokāmais ciešamās kārtas tagadnes divdabis (-ams, -ama, -āms, -āma) <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Склоняемое причастие страдательного залога настоящего времени)</span></h2>
    </div>
    <div className="v68-flex-table" id="v68-table">
      <div className="v68-header">
        <div>Īstenības izteiksmes tagadnes 1. persona<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Изъявительное наклонение, настоящее время, 1-е лицо)</small></div>
        <div style={{flex: 2}}>Divdabis (tiek lietota nenoteiktā un noteiktā galotne)<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Причастие (используются неопределенные и определенные окончания))</small></div>
      </div>
      <div className="v68-subheader">
        <div></div>
        <div style={{flex: 1}}>Vienskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Единственное число)</small></div>
        <div style={{flex: 1}}>Daudzskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Множественное число)</small></div>
      </div>
      <div id="v68-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v68-row"><div className="v68-cell">ved-u</div><div className="v68-cell">ved+<span className="v68-ending-masc">ams</span>, ved+<span className="v68-ending-fem">ama</span></div><div className="v68-cell">ved+<span className="v68-ending-masc">ami</span>, ved+<span className="v68-ending-fem">amas</span></div></div><div className="v68-row"><div className="v68-cell"></div><div className="v68-cell">ved+<span className="v68-ending-masc">amais</span>, ved+<span className="v68-ending-fem">amā</span></div><div className="v68-cell">ved+<span className="v68-ending-masc">amie</span>, ved+<span className="v68-ending-fem">amās</span></div></div><div className="v68-row"><div className="v68-cell">skat-os</div><div className="v68-cell">skat+<span className="v68-ending-masc">āms</span>, skat+<span className="v68-ending-fem">āma</span></div><div className="v68-cell">skat+<span className="v68-ending-masc">āmi</span>, skat+<span className="v68-ending-fem">āmas</span></div></div><div className="v68-row"><div className="v68-cell"></div><div className="v68-cell">skat+<span className="v68-ending-masc">āmais</span>, skat+<span className="v68-ending-fem">āmā</span></div><div className="v68-cell">skat+<span className="v68-ending-masc">āmie</span>, skat+<span className="v68-ending-fem">āmās</span></div></div><div className="v68-row"><div className="v68-cell">atbild-u</div><div className="v68-cell">atbild+<span className="v68-ending-masc">ams</span>, atbild+<span className="v68-ending-fem">ama</span></div><div className="v68-cell">atbild+<span className="v68-ending-masc">ami</span>, atbild+<span className="v68-ending-fem">amas</span></div></div><div className="v68-row"><div className="v68-cell"></div><div className="v68-cell">atbild+<span className="v68-ending-masc">amais</span>, atbild+<span className="v68-ending-fem">amā</span></div><div className="v68-cell">atbild+<span className="v68-ending-masc">amie</span>, atbild+<span className="v68-ending-fem">amās</span></div></div><div className="v68-row"><div className="v68-cell">las-u</div><div className="v68-cell">las+<span className="v68-ending-masc">āms</span>, las+<span className="v68-ending-fem">āma</span></div><div className="v68-cell">las+<span className="v68-ending-masc">āmi</span>, las+<span className="v68-ending-fem">āmas</span></div></div><div className="v68-row"><div className="v68-cell"></div><div className="v68-cell">las+<span className="v68-ending-masc">āmais</span>, las+<span className="v68-ending-fem">āmā</span></div><div className="v68-cell">las+<span className="v68-ending-masc">āmie</span>, las+<span className="v68-ending-fem">āmās</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v68-table-image-container" style={{marginTop: '8px'}}>
        <div className="v68-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v68-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v68-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



