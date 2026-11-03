import TableCard from '../../TableCard.jsx';
import FloatLettersLayer from '../FloatLettersLayer.jsx';
import PolygonMarksLayer from '../PolygonMarksLayer.jsx';
import './TableVerbEndingsPast.css';

/** Trainer letters sit on the colored column overlays. */
const PAST_FLOAT_LETTERS = [
  { char: 'a', left: '20%', top: '79%' },
  { char: 'j', left: '45.2%', top: '42%' },
  { char: 'a', left: '45.2%', top: '78%' },
  { char: 'š', left: '76.4%', top: '36%', fontSize: '22px' },
  { char: 's', left: '76.5%', top: '72%' },
];

/** Table 91 stamps — move each via left / top / width / height. */
const PAST_POLYGONS = [
  {
    id: 't91-violet',
    color: 'violet',
    left: '76.47%',
    top: '44.18%',
    width: '5.9%',
    height: '54.81%',
    viewBox: '569.77 75.98 44.89 94.27',
    d: 'M 569.7735399982802 86.36213988177751 Q 570.6772602028904 77.35362729562871 579.6641829022035 76.25579779174728 L 604.5578406389245 75.98497527017307 Q 613.6666259765625 76.88593835401817 614.6666259765625 85.9843835401816 L 614.6666259765625 160.25267970452347 Q 613.6666259765625 169.35337465990548 604.5553685475255 170.25206077459396 L 580.4501711278534 169.98385594546025 Q 571.6561062345953 168.88594748753897 570.562000315329 160.09140869541145 Z',
  },
  {
    id: 't91-yellow-a',
    color: 'yellow',
    left: '17.53%',
    top: '58.42%',
    width: '5.28%',
    height: '40.34%',
    viewBox: '129.67 100.49 41 69.38',
    d: 'M 129.6666259765625 110.75127811090712 Q 130.6666259765625 101.86262781109072 139.54213879148367 100.75205299389174 L 160.54213879148367 100.49060964642604 Q 169.6666259765625 101.37709016579727 170.6666259765625 110.48983476344142 L 170.6666259765625 159.875 Q 169.6666259765625 168.875 160.6666259765625 169.875 L 139.6666259765625 169.875 Q 130.6666259765625 168.875 129.6666259765625 159.875 Z',
  },
  {
    id: 't91-green',
    color: 'green',
    left: '43.68%',
    top: '29.86%',
    width: '5.73%',
    height: '69.59%',
    viewBox: '326.75 51.36 45.83 119.69',
    d: 'M 326.7508749198972 61.44811096472832 Q 327.67501596896506 52.36456298828125 336.75052590058806 51.36456298828125 L 361.74982783760606 51.36456298828125 Q 370.67494616266686 52.36456298828125 371.7494788182969 61.28101501183418 L 372.5823770332278 160.9685455294123 Q 371.65823598415994 170.05209350585938 362.58272605253694 171.05209350585938 L 337.58342411551894 171.05209350585938 Q 328.65830579045814 170.05209350585938 327.5837731348281 161.13564148230645 Z',
  },
  {
    id: 't91-yellow-ja',
    color: 'yellow',
    left: '44.23%',
    top: '57.85%',
    width: '4.64%',
    height: '39.85%',
    viewBox: '330.81 99.5 37.71 68.55',
    d: 'M 330.8134149629289 109.88264644913218 Q 331.6811973220899 100.86109853940074 340.67439660862976 99.73693685039461 L 357.6752031480377 99.50240061021127 Q 366.68127797603063 100.37825160483554 367.81208636339335 109.35587774782356 L 368.51891981607673 157.90652209985882 Q 367.651961321299 167.05209350585938 358.5199794239274 168.05209350585938 L 341.5210247926706 168.05209350585938 Q 332.65206585817333 167.05209350585938 331.5221003237635 158.1987545609841 Z',
  },
  {
    id: 't91-pink',
    color: 'pink',
    left: '76.39%',
    top: '29.63%',
    width: '5.96%',
    height: '12.74%',
    viewBox: '570.67 50.97 44.6 21.91',
    d: 'M 570.6666259765625 59.87353660203723 Q 571.5270434570313 52.215460349656844 579.1750729444746 51.26989433548026 L 606.1551294199616 50.9697025838408 Q 613.8252770837504 51.76532435813477 615.053137048442 59.37824358134769 L 615.2666259765625 64.075 Q 614.7857173547407 72.03322311917371 606.8575397583444 72.875 L 579.27080078125 72.875 Q 571.5270434570313 72.01458251953125 570.6666259765625 64.2708251953125 Z',
  },
];

