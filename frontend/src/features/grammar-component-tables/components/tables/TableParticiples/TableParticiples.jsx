import TableCard from '../../TableCard.jsx';
import './TableParticiples.css';
export default function TableParticiples() {
  return (
    <TableCard>
      <div className="card table-participles" id="participles-table-container">
    <h2>Lokāmais darāmās kārtas tagadnes divdabis (-ošs, -oša) <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Склоняемое причастие действительного залога настоящего времени)</span></h2>
    <p className="muted">Divdabis (tiek lietota nenoteiktā un noteiktā galotne)</p>
    <div className="participles-flex-table" id="participles-table">
      <div className="participles-header">
        <div style={{width: '25%'}}>Īstenības izteiksmes tagadnes 1. persona</div>
        <div style={{width: '37.5%'}}>Vienskaitlis</div>
        <div style={{width: '37.5%'}}>Daudzskaitlis</div>
      </div>
      <div id="participles-table-body"><div className="participles-row"><div className="participles-cell verb-cell">top-u</div><div className="participles-cell singular-cell"><div className="participle-form">top+<span className="participle-ending-masc">ošs</span></div><div className="participle-form">top+<span className="participle-ending-fem">oša</span></div><div className="participle-form">top+<span className="participle-ending-masc">ošais</span></div><div className="participle-form">top+<span className="participle-ending-fem">ošā</span></div></div><div className="participles-cell plural-cell"><div className="participle-form">top+<span className="participle-ending-masc">oši</span></div><div className="participle-form">top+<span className="participle-ending-fem">ošas</span></div><div className="participle-form">top+<span className="participle-ending-masc">ošie</span></div><div className="participle-form">top+<span className="participle-ending-fem">ošās</span></div></div></div><div className="participles-row"><div className="participles-cell verb-cell">zin-u</div><div className="participles-cell singular-cell"><div className="participle-form">zin+<span className="participle-ending-masc">ošs</span></div><div className="participle-form">zin+<span className="participle-ending-fem">oša</span></div><div className="participle-form">zin+<span className="participle-ending-masc">ošais</span></div><div className="participle-form">zin+<span className="participle-ending-fem">ošā</span></div></div><div className="participles-cell plural-cell"><div className="participle-form">zin+<span className="participle-ending-masc">oši</span></div><div className="participle-form">zin+<span className="participle-ending-fem">ošas</span></div><div className="participle-form">zin+<span className="participle-ending-masc">ošie</span></div><div className="participle-form">zin+<span className="participle-ending-fem">ošās</span></div></div></div><div className="participles-row"><div className="participles-cell verb-cell">rakst-u</div><div className="participles-cell singular-cell"><div className="participle-form">rakst+<span className="participle-ending-masc">ošs</span></div><div className="participle-form">rakst+<span className="participle-ending-fem">oša</span></div><div className="participle-form">rakst+<span className="participle-ending-masc">ošais</span></div><div className="participle-form">rakst+<span className="participle-ending-fem">ošā</span></div></div><div className="participles-cell plural-cell"><div className="participle-form">rakst+<span className="participle-ending-masc">oši</span></div><div className="participle-form">rakst+<span className="participle-ending-fem">ošas</span></div><div className="participle-form">rakst+<span className="participle-ending-masc">ošie</span></div><div className="participle-form">rakst+<span className="participle-ending-fem">ošās</span></div></div></div><div className="participles-row"><div className="participles-cell verb-cell">smaid-u</div><div className="participles-cell singular-cell"><div className="participle-form">smaid+<span className="participle-ending-masc">ošs</span></div><div className="participle-form">smaid+<span className="participle-ending-fem">oša</span></div><div className="participle-form">smaid+<span className="participle-ending-masc">ošais</span></div><div className="participle-form">smaid+<span className="participle-ending-fem">ošā</span></div></div><div className="participles-cell plural-cell"><div className="participle-form">smaid+<span className="participle-ending-masc">oši</span></div><div className="participle-form">smaid+<span className="participle-ending-fem">ošas</span></div><div className="participle-form">smaid+<span className="participle-ending-masc">ošie</span></div><div className="participle-form">smaid+<span className="participle-ending-fem">ošās</span></div></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="participle-table-image-container" style={{marginTop: '8px'}}>
        <div className="participle-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="participle-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn participle-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



