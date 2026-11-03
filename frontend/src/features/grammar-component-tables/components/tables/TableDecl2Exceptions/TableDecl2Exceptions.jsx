import TableCard from '../../TableCard.jsx';
import './TableDecl2Exceptions.css';

const NOUNS = [
  { id: 'udens', lv: 'ūdens', ru: 'вода' },
  { id: 'akmens', lv: 'akmens', ru: 'камень' },
  { id: 'asmens', lv: 'asmens', ru: 'лезвие' },
  { id: 'rudens', lv: 'rudens', ru: 'осень' },
  { id: 'zibens', lv: 'zibens', ru: 'молния' },
  { id: 'meness', lv: 'mēness', ru: 'луна' },
  { id: 'sals', lv: 'sāls', ru: 'соль' },
  { id: 'suns', lv: 'suns', ru: 'собака' },
];

export default function TableDecl2Exceptions() {
  return (
    <TableCard>
      <div className="card table-decl2-exceptions" id="decl2-exceptions-table-container">
        <table className="decl2-exceptions-table" id="decl2-exceptions-table">
          <thead>
            <tr>
              <th colSpan={8} className="decl2-exceptions-title">
                2. DEKLINĀCIJAS LIETVĀRDI (IZŅĒMUMI) (Существительные 2-го склонения, исключения)
              </th>
            </tr>
            <tr>
              {NOUNS.map((noun) => (
                <td key={noun.lv} className={`decl2-exceptions-noun tt-noun tt-noun-${noun.id}`}>
                  <strong>{noun.lv}</strong>
                  <br />
                  <span className="decl2-exceptions-ru">{noun.ru}</span>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={8} className="decl2-exceptions-note tt-note">
                Все эти слова склоняются по образцу существительных с окончанием <strong>-is</strong>.
                <br />
                <br />
                <strong className="tt-important">Важно:</strong> Смягчение согласной в единственном числе в форме <strong>Ģenitīvs</strong> (родительный падеж) происходит только у слова <strong><span className="decl2-exceptions-highlight">suns → suņa</span></strong>.
                <br />
                У остальных слов в <strong><span className="decl2-exceptions-highlight">Ģenitīvs единственного числа смягчения нет</span></strong>.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}
