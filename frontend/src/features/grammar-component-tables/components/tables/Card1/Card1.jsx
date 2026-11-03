import TableCard from '../../TableCard.jsx';

export default function Card1() {
  return (
    <TableCard>
      <div className="table-container" data-table-id="table1">
      <div className="polygon-toolbar">
        <button className="polygon-btn" data-action="create">Создать</button>
        <button className="polygon-btn" data-action="edit">Редактировать</button>
        <button className="polygon-btn" data-action="copy">Копировать</button>
        <button className="polygon-btn" data-action="delete">Удалить</button>
        <button className="polygon-btn" data-action="settings">Настройки</button>
        <button className="polygon-btn" data-action="json">JSON</button>
        <div className="color-picker">
          <label>Цвет:</label>
          <input type="color" id="gradStart1" value="#ffffff" title="Начало градиента" />
          <input type="color" id="gradEnd1" value="#e8edfb" title="Конец градиента" />
        </div>
        <button className="polygon-btn gradient-btn" data-table="1" data-gradient="1" title="Градиент на основе #F0F7F4">Гр1</button>
        <button className="polygon-btn gradient-btn" data-table="1" data-gradient="2" title="Градиент на основе #FFF5ED">Гр2</button>
      </div>
      <div className="polygon-settings" id="settings1">
        <h3>Настройки многоугольника</h3>
        <div className="setting-group">
          <label>Скругление углов:</label>
          <input type="range" min="0" max="20" value="8" id="roundness1" />
          <input type="number" min="0" max="20" value="8" id="roundnessNum1" />
        </div>
        <div className="setting-group">
          <label>Градиент:</label>
          <input type="color" id="gradStart1" value="#ffffff" />
          <input type="color" id="gradEnd1" value="#e8edfb" />
        </div>
        <div className="setting-group">
          <label>Обводка:</label>
          <input type="range" min="0" max="5" value="1.5" step="0.5" id="strokeWidth1" />
          <input type="color" id="strokeColor1" value="#c3cfee" />
        </div>
        <div className="setting-group">
          <label>Тень:</label>
          <input type="range" min="0" max="20" value="8" id="shadowBlur1" />
          <input type="range" min="0" max="10" value="2" id="shadowOffset1" />
          <input type="color" id="shadowColor1" value="#000000" />
          <input type="range" min="0" max="100" value="20" id="shadowOpacity1" />
        </div>
      </div>
    <table><colgroup><col style={{width: '70px', minWidth: '70px'}} /><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
      <thead>
        <tr>
          <th></th>
          <th className="fwnormal" colSpan="2">I</th>
          <th className="fwnormal group-ii" colSpan="2">II</th>
          <th className="fwnormal group-iii" colSpan="2">III</th>
          <th className="fwnormal group-iii" colSpan="2">III (искл.)</th>
        </tr>
        <tr>
          <th></th>
          <th className="fwnormal">-t</th>
          <th className="fwnormal">-ties</th>
          <th className="fwnormal group-ii"><span className="cgray">-t</span></th>
          <th className="fwnormal group-ii"><span className="cgray">-ties</span></th>
          <th className="fwnormal group-iii"><span className="cgray">-t</span></th>
          <th className="fwnormal group-iii"><span className="cgray">-ties</span></th>
          <th className="fwnormal group-iii"><span className="cgray">-t</span></th>
          <th className="fwnormal group-iii"><span className="cgray">-ties</span></th>
        </tr>
        <tr>
          <th></th>
          <th></th>
          <th></th>
          <th className="group-ii">-o<span className="mgray">t</span><br />-ā<span className="mgray">t</span><br />-ē<span className="mgray _snow">t</span></th>
          <th className="group-ii">-o<span className="mgray">ties</span><br />-ā<span className="mgray">ties</span><br />-ē<span className="mgray _snow">ties</span></th>
          <th className="group-iii">-ī<span className="mgray">t</span><br />-inā<span className="mgray">t</span><br />-zinā<span className="mgray">t</span></th>
          <th className="group-iii">-ī<span className="mgray">ties</span><br />-inā<span className="mgray">ties</span></th>
          <th className="group-iii">-ē<span className="mgray _snow">t</span><br />raudā<span className="mgray">t</span><br />dziedā<span className="mgray">t</span></th>
          <th className="group-iii">-ē<span className="mgray _snow">ties</span></th>
        </tr>
      </thead>
      <tbody>
      <tr>
        <td className="persona">es</td>
        <td><span className="ending">-u</span></td>
        <td><span className="ending">-os</span></td>
        <td><span className="ending cgray">-j-u</span></td>
        <td><span className="ending cgray">-j-os</span></td>
        <td><span className="ending cgray">-u</span></td>
        <td><span className="ending cgray">-os</span></td>
        <td><span className="ending cgray">-u</span></td>
        <td><span className="ending cgray">-os</span></td>
      </tr>
      <tr>
        <td className="persona">tu</td>
        <td><span className="ending c3">-/-i</span></td>
        <td><span className="ending">-ies</span></td>
        <td><span className="ending c3">—</span></td>
        <td><span className="ending cgray">-j-ies</span></td>
        <td><span className="ending cgray">-i</span></td>
        <td><span className="ending cgray">-ies</span></td>
        <td><span className="ending cgray">-i</span></td>
        <td><span className="ending cgray">-ies</span></td>
      </tr>
      <tr>
        <td className="persona">3 pers.</td>
        <td>—</td>
        <td><span className="ending">-as</span></td>
        <td><span className="ending cgray">—</span></td>
        <td><span className="ending cgray">-j-as</span></td>
        <td><span className="ending cgray">-a</span></td>
        <td><span className="ending cgray">-ās</span></td>
        <td><span className="ending cgray">—</span></td>
        <td><span className="ending cgray">-as</span></td>
      </tr>
      <tr>
        <td className="persona">mēs</td>
        <td><span className="ending">-am</span></td>
        <td><span className="ending">amies</span></td>
        <td><span className="ending cgray">-j-am</span></td>
        <td><span className="ending cgray">-j-amies</span></td>
        <td><span className="ending cgray">-ām</span></td>
        <td><span className="ending cgray">-āmies</span></td>
        <td><span className="ending cgray">-am</span></td>
        <td><span className="ending cgray">amies</span></td>
      </tr>
      <tr>
        <td className="persona">jūs</td>
        <td><span className="ending">-at</span></td>
        <td><span className="ending">-aties</span></td>
        <td><span className="ending cgray">-j-at</span></td>
        <td><span className="ending cgray">-j-aties</span></td>
        <td><span className="ending cgray">-āt</span></td>
        <td><span className="ending cgray">-āties</span></td>
        <td><span className="ending cgray">-at</span></td>
        <td><span className="ending cgray">-aties</span></td>
      </tr>
      </tbody>
    </table>
      <div className="polygon-overlay" id="overlay1" />
    </div>
    </TableCard>
  );
}



