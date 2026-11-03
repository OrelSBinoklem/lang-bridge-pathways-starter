import TableCard from '../../TableCard.jsx';
import './TableAdj2.css';
export default function TableAdj2() {
  return (
    <TableCard>
      <div className="card table-adj2" id="adj2-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="adj2-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>ADJ2</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left', marginLeft: '12px'}}>II. DEKLINĀCIJAS ĪPAŠĪBAS VĀRDS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Прилагательные II склонения)</span></h2>
    </div>
    <p className="muted" style={{marginTop: '8px', marginBottom: '16px'}}>Определённые окончания (Noteiktā galotne) — используются для образования определённой формы прилагательных.</p>
    <table className="table-declensions" style={{tableLayout: 'fixed'}}><colgroup><col style={{width: '150px', minWidth: '170px'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /><col style={{width: 'calc(16.6667% - 25px)'}} /></colgroup>
      <thead>
        <tr className="groups"><th></th><th colSpan="3">Vīriešu dzimte (M)</th><th colSpan="3">Sieviešu dzimte (F)</th></tr>
      </thead>
      <tbody>
        <tr className="subhead"><td className="sub" colSpan="1">Vienskaitlis — ед. число</td><td colSpan="6"></td></tr>
        <tr className="domrow"><td></td><td className="dom">a</td><td className="dom">i</td><td className="dom">u</td><td className="dom">a</td><td className="dom">e</td><td className="dom">i</td></tr>
        <tr className="types"><th></th><th>-ais</th><th>-ais</th><th>-ais</th><th>-ā</th><th>-ā</th><th>-ā</th></tr>
        <tr>
          <td className="case"><span className="lv">kas?</span><br /><span className="ru">кто? что?</span></td>
          <td>-ais</td>
          <td>-ais</td>
          <td>-ais</td>
          <td>-ā</td>
          <td>-ā</td>
          <td>-ā</td>
        </tr>
        <tr>
          <td className="case"><span className="lv">kā?</span><br /><span className="ru">кого? чего?</span></td>
          <td>-ā</td>
          <td>-ā</td>
          <td>-ā</td>
          <td>-ās</td>
          <td>-ās</td>
          <td>-ās</td>
        </tr>
        <tr>
          <td className="case"><span className="lv">kam?</span><br /><span className="ru">кому? чему?</span></td>
          <td>-ajam</td>
          <td>-ajam</td>
          <td>-ajam</td>
          <td>-ajai</td>
          <td>-ajai</td>
          <td>-ajai</td>
        </tr>
        <tr>
          <td className="case"><span className="lv">ko?</span><br /><span className="ru">кого? что?</span></td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
        </tr>
        <tr>
          <td className="case"><span className="lv">kur? kad?</span><br /><span className="ru">где? когда?</span></td>
          <td>-ajā</td>
          <td>-ajā</td>
          <td>-ajā</td>
          <td>-ajā</td>
          <td>-ajā</td>
          <td>-ajā</td>
        </tr>
        <tr className="subhead"><td className="sub" colSpan="1">Daudzskaitlis — множественное число</td><td colSpan="6"></td></tr>
        <tr className="domrow"><td></td><td className="dom">a</td><td className="dom">i</td><td className="dom">u</td><td className="dom">a</td><td className="dom">e</td><td className="dom">i</td></tr>
        <tr className="types"><th></th><th>-ie</th><th>-ie</th><th>-ie</th><th>-ās</th><th>-ās</th><th>-ās</th></tr>
        <tr>
          <td className="case"><span className="lv">kas?</span><br /><span className="ru">кто? что?</span></td>
          <td>-ie</td>
          <td>-ie</td>
          <td>-ie</td>
          <td>-ās</td>
          <td>-ās</td>
          <td>-ās</td>
        </tr>
        <tr>
          <td className="case"><span className="lv">kā?</span><br /><span className="ru">кого? чего?</span></td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
          <td>-o</td>
        </tr>
        <tr>
          <td className="case"><span className="lv">kam?</span><br /><span className="ru">кому? чему?</span></td>
          <td>-ajiem</td>
          <td>-ajiem</td>
          <td>-ajiem</td>
          <td>-ajām</td>
          <td>-ajām</td>
          <td>-ajām</td>
        </tr>
        <tr>
          <td className="case"><span className="lv">ko?</span><br /><span className="ru">кого? что?</span></td>
          <td>-os</td>
          <td>-os</td>
          <td>-os</td>
          <td>-ās</td>
          <td>-ās</td>
          <td>-ās</td>
        </tr>
        <tr>
          <td className="case"><span className="lv">kur? kad?</span><br /><span className="ru">где? когда?</span></td>
          <td>-ajos</td>
          <td>-ajos</td>
          <td>-ajos</td>
          <td>-ajās</td>
          <td>-ajās</td>
          <td>-ajās</td>
        </tr>
      </tbody>
    </table>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="adj2-table-image-container" style={{marginTop: '8px'}}>
        <div className="adj2-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="adj2-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn adj2-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



