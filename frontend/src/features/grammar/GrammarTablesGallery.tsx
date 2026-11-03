'use client';

import { useLocale, useTranslations } from 'next-intl';
import { createPortal, flushSync } from 'react-dom';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import tablesData, { type GrammarTableItem, type GrammarTablesData } from './data/tablesData';
import { getGrammarTableComponent } from './componentRegistry';
import { ScaledTableEmbed } from './ScaledTableEmbed';
import { LazyTableBody, getCardHeight } from './LazyTableBody';
import { GrammarTablesMenuPortal } from './GrammarTablesMenuPortal';
import {
  filterTablesByLevel,
  getLevelClass,
  getLevelLabel,
  getStorage,
  hintPayloadFromItem,
  isLargeFontEnabled,
  mirrorToCookie,
  resolveImageSrc,
  setStorage,
  type FilterLevel,
  type GalleryInitialSettings,
  type ViewMode,
} from './helpers';
import { clientApi } from '@/lib/client-api';
import { useAdminAppearance } from '@/features/admin/useUserPreview';
import type { ApiUser } from '@/lib/types';
import styles from './grammar-tables-gallery.module.css';
import { useGrammarTopics } from '@/features/grammar-practice/GrammarTopics';
import { GrammarTablePractice } from '@/features/grammar-practice/GrammarTablePractice';
import { GrammarOverviewButton } from './GrammarOverviewButton';
import { resolveGrammarTableLink } from './data/grammarTableBindings';
import { GrammarTour } from '@/features/home-tour/GrammarTour';

type ComponentRenderMode = 'mixed' | 'components' | 'images';
type TableRenderOverride = 'component' | 'image';

type ModalImage = GrammarTableItem & {
  displaySrc: string;
  displayWidth?: number;
  displayHeight?: number;
};

type HintModal = { id: string; hintPath: string };

const BADGE_CLASS: Record<string, string> = {
  a1: styles.badgeA1,
  a2: styles.badgeA2,
  b1: styles.badgeB1,
  b2: styles.badgeB2,
  super: styles.badgeSuper,
};

function useHydratedStorage<T extends string>(key: string, fallback: T, initial?: string): [T, (v: T) => void] {
  // `initial` comes from the cookie the server could read, so the first paint already matches what
  // the visitor picked last time; localStorage is still consulted for anyone without the cookie yet.
  const [value, setValue] = useState<T>((initial as T) ?? fallback);

  useEffect(() => {
    const stored = getStorage(key, (initial as T) ?? fallback) as T;
    setValue(stored);
    mirrorToCookie(key, stored);
  }, [key, fallback, initial]);

  const setAndStore = useCallback(
    (next: T) => {
      setValue(next);
      setStorage(key, next);
    },
    [key],
  );

  return [value, setAndStore];
}

const TABLE_TITLE_KEYS: Record<string, { title?: string; alt?: string }> = {
  'super-6': { title: 'titleNumbers', alt: 'titleNumbers' },
  'super-5': { title: 'titleQuestions', alt: 'altQuestions' },
  diminutivi: { title: 'titleDiminutives', alt: 'titleDiminutives' },
  'pre-verb': { title: 'titleVerbPrefixes', alt: 'titleVerbPrefixes' },
  '45': { title: 'titleParticiples', alt: 'altParticiples' },
};

const COMPONENT_MODE_STORAGE = 'grammar-component-render-mode';
/** Warm-up pacing: how many table components mount immediately, then per tick. */
const WARMUP_FIRST_BATCH = 8;
const WARMUP_BATCH = 6;
const WARMUP_INTERVAL_MS = 90;
const COMPONENT_OVERRIDES_STORAGE = 'grammar-component-render-overrides';

