import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  tableClass: 'table-reason-result-sentence',
  title: 'Jo · tāpēc',
  subtitle: 'Причина и результат · A2',
  columns: [
    { key: 'fact', title: 'Факт', width: 23 },
    { key: 'meaning', title: 'Направление', width: 22 },
    { key: 'link', title: 'Связка', width: 12 },
    { key: 'sentence', title: 'Предложение', width: 43 },
  ],
  rows: [
    { key: 'rain-reason', cells: ['Līst.', 'Результат, затем причина', 'jo', 'Es ņemu lietussargu, jo līst.'] },
    { key: 'rain-result', cells: ['Līst.', 'Причина, затем результат', 'tāpēc', 'Līst, tāpēc es ņemu lietussargu.'] },
    { key: 'exam-reason', cells: ['Rīt ir eksāmens.', 'Результат, затем причина', 'jo', 'Es mācos, jo rīt ir eksāmens.'] },
    { key: 'exam-result', cells: ['Rīt ir eksāmens.', 'Причина, затем результат', 'tāpēc', 'Rīt ir eksāmens, tāpēc es mācos.'] },
    { key: 'bread-reason', cells: ['Rupjmaize ir cieta.', 'Результат, затем причина', 'jo', 'Es nepērku rupjmaizi, jo tā ir cieta.'] },
    { key: 'bread-result', cells: ['Rupjmaize ir cieta.', 'Причина, затем результат', 'tāpēc', 'Rupjmaize ir cieta, tāpēc es to nepērku.'] },
  ],
  rule: 'Jo вводит причину: результат, jo причина. Tāpēc вводит результат: причина, tāpēc результат. В этих моделях перед связкой ставится запятая. В каждой паре примеров сохраняется одна причинная связь.',
  warning: 'Соседство фактов не доказывает причинность. Здесь причина названа явно. Tāpēc ka означает «потому что» и вводит причину; это другая конструкция, не одиночное tāpēc. Причину не подменяем целью с lai или простым порядком событий.',
};

export default function TableReasonResultSentence() {
  return <SentencePatternTable {...pattern} />;
}
