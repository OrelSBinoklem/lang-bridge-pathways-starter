import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  tableClass: 'table-participial-subject',
  title: 'Viens darītājs · -dams / -dama',
  subtitle: 'Один исполнитель двух одновременных действий · B1',
  columns: [
    { key: 'subject', title: 'Исполнитель', width: 19 },
    { key: 'agreement', title: 'Род / число', width: 18 },
    { key: 'form', title: 'Форма', width: 20 },
    { key: 'sentence', title: 'Два действия', width: 43 },
  ],
  rows: [
    { key: 'masculine-singular', cells: ['galdnieks', 'Мужской · ед.', 'strādādams', 'Strādādams darbnīcā, galdnieks dzied.'] },
    { key: 'feminine-singular', cells: ['adītāja', 'Женский · ед.', 'adīdama', 'Adīdama cimdus, adītāja runā ar māsu.'] },
    { key: 'masculine-plural', cells: ['keramiķi', 'Мужской · мн.', 'darinādami', 'Darinādami krūzes, keramiķi stāsta par amatu.'] },
    { key: 'feminine-plural', cells: ['audējas', 'Женский · мн.', 'strādādamas', 'Strādādamas darbnīcā, audējas dzied.'] },
    { key: 'recipient', cells: ['Anna, не brālim', 'Женский · ед.', 'lasīdama', 'Lasīdama vēstuli, Anna stāsta brālim par ceļojumu.'] },
    { key: 'different-actors', cells: ['Anna; Jānis', 'Разные исполнители', 'Не один оборот на -dams', 'Anna ada cimdus, bet Jānis vienlaikus lasa grāmatu.'] },
  ],
  rule: 'В этой модели оборот на -dams / -dama / -dami / -damas и личный глагол относятся к одному подлежащему. Формы: муж. ед. -dams, жен. ед. -dama, муж. мн. -dami, жен. мн. -damas. Два действия здесь одновременны. Получатель в дательном не становится исполнителем оборота.',
  warning: 'Первый слой ограничен невозвратными darināt, strādāt, adīt, lasīt, zīmēt, izmantot, remontēt, dziedāt. Это не весь divdabja teiciens: возвратные формы и чередования других основ не проверяются. На -ot правило одного подлежащего не переносим: возможен другой исполнитель в дательном. Запятые даны для этих расширенных оборотов; отдельной проверки пунктуации нет.',
};

export default function TableParticipialSubject() {
  return <SentencePatternTable {...pattern} />;
}
