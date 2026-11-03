import TableCard from '../../TableCard.jsx';
import './TableSufiksi.css';

/**
 * Each example is stored as segments: `src` is the word we start from, `stem` is
 * what stays of it and `suf` is the suffix added. The result is assembled from
 * `stem` + `suf`, so the highlighted suffix always matches the word on its right.
 */
const CARDS = [
  {
    id: 'doer',
    from: 'глагол',
    to: 'сущ.',
    tone: 'noun',
    ru: 'Тот, кто делает',
    suffixes: '-tājs · -ējs',
    examples: [
      { src: 'skolot', stem: 'skolot', suf: 'ājs', ru: 'учитель' },
      { src: 'lasīt', stem: 'lasīt', suf: 'ājs', ru: 'читатель' },
      { src: 'pārdot', stem: 'pārdev', suf: 'ējs', ru: 'продавец' },
    ],
  },
  {
    id: 'trade',
    from: 'сущ.',
    to: 'сущ.',
    tone: 'noun',
    ru: 'Профессия, занятие',
    suffixes: '-nieks',
    examples: [
      { src: 'zeme', stem: 'zem', suf: 'nieks', ru: 'крестьянин' },
      { src: 'dārzs', stem: 'dārz', suf: 'nieks', ru: 'садовник' },
      { src: 'māksla', stem: 'māksl', suf: 'inieks', ru: 'художник' },
    ],
  },
  {
    id: 'fem',
    from: 'сущ. м.',
    to: 'сущ. ж.',
    tone: 'noun',
    ru: 'Женский вариант',
    suffixes: '-a · -e · -iece',
    examples: [
      { src: 'skolotājs', stem: 'skolotāj', suf: 'a', ru: 'учительница' },
      { src: 'students', stem: 'student', suf: 'e', ru: 'студентка' },
      { src: 'dārznieks', stem: 'dārzni', suf: 'ece', ru: 'садовница' },
    ],
  },
  {
    id: 'action',
    from: 'глагол',
    to: 'сущ.',
    tone: 'noun',
    ru: 'Само действие',
    suffixes: '-šana',
    examples: [
      { src: 'lasīt', stem: 'lasī', suf: 'šana', ru: 'чтение' },
      { src: 'rakstīt', stem: 'rakstī', suf: 'šana', ru: 'письмо (процесс)' },
      { src: 'staigāt', stem: 'staigā', suf: 'šana', ru: 'хождение' },
    ],
  },
  {
    id: 'adj',
    from: 'сущ.',
    to: 'прил.',
    tone: 'adj',
    ru: 'Признак по предмету',
    suffixes: '-īgs · -ains',
    examples: [
      { src: 'laime', stem: 'laim', suf: 'īgs', ru: 'счастливый' },
      { src: 'spēks', stem: 'spēc', suf: 'īgs', ru: 'сильный' },
      { src: 'mežs', stem: 'mež', suf: 'ains', ru: 'лесистый' },
    ],
  },
  {
    id: 'quality',
    from: 'прил.',
    to: 'сущ.',
    tone: 'noun',
    ru: 'Качество, свойство',
    suffixes: '-ums · -ība',
    examples: [
      { src: 'skaists', stem: 'skaist', suf: 'ums', ru: 'красота' },
      { src: 'ātrs', stem: 'ātr', suf: 'ums', ru: 'скорость' },
      { src: 'vesels', stem: 'vesel', suf: 'ība', ru: 'здоровье' },
    ],
  },
  {
    id: 'adv',
    from: 'прил.',
    to: 'нареч.',
    tone: 'adv',
    ru: 'Как? Каким образом?',
    suffixes: '-i',
    examples: [
      { src: 'labs', stem: 'lab', suf: 'i', ru: 'хорошо' },
      { src: 'ātrs', stem: 'ātr', suf: 'i', ru: 'быстро' },
      { src: 'latvisks', stem: 'latvisk', suf: 'i', ru: 'по-латышски' },
    ],
  },
  {
    id: 'dim',
    from: 'сущ.',
    to: 'сущ.',
    tone: 'noun',
    ru: 'Уменьшительное',
    suffixes: '-iņš · -iņa · -īte',
    examples: [
      { src: 'galds', stem: 'gald', suf: 'iņš', ru: 'столик' },
      { src: 'māja', stem: 'māj', suf: 'iņa', ru: 'домик' },
      { src: 'puķe', stem: 'puķ', suf: 'īte', ru: 'цветочек' },
    ],
  },
  {
    id: 'place',
    from: 'сущ. / прил.',
    to: 'сущ.',
    tone: 'noun',
    ru: 'Место',
    suffixes: '-nīca',
    examples: [
      { src: 'slims', stem: 'slim', suf: 'nīca', ru: 'больница' },
      { src: 'darbs', stem: 'darb', suf: 'nīca', ru: 'мастерская' },
      { src: 'kafija', stem: 'kafej', suf: 'nīca', ru: 'кафе' },
    ],
  },
];

export default function TableSufiksi() {
  return (
    <TableCard>
      <div className="card table-sufiksi">
        <header className="vs-head">
          <h2 className="vs-title">Суффиксы и словообразование</h2>
        </header>

        <div className="sf-grid">
          {CARDS.map((card) => (
            <section key={card.id} className={`sf-card sf-card--${card.tone} tt-card-${card.id}`}>
              <div className="sf-card-head">
                <span className="sf-flow">
                  <span className="sf-chip">{card.from}</span>
                  <span className="sf-arrow">→</span>
                  <span className="sf-chip sf-chip--to">{card.to}</span>
                </span>
                <span className="sf-suffixes">{card.suffixes}</span>
              </div>
              <p className="sf-meaning">{card.ru}</p>
              <ul className="sf-examples">
                {card.examples.map((ex) => (
                  <li className="sf-ex" key={ex.src + ex.suf}>
                    <span className="sf-word sf-word--src">{ex.src}</span>
                    <span className="sf-arrow">→</span>
                    <span className="sf-word sf-word--res">
                      {ex.stem}
                      <span className="sf-suffix">{ex.suf}</span>
                    </span>
                    <span className="sf-ex-ru">{ex.ru}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="sf-note">
          💡 Зелёным выделен суффикс. Перед ним основа часто немного меняется
          (<em>pārdot → pārdevējs</em>, <em>spēks → spēcīgs</em>) — такие слова полезно
          запоминать целиком.
        </p>
      </div>
    </TableCard>
  );
}
