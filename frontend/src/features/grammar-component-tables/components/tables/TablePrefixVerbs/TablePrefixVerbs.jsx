import TableCard from '../../TableCard.jsx';
import './TablePrefixVerbs.css';
export default function TablePrefixVerbs() {
  return (
    <TableCard>
      <div className="card table-prefix-verbs" id="prefix-verbs-table-container">
      <div className="title-banner" style={{background: '#E2E8FB', color: '#1a1a1a'}}>Verba «nest» ar priedēkļiem</div>
      <h2 style={{margin: '0 0 12px 0', fontSize: '1.1rem'}}>Priedēklis + nest (Приставка + нести)</h2>
      <p style={{margin: '0 0 16px 0', color: 'var(--muted)', fontSize: '0.9rem'}}>Глагол <em>nest</em> (нести) с разными приставками и соответствующие предлоги.</p>
      <table className="prefix-verbs" id="prefix-verbs-table">
        <colgroup>
          <col className="col-prefix" />
          <col className="col-verb" />
          <col className="col-meaning" />
          <col className="col-preposition" />
        </colgroup>
        <thead>
          <tr>
            <th colSpan="4" style={{background: '#E2E8FB', color: '#1a1a1a'}}>Глагольные приставки (Verbu priedēkļi)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="tt-prefix-aiz tt-verb-aiznest tt-root-nest">
            <td className="tt-col-prefix"><span className="prefix">aiz-</span></td>
            <td className="tt-col-verb"><span className="verb">aiznest</span></td>
            <td className="tt-col-meaning"><strong>у</strong>нести (прочь)</td>
            <td className="tt-col-preposition"><span className="prefix">aiz</span> <span className="adv-ru">— за, позади</span></td>
          </tr>
          <tr className="tt-prefix-ap tt-verb-apnest tt-root-nest">
            <td className="tt-col-prefix"><span className="prefix">ap-</span></td>
            <td className="tt-col-verb"><span className="verb">apnest</span></td>
            <td className="tt-col-meaning"><strong>об</strong>нести (вокруг), окружить</td>
            <td className="tt-col-preposition"><span className="prefix">ap</span> <span className="adv-ru">— вокруг, около</span></td>
          </tr>
          <tr className="tt-prefix-at tt-verb-atnest tt-root-nest">
            <td className="tt-col-prefix"><span className="prefix">at-</span></td>
            <td className="tt-col-verb"><span className="verb">atnest</span></td>
            <td className="tt-col-meaning"><strong>при</strong>нести обратно</td>
            <td className="tt-col-preposition">—</td>
          </tr>
          <tr className="tt-prefix-ie tt-verb-ienest tt-root-nest">
            <td rowSpan="2" className="tt-col-prefix"><span className="prefix">ie-</span></td>
            <td className="tt-col-verb"><span className="verb">ienest</span></td>
            <td className="tt-col-meaning"><strong>в</strong>нести (внутрь)</td>
            <td rowSpan="2" className="tt-col-preposition"><span className="prefix">iekš</span> <span className="adv-ru">— в, внутрь</span></td>
          </tr>
          <tr className="tt-prefix-ie tt-verb-iedot tt-root-dot">
            <td className="tt-col-verb"><span className="verb">iedot</span></td>
            <td className="tt-col-meaning">🛇дать (внутрь / кому-то)</td>
          </tr>
          <tr className="tt-prefix-iz tt-verb-iznest tt-root-nest">
            <td className="tt-col-prefix"><span className="prefix">iz-</span></td>
            <td className="tt-col-verb"><span className="verb">iznest</span></td>
            <td className="tt-col-meaning"><strong>вы</strong>нести</td>
            <td className="tt-col-preposition">—</td>
          </tr>
          <tr className="tt-prefix-no tt-verb-nonest tt-root-nest">
            <td className="tt-col-prefix"><span className="prefix">no-</span></td>
            <td className="tt-col-verb"><span className="verb">nonest</span></td>
            <td className="tt-col-meaning"><strong>с</strong>нести (вниз, с чего-то)</td>
            <td className="tt-col-preposition"><span className="prefix">no</span> <span className="adv-ru">— с, от</span></td>
          </tr>
          <tr className="tt-prefix-pa tt-verb-panest tt-root-nest">
            <td className="tt-col-prefix"><span className="prefix">pa-</span></td>
            <td className="tt-col-verb"><span className="verb">panest</span></td>
            <td className="tt-col-meaning">немного <strong>по</strong>нести / <strong>про</strong>нести</td>
            <td className="tt-col-preposition"><span className="prefix">pa</span> <span className="adv-ru">— по, через</span></td>
          </tr>
          <tr className="tt-prefix-par tt-verb-parnest tt-root-nest">
            <td rowSpan="2" className="tt-col-prefix"><span className="prefix">pār-</span></td>
            <td className="tt-col-verb"><span className="verb">pārnest</span></td>
            <td className="tt-col-meaning"><strong>пере</strong>нести (с одного места на другое)</td>
            <td rowSpan="2" className="tt-col-preposition"><span className="prefix">pār</span> <span className="adv-ru">— через, над</span></td>
          </tr>
          <tr className="tt-prefix-par tt-verb-pardot tt-root-dot">
            <td className="tt-col-verb"><span className="verb">pārdot</span></td>
            <td className="tt-col-meaning"><strong>про</strong>дать (не пере-дать)</td>
          </tr>
          <tr className="tt-prefix-pie tt-verb-pienest tt-root-nest">
            <td rowSpan="2" className="tt-col-prefix"><span className="prefix">pie-</span></td>
            <td className="tt-col-verb"><span className="verb">pienest</span></td>
            <td className="tt-col-meaning"><strong>под</strong>нести / <strong>при</strong>нести к</td>
            <td rowSpan="2" className="tt-col-preposition"><span className="prefix">pie</span> <span className="adv-ru">— у, к</span></td>
          </tr>
          <tr className="tt-prefix-pie tt-verb-piedot tt-root-dot">
            <td className="tt-col-verb"><span className="verb">piedot</span></td>
            <td className="tt-col-meaning">простить (дать обратно долг / отпустить вину)</td>
          </tr>
          <tr className="tt-prefix-sa tt-verb-sanest tt-root-nest">
            <td className="tt-col-prefix"><span className="prefix">sa-</span></td>
            <td className="tt-col-verb"><span className="verb">sanest</span></td>
            <td className="tt-col-meaning"><strong>на</strong>носить (в кучу, собрать)</td>
            <td className="tt-col-preposition">—</td>
          </tr>
          <tr className="tt-prefix-uz tt-verb-uznest tt-root-nest">
            <td className="tt-col-prefix"><span className="prefix">uz-</span></td>
            <td className="tt-col-verb"><span className="verb">uznest</span></td>
            <td className="tt-col-meaning"><strong>за</strong>нести (вверх)</td>
            <td className="tt-col-preposition"><span className="prefix">uz</span> <span className="adv-ru">— на, в</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    </TableCard>
  );
}



