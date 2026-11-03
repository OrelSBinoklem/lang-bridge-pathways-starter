import TableCard from '../../TableCard.jsx';
import './TableMoodV75v76v77.css';
export default function TableMoodV75v76v77() {
  return (
    <TableCard>
      <div className="card table-mood-v75v76v77" id="mood-v75v76v77-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left'}}>НАКЛОНЕНИЯ V75-V76-V77 <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Vajadzības, Vēlējuma, Pavēles izteiksme)</span></h2>
    </div>
    <div className="mood-v75v76v77-flex-table" id="mood-v75v76v77-table">
      <div id="mood-v75v76v77-table-body">
        {/* V75: Vajadzības izteiksme */}
        <div className="mood-v75v76v77-section-title tt-section-necessity">Vajadzības izteiksme (Долженствовательное наклонение)</div>
        <div className="mood-v75v76v77-subheader tt-necessity-header">
          <div>Kam?</div>
          <div>
            <div className="mood-v75v76v77-cell-inner">
              <div className="mood-v75v76v77-cell-col">Tagadne</div>
              <div className="mood-v75v76v77-cell-col">Pagātne</div>
              <div className="mood-v75v76v77-cell-col">Nākotne</div>
            </div>
          </div>
                    <div className="mood-formula-cell">
            <div>ā- + tagadnes 3.</div>
            <div>persona + <span className="mood-case">Nominativs</span>.</div>
          </div>
        </div>
        <div style={{position: 'relative', paddingLeft: '150px'}}>
          <div className="mood-v75v76v77-cell" style={{position: 'absolute', left: '0px', top: '0px', width: '150px', borderRight: '1px solid var(--border-strong)', padding: '8px 12px', background: 'var(--table-row-even)', zIndex: 10, display: 'flex', alignItems: 'center', height: '73px', borderBottom: '1px solid var(--border-strong)'}}><span>любое лицо <span style={{color: '#ff9800', fontWeight: 600}}>(в&nbsp;дативе)</span></span></div>
          <div className="mood-v75v76v77-row tt-necessity-row tt-necessity-row-1">
            <div className="mood-v75v76v77-cell verbs-comb-container tt-necessity-verbs">
              <div className="mood-v75v76v77-cell-inner">
                <div className="mood-v75v76v77-cell-col">ir</div>
                <div className="mood-v75v76v77-cell-col">bija</div>
                <div className="mood-v75v76v77-cell-col">būs</div>
              </div>
            </div>
            <div className="mood-v75v76v77-cell"><span className="mood-v75v76v77-ending-ja">jā</span>+brauc</div>
          </div>
          <div className="mood-v75v76v77-row tt-necessity-row tt-necessity-row-2" style={{borderBottom: '1px solid var(--border-strong)'}}>
            <div className="mood-v75v76v77-cell verbs-comb-container tt-necessity-verbs">
              <div className="mood-v75v76v77-cell-inner">
                <div className="mood-v75v76v77-cell-col">ir</div>
                <div className="mood-v75v76v77-cell-col">bija</div>
                <div className="mood-v75v76v77-cell-col">būs</div>
              </div>
            </div>
            <div className="mood-v75v76v77-cell"><span className="mood-v75v76v77-ending-ja">jā</span>+pērk maize</div>
          </div>
        </div>

        {/* V76: Vēlējuma izteiksme */}
        <div className="mood-v75v76v77-section-title tt-section-wish">Vēlējuma izteiksme (Условное наклонение)</div>
        <div className="mood-v75v76v77-header tt-wish-header">
          <div>Nenoteiksme</div>
          <div>Kas?</div>
          <div>Vēlējuma izteiksme</div>
        </div>
        <div style={{position: 'relative'}}>
          <div className="mood-v75v76v77-cell" style={{position: 'absolute', left: '150px', top: '0px', width: '150px', borderRight: '1px solid var(--border-strong)', padding: '8px 12px', background: 'var(--table-row-even)', zIndex: 10, display: 'flex', alignItems: 'center', height: '73px', borderBottom: '1px solid var(--border-strong)', boxSizing: 'border-box'}}>любое лицо</div>
          <div className="mood-v75v76v77-row tt-wish-row tt-wish-row-1">
            <div className="mood-v75v76v77-cell">gribē-t</div>
            <div className="mood-v75v76v77-cell" style={{width: '150px', flex: '0 0 150px'}}></div>
            <div className="mood-v75v76v77-cell">gribē+<span className="mood-v75v76v77-ending-tu">tu</span></div>
          </div>
          <div className="mood-v75v76v77-row tt-wish-row tt-wish-row-2" style={{borderBottom: '1px solid var(--border-strong)'}}>
            <div className="mood-v75v76v77-cell">interesē-ties</div>
            <div className="mood-v75v76v77-cell" style={{width: '150px', flex: '0 0 150px'}}></div>
            <div className="mood-v75v76v77-cell">interesē+<span className="mood-v75v76v77-ending-tu">tos</span></div>
          </div>
        </div>

        {/* V77: Pavēles izteiksme */}
        <div className="mood-v75v76v77-section-title tt-section-imperative">Pavēles izteiksme (Повелительное наклонение)</div>
        <div className="mood-v75v76v77-header tt-imperative-header">
          <div>Kas?</div>
          <div className="mood-col-185">tagadnes 1. persona</div>
          <div>Pavēles izteiksme</div>
        </div>
        <div className="mood-v75v76v77-row tt-imperative-row tt-person-es">
          <div className="mood-v75v76v77-cell tt-col-person">es</div>
          <div className="mood-v75v76v77-cell mood-col-185 tt-col-first-person">nāk-u, cel-os</div>
          <div className="mood-v75v76v77-cell tt-col-imperative">—</div>
        </div>
        <div className="mood-v75v76v77-row tt-imperative-row tt-person-tu">
          <div className="mood-v75v76v77-cell tt-col-person">tu</div>
          <div className="mood-v75v76v77-cell mood-col-185 tt-col-first-person">nāc, cel-ies</div>
          <div className="mood-v75v76v77-cell tt-col-imperative">nāc!, celies!</div>
        </div>
        <div className="mood-v75v76v77-row tt-imperative-row tt-person-third">
          <div className="mood-v75v76v77-cell tt-col-person">viņš, viņa,<br />viņi, viņas</div>
          <div className="mood-v75v76v77-cell mood-col-185 tt-col-first-person">nāk, cel-as</div>
          <div className="mood-v75v76v77-cell tt-col-imperative"><span className="mood-v75v76v77-ending-tu">lai</span> nāk!, <span className="mood-v75v76v77-ending-tu">lai</span> ceļas!</div>
        </div>
        <div className="mood-v75v76v77-row tt-imperative-row tt-person-mes">
          <div className="mood-v75v76v77-cell tt-col-person">mēs</div>
          <div className="mood-v75v76v77-cell mood-col-185 tt-col-first-person">nāk-am, cel-amies</div>
          <div className="mood-v75v76v77-cell tt-col-imperative" style={{width: '240px', flex: '0 0 240px'}}>nāksim!, celsimies! (<span className="mood-v75v76v77-ending-tu">Nākotne</span>)</div>
        </div>
        <div className="mood-v75v76v77-row tt-imperative-row tt-person-jus">
          <div className="mood-v75v76v77-cell tt-col-person">jūs</div>
          <div className="mood-v75v76v77-cell mood-col-185 tt-col-first-person">nāk-at, cel-aties</div>
          <div className="mood-v75v76v77-cell tt-col-imperative">nāc<span className="mood-v75v76v77-ending-tu">iet</span>!, cel<span className="mood-v75v76v77-ending-tu">ieties</span>!</div>
        </div>
      </div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="mood-v75v76v77-table-image-container" style={{marginTop: '8px'}}>
        <div className="mood-v75v76v77-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="mood-v75v76v77-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn mood-v75v76v77-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}




