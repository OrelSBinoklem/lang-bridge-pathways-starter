import TableCard from '../../TableCard.jsx';
import './TableWord24.css';
export default function TableWord24() {
  return (
    <TableCard>
      <div className="card table-word24" id="word24-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word24-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD24</div>
    </div>
    <h2 className="word24-title">SAVRUPINĀJUMI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Обособленные члены предложения)</span></h2>
    <p className="word24-intro">Savrupinājums ir teikuma locekļa vai tā grupas nošķīrums teikumā. Savrupinājums tiek lietots kāda teikuma locekļa precizēšanai, niansēšanai, paskaidrošanai. Savrupinājumus tekstā atdala ar komatiem vai domuzīmēm, runā – ar pauzi.</p>
    <div className="word24-flex-table" id="word24-table">
      <div className="word24-header">
        <div>Savrupinājums<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Обособленная часть)</small></div>
        <div>Raksturojums<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Описание)</small></div>
        <div>Piemērs<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Пример)</small></div>
      </div>
      <div id="word24-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word24-row"><div className="word24-cell">Savrupināts apzīmētājs un savrupināta apzīmētāja grupa</div><div className="word24-cell">Savrupināts apzīmētājs vai tā grupa veidojas, ja vēlas izcelt kādu pazīmi un maina parasto apzīmētāja atrašanās vietu, novietojot apzīmētāju nevis pirms, bet aiz apzīmējamā vārda.</div><div className="word24-cell"><span className="word24-example">Pie mājas atradās mežs – <span className="word24-underlined">drūms, bet neatvairāms</span>.</span><span className="word24-example">Rudens krāsas, <span className="word24-underlined">dzeltenās un spilgti sarkanās</span>, man patīk vislabāk.</span></div></div><div className="word24-row"><div className="word24-cell">Savrupināts pielikums un savrupināta pielikuma grupa</div><div className="word24-cell">Savrupināts pielikums ir lietvārds vai lietvārda nozīmē lietots vārds, kurš paskaidro vārdu pirms savrupināta pielikuma. Visbiežāk pielikums nosauc amatu, profesiju, piederību kādai grupai, tas var būt īpašvārds kopā ar apzīmētājiem.</div><div className="word24-cell"><span className="word24-example">K. Valdemāram, <span className="word24-underlined">izcilam latviešu nacionālās atmodas pārstāvim</span>, ir bijusi ļoti interesanta dzīve.</span><span className="word24-example">Sētā es redzu milzīgu radījumu – <span className="word24-underlined">vilku sugas suni</span>.</span></div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word24-table-image-container" style={{marginTop: '8px'}}>
        <div className="word24-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word24-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word24-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



