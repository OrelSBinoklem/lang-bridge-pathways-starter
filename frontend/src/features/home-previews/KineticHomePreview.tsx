'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { COURSE_LEVEL_IDS, getCourseLevelProgress } from '@/features/course/course-level-progress';
import { languageLevelLabel } from '@/features/home/useful-links';
import { GlassCardArt, LEVEL_MATERIALS } from './GlassCardArt';
import { PreviewResources } from './PreviewResources';
import { PreviewSwitcher } from './PreviewSwitcher';
import type { HomePreviewData, KineticHomeDesign } from './types';
import styles from './kinetic-home-preview.module.css';

const LEVEL_NAMES = {
  ru: ['Первые разговоры', 'Повседневная жизнь', 'Уверенное общение', 'Свобода выражения'],
  uk: ['Перші розмови', 'Повсякденне життя', 'Впевнене спілкування', 'Свобода висловлювання'],
};

// Each page has its own choreography. Only the selected page is mounted.
function KineticSculpture({ design }: { design: KineticHomeDesign }) {
  const id = useId().replace(/:/g, '');
  if (design === 'liquid-atlas') return <div className={styles.liquidSculpture}>
    <svg className={styles.orbitDrawing} viewBox="0 0 600 600" fill="none"><circle cx="300" cy="300" r="244" /><circle cx="300" cy="300" r="202" strokeDasharray="2 10" /><ellipse cx="300" cy="300" rx="270" ry="116" transform="rotate(-30 300 300)" /><path d="M55 320C130 50 510 95 530 300S100 580 85 375" /><circle cx="122" cy="166" r="5" fill="currentColor" /><path d="M300 46v14m0 480v14M46 300h14m480 0h14" /></svg>
    <div className={styles.liquidOrbit}><span /><span /><span /></div>
    <div className={styles.lens}><div className={styles.lensCore}><span>ā</span><span>ē</span><span>ī</span></div><i /><b>LATVIEŠU</b></div>
    <div className={styles.satellite}><span>LV</span><small>valoda</small></div>
    <div className={styles.coordinates}>56°56′ N<br />24°06′ E</div>
    <div className={styles.materialTag}>01 / OPTICAL STUDY</div>
  </div>;
  if (design === 'prism-theatre') return <div className={styles.theatreSculpture}>
    <div className={styles.lightBeam} /><div className={styles.lightBeamSecond} />
    <div className={styles.prismTurntable}>{Array.from({ length: 7 }, (_, i) => <div className={styles.prismBlade} key={i} style={{ '--blade': i } as CSSProperties}><span>0{i + 1}</span><b>{['L', 'V', 'ā', 'ē', 'ī', 'ū', 'š'][i]}</b></div>)}</div>
    <svg viewBox="0 0 600 600" className={styles.theatreOrbit} fill="none"><defs><linearGradient id={`${id}-spectrum`}><stop stopColor="#8ae9dc" /><stop offset=".5" stopColor="#cb9fff" /><stop offset="1" stopColor="#f2b177" /></linearGradient></defs><ellipse cx="300" cy="380" rx="255" ry="70" stroke={`url(#${id}-spectrum)`} /><ellipse cx="300" cy="380" rx="230" ry="55" strokeDasharray="1 10" /><path d="M45 380H20m560 0h-25M300 300v-12m0 172v12" /></svg>
    <span className={styles.theatreCaption}>LIGHT BECOMES LANGUAGE</span><span className={styles.theatreIndex}>REFRACTION<br /><b>07 : LV</b></span>
  </div>;
  return <div className={styles.chromaticSculpture}>
    <div className={styles.typeBackdrop}>sveiki<span>LABDIEN</span></div>
    <div className={styles.foldingPanels}>{['ā', 'ē', 'ī', 'ū'].map((letter, i) => <div key={letter} className={styles.foldPanel} style={{ '--fold': i } as CSSProperties}><span>0{i + 1} / LV</span><b>{letter}</b><small>{['sākums', 'saruna', 'pasaule', 'brīvība'][i]}</small></div>)}</div>
    <svg className={styles.thread} viewBox="0 0 640 500" fill="none"><path d="M-20 370C40 220 105 455 180 315S285 45 375 230S520 420 665 100" /><path d="M-20 381C40 231 105 466 180 326S285 56 375 241S520 431 665 111" /></svg>
    <div className={styles.swatchStrip}><i /><i /><i /><i /><span>COLOUR / LANGUAGE / PLAY</span></div>
  </div>;
}

