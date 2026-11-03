export type LifeStory = 'postcards' | 'choir' | 'workshop' | 'neighbours';

type LocalCopy = { eyebrow: string; caption: readonly string[]; footer: string };
type StoryCopy = {
  title: readonly string[]; lines: readonly string[]; signature: string; ru: LocalCopy; uk: LocalCopy;
};

/** Decorative fictional letters, not course tasks or interactive simulations. */
export const STORY_COPY: Record<LifeStory, StoryCopy> = {
  postcards: {
    title: ['Vecmāmiņ, nāc ciemos!'],
    lines: ['Piektdien mūsu skolā', 'būs koncerts. Es dziedāšu!', 'Sākums plkst. 18.00.', 'Es tevi ļoti gaidīšu.'],
    signature: 'Tava Anna',
    ru: { eyebrow: 'ОТКРЫТКА ОТ ВНУЧКИ', caption: ['Понимать внуков.', 'Отвечать своими словами.'], footer: 'Для близких слов никогда не поздно.' },
    uk: { eyebrow: 'ЛИСТІВКА ВІД ОНУКИ', caption: ['Розуміти онуків.', 'Відповідати своїми словами.'], footer: 'Для близьких слів ніколи не пізно.' },
  },
  choir: {
    title: ['Nāc dziedāt kopā!'],
    lines: ['Mūsu korī gaidām arī tevi.', 'Pieredze nav nepieciešama.', 'Pirmdien plkst. 18.30', 'tiekamies kultūras namā.'],
    signature: 'Tava balss ir gaidīta.',
    ru: { eyebrow: 'ПРИГЛАШЕНИЕ В ХОР', caption: ['Не просто слушать.', 'Петь вместе.'], footer: 'Понимать слова. Чувствовать себя своим.' },
    uk: { eyebrow: 'ЗАПРОШЕННЯ ДО ХОРУ', caption: ['Не просто слухати.', 'Співати разом.'], footer: 'Розуміти слова. Почуватися своїм.' },
  },
  workshop: {
    title: ['Darba instrukcija'],
    lines: ['Izlasiet darba aprakstu.', 'Pārbaudiet izmērus.', 'Atzīmējiet detaļas.', 'Ja kas nav skaidrs, jautājiet.'],
    signature: 'Soli pa solim.',
    ru: { eyebrow: 'ИНСТРУКЦИЯ НА ЛАТЫШСКОМ', caption: ['Прочитать инструкцию.', 'Разобраться самому.'], footer: 'Латышский пригодится в обычных делах.' },
    uk: { eyebrow: 'ІНСТРУКЦІЯ ЛАТИСЬКОЮ', caption: ['Прочитати інструкцію.', 'Розібратися самостійно.'], footer: 'Латиська стане в пригоді у звичних справах.' },
  },
  neighbours: {
    title: ['Sveiks, kaimiņ!'],
    lines: ['Vai sestdien plkst. 17.00', 'atnāksi pie manis uz tēju?', 'Es izcepu ābolu kūku.', 'Būs prieks parunāties!'],
    signature: 'Anna, 12. dzīvoklis',
    ru: { eyebrow: 'ЗАПИСКА ОТ СОСЕДКИ', caption: ['От «labdien» —', 'к разговору за чаем.'], footer: 'Столько лет рядом. Пора познакомиться.' },
    uk: { eyebrow: 'ЗАПИСКА ВІД СУСІДКИ', caption: ['Від «labdien» —', 'до розмови за чаєм.'], footer: 'Стільки років поруч. Час познайомитися.' },
  },
};

export function storyLayout(width: number, height: number, body: boolean, contentVisible = false) {
  const side = body && contentVisible && width >= 1800;
  const available = side ? (width - 1240) / 2 : body ? Math.min(width * .86, 1050) : Math.min(width * .46, height * 1.1);
  const scale = Math.max(.05, Math.min(available / 550, height * (body ? .74 : .88) / 760));
  return { x: side ? width - available / 2 : body ? width * .58 : width - available / 2 - 12, y: height * .5, scale, side };
}

export function storyPhotoWidth(width: number, body: boolean, dpr: number) {
  if (!body) return 768;
  const physicalWidth = Math.round(width * Math.min(2, Math.max(1, dpr)));
  if (physicalWidth <= 768) return 768;
  // The owner chose original pictures through Full HD, even on high-DPI screens.
  if (width <= 1920) return 1536;
  return physicalWidth <= 2560 ? 2560 : 3840;
}

export function storyPhotoSource(plate: string, width: number, body: boolean, dpr: number) {
  const size = storyPhotoWidth(width, body, dpr);
  return size <= 1536
    ? `/course/effects/lifelong/${plate}-${size}.webp`
    : `/course/effects/lifelong/${plate}-sdxl-${size}.jpg`;
}
