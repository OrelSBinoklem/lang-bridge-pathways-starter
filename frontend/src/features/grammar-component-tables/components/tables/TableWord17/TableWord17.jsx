import TableCard from '../../TableCard.jsx';
import './TableWord17.css';
export default function TableWord17() {
  return (
    <TableCard>
      <div className="card table-word17" id="word17-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word17-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD17</div>
    </div>
    <h2 className="word17-title">SAIKĻU LIETOŠANA <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Употребление союзов)</span></h2>
    <div className="word17-flex-table" id="word17-table">
      <div className="word17-header">
        <div>Saikļi<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Союзы)</small></div>
        <div>Starp vārdiem<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Между словами)</small></div>
        <div>Starp teikuma daļām<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Между частями предложения)</small></div>
      </div>
      <div id="word17-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word17-row"><div className="word17-cell">un<br />vai<br />jeb</div><div className="word17-cell"><span className="word17-example">rakstnieks un valodnieks*</span><span className="word17-example">ekonomika jeb tautsaimniecība*</span><span className="word17-example">pirmdien vai otrdien*</span><span className="word17-example">rakstnieks un valodnieks, un vēsturnieks**</span></div><div className="word17-cell"><span className="word17-example">K. Valdemārs bija jaunlatvietis, un viņa darbība bija vērsta uz latviešu ekonomisko labklājību.**</span><span className="word17-example">Viņš nezināja, vai rīt būs darbā.**</span></div></div><div className="word17-row"><div className="word17-cell">bet<br />tomēr<br />taču<br />ne vien...,<br />bet arī<br />gan...,<br />gan...</div><div className="word17-cell"><span className="word17-example">vecs, bet labi saglabājies eksponāts</span><span className="word17-example">labi zināms, tomēr satraucošs notikums</span><span className="word17-example">ne vien vajadzīgs, bet arī interesants darbs</span><span className="word17-example">gan vēstures, gan ģeogrāfijas fakti</span></div><div className="word17-cell"><span className="word17-example">Es jau biju izlasījis jauno romānu, bet mans draugs tikai sāka to lasīt.</span><span className="word17-example">Laiks bija jauks, tomēr rudens tuvumu jau varēja manīt.</span><span className="word17-example">Ne vien skolotāji ar satraukumu gaidīja pirmo tikšanos, bet arī skolēni bija nemierīgi.</span><span className="word17-example">Gan Aldis gaidīja tikšanos ar Annu, gan arī Anna neslēpa, ka ir noilgojusies.</span></div></div></div>
    </div>
    <div className="word17-legend">
      <span className="word17-legend-item">*komatu neliek;</span>
      <span className="word17-legend-item">**komatu liek</span>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word17-table-image-container" style={{marginTop: '8px'}}>
        <div className="word17-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word17-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word17-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



