import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TableIespraudumi.css';

/** Three sizes of parenthetical: a word, a word group, a clause fragment. */
const TYPES = [
  {
    id: 'word',
    lv: 'Iesprausti vārdi',
    ru: 'вводные слова',
    items: [
      { lv: 'protams', ru: 'конечно' },
      { lv: 'manuprāt', ru: 'по-моему' },
      { lv: 'pirmkārt', ru: 'во-первых' },
      { lv: 'šķiet', ru: 'кажется' },
      { lv: 'iespējams', ru: 'возможно' },
    ],
    sample: { lv: 'Viņš, [[protams]], nāks.', ru: 'Он, конечно, придёт.' },
  },
  {
    id: 'group',
    lv: 'Vārdu grupas',
    ru: 'вводные сочетания',
    items: [
      { lv: 'citiem vārdiem', ru: 'другими словами' },
      { lv: 'taisnību sakot', ru: 'по правде говоря' },
      { lv: 'pēc manām domām', ru: 'по моему мнению' },
      { lv: 'paldies Dievam', ru: 'слава богу' },
    ],
    sample: { lv: '[[Citiem vārdiem]], mēs nokavējām.', ru: 'Другими словами, мы опоздали.' },
  },
  {
    id: 'part',
    lv: 'Teikuma daļas',
    ru: 'вводные предложения',
    items: [
      { lv: 'ja atmiņa neviļ', ru: 'если память не изменяет' },
      { lv: 'tas sen zināms', ru: 'это давно известно' },
      { lv: 'tas nevar būt', ru: 'не может быть' },
    ],
    sample: { lv: 'Viņš, [[ja atmiņa neviļ]], dzīvo Cēsīs.', ru: 'Он, если память не изменяет, живёт в Цесисе.' },
  },
];

function Marked({ text }) {
  return text.split(/(\[\[.+?\]\]|,)/).map((part, i) => {
    if (part === ',') return <span className="ie-comma" key={i}>,</span>;
    if (part.startsWith('[[')) return <span className="ie-hit" key={i}>{part.slice(2, -2)}</span>;
    return part;
  });
}

export default function TableIespraudumi() {
  return (
    <TableCard>
      <div className="card table-iespraudumi">
        <header className="vs-head">
          <h2 className="vs-title">Вводные слова и выражения</h2>
        </header>

        <div className="ie-intro">
          Вводные слова показывают отношение говорящего к сказанному, добавляют замечание или уточнение. На письме их
          отделяют запятыми, реже скобками.
        </div>

        <div className="ie-cols">
          {TYPES.map((t) => (
            <section className={`ie-col ie-col--${t.id}`} key={t.id}>
              <div className="ie-col-head">
                <span className="ie-lv">{t.lv}</span>
                <span className="ie-ru">{t.ru}</span>
              </div>
              <ul className="ie-items">
                {t.items.map((it) => (
                  <li className={`ie-item tt-word-${wordId(it.lv)}`} key={it.lv}>
                    <span className="ie-item-lv">{it.lv}</span>
                    <span className="ie-item-ru">{it.ru}</span>
                  </li>
                ))}
              </ul>
              <div className="ie-sample">
                <span className="ie-sample-lv"><Marked text={t.sample.lv} /></span>
                <span className="ie-sample-ru">{t.sample.ru}</span>
              </div>
            </section>
          ))}
        </div>
      </div>
    </TableCard>
  );
}
