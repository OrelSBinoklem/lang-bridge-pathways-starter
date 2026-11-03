'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Dialog } from 'primereact/dialog';
import Link from 'next/link';
import { clientApi } from '@/lib/client-api';
import styles from './credits.module.css';
import { operationLabel } from './operation-labels';
import { CreditStatistics } from './CreditStatistics';
import { CREDIT_BALANCE_UPDATED, watchCreditBalance } from '@/lib/credit-refresh';

type Operation = { id: string; kind: string; purpose?: string; model: string | null; status: string; amount_micros: number;
  reserved_micros: number; commission_bps: number; cost_micros: number | null; created_at: string };
type Balance = { balance: number; available: number; reserved: number; commission_percent: number; enabled: boolean; history: Operation[] };

export function CreditBalance({ onOpen }: { onOpen?: () => void }) {
  const uk = useLocale() === 'uk';
  const [data, setData] = useState<Balance | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const refreshRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const watcher = watchCreditBalance(async signal => {
      const result = await clientApi<{ data: Balance }>('/me/credits', { signal });
      if (!signal.aborted) {
        setData(result.data); setError('');
        window.dispatchEvent(new CustomEvent(CREDIT_BALANCE_UPDATED, { detail: result.data.available }));
      }
    }, () => setError(uk ? 'Не вдалося оновити баланс' : 'Не удалось обновить баланс'));
    refreshRef.current = watcher.refresh;
    return () => { refreshRef.current = null; watcher.stop(); };
  }, [uk]);
  useEffect(() => { if (open) refreshRef.current?.(); }, [open]);
  const number = (value: number, fractionDigits?: number) => value.toLocaleString(uk ? 'uk-UA' : 'ru-RU', {
    minimumFractionDigits: fractionDigits ?? 0,
    maximumFractionDigits: fractionDigits ?? 6,
  });
  const status = (value: string) => ({ settled: uk ? 'Проведено' : 'Проведено', reserved: uk ? 'Резерв' : 'Резерв',
    review: uk ? 'На перевірці' : 'На проверке', released: uk ? 'Резерв знято' : 'Резерв снят' })[value] || value;
  return <>
    <button className={styles.balance} type="button" onClick={() => { onOpen?.(); setOpen(true); }} title={uk ? 'Баланс кредитів' : 'Баланс кредитов'}>
      <i className="pi pi-wallet" aria-hidden /> {data ? number(data.available, 2) : '…'} {uk ? 'кредитів' : 'кредитов'}
    </button>
    <Dialog header={uk ? 'Кредити' : 'Кредиты'} visible={open} onHide={() => setOpen(false)} style={{ width: '760px', maxWidth: '96vw' }} draggable={false} baseZIndex={12000}>
      {error && <p role="alert">{error}</p>}
      {data && <div className={styles.content}>
        <dl className={styles.summary}>
          <div><dt>{uk ? 'Доступно' : 'Доступно'}</dt><dd>{number(data.available)}</dd></div>
          <div><dt>{uk ? 'У резерві' : 'В резерве'}</dt><dd>{number(data.reserved)}</dd></div>
          <div><dt>{uk ? 'Комісія' : 'Комиссия'}</dt><dd>{data.commission_percent}%</dd></div>
        </dl>
        <p>1 {uk ? 'кредит' : 'кредит'} = $1. {uk ? 'Списання' : 'Списание'} = {uk ? 'витрати API' : 'расход API'} / (1 − {uk ? 'комісія' : 'комиссия'} / 100).</p>
        <p>{uk ? 'Звичайні заняття безкоштовні назавжди, без підписки. ШІ-запити та ШІ-перевірки завдань та іспитів оплачуються кредитами за фактичними витратами. Для поповнення зверніться до адміністратора.' : 'Обычные занятия бесплатны навсегда, без подписки. ИИ-запросы и AI-проверки заданий и экзаменов оплачиваются кредитами по фактическому расходу. Для пополнения обратитесь к администратору.'}</p>
        <p><Link href="/plans" onClick={() => setOpen(false)}>{uk ? 'Безкоштовний доступ та ШІ' : 'Бесплатный доступ и ИИ'} <i className="pi pi-arrow-right" aria-hidden /></Link></p>
        {data.reserved > 0 && <p>{uk ? 'Резерв не є списанням. Якщо відповідь провайдера обірвалася, суму перевірить адміністратор.' : 'Резерв не является списанием. Если ответ провайдера оборвался, сумму проверит администратор.'}</p>}
        {open && <CreditStatistics uk={uk} refreshKey={data.history.map(op => `${op.id}:${op.status}:${op.amount_micros}`).join('|')} />}
        <h3>{uk ? 'Останні операції' : 'Последние операции'}</h3>
        {!data.history.length ? <p>{uk ? 'Операцій ще немає' : 'Операций пока нет'}</p> : <div className={styles.scroll}><table>
          <thead><tr><th>{uk ? 'Дата' : 'Дата'}</th><th>{uk ? 'Операція' : 'Операция'}</th><th>{uk ? 'Кредити' : 'Кредиты'}</th><th>{uk ? 'Стан' : 'Статус'}</th></tr></thead>
          <tbody>{data.history.map(op => <tr key={op.id}><td>{op.created_at}</td><td>{operationLabel(op, uk)}{op.model && <small className={styles.model}>{op.model}</small>}</td>
            <td>{op.amount_micros > 0 ? '+' : ''}{number(op.amount_micros / 1000000)}</td><td>{status(op.status)}</td></tr>)}</tbody>
        </table></div>}
      </div>}
    </Dialog>
  </>;
}
