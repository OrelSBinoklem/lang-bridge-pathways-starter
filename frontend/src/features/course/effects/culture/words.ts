/** A word or phrase in Latvian with its translations, for the "Культура и язык" effects. */
export type Bilingual = { lv: string; ru: string; uk: string };

/** Finished-motif labels: `MOTIFS`, then `LEFT_MOTIFS` (motifs.ts). */
export const MOTIF_WORDS: Bilingual[] = [
  { lv: 'Auseklis', ru: 'Утренняя звезда', uk: 'Ранкова зоря' },
  { lv: 'Saule', ru: 'Солнце', uk: 'Сонце' },
  { lv: 'Mēness', ru: 'Луна', uk: 'Місяць' },
  { lv: 'Ozols', ru: 'Дуб', uk: 'Дуб' },
  { lv: 'Putns', ru: 'Птица', uk: 'Птах' },
  { lv: 'Sirds', ru: 'Сердце', uk: 'Серце' },
  { lv: 'Zieds', ru: 'Цветок', uk: 'Квітка' },
  { lv: 'Rombs', ru: 'Ромб', uk: 'Ромб' },
  { lv: 'Taurenis', ru: 'Бабочка', uk: 'Метелик' },
  { lv: 'Egle', ru: 'Ель', uk: 'Ялина' },
  { lv: 'Lapa', ru: 'Лист', uk: 'Листок' },
  { lv: 'Vilnis', ru: 'Волна', uk: 'Хвиля' },
];

/** Words that float in the amber. */
export const AMBER_WORDS: Bilingual[] = [
  { lv: 'dzintars', ru: 'янтарь', uk: 'бурштин' },
  { lv: 'valoda', ru: 'язык', uk: 'мова' },
  { lv: 'vārds', ru: 'слово', uk: 'слово' },
  { lv: 'kultūra', ru: 'культура', uk: 'культура' },
  { lv: 'dziesma', ru: 'песня', uk: 'пісня' },
  { lv: 'grāmata', ru: 'книга', uk: 'книга' },
  { lv: 'tauta', ru: 'народ', uk: 'народ' },
  { lv: 'mājas', ru: 'дом', uk: 'дім' },
  { lv: 'sirds', ru: 'сердце', uk: 'серце' },
  { lv: 'zeme', ru: 'земля', uk: 'земля' },
  { lv: 'saule', ru: 'солнце', uk: 'сонце' },
  { lv: 'jūra', ru: 'море', uk: 'море' },
  { lv: 'Rīga', ru: 'Рига', uk: 'Рига' },
  { lv: 'Daugava', ru: 'Даугава', uk: 'Даугава' },
  { lv: 'kokle', ru: 'кокле (струнный инструмент)', uk: 'кокле (струнний інструмент)' },
  { lv: 'vainags', ru: 'венок', uk: 'вінок' },
  { lv: 'Jāņi', ru: 'Янов день', uk: 'Янів день' },
  { lv: 'Līgo', ru: 'Лиго', uk: 'Ліго' },
  { lv: 'rudzu maize', ru: 'ржаной хлеб', uk: 'житній хліб' },
  { lv: 'piparkūkas', ru: 'пряники', uk: 'пряники' },
  { lv: 'mežs', ru: 'лес', uk: 'ліс' },
  { lv: 'ezers', ru: 'озеро', uk: 'озеро' },
  { lv: 'dzeja', ru: 'поэзия', uk: 'поезія' },
  { lv: 'tradīcija', ru: 'традиция', uk: 'традиція' },
  { lv: 'latviešu valoda', ru: 'латышский язык', uk: 'латиська мова' },
];

/** Letters that only Latvian has, floating in the amber as ornaments. */
export const AMBER_LETTERS = ['ā', 'ē', 'ī', 'ū', 'č', 'š', 'ž', 'ģ', 'ķ', 'ļ', 'ņ'];

/** Lines the song-festival bonfire spells out of its sparks. */
export const FIRE_LINES: Bilingual[] = [
  { lv: 'Dziesma vieno tautu', ru: 'Песня объединяет народ', uk: 'Пісня єднає народ' },
  { lv: 'Ugunskurs deg, dziesma skan', ru: 'Костёр горит, песня звучит', uk: 'Вогнище горить, пісня лунає' },
  { lv: 'Vārds ir tilts starp cilvēkiem', ru: 'Слово — мост между людьми', uk: 'Слово — міст між людьми' },
  { lv: 'Valoda ir mājas', ru: 'Язык — это дом', uk: 'Мова — це дім' },
  { lv: 'Latvija dzied', ru: 'Латвия поёт', uk: 'Латвія співає' },
];

export const pick = (text: Bilingual, uk: boolean) => (uk ? text.uk : text.ru);
