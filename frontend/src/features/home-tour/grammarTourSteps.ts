import tour from '../../../../resources/tour/grammar-tour.json';
import { showGrammarCharacter } from '@/features/tutor-characters/characterRuntime';
import { TOUR_LAYER, type TourDefinition } from './tourRunner';
import type { TourLang, TourStep } from './homeTourSteps';

const lines = new Map(tour.lines.map(line => [line.key, line]));
export const grammarTourText = (key: string, lang: TourLang) => lines.get(key)?.[lang] ?? '';
export const GRAMMAR_TOUR_RELEASE = `${tour.release}-fenrir`;
const all = (selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>(selector))
  .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });

export function createGrammarTourDefinition(): TourDefinition {
  let card: HTMLElement | undefined;
  let pointing = false;
  const cards = () => all('[data-grammar-tour="card"]');
  const pick = () => {
    if (card?.isConnected && card.getBoundingClientRect().width > 0) return card;
    const list = cards();
    card = list.find(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.left < innerWidth && r.bottom > 90 && r.top < innerHeight; }) ?? list[0];
    return card;
  };
  const part = (name: string) => () => all(`[data-grammar-tour="${name}"]`).slice(0, 1);
  const cardPart = (selector: string) => () => { const selected = pick(); return selected ? all(selector, selected).slice(0, 1) : []; };
  const preview = (open: boolean, synchronous = true) => window.dispatchEvent(new CustomEvent('grammar.tour.preview', { detail: { open, synchronous, tableId: pick()?.dataset.id } }));
  const resetPointers = () => {
    cards().forEach(el => el.removeAttribute('data-tour-show-practice'));
    if (pointing) window.dispatchEvent(new CustomEvent('tutor.character.clear'));
    pointing = false;
  };
  const steps: TourStep[] = [
    { key: 'intro', action: 'wave', emotion: 'happy' },
    { key: 'overview', targets: part('overview') },
    { key: 'table', targets: () => pick() ? [pick()!] : [] },
    { key: 'enlarge', targets: () => {
      const modal = all('[data-grammar-tour="enlarged"]')[0];
      return modal ? [modal.querySelector<HTMLElement>('table, img') ?? modal] : [];
    } },
    { key: 'hint', targets: cardPart('[data-grammar-tour="hint"]') },
    { key: 'exercises', targets: () => {
      const candidates = all('[data-grammar-tour="exercises"]');
      const selected = candidates.find(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.left < innerWidth; }) ?? candidates[0];
      if (selected) card = selected.closest<HTMLElement>('[data-grammar-tour="card"]') ?? card;
      return selected ? [selected] : [];
    } },
    { key: 'progress', targets: cardPart('[data-grammar-tour="progress"]') },
    { key: 'tutor', targets: () => all('button[aria-label="Open AI tutor"]').slice(0, 1) },
    { key: 'octopus', targets: cardPart('[data-grammar-table-key]') },
    { key: 'level', menu: true, targets: part('level') },
    { key: 'layout', menu: true, targets: () => all('[data-grammar-tour="columns"], [data-grammar-tour="layout"]') },
    { key: 'outro', action: 'hop', emotion: 'delight' },
  ];
  return {
    steps, text: grammarTourText, cookie: 'lbp_grammar_tour', replayTarget: '[data-grammar-tour="replay"]', keepOnScreen: true,
    beforeStep: (step, lang) => {
      resetPointers(); preview(step.key === 'enlarge');
      if (step.key === 'table' || step.key === 'octopus') {
        const key = pick()?.dataset.tableKey;
        if (key) window.dispatchEvent(new CustomEvent('grammar.table.reveal', { detail: { tableKey: key, preserveQuery: true } }));
      }
      if (step.key === 'progress') pick()?.setAttribute('data-tour-show-practice', '');
      if (step.key === 'octopus') {
        const root = pick()?.querySelector<HTMLElement>('[data-grammar-table-key]');
        if (root) {
          const cells = all('th, td', root).slice(0, 3);
          showGrammarCharacter({ targets: cells.length ? cells : [root], label: lang === 'uk' ? 'Приклад вказівників у таблиці' : 'Пример указателей по таблице', durationMs: 15000, layer: TOUR_LAYER + 2 });
          pointing = true;
        }
      }
    },
    cleanup: () => { resetPointers(); preview(false, false); card = undefined; },
  };
}
