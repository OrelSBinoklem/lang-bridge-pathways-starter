import tour from '../../../../resources/tour/words-tour.json';
import type { TourDefinition } from './tourRunner';
import type { TourLang, TourStep } from './homeTourSteps';

const lines = new Map(tour.lines.map(line => [line.key, line]));
const first = (selector: string) => () => Array.from(document.querySelectorAll<HTMLElement>(selector))
  .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).slice(0, 1);
const part = (name: string) => first(`[data-word-tour="${name}"]`);

// Only observation: never click training, scoring, reset or preference controls.
export const WORDS_TOUR: TourStep[] = [
  { key: 'intro', action: 'wave', emotion: 'happy' },
  { key: 'category', targets: part('category') },
  { key: 'row', targets: part('row') },
  { key: 'progress', targets: part('progress') },
  { key: 'hint', targets: part('hint') },
  { key: 'start', targets: part('start') },
  { key: 'subgroup', targets: part('subgroup') },
  { key: 'dense', targets: part('dense') },
  { key: 'more', targets: part('more') },
  { key: 'help', targets: part('help') },
  { key: 'answer', menu: true, targets: first('[data-tour="menu-answer"]') },
  { key: 'cooldown', menu: true, targets: first('[data-tour="menu-cooldown"]') },
  { key: 'outro', action: 'hop', emotion: 'delight' },
];
export const WORDS_TOUR_RELEASE = `${tour.release}-fenrir`;
export const WORDS_TOUR_COOKIE = 'lbp_words_tour';
export const wordsTourText = (key: string, lang: TourLang) => lines.get(key)?.[lang] ?? '';
export const wordsTourDefinition: TourDefinition = {
  steps: WORDS_TOUR, text: wordsTourText, cookie: WORDS_TOUR_COOKIE,
  replayTarget: '[data-word-tour="replay"]',
};
