import TableCard from '../../TableCard.jsx';
import './TableReportedV78.css';
export default function TableReportedV78() {
  return (
    <TableCard>
      <div className="card table-reported-v78" id="reported-v78-table-container">
    <div className="reported-section-title">Atstāstījuma izteiksme vienkāršie laiki (Простые времена пересказного наклонения)</div>
    <table>
      <thead>
        <tr>
          <th className="tt-col-person">Kas?</th>
          <th className="tt-col-present-first">Tagadne 1. persona</th>
          <th className="tt-col-future-first">Nākotne 1. persona</th>
          <th className="tt-col-present-ot">Tagadne<br />-ot, -oties</th>
          <th className="tt-col-future-ot">Nākotne<br />-ot, -oties</th>
        </tr>
      </thead>
      <tbody>
        <tr className="tt-row-plain">
          <td rowSpan="2" className="tt-col-person">любое лицо</td>
          <td className="tt-col-present-first">domā-u</td>
          <td className="tt-col-future-first">domāš-u</td>
          <td className="tt-col-present-ot">domā<span className="reported-ending">-ot</span></td>
          <td className="tt-col-future-ot">domāš<span className="reported-ending">-ot</span></td>
        </tr>
        <tr className="tt-row-reflexive">
          <td className="tt-col-present-first">skat-os</td>
          <td className="tt-col-future-first">skatīš-os</td>
          <td className="tt-col-present-ot">skat<span className="reported-ending">-oties</span></td>
          <td className="tt-col-future-ot">skatīš<span className="reported-ending">-oties</span></td>
        </tr>
      </tbody>
    </table>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="reported-v78-table-image-container" style={{marginTop: '8px'}}>
        <div className="reported-v78-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="reported-v78-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn reported-v78-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



