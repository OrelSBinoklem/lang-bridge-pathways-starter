/** Curated excerpts, checked against the six canonical resources by overview.test.mjs.
 * Keep this lazy reader independent of the full gallery/catalog and its practice queries. */
export type OverviewLevel = 'A1' | 'A2' | 'B1' | 'B2';

export const overviewTables = {
  'en-sentence-structure': { level: 'a1', title: 'Каркас предложения: кто, действие, что' },
  'en-be': { level: 'a1', title: 'Be: описание, состояние и место' },
  'en-present-simple': { level: 'a1', title: 'Present Simple: действие и помощник do' },
  'en-questions': { level: 'a1', title: 'Вопросы: что вынести перед подлежащим' },
  'en-articles-noun-phrase': { level: 'a1', title: 'Именная группа: артикль → признак → предмет' },
  'en-there-and-it': { level: 'a1', title: 'There is / are и it: наличие или описание' },
  'en-pronouns-possessives': { level: 'a1', title: 'Местоимения: кто, кого и чей' },
  'en-place-time-prepositions': { level: 'a1', title: 'Место и время: куда поставить in / on / at' },
  'en-past-simple': { level: 'a2', title: 'Past Simple: was / were или did' },
  'en-present-simple-continuous': { level: 'a2', title: 'Present Simple или Continuous: обычно или сейчас' },
  'en-future-plans': { level: 'a2', title: 'Будущее: will, going to или договорённость' },
  'en-present-perfect-past': { level: 'a2', title: 'Present Perfect и Past Simple: до сих пор или тогда' },
  'en-quantity-countability': { level: 'a2', title: 'Количество: что считаем, а что измеряем' },
  'en-comparisons': { level: 'a2', title: 'Сравнение: чем, такой же и самый' },
  'en-modals-obligation-permission': { level: 'a2', title: 'Можно, нужно, нельзя и необязательно' },
  'en-infinitive-gerund': { level: 'a2', title: 'Два действия: to do, doing или do' },
  'en-past-narrative': { level: 'b1', title: 'Рассказ о прошлом: событие и фон' },
  'en-perfect-result-process': { level: 'b1', title: 'Past Simple или Present Perfect: факт, результат, процесс' },
  'en-real-imagined-conditions': { level: 'b1', title: 'Реальное условие, воображаемое условие и время' },
  'en-passive-focus': { level: 'b1', title: 'Пассив: что произошло с предметом' },
  'en-reported-embedded': { level: 'b1', title: 'Пересказ слов и косвенные вопросы' },
  'en-defining-relatives': { level: 'b1', title: 'Уточнить, какой человек или предмет' },
  'en-modals-present-meaning': { level: 'b1', title: 'Модальные конструкции: вывод, совет и обязанность' },
  'en-verb-complements': { level: 'b1', title: 'После глагола: объект, to или -ing' },
  'en-time-viewpoints': { level: 'b2', title: 'Точка отсчёта в прошлом и будущем' },
  'en-third-mixed-conditions': { level: 'b2', title: 'Нереальное прошлое и смешанные условия' },
  'en-wishes-preferences': { level: 'b2', title: 'Wish, if only и would rather' },
  'en-modal-perfect-meaning': { level: 'b2', title: 'Модальный глагол + have + V3' },
  'en-passive-reporting-causative': { level: 'b2', title: 'Сообщают, что…; сделать через другого человека' },
  'en-relative-participle-expansion': { level: 'b2', title: 'Дополнительные сведения и причастные конструкции' },
  'en-linking-clauses-phrases': { level: 'b2', title: 'Уступка, цель и результат: что ставить после связки' },
  'en-questions-focus': { level: 'b2', title: 'Сложный вопрос и смысловое выделение' },
  'en-verb-forms': { level: 'a1', title: 'Пять форм глагола: какую поставить в предложение' },
  'en-irregular-verbs': { level: 'a2', title: '60 частых неправильных глаголов: от формы к конструкции' },
  'en-noun-forms': { level: 'a1', title: 'Существительное: число и принадлежность' },
  'en-helpers': { level: 'a1', title: 'Be, have, do: смысловой глагол или помощник' },
  'en-used-to': { level: 'a2', title: 'Used to: раньше делал или уже привык' },
  'en-question-tags': { level: 'b1', title: 'Вопрос с хвостиком: isn’t it? / don’t you?' },
  'en-short-agreement': { level: 'b1', title: 'Короткий отклик: я тоже, а я — нет' },
  'en-phrasal-word-order': { level: 'b1', title: 'Многословные глаголы: куда поставить дополнение' },
  'en-determiners': { level: 'a2', title: 'Оба, любой из двух, ни один и каждый' },
  'en-tense-map': { level: 'b2', title: 'Карта 12 учебных временных конструкций' },
} as const;

export type OverviewTableId = keyof typeof overviewTables;
export type OverviewExample = {
  table_id: OverviewTableId;
  row_id: string;
  english: string;
  translation: string;
  note?: string;
};
export type OverviewSection = {
  id: string;
  level: OverviewLevel;
  through?: OverviewLevel;
  title: string;
  summary: string;
  paragraphs: readonly string[];
  examples: readonly OverviewExample[];
  remember: string;
  tableIds: readonly OverviewTableId[];
};

export function overviewTableHref(table_id: OverviewTableId): string {
  return `/grammar/english?level=${overviewTables[table_id].level}#${table_id}`;
}

function example(table_id: OverviewTableId, row_id: string, english: string, translation: string, note?: string): OverviewExample {
  return { table_id, row_id, english, translation, ...(note ? { note } : {}) };
}

