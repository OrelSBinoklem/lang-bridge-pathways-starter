'use client';

import { useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import styles from './credits.module.css';

type Period = 'hour' | 'day' | 'month';
type Amounts = { incoming_micros: number; spent_micros: number; operations: number };
type Statistics = { period: Period; timezone: string; buckets: (Amounts & { start: string })[]; totals: Amounts };

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shift(date: string, period: Period, direction: number) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, period === 'hour' ? day : 1));
  if (period === 'hour') next.setUTCDate(next.getUTCDate() + direction);
  else if (period === 'day') next.setUTCMonth(next.getUTCMonth() + direction);
  else { next.setUTCMonth(0); next.setUTCFullYear(next.getUTCFullYear() + direction); }
  return next.toISOString().slice(0, 10);
}

function samePeriod(date: string, period: Period) { return date.slice(0, period === 'hour' ? 10 : period === 'day' ? 7 : 4); }

function MoneyChart({ data, uk }: { data: Statistics; uk: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const locale = uk ? 'uk-UA' : 'ru-RU';
  const amount = (micros: number) => (micros / 1000000).toLocaleString(locale, { maximumFractionDigits: 6 });
  const incoming = uk ? 'Поповнення' : 'Пополнения', spent = uk ? 'Списання' : 'Списания';
  const maximum = Math.max(data.totals.operations ? 4 : 1000000, ...data.buckets.flatMap(b => [b.incoming_micros, b.spent_micros]));
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4));
  const step = [1, 2, 2.5, 5, 10].map(n => n * magnitude).find(n => n * 4 >= maximum) ?? maximum / 4;
  const ceiling = step * 4;
  const ticks = Array.from({ length: 5 }, (_, index) => index * step);
  const left = Math.max(38, ...ticks.map(t => amount(t).length * 7 + 12));
  const right = 10, top = 12, height = 178, bottom = top + height;
  const space = (width - left - right) / data.buckets.length;
  const barWidth = Math.max(1.5, Math.min(14, space * .32));
  const y = (value: number) => bottom - value / ceiling * height;
  const label = (start: string, full = false) => new Intl.DateTimeFormat(locale, {
    timeZone: data.timezone,
    ...(data.period === 'hour' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const, ...(full ? { timeZoneName: 'shortOffset' as const } : {}) }
      : data.period === 'day' ? { day: 'numeric', ...(full ? { month: 'long' as const, year: 'numeric' as const } : {}) }
        : { month: full ? 'long' as const : 'short' as const, ...(full ? { year: 'numeric' as const } : {}) }),
  }).format(new Date(start));
  const selected = active === null ? null : data.buckets[active];
  const labelEvery = Math.max(1, Math.ceil(data.buckets.length / (width < 500 ? 5 : 9)));
  return <div ref={host} className={styles.chart}>
    <svg width="100%" height="230" viewBox={`0 0 ${width} 230`} role="group" aria-label={uk ? 'Графік руху кредитів' : 'График движения кредитов'} data-credit-chart="">
      {ticks.map(tick => <g key={tick} className={styles.gridLine}>
        <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} />
        <text x={left - 8} y={y(tick) + 4} textAnchor="end">{amount(tick)}</text>
      </g>)}
      {data.buckets.map((bucket, index) => {
        const x = left + space * (index + .5);
        return <g key={bucket.start} tabIndex={0} role="button" data-credit-bucket={index}
          aria-label={`${label(bucket.start, true)}. ${incoming}: ${amount(bucket.incoming_micros)}. ${spent}: ${amount(bucket.spent_micros)}`}
          aria-pressed={active === index} className={styles.chartBucket}
          onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)}
          onKeyDown={event => {
            if (['Enter', ' '].includes(event.key)) { event.preventDefault(); setActive(index); }
            if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
              event.preventDefault();
              const next = Math.max(0, Math.min(data.buckets.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
              event.currentTarget.parentElement?.querySelector<SVGElement>(`[data-credit-bucket="${next}"]`)?.focus();
            }
          }}>
          <rect x={x - space / 2} y={top} width={space} height={height} fill={active === index ? 'var(--surface-hover, #edf3f1)' : 'transparent'} />
          <rect className={styles.incomingBar} x={x - barWidth - .5} y={y(bucket.incoming_micros)} width={barWidth} height={bottom - y(bucket.incoming_micros)} rx="1" />
          <rect className={styles.spentBar} x={x + .5} y={y(bucket.spent_micros)} width={barWidth} height={bottom - y(bucket.spent_micros)} rx="1" />
          {((index % labelEvery === 0 && (data.buckets.length - 1 - index) * space >= (data.period === 'hour' ? 40 : 26)) || index === data.buckets.length - 1) && <text className={styles.axisLabel} x={x} y={bottom + 24} textAnchor="middle">{label(bucket.start)}</text>}
        </g>;
      })}
      {!data.totals.operations && <text className={styles.emptyChart} x={(left + width - right) / 2} y={top + height / 2} textAnchor="middle">{uk ? 'За цей період операцій немає' : 'За этот период операций нет'}</text>}
    </svg>
    <div className={styles.chartDetail} aria-live="polite">
      {selected ? <><strong>{label(selected.start, true)}</strong><span>{incoming}: +{amount(selected.incoming_micros)}</span><span>{spent}: −{amount(selected.spent_micros)}</span></> : <span>{data.timezone} · {uk ? 'Кредити' : 'Кредиты'} ($)</span>}
    </div>
  </div>;
}

