'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TutorAvatar } from './tutorAvatar';
import { EMOTIONS, MOTIONS, STATES, type AvatarState, type EmotionName, type Framing, type Motion, type MotionName } from './avatarPose';
import { AVATAR_MODELS } from './avatarModels';
import { TOUR_RELEASE, tourText } from '@/features/home-tour/homeTourSteps';
import styles from './avatar-lab.module.css';

type Layout = 'header' | 'side' | 'stage';
const LAYOUTS: [Layout, string, Framing][] = [['header', 'Шапка чата', 'portrait'], ['side', 'Рядом с чатом', 'full'], ['stage', 'Режим собеседника', 'bust']];
const MOTION_LIST = Object.entries(MOTIONS) as [MotionName, Motion][];
const FRAMINGS: [Framing, string][] = [['portrait', 'Лицо'], ['bust', 'По пояс'], ['full', 'В рост']];
const tourClip = (key: string) => ({ url: `/audio/tour/${TOUR_RELEASE}-fenrir/${key}-ru.mp3`, text: tourText(key, 'ru') });
const CLIPS: [string, { url: string; text: string }][] = [
  ['Leda (женский)', { url: '/audio/tour/samples/leda/sample-leda.mp3', text: 'Привет! Я кот Рунцис. Давай покажу, что где на сайте — это займёт всего минуту.' }],
  ['Puck', { url: '/audio/tour/samples/puck/sample-puck.mp3', text: 'Привет! Я кот Рунцис. Давай покажу, что где на сайте — это займёт всего минуту.' }],
  ['Fenrir: курс', tourClip('course')],
  ['Fenrir: словари', tourClip('dictionaries')],
];
const CHAT = [
  { me: true, text: 'Почему тут «es esmu», а не «es ir»?' },
  { me: false, text: 'Хороший вопрос! «Būt» — неправильный глагол: es esmu, tu esi, viņš ir. Форма «ir» только для третьего лица.' },
  { me: true, text: 'Понял, спасибо!' },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.group}><h3>{title}</h3><div className={styles.buttons}>{children}</div></section>;
}

