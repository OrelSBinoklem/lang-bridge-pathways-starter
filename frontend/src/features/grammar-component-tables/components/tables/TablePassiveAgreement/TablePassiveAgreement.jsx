import SentencePatternTable from '../../SentencePatternTable.jsx';

// В строках отдельно показаны согласование, составное время и заданная модель пассива.
const pattern = {
  tableClass: 'table-passive-agreement',
  title: 'Ciešamā kārta · -ts / -ta',
  subtitle: 'Согласование · действие и результат · B1',
  columns: [
    { key: 'subject', title: 'Подлежащее', width: 28 },
    { key: 'auxiliary', title: 'Вспомогательная форма', width: 16 },
    { key: 'participle', title: 'Причастие', width: 26 },
    { key: 'agreement', title: 'Род, число · модель', width: 30 },
  ],
  rows: [
    { key: 'restored', cells: ['Tilts', 'ir', 'atjaunots', 'Муж. ед. · результат'] },
    { key: 'opened', cells: ['Pils', 'ir', 'atvērta', 'Жен. ед. · состояние'] },
    { key: 'built', cells: ['Torņi', 'bija', 'celti', 'Муж. мн. · составное прошедшее'] },
    { key: 'finished', cells: ['Svētku programmas', 'būs', 'pabeigtas', 'Жен. мн. · составное будущее'] },
    { key: 'shaped', cells: ['Krāvums', 'tiek', 'veidots', 'Муж. ед. · действие'] },
    { key: 'written', cells: ['Grāmata', 'ir', 'sarakstīta', 'Жен. ед. · результат'] },
  ],
  rule: 'Причастие согласуется с подлежащим: -ts / -ta / -ti / -tas в именительном. В заданной модели составных времён страдательного: ir — saliktā tagadne, bija — saliktā pagātne, būs — saliktā nākotne; результат рассматривается относительно соответствующего момента. Tiek + причастие — простое настоящее динамического пассива: действие/процесс. Ir + причастие — статическая модель результата/состояния.',
  warning: 'Только шесть основ: atjaunot, atvērt, celt, pabeigt, veidot, sarakstīt; именительный, неопределённые окончания, третье лицо. Ir atvērts может описывать состояние, а не однозначно доказывать составное время. Tiek не всегда означает незавершённость. В заданиях время и модель названы явно; в речи ir может опускаться.',
};

export default function TablePassiveAgreement() {
  return <SentencePatternTable {...pattern} />;
}
