'use client';

import { useId, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { COURSE_LEVEL_IDS, getCourseLevelProgress } from '@/features/course/course-level-progress';
import { languageLevelLabel } from '@/features/home/useful-links';
import { PreviewSwitcher } from './PreviewSwitcher';
import { PreviewResources } from './PreviewResources';
import { GlassCardArt, LEVEL_MATERIALS } from './GlassCardArt';
import type { GlassHomeDesign, HomePreviewData } from './types';
import styles from './glass-home-preview.module.css';

const LEVEL_NAMES = {
  ru: ['Первые разговоры', 'Повседневная жизнь', 'Уверенное общение', 'Свобода выражения'],
  uk: ['Перші розмови', 'Повсякденне життя', 'Впевнене спілкування', 'Свобода висловлювання'],
};
const LEVEL_PICTURES = [1763, 1766, 1765, 1774];
const GlassHoverIllustration = dynamic(() => import('./GlassHoverIllustration'));
const TOOLS = [
  { href: '/grammar', icon: 'pi-table', ru: 'Разобраться в правилах', uk: 'Розібратися в правилах', subRu: 'Грамматика с примерами', subUk: 'Граматика з прикладами' },
  { href: '/tutor', icon: 'pi-comments', ru: 'Просто поговорить', uk: 'Просто поговорити', subRu: 'Разговор с репетитором', subUk: 'Розмова з репетитором' },
  { href: '/exams', icon: 'pi-graduation-cap', ru: 'Проверить себя', uk: 'Перевірити себе', subRu: 'Экзамены от A1 до B2', subUk: 'Іспити від A1 до B2' },
];

export default function GlassHomePreview({ design, data }: { design: GlassHomeDesign; data: HomePreviewData }) {
  const uk = useLocale() === 'uk';
  const t = (ru: string, ua: string) => uk ? ua : ru;
  const rounded = design === 'glass-mosaic-rounded';
  const animated = design === 'glass-mosaic-animated' || rounded;
  const illustrated = design === 'glass-mosaic-illustrated' || animated;
  const night = design === 'glass-nocturne', mosaic = design === 'glass-mosaic' || illustrated;
  const controlId = useId();
  const [blur, setBlur] = useState(18);
  const [opacity, setOpacity] = useState(night ? 52 : 60);
  const [temperature, setTemperature] = useState(night ? -35 : mosaic ? 0 : 30);
  const [selected, setSelected] = useState(data.levels.find(level => level.status === 'active')?.id ?? 'A1');
  const level = data.levels.find(item => item.id === selected);
  const { percent } = getCourseLevelProgress(level);
  const names = LEVEL_NAMES[uk ? 'uk' : 'ru'];
  const index = Math.max(0, COURSE_LEVEL_IDS.findIndex(id => id === selected));
  const bestExam = data.exams.find(exam => exam.level === selected)?.best_score;
  const appearance = {
    '--glass-blur': `${blur}px`, '--glass-alpha': opacity / 100,
    '--warm-strength': .62 + temperature / 220, '--cool-strength': .62 - temperature / 220,
  } as CSSProperties;

  function progressPanel() {
    return <section className={`${styles.glass} ${styles.progressPanel}`} aria-label={t('Твой курс', 'Твій курс')}>
      <div className={styles.panelTop}><span className={styles.kicker}>{t('ТВОЙ МАРШРУТ', 'ТВІЙ МАРШРУТ')}</span><span className={styles.panelSerial} aria-hidden="true">LV / 0{index + 1}<i className="pi pi-compass" /></span></div>
      <div className={styles.levelTabs} role="group" aria-label={t('Уровень языка', 'Рівень мови')}>
        {COURSE_LEVEL_IDS.map(id => <button type="button" key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>{id}</button>)}
      </div>
      <div className={styles.progressHeading}><div><h2>{names[index]}</h2><p>{level ? `${level.completed} / ${level.total} ${t('категорий пройдено', 'категорій пройдено')}` : t('Прогресс пока недоступен', 'Прогрес поки недоступний')}</p></div><div className={styles.progressMedallion} style={{ '--progress-sweep': `${percent * 3.6}deg` } as CSSProperties}><strong>{level ? `${percent}%` : '—'}</strong></div></div>
      <progress max={100} value={percent} aria-label={`${selected}: ${percent}%`} />
      <Link href={`/course?level=${selected}`} className={styles.primary}>{t('Открыть курс', 'Відкрити курс')} {selected}<i className="pi pi-arrow-up-right" aria-hidden="true" /></Link>
    </section>;
  }

  function wordCard() {
    return <div className={`${styles.glass} ${styles.wordCard}`} lang="lv"><span className={styles.wordEdition} aria-hidden="true"><span>LV / 001</span><span>ā ē ī ū</span></span><span className={styles.kicker}>MAZI SOĻI. LIELS CEĻŠ.</span><strong>Labdien<span>!</span></strong><div><span lang={uk ? 'uk' : 'ru'}>{t('Добрый день', 'Добрий день')}</span><span className={styles.languagePair}>LV → {uk ? 'UK' : 'RU'}</span></div><span className={styles.wordRegistration} aria-hidden="true">+ ─────────── +</span></div>;
  }

  return <div className={styles.root} data-glass-design={illustrated ? 'glass-mosaic' : design} data-rounded={rounded || undefined} style={appearance}>
    <div className={styles.atmosphere} aria-hidden="true"><span className={styles.warmLight} /><span className={styles.coolLight} /><span className={styles.glassRibbon} /><span className={styles.glassRibbonSecond} /></div>
    <div className={styles.previewNav}><PreviewSwitcher design={design} /></div>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><span className={styles.brandMark}><Image src="/brand/lbp-bridge-300.png" alt="" width={112} height={36} /></span><span className={styles.brandName}>LangBridge<small>PATHWAYS</small></span></Link>
      <nav aria-label={t('Основная навигация', 'Основна навігація')}><Link href="/course">{t('Курс', 'Курс')}</Link><Link href="/grammar">{t('Грамматика', 'Граматика')}</Link><Link href="/exams">{t('Экзамены', 'Іспити')}</Link></nav>
      <Link href="/dashboard" className={styles.account}><span>LV</span><i className="pi pi-user" aria-hidden="true" /><span className={styles.srOnly}>{t('Аккаунт', 'Акаунт')}</span></Link>
    </header>
    <main className={styles.main}>
      <div className={styles.designTools}>
        <span><span className={styles.statusDot} />{night ? '02 / NOCTURNE' : mosaic ? '03 / VITRAIL' : '01 / DAYBREAK'}</span>
        <details className={styles.materialControls}><summary><i className="pi pi-sliders-h" aria-hidden="true" />{t('Настроить стекло', 'Налаштувати скло')}</summary><div className={styles.controlPanel}>
          <label htmlFor={`${controlId}-blur`}>{t('Размытие', 'Розмиття')}<output>{blur} px</output><input id={`${controlId}-blur`} type="range" min="0" max="28" value={blur} onChange={e => setBlur(Number(e.target.value))} /></label>
          <label htmlFor={`${controlId}-opacity`}>{t('Плотность стекла', 'Щільність скла')}<output>{opacity}%</output><input id={`${controlId}-opacity`} type="range" min="25" max="90" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>
          <label htmlFor={`${controlId}-temperature`}>{t('Холод ↔ тепло', 'Холод ↔ тепло')}<output>{temperature > 0 ? '+' : ''}{temperature}</output><input id={`${controlId}-temperature`} type="range" min="-100" max="100" value={temperature} onChange={e => setTemperature(Number(e.target.value))} /></label>
          <button type="button" onClick={() => { setBlur(18); setOpacity(night ? 52 : 60); setTemperature(night ? -35 : mosaic ? 0 : 30); }}>{t('Сбросить', 'Скинути')}</button>
        </div></details>
      </div>
      {data.errors.length > 0 && <div className={styles.error} role="alert">{t('Не все данные удалось загрузить.', 'Не всі дані вдалося завантажити.')} <Link href={`/home-previews/${design}`}>{t('Повторить', 'Повторити')}</Link></div>}
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>LATVIEŠU VALODA · A1—B2</span>
          <h1>{night ? <>{t('Тише город.', 'Тихіше місто.')}<br /><em>{t('Ближе язык.', 'Ближче мова.')}</em></> : mosaic ? <>{t('Сложи свой', 'Збери свою')}<br /><em>{t('латышский.', 'латиську.')}</em></> : <>{t('Новый язык.', 'Нова мова.')}<br /><em>{t('Больше жизни.', 'Більше життя.')}</em></>}</h1>
          <p>{night ? t('Немного практики — и незнакомые слова становятся твоими.', 'Трохи практики — і незнайомі слова стають твоїми.') : t('От первого «labdien» до разговора, который хочется продолжить.', 'Від першого «labdien» до розмови, яку хочеться продовжити.')}</p>
          {!night && !mosaic && <Link className={styles.textLink} href={`/course?level=${selected}`}>{t('Найти свой ритм', 'Знайти свій ритм')}<i className="pi pi-arrow-right" aria-hidden="true" /></Link>}
        </div>
        {night ? <div className={styles.nightScene}>
          <Image src="/course/effects/blackheads-night-riga-v4-1920.jpg" alt={t('Вечерняя Рига и отражения огней на площади', 'Вечірня Рига та відбиття вогнів на площі')} fill sizes="(max-width: 700px) 100vw, 1200px" preload />
          <span className={styles.photoCaption}>RĪGA / PĒC SAULRIETA</span>
          <div className={styles.nightPanels}>{progressPanel()}{wordCard()}</div>
        </div> : mosaic ? <div className={styles.mosaicStack}>
          <div className={styles.letterSlab} aria-hidden="true">LV<span>ā · ē · ī · ū</span></div>{progressPanel()}{wordCard()}
        </div> : <div className={styles.dayScene}>
          <div className={styles.cityPostcard}><Image src="/home-previews/riga-miniature.webp" alt={t('Иллюстрация Риги с трамваем и старым городом', 'Ілюстрація Риги з трамваєм і старим містом')} fill sizes="(max-width: 700px) 100vw, 650px" preload /><div className={styles.postcardCaption}><span>Rīga, Latvija</span><i className="pi pi-arrow-up-right" aria-hidden="true" /></div></div>
          {wordCard()}<span className={styles.floatingTag}>sveiki <span>→</span> {t('привет', 'привіт')}</span>
        </div>}
      </section>

      <section className={`${styles.glass} ${styles.courseSection}`}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>01 / {t('ОБУЧЕНИЕ', 'НАВЧАННЯ')}</span><h2>{t('Твой путь, шаг за шагом', 'Твій шлях, крок за кроком')}</h2></div><Link href="/course">{t('Весь курс', 'Увесь курс')} <i className="pi pi-arrow-up-right" aria-hidden="true" /></Link></div>
        <div className={styles.courseGrid}>{COURSE_LEVEL_IDS.map((id, i) => {
          const item = data.levels.find(l => l.id === id), progress = getCourseLevelProgress(item);
          return <Link href={`/course?level=${id}`} key={id} className={`${styles.levelTile}${illustrated ? ` ${styles.pictureTile}` : ''}${animated ? ` ${styles.animatedTile}` : ''}`} data-material={LEVEL_MATERIALS[i]} data-current={item?.status === 'active'}>
            <div className={styles.tileEdition}><span aria-hidden="true">LV · 0{i + 1}</span><span>{item?.status === 'active' ? t('Сейчас', 'Зараз') : item?.status === 'completed' ? t('Пройден', 'Пройдено') : 'LATVIEŠU'}</span></div>
            <div className={styles.tileTop}><strong>{id}</strong><span>{item ? `${progress.percent}%` : '—'}</span></div><h3>{names[i]}</h3>
            {illustrated ? <span className={styles.pictureArt} aria-hidden="true"><span className={styles.pictureFrame} /><span className={styles.picturePlinth} />{animated ? <GlassHoverIllustration index={i} className={styles.pictureFigure} /> : <Image src={`/course/categories/transparent/${LEVEL_PICTURES[i]}-${i === 2 ? 'dark' : 'light'}.webp`} alt="" width={180} height={180} sizes="(max-width: 360px) 105px, (max-width: 700px) 135px, 180px" className={styles.pictureFigure} />}</span> : <span className={styles.cardArt}><GlassCardArt material={LEVEL_MATERIALS[i]} /></span>}
            <progress max={100} value={progress.percent} aria-label={`${id}: ${progress.percent}%`} /><div className={styles.tileBottom}><span>{item ? `${item.completed} / ${item.total} ${t('категорий', 'категорій')}` : t('Нет данных', 'Немає даних')}</span><i className={`pi ${item?.status === 'completed' ? 'pi-check' : 'pi-arrow-up-right'}`} aria-hidden="true" /></div>
          </Link>;
        })}</div>
      </section>

      <div className={styles.learningGrid}>
        <section className={styles.practiceSection}><div className={styles.sectionHead}><div><span className={styles.kicker}>02 / {t('ПРАКТИКА', 'ПРАКТИКА')}</span><h2>{t('На сегодня', 'На сьогодні')}</h2></div></div>
          <div className={styles.practiceList}>{TOOLS.map((tool, i) => <Link href={tool.href} key={tool.href} className={styles.practiceItem} data-tool={i}>
            <span className={styles.toolNumber}>0{i + 1}</span><span className={styles.toolText}><strong>{uk ? tool.uk : tool.ru}</strong><small>{uk ? tool.subUk : tool.subRu}</small></span>
            <span className={styles.toolIllustration} aria-hidden="true">{i === 0 ? <span className={styles.grammarGlyph}>ā<span>→ a</span></span> : i === 1 ? <span className={styles.chatGlyph}><span>Sveiki!</span><span>•••</span></span> : <span className={styles.examGlyph}><i className="pi pi-check" /><span>LV</span></span>}</span>
            <i className={`pi ${tool.icon} ${styles.toolCorner}`} aria-hidden="true" />
          </Link>)}</div>
          <div className={`${styles.glass} ${styles.examNote}`}><span className={styles.examStamp}>{selected}</span><div><span className={styles.kicker}>{t('ИТОГОВЫЙ ЭКЗАМЕН', 'ПІДСУМКОВИЙ ІСПИТ')}</span><p>{bestExam != null ? `${t('Лучший результат', 'Найкращий результат')}: ${Math.round(bestExam)}%` : t('Готов, когда готов ты.', 'Готовий, коли готовий ти.')}</p></div><Link href={`/exams?level=${selected}`} aria-label={`${t('Открыть экзамен', 'Відкрити іспит')} ${selected}`}><i className="pi pi-arrow-up-right" aria-hidden="true" /></Link></div>
        </section>
        <section className={`${styles.glass} ${styles.dictionarySection}`} id="dictionaries"><div className={styles.sectionHead}><div><span className={styles.kicker}>03 / {t('СЛОВАРИ', 'СЛОВНИКИ')}</span><h2>{t('Слова для твоего мира', 'Слова для твого світу')}</h2></div><i className="pi pi-book" aria-hidden="true" /></div>
          <div className={styles.dictionaryList}>{data.dictionaries.map((dictionary, i) => <Link href={`/dictionaries/${dictionary.id}`} key={dictionary.id} className={styles.dictionaryBook} data-cover={i % 2}>
            <span className={styles.bookSpine} aria-hidden="true">LANGBRIDGE / LV</span><span className={styles.bookEdition} aria-hidden="true">LEXICON · 0{i + 1}</span>
            <span className={styles.dictionaryMonogram} aria-hidden="true">Aa<span>ā ē ī ū</span></span><span className={styles.bookTitle}><strong>{dictionary.name}</strong><small>{languageLevelLabel(dictionary.level)}{dictionary.max_level !== dictionary.level ? `—${languageLevelLabel(dictionary.max_level)}` : ''}</small></span>
            <span className={styles.bookBottom}><span className={styles.words}>{dictionary.words.toLocaleString(uk ? 'uk-UA' : 'ru-RU')}<small>{t('слов', 'слів')}</small></span><i className="pi pi-arrow-up-right" aria-hidden="true" /></span>
            {dictionary.sound && <span className={styles.bookAudio} aria-label={t('С озвучкой', 'З озвученням')}><i className="pi pi-volume-up" aria-hidden="true" /></span>}
          </Link>)}</div>
          {!data.dictionaries.length && <p>{t('Словари не загружены.', 'Словники не завантажені.')}</p>}
        </section>
      </div>
      <div className={`${styles.glass} ${styles.resources}`}><PreviewResources dark={night} /></div>
    </main>
    <footer className={styles.footer}><Link href="/">LangBridge Pathways</Link><span>LATVIEŠU VALODA · {t('В своём ритме', 'У своєму ритмі')}</span><Link href="/admin-tools">{t('Карта страниц', 'Карта сторінок')} ↗</Link></footer>
  </div>;
}
