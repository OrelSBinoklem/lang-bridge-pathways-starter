'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { ThemeToggle } from '@/components/theme-toggle';
import { filterCategoryGroups } from './model';
import { CATEGORY_DESIGNS, DESIGN_TITLES, type VisualCategoryDesign, type CategoryPreviewContent } from './types';
import { MasteryMark } from './MasteryMark';
import styles from './category-preview.module.css';

const GlassShelves = dynamic(() => import('./GlassShelves').then(module => module.GlassShelves));
const PaperCatalog = dynamic(() => import('./PaperCatalog').then(module => module.PaperCatalog));
const EditorialAtlas = dynamic(() => import('./EditorialAtlas').then(module => module.EditorialAtlas));
const ProductVitrines = dynamic(() => import('./ProductVitrines').then(module => module.ProductVitrines));
const ColorRibbons = dynamic(() => import('./ColorRibbons').then(module => module.ColorRibbons));
const DiamondLab = dynamic(() => import('./DiamondLab').then(module => module.DiamondLab));
const LAYOUTS = { 'glass-shelves': GlassShelves, 'paper-catalog': PaperCatalog, 'editorial-atlas': EditorialAtlas, 'product-vitrines': ProductVitrines, 'color-ribbons': ColorRibbons, 'glass-mastery': GlassShelves, 'paper-mastery': PaperCatalog, 'vitrines-mastery': ProductVitrines, 'diamond-lab': DiamondLab };
const subscribeHydration = () => () => {};
const readHydrated = () => true;
const readServerHydrated = () => false;

