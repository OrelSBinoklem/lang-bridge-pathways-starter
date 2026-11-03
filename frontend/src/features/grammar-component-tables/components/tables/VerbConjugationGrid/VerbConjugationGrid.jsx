import Card1 from '../Card1/Card1.jsx';
import Card2 from '../Card2/Card2.jsx';
/** Две таблицы спряжений (table1 / table2) — как #verbs-tables-container в оригинале. */
export default function VerbConjugationGrid() {
  return (
    <div className="verb-conjugation-grid">
      <Card1 />
      <Card2 />
    </div>
  );
}