export const englishGrammarOverviewSections: readonly OverviewSection[] = [
  {
    id: 'sentence', level: 'A1', title: 'Сначала соберите основу фразы',
    summary: 'Найдите, о ком речь и что о нём сообщается. Затем добавляйте подробности.',
    paragraphs: [
      'В обычном английском утверждении подлежащее стоит перед глаголом. После глагола действия может быть объект: кто → делает → что. После be идёт описание, состояние или место. Английской фразе обычно нужен выраженный глагол, даже если в русском переводе его нет.',
      'Место и время расширяют основу. Обстоятельство времени можно вынести в начало, сохранив порядок подлежащего и глагола. В инструкции исполнитель you обычно не назван: фраза начинается с базовой формы глагола.',
      'There is / are вводит то, что есть в каком-то месте; it отсылает к уже известному предмету или служит подлежащим в сообщении о погоде и времени. Не пытайтесь переводить there и it одним постоянным русским словом.',
    ],
    examples: [
      example('en-sentence-structure', 'en-sentence-structure-svo', 'I read stories.', 'Я читаю рассказы.', 'I — кто; read — действие; stories — что читаю.'),
      example('en-sentence-structure', 'en-sentence-structure-svc-adjective', 'The room is quiet.', 'В комнате тихо.', 'Quiet описывает комнату; is связывает описание с подлежащим.'),
      example('en-there-and-it', 'en-there-and-it-singular', 'There is a lamp by the bed.', 'У кровати есть лампа.'),
      example('en-there-and-it', 'en-there-and-it-weather', 'It is cold today.', 'Сегодня холодно.'),
    ],
    remember: 'Сначала основа «кто + глагол», затем объект, описание и обстоятельства.',
    tableIds: ['en-sentence-structure', 'en-there-and-it'],
  },
  {
    id: 'helpers-and-forms', level: 'A1', through: 'A2', title: 'Be, do, have и формы глагола',
    summary: 'Одна и та же форма может сообщать смысл или помогать строить конструкцию.',
    paragraphs: [
      'Be самостоятельно связывает подлежащее с описанием: am/is/are в настоящем, was/were в прошлом. Оно же помогает строить Continuous (be + V-ing) и пассив (be + V3). В вопросе be выходит перед подлежащим без do.',
      'Have может обозначать владение; тогда в обычной модели Simple вопрос строится с do/does/did. В Perfect have/has/had — помощник перед V3. Do тоже бывает смысловым («делать») и вспомогательным для вопросов и отрицаний Simple.',
      'Различайте пять форм: V1 — основа, V-s — форма he/she/it в Present Simple, V2 — утверждение Past Simple, V3 — причастие для Perfect и пассива, V-ing — форма процесса и других конструкций. У правильных глаголов V2 и V3 совпадают; у неправильных их проверяют отдельно. После does/did снова нужна V1: время и лицо уже выражены помощником.',
    ],
    examples: [
      example('en-be', 'en-be-i-am', 'I am ready.', 'Я готов.'),
      example('en-helpers', 'main-have-question', 'Does Emma have a bicycle?', 'У Эммы есть велосипед?', 'Have — владение; вопрос строит does.'),
      example('en-helpers', 'auxiliary-have-question', 'Has Emma found her keys?', 'Эмма нашла свои ключи?', 'Has + found — Perfect; отдельный do не нужен.'),
      example('en-irregular-verbs', 'base-after-did', 'Did you choose the window seat?', 'Вы выбрали место у окна?', 'После did стоит choose, а не chose.'),
    ],
    remember: 'Смотрите на всю конструкцию: be + -ing, have + V3, do + V1. Окончание нельзя выбирать по одному русскому переводу.',
    tableIds: ['en-be', 'en-helpers', 'en-verb-forms', 'en-irregular-verbs'],
  },
  {
    id: 'questions-negatives', level: 'A1', through: 'B2', title: 'Вопрос, отрицание и короткий ответ',
    summary: 'Вопрос и not обычно строятся вокруг первого вспомогательного или модального глагола; be умеет делать это и самостоятельно.',
    paragraphs: [
      'В общем вопросе помощник стоит перед подлежащим, а not — после помощника. Если у смыслового глагола в Simple помощника нет, добавьте do/does/did и верните смысловой глагол в V1. С be и модальными дополнительный do не нужен. В специальном вопросе перед этой схемой появляется вопросительное слово.',
      'Вопрос к подлежащему отличается: who заменяет самого исполнителя, поэтому обычный утвердительный вопрос не требует do. Сравните вопрос «кто звонит?» и «кому звонит Анна?». Во вложенном вопросе порядок снова как в утверждении: вопросительная рамка не переставляет слова во всех частях фразы.',
      'Короткий ответ сохраняет нужный помощник. В обычном вопросе с хвостиком положительная часть получает отрицательный хвостик и наоборот; never уже несёт отрицание. Для «я тоже» используются so + помощник + I после утверждения и neither + помощник + I после отрицания. Усложнение на B2: do может усиливать утверждение, а выделенный оборот с it/what переносит фокус сообщения.',
    ],
    examples: [
      example('en-questions', 'en-questions-who-subject', 'Who calls Anna every day?', 'Кто звонит Анне каждый день?'),
      example('en-questions', 'en-questions-who-object', 'Who does Anna call every day?', 'Кому Анна звонит каждый день?'),
      example('en-question-tags', 'tag-do-positive', 'You prefer tea, don’t you?', 'Ты предпочитаешь чай, верно?'),
      example('en-short-agreement', 'agree-positive-do', 'So do I.', 'Я тоже.', 'Отклик на предыдущее утверждение с обычным глаголом в Present Simple.'),
      example('en-questions-focus', 'emphatic-do', 'I did send the invitation!', 'Я действительно отправил приглашение!', 'Did здесь усиливает утверждение, а не задаёт вопрос.'),
    ],
    remember: 'Определите, к чему вопрос: к исполнителю, объекту или целой фразе. Потом выбирайте порядок слов.',
    tableIds: ['en-questions', 'en-question-tags', 'en-short-agreement', 'en-questions-focus'],
  },
  {
    id: 'articles-determiners', level: 'A1', through: 'A2', title: 'Артикли и определители: какой именно предмет',
    summary: 'Именная группа показывает не только предмет, но и то, как слушатель должен его опознать.',
    paragraphs: [
      'A/an представляет один исчисляемый предмет без указания на уже известный экземпляр. Выбор a или an зависит от следующего звука. The указывает на предмет, который собеседник может определить из контекста. Прилагательное стоит между определителем и существительным и не заменяет артикль.',
      'При обобщении множественные исчисляемые и неисчисляемые часто идут без артикля. My, this и похожие определители занимают место перед существительным; обычную группу не начинают одновременно с the и my.',
      'Both — оба из двух; either — любой из двух; neither — ни один из двух. All охватывает целую группу или количество, none — ничего из названного. Each и every направляют внимание на отдельных участников; перед существительным у них единственное число. Выбор определителя меняет охват сообщения, а не только форму слова.',
    ],
    examples: [
      example('en-articles-noun-phrase', 'en-articles-noun-phrase-first-mention', 'I need a pen.', 'Мне нужна ручка.'),
      example('en-articles-noun-phrase', 'en-articles-noun-phrase-known-item', 'Close the door, please.', 'Закройте дверь, пожалуйста.'),
      example('en-articles-noun-phrase', 'en-articles-noun-phrase-mass-general', 'Happiness is important.', 'Счастье важно.'),
      example('en-determiners', 'determiners-every', 'Every room has a smoke alarm.', 'В каждой комнате есть датчик дыма.'),
    ],
    remember: 'Спросите себя: один из многих, узнаваемый предмет, класс вообще или выбранная часть группы?',
    tableIds: ['en-articles-noun-phrase', 'en-determiners'],
  },
  {
    id: 'nouns-quantity', level: 'A1', through: 'A2', title: 'Существительные: число, количество, принадлежность',
    summary: 'Считаем предметы, измеряем вещества и отделяем множественное число от притяжательной формы.',
    paragraphs: [
      'У исчисляемого существительного есть единственное и множественное число. Часто добавляется -s/-es, но бывают изменения основы и неизменяемые формы. Неисчисляемое в данном значении мыслится как вещество или общее понятие: для подсчёта нужны порции, бутылки и другие единицы.',
      'Many и (a) few относятся к исчисляемому множественному числу, much и (a) little — к неисчисляемому. A few/a little обозначают некоторое количество; few/little без a подчёркивают его недостаток. Some обычно подходит для утверждений и предложений чего-либо, any — для нейтральных вопросов и отрицаний; это ориентир, а не запрет других значений.',
      'Принадлежность не равна множественному числу: у одного владельца ставится ’s, у обычного множественного на -s — апостроф после s, у неправильного множественного — снова ’s. Согласование выбирается по самому предмету, а не по владельцу.',
    ],
    examples: [
      example('en-noun-forms', 'counting-measures', 'We need two bottles of water.', 'Нам нужны две бутылки воды.'),
      example('en-quantity-countability', 'en-quantity-countability-few-countable', 'I have a few questions.', 'У меня есть несколько вопросов.'),
      example('en-noun-forms', 'singular-possessor', 'The boy’s helmet is red.', 'Шлем мальчика красный.'),
      example('en-noun-forms', 'regular-plural-possessor', 'The boys’ helmets are on the bench.', 'Шлемы мальчиков на скамейке.'),
    ],
    remember: 'Проверьте значение существительного, затем число и определитель. Апостроф сообщает о владельце.',
    tableIds: ['en-noun-forms', 'en-quantity-countability'],
  },
  {
    id: 'pronouns', level: 'A1', through: 'B1', title: 'Местоимения: кто, кого, чей и себя',
    summary: 'Форма местоимения зависит от его работы в предложении.',
    paragraphs: [
      'I/he/she/we/they занимают позицию подлежащего; me/him/her/us/them — объекта и позиции после предлога. Русский падеж в переводе не выбирает английскую форму автоматически: смотрите на связь с английским глаголом или предлогом.',
      'My/your/her и похожие формы стоят перед существительным, mine/yours/hers заменяют всю группу без существительного. Возвратные myself/yourself и другие показывают, что действие направлено на того же участника, либо подчёркивают его личное участие. Each other означает взаимное действие разных участников. Русское «свой» переводится с учётом того, чей именно предмет назван.',
    ],
    examples: [
      example('en-pronouns-possessives', 'en-pronouns-possessives-object', 'I know her.', 'Я её знаю.'),
      example('en-pronouns-possessives', 'en-pronouns-possessives-possessive-alone', 'This notebook is mine.', 'Эта тетрадь моя.'),
      example('en-pronouns-possessives', 'reflexive-object', 'I taught myself Spanish.', 'Я самостоятельно выучил испанский.'),
      example('en-pronouns-possessives', 'reciprocal', 'They help each other.', 'Они помогают друг другу.'),
    ],
    remember: 'Her может быть объектом или определителем перед существительным; hers употребляется самостоятельно.',
    tableIds: ['en-pronouns-possessives'],
  },
  {
    id: 'place-time', level: 'A1', title: 'Место, направление и время',
    summary: 'Предлог выбирают по отношению между словами, а не по одному русскому «в» или «на».',
    paragraphs: [
      'Для первых ориентиров in представляет пространство или объём, on — поверхность, at — точку или место деятельности, to — направление. Устойчивые сочетания нужно учить целиком: один предлог не покрывает все случаи русского перевода.',
      'Во времени at часто относится к часу, on — к дню или дате, in — к месяцу, году или более широкому периоду. Перед every, this, next, last с временным значением предлог обычно не нужен. Место и время добавляйте к уже собранной основе предложения.',
    ],
    examples: [
      example('en-place-time-prepositions', 'en-place-time-prepositions-in-place', 'The keys are in my bag.', 'Ключи в моей сумке.'),
      example('en-place-time-prepositions', 'en-place-time-prepositions-direction', 'We walk to the station.', 'Мы идём пешком к станции.'),
      example('en-place-time-prepositions', 'en-place-time-prepositions-at-time', 'The lesson starts at nine.', 'Урок начинается в девять.'),
      example('en-place-time-prepositions', 'en-place-time-prepositions-no-preposition', 'I call my sister every Sunday.', 'Я звоню сестре каждое воскресенье.'),
    ],
    remember: 'Различайте «где?» и «куда?», а во времени — точку, день и период.',
    tableIds: ['en-place-time-prepositions'],
  },
  {
    id: 'comparison', level: 'A2', title: 'Описание и сравнение',
    summary: 'Прилагательное описывает предмет, наречие — способ действия; сравнение выбирает отношение между ними.',
    paragraphs: [
      'Прилагательное стоит перед существительным или после be и других глаголов-связок. Наречие часто описывает действие; многие наречия образуются с -ly, но форму нужно проверять: есть исключения и совпадения с прилагательными.',
      'Для различия используйте сравнительную форму с than: -er у многих коротких прилагательных, more у многих длинных. Есть неправильные формы, например better. Для равенства — as + обычная форма + as, для превосходства — форма на -est или most с указанием группы; перед ней часто нужен the. Не соединяйте more и окончание -er.',
    ],
    examples: [
      example('en-comparisons', 'en-comparisons-short-adjective', 'This street is quieter than the main road.', 'На этой улице тише, чем на главной дороге.'),
      example('en-comparisons', 'en-comparisons-irregular', 'Your idea is better than mine.', 'Твоя идея лучше моей.'),
      example('en-comparisons', 'en-comparisons-equal', 'This bag is as heavy as that one.', 'Эта сумка такая же тяжёлая, как та.'),
    ],
    remember: 'Сначала решите: разница, равенство или выделение одного из группы. Затем выбирайте форму.',
    tableIds: ['en-comparisons'],
  },
  {
    id: 'present', level: 'A1', through: 'A2', title: 'Настоящее: обычно или сейчас',
    summary: 'Simple показывает привычку или состояние, Continuous — процесс вокруг настоящего момента.',
    paragraphs: [
      'Present Simple подходит для регулярных действий, фактов и многих состояний. У he/she/it смысловой глагол получает -s/-es; вопрос и отрицание строятся с does и V1. Наречие частоты помогает уточнить привычку, но время выбирается по смыслу.',
      'Present Continuous — am/is/are + V-ing. Это действие сейчас или временная ситуация в текущий период, даже если оно не происходит в секунду разговора. Не теряйте be и не добавляйте do.',
      'Глаголы состояния, например know, обычно стоят в Simple. Некоторые глаголы меняют поведение вместе со значением: владение и текущая деятельность — разные случаи. Поэтому правило «всё, что сейчас, ставь в Continuous» не работает.',
    ],
    examples: [
      example('en-present-simple', 'en-present-simple-affirmative-third', 'My brother works in a café.', 'Мой брат работает в кафе.'),
      example('en-present-simple-continuous', 'en-present-simple-continuous-routine', 'Lena takes the bus to work every day.', 'Лена каждый день ездит на работу на автобусе.'),
      example('en-present-simple-continuous', 'en-present-simple-continuous-now', 'Lena is walking to work right now.', 'Сейчас Лена идёт на работу пешком.'),
      example('en-present-simple-continuous', 'en-present-simple-continuous-temporary', 'We are staying with friends this week.', 'На этой неделе мы живём у друзей.'),
    ],
    remember: 'Выбор времени — способ представить ситуацию: обычное положение дел или текущий процесс.',
    tableIds: ['en-present-simple', 'en-present-simple-continuous'],
  },
  {
    id: 'past', level: 'A2', through: 'B1', title: 'Прошлое: события, фон и прежние привычки',
    summary: 'Рассказ движется событиями Simple, а Continuous показывает происходившее вокруг них.',
    paragraphs: [
      'В Past Simple смысловой глагол в утверждении имеет V2; в вопросе и отрицании did/did not требует V1. Для be остаётся собственная модель was/were. Законченное прошлое можно назвать прямо или понять из ситуации.',
      'Past Continuous — was/were + V-ing: процесс в выбранный прошлый момент. На его фоне может случиться отдельное событие Past Simple. When и while связывают части, но сами по себе не назначают время: важна роль каждого действия в рассказе.',
      'Used to + V1 показывает прежнюю привычку или состояние, обычно в сравнении с настоящим. Be used to + существительное/-ing означает «быть привыкшим», get used to — «привыкать». Это другие конструкции: to в них является предлогом.',
    ],
    examples: [
      example('en-past-simple', 'en-past-simple-irregular', 'Maya bought a new coat yesterday.', 'Вчера Майя купила новое пальто.'),
      example('en-past-narrative', 'event-on-background', 'I was packing my bag when the taxi arrived.', 'Я собирал сумку, когда приехало такси.'),
      example('en-used-to', 'used-to-past-state', 'This building used to be a cinema.', 'Раньше в этом здании был кинотеатр.'),
      example('en-used-to', 'used-to-familiar-ing', 'She is not used to working at night.', 'Она не привыкла работать по ночам.'),
    ],
    remember: 'Отделяйте случившееся событие от фона, а прежнюю привычку — от нынешней привычности.',
    tableIds: ['en-past-simple', 'en-past-narrative', 'en-used-to'],
  },
  {
    id: 'future', level: 'A2', title: 'Будущее: решение, намерение, договорённость',
    summary: 'Будущее передают несколькими конструкциями: выбор показывает, как говорящий видит план.',
    paragraphs: [
      'Will + V1 часто используется для решения в момент речи, обещания или прогноза. Be going to + V1 выделяет намерение, уже существовавшее до разговора, или прогноз по видимым основаниям. Эти значения могут пересекаться: контекст важнее списка слов-маркеров.',
      'Present Continuous с будущим временем удобно показывает организованную договорённость. Форма выглядит как процесс, но обстоятельство и ситуация направляют её в будущее. Вопрос и отрицание строятся по выбранной конструкции: will, форма be перед going to или форма be перед V-ing.',
    ],
    examples: [
      example('en-future-plans', 'en-future-plans-will-decision', 'I will answer the phone.', 'Я отвечу на звонок.', 'Решение принято сейчас.'),
      example('en-future-plans', 'en-future-plans-going-to-plan', 'We are going to paint the kitchen next month.', 'Мы собираемся покрасить кухню в следующем месяце.'),
      example('en-future-plans', 'en-future-plans-arrangement', 'I am seeing the dentist at ten tomorrow.', 'Завтра в десять у меня приём у стоматолога.'),
    ],
    remember: 'Спросите: решаю сейчас, намерен заранее или уже договорился? Это помогает выбрать форму, но не заменяет контекст.',
    tableIds: ['en-future-plans'],
  },
  {
    id: 'perfect', level: 'A2', through: 'B1', title: 'Perfect: связь с настоящим, результат и длительность',
    summary: 'Present Perfect смотрит на предыдущее из настоящего; Past Simple помещает событие в завершённое прошлое.',
    paragraphs: [
      'Have/has + V3 может сообщать о нынешнем результате, опыте до сих пор или сделанном за ещё не завершённый период. Если обсуждаете, что произошло вчера или в другой законченный период, обычно нужен Past Simple. Один и тот же русский перевод не делает эти формы взаимозаменяемыми.',
      'Have/has been + V-ing выделяет деятельность и её длительность до настоящего или недавние следы процесса. Simple часто удобнее для числа завершённых результатов. Continuous не гарантирует, что действие продолжается прямо сейчас, а Simple не всегда означает, что ситуация прекратилась.',
      'For называет длительность, since — начальную точку. Состояния вроде know обычно выражаются Perfect Simple даже при большой длительности. Не выбирайте Continuous только из-за «уже два часа».',
    ],
    examples: [
      example('en-present-perfect-past', 'en-present-perfect-past-present-result', 'I have lost my keys.', 'Я потерял ключи.', 'Сейчас важен результат: ключей нет.'),
      example('en-perfect-result-process', 'finished-past', 'I sent the application yesterday.', 'Я отправил заявление вчера.'),
      example('en-perfect-result-process', 'completed-count', 'She has checked six essays so far today.', 'За сегодня она уже проверила шесть сочинений.'),
      example('en-perfect-result-process', 'activity-duration', 'She has been checking essays for two hours.', 'Она проверяет сочинения уже два часа.'),
    ],
    remember: 'Различайте точку зрения и смысл: законченный прошлый эпизод, результат до сих пор или длительность деятельности.',
    tableIds: ['en-present-perfect-past', 'en-perfect-result-process'],
  },
  {
    id: 'time-viewpoints', level: 'B2', title: 'Точка отсчёта: раньше, в процессе, уже к сроку',
    summary: 'Та же логика процесса и предшествования работает относительно прошлого и будущего.',
    paragraphs: [
      'Past Perfect (had + V3) показывает, что случилось раньше выбранного прошлого момента. Past Perfect Continuous (had been + V-ing) выделяет процесс до него. Это отношение двух точек, поэтому не нужно превращать каждое давнее событие в Past Perfect.',
      'Future Continuous (will be + V-ing) представляет процесс в будущий момент, Future Perfect (will have + V3) — результат к этому моменту. Will have been + V-ing подчёркивает длительность деятельности до будущей точки. С состояниями обычно остаётся Perfect Simple.',
      'Карта 12 традиционных форм — способ видеть сочетания, а не двенадцать несвязанных правил: Simple представляет факт или событие целиком; Continuous — процесс; Perfect связывает предыдущее с точкой отсчёта; Perfect Continuous выделяет процесс до неё. Вопрос и not работают с первым помощником всей цепочки.',
    ],
    examples: [
      example('en-time-viewpoints', 'earlier-completion', 'When we reached the station, the last train had already left.', 'Когда мы добрались до вокзала, последний поезд уже ушёл.'),
      example('en-time-viewpoints', 'future-in-progress', 'At ten tomorrow, I will be presenting our findings.', 'Завтра в десять я буду представлять наши результаты.'),
      example('en-time-viewpoints', 'future-complete', 'By ten tomorrow, I will have sent the slides.', 'К завтрашним десяти я уже отправлю слайды.'),
    ],
    remember: 'Назовите точку отсчёта, затем решите: действие в ней, до неё или процесс вплоть до неё.',
    tableIds: ['en-time-viewpoints', 'en-tense-map'],
  },
  {
    id: 'modal-rules', level: 'A2', through: 'B1', title: 'Модальные глаголы: можно, нужно, стоит',
    summary: 'Модальная конструкция добавляет к действию способность, разрешение, обязанность или совет.',
    paragraphs: [
      'После can/could/must/should идёт V1 без to и без окончания -s. В вопросе модальный глагол выходит перед подлежащим; not ставится после него. Can может выражать умение или разрешение; could помогает вежливо попросить, а should — дать совет.',
      'Have to строится иначе: has to для he/she/it, вопросы с do/does и прошедшее had to. Mustn’t запрещает действие, don’t have to снимает необходимость: это разные сообщения. Для прошлой обязанности обычно нужен had to, а не механическая попытка сделать «прошедшее must».',
    ],
    examples: [
      example('en-modals-obligation-permission', 'en-modals-obligation-permission-permission-question', 'Could I sit here?', 'Можно мне здесь сесть?'),
      example('en-modals-obligation-permission', 'en-modals-obligation-permission-prohibition', 'You must not touch this switch.', 'Этот выключатель трогать нельзя.'),
      example('en-modals-obligation-permission', 'en-modals-obligation-permission-no-obligation', 'You do not have to bring a laptop.', 'Вам необязательно приносить ноутбук.'),
      example('en-modals-obligation-permission', 'en-modals-obligation-permission-advice', 'You should take a short break.', 'Вам стоит сделать небольшой перерыв.'),
    ],
    remember: 'Не путайте запрет и отсутствие обязанности: mustn’t ≠ don’t have to.',
    tableIds: ['en-modals-obligation-permission'],
  },
  {
    id: 'modal-deductions', level: 'B1', through: 'B2', title: 'Выводы, вероятность и оценка прошлого',
    summary: 'Модальный глагол может показывать уверенность говорящего, а не требование к собеседнику.',
    paragraphs: [
      'Must в выводе означает «должно быть», might — возможность, can’t — уверенное отрицательное предположение. После них можно описывать состояние базовой формой или процесс через be + V-ing. Обязанность и логический вывод различаются по контексту.',
      'Для взгляда назад используется модальный глагол + have + V3: must have — уверенный вывод, might have — возможность, can’t have — невозможность. Should have оценивает прошлое как желательное, часто с сожалением; could have может описывать неиспользованную возможность, но в другом контексте — предположение.',
      'Needn’t have + V3 говорит, что действие сделали без необходимости. Didn’t need to само по себе сообщает лишь об отсутствии необходимости; выполнено ли действие, выясняется из контекста. Не приписывайте этим двум конструкциям один смысл.',
    ],
    examples: [
      example('en-modals-present-meaning', 'deduction-certain', 'She must be tired after that long journey.', 'Она, должно быть, устала после такой долгой поездки.'),
      example('en-modal-perfect-meaning', 'past-possible-deduction', 'They might have taken a different route.', 'Возможно, они поехали другим маршрутом.'),
      example('en-modal-perfect-meaning', 'past-advice-regret', 'I should have read the instructions first.', 'Мне стоило сначала прочитать инструкцию.'),
      example('en-modal-perfect-meaning', 'unnecessary-done', 'We needn’t have brought any towels; the hotel provided them.', 'Мы зря привезли полотенца: в отеле их выдавали.'),
    ],
    remember: 'Сначала определите смысл модального: обязанность, вывод, возможность или оценка. Затем — время ситуации.',
    tableIds: ['en-modals-present-meaning', 'en-modal-perfect-meaning'],
  },
  {
    id: 'conditions', level: 'B1', title: 'Условия: закономерность, реальный план, воображение',
    summary: 'Форма после if помогает показать, как говорящий относится к возможности события.',
    paragraphs: [
      'Для закономерности обе части могут стоять в Present Simple. Для реального будущего в части с if обычно Present Simple, а в результате will/can + V1. В придаточном будущего времени после when, as soon as, until тоже обычно используется настоящее, хотя русский перевод будет будущим.',
      'Воображаемое настоящее или будущее часто строится как if + Past Simple → would/could + V1. Прошедшая форма здесь выражает дистанцию от реальности, а не прошлый календарный момент. В совете If I were you традиционно используется were.',
      'Части можно менять местами без смены логики. Не вставляйте would в обычную часть с if только потому, что в русском обе части имеют «бы». Unless передаёт условие «если не» и обычно не требует ещё одного not с тем же смыслом.',
    ],
    examples: [
      example('en-real-imagined-conditions', 'general-rule', 'If the battery runs out, the device switches off.', 'Если батарея разряжается, устройство выключается.'),
      example('en-real-imagined-conditions', 'real-future', 'If the train arrives on time, we will catch the bus.', 'Если поезд придёт вовремя, мы успеем на автобус.'),
      example('en-real-imagined-conditions', 'imagined-present', 'If I had more free time, I would learn Italian.', 'Если бы у меня было больше свободного времени, я бы учил итальянский.'),
      example('en-real-imagined-conditions', 'future-time', 'As soon as I get home, I will call you.', 'Как только я доберусь домой, я тебе позвоню.'),
    ],
    remember: 'Past после if может обозначать воображаемое сейчас. Проверяйте смысл, а не название формы.',
    tableIds: ['en-real-imagined-conditions'],
  },
  {
    id: 'mixed-conditions', level: 'B2', title: 'Нереальное прошлое и смешанные условия',
    summary: 'Условие и результат могут относиться к разным моментам времени.',
    paragraphs: [
      'Если воображаются другое прошлое и его прошлый результат, нужна модель if + had + V3 → would have + V3. Она не изменяет случившееся: говорящий рассматривает альтернативу. Could have и might have в результате могут добавлять возможность или меньшую уверенность.',
      'Если прошлый выбор объясняет воображаемое положение сейчас, условие остаётся had + V3, а результат становится would + V1. Обратная связь тоже возможна: общее нынешнее свойство через if + Past Simple сочетается с воображаемым прошлым результатом would have + V3. Для каждой части отдельно назовите её время.',
    ],
    examples: [
      example('en-third-mixed-conditions', 'past-to-past', 'If we had checked the timetable, we would have caught the last bus.', 'Если бы мы проверили расписание, то успели бы на последний автобус.'),
      example('en-third-mixed-conditions', 'past-to-present', 'If I had accepted that job, I would live in Berlin now.', 'Если бы я тогда согласился на ту работу, сейчас жил бы в Берлине.'),
    ],
    remember: 'Не подгоняйте обе части под одно время: сначала установите, когда условие и когда результат.',
    tableIds: ['en-third-mixed-conditions'],
  },
  {
    id: 'wishes', level: 'B2', title: 'Wish, if only и would rather',
    summary: 'Желание другого положения дел отличается от надежды на реальное будущее событие.',
    paragraphs: [
      'После wish/if only прошедшая форма выражает неудовлетворённость настоящим, а had + V3 — сожаление о прошлом. Could добавляет желаемую возможность. Wish + would часто направлен на желаемое изменение поведения или ситуации и не служит универсальной формой любого желания на будущее.',
      'Would rather при одном исполнителе требует V1 без to; отрицание — not перед V1. Если исполнители разные, обычная модель для настоящего или будущего — would rather + другой субъект + Past Simple. Для предпочтения о чужом прошлом используется Past Perfect. Одинаковый русский оборот «я бы предпочёл» скрывает разное устройство английской фразы.',
    ],
    examples: [
      example('en-wishes-preferences', 'wish-present', 'I wish our flat had a balcony.', 'Жаль, что в нашей квартире нет балкона.'),
      example('en-wishes-preferences', 'wish-past', 'I wish I had saved a copy.', 'Жаль, что я не сохранил копию.'),
      example('en-wishes-preferences', 'rather-same-subject', 'I would rather not discuss this tonight.', 'Я бы предпочёл не обсуждать это сегодня вечером.'),
      example('en-wishes-preferences', 'rather-other-subject', 'I would rather you called tomorrow.', 'Я бы предпочёл, чтобы ты позвонил завтра.'),
    ],
    remember: 'Различайте настоящее, прошлое и исполнителя желаемого действия. Past здесь не обязательно означает прошлое.',
    tableIds: ['en-wishes-preferences'],
  },
  {
    id: 'passive', level: 'B1', through: 'B2', title: 'Пассив и действие через другого человека',
    summary: 'Пассив выдвигает в начало то, с чем что-то происходит, а не исполнителя.',
    paragraphs: [
      'Основная модель — подлежащее + be в нужной форме + V3. Время выражает вся цепочка: процесс может иметь being, Perfect — been. Исполнителя добавляют через by, если он нужен. Пассив особенно полезен, когда важны предмет, процедура или результат, а исполнитель неизвестен либо очевиден.',
      'В сообщениях It is said/reported that… источник не называется прямо. В модели подлежащее + is said to… смысл высказывания относится к этому подлежащему; to have + V3 указывает на более раннее событие.',
      'Have/get + объект + V3 часто описывает заказанную услугу: действие выполняет кто-то другой. Это не Perfect: после have стоит объект, а не сразу V3. В других контекстах такая модель может описывать пережитое событие. Если исполнитель назван, различайте have + человек + V1 и get + человек + to V1.',
    ],
    examples: [
      example('en-passive-focus', 'active-comparison', 'A local team built the bridge.', 'Местная команда построила мост.'),
      example('en-passive-focus', 'passive-past', 'The bridge was built by a local team.', 'Мост построен местной командой.'),
      example('en-passive-reporting-causative', 'impersonal-report', 'It is reported that the road is closed.', 'Сообщают, что дорога закрыта.'),
      example('en-passive-reporting-causative', 'have-service', 'We had the windows replaced last month.', 'В прошлом месяце нам заменили окна.'),
    ],
    remember: 'Be + V3 — пассив; have + V3 — Perfect; have + объект + V3 — действие над названным объектом.',
    tableIds: ['en-passive-focus', 'en-passive-reporting-causative'],
  },
  {
    id: 'reported', level: 'B1', through: 'B2', title: 'Косвенная речь и вложенный вопрос',
    summary: 'Пересказывая слова, меняйте точку зрения, а не механически каждую форму.',
    paragraphs: [
      'Утверждения передают через said (that)… или told + адресат + (that)… . При пересказе из прошлого время часто сдвигается назад; местоимения и обозначения времени соотносятся с новой ситуацией. Если факт всё ещё верен, сохранение исходного времени может быть уместно.',
      'В косвенном общем вопросе нужны if/whether, в специальном остаётся вопросительное слово. Внутри порядок подлежащее → глагол, без обычной вопросительной перестановки и без добавленного do. Та же логика работает внутри вежливого Could you tell me…?',
      'Просьбы и указания строятся через asked/told + адресат + (not) to + V1. Так сохраняется, кому поручено действие; это не придаточное с переставленным вопросом.',
    ],
    examples: [
      example('en-reported-embedded', 'reported-statement', 'Nina said that she needed a break.', 'Нина сказала, что ей нужен перерыв.'),
      example('en-reported-embedded', 'reported-wh', 'He asked me where I lived.', 'Он спросил меня, где я живу.'),
      example('en-reported-embedded', 'polite-question', 'Could you tell me where the station is?', 'Не могли бы вы сказать мне, где вокзал?'),
      example('en-reported-embedded', 'reported-warning', 'He told us not to touch the cables.', 'Он велел нам не трогать кабели.'),
    ],
    remember: 'Вопросительная рамка не делает вложенную часть самостоятельным вопросом: where the station is.',
    tableIds: ['en-reported-embedded'],
  },
  {
    id: 'relatives', level: 'B1', through: 'B2', title: 'Relative clauses и причастные уточнения',
    summary: 'После существительного можно уточнить, какой именно предмет имеется в виду, или добавить сведения о нём.',
    paragraphs: [
      'Defining relative clause помогает опознать участника: who для человека, which для предмета, that возможно в обоих случаях. Местоимение можно опустить, если оно является дополнением, но не если оно подлежащее. Не добавляйте второе местоимение на ту же роль.',
      'Non-defining relative clause добавляет сведения к уже определённому участнику и отделяется запятыми. В нём that не употребляют и относительное местоимение не опускают. Whose выражает принадлежность; where/when связывают уточнение с местом или временем. Which может отсылать и к целому предыдущему сообщению.',
      'Причастный оборот после существительного с V-ing обычно имеет активный смысл, с V3 — пассивный. Отдельный оборот вроде Walking home… должен ясно относиться к исполнителю главной части: иначе получится, что действие выполняет не тот участник.',
    ],
    examples: [
      example('en-defining-relatives', 'relative-object', 'The book that you recommended is excellent.', 'Книга, которую ты порекомендовал, отличная.'),
      example('en-defining-relatives', 'omitted-object', 'The book you recommended is excellent.', 'Книга, которую ты порекомендовал, отличная.'),
      example('en-relative-participle-expansion', 'extra-person-information', 'My aunt, who teaches chemistry, helped me.', 'Моя тётя, которая преподаёт химию, помогла мне.'),
      example('en-relative-participle-expansion', 'passive-noun-modifier', 'The documents signed yesterday are on your desk.', 'Документы, подписанные вчера, лежат у вас на столе.'),
    ],
    remember: 'Нужно опознать предмет или добавить сведения? От этого зависят запятые, that и возможность пропуска.',
    tableIds: ['en-defining-relatives', 'en-relative-participle-expansion'],
  },
  {
    id: 'linkers', level: 'B2', title: 'Связки: причина, уступка, цель и результат',
    summary: 'Выбирая связку, проверяйте и смысл, и то, какая конструкция идёт после неё.',
    paragraphs: [
      'Although вводит целую часть с подлежащим и глаголом, despite — существительное или V-ing. Аналогично because связывается с частью предложения, because of — с именной группой. Один и тот же русский перевод не позволяет свободно менять эти модели.',
      'In order to + V1 обычно связывает цель с исполнителем главного действия. Если у цели свой исполнитель, удобно so that + подлежащее + глагольная конструкция. Для отрицательной цели not ставится перед to. Не смешивайте цель и наступивший результат.',
      'So + прилагательное/наречие + that и such + именная группа + that описывают степень, которая привела к результату. However соединяет сообщения о противопоставлении и требует соответствующей пунктуации, а не замены although слово в слово.',
    ],
    examples: [
      example('en-linking-clauses-phrases', 'although-clause', 'Although the route was longer, we arrived on time.', 'Хотя маршрут был длиннее, мы приехали вовремя.'),
      example('en-linking-clauses-phrases', 'despite-noun', 'Despite the longer route, we arrived on time.', 'Несмотря на более длинный маршрут, мы приехали вовремя.'),
      example('en-linking-clauses-phrases', 'purpose-other-subject', 'I wrote the address clearly so that the driver could read it.', 'Я разборчиво написал адрес, чтобы водитель смог его прочитать.'),
    ],
    remember: 'После связки ищите либо целую основу «кто + глагол», либо именную группу/-ing. Это часть выбора связки.',
    tableIds: ['en-linking-clauses-phrases'],
  },
  {
    id: 'gerund-infinitive', level: 'A2', through: 'B2', title: 'Второе действие: infinitive или gerund',
    summary: 'Первый глагол или предлог задаёт форму следующего действия; иногда форма меняет смысл.',
    paragraphs: [
      'Want/decide требуют to + V1, enjoy/finish — V-ing, модальный глагол — V1 без to. После предлога глагольное продолжение обычно принимает -ing. Заучивайте глагол вместе с моделью продолжения, а не просто русский перевод «делать».',
      'В want/ask + объект + to + V1 объект называет исполнителя второго действия. После make + объект в активной конструкции идёт V1 без to. Не всякое to вводит инфинитив: оно бывает предлогом, например в be used to.',
      'Remember to do — не забыть выполнить действие, remember doing — помнить уже пережитое. Stop doing — прекратить действие, stop to do — остановиться ради другого действия. Выбор -ing/to здесь меняет последовательность событий, а не стиль фразы.',
    ],
    examples: [
      example('en-infinitive-gerund', 'en-infinitive-gerund-enjoy-ing', 'She enjoys reading detective stories.', 'Ей нравится читать детективы.'),
      example('en-verb-complements', 'object-infinitive', 'I want you to check the address.', 'Я хочу, чтобы ты проверил адрес.'),
      example('en-verb-complements', 'remember-task', 'I remembered to lock the door.', 'Я не забыл запереть дверь.'),
      example('en-verb-complements', 'remember-event', 'I remember locking the door.', 'Я помню, как запирал дверь.'),
    ],
    remember: 'Сначала первая конструкция и её исполнитель, затем форма второго действия. Русский инфинитив не выбирает английскую модель.',
    tableIds: ['en-infinitive-gerund', 'en-verb-complements'],
  },
  {
    id: 'phrasal-verbs', level: 'B1', title: 'Phrasal verbs: значение и место дополнения',
    summary: 'У многословного глагола важно учить целое сочетание и его модель.',
    paragraphs: [
      'Частица может менять значение глагола. У разделяемого turn off существительное ставится после частицы или между глаголом и частицей. Обычное объектное местоимение в таком сочетании ставится между ними.',
      'У неразделяемого look after дополнение остаётся после after. Некоторые сочетания, например take off в значении взлёта, вообще не требуют объекта. Модель зависит от конкретного сочетания и значения: не переносите правило turn off на все глаголы с коротким словом после них.',
    ],
    examples: [
      example('en-phrasal-word-order', 'phrasal-noun-after-particle', 'Turn off the lamp.', 'Выключи лампу.'),
      example('en-phrasal-word-order', 'phrasal-noun-between', 'Turn the lamp off.', 'Выключи лампу.'),
      example('en-phrasal-word-order', 'phrasal-pronoun-between', 'Turn it off.', 'Выключи её.'),
      example('en-phrasal-word-order', 'phrasal-inseparable-noun', 'My neighbour looks after our cat at weekends.', 'По выходным мой сосед присматривает за нашим котом.'),
    ],
    remember: 'Учите сочетание сразу со значением и образцом дополнения: разделяется ли оно и нужен ли ему объект.',
    tableIds: ['en-phrasal-word-order'],
  },
];
