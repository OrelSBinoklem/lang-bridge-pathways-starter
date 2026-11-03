import TableCard from '../../TableCard.jsx';
import './TableWord11.css';
export default function TableWord11() {
  return (
    <TableCard>
      <div className="card table-word11" id="word11-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word11-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD11</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'center', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase'}}>VIETNIEKVĀRDS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Местоимения)</span></h2>
    </div>
    <div className="word11-flex-table" id="word11-table">
      <div className="word11-header">
        <div>Iedalījuma grupa<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Категория)</small></div>
        <div>Vietniekvārdi<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Местоимения)</small></div>
        <div>Funkcijas / nozīme<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Функции / значение)</small></div>
      </div>
      <div id="word11-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word11-row"><div className="word11-cell">Personu vietniekvārdi</div><div className="word11-cell">es, tu, mēs jūs, viņš, viņa, viņi, viņas</div><div className="word11-cell">Nosauc personas, kas piedalās runā.</div></div><div className="word11-row"><div className="word11-cell">Atgriezeniskais vietniekvārds</div><div className="word11-cell">sevis</div><div className="word11-cell">Norāda, ka darbība vērsta uz pašu darītāju.</div></div><div className="word11-row"><div className="word11-cell">Norādāmie vietniekvārdi</div><div className="word11-cell">tas, tā tie, tās, šis, šī, šie, šās</div><div className="word11-cell">Norāda uz dzīvām būtnēm, priekšmetiem.</div></div><div className="word11-row"><div className="word11-cell">Piederības vietniekvārdi</div><div className="word11-cell">mans. mana, tavs, tava, savs, sava, mani, manas, tavi, tavas, savi, savas</div><div className="word11-cell">Norāda uz piederību kādai personai.</div></div><div className="word11-row"><div className="word11-cell">Jautājamie vietniekvārdi</div><div className="word11-cell">kas, kāds, kāda, kādi, kādas; kurš, kura, kuri, kuras</div><div className="word11-cell">Ievada jautājumu.</div></div><div className="word11-row"><div className="word11-cell">Attieksmes vietniekvārdi</div><div className="word11-cell">kas, kurš, kāds</div><div className="word11-cell">Ievada palīgteikumu saliktā pakārtotā teikumā.</div></div><div className="word11-row"><div className="word11-cell">Nenoteiktie vietniekvārdi</div><div className="word11-cell">dažs, cits, kaut kas, kaut kāds, kaut kurš, diez(in) kas, diez(in) kāds, diez(in) kurš, nez(in) kas, nez(in) kurš, nez(in) kāds, dažs labs, viens otrs, jebkas, jebkurš, jebkāds</div><div className="word11-cell">Norāda uz nepazīstamiem priekšmetiem, dzīvām būtnēm vai to nenoteiktām pazīmēm.</div></div><div className="word11-row"><div className="word11-cell">Noteiktie vietniekvārdi</div><div className="word11-cell">katrs, katra, ikkatrs, ikkatra, ikkurš, ikkura, ikviens, ikviena, viss, abi, abas, pats, pati</div><div className="word11-cell">Norāda uz priekšmetiem vai dzīvām būtnēm kā uz kaut ko noteiktu un pazīstamu.</div></div><div className="word11-row"><div className="word11-cell">Noliegtie vietniekvārdi</div><div className="word11-cell">nekas, nekāds, nekāda, neviens, neviena</div><div className="word11-cell">Norāda uz noliegumu.</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word11-table-image-container" style={{marginTop: '8px'}}>
        <div className="word11-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word11-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word11-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



