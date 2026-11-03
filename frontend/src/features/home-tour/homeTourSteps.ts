/**
 * The home page tour: what the cat points at and says. Texts (RU/UK) live in resources/tour/home-tour.json, which
 * also feeds the voice generator (tools/tour/generate-tour-voice.mjs). Targets are found by links and data-tour
 * marks, so the same steps fit the Latvian and the English home; a step whose target is absent is skipped.
 */
import tour from '../../../../resources/tour/home-tour.json';
import type { ActionName, EmotionName } from '@/features/cat-mascot/catMascot';

export type TourLang = 'ru' | 'uk';
export type TourStep = { key: string; targets?: () => HTMLElement[]; menu?: boolean; action?: ActionName; emotion?: EmotionName };

export const TOUR_RELEASE = tour.release;
const LINES = new Map(tour.lines.map(line => [line.key, line]));
export const tourText = (key: string, lang: TourLang) => LINES.get(key)?.[lang] ?? '';

const visible = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const all = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(visible);
const withText = (selector: string, pattern: RegExp) => all(selector).filter(el => pattern.test(el.textContent ?? ''));
const menuPart = (name: string) => () => all(`[data-tour="${name}"]`);

export const HOME_TOUR: TourStep[] = [
  { key: 'intro', action: 'wave', emotion: 'happy' },
  { key: 'course', targets: () => all('main a[href*="/course"][href*="level="]') },
  { key: 'level', targets: () => all('main a[href*="/course"][href*="level="]').slice(0, 1) },
  { key: 'grammar', targets: () => all('main a[href="/grammar"], main a[href="/grammar/english"]') },
  { key: 'practice', targets: () => all('main a[href^="/grammar/practice"]') },
  { key: 'dictionaries', targets: () => all('main a[href^="/dictionaries/"]') },
  { key: 'exams', targets: () => all('main a[href^="/exams"]') },
  { key: 'intro-cards', targets: () => withText('main button', /Обзорн|Оглядов|Поняти|Понятт/) },
  { key: 'links', targets: () => all('[data-home-useful-links]') },
  { key: 'search', targets: () => all('header input').slice(0, 1) },
  // «Продолжить» sits in the header on wide screens and moves into the menu on phones (signed-in users only).
  { key: 'continue', targets: () => all('[data-course-continue-placement="header"]') },
  { key: 'target', targets: () => all('[data-course-continue-placement="header"] [data-course-target-toggle]') },
  { key: 'target-why', targets: () => all('[data-course-continue-placement="header"] [data-course-target-toggle]') },
  { key: 'tutor', targets: () => all('button[aria-label="Open AI tutor"]') },
  { key: 'menu', menu: true, targets: () => all('#primary-menu') },
  { key: 'menu-nav', menu: true, targets: menuPart('menu-nav') },
  { key: 'menu-continue', menu: true, targets: () => all('[data-course-continue-placement="menu"]') },
  // On phones the goal is a list right inside the menu block.
  { key: 'menu-target', menu: true, targets: () => all('[data-course-continue-placement="menu"] select') },
  { key: 'target-why', menu: true, targets: () => all('[data-course-continue-placement="menu"] select') },
  { key: 'menu-plans', menu: true, targets: menuPart('menu-plans') },
  { key: 'menu-account', menu: true, targets: menuPart('menu-account') },
  { key: 'menu-login', menu: true, targets: menuPart('menu-login') },
  { key: 'menu-answer', menu: true, targets: menuPart('menu-answer') },
  { key: 'menu-cooldown', menu: true, targets: menuPart('menu-cooldown') },
  { key: 'menu-font', menu: true, targets: menuPart('menu-font') },
  { key: 'menu-ui-lang', menu: true, targets: menuPart('menu-ui-lang') },
  { key: 'menu-learn-lang', menu: true, targets: menuPart('menu-learn-lang') },
  { key: 'menu-tour', menu: true, targets: menuPart('menu-tour'), emotion: 'happy' },
  { key: 'outro', action: 'hop', emotion: 'delight' },
];
