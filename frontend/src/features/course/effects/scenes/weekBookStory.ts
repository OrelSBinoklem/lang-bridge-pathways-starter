/**
 * The week book's story (owner, 2026-10-30: «нормальную историю раскрывающихся панорам и фигур в книге»; «комбинируй»):
 * one heroine, Anna, new in Riga and learning Latvian, through seven days — each day a place (as before), a short
 * story told on the left page, a Latvian phrase she says (with its translation), what she does there, and the
 * panorama of Riga behind it. Data only; weekBook.ts draws and plays it.
 */
export type WeekBookAction = 'wave' | 'run' | 'read' | 'buy' | 'cheers' | 'look' | 'rest';
export type WeekBookPanorama = 'oldtown' | 'stadium' | 'lightcastle' | 'hangars' | 'nightgables' | 'jugend' | 'parkcanal';

export const WEEK_BOOK_STORY: readonly {
  ru: string; uk: string; phrase: string; phraseRu: string; phraseUk: string;
  action: WeekBookAction; dest: [number, number]; face: number;
  panorama: WeekBookPanorama; sky: [string, string]; night?: boolean;
}[] = [
  {
    ru: 'Понедельник. Анна только переехала в Ригу. Первый день в новом офисе: коллеги встречают её у стола, и она решается заговорить по-латышски.',
    uk: 'Понеділок. Анна щойно переїхала до Риги. Перший день у новому офісі: колеги зустрічають її біля столу, і вона наважується заговорити латиською.',
    phrase: 'Labrīt! Prieks iepazīties!', phraseRu: 'Доброе утро! Приятно познакомиться!', phraseUk: 'Добрий ранок! Приємно познайомитися!',
    action: 'wave', dest: [2.3, .8], face: 0, panorama: 'oldtown', sky: ['#9fc9e8', '#e9f2f4'],
  },
  {
    ru: 'Вторник. После работы — спортзал. Тренер считает круги по-латышски, и Анна бежит, повторяя числа: viens, divi, trīs…',
    uk: 'Вівторок. Після роботи — спортзал. Тренер рахує кола латиською, і Анна біжить, повторюючи числа: viens, divi, trīs…',
    phrase: 'Vēl viens aplis!', phraseRu: 'Ещё один круг!', phraseUk: 'Ще одне коло!',
    action: 'run', dest: [2.8, .95], face: 0, panorama: 'stadium', sky: ['#e9845a', '#f6cf8e'],
  },
  {
    ru: 'Среда. Национальная библиотека — «Замок света» над Даугавой. Анна берёт свою первую книгу на латышском.',
    uk: 'Середа. Національна бібліотека — «Замок світла» над Даугавою. Анна бере свою першу книжку латиською.',
    phrase: 'Vai drīkstu paņemt šo grāmatu?', phraseRu: 'Можно взять эту книгу?', phraseUk: 'Чи можна взяти цю книжку?',
    action: 'read', dest: [2.05, 1.25], face: .9, panorama: 'lightcastle', sky: ['#a7c4e4', '#f1e5cf'],
  },
  {
    ru: 'Четверг. Центральный рынок в бывших ангарах для цеппелинов. Анна торгуется за яблоки — и продавщица улыбается.',
    uk: 'Четвер. Центральний ринок у колишніх ангарах для цепелінів. Анна торгується за яблука — і продавчиня усміхається.',
    phrase: 'Cik maksā ābolu kilograms?', phraseRu: 'Сколько стоит килограмм яблок?', phraseUk: 'Скільки коштує кілограм яблук?',
    action: 'buy', dest: [2.6, .95], face: Math.PI, panorama: 'hangars', sky: ['#bcd8ec', '#f4efe0'],
  },
  {
    ru: 'Пятница. Вечер в кафе в Старой Риге. Новые друзья, огни в окнах, первый тост на латышском.',
    uk: 'П’ятниця. Вечір у кафе в Старій Ризі. Нові друзі, вогні у вікнах, перший тост латиською.',
    phrase: 'Priekā! Par jauno nedēļu!', phraseRu: 'Будем! За новую неделю!', phraseUk: 'Будьмо! За новий тиждень!',
    action: 'cheers', dest: [2.1, 1.55], face: .6, panorama: 'nightgables', sky: ['#14203f', '#3a3a6a'], night: true,
  },
  {
    ru: 'Суббота. Улица Альберта и музей югендстиля: каменные лица на фасадах. Анна читает подписи сама, без словаря.',
    uk: 'Субота. Вулиця Альберта і музей югендстилю: кам’яні обличчя на фасадах. Анна читає підписи сама, без словника.',
    phrase: 'Cik skaisti!', phraseRu: 'Как красиво!', phraseUk: 'Як гарно!',
    action: 'look', dest: [2.6, .55], face: Math.PI, panorama: 'jugend', sky: ['#9cc6e6', '#f2ecdc'],
  },
  {
    ru: 'Воскресенье. Пикник в парке у канала, рядом памятник Свободы. Неделя позади — и сколько новых слов!',
    uk: 'Неділя. Пікнік у парку біля каналу, поруч пам’ятник Свободи. Тиждень позаду — і скільки нових слів!',
    phrase: 'Laiks atpūsties.', phraseRu: 'Время отдохнуть.', phraseUk: 'Час відпочити.',
    action: 'rest', dest: [2.65, 1.05], face: 0, panorama: 'parkcanal', sky: ['#f0b56e', '#f8e3b0'],
  },
];

/** Where Anna starts each day: the front left corner of the page (sheet coordinates). */
export const WEEK_BOOK_START: [number, number] = [.7, 2.65];

/** Her walk as a cubic Bézier from the start to the day's place, s in 0…1; also used for the dotted route printed on the page. */
export function weekBookPath(day: number, s: number): [number, number] {
  const [sx, sz] = WEEK_BOOK_START, [dx, dz] = WEEK_BOOK_STORY[day].dest;
  const c1: [number, number] = [sx + 1.7, sz - .1], c2: [number, number] = [dx - .9, dz + 1.3];
  const u = 1 - s;
  return [
    u * u * u * sx + 3 * u * u * s * c1[0] + 3 * u * s * s * c2[0] + s * s * s * dx,
    u * u * u * sz + 3 * u * u * s * c1[1] + 3 * u * s * s * c2[1] + s * s * s * dz,
  ];
}
