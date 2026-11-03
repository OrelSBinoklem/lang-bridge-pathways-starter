import tour from '../../../../resources/tour/chat-tour.json';
import type { TourDefinition } from './tourRunner';
import type { TourLang } from './homeTourSteps';

const lines = new Map(tour.lines.map(line => [line.key, line]));
export const CHAT_TOUR_RELEASE = `${tour.release}-fenrir`;
export const chatTourText = (key: string, lang: TourLang) => lines.get(key)?.[lang] ?? '';
const part = (key: string) => () => Array.from(document.querySelectorAll<HTMLElement>(`[data-chat-tour="${key}"]`))
  .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).slice(0, 1);

/** Observes existing controls only. Never submits a message, opens the mic or changes a preset. */
export const CHAT_TOUR: TourDefinition = {
  cookie: 'lbp_chat_tour', text: chatTourText, replayTarget: '[data-chat-tour="replay"]', keepOnScreen: true,
  steps: [
    { key: 'intro', action: 'wave', emotion: 'happy' },
    { key: 'messages', targets: part('messages') },
    { key: 'text', targets: part('composer') },
    { key: 'voice', targets: part('voice') },
    { key: 'complex', targets: part('complex') },
    { key: 'stop', targets: part('stop') },
    { key: 'presets', targets: part('presets') },
    { key: 'price', targets: part('presets') },
    { key: 'commands', targets: part('messages') },
    { key: 'memory', targets: part('memory') },
    { key: 'settings', targets: part('settings') },
    { key: 'credits', menu: true, targets: () => Array.from(document.querySelectorAll<HTMLElement>('[data-tour="menu-account"]')).slice(0, 1) },
    { key: 'outro', action: 'hop', emotion: 'delight' },
  ],
};
