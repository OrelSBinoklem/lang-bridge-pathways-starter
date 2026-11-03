import TableCard from '../../TableCard.jsx';
import FloatLettersLayer from '../FloatLettersLayer.jsx';
import PolygonMarksLayer from '../PolygonMarksLayer.jsx';
import '../TableVerbEndingsPast/TableVerbEndingsPast.css';

/** First two trainer letters (present card only) — near green/yellow overlays. */
const PRESENT_FLOAT_LETTERS = [
  { char: 'j', left: '41.4%', top: '88%' },
  { char: 'a', left: '64.8%', top: '83.8%' },
];

/** Table 90 stamps — move each via left / top / width / height. */
const PRESENT_POLYGONS = [
  {
    id: 't90-green',
    color: 'green',
    left: '39.93%',
    top: '50.16%',
    width: '4.94%',
    height: '49%',
    viewBox: '296.67 145.63 37.93 142.24',
    d: 'M 296.6666259765625 155.65317144930177 Q 297.6532922363281 146.85281714493019 306.4444006166351 145.78690925194527 L 323.64717894644474 145.63192453737824 Q 332.67369019188595 146.5506427173362 333.7370213323722 155.56126285381595 L 334.59587476940163 277.8047441277197 Q 333.6595755355889 286.875 324.5961215668266 287.875 L 306.6666259765625 287.875 Q 297.6666259765625 286.875 296.6666259765625 277.875 L 296.6666259765625 242.275 Q 297.5066259765625 234.715 305.0666259765625 233.875 L 309.2666259765625 233.875 Q 316.8266259765625 233.035 317.6666259765625 225.475 L 317.6666259765625 178.97923538394392 Q 316.82662225542435 171.44167124957602 309.2915918169386 170.5792353839439 L 305.0416601361864 170.56658523373187 Q 297.50662969770065 169.70414936809976 296.6666259765625 162.16658523373187 Z',
  },
  {
    id: 't90-yellow',
    color: 'yellow',
    left: '64.6%',
    top: '70.06%',
    width: '5.34%',
    height: '29.06%',
    viewBox: '477.67 203.42 41 84.37',
    d: 'M 477.6666259765625 213.54588979895175 Q 478.6666259765625 204.59832982462174 487.6081895338836 203.54606054130105 L 508.6081895338836 203.4233419163487 Q 517.6666259765625 204.37042380685307 518.6666259765625 213.4231711739994 L 518.6666259765625 277.6226292824327 Q 517.6666259765625 286.54975377296984 508.74792658364214 287.6222987875358 L 487.74792658364214 287.79303570517106 Q 478.6666259765625 286.8668366200068 477.6666259765625 277.79336620006796 Z',
  },
];

