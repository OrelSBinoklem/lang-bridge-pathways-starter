'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { clientApi } from '@/lib/client-api';
import { courseRankLabel, type CourseRank } from './course-level-progress';
import { CourseContinueHelp } from './CourseContinueHelp';
import { CourseContinueSuggestions, type CourseSuggestion as Suggestion } from './CourseContinueSuggestions';
import styles from './course-continue.module.css';

const targets: [number, CourseRank][] = [[60, 'bronze'], [80, 'silver'], [90, 'gold'], [100, 'diamond']];

export function CourseContinue({ userId, lang = 'lv', navigation = false, onNavigate }: {
  userId?: number; lang?: string; navigation?: boolean; onNavigate?: () => void;
}) {
  const uk = useLocale() === 'uk', router = useRouter(), qc = useQueryClient();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [notice, setNotice] = useState<Suggestion | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusPreview = useRef(false);
  const [menuSlot, setMenuSlot] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpCloseRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const helpId = useId();
  const helpTitleId = useId();
  const previewId = useId(), previewTitleId = useId();
  const keepPreview = useCallback(() => { if (previewTimer.current) clearTimeout(previewTimer.current); }, []);
  const closePreview = useCallback(() => { keepPreview(); focusPreview.current = false; setPreviewOpen(false); }, [keepPreview]);
  function leavePreview() { keepPreview(); previewTimer.current = setTimeout(() => setPreviewOpen(false), 180); }
  useEffect(() => () => { if (previewTimer.current) clearTimeout(previewTimer.current); }, []);
  useEffect(() => {
    if (previewOpen && previewPosition && focusPreview.current) {
      focusPreview.current = false;
      (previewRef.current?.querySelector<HTMLElement>('a') ?? previewRef.current?.querySelector<HTMLElement>('button'))?.focus();
    }
  }, [previewOpen, previewPosition]);
  useEffect(() => {
    if (!previewOpen) return;
    const position = () => {
      const rect = continueRef.current?.getBoundingClientRect(); if (!rect) return;
      const width = Math.min(440, window.innerWidth - 24), below = window.innerHeight - rect.bottom - 20;
      setPreviewPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        ...(below >= 180 ? { top: rect.bottom + 8, maxHeight: Math.min(500, below) }
          : { bottom: window.innerHeight - rect.top + 8, maxHeight: Math.max(100, rect.top - 20) }) });
    };
    position(); window.addEventListener('resize', position); window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [previewOpen]);
  useEffect(() => { if (helpOpen) helpCloseRef.current?.focus(); }, [helpOpen]);
  useEffect(() => {
    if (!navigation) return;
    const media = window.matchMedia('(max-width: 800px)');
    const update = () => setMenuSlot(media.matches ? document.getElementById('course-continue-menu-root') : null);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [navigation]);
  useEffect(() => {
    const close = () => { setSettingsOpen(false); setNotice(null); setError(''); };
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !previewRef.current?.contains(event.target as Node)) {
        closePreview();
        setHelpOpen(false);
        if (navigation && !menuSlot) close();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (rootRef.current?.contains(document.activeElement) || previewRef.current?.contains(document.activeElement) || previewOpen)) {
        if (previewOpen) { continueRef.current?.focus(); closePreview(); }
        else if (helpOpen) { setHelpOpen(false); helpButtonRef.current?.focus(); }
        else if (navigation && !menuSlot) {
          close();
          rootRef.current?.querySelector<HTMLButtonElement>('[data-course-target-toggle]')?.focus();
        }
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [navigation, menuSlot, helpOpen, previewOpen, closePreview]);
  const identity = useQuery({ queryKey: ['course-continue-identity'], enabled: userId === undefined,
    queryFn: () => clientApi<{ user: { id: number } }>('/user'), retry: false, staleTime: 0 });
  const id = userId ?? (!identity.isFetching && !identity.isError ? identity.data?.user.id : undefined);
  const query = useQuery({ queryKey: ['course-continue', id, lang], enabled: !!id,
    queryFn: ({ signal }) => clientApi<{ data: Suggestion }>(`/course/continue?learn_lang=${encodeURIComponent(lang)}`, { signal }),
    staleTime: 30000, retry: false, refetchOnWindowFocus: false });
  const target = query.data?.data.target ?? 80;
  const t = (ru: string, ua: string) => uk ? ua : ru;
  function openPreview() {
    keepPreview(); setHelpOpen(false); setSettingsOpen(false); setPreviewOpen(true);
    // Reuse recent results across rapid hover/focus transitions; clicks still always recheck.
    if (!query.isFetching && (!query.data || Date.now() - query.dataUpdatedAt > 10000)) void query.refetch();
  }
  function enterPreview() { keepPreview(); previewTimer.current = setTimeout(openPreview, 140); }

  async function changeTarget(value: number) {
    closePreview();
    setBusy(true); setError(''); setNotice(null);
    try {
      await clientApi('/me/course-target', { method: 'PATCH', body: JSON.stringify({ target: value }) });
      await qc.invalidateQueries({ queryKey: ['course-path'] });
      const result = await query.refetch();
      if (result.error) throw result.error;
    } catch {
      setError(t('Не удалось обновить цель. Повторите попытку.', 'Не вдалося оновити ціль. Спробуйте ще раз.'));
    } finally { setBusy(false); }
  }
  async function continueCourse() {
    closePreview();
    setHelpOpen(false);
    setBusy(true); setError(''); setNotice(null);
    try {
      // Always re-read on click: never advance an index or rely on a previous suggestion.
      const result = await query.refetch();
      if (result.error || !result.data) throw result.error ?? new Error('No course suggestion');
      const value = result.data.data;
      if (value.status === 'ready' && value.next) {
        router.push(value.next.href);
        const anchor = value.next.href.split('#')[1];
        if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
        setSettingsOpen(false);
        onNavigate?.();
      } else setNotice(value);
    } catch {
      setError(t('Не удалось проверить задания. Попробуйте ещё раз.', 'Не вдалося перевірити завдання. Спробуйте ще раз.'));
    } finally { setBusy(false); }
  }
  if (!id) return null;
  const inMenu = navigation && !!menuSlot;
  const inHeader = navigation && !inMenu;
  const panelOpen = !inHeader || settingsOpen || !!notice || !!error;
  const content = <div ref={rootRef} className={navigation ? `${styles.navigation} ${inMenu ? styles.menu : styles.header}` : styles.bar}
    data-course-continue data-course-continue-placement={inMenu ? 'menu' : inHeader ? 'header' : 'bar'}>
    <button type="button" ref={helpButtonRef} className={styles.helpToggle} data-course-help-toggle
      aria-label={t('Как работает продолжение курса', 'Як працює продовження курсу')}
      title={t('Как работает продолжение курса', 'Як працює продовження курсу')}
      aria-expanded={helpOpen} aria-controls={helpId} aria-haspopup="dialog"
      onClick={() => { closePreview(); setHelpOpen(!helpOpen); setSettingsOpen(false); setNotice(null); setError(''); }}>
      <i className="pi pi-question-circle" aria-hidden />
    </button>
    <span className={styles.continueAnchor} onMouseEnter={enterPreview} onMouseLeave={leavePreview}>
    <button type="button" ref={continueRef} data-course-tour="continue" className={styles.continue} disabled={busy || query.isLoading} onClick={continueCourse}
      aria-haspopup="dialog" aria-expanded={previewOpen} aria-controls={previewOpen ? previewId : undefined}
      onFocus={openPreview} onBlur={leavePreview}
      onKeyDown={event => { if (event.key === 'ArrowDown') {
        event.preventDefault();
        const first = previewRef.current?.querySelector<HTMLElement>('a') ?? previewRef.current?.querySelector<HTMLElement>('button');
        if (first) { keepPreview(); first.focus(); }
        else { focusPreview.current = true; openPreview(); }
      } }}>
      <i className={`pi ${busy ? 'pi-spin pi-spinner' : 'pi-play'}`} aria-hidden />{inHeader ? t('Продолжить', 'Продовжити') : t('Продолжить курс', 'Продовжити курс')}
    </button>
    </span>
    {inHeader && <button type="button" data-course-target-toggle data-course-tour="target" className={styles.targetToggle}
      aria-label={t('Цель курса', 'Ціль курсу')} aria-expanded={panelOpen} aria-controls={panelId}
      title={`${t('Цель курса', 'Ціль курсу')}: ${target}%${query.isError ? ` · ${t('Ошибка загрузки', 'Помилка завантаження')}` : ''}`}
      onClick={() => { closePreview(); setHelpOpen(false); setSettingsOpen(!panelOpen); setNotice(null); setError(''); }}>
      <i className={`pi ${query.isError ? 'pi-exclamation-triangle' : 'pi-chevron-down'}`} aria-hidden />
    </button>}
    {panelOpen && <div id={panelId} className={inHeader ? styles.popover : styles.details}>
    <label className={styles.target}>{t('Цель', 'Ціль')}
      <select data-course-tour="target" aria-label={t('Желаемый минимальный уровень', 'Бажаний мінімальний рівень')} value={target}
        disabled={busy || query.isLoading || query.isError} onChange={event => void changeTarget(Number(event.target.value))}>
        {targets.map(([score, rank]) => <option key={score} value={score}>{courseRankLabel(rank, uk)} · {score}%</option>)}
      </select>
    </label>
    {notice && <p className={styles.notice} role="status">{notice.status === 'rest'
      ? t('Пора отдохнуть! Сейчас задания на откате.', 'Час відпочити! Зараз завдання на паузі.')
      : t('Все доступные задания достигли выбранной цели.', 'Усі доступні завдання досягли вибраної цілі.')}
      {notice.next_available_at && <> {t('Следующий зачёт:', 'Наступний залік:')} <time dateTime={notice.next_available_at}>
        {new Date(notice.next_available_at).toLocaleString(uk ? 'uk-UA' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></>}
    </p>}
    {(error || query.isError) && <p className={styles.error} role="alert">{error || t('Рекомендация не загрузилась. Нажмите «Продолжить курс», чтобы повторить.', 'Рекомендація не завантажилася. Натисніть «Продовжити курс», щоб повторити.')}</p>}
    </div>}
    {helpOpen && <div id={helpId} role="dialog" aria-labelledby={helpTitleId} className={`${styles.popover} ${styles.helpPopover}`}>
      <div className={styles.helpHeading}>
        <h2 id={helpTitleId}>{t('Как продолжать курс', 'Як продовжувати курс')}</h2>
        <button ref={helpCloseRef} type="button" className={styles.helpClose}
          aria-label={t('Закрыть справку', 'Закрити довідку')}
          onClick={event => { event.stopPropagation(); setHelpOpen(false); helpButtonRef.current?.focus(); }}>
          <i className="pi pi-times" aria-hidden />
        </button>
      </div>
      <div className={styles.helpBody}><CourseContinueHelp target={target} uk={uk} /></div>
    </div>}
    {previewOpen && previewPosition && createPortal(<div ref={previewRef} id={previewId} role="dialog" aria-labelledby={previewTitleId}
      className={styles.suggestionsPopover} style={previewPosition} onMouseEnter={keepPreview} onMouseLeave={leavePreview}
      onFocusCapture={keepPreview} onBlurCapture={leavePreview}>
      <div className={styles.helpHeading}><h2 id={previewTitleId}>{t('Можно заняться сейчас', 'Можна зайнятися зараз')}</h2>
        <button type="button" className={styles.helpClose} aria-label={t('Закрыть список заданий', 'Закрити список завдань')}
          onClick={() => { continueRef.current?.focus(); closePreview(); }}><i className="pi pi-times" aria-hidden /></button></div>
      <CourseContinueSuggestions value={query.data?.data} loading={query.isFetching} error={query.isError} uk={uk}
        onNavigate={() => { closePreview(); setSettingsOpen(false); onNavigate?.(); }} />
    </div>, document.body)}
  </div>;
  return menuSlot ? createPortal(content, menuSlot) : content;
}
