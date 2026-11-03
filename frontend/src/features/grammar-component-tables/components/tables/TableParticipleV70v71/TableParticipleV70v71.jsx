import TableCard from '../../TableCard.jsx';
import './TableParticipleV70v71.css';
export default function TableParticipleV70v71() {
  return (
    <TableCard>
      <div className="card table-participle-v70v71" id="participle-v70v71-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left'}}>ПРИЧАСТИЯ V70-V71 <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Daļēji lokāmais un nelokāmais divdabis)</span></h2>
    </div>
    <div className="participle-v70v71-flex-table" id="participle-v70v71-table">
      <div id="participle-v70v71-table-body">
        {/* Заполняется через JavaScript */}
      <div className="participle-v70v71-section-title tt-section-partial">Daļēji lokāmais divdabis (Частично склоняемое причастие)</div><div className="participle-v70v71-subheader">
      <div></div>
      <div style={{padding: 0}}>
        <div className="participle-v70v71-cell-inner">
          <div className="participle-v70v71-cell-col" style={{textAlign: 'center'}}>Vienskaitlis</div>
          <div className="participle-v70v71-cell-col" style={{textAlign: 'center'}}>Daudzskaitlis</div>
        </div>
      </div>
    </div><div className="participle-v70v71-row tt-row-strada"><div className="participle-v70v71-cell tt-col-infinitive">strādā-t</div><div className="participle-v70v71-cell"><div className="participle-v70v71-cell-inner"><div className="participle-v70v71-cell-col">strādā+<span className="participle-v70v71-ending-dam-orange">dam</span><span className="participle-v70v71-ending-dam">s</span>, strādā+<span className="participle-v70v71-ending-dam-orange">dam</span><span className="participle-v70v71-ending-dama">a</span></div><div className="participle-v70v71-cell-col">strādā+<span className="participle-v70v71-ending-dam-orange">dam</span><span className="participle-v70v71-ending-dam">i</span>, strādā+<span className="participle-v70v71-ending-dam-orange">dam</span><span className="participle-v70v71-ending-dama">as</span></div></div></div></div><div className="participle-v70v71-row tt-row-klausi"><div className="participle-v70v71-cell tt-col-infinitive">klausī-ties</div><div className="participle-v70v71-cell" style={{textAlign: 'center'}}>klausī+<span className="participle-v70v71-ending-dam-orange">dam</span><span className="participle-v70v71-ending-dam">ies</span>, klausī+<span className="participle-v70v71-ending-dam-orange">dam</span><span className="participle-v70v71-ending-dama">ās</span></div></div><div className="participle-v70v71-section-title tt-section-indeclinable">Nelokāmais divdabis (Несклоняемое причастие)</div><div className="participle-v70v71-row tt-row-doma"><div className="participle-v70v71-cell tt-col-infinitive">domāj-u</div><div className="participle-v70v71-cell">domāj+<span className="participle-v70v71-ending-dam-orange">ot</span></div></div><div className="participle-v70v71-row tt-row-gatavo"><div className="participle-v70v71-cell tt-col-infinitive">gatavoj-os</div><div className="participle-v70v71-cell">gatavoj+<span className="participle-v70v71-ending-dam-orange">ot</span>ies</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="participle-v70v71-table-image-container" style={{marginTop: '8px'}}>
        <div className="participle-v70v71-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="participle-v70v71-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn participle-v70v71-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



