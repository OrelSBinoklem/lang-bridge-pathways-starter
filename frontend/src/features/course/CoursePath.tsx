'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Dialog } from 'primereact/dialog';
import { clientApi } from '@/lib/client-api';
import { getLearnLangFromCookie, LEARN_LANG_EVENT } from '@/lib/learn-lang';
import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import styles from './course-path.module.css';
import categoryIcons from './category-icons.json';
import transparentArt from './category-transparent.json';
import { getGroupEffect, getGroupEffectVariants } from './effects/groupEffects.config';
import { useGroupEffectVariants } from './effects/useGroupEffectVariants';
import { useEffectViewport } from './effects/useEffectViewport';
import { getCardPlacement } from './effects/effectPlacement';
import { EffectVariantSwitch } from './effects/EffectVariantSwitch';
import { getVisibleSkills } from './groupSkills.config';
import { ThemedGroupOverlay } from './effects/ThemedGroupOverlay';
import { EffectsToggle } from './effects/EffectsToggle';
import { useEffectsEnabled } from './effects/useEffectsEnabled';
import { useEffectComparison } from './effects/useEffectComparison';
import type { PointerState } from './effects/engine';
import { pointerStateFromEvent } from './effects/pointerState';
import { getGrammarCustomComponent } from './grammarCustomComponents';
import { COURSE_LEVEL_IDS, courseRankIcon, courseRankLabel, getCourseLevelProgress, type CourseLevelSummary, type CourseRank } from './course-level-progress';
import '@/features/custom-categories/custom-categories.css';
import { PRACTICE_SKILLS } from '@/features/lessons/practiceSkills';
import { getPracticeAwards, type PracticeRound } from './practice-awards';
import { thematicCategoryArt } from '@/features/category-previews/model';
import { CourseTour } from '@/features/home-tour/CourseTour';

const EnglishCourseGrammar = dynamic(() => import('./EnglishCourseGrammar'), { loading: () => <p role="status">Загрузка таблицы…</p> });

const categoryIconMap: Record<string, { name: string; src: string }> = categoryIcons;

type Step = {
  id: number; title: string; description: string | null; kind: 'category' | 'grammar';
  status: 'completed' | 'active' | 'locked'; available: boolean; dictionary_id: number | null;
  category_id: number | null; grammar_table_id: string | null; custom_component: string | null; image: string | null;
  total_words: number; learned_words: number; percent: number;
  group_id: number | null; grammar_href?: string | null;
};
type Group = {
  id: number; title: string; dictionary_id: number | null; category_id: number | null; completed: number; total: number;
  learning?: { active: boolean; percent: number; target: number; previous_debt: number };
  skills?: Partial<Record<'grammar' | 'listening' | 'reading' | 'writing' | 'speaking', { slug: string; status: string; progress: SkillProgress | null }>>;
};
type SkillProgress = { completed: boolean; passed: number; total: number; best_score: number | null; best_rank: CourseRank | null; additional_variants?: number; practice_rounds?: PracticeRound[] };
type Level = CourseLevelSummary & { steps: Step[]; groups: Group[] };

function ringStyle(score: number): CSSProperties {
  return { '--ring-progress': `${Math.max(0, Math.min(100, score))}%` } as CSSProperties;
}

