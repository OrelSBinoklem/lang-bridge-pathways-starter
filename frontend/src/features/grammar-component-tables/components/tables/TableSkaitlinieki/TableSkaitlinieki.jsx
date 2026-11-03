import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TableSkaitlinieki.css';

/* Both columns run the same way: concrete nouns → abstract ones → proper names. */
const SINGULAR = {
  id: 'sg',
  mark: '1',
  lv: 'Vienskaitlinieki',
  abbr: 'vsk.',
  ru: 'только единственное число',
  rule: 'Lietvārdi, kas lietojami tikai vienskaitļa formā.',
  groups: [
    {
      icon: '🍯',
      id: 'substances',
      label: 'вещества',
      words: [
        { lv: 'medus', ru: 'мёд' },
        { lv: 'cukurs', ru: 'сахар' },
        { lv: 'zelts', ru: 'золото' },
      ],
    },
    {
      icon: '💭',
      id: 'abstract',
      label: 'абстрактные понятия',
      words: [
        { lv: 'mīlestība', ru: 'любовь' },
        { lv: 'veselība', ru: 'здоровье' },
        { lv: 'miers', ru: 'покой' },
      ],
    },
    {
      icon: '⭐',
      id: 'traits',
      label: 'черты характера',
      words: [
        { lv: 'drosme', ru: 'смелость' },
        { lv: 'godīgums', ru: 'честность' },
        { lv: 'pacietība', ru: 'терпение' },
      ],
    },
    {
      icon: '📍',
      id: 'places',
      label: 'названия мест',
      words: [{ lv: 'Sigulda' }, { lv: 'Kuldīga' }],
    },
  ],
};

const PLURAL = {
  id: 'pl',
  mark: '2+',
  lv: 'Daudzskaitlinieki',
  abbr: 'dsk.',
  ru: 'только множественное число',
  rule: 'Lietvārdi, kas lietojami tikai daudzskaitļa formā.',
  groups: [
    {
      icon: '✂️',
      id: 'pairs',
      label: 'парные предметы',
      words: [
        { lv: 'šķēres', ru: 'ножницы' },
        { lv: 'svārki', ru: 'юбка' },
        { lv: 'ragavas', ru: 'санки' },
      ],
    },
    {
      icon: '😢',
      id: 'feelings',
      label: 'чувства',
      words: [
        { lv: 'dusmas', ru: 'гнев' },
        { lv: 'bailes', ru: 'страх' },
      ],
    },
    {
      icon: '🌾',
      id: 'grains',
      label: 'злаки',
      words: [
        { lv: 'rudzi', ru: 'рожь' },
        { lv: 'auzas', ru: 'овёс' },
      ],
    },
    {
      icon: '🎉',
      id: 'holidays',
      label: 'праздники и события',
      words: [
        { lv: 'Lieldienas', ru: 'Пасха' },
        { lv: 'Vasarsvētki', ru: 'Троица' },
        { lv: 'Mārtiņi', ru: 'Мартынов день' },
      ],
    },
    {
      icon: '🏠',
      id: 'houses',
      label: 'названия домов',
      words: [{ lv: '„Ozoliņi”' }],
    },
    {
      icon: '📍',
      id: 'places',
      label: 'названия мест',
      words: [{ lv: 'Cēsis' }, { lv: 'Talsi' }],
    },
  ],
};

function Column({ data }) {
  return (
    <section className={`sn-col sn-col--${data.id}`}>
      <div className="sn-col-head">
        <span className="sn-mark">{data.mark}</span>
        <span className="sn-col-titles">
          <span className="sn-lv">
            {data.lv} <span className="sn-abbr">{data.abbr}</span>
          </span>
          <span className="sn-ru">{data.ru}</span>
        </span>
      </div>
      <p className="sn-rule">{data.rule}</p>

      <ul className="sn-groups">
        {data.groups.map((group) => (
          <li className={`sn-group tt-group-${group.id}`} key={group.label}>
            <span className="sn-icon" aria-hidden="true">{group.icon}</span>
            <div className="sn-group-body">
              <span className="sn-label">{group.label}</span>
              <span className="sn-words">
                {group.words.map((word) => (
                  <span className={`sn-word tt-word-${wordId(word.lv)}`} key={word.lv}>
                    {word.lv}
                    {word.ru ? <span className="sn-gloss">{word.ru}</span> : null}
                  </span>
                ))}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TableSkaitlinieki() {
  return (
    <TableCard>
      <div className="card table-skaitlinieki">
        <header className="vs-head">
          <h2 className="vs-title">Единственное и множественное число</h2>
        </header>

        <div className="sn-cols">
          <Column data={SINGULAR} />
          <Column data={PLURAL} />
        </div>
      </div>
    </TableCard>
  );
}
