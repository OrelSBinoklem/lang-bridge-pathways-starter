import VerbsTablesContainer from '../VerbsTablesContainer/VerbsTablesContainer.jsx';
import FloatLettersLayer from '../FloatLettersLayer.jsx';
/** Контейнер глагольных карточек + буквы из latvian_verb_endings_trainer.html (конец .wrap). */
const VERB_GRID_FLOAT_LETTERS = [
  { char: 'j', left: '62%', top: '8%' },
  { char: 'a', left: '75%', top: '5%' },
  { char: 'a', left: '30%', top: '55%' },
  { char: 'j', left: '56%', top: '42%' },
  { char: 'a', left: '56%', top: '55%' },
  { char: 'š', left: '88%', top: '38%', fontSize: '22px' },
  { char: 's', left: '88%', top: '52%' },
];

export default function VerbsTablesSection() {
  return (
    <div className="verbs-tables-section">
      <VerbsTablesContainer />
      <FloatLettersLayer letters={VERB_GRID_FLOAT_LETTERS} />
    </div>
  );
}



