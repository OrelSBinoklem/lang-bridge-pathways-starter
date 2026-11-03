import tour from '../../../../resources/tour/exams-tour.json';
import type { TourLang, TourStep } from './homeTourSteps';
import type { TourDefinition } from './tourRunner';

const lines = new Map(tour.lines.map(line => [line.key, line]));
export const examsTourText = (key: string, lang: TourLang) => lines.get(key)?.[lang] ?? '';
export const EXAMS_TOUR_RELEASE = `${tour.release}-fenrir`;

export function createExamsTourDefinition(): TourDefinition {
  // Only catalog markers and the inert tour panel; never inspect an attempt or click an exam control.
  const part = (name: string) => () => Array.from(document.querySelectorAll<HTMLElement>(`[data-exam-tour="${name}"]`))
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).slice(0, 1);
  const steps: TourStep[] = [
    { key: 'intro', action: 'wave', emotion: 'happy' },
    { key: 'levels', targets: part('levels') },
    { key: 'skills', targets: part('demo-skills') },
    { key: 'timer', targets: part('demo-timer') },
    { key: 'autosave', targets: part('demo-autosave') },
    { key: 'listening', targets: part('demo-listening') },
    { key: 'speaking', targets: part('demo-speaking') },
    { key: 'writing', targets: part('demo-writing') },
    { key: 'finish', targets: part('demo-finish') },
    { key: 'results', targets: part('demo-results') },
    { key: 'history', targets: part('history') },
    { key: 'credits', targets: part('demo-credits'), action: 'hop', emotion: 'delight' },
  ];
  return {
    steps, text: examsTourText, cookie: 'lbp_exams_tour', replayTarget: '[data-exam-tour="replay"]', keepOnScreen: true,
  };
}