export default function TableVerbEndingsPresent() {
  return (
    <TableCard>
      <div className="card table-verb-endings-present" style={{ position: 'relative' }}>
        <div className="table-container" data-table-id="table1">
        <PolygonMarksLayer marks={PRESENT_POLYGONS} />
          <table><colgroup><col style={{width: '70px', minWidth: '70px'}} /><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
      <thead>
        <tr className="tt-head-groups">
          <th></th>
          <th className="fwnormal tt-g1" colSpan="2">I</th>
          <th className="fwnormal group-ii tt-g2" colSpan="2">II</th>
          <th className="fwnormal group-iii tt-g3" colSpan="2">III</th>
          <th className="fwnormal group-iii tt-g3x" colSpan="2">III (искл.)</th>
        </tr>
        <tr className="tt-head-forms">
          <th></th>
          <th className="fwnormal tt-g1 tt-plain">-t</th>
          <th className="fwnormal tt-g1 tt-reflexive">-ties</th>
          <th className="fwnormal group-ii tt-g2 tt-plain"><span className="cgray">-t</span></th>
          <th className="fwnormal group-ii tt-g2 tt-reflexive"><span className="cgray">-ties</span></th>
          <th className="fwnormal group-iii tt-g3 tt-plain"><span className="cgray">-t</span></th>
          <th className="fwnormal group-iii tt-g3 tt-reflexive"><span className="cgray">-ties</span></th>
          <th className="fwnormal group-iii tt-g3x tt-plain"><span className="cgray">-t</span></th>
          <th className="fwnormal group-iii tt-g3x tt-reflexive"><span className="cgray">-ties</span></th>
        </tr>
        <tr className="tt-head-stems">
          <th className="tt-g1 tt-plain"></th>
          <th className="tt-g1 tt-reflexive"></th>
          <th></th>
          <th className="group-ii tt-g2 tt-plain">-o<span className="mgray">t</span><br />-ā<span className="mgray">t</span><br />-ē<span className="mgray _snow">t</span></th>
          <th className="group-ii tt-g2 tt-reflexive">-o<span className="mgray">ties</span><br />-ā<span className="mgray">ties</span><br />-ē<span className="mgray _snow">ties</span></th>
          <th className="group-iii tt-g3 tt-plain">-ī<span className="mgray">t</span><br />-inā<span className="mgray">t</span><br />-zinā<span className="mgray">t</span></th>
          <th className="group-iii tt-g3 tt-reflexive">-ī<span className="mgray">ties</span><br />-inā<span className="mgray">ties</span></th>
          <th className="group-iii tt-g3x tt-plain">-ē<span className="mgray _snow">t</span><br />raudā<span className="mgray">t</span><br />dziedā<span className="mgray">t</span></th>
          <th className="group-iii tt-g3x tt-reflexive">-ē<span className="mgray _snow">ties</span></th>
        </tr>
      </thead>
      <tbody>
      <tr className="tt-person-es">
        <td className="persona tt-person-label">es</td>
        <td className="tt-g1 tt-plain"><span className="ending">-u</span></td>
        <td className="tt-g1 tt-reflexive"><span className="ending">-os</span></td>
        <td className="tt-g2 tt-plain"><span className="ending cgray">-j-u</span></td>
        <td className="tt-g2 tt-reflexive"><span className="ending cgray">-j-os</span></td>
        <td className="tt-g3 tt-plain"><span className="ending cgray">-u</span></td>
        <td className="tt-g3 tt-reflexive"><span className="ending cgray">-os</span></td>
        <td className="tt-g3x tt-plain"><span className="ending cgray">-u</span></td>
        <td className="tt-g3x tt-reflexive"><span className="ending cgray">-os</span></td>
      </tr>
      <tr className="tt-person-tu">
        <td className="persona tt-person-label">tu</td>
        <td className="tt-g1 tt-plain"><span className="ending c3">-/-i</span></td>
        <td className="tt-g1 tt-reflexive"><span className="ending">-ies</span></td>
        <td className="tt-g2 tt-plain"><span className="ending c3">—</span></td>
        <td className="tt-g2 tt-reflexive"><span className="ending cgray">-j-ies</span></td>
        <td className="tt-g3 tt-plain"><span className="ending cgray">-i</span></td>
        <td className="tt-g3 tt-reflexive"><span className="ending cgray">-ies</span></td>
        <td className="tt-g3x tt-plain"><span className="ending cgray">-i</span></td>
        <td className="tt-g3x tt-reflexive"><span className="ending cgray">-ies</span></td>
      </tr>
      <tr className="tt-person-third">
        <td className="persona tt-person-label">3 pers.</td>
        <td className="tt-g1 tt-plain">—</td>
        <td className="tt-g1 tt-reflexive"><span className="ending">-as</span></td>
        <td className="tt-g2 tt-plain"><span className="ending cgray">—</span></td>
        <td className="tt-g2 tt-reflexive"><span className="ending cgray">-j-as</span></td>
        <td className="tt-g3 tt-plain"><span className="ending cgray">-a</span></td>
        <td className="tt-g3 tt-reflexive"><span className="ending cgray">-ās</span></td>
        <td className="tt-g3x tt-plain"><span className="ending cgray">—</span></td>
        <td className="tt-g3x tt-reflexive"><span className="ending cgray">-as</span></td>
      </tr>
      <tr className="tt-person-mes">
        <td className="persona tt-person-label">mēs</td>
        <td className="tt-g1 tt-plain"><span className="ending">-am</span></td>
        <td className="tt-g1 tt-reflexive"><span className="ending">amies</span></td>
        <td className="tt-g2 tt-plain"><span className="ending cgray">-j-am</span></td>
        <td className="tt-g2 tt-reflexive"><span className="ending cgray">-j-amies</span></td>
        <td className="tt-g3 tt-plain"><span className="ending cgray">-ām</span></td>
        <td className="tt-g3 tt-reflexive"><span className="ending cgray">-āmies</span></td>
        <td className="tt-g3x tt-plain"><span className="ending cgray">-am</span></td>
        <td className="tt-g3x tt-reflexive"><span className="ending cgray">amies</span></td>
      </tr>
      <tr className="tt-person-jus">
        <td className="persona tt-person-label">jūs</td>
        <td className="tt-g1 tt-plain"><span className="ending">-at</span></td>
        <td className="tt-g1 tt-reflexive"><span className="ending">-aties</span></td>
        <td className="tt-g2 tt-plain"><span className="ending cgray">-j-at</span></td>
        <td className="tt-g2 tt-reflexive"><span className="ending cgray">-j-aties</span></td>
        <td className="tt-g3 tt-plain"><span className="ending cgray">-āt</span></td>
        <td className="tt-g3 tt-reflexive"><span className="ending cgray">-āties</span></td>
        <td className="tt-g3x tt-plain"><span className="ending cgray">-at</span></td>
        <td className="tt-g3x tt-reflexive"><span className="ending cgray">-aties</span></td>
      </tr>
      </tbody>
    </table>
        <FloatLettersLayer letters={PRESENT_FLOAT_LETTERS} />
        </div>
      </div>
    </TableCard>
  );
}
