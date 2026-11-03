import TableCard from '../../TableCard.jsx';
export default function Celt() {
  return (
    <TableCard>
      <div>
    <h2>celt — поднимать</h2>
    <table><colgroup><col style={{width: '70px', minWidth: '70px'}} /><col /><col /><col /></colgroup>
      <thead>
        <tr>
          <th></th>
          <th>Pagātne</th>
          <th>Tagadne</th>
          <th>Nākotne</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="persona">Es</td>
          <td>cēlu</td>
          <td>ceļu</td>
          <td>celšu</td>
        </tr>
        <tr>
          <td className="persona">Tu</td>
          <td>cēli</td>
          <td>ceļ</td>
          <td>celsi</td>
        </tr>
        <tr>
          <td className="persona">3 pers.</td>
          <td>cēla</td>
          <td>ceļ</td>
          <td>cels</td>
        </tr>
        <tr>
          <td className="persona">Mēs</td>
          <td>cēlām</td>
          <td>ceļam</td>
          <td>celsim</td>
        </tr>
        <tr>
          <td className="persona">Jūs</td>
          <td>cēlāt</td>
          <td>ceļat</td>
          <td>celsiet</td>
        </tr>
      </tbody>
    </table>
  </div>
    </TableCard>
  );
}



