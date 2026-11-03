import { useId } from 'react';
import { getMasteryTier, MASTERY_LABELS } from './mastery';
import styles from './mastery.module.css';

export function MasteryMark({ percent, uk, prominent = false }: { percent: number | null; uk: boolean; prominent?: boolean }) {
  const id = useId();
  const tier = getMasteryTier(percent);
  if (tier === 'none' || tier === 'unknown') return null;
  const label = MASTERY_LABELS[tier][uk ? 'uk' : 'ru'];
  return <span className={`${styles.badge} ${prominent ? styles.prominent : ''}`} data-mastery-tier={tier} aria-label={`${uk ? 'Ранг' : 'Ранг'}: ${label}`}>
    <svg viewBox="0 0 40 42" fill="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id={id} x1="9" y1="6" x2="34" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="var(--medal-light)" /><stop offset=".43" stopColor="var(--medal-mid)" /><stop offset=".6" stopColor="var(--medal-light)" /><stop offset="1" stopColor="var(--medal-dark)" /></linearGradient></defs>
      {tier === 'diamond' ? <>
        <path d="M9 8H31L38 19L20 39L2 19Z" fill={`url(#${id})`} stroke="var(--medal-edge)" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M9 8L13 19L20 39L27 19L31 8M2 19H38M9 8L20 19L31 8M13 19L20 8L27 19" stroke="var(--medal-edge)" strokeWidth="1.1" strokeOpacity=".75" strokeLinejoin="round" />
        <path d="M9 8L13 19H2ZM20 8L27 19H13Z" fill="white" fillOpacity=".6" />
        <path d="M27 19L20 39L38 19Z" fill="var(--medal-dark)" fillOpacity=".25" />
        <path d="M32 2V7M29.5 4.5H34.5" stroke="var(--medal-edge)" strokeWidth="1.2" strokeLinecap="round" />
      </> : <>
        <path d="M11 25L6 40L15 35L20 40L23 27M24 26L31 40L33 33L39 34L30 22" fill="var(--medal-dark)" stroke="var(--medal-edge)" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M20 3L25 5L31 5L34 10L38 14L36 20L36 26L30 29L26 33L20 31L14 33L10 29L4 26L4 20L2 14L6 10L9 5L15 5Z" fill={`url(#${id})`} stroke="var(--medal-edge)" strokeWidth="1.2" />
        <circle cx="20" cy="18" r="10.2" fill="var(--medal-light)" fillOpacity=".4" stroke="var(--medal-edge)" strokeWidth=".8" />
        <path d="M14 18L18 22L27 13" stroke="var(--medal-edge)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </>}
    </svg>
    <span>{label}</span>
  </span>;
}
