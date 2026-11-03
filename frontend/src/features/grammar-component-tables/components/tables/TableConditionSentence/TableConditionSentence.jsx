import SentencePatternTable from '../../SentencePatternTable.jsx';

// Части показаны отдельно; колонка границы сохраняет место запятой в полной фразе.
const pattern = {
  tableClass: 'table-condition-sentence',
  title: 'Ja …, (tad) …',
  subtitle: 'Реальное условие · путешествие · A2',
  columns: [
    { key: 'condition', title: 'Условие', width: 31 },
    { key: 'link', title: 'Связь частей', width: 17 },
    { key: 'result', title: 'Следствие', width: 32 },
    { key: 'boundary', title: 'Граница', width: 20 },
  ],
  rows: [
    {
      key: 'rain',
      cells: ['līst', 'Ja …, tad …', 'es ņemu lietussargu', 'līst, tad'],
    },
    {
      key: 'sun',
      cells: ['spīd saule', 'Ja …, …', 'es ņemu saulesbrilles', 'saule, es'],
    },
    {
      key: 'delay',
      cells: ['autobuss kavē', 'Ja …, tad …', 'mēs gaidām autoostā', 'kavē, tad'],
    },
    {
      key: 'money',
      cells: ['man ir nauda', '…, ja …', 'es rezervēšu istabu', 'istabu, ja'],
    },
    {
      key: 'warm',
      cells: ['rīt būs silts laiks', 'Ja …, …', 'mēs brauksim pie jūras', 'laiks, mēs'],
    },
    {
      key: 'luggage',
      cells: ['čemodāns ir smags', '…, ja …', 'es ņemšu mazu somu', 'somu, ja'],
    },
  ],
  rule: 'Ja вводит реальное условие, при выполнении которого возможно следствие. Части отделяются запятой: Ja līst, es ņemu lietussargu. Условие может стоять после следствия: Es rezervēšu istabu, ja man ir nauda. В схеме Ja …, tad … слово tad подчёркивает следствие, но его можно опустить.',
  warning: 'Первый слой A2: только простое изъявительное настоящее и будущее. Условие не означает, что оно уже выполнено; будущее само по себе не означает условие. Формы условного наклонения с -tu и гипотетические условия здесь не тренируются. Порядок сборки задан в вопросе; в свободной речи возможны другие порядки.',
};

export default function TableConditionSentence() {
  return <SentencePatternTable {...pattern} />;
}
