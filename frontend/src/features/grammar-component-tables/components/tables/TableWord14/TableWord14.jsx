import TableCard from '../../TableCard.jsx';
import './TableWord14.css';
export default function TableWord14() {
  return (
    <TableCard>
      <div className="card table-word14" id="word14-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word14-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD14</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'center', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>DARBĪBAS VĀRDA LAIKI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Времена глагола)</span></h2>
    </div>
    <div className="word14-flex-table" id="word14-table">
      <div className="word14-header">
        <div>Vienkāršie laiki</div>
        <div>Saliktie laiki</div>
      </div>
      <div id="word14-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word14-row"><div className="word14-cell">
        <span className="word14-tense-title">Vienkāršā tagadne.</span>
        <span className="word14-description">Darbība notiek tagad, šajā brīdī, kas atkārtojas vai notiek vispār.</span>
        <span className="word14-example">Es šobrīd lasu Noras Ikstenas romānu.</span>
      </div><div className="word14-cell">
        <span className="word14-tense-title">Saliktā tagadne.</span>
        <span className="word14-description">Lieto, izsakot pabeigtu darbību, kuras sekas vēl ir manāmas.</span>
        <span className="word14-example">Es esmu izlasījusi Noras Ikstenas romānu.</span>
      </div></div><div className="word14-row"><div className="word14-cell">
        <span className="word14-tense-title">Vienkāršā pagātne.</span>
        <span className="word14-description">Darbība, kas notika agrāk pagātnē.</span>
        <span className="word14-example">Vakar visu dienu es lasīju Noras Ikstenas romānu.</span>
      </div><div className="word14-cell">
        <span className="word14-tense-title">Saliktā pagātne.</span>
        <span className="word14-description">Lieto, izsakot darbību, kas notikusi pirms kādas citas pagātnē notikušas darbības.</span>
        <span className="word14-example">Es jau biju izlasījusi Noras Ikstenas grāmatu, kad draugs man to ieteica.</span>
      </div></div><div className="word14-row"><div className="word14-cell">
        <span className="word14-tense-title">Vienkāršā nākotne.</span>
        <span className="word14-description">Darbība, kas notiks turpmāk nākotnē.</span>
        <span className="word14-example">Brīvdienās (rīt, parīt) es noteikti lasīšu Noras Ikstenas romānu.</span>
      </div><div className="word14-cell">
        <span className="word14-tense-title">Saliktā nākotne.</span>
        <span className="word14-description">Lieto, izsakot darbību, kas būs notikusi pirms kādas citas nākotnē iespējamas darbības.</span>
        <span className="word14-example">Kad es būšu izlasījusi Noras Ikstenas romānu, iedošu izlasīt arī tev.</span>
      </div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word14-table-image-container" style={{marginTop: '8px'}}>
        <div className="word14-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word14-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word14-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



