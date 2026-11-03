'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    createStreetRenderer,
    defaults,
    lightDepths,
    type StreetRenderer,
    type StreetSettings,
    type StreetStats,
} from './streetRenderer';
import styles from './street-relight.module.css';

const colors = [
    { value: '#ffe2ae', title: 'Тёплый' },
    { value: '#ffffff', title: 'Белый' },
    { value: '#abcfff', title: 'Холодный' },
    { value: '#ffac85', title: 'Медный' },
];

export function StreetRelight({ onExit }: { onExit?: () => void } = {}) {
    const root = useRef<HTMLDivElement>(null),
        canvas = useRef<HTMLCanvasElement>(null),
        lightMarker = useRef<HTMLDivElement>(null),
        engine = useRef<StreetRenderer | null>(null);
    const [settings, setSettings] = useState<StreetSettings>(defaults);
    const [stats, setStats] = useState<StreetStats | null>(null);
    const [error, setError] = useState('');
    const [panel, setPanel] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [notice, setNotice] = useState('');
    const latestSettings = useRef(settings);
    useEffect(() => {
        let cancelled = false;
        const abort = new AbortController();
        createStreetRenderer(
            canvas.current!,
            defaults,
            (data) => {
                if (!cancelled) setStats(data);
            },
            (message) => {
                if (!cancelled) setError(message);
            },
            abort.signal,
            (x, y) => {
                if (lightMarker.current)
                    lightMarker.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            },
        )
            .then((renderer) => {
                if (cancelled) renderer.dispose();
                else {
                    engine.current = renderer;
                    renderer.update(latestSettings.current);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('[street-relight]', err);
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Не удалось создать сцену.',
                    );
                }
            });
        return () => {
            cancelled = true;
            abort.abort();
            engine.current?.dispose();
            engine.current = null;
        };
    }, []);
    useEffect(() => {
        latestSettings.current = settings;
        engine.current?.update(settings);
    }, [settings]);
    useEffect(() => {
        const update = () =>
            setExpanded(document.fullscreenElement === root.current);
        document.addEventListener('fullscreenchange', update);
        return () => document.removeEventListener('fullscreenchange', update);
    }, []);
    function change<K extends keyof StreetSettings>(
        key: K,
        value: StreetSettings[K],
    ) {
        setSettings((current) => ({ ...current, [key]: value }));
    }
    const slider = (
        key:
            | 'power'
            | 'ambient'
            | 'exposure'
            | 'wet'
            | 'parallax'
            | 'depthTravel'
            | 'depthResponse',
        label: string,
        max: number,
        step = 0.01,
        min = 0,
    ) => (
        <label className={styles.slider}>
            <span>{label}</span>
            <output>{settings[key].toFixed(key === 'parallax' ? 3 : 2)}</output>
            <input
                aria-label={label}
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings[key]}
                onChange={(event) => change(key, Number(event.target.value))}
            />
        </label>
    );
    async function fullscreen() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await root.current?.requestFullscreen();
        } catch {
            setNotice('Полноэкранный режим недоступен в этом браузере.');
        }
    }
    return (
        <div ref={root} className={`${styles.root} ${onExit ? styles.embedded : ''}`}>
            <header className={styles.header}>
                {onExit ? (
                    <button type="button" className={styles.icon} onClick={onExit} title="К эффектам" aria-label="К эффектам">
                        <i className="pi pi-arrow-left" />
                    </button>
                ) : (
                    <Link href="/course" className={styles.icon} title="К курсу" aria-label="К курсу">
                        <i className="pi pi-arrow-left" />
                    </Link>
                )}
                <div className={styles.title}>
                    <h1>Улица после дождя</h1>
                    <span>Световая студия</span>
                </div>
                <div
                    className={styles.modes}
                    role="group"
                    aria-label="Режим отображения"
                >
                    {(
                        [
                            ['scene', 'Сцена'],
                            ['original', 'Оригинал'],
                            ['depth', 'Глубина'],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            aria-pressed={settings.mode === value}
                            onClick={() => change('mode', value)}
                        >
                            {label}
                        </button>
                    ))}
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
                        onClick={() => setSettings({ ...defaults })}
                    >
                        <i className="pi pi-refresh" />
                    </button>
                    <button
                        className={styles.icon}
                        title="Полный экран"
                        aria-label="Полный экран"
                        aria-pressed={expanded}
                        onClick={() => void fullscreen()}
                    >
                        <i
                            className={`pi ${expanded ? 'pi-window-minimize' : 'pi-expand'}`}
                        />
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
                    onClick={(event) => {
                        if (event.button !== 0 || !stats || error) return;
                        setSettings((current) =>
                            current.frozen || current.mode !== 'scene'
                                ? current
                                : {
                                      ...current,
                                      depthStep:
                                          (current.depthStep + 1) %
                                          lightDepths.length,
                                  },
                        );
                    }}
                    aria-label="Трёхмерная сцена улицы с освещением от курсора"
                    className={`${styles.canvas} ${stats && !error && settings.mode === 'scene' && !settings.frozen ? styles.customCursor : ''}`}
                />
                <div
                    ref={lightMarker}
                    className={styles.lightMarker}
                    aria-hidden="true"
                    hidden={!stats || !!error || settings.mode !== 'scene'}
                    style={{ color: settings.color }}
                >
                    <i
                        className={`pi ${settings.frozen ? 'pi-lock' : 'pi-plus'}`}
                    />
                </div>
                {settings.mode === 'scene' && !error && (
                    <div className={styles.depthControl}>
                        <span aria-live="polite" aria-atomic="true">
                            Глубина {settings.depthStep + 1}/5 ·{' '}
                            {lightDepths[settings.depthStep].label}
                        </span>
                        <div role="group" aria-label="Глубина света">
                            {lightDepths.map((depth, index) => (
                                <button
                                    key={depth.distance}
                                    type="button"
                                    aria-label={`Глубина ${index + 1}: ${depth.label}`}
                                    title={depth.label}
                                    aria-pressed={settings.depthStep === index}
                                    disabled={settings.frozen || !stats}
                                    onClick={() => change('depthStep', index)}
                                >
                                    {index + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {!stats && !error && (
                    <div className={styles.loading} role="status">
                        <i className="pi pi-spin pi-spinner" />
                        Подготовка геометрии…
                    </div>
                )}
                {error && (
                    <div className={styles.fallback}>
                        <Image
                            src="/course/street-relight/source.jpg"
                            alt="Исходная фотография улицы"
                            fill
                            unoptimized
                            sizes="100vw"
                        />
                        <div role="alert">
                            {error}
                            <button onClick={() => window.location.reload()}>
                                <i className="pi pi-refresh" /> Повторить
                            </button>
                        </div>
                    </div>
                )}
            </main>
            {panel && (
                <aside
                    className={styles.panel}
                    aria-label="Настройки освещения"
                >
                    <div className={styles.panelHeading}>
                        <h2>Освещение</h2>
                        <button
                            className={styles.icon}
                            title="Закрыть настройки"
                            aria-label="Закрыть настройки"
                            onClick={() => setPanel(false)}
                        >
                            <i className="pi pi-times" />
                        </button>
                    </div>
                    <div
                        className={styles.swatches}
                        role="group"
                        aria-label="Цвет источника"
                    >
                        {colors.map((color) => (
                            <button
                                key={color.value}
                                style={{ backgroundColor: color.value }}
                                title={color.title}
                                aria-label={color.title}
                                aria-pressed={settings.color === color.value}
                                onClick={() => change('color', color.value)}
                            />
                        ))}
                    </div>
                    {slider('power', 'Свет от курсора', 4)}
                    {slider('ambient', 'Фоновый свет', 1.4)}
                    {slider('exposure', 'Экспозиция', 2)}
                    {slider('depthTravel', 'Полёт света в глубину', 1)}
                    {slider('depthResponse', 'Скорость полёта', 12, 0.25, 1)}
                    <div className={styles.separator} />
                    {slider('wet', 'Мокрая мостовая', 1)}
                    {slider('parallax', 'Параллакс', 0.1, 0.005)}
                    <div className={styles.separator} />
                    <label className={styles.select}>
                        Качество запекания
                        <select
                            value={settings.samples}
                            onChange={(e) =>
                                change('samples', Number(e.target.value))
                            }
                        >
                            <option value={32}>Быстрое · 32 spp</option>
                            <option value={64}>Высокое · 64 spp</option>
                            <option value={128}>Ультра · 128 spp</option>
                            <option value={256}>Максимум · 256 spp</option>
                        </select>
                    </label>
                    <label className={styles.select}>
                        Разрешение
                        <select
                            value={settings.resolution}
                            onChange={(e) =>
                                change('resolution', Number(e.target.value))
                            }
                        >
                            <option value={1}>Нативное · DPR монитора</option>
                            <option value={1.25}>Суперсэмплинг · 1.25×</option>
                            <option value={0.75}>
                                Производительность · 0.75×
                            </option>
                        </select>
                    </label>
                    <div className={styles.bakeStatus}>
                        <span>
                            {stats && stats.samples >= stats.target
                                ? 'Свет запечён'
                                : 'Запекание света'}
                        </span>
                        <output>
                            {stats?.samples ?? 0} / {settings.samples}
                        </output>
                        <progress
                            max={settings.samples}
                            value={stats?.samples ?? 0}
                        />
                    </div>
                </aside>
            )}
            <footer className={styles.status}>
                <span role="status">
                    <span className={styles.dot} />
                    {notice ||
                        (settings.frozen
                            ? 'Свет зафиксирован'
                            : 'Свет следует за курсором')}
                </span>
                <span>
                    {stats
                        ? `${stats.width} × ${stats.height} · DPR ${stats.dpr.toFixed(2)} · ${stats.fps} FPS`
                        : 'WebGL2'}
                </span>
            </footer>
        </div>
    );
}
