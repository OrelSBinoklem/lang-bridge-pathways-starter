import TableCard from '../../TableCard.jsx';
import FloatLettersLayer from '../FloatLettersLayer.jsx';

/** Буквы на таблице 2 — -j-, -š-, -s- (редактируй left/top в %). */
const TABLE2_FLOAT_LETTERS = [
  { char: 'j', left: '48%', top: '38%' },
  { char: 'a', left: '58%', top: '32%' },
  { char: 'a', left: '38%', top: '58%' },
  { char: 'j', left: '48%', top: '52%' },
  { char: 'a', left: '58%', top: '65%' },
  { char: 'š', left: '72%', top: '48%', fontSize: '22px' },
  { char: 's', left: '82%', top: '62%' },
];

export default function Card2() {
  return (
    <TableCard>
      <div>
    <div className="table-container" data-table-id="table2">
      <div className="polygon-toolbar">
        <button className="polygon-btn" data-action="create">Создать</button>
        <button className="polygon-btn" data-action="edit">Редактировать</button>
        <button className="polygon-btn" data-action="copy">Копировать</button>
        <button className="polygon-btn" data-action="delete">Удалить</button>
        <button className="polygon-btn" data-action="settings">Настройки</button>
        <button className="polygon-btn" data-action="json">JSON</button>
        <div className="color-picker">
          <label>Цвет:</label>
          <input type="color" id="gradStart2" value="#ffffff" title="Начало градиента" />
          <input type="color" id="gradEnd2" value="#e8edfb" title="Конец градиента" />
        </div>
        <button className="polygon-btn gradient-btn" data-table="2" data-gradient="1" title="Градиент на основе #F0F7F4">Гр1</button>
        <button className="polygon-btn gradient-btn" data-table="2" data-gradient="2" title="Градиент на основе #FFF5ED">Гр2</button>
      </div>
      <div className="polygon-settings" id="settings2">
        <h3>Настройки многоугольника</h3>
        <div className="setting-group">
          <label>Скругление углов:</label>
          <input type="range" min="0" max="20" value="8" id="roundness2" />
          <input type="number" min="0" max="20" value="8" id="roundnessNum2" />
        </div>
        <div className="setting-group">
          <label>Градиент:</label>
          <input type="color" id="gradStart2" value="#ffffff" />
          <input type="color" id="gradEnd2" value="#e8edfb" />
        </div>
        <div className="setting-group">
          <label>Обводка:</label>
          <input type="range" min="0" max="5" value="1.5" step="0.5" id="strokeWidth2" />
          <input type="color" id="strokeColor2" value="#c3cfee" />
        </div>
        <div className="setting-group">
          <label>Тень:</label>
          <input type="range" min="0" max="20" value="8" id="shadowBlur2" />
          <input type="range" min="0" max="10" value="2" id="shadowOffset2" />
          <input type="color" id="shadowColor2" value="#000000" />
          <input type="range" min="0" max="100" value="20" id="shadowOpacity2" />
        </div>
      </div>
    <table><colgroup><col style={{width: '70px', minWidth: '70px'}} /><col /><col /><col /><col /><col /><col /></colgroup>
      <thead>
        <tr>
          <th rowSpan="2"></th>
          <th className="fwnormal" colSpan="2">Pagātne — I</th>
          <th className="fwnormal group-ii" colSpan="2">Pagātne — II, III</th>
          <th className="fwnormal" colSpan="2">Nākotne — I, II, III</th>
        </tr>
        <tr>
          <th className="fwnormal">-t</th>
          <th className="fwnormal">-ties</th>
          <th className="group-ii"><span className="cgray">-t</span></th>
          <th className="group-ii"><span className="cgray">-ties</span></th>
          <th><span className="cgray">-t</span></th>
          <th><span className="cgray">-ties</span></th>
        </tr>
      </thead>
      <tbody>
      <tr>
        <td className="persona">es</td>
        <td><span className="ending cgray">-u</span></td>
        <td><span className="ending cgray">-os</span></td>
        <td><span className="ending cgray">-j-u</span></td>
        <td><span className="ending cgray">-j-os</span></td>
        <td><span className="ending cgray">-š-u</span></td>
        <td><span className="ending cgray">-š-os</span></td>
      </tr>
      <tr>
        <td className="persona">tu</td>
        <td><span className="ending cgray">-i</span></td>
        <td><span className="ending cgray">-ies</span></td>
        <td><span className="ending cgray">-j-i</span></td>
        <td><span className="ending cgray">-j-ies</span></td>
        <td><span className="ending cgray">-s-i</span></td>
        <td><span className="ending cgray">-s-ies</span></td>
      </tr>
      <tr>
        <td className="persona">3 pers.</td>
        <td><span className="ending cgray">-a</span></td>
        <td><span className="ending cgray">-ās</span></td>
        <td><span className="ending cgray">-j-a</span></td>
        <td><span className="ending cgray">j-ās</span></td>
        <td><span className="ending cgray">-s</span></td>
        <td><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>ie</span>s</span></td>
      </tr>
      <tr>
        <td className="persona">mēs</td>
        <td><span className="ending cgray">-ām</span></td>
        <td><span className="ending cgray">-āmies</span></td>
        <td><span className="ending cgray">-j-ām</span></td>
        <td><span className="ending cgray">-j-āmies</span></td>
        <td><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>i</span>m</span></td>
        <td><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>i</span>mies</span></td>
      </tr>
      <tr>
        <td className="persona">jūs</td>
        <td><span className="ending cgray">-āt</span></td>
        <td><span className="ending cgray">-āties</span></td>
        <td><span className="ending cgray">-j-āt</span></td>
        <td><span className="ending cgray">-j-āties</span></td>
        <td><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>ie</span>t/-<span className="c3" style={{padding: 0}}>i</span>t</span></td>
        <td><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>ie</span>ties/-<span className="c3" style={{padding: 0}}>i</span>ties</span></td>
      </tr>
      </tbody>
    </table>
      <FloatLettersLayer letters={TABLE2_FLOAT_LETTERS} />
      <div className="polygon-overlay" id="overlay2" />
    </div>
    <p className="hl-note"><span className="pill" style={{borderColor: '#3a4c62'}}>Цвета</span> <span className="ending c1">I grupa</span> · <span className="ending c2">II grupa</span> · <span className="ending c3">III grupa (-īt/-ināt/zināt; nākotne –š-)</span> · <span className="ending c4">III grupa (-āt)</span></p>
  </div>
    </TableCard>
  );
}



