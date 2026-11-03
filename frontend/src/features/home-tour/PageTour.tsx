'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import { getCharacterTour, setCharacterTour } from '@/features/tutor-characters/characterRuntime';
import { HomeTourRunner, TOUR_LAYER, tourInviteDue, type TourState, type TourDefinition } from './tourRunner';
import type { TourLang } from './homeTourSteps';
import styles from './home-tour.module.css';

const UI = {
  ru: { title: 'Тур по странице слов', invite: 'Показать, как учить слова на этой странице?', start: 'Покажи', later: 'Не сейчас', close: 'Закрыть тур', back: 'Назад', next: 'Дальше', pause: 'Пауза', play: 'Продолжить', mute: 'Без звука', sound: 'Со звуком' },
  uk: { title: 'Тур сторінкою слів', invite: 'Показати, як вчити слова на цій сторінці?', start: 'Покажи', later: 'Не зараз', close: 'Закрити тур', back: 'Назад', next: 'Далі', pause: 'Пауза', play: 'Продовжити', mute: 'Без звуку', sound: 'Зі звуком' },
};

type TourCopy = Record<TourLang, { title: string; invite: string }>;
export function PageTour({ isAuthenticated, definition, release, eventName, entryId, copy, autoInvite = true, onActiveChange, onBeforeStart, compact = false, disabled = false }: {
  isAuthenticated: boolean; definition: TourDefinition; release: string; eventName: string;
  entryId: 'words' | 'grammar' | 'course' | 'chat' | 'exams'; copy: TourCopy;
  autoInvite?: boolean; onActiveChange?: (active: boolean) => void; onBeforeStart?: () => void; compact?: boolean; disabled?: boolean;
}) {
  const lang: TourLang = useLocale() === 'uk' ? 'uk' : 'ru';
  const ui = { ...UI[lang], ...copy[lang] };
  const [state, setState] = useState<TourState>({ phase: 'off', index: 0, paused: false, muted: false });
  const [error, setError] = useState(false);
  const beforeStart = useRef(onBeforeStart);
  useEffect(() => { beforeStart.current = onBeforeStart; }, [onBeforeStart]);
  const [runner] = useState(() => new HomeTourRunner(lang, release,
    { text: ui.invite, start: ui.start, later: ui.later }, setState, definition));

  const start = () => {
    if (disabled) return;
    beforeStart.current?.();
    setError(false);
    if (state.phase === 'off') void runner.invite().catch(reason => {
      console.error(`[page-tour:${entryId}] Cannot start guide`, reason); runner.dispose(); setError(true);
    });
  };

  useEffect(() => { setCharacterTour(state.phase !== 'off', runner); return () => setCharacterTour(false, runner); }, [state.phase, runner]);
  useEffect(() => { onActiveChange?.(state.phase !== 'off'); return () => onActiveChange?.(false); }, [state.phase, onActiveChange]);
  useEffect(() => {
    const onStart = () => {
      if (disabled) return;
      beforeStart.current?.();
      runner.dispose();
      void runner.invite().catch(reason => { console.error(`[page-tour:${entryId}]`, reason); runner.dispose(); setError(true); });
    };
    window.addEventListener(eventName, onStart);
    const url = new URL(location.href);
    let timer = 0;
    if (entryId !== 'chat' && url.searchParams.get('tour') === '1') {
      // Consume only when the scheduled start survives effect cleanup (including Strict Mode).
      timer = window.setTimeout(() => {
        url.searchParams.delete('tour'); history.replaceState(history.state, '', url);
        onStart();
      }, 0);
    }
    return () => { clearTimeout(timer); window.removeEventListener(eventName, onStart); runner.dispose(); };
  }, [runner, eventName, entryId, disabled]);
  useEffect(() => {
    if (!autoInvite || !isAuthenticated || !tourInviteDue(definition.cookie)) return;
    const timer = window.setTimeout(() => {
      if (!getCharacterTour() && tourInviteDue(definition.cookie)) void runner.invite(true).catch(reason => {
        console.error(`[page-tour:${entryId}]`, reason); runner.dispose(); setError(true);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [runner, isAuthenticated, definition.cookie, entryId, autoInvite]);
  useEffect(() => { runner.setLanguage(lang, { text: ui.invite, start: ui.start, later: ui.later }); }, [runner, lang, ui.invite, ui.start, ui.later]);
  useEffect(() => {
    if (state.phase === 'off') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void runner.close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runner, state.phase]);

  return <>
    <button type="button" className={`${styles.entry} ${compact ? styles.entryCompact : ''}`} aria-label={ui.title} title={ui.title}
      data-word-tour={entryId === 'words' ? 'replay' : undefined} data-grammar-tour={entryId === 'grammar' ? 'replay' : undefined}
      data-course-tour={entryId === 'course' ? 'replay' : undefined} data-chat-tour={entryId === 'chat' ? 'replay' : undefined}
      data-exam-tour={entryId === 'exams' ? 'replay' : undefined} onClick={start} disabled={disabled || state.phase !== 'off'}>
      <i className="pi pi-compass" aria-hidden="true" /> {!compact && ui.title}
    </button>
    {error && <span role="alert">{lang === 'uk' ? 'Не вдалося запустити тур. Спробуй ще раз.' : 'Не удалось запустить тур. Попробуй ещё раз.'}</span>}
    {(state.phase === 'running' || state.phase === 'closing') && createPortal(<div className={styles.bar} style={{ zIndex: TOUR_LAYER + 5 }} role="toolbar" aria-label={ui.title} data-keep-menu="">
      {state.phase === 'running' ? <>
        <button type="button" className={styles.icon} aria-label={ui.close} title={ui.close} onClick={() => void runner.close()}><i className="pi pi-times" aria-hidden="true" /></button>
        <button type="button" className={styles.icon} aria-label={ui.back} title={ui.back} disabled={state.index === 0} onClick={() => runner.back()}><i className="pi pi-chevron-left" aria-hidden="true" /></button>
        <button type="button" className={styles.icon} aria-label={state.paused ? ui.play : ui.pause} title={state.paused ? ui.play : ui.pause} onClick={() => runner.togglePause()}><i className={`pi ${state.paused ? 'pi-play' : 'pi-pause'}`} aria-hidden="true" /></button>
        <span className={styles.count}>{state.index + 1} / {definition.steps.length}</span>
        <button type="button" className={styles.primary} onClick={() => runner.next()}>{ui.next} <i className="pi pi-chevron-right" aria-hidden="true" /></button>
        <button type="button" className={styles.icon} aria-label={state.muted ? ui.sound : ui.mute} title={state.muted ? ui.sound : ui.mute} onClick={() => runner.setMuted(!state.muted)}><i className={`pi ${state.muted ? 'pi-volume-off' : 'pi-volume-up'}`} aria-hidden="true" /></button>
      </> : <button type="button" onClick={() => runner.dispose()}>OK</button>}
    </div>, document.body)}
  </>;
}
