'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { COURSE_LEVEL_IDS, courseRankIcon, courseRankLabel, getCourseLevelProgress } from '@/features/course/course-level-progress';
import { languageLevelLabel } from '@/features/home/useful-links';
import { type HomeDesign, type HomePreviewData } from './types';
import { PreviewResources } from './PreviewResources';
import { PreviewSwitcher } from './PreviewSwitcher';
import { CourseContinue } from '@/features/course/CourseContinue';
import styles from './home-preview.module.css';

const CourseLandscape = dynamic(() => import('./CourseLandscape'), { ssr: false, loading: () => <div className={styles.sceneLoading} role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /></div> });
const HomeLanding = dynamic(() => import('@/features/home/HomeLanding'));
const GlassHomePreview = dynamic(() => import('./GlassHomePreview'));
const OriginalGlassHomePreview = dynamic(() => import('./OriginalGlassHomePreview'));
const KineticHomePreview = dynamic(() => import('./KineticHomePreview'));
const levelArt = [1763, 1766, 1765, 1774];
const tools = [
  { href: '#dictionaries', icon: 'pi-book', ru: 'Словарь', uk: 'Словник' },
  { href: '/grammar', icon: 'pi-table', ru: 'Грамматика', uk: 'Граматика' },
  { href: '/course', icon: 'pi-headphones', ru: 'Слушание и чтение', uk: 'Слухання та читання' },
  { href: '/tutor', icon: 'pi-comments', ru: 'Разговор с репетитором', uk: 'Розмова з репетитором' },
];

