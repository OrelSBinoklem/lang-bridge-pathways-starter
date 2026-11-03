import TableCard from '../../TableCard.jsx';
import './TableGalotnes.css';

/**
 * Examples are split into `stem` + `end` so the ending itself can be highlighted —
 * that contrast is the whole point of the table.
 */
const INDEFINITE = {
  id: 'indef',
  lv: 'Nenoteiktā galotne',
  ru: 'неопределённое',
  endings: '-s · -a',
  rules: [
    {
      icon: '👋',
      id: 'first-mention',
      label: 'объект назван впервые',
      samples: [
        { before: 'Ceļa malā aug ', stem: 'liel', end: 's', after: ' ozols.', ru: 'У дороги растёт большой дуб.' },
      ],
    },
    {
      icon: '🧩',
      id: 'after-quantifier',
      label: 'после dažs, kāds, viens, jebkurš, šāds, tāds',
      samples: [
        { before: 'Man ir kāda ', stem: 'interesant', end: 'a', after: ' doma.', ru: 'У меня есть какая-то интересная мысль.' },
        { before: 'Viens ', stem: 'sarkan', end: 's', after: ' krēsls stāv stūrī.', ru: 'Один красный стул стоит в углу.' },
      ],
    },
    {
      icon: '💬',
      id: 'comparisons',
      label: 'в сравнениях и устойчивых выражениях',
      samples: [
        { stem: 'Balt', end: 's', after: ' kā sniegs.', ru: 'Белый как снег.' },
        { stem: 'Viegl', end: 's', after: ' kā spalva.', ru: 'Лёгкий как пёрышко.' },
      ],
    },
  ],
};

const DEFINITE = {
  id: 'def',
  lv: 'Noteiktā galotne',
  ru: 'определённое',
  endings: '-ais · -ā',
  rules: [
    {
      icon: '🔁',
      id: 'already-mentioned',
      label: 'объект уже упоминался',
      samples: [
        { stem: 'Liel', end: 'ais', after: ' ozols ir ļoti vecs.', ru: 'Тот большой дуб очень старый.' },
      ],
    },
    {
      icon: '🔑',
      id: 'after-possessive',
      label: 'после mans, tavs, savs, mūsu, jūsu',
      samples: [

      ],
    },
    {
      icon: '🔢',
      id: 'ordinals',
      label: 'порядковые числительные',
      words: [
        { stem: 'ceturt', end: 'ais', ru: 'четвёртый' },
        { stem: 'piekt', end: 'ais', ru: 'пятый' }
      ],
    },
    {
      icon: '📐',
      id: 'position',
      label: 'прилагательные положения и порядка',
      words: [
        { stem: 'vidēj', end: 'ais', ru: 'средний' },
        { stem: 'tuvāk', end: 'ais', ru: 'ближайший' },
      ],
    },
    {
      icon: '⚗️',
      id: 'terms',
      label: 'термины и названия видов',
      words: [
        { stem: 'meln', end: 'ais', after: ' caurums', ru: 'чёрная дыра' },
        { stem: 'zaļ', end: 'ā', after: ' tēja', ru: 'зелёный чай' },
      ],
    },
    {
      icon: '🗺️',
      id: 'geographic',
      label: 'географические названия',
      words: [
        { stem: 'Klus', end: 'ais', after: ' okeāns', ru: 'Тихий океан' },
        { stem: 'Sarkan', end: 'ā', after: ' jūra', ru: 'Красное море' },
      ],
    },
    {
      icon: '🏛️',
      id: 'institutions',
      label: 'названия учреждений',
      words: [
        { stem: 'Nacionāl', end: 'ā', after: ' bibliotēka', ru: 'Национальная библиотека' },
        { stem: 'Centrāl', end: 'ā', after: ' banka', ru: 'Центральный банк' },
      ],
    },
    {
      icon: '📝',
      id: 'nominalized',
      label: 'существительные от прилагательных',
      words: [
        { stem: 'dzeram', end: 'ais', ru: 'напиток' },
        { stem: 'jaunāk', end: 'ais', ru: 'младший' },
      ],
    },
  ],
};

function Sample({ item }) {
  return (
    <>
      {item.before}
      {item.stem}
      <span className="gl-end">{item.end}</span>
      {item.after}
    </>
  );
}

function Column({ data }) {
  return (
    <section className={`gl-col gl-col--${data.id}`}>
      <div className="gl-col-head">
        <span className="gl-col-titles">
          <span className="gl-lv">{data.lv}</span>
          <span className="gl-ru">{data.ru}</span>
        </span>
        <span className="gl-endings">{data.endings}</span>
      </div>

      <ul className="gl-rules">
        {data.rules.map((rule) => (
          <li className={`gl-rule tt-rule-${rule.id}`} key={rule.label}>
            <span className="gl-icon" aria-hidden="true">{rule.icon}</span>
            <div className="gl-rule-body">
              <span className="gl-label">{rule.label}</span>

              {rule.samples
                ? rule.samples.map((sample) => (
                    <span className="gl-sentence" key={sample.stem + sample.end}>
                      <span className="gl-lv-text"><Sample item={sample} /></span>
                      <span className="gl-gloss">{sample.ru}</span>
                    </span>
                  ))
                : null}

              {rule.words ? (
                <span className="gl-words">
                  {rule.words.map((word) => (
                    <span className="gl-word" key={word.stem + word.end}>
                      <Sample item={word} />
                      <span className="gl-gloss">{word.ru}</span>
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {data.note ? <p className="gl-note">{data.note}</p> : null}
    </section>
  );
}

export default function TableGalotnes() {
  return (
    <TableCard>
      <div className="card table-galotnes">
        <header className="vs-head">
          <h2 className="vs-title">Основные условия использования неопределенных и определенных окончаний</h2>
        </header>

        <div className="gl-cols">
          <Column data={INDEFINITE} />
          <Column data={DEFINITE} />
        </div>
      </div>
    </TableCard>
  );
}
