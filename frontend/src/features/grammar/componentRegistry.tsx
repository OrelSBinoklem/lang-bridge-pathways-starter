import type { ComponentType } from 'react';
import TablePossessionIrNav from '@/features/grammar-component-tables/components/tables/TablePossessionIrNav/TablePossessionIrNav.jsx';
import TablePatikInfinitive from '@/features/grammar-component-tables/components/tables/TablePatikInfinitive/TablePatikInfinitive.jsx';
import TableAlphabet from '@/features/grammar-component-tables/components/tables/TableAlphabet/TableAlphabet.jsx';
import TableDeclensions from '@/features/grammar-component-tables/components/tables/TableDeclensions/TableDeclensions.jsx';
import TableCompoundV79 from '@/features/grammar-component-tables/components/tables/TableCompoundV79/TableCompoundV79.jsx';
import TableIndicative from '@/features/grammar-component-tables/components/tables/TableIndicative/TableIndicative.jsx';
import TableMoodV75v76v77 from '@/features/grammar-component-tables/components/tables/TableMoodV75v76v77/TableMoodV75v76v77.jsx';
import TableParticipleSuper2 from '@/features/grammar-component-tables/components/tables/TableParticipleSuper2/TableParticipleSuper2.jsx';
import TableParticipleV70v71 from '@/features/grammar-component-tables/components/tables/TableParticipleV70v71/TableParticipleV70v71.jsx';
import TablePrefixVerbs from '@/features/grammar-component-tables/components/tables/TablePrefixVerbs/TablePrefixVerbs.jsx';
import TableReportedV78 from '@/features/grammar-component-tables/components/tables/TableReportedV78/TableReportedV78.jsx';
import TableWord32 from '@/features/grammar-component-tables/components/tables/TableWord32/TableWord32.jsx';
import TableVerbEndingsPresent from '@/features/grammar-component-tables/components/tables/TableVerbEndingsPresent/TableVerbEndingsPresent.jsx';
import TableVerbEndingsPast from '@/features/grammar-component-tables/components/tables/TableVerbEndingsPast/TableVerbEndingsPast.jsx';
import TableNumbersChart from '@/features/grammar-component-tables/components/tables/TableNumbersChart/TableNumbersChart.jsx';
import TableQuestionsChart from '@/features/grammar-component-tables/components/tables/TableQuestionsChart/TableQuestionsChart.jsx';
import TableVocative from '@/features/grammar-component-tables/components/tables/TableVocative/TableVocative.jsx';
import TableConsonant from '@/features/grammar-component-tables/components/tables/TableConsonant/TableConsonant.jsx';
import TableDecl2Exceptions from '@/features/grammar-component-tables/components/tables/TableDecl2Exceptions/TableDecl2Exceptions.jsx';
import TableComparison from '@/features/grammar-component-tables/components/tables/TableComparison/TableComparison.jsx';
import TableAdjEndings from '@/features/grammar-component-tables/components/tables/TableAdjEndings/TableAdjEndings.jsx';
import TablePrepositions from '@/features/grammar-component-tables/components/tables/TablePrepositions/TablePrepositions.jsx';
import TablePron1 from '@/features/grammar-component-tables/components/tables/TablePron1/TablePron1.jsx';
import TablePron2 from '@/features/grammar-component-tables/components/tables/TablePron2/TablePron2.jsx';
import TablePron3 from '@/features/grammar-component-tables/components/tables/TablePron3/TablePron3.jsx';
import TablePron4 from '@/features/grammar-component-tables/components/tables/TablePron4/TablePron4.jsx';
import TablePron5 from '@/features/grammar-component-tables/components/tables/TablePron5/TablePron5.jsx';
import TablePron6 from '@/features/grammar-component-tables/components/tables/TablePron6/TablePron6.jsx';
import TablePron7 from '@/features/grammar-component-tables/components/tables/TablePron7/TablePron7.jsx';
import TablePron10 from '@/features/grammar-component-tables/components/tables/TablePron10/TablePron10.jsx';
import TablePron11 from '@/features/grammar-component-tables/components/tables/TablePron11/TablePron11.jsx';
import TablePron12 from '@/features/grammar-component-tables/components/tables/TablePron12/TablePron12.jsx';
import TablePron13 from '@/features/grammar-component-tables/components/tables/TablePron13/TablePron13.jsx';
import VerbsTablesContainer from '@/features/grammar-component-tables/components/tables/VerbsTablesContainer/VerbsTablesContainer.jsx';
import VerbsTablesContainer2 from '@/features/grammar-component-tables/components/tables/VerbsTablesContainer2/VerbsTablesContainer2.jsx';
import VerbsTablesContainer3 from '@/features/grammar-component-tables/components/tables/VerbsTablesContainer3/VerbsTablesContainer3.jsx';
import VerbsTablesContainer4 from '@/features/grammar-component-tables/components/tables/VerbsTablesContainer4/VerbsTablesContainer4.jsx';
import VerbsTablesContainer5 from '@/features/grammar-component-tables/components/tables/VerbsTablesContainer5/VerbsTablesContainer5.jsx';

