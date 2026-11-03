import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TableVardskiras1.css';

const ITEMS = [
  {
    icon: '📦',
    lv: 'Lietvārds',
    term: 'substantīvs',
    ru: 'существительное',
    def: 'Обозначает предметы и живые существа, а также действия и процессы, признаки, явления природы и отвлечённые понятия.',
    examples: ['koks', 'māja', 'draugs', 'braukšana', 'prieks'],
  },
  {
    icon: '🎨',
    lv: 'Īpašības vārds',
    term: 'adjektīvs',
    ru: 'прилагательное',
    def: 'Называет признак предмета или существа: форму и объём, цвет, температуру, время, характер.',
    examples: ['liels', 'dzeltens', 'vēss', 'gudrs'],
  },
  {
    icon: '🔢',
    lv: 'Skaitļa vārds',
    term: 'numerālis',
    ru: 'числительное',
    def: 'Обозначает количество предметов или порядок, в котором они следуют друг за другом.',
    examples: ['pieci', 'desmit', 'piektais'],
  },
];

export default function TableVardskiras1() {
  return (
    <TableCard>
      <div className="card table-vardskiras1">
        <header className="vs-head">
          <h2 className="vs-title">Части речи</h2>
        </header>

        <div className="vk-groups">
          <div className="vk-group vk-group--main">
            <span className="vk-group-name">Patstāvīgie vārdi</span>
            <span className="vk-group-desc">самостоятельные — могут быть членами предложения</span>
          </div>
          <div className="vk-group vk-group--aux">
            <span className="vk-group-name">Palīgvārdi</span>
            <span className="vk-group-desc">служебные — обычно не являются членами предложения</span>
          </div>
        </div>

        <div className="vk-cards">
          {ITEMS.map((item) => (
            <article className={`vk-card tt-pos-${wordId(item.lv)}`} key={item.lv}>
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

        <p className="vk-continued">Продолжение — на следующей карточке →</p>
      </div>
    </TableCard>
  );
}
