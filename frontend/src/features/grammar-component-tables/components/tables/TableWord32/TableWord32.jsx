import TableCard from '../../TableCard.jsx';
import './TableWord32.css';
export default function TableWord32() {
  return (
    <TableCard>
      <div className="card table-word32" id="word32-table-container">
    <h2 className="word32-title" id="word32-title">УМЕНЬШИТЕЛЬНО - ЛАСКАТЕЛЬНЫЕ <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Diminutīvi)</span></h2>
    <div id="word32-content">
      {/* Заполняется через JavaScript */}
    <div className="word32-section-title">Diminutīvi (Уменьшительно-ласкательные формы)</div><div className="word32-table-wrapper"><table className="word32-table"><colgroup><col style={{width: '70px', minWidth: '70px'}} /><col /><col /><col /><col /><col /></colgroup><thead><tr><th className="tt-col-gender">Dzimte</th><th className="tt-col-declension">Deklinācija</th><th className="tt-col-ending">Galotne</th><th className="tt-col-suffix">Piedēklis</th><th className="tt-col-how">Kā to izdarīt?</th><th className="tt-col-example">Piemērs</th></tr></thead><tbody><tr className="word32-row word32-masculine word32-special-bg tt-decl-1"><td rowSpan="3" className="word32-gender-cell word32-masculine-bg tt-col-gender">Vīriešu</td><td className="word32-declension-cell tt-col-declension">I</td><td className="tt-col-ending">-s, -š</td><td className="word32-piedeklis-cell word32-piedeklis-blue tt-col-suffix">-iņ-</td><td className="tt-col-how">Traktor- + <span className="word32-suffix">-iņ-</span> + -š</td><td className="tt-col-example">traktoriņš</td></tr><tr className="word32-row word32-masculine tt-decl-2"><td className="word32-declension-cell tt-col-declension">II</td><td className="tt-col-ending">-is</td><td className="word32-piedeklis-cell tt-col-suffix">-īt-</td><td className="tt-col-how">Lāc- + <span className="word32-suffix">-īt-</span> + -is</td><td className="tt-col-example">lācītis</td></tr><tr className="word32-row word32-masculine word32-special-bg tt-decl-3"><td className="word32-declension-cell tt-col-declension">III</td><td className="tt-col-ending">-us</td><td className="word32-piedeklis-cell word32-piedeklis-blue tt-col-suffix">-iņ-</td><td className="tt-col-how">Med- + <span className="word32-suffix">-iņ-</span> + -š</td><td className="tt-col-example">mediņš</td></tr><tr className="word32-row word32-feminine word32-special-bg-fem tt-decl-4"><td rowSpan="3" className="word32-gender-cell word32-feminine-bg tt-col-gender">Sieviešu</td><td className="word32-declension-cell tt-col-declension">IV</td><td className="tt-col-ending">-a</td><td className="word32-piedeklis-cell word32-piedeklis-yellow tt-col-suffix">-iņ-</td><td className="tt-col-how">Ak- + <span className="word32-suffix">-iņ-</span> + -a</td><td className="tt-col-example">aciņa</td></tr><tr className="word32-row word32-feminine tt-decl-5"><td className="word32-declension-cell tt-col-declension">V</td><td className="tt-col-ending">-e</td><td className="word32-piedeklis-cell tt-col-suffix">-īt-</td><td className="tt-col-how">Bit- + <span className="word32-suffix">-īt-</span> + -e</td><td className="tt-col-example">bitīte</td></tr><tr className="word32-row word32-feminine word32-special-bg-fem tt-decl-6"><td className="word32-declension-cell tt-col-declension">VI</td><td className="tt-col-ending">-s</td><td className="word32-piedeklis-cell word32-piedeklis-yellow tt-col-suffix">-iņ-, -sniņ-, -tiņ-</td><td className="tt-col-how">Haiziv- + <span className="word32-suffix">-tiņ-</span> + -a</td><td className="tt-col-example">haizivtiņa</td></tr></tbody></table></div></div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word32-table-image-container" style={{marginTop: '8px'}}>
        <div className="word32-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word32-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word32-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



