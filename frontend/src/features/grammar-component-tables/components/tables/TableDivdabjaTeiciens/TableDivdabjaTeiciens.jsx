import TableCard from '../../TableCard.jsx';
import './TableDivdabjaTeiciens.css';

/**
 * [[…]] marks the participial phrase, {{…}} the participle inside it; commas
 * are highlighted automatically, so the comma rule is visible in every example.
 */
const TYPES = [
  {
    id: 'act',
    name: 'Lokāmais darāmās kārtas pagātnes',
    endings: '-is · -usi · -ies · -usies',
    lv: '[[Jau no mazotnes pie tādas dzīves {{pieradusi}}]], viņa prata samierināties.',
    ru: 'Привыкшая к такой жизни с детства, она умела смиряться.',
  },
  {
    id: 'pas',
    name: 'Lokāmais ciešamās kārtas pagātnes',
    endings: '-ts · -ta',
    lv: '[[Dusmu {{pārņemts}}]], devos viņu virzienā.',
    ru: 'Охваченный гневом, я направился к ним.',
  },
  {
    id: 'dams',
    name: 'Daļēji lokāmais',
    endings: '-dams · -dama · -damies · -damās',
    lv: 'Bērni, [[pie zariem {{turēdamies}}]], kāpa lejup no kalna.',
    ru: 'Дети, держась за ветки, спускались с горы.',
  },
  {
    id: 'ot',
    name: 'Nelokāmais',
    endings: '-ot · -oties',
    lv: '[[Saulei {{austot}}]], mēs devāmies ceļā.',
    ru: 'Когда взошло солнце, мы отправились в путь.',
  },
];

/** One phrase moved around the sentence — the commas follow it. */
const POSITIONS = [
  { id: 'start', where: 'в начале', rule: 'запятая после', lv: '[[Saulei {{austot}}]], mēs devāmies ceļā.' },
  { id: 'end', where: 'в конце', rule: 'запятая перед', lv: 'Mēs devāmies ceļā, [[saulei {{austot}}]].' },
  { id: 'middle', where: 'в середине', rule: 'запятые с обеих сторон', lv: 'Mēs, [[saulei {{austot}}]], devāmies ceļā.' },
];

function Commas({ text }) {
  return text.split(/(,)/).map((p, i) => (p === ',' ? <span className="dt-comma" key={i}>,</span> : p));
}

function Marked({ text }) {
  return text.split(/(\[\[.+?\]\])/).map((part, i) => {
    if (!part.startsWith('[[')) return <Commas text={part} key={i} />;
    return (
      <span className="dt-phrase" key={i}>
        {part.slice(2, -2).split(/(\{\{.+?\}\})/).map((p, j) =>
          p.startsWith('{{') ? <span className="dt-part" key={j}>{p.slice(2, -2)}</span> : p,
        )}
      </span>
    );
  });
}

export default function TableDivdabjaTeiciens() {
  return (
    <TableCard>
      <div className="card table-divdabja-teiciens">
        <header className="vs-head">
          <h2 className="vs-title">Причастный оборот</h2>
        </header>

        <div className="dt-intro">
          Divdabja teiciens — обособленная группа слов, в основе которой <strong>причастие</strong> и хотя бы одно
          зависящее от него слово.
        </div>

        <div className="dt-types">
          {TYPES.map((t) => (
            <section className={`dt-type tt-type-${t.id}`} key={t.id}>
              <div className="dt-type-head">
                <span className="dt-name">{t.name}</span>
                <span className="dt-endings">{t.endings}</span>
              </div>
              <span className="dt-lv"><Marked text={t.lv} /></span>
              <span className="dt-ru">{t.ru}</span>
            </section>
          ))}
        </div>

        <div className="dt-commas">
          <div className="dt-commas-head">Запятые: оборот отделяют всегда</div>
          {POSITIONS.map((p) => (
            <div className={`dt-pos tt-pos-${p.id}`} key={p.where}>
              <span className="dt-pos-label">
                {p.where}
                <span className="dt-pos-rule">{p.rule}</span>
              </span>
              <span className="dt-lv"><Marked text={p.lv} /></span>
            </div>
          ))}
        </div>
      </div>
    </TableCard>
  );
}
