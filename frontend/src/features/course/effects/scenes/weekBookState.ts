export const WEEK_BOOK_DAYS = [
  { lv: 'Pirmdiena', ru: 'Понедельник', uk: 'Понеділок', shortRu: 'Пн', shortUk: 'Пн', place: 'Birojs', activity: 'Работа в офисе', activityUk: 'Робота в офісі', time: '09:00', color: '#6fa9af' },
  { lv: 'Otrdiena', ru: 'Вторник', uk: 'Вівторок', shortRu: 'Вт', shortUk: 'Вт', place: 'Sporta zāle', activity: 'Тренировка в спортзале', activityUk: 'Тренування у спортзалі', time: '18:30', color: '#cb8e68' },
  { lv: 'Trešdiena', ru: 'Среда', uk: 'Середа', shortRu: 'Ср', shortUk: 'Ср', place: 'Bibliotēka', activity: 'Чтение в библиотеке', activityUk: 'Читання у бібліотеці', time: '16:00', color: '#9b8fb7' },
  { lv: 'Ceturtdiena', ru: 'Четверг', uk: 'Четвер', shortRu: 'Чт', shortUk: 'Чт', place: 'Tirgus', activity: 'Покупки на рынке', activityUk: 'Покупки на ринку', time: '11:00', color: '#93ad73' },
  { lv: 'Piektdiena', ru: 'Пятница', uk: 'П’ятниця', shortRu: 'Пт', shortUk: 'Пт', place: 'Kafejnīca', activity: 'Встреча в кафе', activityUk: 'Зустріч у кафе', time: '19:00', color: '#c7807d' },
  { lv: 'Sestdiena', ru: 'Суббота', uk: 'Субота', shortRu: 'Сб', shortUk: 'Сб', place: 'Muzejs', activity: 'Прогулка по музею', activityUk: 'Прогулянка музеєм', time: '12:00', color: '#b9a06d' },
  { lv: 'Svētdiena', ru: 'Воскресенье', uk: 'Неділя', shortRu: 'Вс', shortUk: 'Нд', place: 'Parks', activity: 'Отдых в парке', activityUk: 'Відпочинок у парку', time: '14:00', color: '#6eab8f' },
] as const;

type Selection = { weekBookDay: number };
const listeners = new WeakMap<Selection, Set<() => void>>();
export function selectWeekBookDay(params: Selection, day: number) {
  if (!Number.isInteger(day) || day < 0 || day >= WEEK_BOOK_DAYS.length) return false;
  if (params.weekBookDay !== day) { params.weekBookDay = day; listeners.get(params)?.forEach(listener => listener()); }
  return true;
}
export function subscribeWeekBook(params: Selection, listener: () => void) {
  const list = listeners.get(params) ?? new Set(); list.add(listener); listeners.set(params,list);
  return () => { list.delete(listener); };
}

const ease = (a: number, b: number, t: number) => {
  const x = Math.max(0,Math.min(1,(t-a)/(b-a))); return x*x*(3-2*x);
};
/** Collapse props first, turn the correct sheet stack, then erect the incoming scene. */
export class WeekBookTurn {
  current: number;
  from: number;
  to: number;
  elapsed = Infinity;
  requested: number;
  constructor(day = 0) { this.current = this.from = this.to = this.requested = Math.max(0,Math.min(6,Math.round(day))); }
  get turning() { return this.elapsed < 1.65; }
  step(dt: number, requested: number, instant = false) {
    if (Number.isInteger(requested) && requested >= 0 && requested < 7) this.requested = requested;
    if (instant) { this.current = this.from = this.to = this.requested; this.elapsed = Infinity; return; }
    if (!this.turning && this.current !== this.requested) { this.from = this.current; this.to = this.requested; this.elapsed = 0; }
    if (this.turning) {
      this.elapsed += Math.max(0,Math.min(.1,dt));
      if (!this.turning) { this.current = this.to; this.elapsed = Infinity; }
    }
  }
  angle(sheet: number) {
    if (!this.turning) return sheet < this.current ? Math.PI : 0;
    const a = sheet < this.from ? Math.PI : 0, b = sheet < this.to ? Math.PI : 0;
    return a + (b-a)*ease(.24,1.08,this.elapsed);
  }
  height(sheet: number) {
    const at = (day: number) => .13 + (sheet < day ? sheet : 6-sheet)*.03;
    return this.turning ? at(this.from)+(at(this.to)-at(this.from))*ease(.24,1.08,this.elapsed) : at(this.current);
  }
  rise(day: number) {
    if (!this.turning) return day === this.current ? 1 : 0;
    if (day === this.from) return 1-ease(0,.23,this.elapsed);
    return day === this.to ? ease(1.09,1.65,this.elapsed) : 0;
  }
}