export function HomePreview({ design, data }: { design: HomeDesign; data: HomePreviewData }) {
  const uk = useLocale() === 'uk';
  const text = (ru: string, ua: string) => uk ? ua : ru;
  const [dark, setDark] = useState(design === 'signal');
  const [selected, setSelected] = useState(data.levels.find(level => level.status === 'active')?.id ?? 'A1');
  const [moving, setMoving] = useState(true);
  const [routeMode, setRouteMode] = useState<'course' | 'exam'>('course');
  const selectedIndex = Math.max(0, COURSE_LEVEL_IDS.findIndex(id => id === selected));
  const art = (id: number) => `/course/categories/transparent/${id}-${dark ? 'dark' : 'light'}.webp`;
  const level = data.levels.find(item => item.id === selected);
  const { percent, rank } = getCourseLevelProgress(level);
  const exam = data.exams.find(item => item.level === selected);
  const duration = exam && ['listening', 'reading', 'writing', 'speaking'].every(skill => exam.durations?.[skill] > 0)
    ? Math.round(Object.values(exam.durations).reduce((sum, seconds) => sum + seconds, 0) / 60) : null;
  const progressText = level ? `${level.completed} / ${level.total} ${text('категорий', 'категорій')}` : text('Прогресс недоступен', 'Прогрес недоступний');
  const levelNames = uk ? ['Перші розмови', 'Повсякденне життя', 'Впевнене спілкування', 'Свобода висловлювання'] : ['Первые разговоры', 'Повседневная жизнь', 'Уверенное общение', 'Свобода выражения'];

  function levelSelector() {
    return <div className={styles.levelSelector} role="group" aria-label={text('Уровень языка', 'Рівень мови')}>
      {COURSE_LEVEL_IDS.map(id => <button type="button" key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>{id}</button>)}
    </div>;
  }

  function courseLevels() {
    return <div className={styles.levelGrid}>{COURSE_LEVEL_IDS.map((id, index) => {
      const item = data.levels.find(value => value.id === id);
      const progress = getCourseLevelProgress(item);
      return <Link href={`/course?level=${id}`} className={styles.levelCard} key={id}>
        <div className={styles.levelCardTop}><span className={styles.levelId}>{id}</span><Image src={art(levelArt[index])} alt="" width={88} height={88} /></div>
        <h3>{levelNames[index]}</h3>
        <div className={styles.levelCardScore}><strong>{item ? `${progress.percent}%` : '—'}</strong>{progress.rank ? <span className={styles.rank} data-rank={progress.rank}><i className={`pi ${courseRankIcon(progress.rank)}`} aria-hidden="true" />{courseRankLabel(progress.rank, uk)}</span> : <i className="pi pi-arrow-up-right" aria-hidden="true" />}</div>
        <progress max={100} value={progress.percent} aria-label={`${id}: ${progress.percent}%`} />
        <small>{item ? `${item.completed} / ${item.total} ${text('категорий', 'категорій')}` : text('Нет данных', 'Немає даних')}</small>
      </Link>;
    })}</div>;
  }

  function dictionaryList() {
    return <section className={styles.section} id="dictionaries"><div className={styles.sectionTitle}><h2>{text('Словари', 'Словники')}</h2><Link href="/">{text('Все словари', 'Усі словники')}<i className="pi pi-arrow-right" aria-hidden="true" /></Link></div>
      <div className={styles.dictionaryList}>{data.dictionaries.map(dictionary => <Link href={`/dictionaries/${dictionary.id}`} key={dictionary.id}>
        <span className={styles.dictionaryIcon}><i className="pi pi-book" aria-hidden="true" /></span><span className={styles.dictionaryName}><strong>{dictionary.name}</strong><small>{languageLevelLabel(dictionary.level)}{dictionary.max_level !== dictionary.level && `–${languageLevelLabel(dictionary.max_level)}`}</small></span><span className={styles.wordCount}>{dictionary.words.toLocaleString(uk ? 'uk-UA' : 'ru-RU')}<small>{text('слов', 'слів')}</small></span>{dictionary.sound && <i className="pi pi-volume-up" aria-label={text('С озвучкой', 'З озвученням')} />}<i className="pi pi-arrow-up-right" aria-hidden="true" />
      </Link>)}</div>
      {!data.dictionaries.length && <p className={styles.muted}>{text('Словари не загружены.', 'Словники не завантажені.')}</p>}
    </section>;
  }

  function practiceTools() {
    return <section className={styles.section}><div className={styles.sectionTitle}><h2>{text('Практика', 'Практика')}</h2><span className={styles.muted}>Latviešu valoda</span></div>
      <div className={styles.tools}>{tools.map((tool, index) => <Link key={tool.href} href={tool.href}><span className={styles.toolIcon} data-tone={index}><i className={`pi ${tool.icon}`} aria-hidden="true" /></span><strong>{uk ? tool.uk : tool.ru}</strong><i className="pi pi-arrow-up-right" aria-hidden="true" /></Link>)}</div>
    </section>;
  }

  function examStrip() {
    return <section className={styles.examStrip}><i className="pi pi-graduation-cap" aria-hidden="true" /><div><h2>{text('Итоговый экзамен', 'Підсумковий іспит')}</h2><p>A1 · A2 · B1 · B2</p></div><Link href={`/exams?level=${selected}`} className={styles.button}>{text('К экзаменам', 'До іспитів')}<i className="pi pi-arrow-right" aria-hidden="true" /></Link></section>;
  }

  function courseRows() {
    return <div className={styles.courseRows}>{COURSE_LEVEL_IDS.map((id, index) => {
      const item = data.levels.find(value => value.id === id);
      const progress = getCourseLevelProgress(item);
      return <Link href={`/course?level=${id}`} key={id}>
        <span className={styles.rowLevel}>{id}</span><Image src={art(levelArt[index])} alt="" width={76} height={76} />
        <div className={styles.rowName}><h3>{levelNames[index]}</h3><small>{item ? `${item.completed} / ${item.total} ${text('категорий', 'категорій')}` : text('Нет данных', 'Немає даних')}</small></div>
        <div className={styles.rowProgress}><strong>{item ? `${progress.percent}%` : '—'}</strong><progress value={progress.percent} max={100} aria-label={`${id}: ${progress.percent}%`} /></div><i className="pi pi-arrow-up-right" aria-hidden="true" />
      </Link>;
    })}</div>;
  }

  if (design === 'glass-daybreak' || design === 'glass-nocturne' || design === 'glass-mosaic' || design === 'glass-mosaic-illustrated' || design === 'glass-mosaic-animated' || design === 'glass-mosaic-rounded') return <GlassHomePreview design={design} data={data} />;
  if (design === 'glass-daybreak-original' || design === 'glass-nocturne-original' || design === 'glass-mosaic-original') return <OriginalGlassHomePreview design={design} data={data} />;
  if (design === 'liquid-atlas' || design === 'prism-theatre' || design === 'chromatic-studio') return <KineticHomePreview key={design} design={design} data={data} />;
  if (design === 'unified') return <div className={styles.unifiedPreview}><PreviewSwitcher design={design} /><HomeLanding unified /></div>;

  return <div className={styles.root} data-design={design} data-dark={dark}>
    <PreviewSwitcher design={design} />
    <header className={styles.header}><Link href="/" className={styles.brand}><span className={styles.brandMark}><Image src="/brand/lbp-bridge-300.png" alt="" width={300} height={97} /></span><span>LangBridge<small>PATHWAYS</small></span></Link><nav aria-label={text('Основная навигация', 'Основна навігація')}><Link href="/course">{text('Курс', 'Курс')}</Link><Link href="/exams">{text('Экзамены', 'Іспити')}</Link><Link href="/grammar">{text('Грамматика', 'Граматика')}</Link></nav><div className={styles.headerTools}><span className={styles.language}>LV</span><button type="button" onClick={() => setDark(!dark)} aria-label={text('Сменить тему макета', 'Змінити тему макета')} title={text('Сменить тему макета', 'Змінити тему макета')}><i className={`pi ${dark ? 'pi-sun' : 'pi-moon'}`} aria-hidden="true" /></button><Link href="/dashboard" aria-label={text('Аккаунт', 'Акаунт')} title={text('Аккаунт', 'Акаунт')}><i className="pi pi-user" aria-hidden="true" /></Link></div></header>
    <main>
      {data.errors.length > 0 && <p className={styles.error} role="alert">{text('Часть данных не удалось загрузить', 'Частину даних не вдалося завантажити')}: {data.errors.map(key => ({ levels: text('прогресс', 'прогрес'), dictionaries: text('словари', 'словники'), exams: text('экзамены', 'іспити') })[key]).join(', ')}. <Link href={`/home-previews/${design}`}>{text('Повторить', 'Повторити')}</Link></p>}

      {design === 'studio' && <>
        <section className={styles.studioIntro}><div className={styles.introText}><span className={styles.eyebrow}>LATVIEŠU VALODA / A1–B2</span><h1>{text('Латышский язык', 'Латиська мова')}</h1><p className={styles.introSubtitle}>{text('Продолжим с твоего уровня.', 'Продовжимо з твого рівня.')}</p><CourseContinue /></div><div className={styles.introArt}><Image src={art(1763)} alt={text('Приветствие', 'Привітання')} width={240} height={240} preload /><span className={styles.artWord}>Sveiki!</span></div></section>
        <section className={styles.section}><div className={styles.sectionTitle}><h2>{text('Твой путь', 'Твій шлях')}</h2><Link href="/course">{text('Открыть курс', 'Відкрити курс')}<i className="pi pi-arrow-right" aria-hidden="true" /></Link></div>{courseLevels()}</section>
        {examStrip()}{practiceTools()}{dictionaryList()}
      </>}

      {design === 'atlas' && <>
        <section className={styles.atlasHero}><CourseLandscape selected={selected} onSelect={setSelected} moving={moving} dark={dark} /><div className={styles.atlasHeading}><span className={styles.eyebrow}>LANGBRIDGE PATHWAYS</span><h1>{text('Латышский язык', 'Латиська мова')}</h1></div><div className={styles.sceneControls}><button type="button" aria-pressed={!moving} onClick={() => setMoving(!moving)} aria-label={moving ? text('Остановить движение', 'Зупинити рух') : text('Включить движение', 'Увімкнути рух')} title={moving ? text('Остановить движение', 'Зупинити рух') : text('Включить движение', 'Увімкнути рух')}><i className={`pi ${moving ? 'pi-pause' : 'pi-play'}`} aria-hidden="true" /></button></div><div className={styles.atlasBottom}><div>{levelSelector()}<p className={styles.atlasProgress}><strong>{level ? `${percent}%` : '—'}</strong>{progressText}{rank && <span className={styles.rank} data-rank={rank}><i className={`pi ${courseRankIcon(rank)}`} aria-hidden="true" />{courseRankLabel(rank, uk)}</span>}</p></div><Link href={`/course?level=${selected}`} className={styles.button}>{text('Продолжить', 'Продовжити')} {selected}<i className="pi pi-arrow-right" aria-hidden="true" /></Link></div></section>
        <div className={styles.content}>{practiceTools()}{examStrip()}<section className={styles.section}><div className={styles.sectionTitle}><h2>{text('Уровни курса', 'Рівні курсу')}</h2></div>{courseLevels()}</section>{dictionaryList()}</div>
      </>}

      {design === 'exam' && <>
        <section className={styles.examIntro}><span className={styles.eyebrow}>LANGBRIDGE / EKSĀMENI</span><h1>{text('Экзамены по латышскому', 'Іспити з латиської')}</h1><div className={styles.examIntroBottom}><p>{text('Подготовка. Попытка. Результат.', 'Підготовка. Спроба. Результат.')}</p><Link href="/exams" className={styles.textLink}>{text('История попыток', 'Історія спроб')}<i className="pi pi-arrow-up-right" aria-hidden="true" /></Link></div></section>
        <section className={styles.examWorkspace}>
          <div className={styles.examMain}>
            <div className={styles.sectionTitle}><h2>{text('Твой экзамен', 'Твій іспит')}</h2>{levelSelector()}</div>
            <div className={styles.examIdentity}>
              <strong>{selected}</strong>
              <div><h3>{text('Итоговая проверка', 'Підсумкова перевірка')}</h3><span>{duration ? `${duration} ${text('минут', 'хвилин')}` : '—'} · {text('4 раздела', '4 розділи')}</span></div>
              <Image src={art(1774)} alt="" width={136} height={136} />
            </div>
            <div className={styles.examSkills}>{[
              { ru: 'Слушание', uk: 'Слухання', key: 'listening', icon: 'pi-headphones' },
              { ru: 'Чтение', uk: 'Читання', key: 'reading', icon: 'pi-book' },
              { ru: 'Письмо', uk: 'Письмо', key: 'writing', icon: 'pi-pencil' },
              { ru: 'Говорение', uk: 'Говоріння', key: 'speaking', icon: 'pi-microphone' },
            ].map(skill => <div key={skill.key}><i className={`pi ${skill.icon}`} aria-hidden="true" /><strong>{uk ? skill.uk : skill.ru}</strong><span>{exam?.durations?.[skill.key] ? `${Math.round(exam.durations[skill.key] / 60)} ${text('мин', 'хв')}` : '—'}</span></div>)}</div>
            <div className={styles.examActions}>
              <Link href={`/exams?level=${selected}`} className={styles.button}>{text('Перейти к экзамену', 'Перейти до іспиту')}<i className="pi pi-arrow-right" aria-hidden="true" /></Link>
              <span className={styles.muted}>{exam?.best_score != null ? `${text('Лучший результат', 'Найкращий результат')}: ${Math.round(exam.best_score)}%` : text('Результата пока нет', 'Результату поки немає')}</span>
            </div>
          </div>
          <aside className={styles.examAside}>
            <span className={styles.eyebrow}>{text('ПОДГОТОВКА', 'ПІДГОТОВКА')}</span><h2>{text('Основа — твой курс', 'Основа — твій курс')}</h2>
            <div className={styles.asideProgress}><strong>{level ? `${percent}%` : '—'}</strong><span>{selected}</span></div>
            <progress max={100} value={percent} aria-label={progressText} /><p>{progressText}</p>
            <Link href={`/course?level=${selected}`}>{text('Продолжить учиться', 'Продовжити вчитися')}<i className="pi pi-arrow-right" aria-hidden="true" /></Link>
            <Link href="/tutor" className={styles.tutorLink}><i className="pi pi-comments" aria-hidden="true" />{text('Практика с репетитором', 'Практика з репетитором')}</Link>
          </aside>
        </section>
        {practiceTools()}<section className={styles.section}><div className={styles.sectionTitle}><h2>{text('Учебный курс', 'Навчальний курс')}</h2><Link href="/course">A1–B2<i className="pi pi-arrow-right" aria-hidden="true" /></Link></div>{courseLevels()}</section>{dictionaryList()}
      </>}
      {design === 'workspace' && <>
        <div className={styles.workspace}>
          <aside className={styles.workspaceNav}>
            <span className={styles.eyebrow}>{text('МОЁ ОБУЧЕНИЕ', 'МОЄ НАВЧАННЯ')}</span>
            <nav aria-label={text('Разделы обучения', 'Розділи навчання')}>
              <a href="#workspace-course" className={styles.workspaceCurrent}><i className="pi pi-compass" aria-hidden="true" />{text('Мой курс', 'Мій курс')}</a>
              {tools.map(tool => <Link key={tool.href} href={tool.href}><i className={`pi ${tool.icon}`} aria-hidden="true" />{uk ? tool.uk : tool.ru}</Link>)}
              <a href="#resources"><i className="pi pi-bookmark" aria-hidden="true" />{text('Справочник', 'Довідник')}</a>
            </nav>
            <Link href="/exams" className={styles.workspaceExam}><i className="pi pi-graduation-cap" aria-hidden="true" /><strong>{text('Экзамены A1–B2', 'Іспити A1–B2')}</strong><i className="pi pi-arrow-up-right" aria-hidden="true" /></Link>
          </aside>
          <div className={styles.workspaceBody} id="workspace-course">
            <div className={styles.workspaceHeading}><div><span className={styles.eyebrow}>LATVIEŠU VALODA</span><h1>{text('Мой кабинет', 'Мій кабінет')}</h1></div>{levelSelector()}</div>
            <section className={styles.workspaceCurrentLevel}>
              <Image src={art(levelArt[selectedIndex])} alt="" width={112} height={112} />
              <div><span className={styles.eyebrow}>{selected}</span><h2>{levelNames[selectedIndex]}</h2><p>{progressText}</p><progress value={percent} max={100} aria-label={`${selected}: ${percent}%`} /></div>
              <strong>{level ? `${percent}%` : '—'}</strong>
            </section>
            <div className={styles.workspaceActions}><CourseContinue /><Link href={`/exams?level=${selected}`} className={styles.textLink}>{text('Экзамен', 'Іспит')} {selected}<i className="pi pi-arrow-right" aria-hidden="true" /></Link></div>
            <section className={styles.section}><div className={styles.sectionTitle}><h2>{text('Все уровни', 'Усі рівні')}</h2><span className={styles.muted}>A1–B2</span></div>{courseRows()}</section>
          </div>
        </div>
        {dictionaryList()}
      </>}

      {design === 'journal' && <>
        <section className={styles.journalHeading}><div className={styles.journalMeta}><span>LANGBRIDGE / LATVIJA</span><span>A1 — B2</span></div><h1>Latviešu valoda<span>.</span></h1><div className={styles.journalSubline}><span>{text('Латышский язык', 'Латиська мова')}</span><CourseContinue /></div></section>
        <div className={styles.journalBody}>
          <section><div className={styles.journalSectionTitle}><span>01</span><h2>{text('Учебный курс', 'Навчальний курс')}</h2></div>{courseRows()}</section>
          <aside className={styles.journalAside}><div className={styles.journalSectionTitle}><span>02</span><h2>{text('Экзамен', 'Іспит')}</h2></div><Image src={art(1774)} alt="" width={160} height={160} /><div className={styles.journalExamLevel}>{selected}<small>{duration ? `${duration} ${text('минут', 'хвилин')}` : 'A1–B2'}</small></div>{levelSelector()}<p>{exam?.best_score != null ? `${text('Лучший результат', 'Найкращий результат')}: ${Math.round(exam.best_score)}%` : text('Результата пока нет', 'Результату поки немає')}</p><Link href={`/exams?level=${selected}`} className={styles.button}>{text('К экзаменам', 'До іспитів')}<i className="pi pi-arrow-right" aria-hidden="true" /></Link></aside>
        </div>
        {practiceTools()}{dictionaryList()}
      </>}

      {design === 'route' && <>
        <section className={styles.routeSection}>
          <div className={styles.routeHeading}><div><span className={styles.eyebrow}>LANGBRIDGE / LATVIEŠU VALODA</span><h1>{text('Мой маршрут', 'Мій маршрут')}</h1></div><div className={styles.routeModes} role="group" aria-label={text('Режим', 'Режим')}><button type="button" aria-pressed={routeMode === 'course'} onClick={() => setRouteMode('course')}><i className="pi pi-compass" aria-hidden="true" />{text('Обучение', 'Навчання')}</button><button type="button" aria-pressed={routeMode === 'exam'} onClick={() => setRouteMode('exam')}><i className="pi pi-graduation-cap" aria-hidden="true" />{text('Экзамен', 'Іспит')}</button></div></div>
          <div className={styles.routeStops} role="group" aria-label={text('Уровень языка', 'Рівень мови')}>{COURSE_LEVEL_IDS.map((id, index) => {
            const item = data.levels.find(value => value.id === id);
            const result = data.exams.find(value => value.level === id)?.best_score;
            const score = routeMode === 'course' ? (item ? getCourseLevelProgress(item).percent : null) : result;
            return <button type="button" key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}><span className={styles.stopArt}><Image src={art(levelArt[index])} alt="" width={160} height={160} /></span><span className={styles.stopDot} aria-hidden="true" /><strong>{id}</strong><span className={styles.stopName}>{levelNames[index]}</span><span className={styles.stopScore}>{score != null ? `${Math.round(score)}%` : '—'}</span></button>;
          })}</div>
          <div className={styles.routeDestination}><div><span className={styles.eyebrow}>{routeMode === 'course' ? text('УЧЕБНЫЙ КУРС', 'НАВЧАЛЬНИЙ КУРС') : text('ИТОГОВЫЙ ЭКЗАМЕН', 'ПІДСУМКОВИЙ ІСПИТ')}</span><h2>{selected} · {levelNames[selectedIndex]}</h2><p>{routeMode === 'course' ? progressText : `${duration ? `${duration} ${text('минут', 'хвилин')} · ` : ''}${text('Слушание, чтение, письмо, говорение', 'Слухання, читання, письмо, говоріння')}`}</p></div>{routeMode === 'course' ? <CourseContinue /> : <Link href={`/exams?level=${selected}`} className={styles.button}>{text('К экзаменам', 'До іспитів')}<i className="pi pi-arrow-right" aria-hidden="true" /></Link>}</div>
        </section>
        {practiceTools()}{dictionaryList()}
      </>}
      {design === 'riga' && <>
        <section className={styles.rigaScene} aria-label={text('Уровни курса в городе', 'Рівні курсу в місті')}>
          <Image src="/home-previews/riga-miniature.webp" alt={text('Воображаемая миниатюра Риги с трамваем, мостом и старым городом', 'Уявна мініатюра Риги з трамваєм, мостом і старим містом')} fill sizes="100vw" preload className={styles.rigaBackdrop} />
          <div className={styles.rigaTitle}><span>LANGBRIDGE · RĪGA</span><h1>Latviešu valoda</h1></div>
          <div className={styles.cityPins} role="group" aria-label={text('Уровень языка', 'Рівень мови')}>{COURSE_LEVEL_IDS.map((id, index) => {
            const item = data.levels.find(value => value.id === id);
            return <button type="button" key={id} aria-pressed={selected === id} onClick={() => setSelected(id)} aria-label={`${id}: ${levelNames[index]}`}><span className={styles.pinLevel}>{id}</span><span className={styles.pinText}>{levelNames[index]}<small>{item ? `${getCourseLevelProgress(item).percent}%` : '—'}</small></span></button>;
          })}</div>
          <span className={styles.rigaCaption}>RĪGA / LATVIJA</span>
        </section>
        <div className={styles.content}>
          <section className={styles.citySelection} aria-live="polite"><span className={styles.citySelectedId}>{selected}</span><div><h2>{levelNames[selectedIndex]}</h2><p>{progressText}</p></div><div className={styles.cityProgress}><strong>{level ? `${percent}%` : '—'}</strong><progress value={percent} max={100} aria-label={`${selected}: ${percent}%`} /></div><Link href={`/course?level=${selected}`} className={styles.button}>{text('Продолжить путь', 'Продовжити шлях')}<i className="pi pi-arrow-right" aria-hidden="true" /></Link></section>
          {practiceTools()}{examStrip()}{dictionaryList()}
        </div>
      </>}

      {design === 'signal' && <>
        <section className={styles.signalHeading}><div><span className={styles.eyebrow}>LANGBRIDGE / LATVIEŠU VALODA</span><h1>{text('Латышский.', 'Латиська.')}<br /><span>{text('На связи.', 'На зв’язку.')}</span></h1></div><div className={styles.signalLabel}><i className="pi pi-wave-pulse" aria-hidden="true" /><span>A1<br />A2<br />B1<br />B2</span></div></section>
        <section className={styles.signalDeck}>
          <div className={styles.signalLevelPanel}>
            <div className={styles.signalPanelTop}><span>{text('УЧЕБНЫЙ КУРС', 'НАВЧАЛЬНИЙ КУРС')}</span><i className="pi pi-compass" aria-hidden="true" /></div>
            <div className={styles.signalIdentity}><strong>{selected}</strong><Image src={art(levelArt[selectedIndex])} alt="" width={180} height={180} /></div>
            <h2>{levelNames[selectedIndex]}</h2><div className={styles.signalProgress}><span>{progressText}</span><strong>{level ? `${percent}%` : '—'}</strong></div><progress value={percent} max={100} aria-label={`${selected}: ${percent}%`} />
            <Link href={`/course?level=${selected}`} className={styles.signalGo}>{text('Продолжить', 'Продовжити')}<i className="pi pi-arrow-up-right" aria-hidden="true" /></Link>
          </div>
          <div className={styles.signalLanes} role="group" aria-label={text('Уровень языка', 'Рівень мови')}>{COURSE_LEVEL_IDS.map((id, index) => {
            const item = data.levels.find(value => value.id === id);
            return <button type="button" key={id} onClick={() => setSelected(id)} aria-pressed={selected === id}><span className={styles.laneNumber}>0{index + 1}</span><strong>{id}</strong><span className={styles.laneTitle}>{levelNames[index]}<small>{item ? `${item.completed} / ${item.total} ${text('категорий', 'категорій')}` : '—'}</small></span><span className={styles.laneScore}>{item ? `${getCourseLevelProgress(item).percent}%` : '—'}</span><i className={`pi ${selected === id ? 'pi-arrow-left' : 'pi-arrow-up-right'}`} aria-hidden="true" /></button>;
          })}</div>
        </section>
        <section className={styles.signalExam}><div><i className="pi pi-graduation-cap" aria-hidden="true" /><h2>{text('Проверка в деле', 'Перевірка на практиці')}</h2></div><span>{selected} · {duration ? `${duration} ${text('мин', 'хв')}` : '4/4'}</span><Link href={`/exams?level=${selected}`}>{text('К экзаменам', 'До іспитів')}<i className="pi pi-arrow-up-right" aria-hidden="true" /></Link></section>
        {practiceTools()}{dictionaryList()}
      </>}
      <div className={design === 'atlas' || design === 'riga' ? styles.content : undefined}><PreviewResources dark={dark} /></div>
    </main><footer className={styles.footer}><span>LangBridge Pathways</span><span>Latviešu valoda</span><Link href="/admin-tools">{text('Карта страниц', 'Карта сторінок')}<i className="pi pi-arrow-up-right" aria-hidden="true" /></Link></footer>
  </div>;
}