export function CreditStatistics({ uk, refreshKey }: { uk: boolean; refreshKey: string }) {
  const [period, setPeriod] = useState<Period>('day');
  const [date, setDate] = useState(today);
  const [data, setData] = useState<Statistics | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  useEffect(() => {
    const abort = new AbortController();
    setData(null); setError(false);
    const query = new URLSearchParams({ period, date, timezone });
    clientApi<{ data: Statistics }>(`/me/credits/statistics?${query}`, { signal: abort.signal })
      .then(result => { if (!abort.signal.aborted) setData(result.data); })
      .catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [period, date, timezone, refreshKey, retry]);
  const format = (value: number) => (value / 1000000).toLocaleString(uk ? 'uk-UA' : 'ru-RU', { maximumFractionDigits: 6 });
  return <section className={styles.statistics} aria-label={uk ? 'Статистика кредитів' : 'Статистика кредитов'}>
    <div className={styles.chartHeader}>
      <h3>{uk ? 'Статистика' : 'Статистика'}</h3>
      <div className={styles.periods} role="group" aria-label={uk ? 'Групування' : 'Группировка'}>
        {(['hour', 'day', 'month'] as const).map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>
          {({ hour: uk ? 'По годинах' : 'По часам', day: uk ? 'По днях' : 'По дням', month: uk ? 'По місяцях' : 'По месяцам' })[value]}
        </button>)}
      </div>
    </div>
    <div className={styles.chartNavigation}>
      <button type="button" aria-label={uk ? 'Попередній період' : 'Предыдущий период'} title={uk ? 'Попередній період' : 'Предыдущий период'} onClick={() => setDate(shift(date, period, -1))}><i className="pi pi-angle-left" aria-hidden /></button>
      {period === 'month' ? <input key={date.slice(0, 4)} aria-label={uk ? 'Рік' : 'Год'} type="number" min="1900" max={new Date().getFullYear()} defaultValue={Number(date.slice(0, 4))}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        onBlur={event => { if (event.currentTarget.validity.valid && event.currentTarget.value.length === 4) setDate(`${event.currentTarget.value}-01-01`); else event.currentTarget.value = date.slice(0, 4); }} />
        : <input aria-label={period === 'hour' ? (uk ? 'Дата' : 'Дата') : (uk ? 'Місяць' : 'Месяц')} type={period === 'hour' ? 'date' : 'month'}
          max={today().slice(0, period === 'hour' ? 10 : 7)} value={date.slice(0, period === 'hour' ? 10 : 7)}
          onChange={event => { if (event.currentTarget.validity.valid && event.target.value) setDate(period === 'hour' ? event.target.value : `${event.target.value}-01`); }} />}
      <button type="button" aria-label={uk ? 'Наступний період' : 'Следующий период'} title={uk ? 'Наступний період' : 'Следующий период'} disabled={samePeriod(date, period) >= samePeriod(today(), period)} onClick={() => setDate(shift(date, period, 1))}><i className="pi pi-angle-right" aria-hidden /></button>
      <button type="button" aria-label={uk ? 'Поточний період' : 'Текущий период'} title={uk ? 'Поточний період' : 'Текущий период'} onClick={() => setDate(today())}><i className="pi pi-calendar" aria-hidden /></button>
    </div>
    {data ? <>
      <dl className={styles.chartTotals}>
        <div><dt><span className={styles.incomingSwatch} />{uk ? 'Поповнення' : 'Пополнения'}</dt><dd>+{format(data.totals.incoming_micros)}</dd></div>
        <div><dt><span className={styles.spentSwatch} />{uk ? 'Списання' : 'Списания'}</dt><dd>−{format(data.totals.spent_micros)}</dd></div>
        <div><dt>{uk ? 'Зміна' : 'Изменение'}</dt><dd>{data.totals.incoming_micros >= data.totals.spent_micros ? '+' : '−'}{format(Math.abs(data.totals.incoming_micros - data.totals.spent_micros))}</dd></div>
      </dl>
      <MoneyChart key={`${period}:${date}:${timezone}`} data={data} uk={uk} />
    </> : <div className={styles.chartState} role={error ? 'alert' : 'status'}>
      <span>{error ? (uk ? 'Не вдалося завантажити статистику' : 'Не удалось загрузить статистику') : (uk ? 'Завантаження…' : 'Загрузка…')}</span>
      {error && <button type="button" onClick={() => setRetry(value => value + 1)} aria-label={uk ? 'Повторити' : 'Повторить'} title={uk ? 'Повторити' : 'Повторить'}><i className="pi pi-refresh" aria-hidden /></button>}
    </div>}
  </section>;
}