export function AvatarLab() {
  const host = useRef<HTMLDivElement>(null);
  const avatar = useRef<TutorAvatar | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState<Layout>('header');
  const [framing, setFraming] = useState<Framing>('portrait');
  const [state, setState] = useState<AvatarState>('idle');
  const [emotion, setEmotion] = useState<EmotionName>('neutral');
  const [follow, setFollow] = useState(true);
  const [autonomy, setAutonomy] = useState(true);
  const [act, setAct] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [modelId, setModelId] = useState(AVATAR_MODELS[0].id);
  const model = AVATAR_MODELS.find(m => m.id === modelId) ?? AVATAR_MODELS[0];
  const scenario = useRef(0);
  // A newly chosen model starts with what the panel shows, not the defaults.
  const settings = useRef({ framing, state, emotion, follow, autonomy });
  const chooseModel = (id: string) => {
    if (id === modelId) return;
    settings.current = { framing, state, emotion, follow, autonomy };
    scenario.current++;
    setReady(false); setProgress(0); setError(''); setSubtitle('');
    setModelId(id);
  };

  useEffect(() => {
    let disposed = false, instance: TutorAvatar | null = null;
    import('./tutorAvatar').then(({ TutorAvatar }) => {
      if (disposed || !host.current) return;
      const s = settings.current;
      instance = new TutorAvatar(host.current, { url: model.url, motions: model.motions, framing: s.framing, followPointer: s.follow, autonomy: s.autonomy, onProgress: setProgress, onAct: setAct });
      avatar.current = instance;
      (window as unknown as { tutorAvatar?: TutorAvatar }).tutorAvatar = instance;
      return instance.init().then(() => {
        if (disposed || !instance) return;
        instance.setState(s.state);
        if (s.emotion !== 'neutral') instance.setEmotion(s.emotion);
        setReady(true);
      });
    }).catch(e => setError(String(e)));
    return () => { disposed = true; instance?.dispose(); avatar.current = null; };
  }, [model.url, model.motions]);

  const a = () => avatar.current;
  const chooseLayout = (next: Layout, f: Framing) => { setLayout(next); setFraming(f); a()?.setFraming(f); };
  const chooseState = (s: AvatarState) => { setState(s); a()?.setState(s); };
  const chooseEmotion = (e: EmotionName) => { setEmotion(e); a()?.setEmotion(e); };

  const speak = async (clip: { url: string; text: string }) => {
    const av = a();
    if (!av) return;
    setSubtitle(clip.text); setState('speaking');
    await av.speak(clip.url);
    setSubtitle(''); setState(av.getState());
  };

  /** A whole exchange: the student talks, the tutor thinks, answers, praises. */
  const runScenario = async () => {
    const av = a();
    if (!av) return;
    const id = ++scenario.current;
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    const alive = () => id === scenario.current;
    chooseEmotion('neutral'); chooseState('listening'); setSubtitle('(ученик говорит…)');
    await wait(3200); if (!alive()) return;
    chooseState('thinking'); setSubtitle('…');
    await wait(1800); if (!alive()) return;
    chooseEmotion('smile');
    await speak(CLIPS[0][1]); if (!alive()) return;
    chooseEmotion('praise'); void av.play('thumbsUp');
    await wait(2200); if (!alive()) return;
    chooseEmotion('neutral'); chooseState('idle');
  };

  return <div className={styles.page}>
    <header className={styles.head}>
      <h1>Аватар AI-репетитора — тестовая страница</h1>
      <p>3D-персонаж VRM: дышит, моргает, следит взглядом за курсором, слушает, думает, говорит с движением губ под голос. Размещение в чате, состояния, эмоции и жесты — в панели кнопок.</p>
      {error && <p className={styles.error}>Ошибка: {error}</p>}
    </header>

    <div className={styles.stageArea} data-layout={layout}>
      <div className={styles.chat}>
        <div className={styles.avatarBox}>
          <div ref={host} className={styles.avatar} />
          {!ready && !error && <div className={styles.loading}>Загрузка модели… {Math.round(progress * 100)}%</div>}
          {layout === 'stage' && subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          <span className={styles.badge}>{STATES[state].label}</span>
        </div>
        {layout !== 'stage' && <div className={styles.messages}>
          {CHAT.map((m, i) => <p key={i} className={m.me ? styles.me : styles.bot}>{m.text}</p>)}
          {subtitle && <p className={styles.bot}>{subtitle}</p>}
        </div>}
        <div className={styles.input}><span>Напиши или скажи…</span><i className="pi pi-microphone" /></div>
      </div>
    </div>

    <aside className={styles.panel} data-open={panelOpen}>
      <button type="button" className={styles.toggle} onClick={() => setPanelOpen(o => !o)}>{panelOpen ? 'Скрыть панель' : 'Кнопки теста'}</button>
      {act && <p className={styles.act}>Сама: <b>{act}</b></p>}
      <Group title="Модель">
        {AVATAR_MODELS.map(m => <button key={m.id} type="button" aria-pressed={modelId === m.id} onClick={() => chooseModel(m.id)}>{m.label}</button>)}
      </Group>
      <Group title="Сценарий">
        <button type="button" className={styles.primary} disabled={!ready} onClick={() => void runScenario()}>Весь диалог</button>
      </Group>
      <Group title="Размещение">
        {LAYOUTS.map(([id, label, f]) => <button key={id} type="button" aria-pressed={layout === id} onClick={() => chooseLayout(id, f)}>{label}</button>)}
      </Group>
      <Group title="Кадр">
        {FRAMINGS.map(([id, label]) => <button key={id} type="button" aria-pressed={framing === id} onClick={() => { setFraming(id); a()?.setFraming(id); }}>{label}</button>)}
      </Group>
      <Group title="Состояние">
        {(Object.keys(STATES) as AvatarState[]).map(s => <button key={s} type="button" aria-pressed={state === s} onClick={() => chooseState(s)}>{STATES[s].label}</button>)}
      </Group>
      <Group title="Эмоции">
        {(Object.keys(EMOTIONS) as EmotionName[]).map(e => <button key={e} type="button" aria-pressed={emotion === e} onClick={() => chooseEmotion(e)}>{EMOTIONS[e].label}</button>)}
      </Group>
      <Group title="Стойки (циклы)">
        {MOTION_LIST.filter(([, m]) => m.loop).map(([id, m]) => <button key={id} type="button" onClick={() => void a()?.play(id)}>{m.label}</button>)}
      </Group>
      <Group title="Движения">
        {MOTION_LIST.filter(([, m]) => !m.loop && !m.extra).map(([id, m]) => <button key={id} type="button" onClick={() => void a()?.play(id)}>{m.label}</button>)}
        <button type="button" onClick={() => a()?.tiltHead()}>Наклон головы</button>
      </Group>
      <Group title="Прочие (не для чата)">
        {MOTION_LIST.filter(([, m]) => m.extra).map(([id, m]) => <button key={id} type="button" onClick={() => void a()?.play(id)}>{m.label}</button>)}
      </Group>
      <Group title="Голос (губы по звуку)">
        {CLIPS.map(([label, clip]) => <button key={label} type="button" disabled={!ready} onClick={() => void speak(clip)}>{label}</button>)}
        <button type="button" onClick={() => a()?.stopSpeaking()}>Стоп</button>
      </Group>
      <Group title="Настройки">
        <button type="button" aria-pressed={autonomy} onClick={() => { setAutonomy(!autonomy); a()?.setAutonomy(!autonomy); }}>Живёт сама</button>
        <button type="button" aria-pressed={follow} onClick={() => { setFollow(!follow); a()?.setFollowPointer(!follow); }}>Взгляд за курсором</button>
      </Group>
      <p className={styles.credit}>Модель: {model.credit}</p>
    </aside>
  </div>;
}
