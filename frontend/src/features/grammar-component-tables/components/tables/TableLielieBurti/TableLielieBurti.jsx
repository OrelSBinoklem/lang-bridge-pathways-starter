import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TableLielieBurti.css';

/**
 * The source lists 17 categories, but they reduce to three patterns of which
 * words get a capital. Each pattern shows its everyday cases with an example;
 * rarer cases are only named, so the learner memorises the frequent ones first.
 */
const RULES = [
  {
    id: 'first',
    name: 'Только первое слово',
    lv: 'tikai pirmo vārdu',
    frequent: [
      { label: 'география', example: 'Vidzemes augstiene' },
      { label: 'праздники', example: 'Mātes diena' },
      { label: 'книги и фильмы', example: 'romāns „Zvejnieka dēls”' },
      { label: 'должности и учреждения', example: 'Ministru prezidents' },
    ],
    rare: 'исторические события, премии, памятники',
  },
  {
    id: 'all',
    name: 'Все значимые слова',
    lv: 'visus pilnas nozīmes vārdus',
    frequent: [
      { label: 'страны', example: 'Igaunijas Republika' },
      { label: 'международные организации', example: 'Pasaules Veselības Organizācija' },
      { label: 'вуз «место + Universitāte»', example: 'Latvijas Universitāte' },
    ],
    rare: 'газеты и журналы, созвездия, ордена',
  },
  {
    id: 'after',
    name: 'Имя + следующее слово',
    lv: 'pirmo vārdu aiz īpašvārda (3+ vārdi)',
    frequent: [
      { label: 'учебные заведения', example: 'Latvijas Mākslas akadēmija' },
      { label: 'учреждения', example: 'Latvijas Nacionālā opera' },
    ],
    rare: 'некоторые государственные праздники, названия со словами valsts, tautas, olimpiskais',
  },
];

/** Highlights the first letter of every word that starts with a capital. */
function Caps({ text }) {
  return text.split(/(\s+)/).map((token, i) => {
    const m = token.match(/^([^\p{L}]*)(\p{L})(.*)$/u);
    if (!m || m[2] === m[2].toLowerCase()) return token;
    return (
      <span key={i}>
        {m[1]}
        <span className="lb-cap">{m[2]}</span>
        {m[3]}
      </span>
    );
  });
}

export default function TableLielieBurti() {
  return (
    <TableCard>
      <div className="card table-lielie-burti">
        <header className="vs-head">
          <h2 className="vs-title">Lielie sākumburti nosaukumos</h2>
        </header>

        <div className="lb-rules">
          {RULES.map((rule, i) => (
            <section className={`lb-rule lb-rule--${rule.id}`} key={rule.id}>
              <div className="lb-rule-head">
                <span className="lb-num">{i + 1}</span>
                <span className="lb-titles">
                  <span className="lb-name">{rule.name}</span>
                  <span className="lb-lv">{rule.lv}</span>
                </span>
              </div>

              <ul className="lb-list">
                {rule.frequent.map((item) => (
                  <li className={`lb-item tt-item-${wordId(item.example)}`} key={item.example}>
                    <span className="lb-label">⭐ {item.label}</span>
                    <span className="lb-example"><Caps text={item.example} /></span>
                  </li>
                ))}
              </ul>

              <div className="lb-rare">
                <span className="lb-rare-label">Реже:</span> {rule.rare}
              </div>
            </section>
          ))}
        </div>

        <div className="lb-note">
          ⭐ — встречается чаще всего, запомните в первую очередь. Зелёным отмечены буквы, которые пишутся заглавными.
        </div>
      </div>
    </TableCard>
  );
}
