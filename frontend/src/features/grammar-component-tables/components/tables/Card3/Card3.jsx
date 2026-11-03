import TableCard from '../../TableCard.jsx';

export default function Card3() {
  return (
    <TableCard>
      <div>
      <h2>Примеры‑шаблоны (по глаголам)</h2>
      <p className="muted">Шаблон = <span className="kbd">основа</span> + <span className="kbd">окончание</span>. Для тренировки окончаний достаточно «на глаз» соединять: <i>nes</i> + <span className="ending c1">u</span> → <b>nes<u>u</u></b>.</p>
      <table>
        <thead>
          <tr><th>Grupa</th><th>Infinitīvs</th><th>Šablons (es/tu/viņš · tagadne)</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>I</td>
            <td>nest</td>
            <td><b>nes</b><span className="ending c1">u</span> · <b>nes</b><span className="ending c1">/-i</span> · <b>nes</b>—</td>
          </tr>
          <tr>
            <td>II</td>
            <td>domāt</td>
            <td><b>domā</b><span className="ending c2">j‑u</span> · <b>domā</b><span className="ending c2">j‑ies</span> · <b>domā</b>—</td>
          </tr>
          <tr>
            <td>III (-īt)</td>
            <td>zināt</td>
            <td><b>zin</b><span className="ending c3">u</span> · <b>zin</b><span className="ending c3">i</span> · <b>zin</b><span className="ending c3">a</span></td>
          </tr>
          <tr>
            <td>III (-āt)</td>
            <td>raudāt</td>
            <td><b>raud</b><span className="ending c4">u</span> · <b>raud</b><span className="ending c4">i</span> · <b>raud</b>—</td>
          </tr>
        </tbody>
      </table>
      <p className="muted">В будущем у всех групп добавляется -<b>š</b>-: <span className="kbd">osnova</span> + <span className="ending c3">‑šu/‑si/‑s/‑sim/‑siet</span>… Длина гласной основы может меняться (ī/ā).</p>
    </div>
    </TableCard>
  );
}



