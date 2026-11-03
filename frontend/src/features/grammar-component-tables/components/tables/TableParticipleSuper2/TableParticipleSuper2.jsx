import TableCard from '../../TableCard.jsx';
import './TableParticipleSuper2.css';

export default function TableParticipleSuper2() {
  return (
    <TableCard>
      <div className="card table-participle-super" id="participle-super-table-container">
        <div className="participle-super-flex-table" id="participle-super-table">
          <div className="participle-super-header tt-head-main">
            <div>Тип причастия<br /><small>(Divdabja veids)</small></div>
            <div>Базовая форма<br /><small>(Pamatforma)</small></div>
            <div style={{ flex: 2 }}>Причастие (неопределенное и определенное)<br /><small>(Divdabis (nenoteiktā un noteiktā galotne))</small></div>
          </div>
          <div className="participle-super-subheader tt-head-number">
            <div></div>
            <div></div>
            <div style={{ flex: 1 }}>Vienskaitlis</div>
            <div style={{ flex: 1 }}>Daudzskaitlis</div>
          </div>
          <div id="participle-super-table-body">
            <div className="participle-super-row participle-super-row-section tt-active-present">
              <div className="participle-super-cell participle-super-cell-header tt-col-type">Действ. залог, наст. время</div>
              <div className="participle-super-cell tt-col-base">top-<span className="participle-super-ending-masc">u</span></div>
              <div className="participle-super-cell tt-col-singular">
                top+<span className="participle-super-ending-os">oš</span><span className="participle-super-ending-masc">s</span>, top+<span className="participle-super-ending-os">oš</span><span className="participle-super-ending-fem">a</span>
                <br />
                top+<span className="participle-super-ending-os">oš</span><span className="participle-super-ending-masc">ais</span>, top+<span className="participle-super-ending-os">oš</span><span className="participle-super-ending-fem">ā</span>
              </div>
              <div className="participle-super-cell tt-col-plural">
                top+<span className="participle-super-ending-os">oš</span><span className="participle-super-ending-masc">i</span>, top+<span className="participle-super-ending-os">oš</span><span className="participle-super-ending-fem">as</span>
                <br />
                top+<span className="participle-super-ending-os">oš</span><span className="participle-super-ending-masc">ie</span>, top+<span className="participle-super-ending-os">oš</span><span className="participle-super-ending-fem">ās</span>
              </div>
            </div>

            <div className="participle-super-row participle-super-row-section tt-active-past">
              <div className="participle-super-cell participle-super-cell-header tt-col-type">Действ. залог, прош. время</div>
              <div className="participle-super-cell tt-col-base">nes-<span className="participle-super-ending-masc">u</span></div>
              <div className="participle-super-cell tt-col-singular">
                nes+<span className="participle-super-ending-masc">is</span>, nes+<span className="participle-super-ending-fem">usi</span>
                <br />
                nes+<span className="participle-super-ending-am">uš</span><span className="participle-super-ending-masc">ais</span>, nes+<span className="participle-super-ending-fem">usī</span>
              </div>
              <div className="participle-super-cell tt-col-plural">
                nes+<span className="participle-super-ending-am">uš</span><span className="participle-super-ending-masc">i</span>, nes+<span className="participle-super-ending-am">uš</span><span className="participle-super-ending-fem">as</span>
                <br />
                nes+<span className="participle-super-ending-am">uš</span><span className="participle-super-ending-masc">ie</span>, nes+<span className="participle-super-ending-am">uš</span><span className="participle-super-ending-fem">ās</span>
              </div>
            </div>

            <div className="participle-super-row tt-active-past tt-reflexive-row">
              <div className="participle-super-cell tt-col-type"></div>
              <div className="participle-super-cell tt-col-base">skatīj-<span className="participle-super-ending-masc">os</span></div>
              <div className="participle-super-cell tt-col-singular">
                skatīj+<span className="participle-super-ending-masc">ies</span>, skatīj+<span className="participle-super-ending-fem">usies</span>
              </div>
              <div className="participle-super-cell tt-col-plural">
                skatīj+<span className="participle-super-ending-masc">ušies</span>, skatīj+<span className="participle-super-ending-fem">ušās</span>
              </div>
            </div>

            <div className="participle-super-row participle-super-note-row tt-note-row tt-active-note">
              <div className="participle-super-cell tt-col-type"></div>
              <div className="participle-super-cell tt-col-base"></div>
              <div className="participle-super-cell participle-super-note tt-col-note" style={{ flex: 2 }}>
                <span className="participle-super-note-text">
                  Не-возвратные склоняются как обычно с <strong>неопределёнными</strong> и <strong>определёнными</strong> окончаниями и суффиксом <span className="participle-super-ending-am">uš</span>. Возвратные склоняются только с <strong>определёнными</strong> окончаниями и суффиксом <span className="participle-super-ending-am">uš</span> но после окончания определённого добавляется <span className="participle-super-ending-am">s</span>.
                </span>
              </div>
            </div>

            <div className="participle-super-row participle-super-row-section tt-passive-present">
              <div className="participle-super-cell participle-super-cell-header tt-col-type">Страдат. залог, наст. время</div>
              <div className="participle-super-cell tt-col-base">ved-<span className="participle-super-ending-masc">u</span></div>
              <div className="participle-super-cell tt-col-singular">
                ved+<span className="participle-super-ending-am">am</span><span className="participle-super-ending-masc">s</span>, ved+<span className="participle-super-ending-am">am</span><span className="participle-super-ending-fem">a</span>
                <br />
                ved+<span className="participle-super-ending-am">am</span><span className="participle-super-ending-masc">ais</span>, ved+<span className="participle-super-ending-am">am</span><span className="participle-super-ending-fem">ā</span>
              </div>
              <div className="participle-super-cell tt-col-plural">
                ved+<span className="participle-super-ending-am">am</span><span className="participle-super-ending-masc">i</span>, ved+<span className="participle-super-ending-am">am</span><span className="participle-super-ending-fem">as</span>
                <br />
                ved+<span className="participle-super-ending-am">am</span><span className="participle-super-ending-masc">ie</span>, ved+<span className="participle-super-ending-am">am</span><span className="participle-super-ending-fem">ās</span>
              </div>
            </div>

            <div className="participle-super-row participle-super-note-row tt-note-row tt-passive-present-note">
              <div className="participle-super-cell tt-col-type"></div>
              <div className="participle-super-cell tt-col-base"></div>
              <div className="participle-super-cell participle-super-note tt-col-note" style={{ flex: 2 }}>
                <span className="participle-super-note-text">
                  Если основа 3-го лица оканчивается на согласную или возвратный глагол: <span className="participle-super-ending-masc">-āms</span>/<span className="participle-super-ending-fem">-āma</span>.
                </span>
              </div>
            </div>

            <div className="participle-super-row participle-super-row-section tt-passive-past">
              <div className="participle-super-cell participle-super-cell-header tt-col-type">Страдат. залог, прош. время</div>
              <div className="participle-super-cell tt-col-base">lasī-<span className="participle-super-ending-masc">t</span></div>
              <div className="participle-super-cell tt-col-singular">
                lasī+<span className="participle-super-ending-am">t</span><span className="participle-super-ending-masc">s</span>, lasī+<span className="participle-super-ending-am">t</span><span className="participle-super-ending-fem">a</span>
                <br />
                lasī+<span className="participle-super-ending-am">t</span><span className="participle-super-ending-masc">ais</span>, lasī+<span className="participle-super-ending-am">t</span><span className="participle-super-ending-fem">ā</span>
              </div>
              <div className="participle-super-cell tt-col-plural">
                lasī+<span className="participle-super-ending-am">t</span><span className="participle-super-ending-masc">i</span>, lasī+<span className="participle-super-ending-am">t</span><span className="participle-super-ending-fem">as</span>
                <br />
                lasī+<span className="participle-super-ending-am">t</span><span className="participle-super-ending-masc">ie</span>, lasī+<span className="participle-super-ending-am">t</span><span className="participle-super-ending-fem">ās</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TableCard>
  );
}
