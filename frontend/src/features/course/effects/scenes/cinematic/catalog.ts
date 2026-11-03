/** Lightweight metadata: the course config does not import the 3D renderer. */
export const CINEMATIC_CATALOG = [
  { categoryId: 1763, id: 'hello-orbit', ru: 'Воздушная почта', uk: 'Повітряна пошта', icon: '✉️', color: '#ffad6b', oldRu: 'Приветствия', oldUk: 'Привітання' },
  { categoryId: 1767, id: 'transit-globe', ru: 'Город в движении', uk: 'Місто в русі', icon: '🚎', color: '#5ee9ed', oldRu: 'Карта маршрутов', oldUk: 'Мапа маршрутів' },
  { categoryId: 1769, id: 'midnight-arcade', ru: 'Ночной торговый пассаж', uk: 'Нічний торговий пасаж', icon: '🛍️', color: '#ff6bad', oldRu: 'Неоновые вывески', oldUk: 'Неонові вивіски' },
  { categoryId: 1771, id: 'cloud-carnival', ru: 'Парк над облаками', uk: 'Парк над хмарами', icon: '🎡', color: '#ffca79', oldRu: 'Воздушные шары', oldUk: 'Повітряні кульки' },
  { categoryId: 1775, id: 'memory-mobile', ru: 'Дом с историями', uk: 'Дім з історіями', icon: '🏡', color: '#ffd7a6', oldRu: 'Гирлянда фотографий', oldUk: 'Гірлянда фотографій' },
  { categoryId: 1776, id: 'prism-personas', ru: 'Театр характеров', uk: 'Театр характерів', icon: '🎭', color: '#bfa0ff', oldRu: 'Созвездия характеров', oldUk: 'Сузір’я характерів' },
  { categoryId: 1777, id: 'sky-islands', ru: 'Город парящих островов', uk: 'Місто летючих островів', icon: '🏝️', color: '#63ead3', oldRu: 'Голографический остров', oldUk: 'Голографічний острів' },
  { categoryId: 1779, id: 'astral-planner', ru: 'Мастерская планов', uk: 'Майстерня планів', icon: '⚙️', color: '#edc383', oldRu: 'Планировщик', oldUk: 'Планувальник' },
  { categoryId: 1784, id: 'knowledge-launch', ru: 'Космодром знаний', uk: 'Космодром знань', icon: '🚀', color: '#78b7ff', oldRu: 'Восхождение A1–C2', oldUk: 'Сходження A1–C2' },
  { categoryId: 1786, id: 'time-reborn', ru: 'Вторая весна', uk: 'Друга весна', icon: '🌸', color: '#ffb852', oldRu: 'Часовой механизм', oldUk: 'Годинниковий механізм' },
  { categoryId: 1787, id: 'light-circle', ru: 'Джазовый дворик', uk: 'Джазове подвір’я', icon: '🎷', color: '#ffa468', oldRu: 'Светлячки', oldUk: 'Світлячки' },
  { categoryId: 1788, id: 'rain-metropolis', ru: 'Город после полуночи', uk: 'Місто після опівночі', icon: '🌃', color: '#5edcff', oldRu: 'Городок', oldUk: 'Містечко' },
  { categoryId: 1793, id: 'stellar-foundry', ru: 'Мастерская дракона', uk: 'Майстерня дракона', icon: '⚒️', color: '#ff8a42', oldRu: 'Кузница', oldUk: 'Кузня' },
] as const;

/** Additional looks, never replacements for the group's current default. */
export const CINEMATIC_ALTERNATIVES = [
  { categoryId: 1769, id: 'neon-market', ru: 'Неоновый рынок · запечённый свет', uk: 'Неоновий ринок · запечене світло', icon: '💡', color: '#ff71b6' },
  { categoryId: 1763, id: 'certificate-bureau', ru: 'Бюро присутствия', uk: 'Бюро присутності', icon: '📜', color: '#d9b77b' },
  { categoryId: 1767, id: 'pizza-express', ru: 'Пицца: роботы, лифт и дрон', uk: 'Піца: роботи, ліфт і дрон', icon: '🍕', color: '#ffc677' },
  { categoryId: 1767, id: 'transit-machine', ru: 'Пересадочная машина', uk: 'Пересадкова машина', icon: '🚉', color: '#58d9c8' },
  { categoryId: 1776, id: 'polite-mask', ru: 'Снаружи всё прекрасно', uk: 'Зовні все чудово', icon: '🎭', color: '#efb8ab' },
  { categoryId: 1776, id: 'face-atelier', ru: 'Конструктор лица', uk: 'Конструктор обличчя', icon: '🦴', color: '#d2c4b0' },
  { categoryId: 1779, id: 'time-switchyard', ru: 'Сортировочная времени', uk: 'Сортувальна часу', icon: '🚦', color: '#90d9bf' },
  { categoryId: 1775, id: 'family-supper', ru: 'Один стол — много историй', uk: 'Один стіл — багато історій', icon: '🥂', color: '#efba7b' },
  { categoryId: 1786, id: 'second-chance', ru: 'Второй шанс · золотые швы', uk: 'Другий шанс · золоті шви', icon: '🏺', color: '#efc37b' },
  { categoryId: 1776, id: 'prism-personas-faceted', ru: 'Грани характера', uk: 'Грані характеру', icon: '💎', color: '#bfa0ff' },
] as const;

/** New transport choices replace that category's retired course list, not other categories. */
export const CINEMATIC_TRAVEL = [
  { categoryId: 1767, id: 'platskart-journey', ru: 'Плацкарт · чай и дорога', uk: 'Плацкарт · чай і дорога', icon: '🚆', color: '#d0b283' },
] as const;

/** Test-gallery snapshots, deliberately not added to course variant switches. */
export const CINEMATIC_ARCHIVES = [
  { id: 'cloud-carnival-original', ru: 'Парк над облаками — исходный парк', color: '#ffca79' },
  { id: 'cloud-carnival-party-v1', ru: 'Парк над облаками — шары и колонки · v1', color: '#ffca79' },
] as const;

/** Everyday reasons to learn: metadata only; each scene loads its own photo on activation. */
export const LIFELONG_CATALOG = [
  { id: 'late-postcards', ru: 'Открытки от внуков', uk: 'Листівки від онуків', icon: '💌', color: '#d4aa72', plate: 'postcards' },
  { id: 'late-choir', ru: 'Первая репетиция', uk: 'Перша репетиція', icon: '🎼', color: '#d8b888', plate: 'choir' },
  { id: 'late-workshop', ru: 'Новая профессия', uk: 'Нова професія', icon: '🪚', color: '#b9956c', plate: 'new-profession' },
  { id: 'late-neighbours', ru: 'Чай с соседом', uk: 'Чай із сусідом', icon: '🫖', color: '#c59b70', plate: 'neighbour-tea' },
] as const;

export type CinematicId = typeof CINEMATIC_CATALOG[number]['id'] | typeof CINEMATIC_ALTERNATIVES[number]['id'] | typeof CINEMATIC_ARCHIVES[number]['id'] | typeof CINEMATIC_TRAVEL[number]['id'];
export const isCinematicScene = (id?: string) => [...CINEMATIC_CATALOG, ...CINEMATIC_ALTERNATIVES, ...CINEMATIC_ARCHIVES, ...CINEMATIC_TRAVEL].some(scene => scene.id === id);
