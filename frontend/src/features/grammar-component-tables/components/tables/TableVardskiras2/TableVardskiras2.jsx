import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TableVardskiras2.css';

const MAIN_ITEMS = [
  {
    icon: '👤',
    lv: 'Vietniekvārds',
    term: 'pronomens',
    ru: 'местоимение',
    def: 'Заменяет существительное, прилагательное или числительное — указывает на предмет, признак или количество, ничего не называя напрямую.',
    examples: ['es', 'viņš', 'mans', 'kāds'],
  },
  {
    icon: '🏃',
    lv: 'Darbības vārds',
    term: 'verbs',
    ru: 'глагол',
    def: 'Выражает действие, процесс или состояние. Divdabis (причастие) — особая форма глагола, соединяющая его с прилагательным или наречием.',
    examples: ['braukt', 'rakstīt', 'gulēt'],
  },
  {
    icon: '🧭',
    lv: 'Apstākļa vārds',
    term: 'adverbs',
    ru: 'наречие',
    def: 'Неизменяемое слово, называющее признак действия, признака или другого наречия.',
    examples: ['ātri', 'labi', 'ļoti'],
  },
];

const AUX_ITEMS = [
  {
    icon: '🔗',
    lv: 'Prievārds',
    term: 'prepozīcija',
    ru: 'предлог',
    def: 'Неизменяемое служебное слово, которое связывает падежную форму слова с другим словом.',
    examples: ['aiz', 'uz', 'no', 'pēc'],
  },
  {
    icon: '➕',
    lv: 'Saiklis',
    term: 'konjunkcija',
    ru: 'союз',
    def: 'Связывает однородные члены предложения, словосочетания, части или целые предложения.',
    examples: ['un', 'bet', 'jo', 'vai'],
  },
  {
    icon: '✨',
    lv: 'Partikula',
    term: 'частица',
    ru: 'частица',
    def: 'Придаёт слову или всему высказыванию смысловой оттенок: ограничение, усиление, отрицание, сомнение и др.',
    examples: ['tikai', 'arī', 'nē', 'vai'],
  },
];

export default function TableVardskiras2() {
  return (
    <TableCard>
      <div className="card table-vardskiras2">
        <header className="vs-head">
          <h2 className="vs-title">Части речи — продолжение</h2>
        </header>

        <div className="vk-cards">
          {MAIN_ITEMS.map((item) => (
            <article className={`vk-card vk-card--main tt-pos-${wordId(item.lv)}`} key={item.lv}>
              <div className="vk-card-head">
                <span className="vk-icon" aria-hidden="true">{item.icon}</span>
                <div className="vk-card-titles">
                  <span className="vk-lv">{item.lv}</span>
                  <span className="vk-term">{item.term} · {item.ru}</span>
                </div>
              </div>
              <p className="vk-def">{item.def}</p>
              <div className="vk-examples">
                {item.examples.map((ex) => (
                  <span className="vk-chip" key={ex}>{ex}</span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="vk-divider">
          <span className="vk-divider-name">Palīgvārdi</span>
          <span className="vk-divider-desc">служебные слова</span>
        </div>

        <div className="vk-cards">
          {AUX_ITEMS.map((item) => (
            <article className={`vk-card vk-card--aux tt-pos-${wordId(item.lv)}`} key={item.lv}>
              <div className="vk-card-head">
                <span className="vk-icon" aria-hidden="true">{item.icon}</span>
                <div className="vk-card-titles">
                  <span className="vk-lv">{item.lv}</span>
                  <span className="vk-term">{item.term} · {item.ru}</span>
                </div>
              </div>
              <p className="vk-def">{item.def}</p>
              <div className="vk-examples">
                {item.examples.map((ex) => (
                  <span className="vk-chip" key={ex}>{ex}</span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <article className="vk-card vk-card--outside tt-pos-izsauksmes-vards">
          <div className="vk-card-head">
            <span className="vk-icon" aria-hidden="true">❗</span>
            <div className="vk-card-titles">
              <span className="vk-lv">Izsauksmes vārds</span>
              <span className="vk-term">interjekcija · междометие</span>
            </div>
          </div>
          <p className="vk-def">
            Вне этой классификации. Неизменяемое слово, которое выражает чувства, волю или подражает звукам —
            ничего не называет, а лишь указывает на эмоцию или привлекает внимание. Сюда же относят вежливые фразы.
          </p>
          <div className="vk-examples">
            <span className="vk-chip">ai!</span>
            <span className="vk-chip">stop!</span>
            <span className="vk-chip">mjau</span>
            <span className="vk-chip">Paldies!</span>
          </div>
        </article>
      </div>
    </TableCard>
  );
}
