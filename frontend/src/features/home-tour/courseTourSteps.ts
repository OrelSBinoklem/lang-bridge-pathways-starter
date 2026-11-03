import tour from '../../../../resources/tour/course-tour.json';
import type { TourDefinition } from './tourRunner';
import type { TourLang, TourStep } from './homeTourSteps';

const lines = new Map(tour.lines.map(line => [line.key, line]));
export const courseTourText = (key: string, lang: TourLang) => lines.get(key)?.[lang] ?? '';
export const COURSE_TOUR_RELEASE = `${tour.release}-fenrir`;
export const COURSE_TOUR_COOKIE = 'lbp_course_tour';

const visible = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};
const all = (selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(visible);
const marker = (name: string) => `[data-course-tour="${name}"]`;

// Observation only: never click controls, change preferences or navigate to a lesson.
export function createCourseTourDefinition(learnLanguage: 'lv' | 'en'): TourDefinition {
  let group: HTMLElement | undefined;
  const root = () => all(marker('path'))[0];
  const part = (name: string) => () => {
    const path = root();
    return path ? all(marker(name), path).slice(0, 1) : [];
  };
  const pickGroup = () => {
    const path = root();
    if (!path) return undefined;
    if (group?.isConnected && path.contains(group) && visible(group)) return group;
    const groups = all(marker('group'), path);
    group = groups.find(item => item.closest('[data-active-group="true"]'))
      ?? groups.find(item => {
        const rect = item.getBoundingClientRect();
        return rect.top >= 90 && rect.top < innerHeight && rect.left >= 0 && rect.left < innerWidth;
      }) ?? groups[0];
    return group;
  };
  const groupTarget = () => { const selected = pickGroup(); return selected ? [selected] : []; };
  const skill = (name: string) => () => {
    const selector = `${marker(name)}:not(:disabled):not([aria-disabled="true"])`;
    const selected = pickGroup();
    const local = selected ? all(selector, selected) : [];
    // A group may contain only words, or only grammar. Point at an existing control
    // elsewhere in this level without selecting that group or manufacturing content.
    const path = root();
    return (local.length ? local : path ? all(selector, path) : []).slice(0, 1);
  };
  const inMenu = () => window.matchMedia('(max-width: 800px)').matches;
  const navigationPart = (name: string) => () => all(
    `[data-course-continue-placement="${inMenu() ? 'menu' : 'header'}"] ${marker(name)}`,
  ).slice(0, 1);
  const navigationStep = (key: string): TourStep => ({
    key,
    // Evaluated by the runner at every step, including after a viewport resize.
    get menu() { return inMenu(); },
    targets: navigationPart(key),
  });
  const steps: TourStep[] = [
    { key: 'levels', targets: part('levels'), action: 'wave', emotion: 'happy' },
    { key: 'groups', targets: groupTarget },
    { key: 'words', targets: skill('words') },
    { key: 'grammar', targets: skill('grammar') },
    learnLanguage === 'en' ? { key: 'english', targets: groupTarget } : { key: 'practice', targets: skill('practice') },
    { key: 'ranks', targets: () => {
      const path = root();
      return path ? all(`${marker('level')}[aria-pressed="true"]`, path).slice(0, 1) : [];
    } },
    navigationStep('target'),
    navigationStep('continue'),
    { key: 'group-percent', targets: groupTarget },
    ...(learnLanguage === 'en' ? [] : [{ key: 'practice-average', targets: skill('practice') }]),
    { key: 'debt', targets: groupTarget },
    { key: 'manual', targets: groupTarget, emotion: 'happy' },
  ];
  return {
    steps, text: courseTourText, cookie: COURSE_TOUR_COOKIE,
    replayTarget: '[data-course-tour="replay"]', keepOnScreen: true,
    cleanup: () => { group = undefined; },
  };
}
