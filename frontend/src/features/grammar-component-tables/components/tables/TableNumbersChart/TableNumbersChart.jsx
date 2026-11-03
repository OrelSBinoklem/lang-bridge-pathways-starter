import TableCard from '../../TableCard.jsx';
import './TableNumbersChart.css';

function Digit({ children }) {
  return <span className="num-digit">{children}</span>;
}

function End({ children }) {
  return <span className="num-end">{children}</span>;
}

function Padsmit() {
  return <span className="num-padsmit">padsmit</span>;
}

function Desmit() {
  return <span className="num-desmit">desmit</span>;
}

function Row({ digit, children, className = '' }) {
  return (
    <div className={`num-row tt-n-${digit} ${className}`.trim()}>
      <Digit>{digit}</Digit>
      <span className="num-word">{children}</span>
    </div>
  );
}

export default function TableNumbersChart() {
  return (
    <TableCard>
      <div className="card table-numbers-chart">
        <div className="num-grid">
          <div className="num-col tt-units">
            <Row digit="1">vien<End>s</End></Row>
            <Row digit="2">div<End>i</End></Row>
            <Row digit="3">trīs</Row>
            <Row digit="4">četr<End>i</End></Row>
            <Row digit="5">piec<End>i</End></Row>
            <Row digit="6">seš<End>i</End></Row>
            <Row digit="7">septiņ<End>i</End></Row>
            <Row digit="8">astoņ<End>i</End></Row>
            <Row digit="9">deviņ<End>i</End></Row>
          </div>

          <div className="num-col tt-teens">
            <Row digit="11">vien<Padsmit /></Row>
            <Row digit="12">div<Padsmit /></Row>
            <Row digit="13">trīs<Padsmit /></Row>
            <Row digit="14">četr<Padsmit /></Row>
            <Row digit="15">piec<Padsmit /></Row>
            <Row digit="16">seš<Padsmit /></Row>
            <Row digit="17">septiņ<Padsmit /></Row>
            <Row digit="18">astoņ<Padsmit /></Row>
            <Row digit="19">deviņ<Padsmit /></Row>
          </div>

          <div className="num-col tt-tens">
            <Row digit="10">
              <Desmit />
            </Row>
            <Row digit="20">div<Desmit /></Row>
            <Row digit="30">trīs<Desmit /></Row>
            <Row digit="40">četr<Desmit /></Row>
            <Row digit="50">piec<Desmit /></Row>
            <Row digit="60">seš<Desmit /></Row>
            <Row digit="70">septiņ<Desmit /></Row>
            <Row digit="80">astoņ<Desmit /></Row>
            <Row digit="90">deviņ<Desmit /></Row>
          </div>

          <div className="num-col tt-hundreds">
            <Row digit="100">simt<End>s</End></Row>
            <Row digit="200">
              div<End>i</End> simt<End>i</End>
            </Row>
            <Row digit="300">
              trīs simt<End>i</End>
            </Row>
            <Row digit="400">
              četr<End>i</End> simt<End>i</End>
            </Row>
            <Row digit="500">
              piec<End>i</End> simt<End>i</End>
            </Row>
            <Row digit="600">
              seš<End>i</End> simt<End>i</End>
            </Row>
            <Row digit="700">
              septiņ<End>i</End> simt<End>i</End>
            </Row>
            <Row digit="800">
              astoņ<End>i</End> simt<End>i</End>
            </Row>
            <Row digit="900">
              deviņ<End>i</End> simt<End>i</End>
            </Row>
          </div>

          <div className="num-col num-col-extra tt-extra">
            <Row digit="1000">tūkstot<End>is</End></Row>
            <div className="num-row num-row-compound tt-n-25">
              <Digit>25</Digit>
              <span className="num-stack">
                <span className="num-stack-line">
                  div<Desmit />
                </span>
                <span className="num-stack-line">
                  piec<End>i</End>
                </span>
              </span>
            </div>
            <div className="num-row num-row-compound tt-n-31">
              <Digit>31</Digit>
              <span className="num-stack">
                <span className="num-stack-line">
                  trīs<Desmit />
                </span>
                <span className="num-stack-line">
                  vien<End>s</End>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </TableCard>
  );
}
