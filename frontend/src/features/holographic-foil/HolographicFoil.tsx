'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    artwork,
    createFoilRenderer,
    foilDefaults,
    type FoilRenderer,
    type FoilSettings,
} from './foilRenderer';
import styles from './holographic-foil.module.css';

const controls = [
    ['strength', 'Сила перелива', 0, 2, 0.01],
    ['density', 'Плотность (кругов по высоте)', 3, 14, 0.5],
    ['scale', 'Размер кругов (налезают)', 0.5, 1.6, 0.05],
    ['gloss', 'Серебристый блик', 0, 1, 0.01],
    ['response', 'Скорость отклика', 1, 12, 0.5],
    ['exposure', 'Яркость картинки', 0.5, 1.5, 0.01],
] as const;

export function HolographicFoil({ embedded = false, onStop }: { embedded?: boolean; onStop?: () => void }) {
    const root = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const engine = useRef<FoilRenderer | null>(null);
    const [settings, setSettings] = useState(foilDefaults);
    const [panel, setPanel] = useState(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const [size, setSize] = useState('');
    // Over the whole screen (owner: «на весь экран раскрыть для теста»): the browser's fullscreen where it can, else the
    // card is lifted into the top layer as a popover (above the site's header) and covers the window. Esc (or the
    // button) brings it back.
    const [expanded, setExpanded] = useState(false);
    useEffect(() => {
        if (!expanded) return;
        const left = () => {
            if (!document.fullscreenElement) setExpanded(false);
        };
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setExpanded(false);
        };
        const el = root.current;
        document.addEventListener('fullscreenchange', left);
        window.addEventListener('keydown', key);
        return () => {
            document.removeEventListener('fullscreenchange', left);
            window.removeEventListener('keydown', key);
            if (el?.hasAttribute('popover')) {
                if (el.matches(':popover-open')) el.hidePopover();
                el.removeAttribute('popover');
            }
        };
    }, [expanded]);
    const toggleExpanded = () => {
        if (expanded) {
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
            setExpanded(false);
            return;
        }
        setExpanded(true);
        const el = root.current;
        const lift = () => {
            if (!el || typeof el.showPopover !== 'function') return;
            el.setAttribute('popover', 'manual');
            el.showPopover();
        };
        if (el?.requestFullscreen) el.requestFullscreen().catch(lift);
        else lift();
    };
    useEffect(() => {
        try {
            engine.current = createFoilRenderer(
                canvas.current!,
                foilDefaults,
                () => setReady(true),
                (w, h, dpr) => setSize(`${w} × ${h} · DPR ${dpr.toFixed(2)}`),
                setError,
            );
        } catch (cause) {
            console.error('[holographic-foil]', cause);
            // The renderer can fail before texture loading on unsupported devices.
            queueMicrotask(() =>
                setError('WebGL недоступен. Показана исходная иллюстрация.'),
            );
        }
        return () => {
            engine.current?.dispose();
            engine.current = null;
        };
    }, []);
    useEffect(() => {
        engine.current?.update(settings);
    }, [settings]);
    const change = <K extends keyof FoilSettings>(
        key: K,
        value: FoilSettings[K],
    ) => setSettings((current) => ({ ...current, [key]: value }));
    return (
        <div ref={root} className={`${styles.root} ${embedded && !expanded ? styles.embedded : ''} ${expanded ? styles.expanded : ''}`}>
            <header className={styles.toolbar}>
                {embedded ? (
                    <button type="button" className={styles.icon} onClick={onStop} title="Остановить эффект" aria-label="Остановить эффект">
                        <i className="pi pi-stop" />
                    </button>
                ) : (
                    <Link className={styles.icon} href="/course" title="К курсу" aria-label="К курсу">
                        <i className="pi pi-arrow-left" />
                    </Link>
                )}
                <h1>Голографический остров</h1>
                <div className={styles.switches}>
                <div className={styles.modes} role="group" aria-label="Картинка">
                    <button aria-pressed={settings.art === 0} onClick={() => change('art', 0)} title="Цветной остров под прозрачной голограммой">
                        Остров
                    </button>
                    <button aria-pressed={settings.art === 1} onClick={() => change('art', 1)} title="Монотонная техническая картинка на серебряной фольге, как на картридже">
                        Серебро
                    </button>
                </div>
                <div
                    className={styles.modes}
                    role="group"
                    aria-label="Материал"
                >
                    <button
                        aria-pressed={!settings.original}
                        onClick={() => change('original', false)}
                    >
                        Голограмма
                    </button>
                    <button
                        aria-pressed={settings.original}
                        onClick={() => change('original', true)}
                    >
                        Оригинал
                    </button>
                </div>
                </div>
                <div className={styles.tools}>
                    <button
                        className={styles.icon}
                        title={
                            settings.frozen
                                ? 'Отпустить свет'
                                : 'Зафиксировать свет'
                        }
                        aria-label={
                            settings.frozen
                                ? 'Отпустить свет'
                                : 'Зафиксировать свет'
                        }
                        aria-pressed={settings.frozen}
                        onClick={() => change('frozen', !settings.frozen)}
                    >
                        <i
                            className={`pi ${settings.frozen ? 'pi-lock' : 'pi-unlock'}`}
                        />
                    </button>
                    <button
                        className={styles.icon}
                        title="Сбросить настройки"
                        aria-label="Сбросить настройки"
                        onClick={() => setSettings({ ...foilDefaults, art: settings.art })}
                    >
                        <i className="pi pi-refresh" />
                    </button>
                    <button
                        className={styles.icon}
                        title={expanded ? 'Свернуть' : 'На весь экран'}
                        aria-label={expanded ? 'Свернуть' : 'На весь экран'}
                        aria-pressed={expanded}
                        onClick={toggleExpanded}
                    >
                        <i className={`pi ${expanded ? 'pi-window-minimize' : 'pi-window-maximize'}`} />
                    </button>
                    <button
                        className={styles.icon}
                        title="Настройки"
                        aria-label="Настройки"
                        aria-expanded={panel}
                        onClick={() => setPanel(!panel)}
                    >
                        <i className="pi pi-sliders-h" />
                    </button>
                </div>
            </header>
            <main className={styles.stage}>
                <canvas
                    ref={canvas}
                    aria-label="Остров с круговой голографической фольгой"
                />
                {(!ready || error) && (
                    <Image
                        src={artwork}
                        alt="Остров с каменными арками и водопадами"
                        fill
                        priority
                        unoptimized
                        className={styles.fallback}
                    />
                )}
                {!ready && !error && (
                    <div className={styles.message} role="status">
                        Загрузка материала…
                    </div>
                )}
                {error && (
                    <div className={styles.message} role="alert">
                        {error}
                    </div>
                )}
            </main>
            {panel && (
                <aside
                    className={styles.panel}
                    aria-label="Настройки голограммы"
                >
                    <div className={styles.panelTitle}>
                        <h2>Голографическая фольга</h2>
                        <button
                            className={styles.icon}
                            aria-label="Закрыть настройки"
                            title="Закрыть настройки"
                            onClick={() => setPanel(false)}
                        >
                            <i className="pi pi-times" />
                        </button>
                    </div>
                    {controls.map(([key, label, min, max, step]) => (
                        <label key={key} className={styles.slider}>
                            <span>{label}</span>
                            <output>{settings[key].toFixed(2)}</output>
                            <input
                                aria-label={label}
                                type="range"
                                min={min}
                                max={max}
                                step={step}
                                value={settings[key]}
                                onChange={(e) =>
                                    change(key, Number(e.target.value))
                                }
                            />
                        </label>
                    ))}
                </aside>
            )}
            <footer className={styles.status}>
                <span>
                    {error
                        ? 'Исходная иллюстрация'
                        : settings.original
                          ? settings.art === 1 ? 'Оригинал: серебро' : 'Оригинал'
                          : settings.frozen
                            ? 'Свет зафиксирован'
                            : settings.art === 1 ? 'Серебряная голографическая фольга' : 'Голографическая фольга'}
                </span>
                <span>{size}</span>
            </footer>
        </div>
    );
}
