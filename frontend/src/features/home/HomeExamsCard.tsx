import Link from 'next/link';
import type { LearnLang } from '@/lib/learn-lang';
import { homeDestinations } from './home-destinations';
import styles from './home-learning-hub.module.css';

export function HomeExamsCard({ language, uk }: { language: LearnLang; uk: boolean }) {
  return <Link href={homeDestinations(language).exams} prefetch={false} className={styles.exam} data-home-module="exams">
    <span className={styles.examSeal} aria-hidden="true"><i className="pi pi-check" /><small>A1–B2</small></span>
    <span className={styles.examCopy}><span className={styles.kicker}>04 / {uk ? 'ПЕРЕВІРКА ЗНАНЬ' : 'ПРОВЕРКА ЗНАНИЙ'}</span><strong>{uk ? 'Скласти іспити' : 'Сдать экзамены'}</strong><small>{uk ? 'Перевір, що вже вмієш. Обери свій рівень.' : 'Проверь, что уже умеешь. Выбери свой уровень.'}</small></span>
    <span className={styles.examAction}>{uk ? 'До іспитів' : 'К экзаменам'} <i className="pi pi-arrow-up-right" aria-hidden="true" /></span>
  </Link>;
}