function PracticeTile({ group, visibleSkills, uk, locked }: { group: Group; visibleSkills: Set<string>; uk: boolean; locked: boolean }) {
  const skills = PRACTICE_SKILLS.filter(item => visibleSkills.has(item.skill));
  if (!skills.length) return null;
  const available = skills.map(item => group.skills?.[item.skill]).filter(item => item != null);
  const first = available.find(item => !item.progress?.completed) ?? available[0];
  const className = `${styles.practiceTile} ${locked || !first ? styles.practiceLocked : ''}`;
  const awards = getPracticeAwards(available.map(item => item.progress));
  const allRoundsCompleted = awards.every(award => award.completed);
  const labels = uk ? ['Основна практика', 'Ще один варіант кожного завдання', 'Усі три варіанти кожного завдання']
    : ['Основная практика', 'Ещё один вариант каждого задания', 'Все три варианта каждого задания'];
  const descriptions = awards.map((award, index) => `${labels[index]}: ${award.percent}% (${award.passed}/${award.total})`);
  const skillDescriptions = skills.map(item => {
    const lesson = group.skills?.[item.skill];
    return `${uk ? item.uk : item.ru}: ${!lesson ? (uk ? 'у розробці' : 'в разработке')
      : lesson.progress?.completed ? (uk ? 'зараховано' : 'зачтено')
        : locked ? (uk ? 'можна спробувати зараз' : 'можно попробовать сейчас')
          : `${lesson.progress?.passed ?? 0}/${lesson.progress?.total ?? 0}`}`;
  });
  const content = <>
    <span className={styles.practiceAwards}>
      {allRoundsCompleted ? <span className={styles.practiceMastery} role="img"
        aria-label={uk ? 'Усі три варіанти кожного завдання завершено' : 'Все три варианта каждого задания завершены'}>
        <i className="pi pi-star-fill" aria-hidden="true" /><span aria-hidden="true">×3</span>
      </span> : awards.map((award, index) => <span key={index} className={styles.practiceAward}
        data-state={award.completed ? 'completed' : 'empty'} data-practice-round={index + 1}
        title={descriptions[index]} aria-label={descriptions[index]} role="img">
        {!award.completed && <i className={`pi pi-star-fill ${styles.practiceStarBacking}`} aria-hidden="true" />}
        <i className={`pi ${award.completed ? 'pi-star-fill' : 'pi-star'}`} aria-hidden="true" />
      </span>)}
    </span>
    <span className={styles.practiceTitle}>Практика</span>
    <i className={`pi pi-arrow-right ${styles.practiceArrow}`} aria-hidden="true" />
  </>;
  return first ? <Link className={className} href={`/lessons/${encodeURIComponent(first.slug)}`} prefetch={false}
    data-course-tour="practice"
    data-practice-mastery={allRoundsCompleted ? '3' : undefined}
    title={[...descriptions, ...skillDescriptions].join('\n')} aria-label={`Практика: ${skills.map(item => uk ? item.uk : item.ru).join(', ')}. ${descriptions.join('. ')}`}
    onClick={event => event.stopPropagation()}>{content}</Link>
    : <span className={className} data-course-tour="practice" aria-disabled="true">{content}</span>;
}