import TableVardaSastavs from '@/features/grammar-component-tables/components/tables/TableVardaSastavs/TableVardaSastavs.jsx';
import TableSalikteni from '@/features/grammar-component-tables/components/tables/TableSalikteni/TableSalikteni.jsx';
import TableVardskiras1 from '@/features/grammar-component-tables/components/tables/TableVardskiras1/TableVardskiras1.jsx';
import TableVardskiras2 from '@/features/grammar-component-tables/components/tables/TableVardskiras2/TableVardskiras2.jsx';
import TableSkaitlinieki from '@/features/grammar-component-tables/components/tables/TableSkaitlinieki/TableSkaitlinieki.jsx';
import TableGalotnes from '@/features/grammar-component-tables/components/tables/TableGalotnes/TableGalotnes.jsx';
import TableVietniekvardi from '@/features/grammar-component-tables/components/tables/TableVietniekvardi/TableVietniekvardi.jsx';
import TableTuJus from '@/features/grammar-component-tables/components/tables/TableTuJus/TableTuJus.jsx';
import TableDarbibasLaiki from '@/features/grammar-component-tables/components/tables/TableDarbibasLaiki/TableDarbibasLaiki.jsx';
import TableDarbibasKartas from '@/features/grammar-component-tables/components/tables/TableDarbibasKartas/TableDarbibasKartas.jsx';
import TableLielieBurti from '@/features/grammar-component-tables/components/tables/TableLielieBurti/TableLielieBurti.jsx';
import TableTeikumi from '@/features/grammar-component-tables/components/tables/TableTeikumi/TableTeikumi.jsx';
import TableSaikli from '@/features/grammar-component-tables/components/tables/TableSaikli/TableSaikli.jsx';
import TableTiesaRuna from '@/features/grammar-component-tables/components/tables/TableTiesaRuna/TableTiesaRuna.jsx';
import TableNetiesaRuna from '@/features/grammar-component-tables/components/tables/TableNetiesaRuna/TableNetiesaRuna.jsx';
import TableUzruna from '@/features/grammar-component-tables/components/tables/TableUzruna/TableUzruna.jsx';
import TableUzrunasFormas from '@/features/grammar-component-tables/components/tables/TableUzrunasFormas/TableUzrunasFormas.jsx';
import TableIespraudumi from '@/features/grammar-component-tables/components/tables/TableIespraudumi/TableIespraudumi.jsx';
import TableIespraudumiKomati from '@/features/grammar-component-tables/components/tables/TableIespraudumiKomati/TableIespraudumiKomati.jsx';
import TableSavrupinajumi1 from '@/features/grammar-component-tables/components/tables/TableSavrupinajumi/TableSavrupinajumi1.jsx';
import TableSavrupinajumi2 from '@/features/grammar-component-tables/components/tables/TableSavrupinajumi/TableSavrupinajumi2.jsx';
import TableDivdabjaTeiciens from '@/features/grammar-component-tables/components/tables/TableDivdabjaTeiciens/TableDivdabjaTeiciens.jsx';
import TableVienlidzigi1 from '@/features/grammar-component-tables/components/tables/TableVienlidzigi/TableVienlidzigi1.jsx';
import TableVienlidzigi2 from '@/features/grammar-component-tables/components/tables/TableVienlidzigi/TableVienlidzigi2.jsx';
import TablePaligteikumi1 from '@/features/grammar-component-tables/components/tables/TablePaligteikumi/TablePaligteikumi1.jsx';
import TablePaligteikumi2 from '@/features/grammar-component-tables/components/tables/TablePaligteikumi/TablePaligteikumi2.jsx';
import TablePaligteikumi3 from '@/features/grammar-component-tables/components/tables/TablePaligteikumi/TablePaligteikumi3.jsx';
import TableDecimali from '@/features/grammar-component-tables/components/tables/TableDecimali/TableDecimali.jsx';
import TableSufiksi from '@/features/grammar-component-tables/components/tables/TableSufiksi/TableSufiksi.jsx';
import TableGenitivs from '@/features/grammar-component-tables/components/tables/TableGenitivs/TableGenitivs.jsx';
export const grammarTableComponents = {
  genitivs: TableGenitivs,
  sufiksi: TableSufiksi,
  alphabet: TableAlphabet,
  declensions: TableDeclensions,
  verbEndingsPresent: TableVerbEndingsPresent,
  patikInfinitive: TablePatikInfinitive,
  possessionIrNav: TablePossessionIrNav,
  verbEndingsPast: TableVerbEndingsPast,
  participles: TableParticipleSuper2,
  participlesV70V71: TableParticipleV70v71,
  indicativePassiveTimes: TableIndicative,
  moodsV75V76V77: TableMoodV75v76v77,
  reportedSimple: TableReportedV78,
  reportedCompound: TableCompoundV79,
  diminutives: TableWord32,
  verbPrefixes: TablePrefixVerbs,
  verbsTablesContainer: VerbsTablesContainer,
  verbsTablesContainer2: VerbsTablesContainer2,
  verbsTablesContainer3: VerbsTablesContainer3,
  verbsTablesContainer4: VerbsTablesContainer4,
  verbsTablesContainer5: VerbsTablesContainer5,
  numbersChart: TableNumbersChart,
  questionsChart: TableQuestionsChart,
  vocative: TableVocative,
  consonant: TableConsonant,
  decl2Exceptions: TableDecl2Exceptions,
  comparison: TableComparison,
  adjEndings: TableAdjEndings,
  prepositions: TablePrepositions,
  pron1: TablePron1,
  pron2: TablePron2,
  pron3: TablePron3,
  pron4: TablePron4,
  pron5: TablePron5,
  pron6: TablePron6,
  pron7: TablePron7,
  pron10: TablePron10,
  pron11: TablePron11,
  pron12: TablePron12,
  pron13: TablePron13,
  vardaSastavs: TableVardaSastavs ,
  salikteni: TableSalikteni,
  vardskiras1: TableVardskiras1,
  vardskiras2: TableVardskiras2,
  skaitlinieki: TableSkaitlinieki,
  galotnes: TableGalotnes,
  vietniekvardi: TableVietniekvardi,
  tuJus: TableTuJus,
  darbibasLaiki: TableDarbibasLaiki,
  darbibasKartas: TableDarbibasKartas,
  lielieBurti: TableLielieBurti,
  teikumi: TableTeikumi,
  saikli: TableSaikli,
  tiesaRuna: TableTiesaRuna,
  netiesaRuna: TableNetiesaRuna,
  uzruna: TableUzruna,
  uzrunasFormas: TableUzrunasFormas,
  iespraudumi: TableIespraudumi,
  iespraudumiKomati: TableIespraudumiKomati,
  savrupinajumi1: TableSavrupinajumi1,
  savrupinajumi2: TableSavrupinajumi2,
  divdabjaTeiciens: TableDivdabjaTeiciens,
  vienlidzigi1: TableVienlidzigi1,
  vienlidzigi2: TableVienlidzigi2,
  paligteikumi1: TablePaligteikumi1,
  paligteikumi2: TablePaligteikumi2,
  paligteikumi3: TablePaligteikumi3,
  decimali: TableDecimali,
} satisfies Record<string, ComponentType>;

export type GrammarTableComponentKey = keyof typeof grammarTableComponents;

export function getGrammarTableComponent(key?: string) {
  return key && Object.hasOwn(grammarTableComponents, key) ? grammarTableComponents[key as GrammarTableComponentKey] : null;
}
