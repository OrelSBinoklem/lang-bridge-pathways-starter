'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CatMascot, CatOutfit, CatQuality, CatState, CatStyle, HighlightMode, ActionName, EmotionName, CatFacing } from './catMascot';
import { ACTIONS, EMOTIONS } from './catPose';
import { TourVoice } from '@/features/home-tour/tourVoice';
import styles from './cat-lab.module.css';

const OUTFITS: [CatOutfit, string][] = [['plain', 'Просто кот'], ['collar', 'Домашний (ошейник)'], ['teacher', 'Учитель'], ['professor', 'Профессор']];
const MODES: [HighlightMode, string][] = [['ring', 'Рамка'], ['spotlight', 'Прожектор'], ['marker', 'Маркер'], ['laser', 'Лазер']];
const PHRASES = ['Sveiki!\nПривет!', 'Labi! Tā turpināt!\nХорошо! Так держать!', 'Mēģini vēlreiz.\nПопробуй ещё раз.', 'Paldies!\nСпасибо!', 'Lieliski!\nОтлично!', 'Uzmanīgi — garais patskanis!\nОсторожно — долгая гласная!'];
const SIZES: [number, string][] = [[170, 'S'], [240, 'M'], [320, 'L']];
const QUALITY: [CatQuality, string][] = [['low', 'Низкое'], ['medium', 'Среднее'], ['high', 'Высокое']];
const SAMPLE_TEXT = 'Привет! Я кот Рунцис. Давай покажу, что где на сайте — это займёт всего минуту.';
const VOICES: [string, string][] = [['puck', 'Puck — бодрый'], ['leda', 'Leda — звонкий'], ['fenrir', 'Fenrir — с хрипотцой']];
const PERCHES: [string, string][] = [['perch-hero', 'Приветствие'], ['perch-words', 'Слова'], ['perch-table', 'Таблица'], ['perch-star-0', 'Точка 1'], ['perch-star-1', 'Точка 2'], ['perch-star-2', 'Точка 3'], ['perch-star-3', 'Точка 4'], ['perch-exercise', 'Упражнение'], ['riga-picture', 'Рига'], ['footer-card', 'Внизу страницы']];
const FACING: [CatFacing, string][] =[['camera', 'К зрителю'], ['left', 'Влево'], ['right', 'Вправо'], ['away', 'Спиной']];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.group}><h3>{title}</h3><div className={styles.buttons}>{children}</div></section>;
}

