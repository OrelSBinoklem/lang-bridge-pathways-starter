'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { clientApi } from '@/lib/client-api';
import { HOME_TOUR, TOUR_RELEASE, type TourLang } from './homeTourSteps';
import { HomeTourRunner, TOUR_LAYER, tourInviteDue, type TourState } from './tourRunner';
import styles from './home-tour.module.css';
import { setCharacterTour } from '@/features/tutor-characters/characterRuntime';

/**
 * Home page tour by the guide cat. For signed-in users the cat asks by itself on every page load until the tour has
 * been watched, at most three times (cookie `lbp_home_tour`); the answer buttons are in its speech bubble, and the
 * click also unlocks sound. Also from `/?tour=1`, or from «Пройти тур заново» in the main menu (event
 * `lbp.tour.start`).
 */
/** Recorded Flash-Lite voice (folder /audio/tour/<release>-<voice>/); null keeps the browser voice. */
const VOICE: string | null = 'fenrir';
const UI = {
  ru: { invite: 'Привет! Я кот Рикс. Показать, что где на сайте?', start: 'Показать сайт', later: 'Не сейчас', close: 'Закрыть тур', back: 'Назад', next: 'Дальше', pause: 'Пауза', play: 'Продолжить', mute: 'Без звука', sound: 'Со звуком', bar: 'Тур по сайту' },
  uk: { invite: 'Привіт! Я кіт Рікс. Показати, що де на сайті?', start: 'Показати сайт', later: 'Не зараз', close: 'Закрити тур', back: 'Назад', next: 'Далі', pause: 'Пауза', play: 'Продовжити', mute: 'Без звуку', sound: 'Зі звуком', bar: 'Тур сайтом' },
};

export function HomeTour() {
  const lang: TourLang = useLocale() === 'uk' ? 'uk' : 'ru';
  const ui = UI[lang];
  const [state, setState] = useState<TourState>({ phase: 'off', index: 0, paused: false, muted: false });
  const [runner] = useState(() => new HomeTourRunner(lang, VOICE ? `${TOUR_RELEASE}-${VOICE}` : null, { text: ui.invite, start: ui.start, later: ui.later }, setState));
  useEffect(() => { setCharacterTour(state.phase !== 'off', runner); return () => setCharacterTour(false, runner); }, [state.phase, runner]);

  useEffect(() => {
    let cancelled = false;
    const onStart = () => { runner.dispose(); void runner.begin(); };
    window.addEventListener('lbp.tour.start', onStart);
    const url = new URL(location.href);
    let timer = 0;
    if (url.searchParams.get('tour') === '1') {
      timer = window.setTimeout(() => {
        url.searchParams.delete('tour'); history.replaceState(history.state, '', url);
        void runner.invite();
      }, 0);
    } else if (tourInviteDue()) {
      clientApi<{ user: unknown }>('/user').then(r => { if (!cancelled && r.user && tourInviteDue()) void runner.invite(true); }).catch(() => {});
    }
    return () => { cancelled = true; window.removeEventListener('lbp.tour.start', onStart); clearTimeout(timer); runner.dispose(); };
  }, [runner]);

  useEffect(() => { runner.setLanguage(lang, { text: ui.invite, start: ui.start, later: ui.later }); }, [runner, lang, ui.invite, ui.start, ui.later]);

  useEffect(() => {
    if (state.phase === 'off') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void runner.close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runner, state.phase]);

  // While inviting, the answer buttons are in the cat's bubble.
  if (state.phase === 'off' || state.phase === 'invite') return null;
  return <div className={styles.bar} style={{ zIndex: TOUR_LAYER + 5 }} role="toolbar" aria-label={ui.bar} data-keep-menu="">
    {state.phase === 'running' && <>
      <button type="button" className={styles.icon} aria-label={ui.close} title={ui.close} onClick={() => void runner.close()}><i className="pi pi-times" /></button>
      <button type="button" className={styles.icon} aria-label={ui.back} title={ui.back} disabled={state.index === 0} onClick={() => runner.back()}><i className="pi pi-chevron-left" /></button>
      <button type="button" className={styles.icon} aria-label={state.paused ? ui.play : ui.pause} title={state.paused ? ui.play : ui.pause} onClick={() => runner.togglePause()}><i className={`pi ${state.paused ? 'pi-play' : 'pi-pause'}`} /></button>
      <span className={styles.count}>{state.index + 1} / {HOME_TOUR.length}</span>
      <button type="button" className={styles.primary} onClick={() => runner.next()}>{ui.next} <i className="pi pi-chevron-right" /></button>
      <button type="button" className={styles.icon} aria-label={state.muted ? ui.sound : ui.mute} title={state.muted ? ui.sound : ui.mute} onClick={() => runner.setMuted(!state.muted)}><i className={`pi ${state.muted ? 'pi-volume-off' : 'pi-volume-up'}`} /></button>
    </>}
    {state.phase === 'closing' && <button type="button" onClick={() => runner.dispose()}>OK</button>}
  </div>;
}
