import TableCard from '../../TableCard.jsx';
import './TableIndicative.css';
export default function TableIndicative() {
  return (
    <TableCard>
      <div className="card table-indicative" id="compound-passive-table-container">
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
      <h2 style={{margin: 0, flex: 1, textAlign: 'left'}}>SALIKTIE UN CIEŠAMĀS KĀRTAS LAIKI <span style={{fontSize: '0.7em', fontWeight: 'normal', color: 'var(--muted)'}}>(Сложные и страдательные времена)</span></h2>
    </div>
    <div className="indicative-note">
      <strong>Darāmās kārtas vienkāršie laiki</strong> <strong>(Простые времена действительного залога)</strong> — образуются обычным способом с простыми глаголами без вспомогательных (Tagadne, Pagātne, Nākotne). Примеры: <em>es rakstu</em> (я пишу), <em>es rakstīju</em> (я писал), <em>es rakstīšu</em> (я буду писать).
    </div>
    <div className="indicative-flex-table" id="compound-passive-table">
      <div id="compound-passive-table-body">
        {/* V72: Compound Active Voice */}
        <div className="indicative-section-title tt-block-active-compound">Darāmās kārtas saliktie laiki (Сложные времена действительного залога)</div>
        <table className="tt-block tt-block-active-compound">
          <tbody>
            <tr className="tt-person-es">
              <td className="tt-col-person">es</td>
              <td className="tt-col-present">esmu</td>
              <td className="tt-col-past">biju</td>
              <td className="tt-col-future">būšu</td>
              <td className="tt-col-participle-masc">bij-<span className="indicative-ending-masc">is</span></td>
              <td className="tt-col-participle-fem">bij-<span className="indicative-ending-fem">usi</span></td>
            </tr>
            <tr className="tt-person-tu">
              <td className="tt-col-person">tu</td>
              <td className="tt-col-present">esi</td>
              <td className="tt-col-past">biji</td>
              <td className="tt-col-future">būsi</td>
              <td className="tt-col-participle-masc">bij-<span className="indicative-ending-masc">is</span></td>
              <td className="tt-col-participle-fem">bij-<span className="indicative-ending-fem">usi</span></td>
            </tr>
            <tr className="tt-person-third-sg">
              <td className="tt-col-person">viņš, viņa</td>
              <td className="tt-col-present">ir</td>
              <td className="tt-col-past">bija</td>
              <td className="tt-col-future">būs</td>
              <td className="tt-col-participle-masc">bij-<span className="indicative-ending-masc">is</span></td>
              <td className="tt-col-participle-fem">bij-<span className="indicative-ending-fem">usi</span></td>
            </tr>
            <tr className="tt-person-mes">
              <td className="tt-col-person">mēs</td>
              <td className="tt-col-present">esam</td>
              <td className="tt-col-past">bijām</td>
              <td className="tt-col-future">būsim</td>
              <td className="tt-col-participle-masc">bij-<span className="indicative-ending-masc">uši</span></td>
              <td className="tt-col-participle-fem">bij-<span className="indicative-ending-fem">ušas</span></td>
            </tr>
            <tr className="tt-person-jus">
              <td className="tt-col-person">jūs</td>
              <td className="tt-col-present">esat</td>
              <td className="tt-col-past">bijāt</td>
              <td className="tt-col-future">būsiet</td>
              <td className="tt-col-participle-masc">bij-<span className="indicative-ending-masc">uši</span></td>
              <td className="tt-col-participle-fem">bij-<span className="indicative-ending-fem">ušas</span></td>
            </tr>
            <tr className="tt-person-third-pl">
              <td className="tt-col-person">viņi, viņas</td>
              <td className="tt-col-present">ir</td>
              <td className="tt-col-past">bija</td>
              <td className="tt-col-future">būs</td>
              <td className="tt-col-participle-masc">bij-<span className="indicative-ending-masc">uši</span></td>
              <td className="tt-col-participle-fem">bij-<span className="indicative-ending-fem">ušas</span></td>
            </tr>
          </tbody>
        </table>

        {/* V73: Simple Passive Voice */}
        <div className="indicative-section-title tt-block-passive-simple">Ciešamās kārtas vienkāršie laiki (Простые времена страдательного залога)</div>
        <table className="tt-block tt-block-passive-simple">
          <tbody>
            <tr className="tt-person-es">
              <td className="tt-col-person">es</td>
              <td className="tt-col-present">tieku</td>
              <td className="tt-col-past">tiku</td>
              <td className="tt-col-future">tikšu</td>
              <td className="tt-col-participle-masc">reģistrē-<span className="indicative-ending-masc">ts</span></td>
              <td className="tt-col-participle-fem">reģistrē-<span className="indicative-ending-fem">ta</span></td>
            </tr>
            <tr className="tt-person-tu">
              <td className="tt-col-person">tu</td>
              <td className="tt-col-present">tiec</td>
              <td className="tt-col-past">tiki</td>
              <td className="tt-col-future">tiksi</td>
              <td className="tt-col-participle-masc">reģistrē-<span className="indicative-ending-masc">ts</span></td>
              <td className="tt-col-participle-fem">reģistrē-<span className="indicative-ending-fem">ta</span></td>
            </tr>
            <tr className="tt-person-vins">
              <td className="tt-col-person">viņš</td>
              <td rowSpan="2" className="tt-col-present">tiek</td>
              <td rowSpan="2" className="tt-col-past">tika</td>
              <td rowSpan="2" className="tt-col-future">tiks</td>
              <td className="tt-col-participle-masc">reģistrē-<span className="indicative-ending-masc">ts</span></td>
              <td className="tt-col-participle-fem"></td>
            </tr>
            <tr className="tt-person-vina">
              <td className="tt-col-person">viņa</td>
              <td className="tt-col-participle-masc"></td>
              <td className="tt-col-participle-fem">reģistrē-<span className="indicative-ending-fem">ta</span></td>
            </tr>
            <tr className="tt-person-mes">
              <td className="tt-col-person">mēs</td>
              <td className="tt-col-present">tiekam</td>
              <td className="tt-col-past">tikām</td>
              <td className="tt-col-future">tiksim</td>
              <td className="tt-col-participle-masc">reģistrē-<span className="indicative-ending-masc">ti</span></td>
              <td className="tt-col-participle-fem">reģistrē-<span className="indicative-ending-fem">tas</span></td>
            </tr>
            <tr className="tt-person-jus">
              <td className="tt-col-person">jūs</td>
              <td className="tt-col-present">tiekat</td>
              <td className="tt-col-past">tikāt</td>
              <td className="tt-col-future">tiksiet</td>
              <td className="tt-col-participle-masc">reģistrē-<span className="indicative-ending-masc">ti</span></td>
              <td className="tt-col-participle-fem">reģistrē-<span className="indicative-ending-fem">tas</span></td>
            </tr>
            <tr className="tt-person-vini">
              <td className="tt-col-person">viņi</td>
              <td rowSpan="2" className="tt-col-present">tiek</td>
              <td rowSpan="2" className="tt-col-past">tika</td>
              <td rowSpan="2" className="tt-col-future">tiks</td>
              <td className="tt-col-participle-masc">reģistrē-<span className="indicative-ending-masc">ti</span></td>
              <td className="tt-col-participle-fem"></td>
            </tr>
            <tr className="tt-person-vinas">
              <td className="tt-col-person">viņas</td>
              <td className="tt-col-participle-masc"></td>
              <td className="tt-col-participle-fem">reģistrē-<span className="indicative-ending-fem">tas</span></td>
            </tr>
          </tbody>
        </table>

        {/* V74: Compound Passive Voice */}
        <div className="indicative-section-title tt-block-passive-compound">Ciešamās kārtas saliktie laiki (Сложные времена страдательного залога)</div>
        <table className="tt-block tt-block-passive-compound">
          <tbody>
            <tr className="tt-person-es">
              <td className="tt-col-person">es</td>
              <td className="tt-col-present">esmu</td>
              <td className="tt-col-past">biju</td>
              <td className="tt-col-future">būšu</td>
              <td className="tt-col-participle-masc">uzreģistrē-<span className="indicative-ending-masc">ts</span></td>
              <td className="tt-col-participle-fem">uzreģistrē-<span className="indicative-ending-fem">ta</span></td>
            </tr>
            <tr className="tt-person-tu">
              <td className="tt-col-person">tu</td>
              <td className="tt-col-present">esi</td>
              <td className="tt-col-past">biji</td>
              <td className="tt-col-future">būsi</td>
              <td className="tt-col-participle-masc">uzreģistrē-<span className="indicative-ending-masc">ts</span></td>
              <td className="tt-col-participle-fem">uzreģistrē-<span className="indicative-ending-fem">ta</span></td>
            </tr>
            <tr className="tt-person-vins">
              <td className="tt-col-person">viņš</td>
              <td rowSpan="2" className="tt-col-present">ir</td>
              <td rowSpan="2" className="tt-col-past">bija</td>
              <td rowSpan="2" className="tt-col-future">būs</td>
              <td className="tt-col-participle-masc">uzreģistrē-<span className="indicative-ending-masc">ts</span></td>
              <td className="tt-col-participle-fem"></td>
            </tr>
            <tr className="tt-person-vina">
              <td className="tt-col-person">viņa</td>
              <td className="tt-col-participle-masc"></td>
              <td className="tt-col-participle-fem">uzreģistrē-<span className="indicative-ending-fem">ta</span></td>
            </tr>
            <tr className="tt-person-mes">
              <td className="tt-col-person">mēs</td>
              <td className="tt-col-present">esam</td>
              <td className="tt-col-past">bijām</td>
              <td className="tt-col-future">būsim</td>
              <td className="tt-col-participle-masc">uzreģistrē-<span className="indicative-ending-masc">ti</span></td>
              <td className="tt-col-participle-fem">uzreģistrē-<span className="indicative-ending-fem">tas</span></td>
            </tr>
            <tr className="tt-person-jus">
              <td className="tt-col-person">jūs</td>
              <td className="tt-col-present">esat</td>
              <td className="tt-col-past">bijāt</td>
              <td className="tt-col-future">būsiet</td>
              <td className="tt-col-participle-masc">uzreģistrē-<span className="indicative-ending-masc">ti</span></td>
              <td className="tt-col-participle-fem">uzreģistrē-<span className="indicative-ending-fem">tas</span></td>
            </tr>
            <tr className="tt-person-vini">
              <td className="tt-col-person">viņi</td>
              <td rowSpan="2" className="tt-col-present">ir</td>
              <td rowSpan="2" className="tt-col-past">bija</td>
              <td rowSpan="2" className="tt-col-future">būs</td>
              <td className="tt-col-participle-masc">uzreģistrē-<span className="indicative-ending-masc">ti</span></td>
              <td className="tt-col-participle-fem"></td>
            </tr>
            <tr className="tt-person-vinas">
              <td className="tt-col-person">viņas</td>
              <td className="tt-col-participle-masc"></td>
              <td className="tt-col-participle-fem">uzreģistrē-<span className="indicative-ending-fem">tas</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <details style={{marginTop: '12px'}}>
      <summary style={{cursor: 'pointer', userSelect: 'none', color: 'var(--accent2)'}}>📷 Показать как изображение</summary>
      <div className="compound-passive-table-image-container" style={{marginTop: '8px'}}>
        <div className="compound-passive-loading-text" style={{display: 'none', color: 'var(--muted)', marginBottom: '8px'}}>Генерируется изображение...</div>
        <img className="compound-passive-image-element" style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)', display: 'none'}} />
        <a className="btn compound-passive-download-btn" style={{marginTop: '8px', display: 'none'}}>💾 Скачать изображение</a>
      </div>
    </details>
  </div>
    </TableCard>
  );
}



