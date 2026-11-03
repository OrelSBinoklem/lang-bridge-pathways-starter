import TableCard from '../../TableCard.jsx';
import './TableWord28.css';
export default function TableWord28() {
  return (
    <TableCard>
      <div className="card table-word28" id="word28-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <div className="word28-title-banner" style={{background: '#dc3545', color: 'white', padding: '8px 12px', fontWeight: 'bold', display: 'inline-block', borderRadius: '4px'}}>WORD28</div>
    </div>
    <h2 className="word28-title" id="word28-title">VIENLĪDZĪGI TEIKUMA LOCEKĻI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Однородные члены предложения)</span></h2>
    <h3 className="word28-subtitle" id="word28-subtitle">UN VISPĀRINOŠAIS VĀRDS <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(И обобщающее слово)</span></h3>
    <div id="word28-content">
      {/* Заполняется через JavaScript */}
    <p className="word28-intro">Vienlīdzīgus teikuma locekļus var saistīt ar kādu vispārinošu vārdu, kas apvieno visas nosauktās lietas. Rakstot teikumu, kurā ir vienlīdzīgi teikuma locekļi un vispārinošais vārds, jāievēro vairāki pieturzīmju lietošanas gadījumi.</p><div className="word28-table-wrapper"><div className="word28-table"><div className="word28-header"><div>Pieturzīmju lietojums</div><div>Piemērs</div></div><div className="word28-row"><div className="word28-cell"><div className="word28-rule-text">... <span className="word28-rule-v-bold">V</span>: v, v, v, v un v.</div></div><div className="word28-cell"><div className="word28-example">Svarīgs ir brīvprātīgo <span className="word28-bold">darbs</span>: apkārtnes uzkopšana, iešana rotaļās ar bērniem, pasākumu organizēšana, palīdzēšana mācībās un informatīvu materiālu sagatavošana.</div></div></div><div className="word28-row"><div className="word28-cell"><div className="word28-rule-text">... v, v, v, v, v – <span className="word28-rule-v-bold">V</span>.</div></div><div className="word28-cell"><div className="word28-example">Apkārtnes uzkopšana, iešana rotaļās ar bērniem, pasākumu organizēšana, palīdzēšana mācībās un informatīvu materiālu sagatavošana – <span className="word28-bold">tas</span> parasti ir brīvprātīgo darbs.</div></div></div><div className="word28-row"><div className="word28-cell"><div className="word28-rule-text">... <span className="word28-rule-v-bold">V</span> – v, v, v, v, v – ....</div></div><div className="word28-cell"><div className="word28-example">Brīvprātīgo <span className="word28-bold">darbā</span> – apkārtnes uzkopšanā, iešanā rotaļās ar bērniem, pasākumu organizēšanā, palīdzēšanā mācībās, informatīvu materiālu sagatavošanā – iesaistās daudz cilvēku.</div></div></div><div className="word28-row"><div className="word28-cell"><div className="word28-rule-text"><span className="word28-rule-v-bold">V</span> – v, v, v, v, v – <span className="word28-rule-v-bold">V</span> ... .</div></div><div className="word28-cell"><div className="word28-example"><span className="word28-bold">Visur</span> – apkārtnes uzkopšanā, ejot rotaļās ar bērniem, pasākumu organizēšanā, palīdzībā mācībās, informatīvu materiālu sagatavošanā – <span className="word28-bold">visur</span> ir vajadzīgs brīvprātīgo darbs.</div></div></div><div className="word28-row"><div className="word28-cell"><div className="word28-rule-text"><span className="word28-rule-v-bold">V</span>, kā v, v, v, v, v, ...</div></div><div className="word28-cell"><div className="word28-example">Brīvprātīgo <span className="word28-bold">darbā</span>, kā apkārtnes uzkopšanā, iešanā rotaļās ar bērniem, pasākumu organizēšanā, palīdzēšanā mācībās, informatīvu materiālu sagatavošanā, iesaistās daudz cilvēku.</div></div></div><div className="word28-row"><div className="word28-cell"><div className="word28-rule-text">Tādā <span className="word28-rule-v-bold">V</span> kā v, v, v, v, v...</div></div><div className="word28-cell"><div className="word28-example"><span className="word28-bold">Tādā</span> brīvprātīgo <span className="word28-bold">darbā</span> kā apkārtnes uzkopšanā, iešanā rotaļās ar bērniem, pasākumu organizēšanā, palīdzēšanā mācībās, informatīvu materiālu sagatavošanā iesaistās daudz cilvēku.</div></div></div></div></div><div className="word28-legend">Lietotie apzīmējumi: V – vispārinošais vārds, v – vienlīdzīgi teikuma locekļi.</div></div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="word28-table-image-container" style={{marginTop: '8px'}}>
        <div className="word28-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="word28-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn word28-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