export default function TableVerbEndingsPast() {
  return (
    <TableCard>
      <div className="card table-verb-endings-past" style={{ position: 'relative' }}>
        <div className="table-container" data-table-id="table2">
        <PolygonMarksLayer marks={PAST_POLYGONS} />
          <table><colgroup><col style={{width: '70px', minWidth: '70px'}} /><col /><col /><col /><col /><col /><col /></colgroup>
      <thead>
        <tr className="tt-head-groups">
          <th rowSpan="2"></th>
          <th className="fwnormal tt-past-g1" colSpan="2">Pagātne — I</th>
          <th className="fwnormal group-ii tt-past-g23" colSpan="2">Pagātne — II, III</th>
          <th className="fwnormal tt-future" colSpan="2">Nākotne — I, II, III</th>
        </tr>
        <tr className="tt-head-forms">
          <th className="fwnormal tt-past-g1 tt-plain">-t</th>
          <th className="fwnormal tt-past-g1 tt-reflexive">-ties</th>
          <th className="group-ii tt-past-g23 tt-plain"><span className="cgray">-t</span></th>
          <th className="group-ii tt-past-g23 tt-reflexive"><span className="cgray">-ties</span></th>
          <th className="tt-future tt-plain"><span className="cgray">-t</span></th>
          <th className="tt-future tt-reflexive"><span className="cgray">-ties</span></th>
        </tr>
      </thead>
      <tbody>
      <tr className="tt-person-es">
        <td className="persona tt-person-label">es</td>
        <td className="tt-past-g1 tt-plain"><span className="ending cgray">-u</span></td>
        <td className="tt-past-g1 tt-reflexive"><span className="ending cgray">-os</span></td>
        <td className="tt-past-g23 tt-plain"><span className="ending cgray">-j-u</span></td>
        <td className="tt-past-g23 tt-reflexive"><span className="ending cgray">-j-os</span></td>
        <td className="tt-future tt-plain"><span className="ending cgray">-š-u</span></td>
        <td className="tt-future tt-reflexive"><span className="ending cgray">-š-os</span></td>
      </tr>
      <tr className="tt-person-tu">
        <td className="persona tt-person-label">tu</td>
        <td className="tt-past-g1 tt-plain"><span className="ending cgray">-i</span></td>
        <td className="tt-past-g1 tt-reflexive"><span className="ending cgray">-ies</span></td>
        <td className="tt-past-g23 tt-plain"><span className="ending cgray">-j-i</span></td>
        <td className="tt-past-g23 tt-reflexive"><span className="ending cgray">-j-ies</span></td>
        <td className="tt-future tt-plain"><span className="ending cgray">-s-i</span></td>
        <td className="tt-future tt-reflexive"><span className="ending cgray">-s-ies</span></td>
      </tr>
      <tr className="tt-person-third">
        <td className="persona tt-person-label">3 pers.</td>
        <td className="tt-past-g1 tt-plain"><span className="ending cgray">-a</span></td>
        <td className="tt-past-g1 tt-reflexive"><span className="ending cgray">-ās</span></td>
        <td className="tt-past-g23 tt-plain"><span className="ending cgray">-j-a</span></td>
        <td className="tt-past-g23 tt-reflexive"><span className="ending cgray">j-ās</span></td>
        <td className="tt-future tt-plain"><span className="ending cgray">-s</span></td>
        <td className="tt-future tt-reflexive"><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>ie</span>s</span></td>
      </tr>
      <tr className="tt-person-mes">
        <td className="persona tt-person-label">mēs</td>
        <td className="tt-past-g1 tt-plain"><span className="ending cgray">-ām</span></td>
        <td className="tt-past-g1 tt-reflexive"><span className="ending cgray">-āmies</span></td>
        <td className="tt-past-g23 tt-plain"><span className="ending cgray">-j-ām</span></td>
        <td className="tt-past-g23 tt-reflexive"><span className="ending cgray">-j-āmies</span></td>
        <td className="tt-future tt-plain"><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>i</span>m</span></td>
        <td className="tt-future tt-reflexive"><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>i</span>mies</span></td>
      </tr>
      <tr className="tt-person-jus">
        <td className="persona tt-person-label">jūs</td>
        <td className="tt-past-g1 tt-plain"><span className="ending cgray">-āt</span></td>
        <td className="tt-past-g1 tt-reflexive"><span className="ending cgray">-āties</span></td>
        <td className="tt-past-g23 tt-plain"><span className="ending cgray">-j-āt</span></td>
        <td className="tt-past-g23 tt-reflexive"><span className="ending cgray">-j-āties</span></td>
        <td className="tt-future tt-plain"><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>ie</span>t/-<span className="c3" style={{padding: 0}}>i</span>t</span></td>
        <td className="tt-future tt-reflexive"><span className="ending cgray">-s-<span className="c3" style={{padding: 0}}>ie</span>ties/-<span className="c3" style={{padding: 0}}>i</span>ties</span></td>
      </tr>
      </tbody>
    </table>
        <FloatLettersLayer letters={PAST_FLOAT_LETTERS} />
        </div>
        <p className="hl-note">
          <span className="pill" style={{ borderColor: '#3a4c62' }}>Цвета</span>{' '}
          <span className="ending c1">I grupa</span>
          {' · '}
          <span className="ending c2">II grupa</span>
          {' · '}
          <span className="ending c3">III grupa (-īt/-ināt/zināt; nākotne –š-)</span>
          {' · '}
          <span className="ending c4">III grupa (-āt)</span>
        </p>
      </div>
    </TableCard>
  );
}
