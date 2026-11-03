export type GrammarLevel = 'a1' | 'a2' | 'b1' | 'b2' | string;

export type GrammarTableItem = {
  id: number | string;
  src: string;
  componentKey?: string;
  level: GrammarLevel;
  alt?: string;
  title?: string;
  description?: string;
  hintId?: string | number;
  width?: number;
  height?: number;
  widthMob?: number;
  heightMob?: number;
  /** Optional embed font scale percent (100/120/130). Omit = GRAMMAR_EMBED_FONT_SCALE_PERCENT */
  fontScalePercent?: number;
  /** B2 gallery split: review = A1-B1 reinforcement, core = pure B2 */
  b2Tier?: 'review' | 'core';
  /** Overrides the default "B2 необязательные!" badge text of `review` tables. */
  b2BadgeLabel?: string;
};

export type GrammarTablesData = {
  group1: GrammarTableItem[];
  group2: GrammarTableItem[];
  group3: GrammarTableItem[];
};

export const tablesData: GrammarTablesData = {
    group1: [
        { id: 0, src: '/grammar/tables/a1/alphabet-table-2.png', componentKey: 'alphabet', level: 'a1', title: 'ALFABĒTS', alt: 'alphabet-table', width: 1536, height: 1438, widthMob: 1536, heightMob: 1438 },
        { id: 1, src: '/grammar/tables/a1/IMG_20250810_0001.png', componentKey: 'declensions', level: 'a1', title: 'Locījumi (M+F) — склонения существительных', alt: 'Locījumi (M+F) — склонения существительных', width: 1942, height: 948, widthMob: 1942, heightMob: 948 },
        { id: 90, src: '/grammar/tables/a1/verb-1.png', componentKey: 'verbEndingsPresent', level: 'a1', title: 'Глаголы — окончания (настоящее)', alt: 'verb endings present', width: 1536, height: 600, widthMob: 1536, heightMob: 600 , fontScalePercent: 120},
        { id: 91, src: '/grammar/tables/a1/verb-2.png', componentKey: 'verbEndingsPast', level: 'a1', title: 'Глаголы — окончания (прош./буд.)', alt: 'verb endings past future', width: 1536, height: 480, widthMob: 1536, heightMob: 480 , fontScalePercent: 120},
        { id: 7, src: '/grammar/tables/a1/IMG_20250810_0002_3.png', componentKey: 'vocative', level: 'a1', title: 'Uzrunas forma (звательный падеж)', alt: 'Uzrunas forma — vocative', width: 1536, height: 414, widthMob: 1536, heightMob: 414 },
        //{ id: 8, src: '/grammar/tables/a2/IMG_20250810_0010_2.jpg', level: 'a2', alt: 'IMG_20250810_0010_2', width: 1935, height: 603, widthMob: 1935, heightMob: 603 },
        { id: 9, src: '/grammar/tables/a1/IMG_20250810_0010_3.png', componentKey: 'consonant', level: 'a1', title: 'LĪDZSKAŅU MIJA (ЧЕРЕДОВАНИЕ СОГЛАСНЫХ)', alt: 'Līdzskaņu mija — чередование согласных', width: 1536, height: 560, widthMob: 1536, heightMob: 560 },
        { id: 10, src: '/grammar/tables/b1/IMG_20250810_0029_2.png', componentKey: 'decl2Exceptions', level: 'b1', title: '2. DEKLINĀCIJAS LIETVĀRDI (IZŅĒMUMI)', alt: '2. deklinācijas lietvārdi — Существительные 2-го склонения, исключения', width: 1536, height: 514, widthMob: 1536, heightMob: 514 },
        //{ id: 11, src: '/grammar/tables/b1/IMG_20250810_0030_2.jpg', level: 'b1', alt: 'IMG_20250810_0030_2', width: 1929, height: 672, widthMob: 1929, heightMob: 672 },
        //todo не нужно (скл. прилаг.){ id: 12, src: '/grammar/tables/a1/IMG_20250810_0002_4.jpg', level: 'a1', alt: 'IMG_20250810_0002_4', width: 2045, height: 908, widthMob: 2045, heightMob: 908 },
        { id: 13, src: '/grammar/tables/a2/IMG_20250810_0012.png', componentKey: 'adjEndings', level: 'a2', title: 'Īpašības vārdu galotnes (V/S) — окончания прилагательных', alt: 'Īpašības vārdu galotnes — окончания прилагательных', width: 1536, height: 560, widthMob: 1536, heightMob: 560 },
        { id: 14, src: '/grammar/tables/a2/IMG_20250810_0012_2.png', componentKey: 'comparison', level: 'a2', title: 'SALĪDZINĀMĀS PAKĀPES (Степени сравнения)', alt: 'Salīdzināmās pakāpes — степени сравнения', width: 1536, height: 562, widthMob: 1536, heightMob: 562 },
        //{ id: 15, src: '/grammar/tables/a1/IMG_20250810_0003.jpg', level: 'a1-a1', alt: 'IMG_20250810_0003', width: 1907, height: 1000, widthMob: 1907, heightMob: 1000 },
        { id: 16, src: '/grammar/tables/a2/IMG_20250810_0011.png', componentKey: 'prepositions', level: 'a1', title: 'Prievārdi — предлоги и падежи', alt: 'Prievārdi — предлоги и падежи', description: 'A1-A2', width: 1934, height: 1636, widthMob: 1934, heightMob: 1636 },
        //{ id: 17, src: '/grammar/tables/a1/IMG_20250810_0003_2.jpg', level: 'a1', alt: 'IMG_20250810_0003_2', width: 1899, height: 567, widthMob: 1899, heightMob: 567 },
        //{ id: 18, src: '/grammar/tables/a1/IMG_20250810_0003_3.jpg', level: 'a1', alt: 'IMG_20250810_0003_3', width: 1967, height: 916, widthMob: 1967, heightMob: 916 },
        //{ id: 19, src: '/grammar/tables/a1/IMG_20250810_0004.jpg', level: 'a1', alt: 'IMG_20250810_0004', width: 2131, height: 994, widthMob: 2131, heightMob: 994 },
        //{ id: 20, src: '/grammar/tables/b2/IMG_20250810_0066_4.jpg', level: 'b2', alt: 'IMG_20250810_0066_4', width: 1787, height: 884, widthMob: 1787, heightMob: 884 },
        //{ id: 21, src: '/grammar/tables/a2/IMG_20250810_0014.jpg', level: 'a1', alt: 'IMG_20250810_0014', width: 1912, height: 747, widthMob: 1912, heightMob: 747 },
        //{ id: 22, src: '/grammar/tables/b1/IMG_20250810_0036_2.jpg', level: 'a1', alt: 'IMG_20250810_0004_3', width: 1937, height: 605, widthMob: 1937, heightMob: 605 },
        //todo не нужно{ id: 23, src: '/grammar/tables/b2/IMG_20250810_0068_only_desc.jpg', level: 'b2', alt: 'IMG_20250810_0068', width: 1823, height: 798, widthMob: 1823, heightMob: 798 },
        //{ id: 24, src: '/grammar/tables/a2/IMG_20250810_0014_3.jpg', level: 'a2', alt: 'IMG_20250810_0014_3', width: 1954, height: 519, widthMob: 1954, heightMob: 519 },
        //{ id: 64, src: '/grammar/tables/b2/IMG_20250810_0068_2.jpg', level: 'a2', alt: 'IMG_20250810_0068_2', width: 1823, height: 1058, widthMob: 1823, heightMob: 1058 },
        //{ id: 25, src: '/grammar/tables/a2/IMG_20250810_0014_4.jpg', level: 'a2', alt: 'IMG_20250810_0014_4', width: 1906, height: 633, widthMob: 1906, heightMob: 633 },
        //{ id: 26, src: '/grammar/tables/a2/IMG_20250810_0015.jpg', level: 'a2', alt: 'IMG_20250810_0015', width: 1907, height: 846, widthMob: 1907, heightMob: 846 },
        //{ id: 27, src: '/grammar/tables/a2/IMG_20250810_0015_2.jpg', level: 'a2', alt: 'IMG_20250810_0015_2', width: 1923, height: 739, widthMob: 1923, heightMob: 739 },
        //{ id: 28, src: '/grammar/tables/a2/IMG_20250810_0015_3.jpg', level: 'a2', alt: 'IMG_20250810_0015_3', width: 1923, height: 739, widthMob: 1923, heightMob: 739 },
        { id: 29, src: '/grammar/tables/a1/IMG_20250810_0004_4.png', componentKey: 'pron1', level: 'a1', title: 'Personu vietniekvārdi (Личные местоимения)', alt: 'Personu vietniekvārdi — личные местоимения', width: 1536, height: 520, widthMob: 1536, heightMob: 520 },
        { id: 38, src: '/grammar/tables/b1/IMG_20250810_0039_3.png', componentKey: 'pron10', level: 'b1', title: 'pats, pati — сам, сама', alt: 'pats, pati — сам, сама (atgriezeniskie vietniekvārdi)', width: 1536, height: 402, widthMob: 1536, heightMob: 402 },
        { id: 67, src: '/grammar/tables/b2/IMG_20250810_0072_4.png', componentKey: 'pron11', level: 'b2', title: 'sev — себя', alt: 'sev — себя (atgriezeniskais vietniekvārds / возвратное местоимение)', width: 1536, height: 344, widthMob: 1536, heightMob: 344 },
        { id: 30, src: '/grammar/tables/b1/IMG_20250810_0036_4.png', componentKey: 'pron2', level: 'a2', title: 'mans, mana — мой, моя', alt: 'mans, mana, mani, manas — мой, моя, мои (м.р.), мои (ж.р.) (piederības vietniekvārdi)', width: 1536, height: 402, widthMob: 1536, heightMob: 402 },
        { id: 31, src: '/grammar/tables/b1/IMG_20250810_0037.png', componentKey: 'pron3', level: 'a2', title: 'tavs, tava — твой, твоя', alt: 'tavs, tava, tavi, tavas — твой, твоя, твои (м.р.), твои (ж.р.) (piederības vietniekvārdi)', width: 1536, height: 402, widthMob: 1536, heightMob: 402 },
        { id: 32, src: '/grammar/tables/b1/IMG_20250810_0037_2.png', componentKey: 'pron4', level: 'a2', title: 'savs, sava — свой, своя', alt: 'savs, sava, savi, savas — свой, своя, свои (м.р.), свои (ж.р.) (piederības vietniekvārdi)', width: 1536, height: 402, widthMob: 1536, heightMob: 402 },
        { id: 33, src: '/grammar/tables/a2/IMG_20250810_0016_5.png', componentKey: 'pron13', level: 'a2', title: 'mūsu, jūsu, viņa, viņas, viņu — наш, ваш, его, её, их', alt: 'mūsu, jūsu, viņa, viņas, viņu — наш, ваш, его, её, их (ж.р.)/их (м.р.) (piederības vietniekvārdi)', width: 1536, height: 442, widthMob: 1536, heightMob: 442 },
        { id: 34, src: '/grammar/tables/a1/IMG_20250810_0005_3.png', componentKey: 'pron12', level: 'a1', title: 'kāds, kāda, kādi, kādas — какой, какая, какие', alt: 'kāds, kāda, kādi, kādas — какой, какая, какие (м.р.), какие (ж.р.) (jautājamie / attieksmes vietniekvārdi)', width: 1536, height: 402, widthMob: 1536, heightMob: 402 },
        { id: 35, src: '/grammar/tables/a1/IMG_20250810_0005_4.png', componentKey: 'pron5', level: 'a1', title: 'kurš, kura, kuri, kuras — который, которая, которые', alt: 'kurš, kura, kuri, kuras — который, которая, которые (м.р.), которые (ж.р.) (jautājamie / attieksmes vietniekvārdi)', width: 1536, height: 402, widthMob: 1536, heightMob: 402 },
        { id: 36, src: '/grammar/tables/a1/IMG_20250810_0005_5.png', componentKey: 'pron6', level: 'a1', title: 'tas, tā, tie, tās — этот, эта, эти', alt: 'tas, tā, tie, tās — этот, эта, эти (м.р.), эти (ж.р.) (norādāmie vietniekvārdi)', width: 1536, height: 402, widthMob: 1536, heightMob: 402 },
        { id: 37, src: '/grammar/tables/a1/IMG_20250810_0006.png', componentKey: 'pron7', level: 'a1', title: 'šis, šī, šie, šīs — этот, эта, эти', alt: 'šis, šī, šie, šīs — этот, эта, эти (м.р.), эти (ж.р.) (norādāmie vietniekvārdi)', width: 1536, height: 402, widthMob: 1536, heightMob: 402 },
        { id: 'super-6', src: '/grammar/super-tables/6.jpg', componentKey: 'numbersChart', level: 'a1', title: 'Числа', alt: 'Числа', hintId: '6', description: 'A1', width: 1536, height: 900, widthMob: 1536, heightMob: 900, fontScalePercent: 110 },
        { id: 'super-5', src: '/grammar/super-tables/5.jpg', componentKey: 'questionsChart', level: 'a1', title: 'Вопросы', alt: 'Вопросительные слова', hintId: '5', description: 'A1-A2', width: 1536, height: 900, widthMob: 1536, heightMob: 900, fontScalePercent: 110 },
        { id: 'diminutivi', src: '/grammar/tables/a2/diminutivi.png', componentKey: 'diminutives', level: 'a2', title: 'Уменьшительно ласкательные', alt: 'Уменьшительно ласкательные', hintId: '92', width: 1102, height: 521, widthMob: 1102, heightMob: 521 },
        { id: 'pre-verb', src: '/grammar/tables/a2/pre-verb.png', componentKey: 'verbPrefixes', level: 'a2', title: 'Приставки глаголов', alt: 'Приставки глаголов', hintId: '99', width: 1098, height: 885, widthMob: 1104, heightMob: 1080, fontScalePercent: 115 },
        //{ id: 'super-7', src: '/grammar/super-tables/7.png', level: 'a1', title: 'Глаголы (A1)', alt: 'Глаголы уровень A1', hintId: '7', description: 'A1' },
        //todo временно{ id: 'super-10', src: '/grammar/super-tables/10.png', level: 'a2', title: 'Глаголы A2 — часть 1', alt: 'Глаголы A2 часть 1', hintId: '10', description: 'A2' },
        //todo временно{ id: 'super-11', src: '/grammar/super-tables/11.png', level: 'a2', title: 'Глаголы A2 — часть 2', alt: 'Глаголы A2 часть 2', hintId: '11', description: 'A2' },
        //todo временно{ id: 'super-15', src: '/grammar/super-tables/15.png', level: 'a2', title: 'Глаголы A2 — часть 3', alt: 'Глаголы A2 часть 3', hintId: '11', description: 'A2' },
        //{ id: 'super-8', src: '/grammar/super-tables/8.png', level: 'a2', title: 'Прилагательные (A2)', alt: 'Прилагательные уровень A2', hintId: '8', description: 'A2' },
        { id: 'irregular-verb-1', src: '/grammar/tables/a1/irregular-verbs-1-new.png', componentKey: 'verbsTablesContainer', level: 'a1', title: 'Нерегулярные глаголы 1', alt: 'irregular-verbs-1', width: 2304, height: 1167, widthMob: 2304, heightMob: 1167 },
        { id: 'irregular-verb-6', src: '/grammar/tables/a2/irregular-verbs-1-new.png', componentKey: 'verbsTablesContainer2', level: 'a2', title: 'Нерегулярные глаголы 2', alt: 'irregular-verbs-1', width: 2304, height: 894, widthMob: 2304, heightMob: 894 },
        { id: 'irregular-verb-11', src: '/grammar/tables/a2/irregular-verbs-2-new.png', componentKey: 'verbsTablesContainer3', level: 'a2', title: 'Нерегулярные глаголы 3', alt: 'irregular-verbs-2', width: 2304, height: 867, widthMob: 2304, heightMob: 867 },
    ],
    group2: [
        { id: 'sentence-possession', src: '', componentKey: 'possessionIrNav', level: 'a1', title: 'Man ir · man nav — у кого есть и нет', width: 748, height: 650, widthMob: 748, heightMob: 650, fontScalePercent: 100 },
        //{ id: 39, src: '/grammar/tables/b1/IMG_20250810_0039_4.jpg', level: 'b1', alt: 'IMG_20250810_0039_4', width: 1895, height: 766, widthMob: 1895, heightMob: 766 },
        //{ id: 40, src: '/grammar/tables/b1/IMG_20250810_0039_5.jpg', level: 'b1', alt: 'IMG_20250810_0039_5', width: 1895, height: 514, widthMob: 1895, heightMob: 514 },
        { id: 41, src: '/grammar/tables/b1/participle-super-content.png', componentKey: 'participles', level: 'b1', title: 'ПРИЧАСТИЯ (Divdabji)', alt: 'participle-super-content', hintId: '93', width: 1536, height: 1032, widthMob: 1536, heightMob: 1032 },
        //todo ненадо{ id: 41, src: '/grammar/tables/b1/IMG_20250810_0052.jpg', level: 'b1', alt: 'IMG_20250810_0052', width: 1890, height: 682, widthMob: 1890, heightMob: 682 },
        //todo ненадо{ id: 42, src: '/grammar/tables/b1/IMG_20250810_0052_2.jpg', level: 'b1', alt: 'IMG_20250810_0052_2', width: 1890, height: 486, widthMob: 1890, heightMob: 486 },
        //todo ненадо{ id: 43, src: '/grammar/tables/b1/IMG_20250810_0052_3.jpg', level: 'b1', alt: 'IMG_20250810_0052_3', width: 1890, height: 766, widthMob: 1890, heightMob: 766 },
        //todo ненадо{ id: 44, src: '/grammar/tables/b1/IMG_20250810_0053.jpg', level: 'b1', alt: 'IMG_20250810_0053', width: 1918, height: 694, widthMob: 1918, heightMob: 694 },
        { id: 45, src: '/grammar/tables/b1/participle-super-content-2.png', componentKey: 'participlesV70V71', level: 'b1', title: 'Деепричастия', alt: 'Деепричастия (частично склоняемые и несклоняемые)', hintId: '94', width: 1536, height: 570, widthMob: 1536, heightMob: 570 , fontScalePercent: 130 },
        //todo ненадо{ id: 45, src: '/grammar/tables/b1/IMG_20250810_0053_2.jpg', level: 'b1', alt: 'IMG_20250810_0053_2', width: 1918, height: 480, widthMob: 1918, heightMob: 480 },
        //todo ненадо{ id: 46, src: '/grammar/tables/b1/IMG_20250810_0053_3.jpg', level: 'b1', alt: 'IMG_20250810_0053_3', width: 1918, height: 426, widthMob: 1918, heightMob: 426 },
        { id: 47, src: '/grammar/tables/b1/participle-super-content-4.png', componentKey: 'indicativePassiveTimes', level: 'b1', alt: 'participle-super-content-4', hintId: '96', width: 1108, height: 1171, widthMob: 1108, heightMob: 1171 , fontScalePercent: 130 },
        //todo ненадо{ id: 47, src: '/grammar/tables/b1/IMG_20250810_0053_4.jpg', level: 'b1', alt: 'IMG_20250810_0053_4', width: 2130, height: 1294, widthMob: 2130, heightMob: 1294 },
        //todo ненадо{ id: 48, src: '/grammar/tables/b1/IMG_20250810_0054.jpg', level: 'b1', alt: 'IMG_20250810_0054', width: 2100, height: 408, widthMob: 2100, heightMob: 408 },
        //todo ненадо{ id: 49, src: '/grammar/tables/b1/IMG_20250810_0054_2.jpg', level: 'b1', alt: 'IMG_20250810_0054_2', width: 1892, height: 632, widthMob: 1892, heightMob: 632 },
        //{todo ненадо id: 50, src: '/grammar/tables/b1/IMG_20250810_0054_3.jpg', level: 'b1', alt: 'IMG_20250810_0054_3', width: 1892, height: 640, widthMob: 1892, heightMob: 640 },
        { id: 51, src: '/grammar/tables/b1/participle-super-content-3.png', componentKey: 'moodsV75V76V77', level: 'b1', alt: 'participle-super-content-3', hintId: '95', width: 1536, height: 1244, widthMob: 1536, heightMob: 1244 , fontScalePercent: 130 },
        //todo ненадо{ id: 51, src: '/grammar/tables/b1/IMG_20250810_0054_4.jpg', level: 'b1', alt: 'IMG_20250810_0054_4', width: 1892, height: 676, widthMob: 1892, heightMob: 676 },
        //todo ненадо{ id: 52, src: '/grammar/tables/b1/IMG_20250810_0054_5.jpg', level: 'b1', alt: 'IMG_20250810_0054_5', width: 1892, height: 656, widthMob: 1892, heightMob: 656 },
        //todo ненадо{ id: 53, src: '/grammar/tables/b1/IMG_20250810_0055.jpg', level: 'b1', alt: 'IMG_20250810_0055', width: 1891, height: 892, widthMob: 1891, heightMob: 892 },
        { id: 54, src: '/grammar/tables/b1/participle-super-content-5.png', componentKey: 'reportedSimple', level: 'b1', alt: 'participle-super-content-5', hintId: '97', width: 1536, height: 308, widthMob: 1536, heightMob: 308 , fontScalePercent: 130 },
        //todo ненадо{ id: 54, src: '/grammar/tables/b1/IMG_20250810_0055_2.jpg', level: 'b1', alt: 'IMG_20250810_0055_2', width: 1891, height: 755, widthMob: 1891, heightMob: 755 },
        { id: 55, src: '/grammar/tables/b1/participle-super-content-6.png', componentKey: 'reportedCompound', level: 'b1', alt: 'participle-super-content-6', hintId: '98', width: 1536, height: 558, widthMob: 1536, heightMob: 558 , fontScalePercent: 130 },
        //todo ненадо{ id: 55, src: '/grammar/tables/b1/IMG_20250810_0055_3.jpg', level: 'b1', alt: 'IMG_20250810_0055_3', width: 1891, height: 720, widthMob: 1891, heightMob: 720 },
        //{ id: 'super-13', src: '/grammar/super-tables/13.png', level: 'b1', title: 'Прилагательные (B1)', alt: 'Прилагательные уровень B1', hintId: '13', description: 'B1' },
        //todo временно{ id: 'super-12', src: '/grammar/super-tables/12.png', level: 'b1', title: 'Глаголы B1', alt: 'Глаголы уровень B1', hintId: '12', description: 'B1' },
        { id: 'irregular-verb-15', src: '/grammar/tables/b1/irregular-verbs-1-new.png', componentKey: 'verbsTablesContainer4', level: 'b1', title: 'Нерегулярные глаголы 4', alt: 'irregular-verbs-1', width: 2304, height: 963, widthMob: 2304, heightMob: 963 },
        { id: 'irregular-verb-16', src: '/grammar/tables/b1/irregular-verbs-2-new.png', componentKey: 'verbsTablesContainer5', level: 'b1', title: 'Нерегулярные глаголы 5', alt: 'irregular-verbs-2', width: 2304, height: 1239, widthMob: 2304, heightMob: 1239 },
    ],
    group3: [
        // --- core: чистый B2 ---
        { id: 65, src: '/grammar/tables/b2/IMG_20250810_0068_3.jpg', componentKey: 'decimali', level: 'b2', title: 'Decimāldaļskaitļi — десятичные дроби', alt: 'Decimāldaļskaitļi — десятичные дроби', width: 768, height: 327, widthMob: 768, heightMob: 327, b2Tier: 'core' },
        { id: 73, src: '/grammar/tables/b2/IMG_20250810_0083_3.jpg', componentKey: 'teikumi', level: 'b2', title: 'Предложение и классификация предложений', alt: 'Предложение и классификация предложений', width: 720, height: 495, widthMob: 720, heightMob: 495, b2Tier: 'core' },
        { id: 74, src: '/grammar/tables/b2/IMG_20250810_0083_4.jpg', componentKey: 'saikli', level: 'b2', title: 'Использование союзов', alt: 'Использование союзов', width: 720, height: 636, widthMob: 720, heightMob: 636, b2Tier: 'core' },
        { id: 75, src: '/grammar/tables/b2/IMG_20250810_0084.jpg', componentKey: 'tiesaRuna', level: 'b2', title: 'Прямая речь', alt: 'Прямая речь', width: 720, height: 720, widthMob: 720, heightMob: 720, b2Tier: 'core' },
        { id: 76, src: '/grammar/tables/b2/IMG_20250810_0084_2.jpg', componentKey: 'netiesaRuna', level: 'b2', title: 'Косвенная речь', alt: 'Косвенная речь', width: 720, height: 538, widthMob: 720, heightMob: 538, b2Tier: 'core' },
        { id: 77, src: '/grammar/tables/b2/IMG_20250810_0084_3.jpg', componentKey: 'uzruna', level: 'b2', title: 'Обращение и группа обращения', alt: 'Обращение и группа обращения', width: 720, height: 674, widthMob: 720, heightMob: 674, b2Tier: 'core' },
        { id: 78, src: '/grammar/tables/b2/IMG_20250810_0084_4.jpg', componentKey: 'uzrunasFormas', level: 'b2', title: 'Формы обращения', alt: 'Формы обращения', width: 720, height: 464, widthMob: 720, heightMob: 464, b2Tier: 'core' },
        { id: 79, src: '/grammar/tables/b2/IMG_20250810_0085.jpg', componentKey: 'iespraudumi', level: 'b2', title: 'Вводные слова и выражения', alt: 'Вводные слова и выражения', width: 720, height: 553, widthMob: 720, heightMob: 553, b2Tier: 'core' },
        { id: 80, src: '/grammar/tables/b2/IMG_20250810_0085_2.jpg', componentKey: 'iespraudumiKomati', level: 'b2', title: 'Пунктуация с вводными словами', alt: 'Пунктуация с вводными словами', width: 720, height: 632, widthMob: 720, heightMob: 632, b2Tier: 'core' },
        { id: 81, src: '/grammar/tables/b2/IMG_20250810_0085_3.jpg', componentKey: 'savrupinajumi1', level: 'b2', title: 'Обособленные члены предложения', alt: 'Обособленные члены предложения', width: 720, height: 555, widthMob: 720, heightMob: 555, b2Tier: 'core' },
        { id: 82, src: '/grammar/tables/b2/IMG_20250810_0086.jpg', componentKey: 'savrupinajumi2', level: 'b2', title: 'Обособленные обстоятельства', alt: 'Обособленные обстоятельства', width: 720, height: 550, widthMob: 720, heightMob: 550, b2Tier: 'core' },
        { id: 83, src: '/grammar/tables/b2/IMG_20250810_0086_2.jpg', componentKey: 'divdabjaTeiciens', level: 'b2', title: 'Причастный оборот', alt: 'Причастный оборот', width: 720, height: 785, widthMob: 720, heightMob: 785, b2Tier: 'core' },
        { id: 84, src: '/grammar/tables/b2/IMG_20250810_0086_3.jpg', componentKey: 'vienlidzigi1', level: 'b2', title: 'Однородные члены предложения', alt: 'Однородные члены предложения', width: 720, height: 605, widthMob: 720, heightMob: 605, b2Tier: 'core' },
        { id: 85, src: '/grammar/tables/b2/IMG_20250810_0087.jpg', componentKey: 'vienlidzigi2', level: 'b2', title: 'Однородные члены предложения и обобщающее слово', alt: 'Однородные члены предложения и обобщающее слово', width: 720, height: 640, widthMob: 720, heightMob: 640, b2Tier: 'core' },
        { id: 86, src: '/grammar/tables/b2/IMG_20250810_0087_2.jpg', componentKey: 'paligteikumi1', level: 'b2', title: 'Придаточные предложения', alt: 'Придаточные предложения', width: 720, height: 580, widthMob: 720, heightMob: 580, b2Tier: 'core' },
        { id: 87, src: '/grammar/tables/b2/IMG_20250810_0088.jpg', componentKey: 'paligteikumi2', level: 'b2', title: 'Придаточные предложения — расширенная таблица', alt: 'Придаточные предложения — расширенная таблица', width: 720, height: 1715, widthMob: 720, heightMob: 1715, b2Tier: 'core' },
        { id: 88, src: '/grammar/tables/b2/IMG_20250810_0089.jpg', componentKey: 'paligteikumi3', level: 'b2', title: 'Наиболее часто используемые вводные слова придаточных предложений', alt: 'Вводные слова придаточных предложений', width: 720, height: 770, widthMob: 720, heightMob: 770, b2Tier: 'core' },
        // --- review: закрепление A1-B1 (не чистый B2) ---
        { id: 56, src: '/grammar/tables/b2/IMG_20250810_0057.jpg', componentKey: 'vardaSastavs', level: 'b2', title: 'Структура слова — Vārda sastāvs', alt: 'Vārda sastāvs', width: 720, height: 437, widthMob: 720, heightMob: 437, fontScalePercent: 115, b2Tier: 'review' },
        { id: 58, src: '/grammar/tables/b2/IMG_20250810_0058.jpg', componentKey: 'salikteni', level: 'b2', title: 'Salikteņi — сложные слова', alt: 'Salikteņi', width: 720, height: 525, widthMob: 720, heightMob: 525, fontScalePercent: 115, b2Tier: 'review' },
        { id: 59, src: '/grammar/tables/b2/IMG_20250810_0058_2.jpg', componentKey: 'vardskiras1', level: 'b2', title: 'Vārdšķiras — части речи', alt: 'Vārdšķiras — части речи', width: 720, height: 533, widthMob: 720, heightMob: 533, b2Tier: 'review' },
        { id: 60, src: '/grammar/tables/b2/IMG_20250810_0059.jpg', componentKey: 'vardskiras2', level: 'b2', title: 'Vārdšķiras — продолжение', alt: 'Vārdšķiras — продолжение', width: 720, height: 1026, widthMob: 720, heightMob: 1026, b2Tier: 'review' },
        { id: 61, src: '/grammar/tables/b2/IMG_20250810_0062_3.jpg', componentKey: 'skaitlinieki', level: 'b2', title: 'Vienskaitlinieki un daudzskaitlinieki', alt: 'Vienskaitlinieki un daudzskaitlinieki', width: 720, height: 703, widthMob: 720, heightMob: 703, b2Tier: 'review' },
        { id: 62, src: '/grammar/tables/b2/IMG_20250810_0065_2.jpg', componentKey: 'galotnes', level: 'b2', title: 'Nenoteiktā un noteiktā galotne', alt: 'Nenoteiktā un noteiktā galotne', width: 720, height: 1088, widthMob: 720, heightMob: 1088, b2Tier: 'review' },
        { id: 66, src: '/grammar/tables/b2/IMG_20250810_0069.jpg', componentKey: 'vietniekvardi', level: 'b2', title: 'Vietniekvārds — группы местоимений', alt: 'Vietniekvārds — группы местоимений', width: 720, height: 797, widthMob: 720, heightMob: 797, b2Tier: 'review' },
        { id: 68, src: '/grammar/tables/b2/IMG_20250810_0072_5.jpg', componentKey: 'tuJus', level: 'b2', title: 'Vietniekvārdi tu un jūs — обращение', alt: 'Vietniekvārdi tu un jūs — обращение', width: 720, height: 426, widthMob: 720, heightMob: 426, b2Tier: 'review' },
        { id: 70, src: '/grammar/tables/b2/IMG_20250810_0080_3.jpg', componentKey: 'darbibasLaiki', level: 'b2', title: 'Darbības vārda laiki — времена глагола', alt: 'Darbības vārda laiki — времена глагола', width: 720, height: 777, widthMob: 720, heightMob: 777, b2Tier: 'review' },
        { id: 71, src: '/grammar/tables/b2/IMG_20250810_0081.jpg', componentKey: 'darbibasKartas', level: 'b2', title: 'Залоги глагола — Darbības vārda kārtas', alt: 'Залоги глагола — Darbības vārda kārtas', width: 720, height: 537, widthMob: 720, heightMob: 537, b2Tier: 'review' },
        { id: 89, src: '/grammar/tables/b2/IMG_20250810_0089_2.jpg', componentKey: 'lielieBurti', level: 'b2', title: 'Lielie sākumburti nosaukumos', alt: 'Lielie sākumburti nosaukumos', width: 720, height: 574, widthMob: 720, heightMob: 574, b2Tier: 'review' },
        { id: 92, hintId: 101, src: '/grammar/tables/b2/IMG_20250810_0058.jpg', componentKey: 'sufiksi', level: 'b2', title: 'Суффиксы и словообразование', alt: 'Суффиксы и словообразование', width: 720, height: 1104, widthMob: 720, heightMob: 1104, b2Tier: 'review', b2BadgeLabel: 'B2 дополнительные' },
        { id: 94, hintId: 100, src: '/grammar/tables/b2/IMG_20250810_0058.jpg', componentKey: 'genitivs', level: 'b2', title: 'Генитивный оборот и порядок слов', alt: 'Генитивный оборот и порядок слов', width: 720, height: 746, widthMob: 720, heightMob: 746, b2Tier: 'review', b2BadgeLabel: 'B2 дополнительные' },
        //todo ненадо{ id: 63, src: '/grammar/tables/b2/IMG_20250810_0067.jpg', level: 'b2', alt: 'IMG_20250810_0067', width: 1815, height: 534, widthMob: 1815, heightMob: 534 },
        //todo ненадо{ id: 69, src: '/grammar/tables/b2/IMG_20250810_0073.jpg', level: 'b2', alt: 'IMG_20250810_0073', width: 1810, height: 1248, widthMob: 1810, heightMob: 1248 },
        //{ id: 'super-14', src: '/grammar/super-tables/14.png', level: 'b2', title: 'Прилагательные (B2)', alt: 'Прилагательные уровень B2', hintId: '14', description: 'B2' },
        { id: 'sentence-patik', src: '', componentKey: 'patikInfinitive', level: 'a1', title: 'Хочу, могу, нужно, нравится', alt: 'Gribu / varu, vajag и patīk: действие или предмет', width: 900, height: 1400, widthMob: 900, heightMob: 1400, fontScalePercent: 100 },
    ]
};


export default tablesData;