export function CategoryPreview({ design, data, initialSearch = '', initialLevel = '', primary = false, loadingProgress = false }: {
  design: VisualCategoryDesign; data: CategoryPreviewContent; initialSearch?: string; initialLevel?: string; primary?: boolean; loadingProgress?: boolean;
}) {
  const locale = useLocale();
  const uk = locale === 'uk';
  const { resolvedTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribeHydration, readHydrated, readServerHydrated);
  const [search, setSearch] = useState(initialSearch);
  const [level, setLevel] = useState(initialLevel);
  const t = (ru: string, ua: string) => uk ? ua : ru;
  const groups = useMemo(() => {
    const themed = (art: string | null) => hydrated && resolvedTheme === 'dark' ? art?.replace(/-light\.webp$/, '-dark.webp') ?? null : art;
    return data.groups.map(group => ({ ...group, art: themed(group.art), items: group.items.map(item => ({ ...item, art: themed(item.art) })) }));
  }, [data.groups, resolvedTheme, hydrated]);
  const visible = useMemo(() => filterCategoryGroups(groups, search, level), [groups, search, level]);
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  const visibleCount = visible.reduce((total, group) => total + group.items.length, 0);
  const info = DESIGN_TITLES[design];
  const Layout = LAYOUTS[design];
  const mastery = design.endsWith('-mastery') || design === 'diamond-lab';
  const base = design === 'glass-mastery' || design === 'diamond-lab' ? 'glass-shelves' : design === 'paper-mastery' ? 'paper-catalog' : design === 'vitrines-mastery' ? 'product-vitrines' : design;
  const query = new URLSearchParams();
  if (search) query.set('q', search);
  if (level) query.set('level', level);
  const suffix = query.size ? `?${query}` : '';

  return <section className={`${styles.page}${primary ? ` ${styles.primary}` : ''}`} data-category-design={design} data-category-base={base}>
    {!primary && <header className={styles.bar}>
      <Link href="/admin-tools" className={styles.brand}><span aria-hidden="true">LB<span> / </span></span>{t('Дизайн категорий', 'Дизайн категорій')}</Link>
      <nav className={styles.designs} aria-label={t('Варианты списка категорий', 'Варіанти списку категорій')}>
        {CATEGORY_DESIGNS.map((id, index) => <Link key={id} prefetch={false} href={`/dictionary-previews/${data.dictionary.id}/${id}${suffix}`} aria-current={id === design ? 'page' : undefined}>
          <span className={styles.designNumber}>{index === 0 ? '0' : String(index).padStart(2, '0')}</span><span>{DESIGN_TITLES[id][uk ? 'uk' : 'ru']}</span>
        </Link>)}
      </nav>
      <div className={styles.barActions}><ThemeToggle /><Link href={`/dictionaries/${data.dictionary.id}`} title={t('Основной список', 'Основний список')} aria-label={t('Основной список', 'Основний список')}><i className="pi pi-times" aria-hidden="true" /></Link></div>
    </header>}

    <div className={styles.container}>
      {primary || design === 'diamond-lab' ? <header className={styles.dictionaryHeader}>
        <Link href="/" className={styles.backLink} aria-label={t('Назад к словарям', 'Назад до словників')}><i className="pi pi-arrow-left" aria-hidden="true" /><span>{t('Назад', 'Назад')}</span></Link>
        <h1>{data.dictionary.name}</h1>
      </header> : <section className={styles.hero} aria-labelledby="category-preview-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{data.dictionary.name} <span> / </span> {data.dictionary.lang?.toUpperCase()} → {data.dictionary.learn_lang?.toUpperCase()}</p>
          <h1 id="category-preview-heading">{t('Мир в словах.', 'Світ у словах.')}</h1>
          <p className={styles.tagline}>{info[uk ? 'subtitleUk' : 'subtitle']}</p>
          <div className={styles.edition}><span>{String(CATEGORY_DESIGNS.indexOf(design)).padStart(2, '0')} / {String(CATEGORY_DESIGNS.length - 1).padStart(2, '0')}</span><strong>{info[uk ? 'uk' : 'ru']}</strong><span className={styles.editionRule} aria-hidden="true" /></div>
        </div>
        <div className={styles.overview}>
          <div className={styles.overviewTop}><span>{t('ТВОЙ СЛОВАРЬ', 'ТВІЙ СЛОВНИК')}</span><span>{data.dictionary.words.toLocaleString(uk ? 'uk-UA' : 'ru-RU')} {t('слов', 'слів')}</span></div>
          <div className={styles.levelOverview}>{groups.map(group => <button type="button" key={group.id} onClick={() => setLevel(level === group.level ? '' : group.level)} aria-pressed={level === group.level}>
            {group.art && <Image className={styles.levelPicture} src={group.art} alt="" width={100} height={100} unoptimized />}
            <strong>{group.level || group.title}</strong><span>{group.items.length} {t('тем', 'тем')}</span>
            {group.percent === null ? <span className={styles.unknownProgress}>—</span> : <span className={styles.overviewProgress} aria-label={`${group.percent}%`}><span style={{ width: `${group.percent}%` }} /></span>}
          </button>)}</div>
        </div>
      </section>}

      {!primary && <div className={styles.toolbar}>
        <div className={styles.searchBox}><i className="pi pi-search" aria-hidden="true" /><label className={styles.srOnly} htmlFor="category-search">{t('Поиск по категориям', 'Пошук за категоріями')}</label><input id="category-search" type="search" placeholder={t('Какую тему откроем?', 'Яку тему відкриємо?')} value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className={styles.levelFilters} role="group" aria-label={t('Уровень языка', 'Рівень мови')}>
          <button type="button" aria-pressed={!level} onClick={() => setLevel('')}>{t('Все', 'Усі')}</button>
          {groups.map(group => <button type="button" key={group.id} aria-pressed={level === group.level} onClick={() => setLevel(group.level)}>{group.level || group.title}</button>)}
        </div>
        <span className={styles.results} role="status" aria-live="polite">{visibleCount} / {count} {t('тем', 'тем')}</span>
      </div>}
      {loadingProgress && <p className={styles.warning} role="status">{t('Загрузка прогресса…', 'Завантаження прогресу…')}</p>}
      {!loadingProgress && !data.progressAvailable && <p className={styles.warning} role="status">{t('Не удалось загрузить прогресс. Категории доступны, проценты временно скрыты.', 'Не вдалося завантажити прогрес. Категорії доступні, відсотки тимчасово приховані.')}</p>}
      {mastery && !primary && design !== 'diamond-lab' && <aside className={styles.masteryLegend} aria-label={t('Ступени изучения категории', 'Ступені вивчення категорії')}>
        <div><strong>{t('Знания обретают цвет', 'Знання набувають кольору')}</strong><span>{t('Прогресс окрашивает всю карточку', 'Прогрес забарвлює всю картку')}</span></div>
        <ul>{[60, 80, 90, 100].map(value => <li key={value}><MasteryMark percent={value} uk={uk} /><span>{value === 100 ? '100%' : `${value}%+`}</span></li>)}</ul>
      </aside>}
      {visible.length ? <Layout groups={visible} uk={uk} mastery={mastery} /> : <div className={styles.empty}><i className="pi pi-search" aria-hidden="true" /><h2>{t('Такой темы пока не нашлось', 'Такої теми поки не знайдено')}</h2><p>{t('Попробуй другое слово или открой все уровни.', 'Спробуй інше слово або відкрий усі рівні.')}</p><button type="button" onClick={() => { setSearch(''); setLevel(''); }}>{t('Показать все категории', 'Показати всі категорії')}</button></div>}
      {!primary && <footer className={styles.footer}><Link href={`/dictionaries/${data.dictionary.id}`}>{t('Открыть основной список', 'Відкрити основний список')} <i className="pi pi-arrow-up-right" aria-hidden="true" /></Link><span>LangBridge Pathways <span aria-hidden="true"> / </span> {data.dictionary.learn_lang?.toUpperCase()}</span></footer>}
    </div>
  </section>;
}
