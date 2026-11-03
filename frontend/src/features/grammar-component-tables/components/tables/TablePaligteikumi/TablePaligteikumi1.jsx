import TableCard from '../../TableCard.jsx';
import { Legend, Marked, TypeCard } from './Paligteikumi.jsx';

const TYPES = [
  {
    lv: 'Teikuma priekšmeta',
    ru: 'подлежащное',
    q: 'Kas?',
    words: 'kas · kurš · kāds · ka · lai · vai · ja · kā · cik · kur · kad',
    pos: ['aiz', 'starp', 'pirms'],
    lv_s: '[[Kas neiespējams šodien]], kļūst iespējams rīt.',
    ru_s: 'Что невозможно сегодня, становится возможным завтра.',
  },
  {
    lv: 'Izteicēja',
    ru: 'сказуемное',
    q: 'Kas ir? Kāds ir?',
    words: 'kas · kurš · kāds · ka · lai',
    pos: ['aiz'],
    lv_s: 'Viņi ir tie, [[kas ies tālāk par mums]].',
    ru_s: 'Они те, кто пойдёт дальше нас.',
  },
];

export default function TablePaligteikumi1() {
  return (
    <TableCard>
      <div className="card table-paligteikumi">
        <header className="vs-head">
          <h2 className="vs-title">Придаточные предложения</h2>
        </header>

        <div className="pt-intro">
          Palīgteikums — зависимая часть сложноподчинённого предложения. Она поясняет главное предложение
          (virsteikums). <strong>Тип придаточного определяют по вопросу</strong>, который задают от главного.
        </div>

        {/* How the type is found: ask the question from the main clause. */}
        <div className="pt-how">
          <span className="pt-how-row"><Marked text="Es eju tur, [[kur acis rāda]]." /></span>
          <span className="pt-how-steps">
            <span className="pt-step pt-step--main">virsteikums</span>
            <span className="pt-arrow">→</span>
            <span className="pt-step pt-step--q">Kur es eju?</span>
            <span className="pt-arrow">→</span>
            <span className="pt-step pt-step--sub">vietas palīgteikums</span>
          </span>
        </div>

        <Legend />

        <div className="pt-grid">
          {TYPES.map((t) => <TypeCard t={t} key={t.lv} />)}
        </div>

        <div className="pt-foot">Остальные 13 типов — в расширенной таблице.</div>
      </div>
    </TableCard>
  );
}
