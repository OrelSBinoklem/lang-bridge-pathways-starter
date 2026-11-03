import TableCard from '../../TableCard.jsx';
import './TableQuestionsChart.css';

function RuHighlight({ children }) {
  return <span className="q-ru-highlight">{children}</span>;
}

/** Keep ? glued to the preceding word (no orphan ? on next line). */
function glueQ(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/(\S)\?/g, '$1\u2060?');
}

function QRow({ id, lv, ru, examples }) {
  return (
    <tr className={`tt-q-${id}`}>
      <td className="q-lv">{glueQ(lv)}</td>
      <td className="q-ru">{ru}</td>
      <td className="q-ex">{examples}</td>
    </tr>
  );
}

const LEFT_ROWS = [
  {
    lv: 'Kas?',
    id: 'kas',
    ru: <>Кто? Что?</>,
    examples: 'Kas tu esi? Kas tas ir?',
  },
  {
    lv: 'Vai?',
    id: 'vai',
    ru: <RuHighlight>А .....?</RuHighlight>,
    examples: 'Vai tev patīk peldēties? Vai tu esi zēns?',
  },
  {
    lv: 'Kā?',
    id: 'ka',
    ru: (
      <>
        Как? <RuHighlight>Чьё?</RuHighlight> Кого? Чего?
      </>
    ),
    examples: 'Kā tevi sauc? Kā tev iet? Kā soma tā ir?',
  },
  {
    lv: 'Kam?',
    id: 'kam',
    ru: (
      <>
        Кому? Чему? <RuHighlight>у кого?</RuHighlight>
      </>
    ),
    examples: 'Kam garšo šokolāde? Kam ir ragi?',
  },
  {
    lv: 'Ko?',
    id: 'ko',
    ru: <>Кого? Что?</>,
    examples: 'Ko tu redzi? Ko tu ēd? Ko tu gribi?',
  },
  {
    lv: 'Ar ko?',
    id: 'ar-ko',
    ru: (
      <>
        С кем? Чем? <RuHighlight>на чём?</RuHighlight>
      </>
    ),
    examples: 'Ar ko tu raksti? Ar ko tu brauc? Ar ko tu runā?',
  },
  {
    lv: 'Par ko?',
    id: 'par-ko',
    ru: <>О ком? о чём?</>,
    examples: 'Par ko tu domā? Par ko tu gribi kļūt?',
  },
  {
    lv: 'Kur?',
    id: 'kur',
    ru: (
      <>
        Где? <RuHighlight>в чём?</RuHighlight>
      </>
    ),
    examples: 'Kur tu dzīvo? Kur ir tava cepure?',
  },
  {
    lv: 'Kad?',
    id: 'kad',
    ru: <>Когда?</>,
    examples: 'Kad tev ir dzimšanas diena? Kad tu iesi ārā?',
  },
  {
    lv: 'Ko dara?',
    id: 'ko-dara',
    ru: <>Что делают?</>,
    examples: 'Ko tu dari? Ko dara suns?',
  },
];

const RIGHT_ROWS = [
  {
    lv: 'Cik?',
    id: 'cik',
    ru: <>Сколько?</>,
    examples: 'Cik tev ir gadu? Cik tev draugu?',
  },
  {
    lv: 'Cikos?',
    id: 'cikos',
    ru: <>Во сколько?</>,
    examples: 'Cikos tu skaties multfilmas?',
  },
  {
    lv: 'Kāpēc?',
    id: 'kapec',
    ru: <>Почему?</>,
    examples: 'Kāpēc tu neko nesaki? Kāpēc visiem patīk vasara?',
  },
  {
    lv: 'Kādēļ?',
    id: 'kadel',
    ru: <>Из-за чего?</>,
    examples: 'Kādēļ tu nebiji skolā? Kādēļ tev nav mājas darba?',
  },
  {
    lv: 'No kurienes?',
    id: 'no-kurienes',
    ru: <>Откуда?</>,
    examples: 'No kurienes tu atnāci?',
  },
  {
    lv: 'Uz kurieni?',
    id: 'uz-kurieni',
    ru: <>Куда?</>,
    examples: 'Uz kurieni tu brauksi?',
  },
  {
    lv: 'Kāds? Kāda? Kādi? Kādas?',
    id: 'kads',
    ru: (
      <>
        Какой? Какая?
        <span className="q-ru-lower">Какие?</span>
      </>
    ),
    examples: 'Kāds ir laiks ārā? Kāda ir tava jaka? Kādi ir mākoņi? Kādas ir tavas acis?',
  },
  {
    lv: 'Kurš? Kura? Kuri? Kuras?',
    id: 'kurs',
    ru: (
      <>
        Который? Которая?
        <span className="q-ru-lower">Которые?</span>
      </>
    ),
    examples: 'Kurš tramvajs brauc uz centru?',
  },
];

function QuestionsTable({ rows, tableClass }) {
  return (
    <table className={`q-table ${tableClass}`}>
      <tbody>
        {rows.map((row) => (
          <QRow key={row.lv} id={row.id} lv={row.lv} ru={row.ru} examples={row.examples} />
        ))}
      </tbody>
    </table>
  );
}

export default function TableQuestionsChart() {
  return (
    <TableCard>
      <div className="card table-questions-chart">
        <div className="q-grid">
          <QuestionsTable rows={LEFT_ROWS} tableClass="tt-questions-left" />
          <QuestionsTable rows={RIGHT_ROWS} tableClass="tt-questions-right" />
        </div>
      </div>
    </TableCard>
  );
}