export function GrammarTablesGallery({ initialSettings, catalog, language = 'lv', componentFor, ownsTableRoot = false, matchesQuery }: {
  initialSettings?: GalleryInitialSettings; catalog?: GrammarTablesData; language?: 'lv' | 'en';
  componentFor?: (item: GrammarTableItem) => ComponentType | null; ownsTableRoot?: boolean;
  matchesQuery?: (item: GrammarTableItem, query: string) => boolean;
} = {}) {
  const catalogData = catalog ?? tablesData;
  const componentForItem = (item: GrammarTableItem) => componentFor ? componentFor(item) : getGrammarTableComponent(item.componentKey);
  const [query, setQuery] = useState('');
  const t = useTranslations('Grammar');
  const locale = useLocale();
  const [cols, setCols] = useHydratedStorage<string>('gallery-columns', '3', initialSettings?.['gallery-columns']);
  const [selectedLevel, setSelectedLevel] = useHydratedStorage<FilterLevel>(
    'gallery-level',
    'a1',
    initialSettings?.['gallery-level'],
  );
  const [viewMode, setViewMode] = useHydratedStorage<ViewMode>('view-mode', 'horizontal', initialSettings?.['view-mode']);
  const [useMobileImages, setUseMobileImages] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [modalData, setModalData] = useState<ModalImage | null>(null);
  const tourModalId = useRef<string | null>(null);
  const [hintModal, setHintModal] = useState<HintModal | null>(null);
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 });
  const [user, setUser] = useState<ApiUser | null>(null);
  const grammarTopics = useGrammarTopics(Boolean(user), language);
  const [componentMode, setComponentMode] = useHydratedStorage<ComponentRenderMode>(
    COMPONENT_MODE_STORAGE,
    'mixed',
  );
  const [tableOverrides, setTableOverrides] = useState<Record<string, TableRenderOverride>>({});
  const [presentationTableIds, setPresentationTableIds] = useState<string[] | null>(null);
  const galleriesRef = useRef<HTMLDivElement>(null);
  /** Pending timer of the coalesced gallery-width pass (see scheduleGalleryWidths). */
  const widthsPassRef = useRef<number | undefined>(undefined);
  /** Stands in for "observe against the viewport" in vertical mode. */
  const nullRootRef = useRef<HTMLElement | null>(null);
  /** Tables the tutor bot asked for: they stay mounted even when scrolled far away. */
  const [revealedKeys, setRevealedKeys] = useState<string[]>([]);

  // The bot reads and highlights tables by looking them up in the DOM, but off-screen tables are
  // unmounted. It announces the table it needs; mounting is flushed synchronously so the lookup that
  // follows the event already finds it.
  useEffect(() => {
    const onReveal = (event: Event) => {
      const detail = (event as CustomEvent<{ tableKey?: string; preserveQuery?: boolean }>).detail;
      const key = detail?.tableKey;
      if (!key) return;
      flushSync(() => {
        if (!detail.preserveQuery) setQuery('');
        setRevealedKeys((prev) => {
          const match = Object.values(catalogData)
            .flat()
            .find((item) => String(item.componentKey).toLowerCase() === key.toLowerCase());
          const id = match ? String(match.componentKey) : key;
          return prev.includes(id) ? prev : [...prev, id];
        });
      });
    };
    window.addEventListener('grammar.table.reveal', onReveal);
    return () => window.removeEventListener('grammar.table.reveal', onReveal);
  }, [catalogData]);
  // Keep the desktop preference, but do not shrink sentence tables into three
  // unreadable columns on a phone. Use the same count for layout and measurement.
  const colsNum = Math.min(isNarrowViewport ? 1 : 4, Math.max(1, parseInt(cols, 10) || 3));
  const isAdmin = useAdminAppearance(user?.is_admin);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('table');
    if (id === null) return;
    const target = resolveGrammarTableLink(id);
    const table = Object.values(catalogData).flat().find((item) => String(item.id) === target || item.componentKey === target);
    if (!table) return;
    setModalData({ ...table, displaySrc: resolveImageSrc(table, false) });
  }, [catalogData]);
  useEffect(() => {
    if (language !== 'en') return;
    const params = new URLSearchParams(window.location.search);
    const hashId = window.location.hash.slice(1);
    const target = Object.values(catalogData).flat().find(item => String(item.id) === hashId || item.componentKey === params.get('table'));
    const level = target?.level ?? params.get('level');
    let frame = requestAnimationFrame(() => {
      if (['a1', 'a2', 'b1', 'b2'].includes(level ?? '')) setSelectedLevel(level as FilterLevel);
      if (target) {
        setRevealedKeys(previous => previous.includes(String(target.componentKey)) ? previous : [...previous, String(target.componentKey)]);
        // Scroll only after the selected level and lazy table have committed.
        frame = requestAnimationFrame(() => document.getElementById(`table-${target.id}`)?.scrollIntoView({ block: 'start' }));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [language, catalogData, setSelectedLevel]);
  const presentationTableIdSet = useMemo(
    () => new Set(presentationTableIds || []),
    [presentationTableIds],
  );

  useEffect(() => {
    clientApi<{ user: ApiUser }>('/user')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const onPresentation = (event: Event) => {
      const detail = (event as CustomEvent<{ tableIds?: string[] | null }>).detail;
      setPresentationTableIds(
        Array.isArray(detail?.tableIds) && detail.tableIds.length ? detail.tableIds : null,
      );
    };
    window.addEventListener('tutor.grammar.presentation', onPresentation);
    return () => window.removeEventListener('tutor.grammar.presentation', onPresentation);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COMPONENT_OVERRIDES_STORAGE);
      if (raw) {
        setTableOverrides(JSON.parse(raw) as Record<string, TableRenderOverride>);
      }
    } catch {
      setTableOverrides({});
    }
  }, []);

  const setOverrides = useCallback((next: Record<string, TableRenderOverride>) => {
    setTableOverrides(next);
    try {
      localStorage.setItem(COMPONENT_OVERRIDES_STORAGE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const sync = () => setUseMobileImages(isLargeFontEnabled());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const updateVw = () => {
      const realWidth = document.documentElement.clientWidth || window.innerWidth;
      document.documentElement.style.setProperty('--real-vw', `${realWidth}px`);
      setIsNarrowViewport(realWidth <= 650);
    };
    updateVw();
    window.addEventListener('resize', updateVw);
    return () => window.removeEventListener('resize', updateVw);
  }, []);

  const filteredGroups = useMemo(() => {
    const filter = (items: GrammarTableItem[]) => filterTablesByLevel(items, selectedLevel).filter(item => !query.trim() || !matchesQuery || matchesQuery(item, query));
    return {
      group1: filter(catalogData.group1),
      group2: filter(catalogData.group2),
      group3: filter(catalogData.group3),
    };
  }, [selectedLevel, catalogData, query, matchesQuery]);

  const visibleGroups = useMemo(() => {
    if (!presentationTableIds?.length) return filteredGroups;
    const onlyPresented = (tables: GrammarTableItem[]) =>
      tables.filter((table) => presentationTableIdSet.has(String(table.id)));
    return {
      group1: onlyPresented(catalogData.group1),
      group2: onlyPresented(catalogData.group2),
      group3: onlyPresented(catalogData.group3),
    };
  }, [filteredGroups, presentationTableIds, presentationTableIdSet, catalogData]);

  const totalVisibleTables =
    visibleGroups.group1.length + visibleGroups.group2.length + visibleGroups.group3.length;
  const hasAny = totalVisibleTables > 0;

  /**
   * Mounting sixty table components at once froze the level switch for seconds, so they arrive in
   * batches. Once every card has been mounted (and therefore measured) once, `warmed` hands the
   * cards over to the intersection observer, which keeps only what is near the screen alive.
   */
  const [mountBudget, setMountBudget] = useState(WARMUP_FIRST_BATCH);
  const [warmed, setWarmed] = useState(false);

  // Anything that re-lays the board starts the warm-up over (adjusting state during render, the
  // React-recommended alternative to an effect that only resets state).
  const warmUpKey = `${selectedLevel}|${viewMode}|${colsNum}|${componentMode}|${query}|${presentationTableIds?.join(',') ?? ''}`;
  const [lastWarmUpKey, setLastWarmUpKey] = useState(warmUpKey);
  const budgetRef = useRef(WARMUP_FIRST_BATCH);
  if (lastWarmUpKey !== warmUpKey) {
    setLastWarmUpKey(warmUpKey);
    budgetRef.current = WARMUP_FIRST_BATCH;
    setMountBudget(WARMUP_FIRST_BATCH);
    setWarmed(false);
  }

  // One interval that runs the whole warm-up: every card must be mounted (and so measured) once,
  // otherwise a placeholder would guess its height and both layouts would reshuffle.
  useEffect(() => {
    if (!hasAny) return;
    let done = 0;
    const tick = window.setInterval(() => {
      if (budgetRef.current >= totalVisibleTables) {
        window.clearInterval(tick);
        // Let the last batch settle its scale before handing over to the observer.
        done = window.setTimeout(() => setWarmed(true), 700);
        return;
      }
      budgetRef.current += WARMUP_BATCH;
      setMountBudget(budgetRef.current);
    }, WARMUP_INTERVAL_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [hasAny, totalVisibleTables, warmUpKey]);
  useEffect(() => {
    if (language !== 'en' || !warmed) return;
    // Initial lazy placeholders change column positions while their real tables
    // are measured. Resolve the anchor again once that layout has settled.
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = requestAnimationFrame(() => document.getElementById(`table-${id}`)?.scrollIntoView({ block: 'start', inline: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [language, warmed, warmUpKey]);
  const componentTablesCount = useMemo(
    () =>
      [...catalogData.group1, ...catalogData.group2, ...catalogData.group3].filter(
        (table) => table.componentKey,
      ).length,
    [catalogData],
  );

  const shouldRenderComponent = useCallback(
    (image: GrammarTableItem) => {
      if (!image.componentKey) return false;
      if (!image.src) return true;
      if (presentationTableIdSet.has(String(image.id))) return true;
      // Image/component switching is an admin tool: everyone else always gets the component.
      if (!isAdmin) return true;
      const override = tableOverrides[String(image.id)];
      if (override) return override === 'component';
      if (componentMode === 'images') return false;
      return true;
    },
    [componentMode, isAdmin, presentationTableIdSet, tableOverrides],
  );

  const setAllComponentMode = (mode: ComponentRenderMode) => {
    setComponentMode(mode);
    if (mode !== 'mixed') {
      setOverrides({});
    }
  };

  const toggleTableMode = (image: GrammarTableItem) => {
    if (!image.componentKey) return;
    const id = String(image.id);
    const nextValue: TableRenderOverride = shouldRenderComponent(image) ? 'image' : 'component';
    setComponentMode('mixed');
    setOverrides({ ...tableOverrides, [id]: nextValue });
  };

  const updatePageIndicator = useCallback(() => {
    const container = galleriesRef.current;
    if (!container || viewMode !== 'horizontal') return;
    const visibleWidth = document.body.clientWidth;
    const totalWidth = container.scrollWidth;
    const currentScroll = container.scrollLeft;
    const totalPages = Math.max(1, Math.ceil((totalWidth + 12 - 26) / (visibleWidth - 13)));
    const currentPage = Math.min(
      totalPages,
      Math.max(1, Math.floor((currentScroll + 10) / (visibleWidth - 13)) + 1),
    );
    setPageInfo({ current: currentPage, total: totalPages });
  }, [viewMode]);

  const calculateGalleryWrapperWidths = useCallback(() => {
    widthsPassRef.current = 0;
    const container = galleriesRef.current;
    if (!container || viewMode !== 'horizontal') return;

    const wrappers = container.querySelectorAll<HTMLElement>(`.${styles.galleryWrapper}`);
    wrappers.forEach((wrapper) => {
      wrapper.style.width = '';
    });

    requestAnimationFrame(() => {
      wrappers.forEach((wrapper) => {
        const gallery = wrapper.querySelector<HTMLElement>(`.${styles.gallery}`);
        if (!gallery) return;
        const visibleWidth = document.body.clientWidth;
        const galleryWidth = gallery.scrollWidth;
        const totalPages = Math.max(1, Math.ceil((galleryWidth + 12) / (visibleWidth - 13)));
        wrapper.style.width = `${visibleWidth - 26 + (totalPages - 1) * (visibleWidth - 13)}px`;
      });
      updatePageIndicator();
    });
  }, [viewMode, updatePageIndicator]);

  /**
   * Every embedded table reports its measured size, and each report used to run the width pass
   * above: with ~60 tables on a level that is hundreds of full-page reflows while the level loads.
   * Coalesce them into one pass per idle moment instead.
   */
  const scheduleGalleryWidths = useCallback(() => {
    if (widthsPassRef.current) return;
    widthsPassRef.current = window.setTimeout(calculateGalleryWrapperWidths, 120);
  }, [calculateGalleryWrapperWidths]);

  useEffect(() => () => window.clearTimeout(widthsPassRef.current), []);

  useEffect(() => {
    if (viewMode !== 'horizontal') {
      const wrappers = galleriesRef.current?.querySelectorAll<HTMLElement>(`.${styles.galleryWrapper}`);
      wrappers?.forEach((w) => {
        w.style.width = '';
      });
      return;
    }
    const t = window.setTimeout(calculateGalleryWrapperWidths, 80);
    return () => window.clearTimeout(t);
  }, [viewMode, selectedLevel, colsNum, useMobileImages, visibleGroups, calculateGalleryWrapperWidths]);

  useEffect(() => {
    if (viewMode !== 'horizontal') return;
    const container = galleriesRef.current;
    if (!container) return;

    let isScrolling = false;
    let scrollTimeout: number | undefined;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isScrolling) return;
      isScrolling = true;
      const visibleWidth = document.body.clientWidth - 13;
      const delta = e.deltaY || e.deltaX;
      container.scrollTo({
        left: container.scrollLeft + (delta > 0 ? visibleWidth : -visibleWidth),
      });
      window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        isScrolling = false;
        updatePageIndicator();
      }, 1);
    };

    const onResize = () => {
      window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(calculateGalleryWrapperWidths, 100);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('scroll', updatePageIndicator);
    window.addEventListener('resize', onResize);
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('scroll', updatePageIndicator);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(scrollTimeout);
    };
  }, [viewMode, selectedLevel, calculateGalleryWrapperWidths, updatePageIndicator]);

  useEffect(() => {
    if (viewMode !== 'horizontal') return;

    const htmlOverflowY = document.documentElement.style.overflowY;
    const bodyOverflowY = document.body.style.overflowY;
    document.documentElement.style.overflowY = 'hidden';
    document.body.style.overflowY = 'hidden';

    return () => {
      document.documentElement.style.overflowY = htmlOverflowY;
      document.body.style.overflowY = bodyOverflowY;
    };
  }, [viewMode]);

  useEffect(() => {
    if (!modalData && !hintModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalData(null);
        setHintModal(null);
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [modalData, hintModal]);

  const openImage = (item: GrammarTableItem) => {
    tourModalId.current = null;
    const displaySrc = resolveImageSrc(item, useMobileImages);
    setModalData({
      ...item,
      displaySrc,
      displayWidth: useMobileImages && item.widthMob != null ? item.widthMob : item.width,
      displayHeight: useMobileImages && item.heightMob != null ? item.heightMob : item.height,
    });
  };

  const openHint = (payload: string) => {
    if (!payload) return;
    const isSuper = payload.startsWith('super-');
    const cleanId = payload.replace(/^super-/, '');
    const uk = language === 'lv' && locale === 'uk' ? 'uk/' : '';
    setHintModal({
      id: cleanId,
      hintPath: isSuper
        ? `/grammar/hints-super-tables/${uk}${cleanId}.html`
        : `/grammar/hints/${uk}${cleanId}.html`,
    });
  };

  const localizedMeta = (image: GrammarTableItem) => {
    const keys = TABLE_TITLE_KEYS[String(image.id)];
    if (!keys) return { title: image.title, alt: image.alt };
    return {
      title: keys.title ? t(keys.title) : image.title,
      alt: keys.alt ? t(keys.alt) : image.alt,
    };
  };

  useEffect(() => {
    const preview = (event: Event) => {
      const detail = (event as CustomEvent<{ open: boolean; tableId?: string; synchronous?: boolean }>).detail;
      if (!detail?.open) {
        if (tourModalId.current !== null) {
          tourModalId.current = null;
          if (detail?.synchronous) flushSync(() => setModalData(null)); else setModalData(null);
        }
        return;
      }
      if (modalData || hintModal) return;
      const item = Object.values(catalogData).flat().find(item => String(item.id) === detail.tableId);
      if (!item) return;
      tourModalId.current = String(item.id);
      flushSync(() => setModalData({ ...item, displaySrc: resolveImageSrc(item, useMobileImages) }));
    };
    window.addEventListener('grammar.tour.preview', preview);
    return () => window.removeEventListener('grammar.tour.preview', preview);
  }, [catalogData, modalData, hintModal, useMobileImages]);

  const scrollPage = (dir: -1 | 1) => {
    const container = galleriesRef.current;
    if (!container) return;
    const visibleWidth = document.body.clientWidth - 13;
    container.scrollTo({ left: container.scrollLeft + dir * visibleWidth });
    window.setTimeout(updatePageIndicator, 20);
  };

  const renderCard = (image: GrammarTableItem, order: number) => {
    const isSuper = String(image.id).startsWith('super-');
    const TableComponent = shouldRenderComponent(image)
      ? componentForItem(image)
      : null;
    const src = resolveImageSrc(image, useMobileImages);
    const width = useMobileImages && image.widthMob != null ? image.widthMob : image.width;
    const height = useMobileImages && image.heightMob != null ? image.heightMob : image.height;
    const levelClass = getLevelClass(image.level);
    const meta = localizedMeta(image);
    const badgeClass = isSuper
      ? `${styles.levelBadge} ${styles.badgeSuper} ${BADGE_CLASS[levelClass] ?? ''}`
      : `${styles.levelBadge} ${BADGE_CLASS[levelClass] ?? ''}`;

    return (
      <div
        key={String(image.id)}
        id={`table-${image.id}`}
        className={styles.tableImg}
        data-grammar-practice-host=""
        data-grammar-tour="card"
        data-table-key={image.componentKey}
        data-id={image.id}
        data-level={image.level}
        onClick={() => openImage(image)}
      >
        <GrammarTablePractice tableKey={image.componentKey} learnLang={language}
          topics={grammarTopics.data?.data.filter(topic => topic.table_keys.includes(image.componentKey ?? '')) ?? []}
          anonymous={!user} loading={Boolean(user) && grammarTopics.isPending} error={grammarTopics.isError} onRetry={() => void grammarTopics.refetch()} onLayout={scheduleGalleryWidths}>
        {isAdmin && <div className={styles.adminTableId}>ID: {image.id}</div>}
        {TableComponent ? (
          <LazyTableBody
            cacheKey={`${image.id}|${colsNum}|${viewMode}`}
            scrollRootRef={viewMode === 'horizontal' ? galleriesRef : nullRootRef}
            mode={warmed ? 'auto' : order < mountBudget ? 'mount' : 'placeholder'}
            forceMount={revealedKeys.includes(String(image.componentKey))}
            fallbackHeight={estimateCardHeight(image)}
          >
            <ScaledTableEmbed
              designWidth={image.widthMob ?? image.width ?? 1536}
              initialHeight={getCardHeight(`${image.id}|${colsNum}|${viewMode}`)}
              fontScalePercent={image.fontScalePercent}
              className={`${styles.componentPreview} grammar-component-tables-page grammar-component-table-embed`}
              data-grammar-table-id={image.id}
              data-grammar-table-key={ownsTableRoot ? undefined : image.componentKey}
              aria-label={meta.alt || meta.title || t('tableAlt', { id: image.id })}
              onMetricsChange={scheduleGalleryWidths}
            >
              <TableComponent />
            </ScaledTableEmbed>
          </LazyTableBody>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={meta.alt || meta.title || t('tableAlt', { id: image.id })}
              width={width}
              height={height}
              loading="lazy"
              decoding="async"
            />
          </>
        )}
        <span className={badgeClass}>
          {isSuper
            ? image.description || 'SUPER'
            : image.b2Tier === 'review'
              ? image.b2BadgeLabel ?? 'B2 необязательные!'
              : getLevelLabel(image.level, image.description)}
        </span>
        {isAdmin && image.componentKey && image.src && (
          <button
            type="button"
            className={styles.tableModeToggle}
            title={TableComponent ? 'Показать картинку' : 'Показать HTML-компонент'}
            onClick={(e) => {
              e.stopPropagation();
              toggleTableMode(image);
            }}
          >
            {TableComponent ? 'HTML' : 'IMG'}
          </button>
        )}
        <button
          type="button"
          className={styles.hintIcon}
          data-grammar-tour="hint"
          title={t('showHint', { id: image.hintId ?? image.id })}
          onClick={(e) => {
            e.stopPropagation();
            openHint(hintPayloadFromItem(image));
          }}
        >
          ?
        </button>
        </GrammarTablePractice>
      </div>
    );
  };

  /**
   * Height a card is expected to take before it has ever been measured, from its screenshot's
   * aspect ratio: the picture is the same table, so it is close enough to keep the warm-up layout
   * from jumping around. Once mounted, the real measurement replaces it.
   */
  const estimateCardHeight = (image: GrammarTableItem) => {
    const cached = getCardHeight(`${image.id}|${colsNum}|${viewMode}`);
    if (cached) return cached;
    const vw = typeof document !== 'undefined' ? document.body.clientWidth : 1280;
    const cardWidth = Math.max(160, (vw - 25) / colsNum - 12);
    const aspect = image.height && image.width ? image.height / image.width : 0.6;
    return Math.round(cardWidth * aspect);
  };

  const renderGroup = (tables: GrammarTableItem[], key: string, startOrder: number) => {
    if (!tables.length) return null;
    return (
      <div className={styles.galleryWrapper} key={key}>
        <div
          className={styles.gallery}
          data-cols={colsNum}
          style={{ '--cols': colsNum } as CSSProperties}
        >
          {tables.map((image, i) => renderCard(image, startOrder + i))}
        </div>
      </div>
    );
  };

  const onBackdrop = (setter: (v: null) => void) => (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setter(null);
  };

  return (
    <div
      id="grammar-tables-gallery-root"
      className={`${styles.root} ${viewMode === 'horizontal' ? styles.viewHorizontal : styles.viewVertical} ${presentationTableIds?.length ? styles.tutorPresentation : ''}`}
    >
      <GrammarTablesMenuPortal
        language={language}
        selectedLevel={selectedLevel}
        onLevelChange={setSelectedLevel}
        cols={colsNum}
        onColsChange={(n) => setCols(String(n))}
        viewMode={viewMode}
        onViewModeToggle={() =>
          setViewMode(viewMode === 'horizontal' ? 'vertical' : 'horizontal')
        }
      />
      <div className={styles.galleryHeading}><span>{language === 'en' ? 'Английская грамматика' : 'Латышская грамматика'}</span>{matchesQuery && <input type="search" aria-label="Поиск по таблицам" placeholder="Найти таблицу…" value={query} onChange={event => setQuery(event.target.value)} />}<GrammarOverviewButton language={language} /><GrammarTour key={language} isAuthenticated={Boolean(user)} /></div>
      {isAdmin && componentTablesCount > 0 && Object.values(catalogData).flat().some(item => item.src && item.componentKey) && (
        <div className={styles.componentAdminPanel}>
          <span>Компонентные таблицы: {componentTablesCount}</span>
          <button
            type="button"
            className={componentMode === 'components' ? styles.adminModeActive : ''}
            onClick={() => setAllComponentMode('components')}
          >
            Все HTML
          </button>
          <button
            type="button"
            className={componentMode === 'images' ? styles.adminModeActive : ''}
            onClick={() => setAllComponentMode('images')}
          >
            Все картинки
          </button>
          <button
            type="button"
            className={componentMode === 'mixed' ? styles.adminModeActive : ''}
            onClick={() => setAllComponentMode('mixed')}
          >
            По карточкам
          </button>
        </div>
      )}

      <div
        ref={galleriesRef}
        className={`${styles.galleries} ${viewMode === 'horizontal' ? styles.horizontalMode : ''}`}
      >
        {hasAny ? (
          <>
            {renderGroup(visibleGroups.group1, 'g1', 0)}
            {renderGroup(visibleGroups.group2, 'g2', visibleGroups.group1.length)}
            {renderGroup(visibleGroups.group3, 'g3', visibleGroups.group1.length + visibleGroups.group2.length)}
          </>
        ) : (
          <p className={styles.empty}>{t('empty')}</p>
        )}
      </div>

      {viewMode === 'horizontal' && hasAny && (
        <div className={styles.pageIndicator}>
          <button
            type="button"
            className={styles.pageNavBtn}
            aria-label={t('prevPage')}
            onClick={() => scrollPage(-1)}
          >
            ←
          </button>
          <span>
            {pageInfo.current} / {pageInfo.total}
          </span>
          <button
            type="button"
            className={styles.pageNavBtn}
            aria-label={t('nextPage')}
            onClick={() => scrollPage(1)}
          >
            →
          </button>
        </div>
      )}

      {/* Portaled to <body>: inside the app shell (a z-index:1 stacking context) the sticky header would stay above the overlay. */}
      {modalData && typeof document !== 'undefined' && createPortal((() => {
        const ModalComponent = shouldRenderComponent(modalData)
          ? componentForItem(modalData)
          : null;
        return (
        <div className={styles.modalOverlay} onClick={onBackdrop(setModalData)}>
          <div className={styles.modalContent} data-grammar-tour="enlarged" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              aria-label={t('close')}
              onClick={() => setModalData(null)}
            >
              ×
            </button>
            {modalData.level && (
              <span
                className={`${styles.modalLevel} ${BADGE_CLASS[getLevelClass(modalData.level)] ?? ''}`}
              >
                {modalData.b2Tier === 'review' ? (modalData.b2BadgeLabel ?? 'B2 необязательные!') : getLevelLabel(modalData.level, modalData.description)}
              </span>
            )}
            {ModalComponent ? (
              <div className={styles.modalComponentFrame}>
                <GrammarTablePractice tableKey={modalData.componentKey} learnLang={language} fillHeight
                  topics={grammarTopics.data?.data.filter(topic => topic.table_keys.includes(modalData.componentKey ?? '')) ?? []}
                  anonymous={!user} loading={Boolean(user) && grammarTopics.isPending} error={grammarTopics.isError} onRetry={() => void grammarTopics.refetch()}>
                <ScaledTableEmbed
                  fitMode="contain"
                  fontScalePercent={modalData.fontScalePercent}
                  className={`${styles.modalComponent} grammar-component-tables-page grammar-component-table-embed grammar-component-table-embed--modal`}
                >
                  <ModalComponent />
                </ScaledTableEmbed>
                </GrammarTablePractice>
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={modalData.displaySrc}
                  alt={localizedMeta(modalData).alt || t('grammarTableAlt')}
                  className={styles.modalImage}
                />
              </>
            )}
            {(modalData.description || modalData.title) && (
              <div className={styles.modalCaption}>
                {localizedMeta(modalData).title || modalData.description}
              </div>
            )}
          </div>
        </div>
        );
      })(), document.body)}

      {hintModal && typeof document !== 'undefined' && createPortal(
        <div className={styles.hintModal} onClick={onBackdrop(setHintModal)}>
          <div className={styles.hintContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.hintClose}
              aria-label={t('closeHint')}
              onClick={() => setHintModal(null)}
            >
              ×
            </button>
            <iframe
              src={hintModal.hintPath}
              title={t('hintTitle', { id: hintModal.id })}
              className={styles.hintFrame}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default GrammarTablesGallery;
