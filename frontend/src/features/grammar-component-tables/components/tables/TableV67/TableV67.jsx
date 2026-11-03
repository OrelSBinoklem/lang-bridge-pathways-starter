import TableCard from '../../TableCard.jsx';
import './TableV67.css';
export default function TableV67() {
  return (
    <TableCard>
      <div className="card table-v67" id="v67-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="v67-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>V67</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>Lokāmais darāmās kārtas pagātnes divdabis (-is, -usi, -ies, -usies) <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Склоняемое причастие действительного залога прошедшего времени)</span></h2>
    </div>
    <div className="v67-flex-table" id="v67-table">
      <div className="v67-header">
        <div>Īstenības izteiksmes pagātnes 1. persona<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Изъявительное наклонение, прошедшее время, 1-е лицо)</small></div>
        <div style={{flex: 2}}>Divdabis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Причастие)</small></div>
      </div>
      <div className="v67-subheader">
        <div></div>
        <div style={{flex: 1}}>Vienskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Единственное число)</small></div>
        <div style={{flex: 1}}>Daudzskaitlis<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Множественное число)</small></div>
      </div>
      <div id="v67-table-body">
        {/* Заполняется через JavaScript */}
      <div className="v67-row"><div className="v67-cell">nes-u</div><div className="v67-cell">nes+<span className="v67-ending-masc">is</span>, nes+<span className="v67-ending-fem">usi</span></div><div className="v67-cell">nes+<span className="v67-ending-masc">uši</span>, nes+<span className="v67-ending-fem">ušas</span></div></div><div className="v67-row"><div className="v67-cell">zināj-u</div><div className="v67-cell">zināj+<span className="v67-ending-masc">is</span>, zināj+<span className="v67-ending-fem">usi</span></div><div className="v67-cell">zināj+<span className="v67-ending-masc">uši</span>, zināj+<span className="v67-ending-fem">ušas</span></div></div><div className="v67-row"><div className="v67-cell">atbildēj-u</div><div className="v67-cell">atbildēj+<span className="v67-ending-masc">is</span>, atbildēj+<span className="v67-ending-fem">usi</span></div><div className="v67-cell">atbildēj+<span className="v67-ending-masc">uši</span>, atbildēj+<span className="v67-ending-fem">ušas</span></div></div><div className="v67-row"><div className="v67-cell">skatīj-os</div><div className="v67-cell">skatīj+<span className="v67-ending-masc">ies</span>, skatīj+<span className="v67-ending-fem">usies</span></div><div className="v67-cell">skatīj+<span className="v67-ending-masc">ušies</span>, skatīj+<span className="v67-ending-fem">ušās</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="v67-table-image-container" style={{marginTop: '8px'}}>
        <div className="v67-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="v67-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn v67-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



