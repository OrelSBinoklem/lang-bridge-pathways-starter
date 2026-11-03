import TableCard from '../../TableCard.jsx';
import './TableV66.css';
export default function TableV66() {
  return (
    <TableCard>
      <div className="card table-v66" id="v66-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v66-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V66</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Lokāmais darāmās kārtas tagadnes divdabis (-ošs, -oša) <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Склоняемое причастие действительного залога настоящего времени)</span></h2>
    </div>
    <div className="v66-flex-table" id="v66-table">
      <div className="v66-header">
        <div>Īstenības izteiksmes tagadnes 1. persona<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Изъявительное наклонение, настоящее время, 1-е лицо)</small></div>
        <div style={{flex: 2}}>Divdabis (tiek lietota nenoteiktā un noteiktā galotne)<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Причастие (используются неопределенные и определенные окончания))</small></div>
      </div>
      <div className="v66-subheader">
        <div></div>
        <div style={{flex: 1}}>Vienskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Единственное число)</small></div>
        <div style={{flex: 1}}>Daudzskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Множественное число)</small></div>
      </div>
      <div id="v66-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v66-row"><div className="v66-cell">top-u</div><div className="v66-cell">top+<span className="v66-ending-masc">ošs</span>, top+<span className="v66-ending-fem">oša</span></div><div className="v66-cell">top+<span className="v66-ending-masc">oši</span>, top+<span className="v66-ending-fem">ošas</span></div></div><div className="v66-row"><div className="v66-cell"></div><div className="v66-cell">top+<span className="v66-ending-masc">ošais</span>, top+<span className="v66-ending-fem">ošā</span></div><div className="v66-cell">top+<span className="v66-ending-masc">ošie</span>, top+<span className="v66-ending-fem">ošās</span></div></div><div className="v66-row"><div className="v66-cell">zin-u</div><div className="v66-cell">zin+<span className="v66-ending-masc">ošs</span>, zin+<span className="v66-ending-fem">oša</span></div><div className="v66-cell">zin+<span className="v66-ending-masc">oši</span>, zin+<span className="v66-ending-fem">ošas</span></div></div><div className="v66-row"><div className="v66-cell"></div><div className="v66-cell">zin+<span className="v66-ending-masc">ošais</span>, zin+<span className="v66-ending-fem">ošā</span></div><div className="v66-cell">zin+<span className="v66-ending-masc">ošie</span>, zin+<span className="v66-ending-fem">ošās</span></div></div><div className="v66-row"><div className="v66-cell">rakst-u</div><div className="v66-cell">rakst+<span className="v66-ending-masc">ošs</span>, rakst+<span className="v66-ending-fem">oša</span></div><div className="v66-cell">rakst+<span className="v66-ending-masc">oši</span>, rakst+<span className="v66-ending-fem">ošas</span></div></div><div className="v66-row"><div className="v66-cell"></div><div className="v66-cell">rakst+<span className="v66-ending-masc">ošais</span>, rakst+<span className="v66-ending-fem">ošā</span></div><div className="v66-cell">rakst+<span className="v66-ending-masc">ošie</span>, rakst+<span className="v66-ending-fem">ošās</span></div></div><div className="v66-row"><div className="v66-cell">smaid-u</div><div className="v66-cell">smaid+<span className="v66-ending-masc">ošs</span>, smaid+<span className="v66-ending-fem">oša</span></div><div className="v66-cell">smaid+<span className="v66-ending-masc">oši</span>, smaid+<span className="v66-ending-fem">ošas</span></div></div><div className="v66-row"><div className="v66-cell"></div><div className="v66-cell">smaid+<span className="v66-ending-masc">ošais</span>, smaid+<span className="v66-ending-fem">ošā</span></div><div className="v66-cell">smaid+<span className="v66-ending-masc">ošie</span>, smaid+<span className="v66-ending-fem">ošās</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v66-table-image-container" style={{marginTop: '8px'}}>
        <div className="v66-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v66-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v66-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



