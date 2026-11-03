import TableCard from '../../TableCard.jsx';
import { Marked } from './Vienlidzigi.jsx';

/** Every pattern uses the same members, so only the punctuation around V changes. */
const PATTERNS = [
  {
    scheme: '… [[V]]: {{v}}, {{v}} un {{v}}.',
    lv: 'Tirgū nopirkām [[dārzeņus]]: {{kartupeļus}}, {{burkānus}} un {{kāpostus}}.',
  },
  {
    scheme: '{{v}}, {{v}}, {{v}} — [[V]] …',
    lv: '{{Kartupeļi}}, {{burkāni}}, {{kāposti}} — [[tas viss]] aug mūsu dārzā.',
  },
  {
    scheme: '… [[V]] — {{v}}, {{v}}, {{v}} — …',
    lv: '[[Dārzeņos]] — {{kartupeļos}}, {{burkānos}}, {{kāpostos}} — ir daudz vitamīnu.',
  },
  {
    scheme: '[[V]] — {{v}}, {{v}}, {{v}} — [[V]] …',
    lv: '[[Visur]] — {{virtuvē}}, {{dārzā}}, {{pagrabā}} — [[visur]] bija dārzeņi.',
  },
  {
    scheme: '[[V]], kā {{v}}, {{v}}, {{v}}, …',
    lv: '[[Dārzeņos]], kā {{kartupeļos}}, {{burkānos}}, {{kāpostos}}, ir daudz vitamīnu.',
  },
  {
    scheme: 'Tādā [[V]] kā {{v}}, {{v}}, {{v}} …',
    lv: 'Tādos [[dārzeņos]] kā {{kartupeļos}}, {{burkānos}}, {{kāpostos}} ir daudz vitamīnu.',
  },
];

export default function TableVienlidzigi2() {
  return (
    <TableCard>
      <div className="card table-vienlidzigi">
        <header className="vs-head">
          <h2 className="vs-title">Однородные члены предложения и обобщающее слово</h2>
        </header>

        <div className="vl-intro">
          Обобщающее слово объединяет все перечисленные однородные члены. Знаки зависят от того, где оно стоит.
        </div>

        <div className="vl-legend">
          <span><span className="vl-gen">V</span> — обобщающее слово</span>
          <span><span className="vl-mem">v</span> — однородные члены</span>
        </div>

        <table className="vl-table">
          <tbody>
            {PATTERNS.map((p, index) => (
              <tr key={p.scheme} className={`tt-pattern-${index + 1}`}>
                <td className="vl-scheme"><Marked text={p.scheme} /></td>
                <td className="vl-lv"><Marked text={p.lv} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="vl-note">
          💡 Последние две строки отличаются одним словом: с <em>tāds … kā</em> запятая перед <em>kā</em> не нужна.
        </div>
      </div>
    </TableCard>
  );
}
