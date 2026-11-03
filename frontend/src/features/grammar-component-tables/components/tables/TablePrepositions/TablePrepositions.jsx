import TableCard from '../../TableCard.jsx';
import './TablePrepositions.css';

export default function TablePrepositions() {
  return (
    <TableCard>
      <div className="card table-prepositions" id="prepositions-table-container">
        <h2>Prievārdi — предлоги и падежи</h2>
        <p className="muted">
          Частые латышские предлоги из шпаргалки: какой падеж требуют и как примерно переводятся.
        </p>
        <div className="prepositions-grid">
          <div>
            <table>
              <colgroup>
                <col style={{ width: '70px', minWidth: '70px' }} />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr className="tt-genitive tt-prep-aiz">
                  <td className="tt-prep-word">aiz</td>
                  <td className="tt-prep-meaning">за</td>
                  <td className="loc-case tt-case-cell tt-genitive" rowSpan={11}>ģenitīvs</td>
                  <td className="tt-prep-example">за столом</td>
                </tr>
                <tr className="tt-genitive tt-prep-pie">
                  <td className="tt-prep-word">pie</td>
                  <td className="tt-prep-meaning">у, к</td>
                  <td className="tt-prep-example">у дома, к другу</td>
                </tr>
                <tr className="tt-genitive tt-prep-virs">
                  <td className="tt-prep-word">virs</td>
                  <td className="tt-prep-meaning">над, поверх, сверх</td>
                  <td className="tt-prep-example">над столом, книга поверх журнала, цена свыше 100 евро</td>
                </tr>
                <tr className="predl-separate tt-genitive tt-prep-zem">
                  <td className="tt-prep-word">zem</td>
                  <td className="tt-prep-meaning">под</td>
                  <td className="tt-prep-example">под кроватью</td>
                </tr>
                <tr className="tt-genitive tt-prep-pirms">
                  <td className="tt-prep-word">pirms</td>
                  <td className="tt-prep-meaning">перед, до</td>
                  <td className="tt-prep-example">перед завтраком, до часа / час назад</td>
                </tr>
                <tr className="predl-separate tt-genitive tt-prep-pec">
                  <td className="tt-prep-word">pēc</td>
                  <td className="tt-prep-meaning">после</td>
                  <td className="tt-prep-example">после завтрака, после работы</td>
                </tr>
                <tr className="predl-separate tt-genitive tt-prep-kops">
                  <td className="tt-prep-word">kopš</td>
                  <td className="tt-prep-meaning">с (какого‑то времени)</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-genitive tt-prep-no">
                  <td className="tt-prep-word">no</td>
                  <td className="tt-prep-meaning">с, из</td>
                  <td className="tt-prep-example">из дома, с работы, из золота, подарок от меня, покраснел от стыда</td>
                </tr>
                <tr className="predl-separate tt-genitive tt-prep-arpus">
                  <td className="tt-prep-word">ārpus</td>
                  <td className="tt-prep-meaning">вне</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-genitive tt-prep-uz">
                  <td className="tt-prep-word">uz</td>
                  <td className="tt-prep-meaning">на</td>
                  <td className="tt-prep-example">на столе</td>
                </tr>
                <tr className="predl-separate tt-genitive tt-prep-bez">
                  <td className="tt-prep-word">bez</td>
                  <td className="tt-prep-meaning">без</td>
                  <td className="tt-prep-example" />
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <table>
              <colgroup>
                <col style={{ width: '70px', minWidth: '70px' }} />
                <col />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr className="tt-dative tt-prep-lidz">
                  <td className="tt-prep-word">līdz</td>
                  <td className="tt-prep-meaning">до</td>
                  <td className="loc-case tt-case-cell tt-dative" rowSpan={4}>datīvs</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-dative tt-prep-blakus">
                  <td className="tt-prep-word">Blakus</td>
                  <td className="tt-prep-meaning">рядом</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-dative tt-prep-pari">
                  <td className="tt-prep-word">Pāri</td>
                  <td className="tt-prep-meaning">через, свыше, сверх</td>
                  <td className="tt-prep-example">через мост, через стену</td>
                </tr>
                <tr className="predl-separate tt-dative tt-prep-preti">
                  <td className="tt-prep-word">Pretī</td>
                  <td className="tt-prep-meaning">напротив, навстречу</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-accusative tt-prep-ap">
                  <td className="tt-prep-word">ap</td>
                  <td className="tt-prep-meaning">около, вокруг</td>
                  <td className="loc-case tt-case-cell tt-accusative" rowSpan={10}>akuzatīvs</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-accusative tt-prep-pa">
                  <td className="tt-prep-word">pa</td>
                  <td className="tt-prep-meaning">по</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-accusative tt-prep-gar">
                  <td className="tt-prep-word">gar</td>
                  <td className="tt-prep-meaning">вдоль</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-accusative tt-prep-par-over">
                  <td className="tt-prep-word">pār</td>
                  <td className="tt-prep-meaning">через, над</td>
                  <td className="tt-prep-example">через горы, через поле, над городом</td>
                </tr>
                <tr className="tt-accusative tt-prep-pret">
                  <td className="tt-prep-word">pret</td>
                  <td className="tt-prep-meaning">против, к</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="predl-separate tt-accusative tt-prep-uz">
                  <td className="tt-prep-word">uz</td>
                  <td className="tt-prep-meaning">в, на</td>
                  <td className="tt-prep-example">в школу, на работу</td>
                </tr>
                <tr className="predl-separate tt-accusative tt-prep-starp">
                  <td className="tt-prep-word">starp</td>
                  <td className="tt-prep-meaning">между</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-accusative tt-prep-ar">
                  <td className="tt-prep-word">ar</td>
                  <td className="tt-prep-meaning">с</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-accusative tt-prep-par-about">
                  <td className="tt-prep-word">par</td>
                  <td className="tt-prep-meaning">о</td>
                  <td className="tt-prep-example" />
                </tr>
                <tr className="tt-accusative tt-prep-caur">
                  <td className="tt-prep-word">Caur</td>
                  <td className="tt-prep-meaning">через, сквозь</td>
                  <td className="tt-prep-example">через двери, через туннель, через интернет, через лес</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p
          className="prepositions-note"
          style={{
            marginTop: '16px',
            fontSize: '18.2px',
            fontWeight: 500,
            color: 'var(--text)',
            background: 'var(--table-row-odd)',
            padding: '10px 12px',
            borderLeft: '3px solid var(--accent2)',
            borderRadius: '4px',
          }}
        >
          <strong style={{ fontWeight: 500 }}>
            Во множественном числе существительные и прилагательные с этими предлогами всегда стоят в дательном падеже.
          </strong>
        </p>
      </div>
    </TableCard>
  );
}