export default function KineticHomePreview({ design, data }: { design: KineticHomeDesign; data: HomePreviewData }) {
  const uk = useLocale() === 'uk';
  const t = (ru: string, ua: string) => uk ? ua : ru;
  const night = design === 'prism-theatre', chromatic = design === 'chromatic-studio';
  const names = LEVEL_NAMES[uk ? 'uk' : 'ru'];
  const [selected, setSelected] = useState(data.levels.find(level => level.status === 'active')?.id ?? 'A1');
  const [moving, setMoving] = useState(true), [inView, setInView] = useState(true), [visible, setVisible] = useState(true);
  const [blur, setBlur] = useState(night ? 18 : 12), [density, setDensity] = useState(night ? 45 : 50);
  const root = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null), pointer = useRef({ x: .5, y: .5 });
  const controlId = useId();
  const level = data.levels.find(item => item.id === selected), progress = getCourseLevelProgress(level);
  const index = Math.max(0, COURSE_LEVEL_IDS.findIndex(id => id === selected));
  const exam = data.exams.find(item => item.level === selected);

  useEffect(() => {
    const element = stage.current;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '80px' });
    if (element) observer.observe(element);
    const visibility = () => setVisible(document.visibilityState === 'visible');
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);

  function updatePointer(event?: PointerEvent<HTMLDivElement>) {
    if (event?.pointerType === 'touch') return;
    const rect = event?.currentTarget.getBoundingClientRect();
    pointer.current = event && rect ? { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height } : { x: .5, y: .5 };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const { x, y } = pointer.current;
      stage.current?.style.setProperty('--pointer-x', `${x * 100}%`);
      stage.current?.style.setProperty('--pointer-y', `${y * 100}%`);
      stage.current?.style.setProperty('--tilt-x', `${(y - .5) * -9}deg`);
      stage.current?.style.setProperty('--tilt-y', `${(x - .5) * 11}deg`);
    });
  }

  return <div ref={root} className={styles.root} data-kinetic-design={design} data-motion={moving && visible} style={{ '--surface-blur': `${blur}px`, '--surface-density': density / 100 } as CSSProperties}>
    <div className={styles.ambient} aria-hidden="true"><span /><span /><span /></div>
    <div className={styles.previewNav}><PreviewSwitcher design={design} /></div>
    <header className={styles.header}><Link href="/" className={styles.brand}><span aria-hidden="true">lb<span>p.</span></span><small>LANGBRIDGE<br />PATHWAYS</small></Link><nav aria-label={t('Основная навигация', 'Основна навігація')}><Link href="/course">{t('Курс', 'Курс')}</Link><Link href="/grammar">{t('Грамматика', 'Граматика')}</Link><Link href="/tutor">{t('Репетитор', 'Репетитор')}</Link></nav><Link href="/dashboard" className={styles.account} aria-label={t('Аккаунт', 'Акаунт')}><i className="pi pi-user" aria-hidden="true" /></Link></header>
    <main className={styles.main}>
      <div className={styles.edition}><span>LBP / {night ? '17' : chromatic ? '18' : '16'}<b>{night ? 'PRISM THEATRE' : chromatic ? 'CHROMATIC STUDIO' : 'LIQUID ATLAS'}</b></span><div className={styles.designControls}><button type="button" onClick={() => setMoving(!moving)} aria-pressed={!moving}><i className={`pi ${moving ? 'pi-pause' : 'pi-play'}`} aria-hidden="true" />{moving ? t('Пауза', 'Пауза') : t('Движение', 'Рух')}</button><details><summary>{t('Материал', 'Матеріал')}<i className="pi pi-sliders-h" aria-hidden="true" /></summary><div className={styles.settings}><label htmlFor={`${controlId}-blur`}>{t('Размытие', 'Розмиття')}<output>{blur} px</output><input id={`${controlId}-blur`} aria-label={t('Размытие', 'Розмиття')} type="range" min={0} max={28} value={blur} onChange={e => setBlur(Number(e.target.value))} /></label><label htmlFor={`${controlId}-density`}>{t('Плотность стекла', 'Щільність скла')}<output>{density}%</output><input id={`${controlId}-density`} aria-label={t('Плотность стекла', 'Щільність скла')} type="range" min={20} max={85} value={density} onChange={e => setDensity(Number(e.target.value))} /></label></div></details></div></div>
      {data.errors.length > 0 && <p role="alert" className={styles.error}>{t('Часть данных не загрузилась.', 'Частина даних не завантажилася.')} <Link href={`/home-previews/${design}`}>{t('Повторить', 'Повторити')}</Link></p>}
      <section className={styles.hero}>
        <div className={styles.heroCopy}><span className={styles.eyebrow}>LATVIEŠU VALODA / A1—B2</span><h1>{night ? <>{t('Каждое слово —', 'Кожне слово —')}<br /><em>{t('новый свет.', 'нове світло.')}</em></> : chromatic ? <>{t('Язык, который', 'Мова, що')}<br /><em>{t('добавляет красок.', 'додає барв.')}</em></> : <>{t('Мир становится', 'Світ стає')}<br /><em>{t('понятнее.', 'зрозумілішим.')}</em></>}</h1><p>{night ? t('Из отдельных звуков складывается твой голос. Из маленьких шагов — свободный разговор.', 'З окремих звуків складається твій голос. З маленьких кроків — вільна розмова.') : chromatic ? t('Слова, правила и разговоры. Собери из них свою жизнь на латышском.', 'Слова, правила й розмови. Збери з них своє життя латиською.') : t('Неизвестные слова становятся знакомыми местами. Отправимся дальше?', 'Невідомі слова стають знайомими місцями. Рушимо далі?')}</p><Link className={styles.heroLink} href={`/course?level=${selected}`}>{t('Продолжить путь', 'Продовжити шлях')}<span>{selected}<i className="pi pi-arrow-up-right" aria-hidden="true" /></span></Link><div className={styles.heroColophon}><span>ā / ē / ī / ū</span><span>{t('В своём ритме.', 'У своєму ритмі.')}<br />{t('В своём направлении.', 'У своєму напрямку.')}</span></div></div>
        <div className={styles.stage} ref={stage} data-running={moving && visible && inView} onPointerMove={updatePointer} onPointerLeave={() => updatePointer()}>
          <div className={styles.stageSpotlight} aria-hidden="true" /><div className={styles.sculptureParallax} aria-hidden="true"><KineticSculpture design={design} /></div>
          <div className={styles.stageWord}><span lang="lv">{['Labdien!', 'Kā tev klājas?', 'Pasaule', 'Brīvība'][index]}</span><small>{[t('Добрый день', 'Добрий день'), t('Как дела?', 'Як справи?'), t('Мир', 'Світ'), t('Свобода', 'Свобода')][index]}</small><i className="pi pi-sparkles" aria-hidden="true" /></div>
          <div className={styles.stageSelector} role="group" aria-label={t('Уровень языка', 'Рівень мови')}>{COURSE_LEVEL_IDS.map(id => <button type="button" key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>{id}</button>)}</div>
        </div>
      </section>
      <section className={styles.curriculum}><div className={styles.sectionHead}><span>01 / {t('ТВОЯ ТРАЕКТОРИЯ', 'ТВОЯ ТРАЄКТОРІЯ')}</span><h2>{t('Четыре уровня. Твой темп.', 'Чотири рівні. Твій темп.')}</h2><Link href="/course">{t('Весь курс', 'Увесь курс')}<i className="pi pi-arrow-up-right" aria-hidden="true" /></Link></div><div className={styles.levelGrid}>{COURSE_LEVEL_IDS.map((id, i) => {
        const item = data.levels.find(value => value.id === id), score = getCourseLevelProgress(item);
        return <Link key={id} href={`/course?level=${id}`} className={styles.levelCard} data-card={i} data-current={item?.status === 'active'} style={{ '--sequence': i } as CSSProperties}><div className={styles.cardTop}><span>LV / 0{i + 1}</span><span>{item?.status === 'active' ? t('Сейчас', 'Зараз') : item?.status === 'completed' ? t('Пройден', 'Пройдено') : t('Курс', 'Курс')}</span></div><div className={styles.cardTitle}><strong>{id}</strong><span>{item ? `${score.percent}%` : '—'}</span></div><h3>{names[i]}</h3><div className={styles.cardArt} aria-hidden="true"><GlassCardArt material={LEVEL_MATERIALS[i]} /></div><progress max={100} value={score.percent} aria-label={`${id}: ${score.percent}%`} /><div className={styles.cardFoot}><span>{item ? `${item.completed} / ${item.total} ${t('категорий', 'категорій')}` : t('Нет данных', 'Немає даних')}</span><i className="pi pi-arrow-up-right" aria-hidden="true" /></div></Link>;
      })}</div></section>
      <div className={styles.workspace}><section className={styles.continueCard}><div className={styles.continueTop}><span>02 / {t('ПРОДОЛЖАЕМ', 'ПРОДОВЖУЄМО')}</span><i className="pi pi-compass" aria-hidden="true" /></div><div className={styles.progressDial} style={{ '--sweep': `${progress.percent * 3.6}deg` } as CSSProperties}><span>{selected}</span><strong>{level ? `${progress.percent}%` : '—'}</strong><small>{t('твоего пути', 'твого шляху')}</small></div><h2>{names[index]}</h2><p>{level ? `${level.completed} / ${level.total} ${t('категорий пройдено', 'категорій пройдено')}` : t('Прогресс недоступен', 'Прогрес недоступний')}</p><Link href={`/course?level=${selected}`}>{t('Открыть курс', 'Відкрити курс')} {selected}<i className="pi pi-arrow-right" aria-hidden="true" /></Link></section>
        <section className={styles.practice}><div className={styles.sectionHead}><span>03 / {t('ПОПРОБУЙ СЕГОДНЯ', 'СПРОБУЙ СЬОГОДНІ')}</span><h2>{t('Разные способы стать ближе.', 'Різні способи стати ближче.')}</h2></div><div className={styles.practiceGrid}><Link href="/tutor" className={styles.tutorCard}><span className={styles.smallCaps}>{t('РАЗГОВОР', 'РОЗМОВА')} / 01</span><div className={styles.voiceBars} aria-hidden="true">{Array.from({ length: 15 }, (_, i) => <i key={i} style={{ '--bar': i, '--bar-height': `${18 + ((i * 17 + 13) % 48)}px` } as CSSProperties} />)}</div><h3>{t('Давай поговорим.', 'Нумо поговоримо.')}</h3><p>{t('Репетитор, который тебя услышит.', 'Репетитор, що тебе почує.')}</p><i className={`pi pi-arrow-up-right ${styles.cornerArrow}`} aria-hidden="true" /></Link><Link href="/grammar" className={styles.grammarCard}><span className={styles.smallCaps}>{t('ГРАММАТИКА', 'ГРАМАТИКА')} / 02</span><div className={styles.grammarLetters} aria-hidden="true"><span>ā</span><span>a</span></div><h3>{t('Поймать логику.', 'Зрозуміти логіку.')}</h3><p>{t('Правила, которые складываются в речь.', 'Правила, що складаються в мовлення.')}</p><i className={`pi pi-arrow-up-right ${styles.cornerArrow}`} aria-hidden="true" /></Link></div><Link href={`/exams?level=${selected}`} className={styles.examTicket}><span className={styles.ticketStamp}>{selected}</span><div><span className={styles.smallCaps}>{t('ПРОВЕРИТЬ СЕБЯ', 'ПЕРЕВІРИТИ СЕБЕ')}</span><h3>{t('Готов к следующему шагу?', 'Готовий до наступного кроку?')}</h3><small>{exam?.best_score != null ? `${t('Лучший результат', 'Найкращий результат')}: ${Math.round(exam.best_score)}%` : t('Экзамены A1—B2', 'Іспити A1—B2')}</small></div><i className="pi pi-arrow-up-right" aria-hidden="true" /></Link></section></div>
      <section className={styles.lexicon} id="dictionaries"><div className={styles.sectionHead}><span>04 / {t('ЛИЧНАЯ БИБЛИОТЕКА', 'ОСОБИСТА БІБЛІОТЕКА')}</span><h2>{t('У каждого слова — своя история.', 'У кожного слова — своя історія.')}</h2></div><div className={styles.bookGrid}>{data.dictionaries.map((dictionary, i) => <Link href={`/dictionaries/${dictionary.id}`} key={dictionary.id} className={styles.book} data-book={i % 2}><span className={styles.bookSpine} aria-hidden="true">LANGBRIDGE / LEXICON</span><div className={styles.bookMeta}><span>LV / 0{i + 1}</span>{dictionary.sound && <i className="pi pi-volume-up" aria-label={t('С озвучкой', 'З озвученням')} />}</div><span className={styles.bookLetter} aria-hidden="true">Aa<small>ā ē ī ū</small></span><div className={styles.bookDetails}><h3>{dictionary.name}</h3><span>{languageLevelLabel(dictionary.level)}{dictionary.max_level !== dictionary.level && `—${languageLevelLabel(dictionary.max_level)}`}</span></div><div className={styles.bookFoot}><strong>{dictionary.words.toLocaleString(uk ? 'uk-UA' : 'ru-RU')}<small>{t('слов', 'слів')}</small></strong><i className="pi pi-arrow-up-right" aria-hidden="true" /></div></Link>)}</div>{!data.dictionaries.length && <p>{t('Словари не загружены.', 'Словники не завантажені.')}</p>}</section>
      <div className={styles.resources}><PreviewResources dark={night} /></div>
    </main><footer className={styles.footer}><Link href="/">LangBridge Pathways</Link><span>MAZI SOĻI. LIELS CEĻŠ.</span><Link href="/admin-tools">{t('Карта страниц', 'Карта сторінок')} ↗</Link></footer>
  </div>;
}
