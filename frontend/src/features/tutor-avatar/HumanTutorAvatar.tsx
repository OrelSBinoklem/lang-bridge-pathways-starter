'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { AVATAR_MODELS, type AvatarModel } from './avatarModels';
import type { AvatarState } from './avatarPose';
import type { TutorAvatar } from './tutorAvatar';
import { DEFAULT_HUMAN_AVATAR, getHumanAvatarSelection, setHumanAvatarSelection, subscribeHumanAvatarSelection } from './avatar-selection';
import styles from './human-tutor-avatar.module.css';

export type HumanTutorAvatarProps = {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  analyser?: AnalyserNode | null;
  compact?: boolean;
};

export function HumanTutorAvatar({ state, analyser = null, compact = false }: HumanTutorAvatarProps) {
  const uk = useLocale() === 'uk';
  const selectId = useId();
  const modelId = useSyncExternalStore(subscribeHumanAvatarSelection, getHumanAvatarSelection, () => DEFAULT_HUMAN_AVATAR);
  const model = AVATAR_MODELS.find(candidate => candidate.id === modelId) ?? AVATAR_MODELS[0];
  const [retry, setRetry] = useState(0);
  const labels: Record<AvatarState, string> = uk
    ? { idle: 'Готовність до роботи', listening: 'Слухає вас', thinking: 'Обробка відповіді', speaking: 'Говорить' }
    : { idle: 'Готовность к работе', listening: 'Слушает вас', thinking: 'Обработка ответа', speaking: 'Говорит' };

  return <div className={styles.root} data-compact={compact} role="group" aria-label={uk ? 'Співрозмовник' : 'Собеседник'}>
    <AvatarPortrait key={`${model.id}:${retry}`} model={model} state={state} analyser={analyser} uk={uk} retry={() => setRetry(value => value + 1)} />
    <div className={styles.details}>
      <label className={styles.label} htmlFor={selectId}>{uk ? 'Оберіть аватара' : 'Выберите аватара'}</label>
      <select id={selectId} className={styles.select} value={model.id} onChange={event => setHumanAvatarSelection(event.target.value)}>
        {AVATAR_MODELS.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
      </select>
      <span className={styles.state} role="status">{labels[state]}</span>
      <small className={styles.credit}>{model.credit}</small>
    </div>
  </div>;
}

function AvatarPortrait({ model, state, analyser, uk, retry }: {
  model: AvatarModel; state: AvatarState; analyser: AnalyserNode | null; uk: boolean; retry: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const avatar = useRef<TutorAvatar | null>(null);
  const inputs = useRef({ state, analyser });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    inputs.current = { state, analyser };
    avatar.current?.setState(state);
    avatar.current?.attachAnalyser(state === 'speaking' ? analyser : null);
  }, [state, analyser]);

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    // Each effect owns its host: an older init must never render into the next StrictMode setup.
    const mount = document.createElement('div');
    mount.style.cssText = 'width:100%;height:100%;';
    target.appendChild(mount);
    let cancelled = false;
    let initializing = false;
    let instance: TutorAvatar | null = null;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => {
      instance?.setAutonomy(!motion.matches);
      instance?.setFollowPointer(!motion.matches);
    };
    const dispose = () => {
      if (avatar.current === instance) avatar.current = null;
      mount.remove();
      // init awaits both GLTF and the first motion. setBase can still touch its mixer after that await.
      // Let initialization settle before freeing the scene; the detached host cannot replace a newer one.
      if (initializing) return;
      const previous = instance;
      instance = null;
      try { previous?.dispose(); }
      catch (error) { console.error('[HumanTutorAvatar] Could not dispose avatar.', error); }
    };
    motion.addEventListener('change', syncMotion);
    // The renderer and all model assets are requested only after this portrait mounts.
    void import('./tutorAvatar').then(async ({ TutorAvatar }) => {
      if (cancelled) return;
      instance = new TutorAvatar(mount, {
        url: model.url, motions: model.motions, framing: 'portrait',
        autonomy: !motion.matches, followPointer: !motion.matches,
      });
      initializing = true;
      try { await instance.init(); }
      finally {
        initializing = false;
        if (cancelled) dispose();
      }
      if (cancelled || !instance) return;
      avatar.current = instance;
      instance.setState(inputs.current.state);
      instance.attachAnalyser(inputs.current.state === 'speaking' ? inputs.current.analyser : null);
      setReady(true);
    }).catch(error => {
      if (cancelled) return;
      console.error('[HumanTutorAvatar] Could not load avatar.', error);
      dispose();
      setFailed(true);
    });
    return () => {
      cancelled = true;
      motion.removeEventListener('change', syncMotion);
      dispose();
    };
  }, [model.url, model.motions]);

  return <div className={styles.portrait}>
    <div ref={host} className={styles.canvas} aria-hidden="true" />
    {!ready && <div className={styles.fallback} role="status">
      <i className="pi pi-user" aria-hidden="true" />
      {failed ? <><span>{uk ? 'Аватар недоступний' : 'Аватар недоступен'}</span><button type="button" onClick={retry}>{uk ? 'Повторити' : 'Повторить'}</button></>
        : <span>{uk ? 'Завантаження аватара…' : 'Загрузка аватара…'}</span>}
    </div>}
  </div>;
}

export default HumanTutorAvatar;
