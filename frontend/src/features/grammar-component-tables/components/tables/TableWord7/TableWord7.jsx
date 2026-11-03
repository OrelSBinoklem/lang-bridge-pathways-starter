import TableCard from '../../TableCard.jsx';
import './TableWord7.css';
export default function TableWord7() {
  return (
    <TableCard>
      <div className="card table-word7" id="word7-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word7-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD7</div>
      <h2 style={{margin: 0, flex: 1, textAlign: 'center', color: '#2d5016', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '1.1em'}}>GALVENIE NENOTEIKTĀS UN NOTEIKTĀS GALOTNES LIETOŠANAS NOSACĪJUMI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Основные условия использования неопределенных и определенных окончаний)</span></h2>
    </div>
    <div className="word7-flex-table" id="word7-table">
      <div className="word7-header">
        <div>Lietošanas nosacījumi<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Условия использования)</small></div>
        <div>Nenoteiktā galotne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Неопределенное окончание)</small></div>
        <div>Noteiktā galotne<br /><small style={{fontWeight: 'normal', color: 'var(--muted)'}}>(Определенное окончание)</small></div>
      </div>
      <div id="word7-table-body">
        {/* Заполняется через JavaScript */}
      <div className="word7-row"><div className="word7-cell">Ja tekstā objektu nosauc pirmo reizi</div><div className="word7-cell">Aiz meža ir <span className="word7-adjective">veca</span> māja.</div><div className="word7-cell"></div></div><div className="word7-row"><div className="word7-cell">Ja tekstā objektu nosauc atkārtoti</div><div className="word7-cell"></div><div className="word7-cell">Tajā vecajā mājā neviens nedzīvo.</div></div><div className="word7-row"><div className="word7-cell">Ar vietniekvārdiem vārdiem dažs, kāds, viens</div><div className="word7-cell">Dažas <span className="word7-adjective">saulainas</span> dienas. Viens <span className="word7-adjective">liels</span> notikums.</div><div className="word7-cell"></div></div><div className="word7-row"><div className="word7-cell">Ar vietniekvārdiem mans, tavs, viņa, viņas, viņu, mūsu, jūsu</div><div className="word7-cell"></div><div className="word7-cell">Tavs <span className="word7-adjective">skaistais</span> sapnis. Mana lieliskā ideja.</div></div><div className="word7-row"><div className="word7-cell">Ar vietniekvārdu savs</div><div className="word7-cell"></div><div className="word7-cell">Parādi savu <span className="word7-adjective">jauno</span> mašīnu!</div></div><div className="word7-row"><div className="word7-cell">Ar vietniekvārdiem jebkurš, jebkāds; kaut kas, šāds, tāds, kāds, daži</div><div className="word7-cell">Strādāju jebkuru <span className="word7-adjective">fizisku</span> darbu. Šeit aug tikai dažas <span className="word7-adjective">nelielas</span> priedes.</div><div className="word7-cell"></div></div><div className="word7-row"><div className="word7-cell">Kārtas skaitļa vārdi</div><div className="word7-cell"></div><div className="word7-cell"><span className="word7-adjective">pirmais</span>, <span className="word7-adjective">otrais</span>, <span className="word7-adjective">trešais</span></div></div><div className="word7-row"><div className="word7-cell">Atsevišķus īpašības vārdus</div><div className="word7-cell"></div><div className="word7-cell"><span className="word7-adjective">centrālais</span>, <span className="word7-adjective">augšējais</span>, <span className="word7-adjective">apakšējais</span>, priekšējā, pēdējā</div></div><div className="word7-row"><div className="word7-cell">Salīdzinājumos un frazeoloģismos</div><div className="word7-cell"><span className="word7-adjective">Melns</span> kā velns. Tas gan ir <span className="word7-adjective">ciets</span> rieksts.</div><div className="word7-cell"></div></div><div className="word7-row"><div className="word7-cell">Terminoloģiskos vārdu savienojumos</div><div className="word7-cell"></div><div className="word7-cell"><span className="word7-adjective">brīvais</span> elektrons <span className="word7-adjective">aukstais</span> ierocis šķidrās ziepes</div></div><div className="word7-row"><div className="word7-cell">Ģeogrāfiskajos nosaukumos</div><div className="word7-cell"></div><div className="word7-cell">Melnā jūra <span className="word7-adjective">Zilais</span> kalns</div></div><div className="word7-row"><div className="word7-cell">Iestāžu nosaukumos</div><div className="word7-cell"></div><div className="word7-cell">Augstākā tiesa <span className="word7-adjective">profesionālās</span> izglītības iestāde</div></div><div className="word7-row"><div className="word7-cell">Lietvārdi, kas atvasināti no īpašības vārdiem ar noteikto galotni</div><div className="word7-cell"></div><div className="word7-cell"><span className="word7-adjective">rakstāmais</span>, ēdamais, <span className="word7-adjective">braucamais</span>, <span className="word7-adjective">mīļākais</span>, <span className="word7-adjective">vecākais</span>, galvenā</div></div></div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word7-table-image-container" style={{marginTop: '8px'}}>
        <div className="word7-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word7-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word7-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



