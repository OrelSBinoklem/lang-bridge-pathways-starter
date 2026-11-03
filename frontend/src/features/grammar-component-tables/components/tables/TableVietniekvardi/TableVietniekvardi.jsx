import TableCard from '../../TableCard.jsx';
import { wordId } from '../../tutorClasses.js';
import './TableVietniekvardi.css';

/**
 * A map of the nine groups, not a word list — full paradigms live in the
 * separate pronoun tables and in the dictionary. `pair` marks the two groups
 * that share the very same words and differ only by the job they do.
 */
const GROUPS = [
  {
    icon: '👤',
    lv: 'Personu',
    ru: 'личные',
    func: 'называют участников разговора',
    words: 'es, tu, viņš, viņa, mēs, jūs, viņi, viņas',
  },
  {
    icon: '🔄',
    lv: 'Atgriezeniskais',
    ru: 'возвратное',
    func: 'действие на самого деятеля',
    words: 'sevis, sev, sevi',
  },
  {
    icon: '👉',
    lv: 'Norādāmie',
    ru: 'указательные',
    func: 'указывают на предмет или существо',
    words: 'tas, tā, tie, tās, šis, šī, šie, šīs',
  },
  {
    icon: '🔑',
    lv: 'Piederības',
    ru: 'притяжательные',
    func: 'показывают принадлежность',
    words: 'mans, tavs, savs, mūsu, jūsu',
  },
  {
    icon: '❓',
    lv: 'Jautājamie',
    ru: 'вопросительные',
    func: 'вводят вопрос',
    words: 'kas, kāds, kurš',
    pair: true,
  },
  {
    icon: '🔗',
    lv: 'Attieksmes',
    ru: 'относительные',
    func: 'вводят придаточное предложение',
    words: 'kas, kāds, kurš',
    pair: true,
  },
  {
    icon: '🌫️',
    lv: 'Nenoteiktie',
    ru: 'неопределённые',
    func: 'указывают на неизвестное',
    words: 'kaut kas, kaut kāds, jebkas, jebkurš, dažs, cits',
    more: true,
  },
  {
    icon: '✅',
    lv: 'Noteiktie',
    ru: 'определительные',
    func: 'указывают на известное или всё целиком',
    words: 'katrs, ikviens, viss, abi, pats',
  },
  {
    icon: '🚫',
    lv: 'Noliegtie',
    ru: 'отрицательные',
    func: 'выражают отрицание',
    words: 'nekas, nekāds, neviens',
  },
];

export default function TableVietniekvardi() {
  return (
    <TableCard>
      <div className="card table-vietniekvardi">
        <header className="vs-head">
          <h2 className="vs-title">Местоимения</h2>
        </header>

        <table className="vv-table">
          <thead>
            <tr>
              <th>Группа</th>
              <th>Что делает</th>
              <th>Примеры</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <tr className={`${group.pair ? 'vv-row vv-row--pair' : 'vv-row'} tt-group-${wordId(group.lv)}`} key={group.lv}>
                <td className="vv-name">
                  <span className="vv-icon" aria-hidden="true">{group.icon}</span>
                  <span className="vv-titles">
                    <span className="vv-lv">{group.lv}</span>
                    <span className="vv-ru">{group.ru}</span>
                  </span>
                </td>
                <td className="vv-func">{group.func}</td>
                <td className="vv-words">
                  {group.words}
                  {group.more ? <span className="vv-more"> и др.</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="vv-note">
          💡 Вопросительные и относительные — <strong>одни и те же слова</strong>, разная работа:{' '}
          <em>Kurš tur nāk?</em> (вопрос) — <em>Es zinu, kurš tur nāk.</em> (придаточное)
        </p>
      </div>
    </TableCard>
  );
}
