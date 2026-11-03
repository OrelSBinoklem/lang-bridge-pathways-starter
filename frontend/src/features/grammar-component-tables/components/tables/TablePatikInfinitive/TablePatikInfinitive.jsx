import TableCard from '../../TableCard.jsx';
import './TablePatikInfinitive.css';

export default function TablePatikInfinitive() {
  return (
    <TableCard>
      <div className="card table-patik-infinitive">
        <table>
          <caption className="tt-title">Хочу, могу, нужно, нравится<span>Gribu / varu · vajag · patīk</span></caption>
          <colgroup><col style={{ width: '17%' }} /><col style={{ width: '16%' }} /><col style={{ width: '20%' }} /><col style={{ width: '47%' }} /></colgroup>
          <thead>
            <tr className="tt-pattern"><th colSpan="4">После этих слов следующий глагол не нужно спрягать</th></tr>
            <tr className="tt-headings"><th scope="col">Кто? / Кому?</th><th scope="col">Хочу / могу…</th><th scope="col">Что делать?</th><th scope="col">Перевод</th></tr>
          </thead>
          <tbody>
            <tr className="tt-example tt-modal-want"><th scope="row" className="tt-person">Es</th><td className="tt-verb">gribu</td><td className="tt-infinitive">lasīt</td><td className="tt-translation">Я хочу читать.</td></tr>
            <tr className="tt-example tt-modal-can"><th scope="row" className="tt-person">Es</th><td className="tt-verb">varu</td><td className="tt-infinitive">runāt</td><td className="tt-translation">Я могу говорить.</td></tr>
            <tr className="tt-example tt-vajag-man"><th scope="row" className="tt-dative">Man</th><td className="tt-verb">vajag</td><td className="tt-infinitive">mācīties</td><td className="tt-translation">Мне нужно учиться.</td></tr>
            <tr className="tt-example tt-person-man"><th scope="row" className="tt-dative">Man</th><td className="tt-verb">patīk</td><td className="tt-infinitive">ceļot</td><td className="tt-translation">Мне нравится путешествовать.</td></tr>
          </tbody>
          <tfoot>
            <tr className="tt-rule"><td colSpan="4">Следующий глагол остаётся в начальной форме: <strong>lasīt, runāt, mācīties, ceļot</strong>.</td></tr>
            <tr className="tt-exam"><td colSpan="4">На экзамене удобно строить фразы с этими словами: следующий глагол спрягать не придётся.</td></tr>
          </tfoot>
        </table>
      </div>
    </TableCard>
  );
}