export function CatLab() {
  const cat = useRef<CatMascot | null>(null);
  const [state, setState] = useState<CatState | null>(null);
  const [outfit, setOutfit] = useState<CatOutfit>('professor');
  const [style, setStyle] = useState<CatStyle>('anime');
  const [size, setSize] = useState(320);
  const [quality, setQuality] = useState<CatQuality>('high');
  const [follow, setFollow] = useState(true);
  const [autonomy, setAutonomy] = useState(true);
  const [debug, setDebug] = useState(false);
  const [clickJump, setClickJump] = useState(false);
  const [mode, setMode] = useState<HighlightMode>('ring');
  const [target, setTarget] = useState('word-paldies');
  const [text, setText] = useState('Šodien mācāmies sveicienus.\nСегодня учим приветствия.');
  const [panelOpen, setPanelOpen] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false, instance: CatMascot | null = null;
    import('./catMascot').then(({ CatMascot }) => {
      if (disposed) return;
      instance = new CatMascot({ start: document.getElementById('perch-hero') ?? undefined, onState: setState, outfit: 'professor', size: innerWidth < 600 ? 160 : 320 });
      if (innerWidth < 600) setSize(160);
      cat.current = instance;
      return instance.init().then(() => instance?.say('Sveiki! Es esmu Runcis.\nПривет! Я кот Рунцис.', 3500));
    }).catch(e => setError(String(e)));
    return () => { disposed = true; instance?.dispose(); cat.current = null; };
  }, []);

  useEffect(() => {
    if (!clickJump) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(`.${styles.panel}, button, input, a, select`)) return;
      void cat.current?.goTo({ x: e.pageX, y: e.pageY });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [clickJump]);

  const c = () => cat.current;
  const perches = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[data-cat-perch]'));
  const byId = (id: string) => document.getElementById(id);
  const targets: [string, string][] = [['word-paldies', 'Слово «Paldies»'], ['word-ludzu', 'Слово «Lūdzu»'], ['cell-esmu', 'Ячейка «es esmu»'], ['cell-ir', 'Ячейка «viņš ir»'], ['exercise-input', 'Поле ответа'], ['exercise-check', 'Кнопка «Проверить»'], ['riga-picture', 'Картинка Риги'], ['footer-card', 'Нижняя карточка']];

  return <div className={styles.page}>
    <header className={styles.head}>
      <h1>Латышский кот — тестовая страница</h1>
      <p>3D-кот в маленьком холсте, который летит вместе с ним. Перетащите кота мышью, погладьте кликом. Кнопки справа.</p>
      {error && <p className={styles.error}>Ошибка: {error}</p>}
    </header>
    <main className={styles.content}>
      <div id="perch-hero" className={`${styles.card} ${styles.hero}`} data-cat-perch="Приветствие" data-cat-perch-x="0.78">
        <h2>Sveiki! Привет!</h2>
        <p>Это учебная страница-макет: карточки, таблица, упражнение и картинка служат «насестами», на которые кот запрыгивает.</p>
      </div>
      <div className={styles.row}>
        <div id="perch-words" className={styles.card} data-cat-perch="Слова">
          <h2>Урок 1. Вежливые слова</h2>
          <ul className={styles.words}>
            <li><b>Labdien</b> — добрый день</li>
            <li><b id="word-paldies">Paldies</b> — спасибо</li>
            <li><b id="word-ludzu">Lūdzu</b> — пожалуйста</li>
            <li><b>Atvainojiet</b> — извините</li>
            <li><b>Uz redzēšanos</b> — до свидания</li>
          </ul>
        </div>
        <div id="perch-table" className={styles.card} data-cat-perch="Таблица" data-cat-perch-x="0.3">
          <h2>Глагол būt — быть</h2>
          <table className={styles.table}><tbody>
            <tr><td id="cell-esmu">es esmu</td><td>mēs esam</td></tr>
            <tr><td>tu esi</td><td>jūs esat</td></tr>
            <tr><td id="cell-ir">viņš, viņa ir</td><td>viņi, viņas ir</td></tr>
          </tbody></table>
        </div>
      </div>
      <div className={styles.platforms}>
        {[0, 1, 2, 3].map(i => <div key={i} id={`perch-star-${i}`} className={styles.platform} style={{ marginTop: [40, 120, 10, 90][i] }} data-cat-perch={`Точка ${i + 1}`}>★ {i + 1}</div>)}
      </div>
      <div className={styles.row}>
        <div id="perch-exercise" className={styles.card} data-cat-perch="Упражнение">
          <h2>Упражнение</h2>
          <p>Вставьте форму: <i>Es ___ students.</i></p>
          <div className={styles.exercise}><input id="exercise-input" placeholder="ответ" /><button id="exercise-check" type="button" onClick={() => {
            const ok = (byId('exercise-input') as HTMLInputElement | null)?.value.trim().toLowerCase() === 'esmu';
            c()?.setEmotion(ok ? 'joy' : 'sad', 3); c()?.play(ok ? 'hop' : 'shake');
            c()?.say(ok ? 'Pareizi! Lieliski!\nВерно! Отлично!' : 'Gandrīz… Mēģini vēlreiz!\nПочти… Попробуй ещё!', 2800);
          }}>Проверить</button></div>
        </div>
        <div id="riga-picture" className={`${styles.card} ${styles.riga}`} data-cat-perch="Рига" data-cat-perch-x="0.62">
          <div className={styles.skyline} aria-hidden="true"><span /><span /><span /><span /><span /></div>
          <p>Kaķu māja — Кошкин дом в Риге: чёрные коты с выгнутой спиной на башенках.</p>
        </div>
      </div>
      <div className={styles.spacer} />
      <div id="footer-card" className={styles.card} data-cat-perch="Внизу страницы">
        <h2>Далеко внизу</h2><p>Проверка прокрутки: при прыжке сюда страница следует за котом.</p>
      </div>
    </main>

    <aside className={styles.panel} data-open={panelOpen}>
      <button type="button" className={styles.toggle} onClick={() => setPanelOpen(v => !v)}>{panelOpen ? 'Скрыть панель' : 'Панель кота'}</button>
      <div className={styles.status}>
        {state ? <>Действие: <b>{ACTIONS[state.action].label}</b> · эмоция: <b>{EMOTIONS[state.emotion].label}</b> · {state.motion !== 'none' ? state.motion : 'на месте'}<br />{state.fps} кадр/с · {state.triangles.toLocaleString('ru')} треуг. · модель за {state.buildMs} мс</> : 'Загружаю кота…'}
      </div>
      <Group title="Голос кота: пробы (Flash-Lite)">{VOICES.map(([id, label]) => <button key={id} type="button" onClick={() => {
        const voice = new TourVoice(`samples/${id}`, level => c()?.setMouth(level));
        voice.unlock();
        void voice.load().then(() => { c()?.say(SAMPLE_TEXT, 6500); c()?.setEmotion('happy', 6); return voice.speakClip(`sample-${id}`, 'ru', SAMPLE_TEXT); }).finally(() => voice.dispose());
      }}>{label}</button>)}</Group>
      <Group title="Образ">{OUTFITS.map(([id, label]) => <button key={id} type="button" aria-pressed={outfit === id} onClick={() => { setOutfit(id); c()?.setOutfit(id); }}>{label}</button>)}</Group>
      <Group title="Стиль">{([['anime', 'Аниме (2D-фильтр)'], ['soft', 'Мягкий 3D (шерсть)']] as [CatStyle, string][]).map(([id, label]) => <button key={id} type="button" aria-pressed={style === id} onClick={() => { setStyle(id); c()?.setStyle(id); }}>{label}</button>)}</Group>
      <Group title="Эмоции">{(Object.keys(EMOTIONS) as EmotionName[]).map(id => <button key={id} type="button" aria-pressed={state?.emotion === id} onClick={() => c()?.setEmotion(id)}>{EMOTIONS[id].label}</button>)}</Group>
      <Group title="Анимации">{(Object.keys(ACTIONS) as ActionName[]).map(id => <button key={id} type="button" aria-pressed={state?.action === id} onClick={() => c()?.play(id)}>{ACTIONS[id].label}</button>)}</Group>
      <Group title="Прыжки по странице">
        {PERCHES.map(([id, label]) => <button key={id} type="button" onClick={() => { const el = byId(id); if (el) void c()?.goTo(el); }}>{label}</button>)}
        <button type="button" onClick={() => { const list = perches(); void c()?.jumpTo(list[Math.floor(Math.random() * list.length)], 0.15 + Math.random() * 0.7); }}>Случайный прыжок</button>
        <button type="button" onClick={() => void c()?.tour(perches())}>Экскурсия по всем точкам</button>
        <button type="button" aria-pressed={clickJump} onClick={() => setClickJump(v => !v)}>Клик по странице → прыжок</button>
      </Group>
      <Group title="Повернуться">{FACING.map(([id, label]) => <button key={id} type="button" onClick={() => c()?.face(id)}>{label}</button>)}</Group>
      <Group title="Указать и подсветить">
        <select value={target} onChange={e => setTarget(e.target.value)}>{targets.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        {MODES.map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}
        <button type="button" className={styles.primary} onClick={() => { const el = byId(target); if (el) void c()?.pointAt(el, mode, 'Skaties šeit!\nСмотри сюда!'); }}>Кот, укажи!</button>
        <button type="button" onClick={() => { const el = byId(target); if (el) c()?.highlight(el, mode, 3000); }}>Только подсветка</button>
        <button type="button" onClick={() => c()?.clearHighlight()}>Убрать</button>
      </Group>
      <Group title="Сказать">
        {PHRASES.map(p => <button key={p} type="button" onClick={() => c()?.say(p)}>{p.split('\n')[0]}</button>)}
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} />
        <button type="button" onClick={() => c()?.say(text, 4000)}>Сказать свой текст</button>
      </Group>
      <Group title="Настройки">
        {SIZES.map(([px, label]) => <button key={px} type="button" aria-pressed={size === px} onClick={() => { setSize(px); c()?.setSize(px); }}>Размер {label}</button>)}
        {QUALITY.map(([id, label]) => <button key={id} type="button" aria-pressed={quality === id} onClick={() => { setQuality(id); c()?.setQuality(id); }}>{label}</button>)}
        <button type="button" aria-pressed={follow} onClick={() => { setFollow(!follow); c()?.setFollowCursor(!follow); }}>Следить за курсором</button>
        <button type="button" aria-pressed={autonomy} onClick={() => { setAutonomy(!autonomy); c()?.setAutonomy(!autonomy); }}>Сам что-то делает</button>
        <button type="button" aria-pressed={debug} onClick={() => { setDebug(!debug); c()?.setDebug(!debug); }}>Рамка холста и точки</button>
      </Group>
    </aside>
  </div>;
}
