'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import styles from './standalone-effect-preview.module.css';

const StreetRelight = dynamic(() => import('@/features/street-relight/StreetRelight').then((module) => module.StreetRelight), { ssr: false });
const ParallaxPreview = dynamic(() => import('@/features/course/ParallaxPreview').then((module) => module.ParallaxPreview), { ssr: false });
const SpriteSwarm = dynamic(() => import('./sprite-swarm/SpriteSwarm'), { ssr: false });

const EFFECTS = {
  'sprite-swarm': {
    title: 'Рой картинок · 13 фигур и своя картинка',
    poster: '/course/effects/sprite-swarm/poster.svg',
    alt: 'Рой светящихся сердец и звёзд',
  },
  'street-relight': {
    title: 'Улица после дождя',
    poster: '/course/street-relight/source.jpg',
    alt: 'Улица после дождя с вечерним освещением',
  },
  'parallax-preview': {
    title: 'Параллакс сувениров',
    poster: '/course/effects/latvia-cat-v1.webp',
    alt: 'Сувенир с латвийской кошкой',
  },
} as const;

export type StandaloneEffectId = keyof typeof EFFECTS;
export const STANDALONE_EFFECT_IDS = Object.keys(EFFECTS) as StandaloneEffectId[];
export const isStandaloneEffectId = (id: string): id is StandaloneEffectId => Object.hasOwn(EFFECTS, id);

/** Shared full viewport; a same-origin iframe makes the existing renderer fit a card without changing its optics. */
export function StandaloneEffectStage({ id, onStop }: { id: StandaloneEffectId; onStop: () => void }) {
  return createPortal(id === 'sprite-swarm' ? <SpriteSwarm onExit={onStop} /> : id === 'street-relight' ? <StreetRelight onExit={onStop} />
    : <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={EFFECTS[id].title}><ParallaxPreview onExit={onStop} /></div>, document.body);
}

export function StandaloneEffectPreview({ id, running, onStart, onStop }: {
  id: StandaloneEffectId;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const effect = EFFECTS[id];
  const frame = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!running || expanded) return;
    const stop = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'course-standalone-stop') onStop();
    };
    window.addEventListener('message', stop);
    return () => window.removeEventListener('message', stop);
  }, [running, expanded, onStop]);
  useEffect(() => {
    if (!running || !expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onStop();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [running, expanded, onStop]);

  return <div id={id} className={styles.card}>
    <Image src={effect.poster} alt={effect.alt} fill unoptimized sizes="(max-width: 600px) 100vw, 560px" className={styles.poster} />
    {running && !expanded && <iframe ref={frame} title={`Интерактивная карточка: ${effect.title}`} src={`/course/effects-preview?embedded=standalone:${id}`} style={{ position: 'absolute', inset: 0, width: '200%', height: '200%', transform: 'scale(.5)', transformOrigin: '0 0', border: 0 }} />}
    {!running && <button type="button" onClick={() => { setExpanded(false); onStart(); }} className={styles.start}>▶ В карточке</button>}
    <div className={styles.actions}>
      <button type="button" onClick={() => { setExpanded(true); onStart(); }}>⛶ На весь экран</button>
      {running && <button type="button" onClick={onStop}>■ Стоп</button>}
    </div>
    <h3 className={styles.title}>{effect.title}</h3>
    {running && expanded && <StandaloneEffectStage id={id} onStop={onStop} />}
  </div>;
}