export function CoursePath({ learnLanguage }: { learnLanguage?: 'en' | 'lv' } = {}) {
  const uk = useLocale() === 'uk';
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  const [lang, setLang] = useState(learnLanguage ?? 'lv');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const levelFromUrl = searchParams.get('level');
  const groupFromUrl = searchParams.get('group');
  const skillFromUrl = searchParams.get('skill');
  const navigationRestoreRef = useRef<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [levelId, setLevelIdState] = useState(COURSE_LEVEL_IDS.some((id) => id === levelFromUrl) ? (levelFromUrl as string) : 'A1');
  const setLevelId = (id: string) => {
    setLevelIdState(id);
    setActiveGroupId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set('level', id);
    params.delete('group');
    params.delete('skill');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const detailRef = useRef<HTMLElement | null>(null);
  const [themedGroupId, setThemedGroupId] = useState<number | null>(null);
  const [effectsEnabled, setEffectsEnabled] = useEffectsEnabled();
  const [effectComparison] = useEffectComparison();
  const [effectVariants, selectEffectVariant] = useGroupEffectVariants();
  const [cardEffects, setCardEffects] = useState<Record<number, boolean>>({});
  const fullHdEffects = useEffectViewport();
  // Focus on the effect: the themed group whose effect is shown alone (EffectVariantSwitch, globals.css).
  const [focusGroupId, setFocusGroupId] = useState<number | null>(null);
  const effectFocus = effectsEnabled && focusGroupId !== null && focusGroupId === themedGroupId;
  useEffect(() => {
    if (!effectFocus) return;
    const root = document.documentElement;
    root.classList.add('course-effect-focus');
    // Nothing may scroll: scrolling keys and touch drags are held back too (effects still get pointer events).
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocusGroupId(null);
      else if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) && (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || (event.key === ' ' && !(event.target instanceof HTMLButtonElement)))) event.preventDefault();
    };
    const touch = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    window.addEventListener('keydown', keys);
    document.addEventListener('touchmove', touch, { passive: false });
    return () => {
      root.classList.remove('course-effect-focus');
      window.removeEventListener('keydown', keys);
      document.removeEventListener('touchmove', touch);
    };
  }, [effectFocus]);
  const groupRefs = useRef<Map<number, HTMLElement>>(new Map());
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false, moved: false });
  const lastPointerRef = useRef<{ x: number; y: number; groupId: number } | null>(null);
  const feedPointer = (event: ReactPointerEvent<HTMLElement>, groupId: number, themed: boolean) => {
    if (!themed) return;
    const el = groupRefs.current.get(groupId);
    if (!el) return;
    pointerRef.current = pointerStateFromEvent(event, el.getBoundingClientRect(), pointerRef.current);
    lastPointerRef.current = { x: event.clientX, y: event.clientY, groupId };
  };
  // Scrolling (a touchpad's two-finger swipe, a wheel) moves the card under a still cursor without any pointer event:
  // the cursor's place on the card is worked out again from where it last was on the screen.
  useEffect(() => {
    const onScroll = () => {
      const last = lastPointerRef.current;
      if (!last || !pointerRef.current.active) return;
      const el = groupRefs.current.get(last.groupId);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inside = last.x >= r.left && last.x <= r.right && last.y >= r.top && last.y <= r.bottom;
      pointerRef.current = inside
        ? { ...pointerRef.current, x: last.x - r.left - r.width / 2, y: -(last.y - r.top - r.height / 2) }
        : { ...pointerRef.current, active: false, pressed: false };
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const update = () => { setLang(learnLanguage ?? getLearnLangFromCookie() ?? 'lv'); setSelectedId(null); setThemedGroupId(null); setActiveGroupId(null); navigationRestoreRef.current = null; };
    update();
    window.addEventListener(LEARN_LANG_EVENT, update);
    return () => window.removeEventListener(LEARN_LANG_EVENT, update);
  }, [learnLanguage]);
  const query = useQuery({
    queryKey: ['course-path', lang],
    queryFn: () => clientApi<{ data: Level[] }>(`/course?learn_lang=${encodeURIComponent(lang)}`),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const levels = query.data?.data ?? [];
  const level = levels.find((item) => item.id === levelId);
  useEffect(() => {
    if (COURSE_LEVEL_IDS.some(id => id === levelFromUrl)) setLevelIdState(levelFromUrl!);
  }, [levelFromUrl]);
  useEffect(() => {
    if (!groupFromUrl || !/^[1-9]\d*$/.test(groupFromUrl)) {
      navigationRestoreRef.current = null;
      return;
    }
    const key = `${lang}:${levelFromUrl}:${groupFromUrl}:${skillFromUrl}`;
    if (navigationRestoreRef.current === key || !query.data) return;
    const groupId = Number(groupFromUrl);
    const targetLevel = query.data.data.find(item => item.groups.some(group => group.id === groupId));
    if (!targetLevel) return;
    if (targetLevel.id !== levelId) {
      setLevelIdState(targetLevel.id);
      return;
    }
    const step = targetLevel.steps.find(item => item.group_id === groupId && item.kind === (skillFromUrl === 'grammar' ? 'grammar' : 'category'))
      ?? targetLevel.steps.find(item => item.group_id === groupId);
    setActiveGroupId(groupId);
    setSelectedId(step?.id ?? null);
    const frame = requestAnimationFrame(() => {
      groupRefs.current.get(groupId)?.scrollIntoView({ block: 'start' });
      navigationRestoreRef.current = key;
    });
    return () => cancelAnimationFrame(frame);
  }, [groupFromUrl, skillFromUrl, levelFromUrl, lang, levelId, query.data]);
  const groups: Group[] = [...(level?.groups ?? []), ...(level?.steps.some(step => !step.group_id) ? [{ id: 0, title: uk ? 'Без групи' : 'Без группы', dictionary_id: null, category_id: null, completed: 0, total: 0 }] : [])];
  const themedGroup = groups.find((g) => g.id === themedGroupId);
  const themedEffect = themedGroup
    ? getGroupEffect({ categoryId: themedGroup.category_id, title: themedGroup.title, variantId: themedGroup.category_id != null ? effectVariants[themedGroup.category_id] : null })
    : null;
  // Whole-page background effects (grid, fluid) read better when the page's own content recedes
  // a bit instead of competing with it for attention. `<main>`/`.root` live outside this
  // component (AppShell, this file's own root), so this reaches them the same way the site's
  // existing WebGL-GUI toggle does: a body class picked up by plain CSS rules (see
  // app-shell.module.css's `.main` and this file's own `.root` under `body.body-effect-active`).
  const dimContent = effectsEnabled && !!themedEffect && !themedEffect.cardOnly && (effectComparison || !getCardPlacement(fullHdEffects, cardEffects[themedGroupId ?? -1], effectFocus));
  useEffect(() => {
    document.body.classList.toggle('body-effect-active', dimContent);
    return () => document.body.classList.remove('body-effect-active');
  }, [dimContent]);
  const selected = level?.steps.find((item) => item.id === selectedId) ?? level?.steps[0];
  const selectedLearning = groups.find(group => group.id === selected?.group_id)?.learning;
  const statusText = { completed: uk ? 'Пройдено' : 'Пройден', active: uk ? 'Активний' : 'Активный', locked: uk ? 'Заблоковано' : 'Заблокирован' };
  const view = (
    <section className={styles.root} data-course-tour="path">
      <header className={styles.header}>
        <h1>{uk ? 'Шлях курсу' : 'Путь курса'}{lang === 'en' && <small className={styles.courseLanguage}> · {uk ? 'Англійська' : 'Английский'}</small>}</h1>
        <div className={styles.tools}>
          <EffectsToggle enabled={effectsEnabled} onChange={setEffectsEnabled} uk={uk} />
          <button type="button" aria-label={uk ? 'Оновити прогрес' : 'Обновить прогресс'} title={uk ? 'Оновити прогрес' : 'Обновить прогресс'} onClick={() => void query.refetch()} disabled={query.isFetching}><i className={`pi pi-refresh ${query.isFetching ? 'pi-spin' : ''}`} /></button>
          <button type="button" aria-label={expanded ? 'Свернуть' : 'На весь экран'} title={expanded ? 'Свернуть' : 'На весь экран'} onClick={() => setExpanded(!expanded)}><i className={`pi ${expanded ? 'pi-window-minimize' : 'pi-window-maximize'}`} /></button>
        </div>
      </header>
      {query.isSuccess && !!level?.groups.length && <div className={styles.tourEntry}>
        <CourseTour key={lang} isAuthenticated={true} learnLanguage={lang === 'en' ? 'en' : 'lv'} />
      </div>}
      <nav className={styles.tabs} data-course-tour="levels" aria-label={uk ? 'Рівень курсу' : 'Уровень курса'}>
        {COURSE_LEVEL_IDS.map((id) => {
          const item = levels.find((entry) => entry.id === id);
          const state = item?.status ?? 'locked';
          const { percent, rank } = getCourseLevelProgress(item);
          const rankText = rank ? courseRankLabel(rank, uk) : null;
          return <button key={id} type="button" data-course-tour="level" aria-label={`${id}: ${statusText[state]}, ${percent}%${rankText ? `, ${rankText}` : ''}`} title={statusText[state]} aria-pressed={levelId === id} className={`${styles.tab} ${styles[state]} ${rank ? styles[rank] : ''}`} onClick={() => { setLevelId(id); setSelectedId(null); }}>
            {item?.perfect && <span className={styles.perfectBadge} title={uk ? 'Перфект' : 'Перфект'}><i className="pi pi-star-fill" aria-hidden="true" /></span>}
            <span className={styles.tabTop}>
              <strong>{id}</strong>
              {rankText && rank ? <span className={styles.tabRank}>
                <i className={`pi ${courseRankIcon(rank)}`} aria-hidden="true" /><span>{rankText}</span>
              </span> : state !== 'completed' && <span className={styles.tabIcon} aria-hidden="true"><i className={`pi ${state === 'active' ? 'pi-play' : 'pi-lock'}`} /></span>}
            </span>
            <span className={styles.tabProgressLabel}><span>{item?.total ? `${percent}%` : '—'}</span></span>
            <span className={styles.tabProgress} aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
            <small>{item?.completed ?? 0} / {item?.total ?? 0} {uk ? 'категорій' : 'категорий'}</small>
          </button>;
        })}
      </nav>
      {query.isLoading && <p role="status" className={styles.empty}>{uk ? 'Завантаження курсу…' : 'Загрузка курса…'}</p>}
      {query.isError && <div role="alert" className={styles.empty}>{uk ? 'Не вдалося завантажити курс. Перевірте вхід в акаунт.' : 'Не удалось загрузить курс. Проверьте вход в аккаунт.'} <Link href="/login">{uk ? 'Увійти' : 'Войти'}</Link></div>}
      {!query.isLoading && !query.isError && !level?.steps.length && <p className={styles.empty}>{uk ? 'Етапів цього рівня поки немає.' : 'Этапов этого уровня пока нет.'}</p>}
      {!!level?.steps.length && <div className={styles.workspace}>
        <div className={styles.groups}>
        {groups.map(group => {
          const variants = getGroupEffectVariants(group.category_id);
          const activeVariantId = variants
            ? (variants.find((v) => v.id === effectVariants[group.category_id!])?.id ?? variants[0].id)
            : null;
          const effect = getGroupEffect({ categoryId: group.category_id, title: group.title, variantId: activeVariantId });
          const isThemed = effectsEnabled && effect !== null && themedGroupId === group.id;
          const cardMode = getCardPlacement(fullHdEffects, cardEffects[group.id], false, effect?.cardOnly);
          const forceCard = getCardPlacement(fullHdEffects, cardEffects[group.id], isThemed && effectFocus, effect?.cardOnly);
          // Full-page-only worlds leave card colours and geometry alone; selection keeps its usual highlight.
          const hasCardEffect = isThemed && (forceCard || (effectComparison && !effectFocus));
          const groupSteps = level.steps.filter(step => (step.group_id ?? 0) === group.id);
          const wordsStep = groupSteps.find(step => step.kind === 'category');
          const grammarStep = groupSteps.find(step => step.kind === 'grammar');
          const visibleSkills = lang === 'en' ? new Set(['words', ...(grammarStep ? ['grammar'] : [])]) : getVisibleSkills({ categoryId: group.category_id, title: group.title });
          const thematicArt = thematicCategoryArt(group.title);
          const groupLocked = group.learning ? !group.learning.active
            : wordsStep?.status === 'locked' || (!wordsStep && grammarStep?.status === 'locked');
          const laterLocked = group.learning ? groupLocked : groupLocked || (visibleSkills.has('words') && wordsStep?.status !== 'completed')
            || (visibleSkills.has('grammar') && !group.skills?.grammar?.progress?.completed);
          const grammarScore = group.skills?.grammar?.progress?.best_score ?? 0;
          const grammarRank = group.skills?.grammar?.progress?.best_rank;
          return <div
            className={`${styles.group} ${activeGroupId === group.id ? styles.groupSelected : ''} ${hasCardEffect ? styles.groupThemed : ''} ${hasCardEffect && effect?.seeThrough ? styles.groupSeeThrough : ''}`}
            data-course-group={group.id}
            data-learning-active={group.learning?.active ? 'true' : 'false'}
            data-active-group={activeGroupId === group.id ? 'true' : undefined}
            key={`${levelId}:${group.id}`}
            style={hasCardEffect ? { ['--themeGlow' as string]: effect!.glow } : undefined}
            ref={(el) => { if (el) groupRefs.current.set(group.id, el); }}
            onClick={() => {
              if (isThemed) return;
              setActiveGroupId(group.id);
              if (effect) setThemedGroupId(group.id);
            }}
            onPointerMove={(event) => feedPointer(event, group.id, hasCardEffect)}
            onPointerDown={(event) => feedPointer(event, group.id, hasCardEffect)}
            onPointerUp={(event) => feedPointer(event, group.id, hasCardEffect)}
            onPointerCancel={(event) => feedPointer(event, group.id, hasCardEffect)}
            onPointerLeave={() => { pointerRef.current.active = false; }}
            data-effect-focus={isThemed ? 'host' : undefined}
            data-effect-body={isThemed && !effect?.cardOnly && (!forceCard || effectComparison) ? '' : undefined}
            data-effect-card-contained={hasCardEffect ? '' : undefined}
          >
            {/* Keyed by variant: the overlay builds its tuning panel once on mount, so switching
                variants has to remount it rather than hand a new effect to the same instance. */}
            {isThemed && <ThemedGroupOverlay key={activeVariantId ?? 'default'} effect={effect!} forceCard={forceCard} comparison={effectComparison} focused={effectFocus} expandCard={effectFocus && !fullHdEffects} uk={uk} onClose={() => setFocusGroupId(null)} getHost={() => groupRefs.current.get(group.id) ?? null} pointerRef={pointerRef} />}
            {isThemed && !effect?.cardOnly && (
              <EffectVariantSwitch
                variants={variants ?? []}
                activeId={activeVariantId}
                onSelect={(variantId) => selectEffectVariant(group.category_id!, variantId)}
                focused={effectFocus}
                onFocus={() => setFocusGroupId(effectFocus ? null : group.id)}
                uk={uk}
                seeThrough={effect!.seeThrough}
                cardMode={cardMode}
                onCardMode={() => { setFocusGroupId(null); setCardEffects(previous => ({ ...previous, [group.id]: !cardMode })); }}
              />
            )}
          <div
            className={styles.groupHeader}
            data-course-tour="group"
            data-effect-focus="content"
          >
            <span className={styles.groupArtwork} aria-hidden="true">
              {group.dictionary_id === 20 && categoryIconMap[String(group.category_id)] ? <img className={styles.groupImage} src={transparentArt.includes(Number(group.category_id)) ? `/course/categories/transparent/${group.category_id}-${dark ? 'dark' : 'light'}.webp` : dark ? `/course/categories/${group.category_id}-dark-v1.webp` : categoryIconMap[String(group.category_id)].src} alt="" width={102} height={102} loading="lazy" /> : <img className={styles.groupImage} src={thematicArt ? dark ? thematicArt.replace(/-light\.webp$/, '-dark.webp') : thematicArt : '/course/categories/introduction-v1.webp'} alt="" width={102} height={102} loading="lazy" />}
            </span>
            <span className={styles.groupTitle}>
              <h2>{group.title}</h2>
              {group.learning && <span className={styles.learningState} data-learning-active={group.learning.active}>
                <i className={`pi ${group.learning.active ? 'pi-play-circle' : 'pi-compass'}`} aria-hidden />
                {group.learning.percent}% · {group.learning.active ? (uk ? 'Для навчання' : 'Для обучения') : (uk ? 'На потім' : 'На потом')}
              </span>}
              <span className={styles.skillRow}>
                <span className={styles.skillGrid}>
                  {visibleSkills.has('words') && <button type="button" data-course-tour="words" className={`${styles.skillIcon} ${wordsStep ? styles.skillActive : styles.skillSoon} ${groupLocked ? styles.skillLocked : ''}`} data-skill="pi-book" data-state={!wordsStep ? 'development' : groupLocked ? 'locked' : wordsStep.status === 'completed' ? 'diamond' : wordsStep.percent ? 'learning' : 'new'} style={ringStyle(wordsStep?.percent ?? 0)} disabled={!wordsStep} aria-pressed={!!wordsStep && selected?.id === wordsStep.id} title={wordsStep ? 'Слова' : `Слова: ${uk ? 'у розробці' : 'в разработке'}`} onClick={(event) => {
                    if (!wordsStep) return;
                    event.stopPropagation();
                    setActiveGroupId(group.id);
                    if (effect) setThemedGroupId(group.id);
                    setSelectedId(wordsStep.id);
                    if (window.matchMedia('(max-width: 760px)').matches) detailRef.current?.scrollIntoView({ block: 'start' });
                  }}><i className={`pi ${wordsStep ? 'pi-book' : 'pi-times'}`} /></button>}
                  {visibleSkills.has('grammar') && <button type="button" data-course-tour="grammar" className={`${styles.skillIcon} ${grammarStep ? styles.skillActive : styles.skillSoon} ${groupLocked ? styles.skillLocked : ''}`} data-skill="pi-table" data-state={!grammarStep ? 'development' : groupLocked ? 'locked' : grammarRank ?? (grammarScore ? 'learning' : 'new')} style={ringStyle(grammarScore)} disabled={!grammarStep} aria-pressed={!!grammarStep && selected?.id === grammarStep.id} title={grammarStep ? (uk ? 'Граматика' : 'Грамматика') : `${uk ? 'Граматика: у розробці' : 'Грамматика: в разработке'}`} onClick={(event) => {
                    if (!grammarStep) return;
                    event.stopPropagation();
                    setActiveGroupId(group.id);
                    if (effect) setThemedGroupId(group.id);
                    setSelectedId(grammarStep.id);
                    if (window.matchMedia('(max-width: 760px)').matches) detailRef.current?.scrollIntoView({ block: 'start' });
                  }}><i className={`pi ${grammarStep ? 'pi-table' : 'pi-times'}`} />{grammarScore > 0 && <span className={styles.skillBadge} aria-hidden="true">{grammarScore}%</span>}</button>}
                  <PracticeTile group={group} visibleSkills={visibleSkills} uk={uk} locked={laterLocked} />
                </span>
              </span>
            </span>
          </div>
          {group.category_id === 1766 && isThemed && <p className={styles.groupFootnote} data-effect-focus="content">
            {forceCard
              ? (uk ? 'Генеративне дерево · власний геном' : 'Генеративное дерево · уникальный геном')
              : (uk ? 'Два генеративні дерева · кожне має власний геном' : 'Два генеративных дерева · у каждого свой геном')}
          </p>}
        </div>;
        })}
        </div>
        {selected && <aside ref={detailRef} className={styles.detail} aria-live="polite">
          <p className={styles.eyebrow}>{levelId} · {selected.kind === 'grammar' ? (uk ? 'Граматика' : 'Грамматика') : (uk ? 'Словник' : 'Словарь')}</p>
          <h2>{selected.title}</h2>
          <p className={styles.status}>{selected.status === 'completed' || !selectedLearning ? statusText[selected.status]
            : selectedLearning.active ? (uk ? 'Для навчання' : 'Для обучения') : (uk ? 'На потім' : 'На потом')}</p>
          {selected.description && <p className={styles.description}>{selected.description}</p>}
          {lang === 'en' && level.steps.filter(step => step.group_id === selected.group_id && step.kind === 'grammar').length > 0 && <nav className={styles.englishTopics} aria-label={uk ? 'Граматика теми' : 'Грамматика темы'}>{level.steps.filter(step => step.group_id === selected.group_id && step.kind === 'grammar').map(step => <button type="button" key={step.id} aria-pressed={selected.id === step.id} onClick={() => setSelectedId(step.id)}>{step.title}</button>)}</nav>}
          {selected.kind === 'grammar' ? <>
            {(() => {
              const CustomComponent = getGrammarCustomComponent(selected.custom_component);
              const grammarLesson = groups.find(group => group.id === selected.group_id)?.skills?.grammar;
              if (lang === 'en' && selected.grammar_table_id) return <EnglishCourseGrammar key={selected.grammar_table_id} tableId={selected.grammar_table_id} />;
              if (CustomComponent) return <div className={styles.customTrainer}><CustomComponent /></div>;
              return <>
                {selected.image && <a href={selected.image} target="_blank" rel="noreferrer" className={styles.preview}><img src={selected.image} alt={selected.title} /></a>}
                {grammarLesson ? <Link prefetch={false} className={styles.openButton} href={`/lessons/${encodeURIComponent(grammarLesson.slug)}`}><i className="pi pi-pencil" />{uk ? 'Відкрити вправи' : 'Открыть задания'}{grammarLesson.progress?.best_score != null ? ` · ${grammarLesson.progress.best_score}%` : ''}</Link>
                  : <p>{uk ? 'Таблиця доступна. Урок і перевірку знань буде додано пізніше.' : 'Таблица доступна. Урок и проверка знаний будут добавлены позже.'}</p>}
              </>;
            })()}
          </> : <>
            <div className={styles.progressHeader}><strong>{selected.percent}%</strong><span>{selected.learned_words} / {selected.total_words} {uk ? 'слів' : 'слов'}</span></div>
            <progress max={100} value={selected.percent} aria-label={uk ? 'Прогрес категорії' : 'Прогресс категории'} />
            {!selected.total_words && <p>{uk ? 'У категорії поки немає слів.' : 'В категории пока нет слов.'}</p>}
          </>}
          {selected.available ? <Link prefetch={false} className={styles.openButton} href={selected.kind === 'grammar' ? selected.grammar_href || `/grammar?table=${encodeURIComponent(selected.grammar_table_id ?? '')}` : `/dictionaries/${selected.dictionary_id}/category/${selected.category_id}`}><i className={`pi ${selected.kind === 'grammar' ? 'pi-table' : 'pi-play'}`} />{selected.kind === 'grammar' ? (uk ? 'Відкрити таблицю' : 'Открыть таблицу') : (uk ? 'Відкрити категорію' : 'Открыть категорию')}</Link> : <p>{uk ? 'Матеріал більше недоступний.' : 'Материал больше недоступен.'}</p>}
        </aside>}
      </div>}
      {['lv', 'en'].includes(lang) && <Link prefetch={false} className={styles.openButton} href={`/exams?level=${levelId}${lang === 'en' ? '&learn_lang=en' : ''}`}><i className="pi pi-graduation-cap" aria-hidden />{uk ? 'Підсумковий іспит' : 'Итоговый экзамен'} {levelId}</Link>}
    </section>
  );
  return expanded ? <Dialog visible modal maximized showHeader={false} onHide={() => setExpanded(false)} contentStyle={{ padding: 0 }} style={{ width: '100vw' }}>{view}</Dialog> : view;
}
