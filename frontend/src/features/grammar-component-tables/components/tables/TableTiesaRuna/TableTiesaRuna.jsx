import TableCard from '../../TableCard.jsx';
import './TableTiesaRuna.css';

/**
 * Three word orders of speech and author's words (piebilde). The punctuation
 * is the lesson, so every example is rendered through <Speech>, which colours
 * the quoted speech and highlights each punctuation mark straight from the
 * example string.
 */
const PATTERNS = [
  {
    id: 'before',
    title: 'Слова автора → речь',
    scheme: 'piebilde: „Runa.”',
    rule: 'после слов автора — двоеточие, точка внутри кавычек',
    samples: [
      { lv: 'Tēvs teica: „Rīt brauksim uz jūru.”', ru: 'Отец сказал: «Завтра поедем на море».' },
    ],
  },
  {
    id: 'after',
    title: 'Речь → слова автора',
    scheme: '„Runa,” piebilde.',
    rule: 'в кавычках запятая (или ? !), слова автора — с маленькой буквы',
    samples: [
      { lv: '„Kur ir manas atslēgas?” brālis jautāja.', ru: '«Где мои ключи?» — спросил брат.' },
      { lv: '„Tās ir uz galda,” atbildēja māsa.', ru: '«Они на столе», — ответила сестра.' },
    ],
  },
  {
    id: 'middle',
    title: 'Слова автора внутри речи',
    scheme: '„Runa,” piebilde, „runa.”',
    rule: 'одна фраза — продолжение с маленькой; две фразы — точка и заглавная',
    samples: [
      { lv: '„Ja būs saulains,” tēvs piebilda, „ņemsim līdzi laivu.”', ru: '«Если будет солнечно, — добавил отец, — возьмём лодку».' },
      { lv: '„Labi,” tēvs nolēma. „Brauksim agri.”', ru: '«Хорошо», — решил отец. — «Поедем рано».' },
    ],
  },
];

const PUNCT = /[„”:,.?!]/;

/** Colours text inside „…” as speech and marks every punctuation character. */
function Speech({ text }) {
  const parts = [];
  let inside = false;
  let buf = '';
  const flush = () => {
    if (buf) parts.push(<span className={inside ? 'tr-runa' : 'tr-piebilde'} key={parts.length}>{buf}</span>);
    buf = '';
  };
  for (const ch of text) {
    if (PUNCT.test(ch)) {
      flush();
      if (ch === '„') inside = true;
      parts.push(<span className="tr-pn" key={parts.length}>{ch}</span>);
      if (ch === '”') inside = false;
    } else {
      buf += ch;
    }
  }
  flush();
  return parts;
}

export default function TableTiesaRuna() {
  return (
    <TableCard>
      <div className="card table-tiesa-runa">
        <header className="vs-head">
          <h2 className="vs-title">Прямая речь</h2>
        </header>

        <div className="tr-intro">
          Tiešā runa — это точные слова человека в кавычках <strong>„…”</strong>. Главное здесь — знаки препинания.
        </div>

        <div className="tr-legend">
          <span className="tr-runa">речь</span>
          <span className="tr-piebilde">слова автора (piebilde)</span>
          <span className="tr-pn">знаки</span>
        </div>

        <div className="tr-rows">
          {PATTERNS.map((p, i) => (
            <section className={`tr-row tt-pattern-${p.id}`} key={p.id}>
              <div className="tr-row-head">
                <span className="tr-num">{i + 1}</span>
                <span className="tr-title">{p.title}</span>
                <span className="tr-scheme"><Speech text={p.scheme} /></span>
              </div>
              <div className="tr-rule">{p.rule}</div>
              {p.samples.map((s) => (
                <div className="tr-sample" key={s.lv}>
                  <span className="tr-sample-lv"><Speech text={s.lv} /></span>
                  <span className="tr-sample-ru">{s.ru}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </TableCard>
  );
}
