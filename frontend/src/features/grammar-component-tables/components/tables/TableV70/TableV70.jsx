import TableCard from '../../TableCard.jsx';
import './TableV70.css';
export default function TableV70() {
  return (
    <TableCard>
      <div className="card table-v70" id="v70-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v70-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V70</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Daļēji lokāmais divdabis (-dams, -dams, -damies, -damās) <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Частично склоняемое деепричастие)</span></h2>
    </div>
    <div className="v70-flex-table" id="v70-table">
      <div className="v70-header">
        <div>Nenoteiksme<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Инфинитив)</small></div>
        <div style={{flex: 2}}>Divdabis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Деепричастие)</small></div>
      </div>
      <div className="v70-subheader">
        <div></div>
        <div style={{flex: 1}}>Vienskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Единственное число)</small></div>
        <div style={{flex: 1}}>Daudzskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Множественное число)</small></div>
      </div>
      <div id="v70-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v70-row"><div className="v70-cell">skrie-t</div><div className="v70-cell">skrie+<span className="v70-ending-masc">dams</span>, skrie+<span className="v70-ending-fem">dama</span></div><div className="v70-cell">skrie+<span className="v70-ending-masc">dami</span>, skrie+<span className="v70-ending-fem">damas</span></div></div><div className="v70-row"><div className="v70-cell">mācī-ties</div><div className="v70-cell">mācī+<span className="v70-ending-masc">damies</span>, mācī+<span className="v70-ending-fem">damās</span></div><div className="v70-cell">mācī+<span className="v70-ending-masc">damies</span>, mācī+<span className="v70-ending-fem">damās</span></div></div><div className="v70-row"><div className="v70-cell">strādā-t</div><div className="v70-cell">strādā+<span className="v70-ending-masc">dams</span>, strādā+<span className="v70-ending-fem">dama</span></div><div className="v70-cell">strādā+<span className="v70-ending-masc">dami</span>, strādā+<span className="v70-ending-fem">damas</span></div></div><div className="v70-row"><div className="v70-cell">klausī-ties</div><div className="v70-cell">klausī+<span className="v70-ending-masc">damies</span>, klausī+<span className="v70-ending-fem">damās</span></div><div className="v70-cell">klausī+<span className="v70-ending-masc">damies</span>, klausī+<span className="v70-ending-fem">damās</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v70-table-image-container" style={{marginTop: '8px'}}>
        <div className="v70-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v70-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v70-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



