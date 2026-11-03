'use client';

import { useLocale } from 'next-intl';
import styles from './plans.module.css';
import { TutorPresetPicker } from '@/features/tutor/TutorPresetPicker';
import { useTutorPresets } from '@/features/tutor/useTutorPresets';

export type Subscription = { enabled: boolean; active: boolean; user_id: number; status: string; trial_until?: string | null; paid_until?: string | null; access_until?: string | null; price_credits?: number };

export function AccessPlans() {
  const uk = useLocale() === 'uk';
  const presets = useTutorPresets();
  const t = (ru: string, ua: string) => uk ? ua : ru;
  const standardFeatures = [
    ['pi-book', t('Тренажёр слов', 'Тренажер слів')],
    ['pi-table', t('Тренажёр грамматики', 'Тренажер граматики')],
    ['pi-headphones', t('Практика - слушание и чтение', 'Практика - аудіювання та читання')],
  ] as const;
  const aiFeatures = [
    ['pi-comments', t('Практика письма и разговоров по темам курса', 'Практика письма та розмов за темами курсу')],
    ['pi-check-circle', t('Проверка переводов и письменных ответов с объяснением ошибок', 'Перевірка перекладів і письмових відповідей із поясненням помилок')],
    ['pi-table', t('Объяснение грамматики и помощь с таблицами', 'Пояснення граматики та допомога з таблицями')],
    ['pi-file-check', t('Экзамены с AI-проверкой свободных ответов', 'Іспити з ШІ-перевіркою вільних відповідей')],
  ] as const;
  return <section className={styles.page}>
    <h1>{t('Доступ к ИИ услугам', 'Доступ до послуг ШІ')}</h1>
    <div className={styles.offers}>
      <section data-access-plan="standard">
        <p className={styles.free}>{t('Бесплатно', 'Безкоштовно')}</p>
        <ul className={styles.featureList}>{standardFeatures.map(([icon, label]) => <li key={label}><i className={`pi ${icon}`} aria-hidden /><span>{label}</span></li>)}</ul>
      </section>
    </div>
    <section className={styles.aiAccess} data-access-plan="ai"><h2>{t('ИИ — по расходу кредитов', 'ШІ — за витратами кредитів')}</h2>
      <p className={styles.note}>1 кредит = $1.</p>
      <ul className={styles.featureList}>{aiFeatures.map(([icon, label]) => <li key={label}><i className={`pi ${icon}`} aria-hidden /><span>{label}</span></li>)}</ul>
    </section>
    <section className={styles.aiPresets}><h2>{t('Режимы AI-репетитора', 'Режими AI-репетитора')}</h2>
      <p className={styles.note}>{t('Режимы можно менять в любой момент, и они определяют скорость расхода ваших кредитов.', 'Режими можна змінювати будь-якої миті, і вони визначають швидкість витрачання ваших кредитів.')}</p>
      <TutorPresetPicker data={presets.data} selected={presets.selected} onSelect={presets.select} />
      {presets.error && <p role="alert">{presets.error}</p>}
    </section>
  </section>;
}
