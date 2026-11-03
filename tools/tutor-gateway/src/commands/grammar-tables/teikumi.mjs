import { sel } from './shared/pronoun.mjs';

/**
 * teikumi — «Предложение и классификация предложений» (TableTeikumi): three columns tk-col--simple | coord | sub,
 * each with title (tk-col-head), scheme (tk-scheme), function line (tk-func), joints (tk-joints, not in "simple"),
 * samples (tk-sample) where the joint is marked tk-hit. Existing named classes only.
 */
const COLS = {
  simple: 'Vienkāršs teikums — простое: одна грамматическая основа (Līst lietus. Mēs paliekam mājās.)',
  coord: 'Salikts sakārtots — сложносочинённое: части равноправны, связь un · bet · vai · , (Līst lietus, un mēs paliekam mājās.)',
  sub: 'Salikts pakārtots — сложноподчинённое: одна часть зависит от другой, связь jo · tā kā · kad · ka (Mēs paliekam mājās, jo līst lietus.)',
};

export default {
  tableKey: 'teikumi',
  summaryRu:
    'Классификация предложений по составу — три колонки. 1) Vienkāršs teikums (простое): одна грамматическая основа; примеры Līst lietus., Mēs paliekam mājās. 2) Salikts sakārtots (сложносочинённое): части равноправны, каждая может стоять сама; связь un · bet · vai · запятая; примеры Līst lietus, un mēs paliekam mājās. / Līst lietus, mēs paliekam mājās. 3) Salikts pakārtots (сложноподчинённое): одна часть зависит от другой и объясняет её; связь jo · tā kā · kad · ka; примеры Mēs paliekam mājās, jo līst lietus. / Tā kā līst lietus, mēs paliekam mājās. Схемы: teikums; A = B; galvenais ← palīgteikums.',
  notesRu: [
    'Внизу пояснение: оба salikti строятся из одних и тех же частей «Идёт дождь» + «Мы остаёмся дома»; un ставит части рядом на равных, jo делает одну причиной другой.',
    'В примерах цветом отмечено место соединения (союз с запятой).',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица классификации предложений', selectors: sel('.card.table-teikumi') },
    title: { labelRu: 'Заголовок «Предложение и классификация предложений»', selectors: sel('.vs-head') },
    ...Object.fromEntries(Object.entries(COLS).map(([id, ru]) => [`column_${id}`, { labelRu: `Колонка: ${ru}`, selectors: sel(`.tk-col--${id}`) }])),
    column_titles: { labelRu: 'Названия трёх типов предложений', selectors: sel('.tk-col-head') },
    schemes: { labelRu: 'Схемы предложений (teikums; A = B; galvenais ← palīgteikums)', selectors: sel('.tk-scheme') },
    functions: { labelRu: 'Пояснения к типам (одна основа, равноправные части, зависимая часть)', selectors: sel('.tk-func') },
    joints: { labelRu: 'Связующие слова: un · bet · vai · , и jo · tā kā · kad · ka', selectors: sel('.tk-joints') },
    samples: { labelRu: 'Все примеры предложений', selectors: sel('.tk-sample') },
    hits: { labelRu: 'Места соединения частей (союзы) в примерах', selectors: sel('.tk-hit') },
    coord_joints: { labelRu: 'Связка сложносочинённых: un · bet · vai · ,', selectors: sel('.tk-col--coord .tk-joints') },
    sub_joints: { labelRu: 'Связка сложноподчинённых: jo · tā kā · kad · ka', selectors: sel('.tk-col--sub .tk-joints') },
    note: { labelRu: 'Вывод внизу: un ставит части рядом, jo делает одну причиной другой', selectors: sel('.tk-note') },
  },
};
