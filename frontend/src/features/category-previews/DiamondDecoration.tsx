import type { DiamondTreatment } from './types';
import styles from './diamond-decoration.module.css';

function Gem({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 28" fill="none" aria-hidden="true">
    <path d="M7 2H25L31 11L16 27L1 11Z" fill="var(--gem-face, #b9def4)" stroke="#5285a2" strokeWidth=".8" strokeLinejoin="round" />
    <path d="M7 2L10 11H1ZM16 2L22 11H10ZM25 2L31 11H22Z" fill="#f5feff" fillOpacity=".9" />
    <path d="M1 11L16 27L10 11ZM22 11L16 27L31 11Z" fill="#447fb8" fillOpacity=".5" />
    <path d="M10 11L16 27L22 11Z" fill="#d4f9ff" fillOpacity=".85" />
    <path d="M7 2L10 11L16 27L22 11L25 2M1 11H31M7 2L16 11L25 2" stroke="#6b9fb7" strokeWidth=".6" />
    <path d="M4 8L12 5L23 8L19 13L9 12Z" fill="#fff" className={styles.facet} />
  </svg>;
}

export function DiamondDecoration({ treatment, uk }: { treatment: DiamondTreatment; uk: boolean }) {
  return <span className={`${styles.decoration} ${styles[treatment]}`} data-diamond-decoration="" aria-hidden="true">
    {treatment !== 'corners' && <svg className={styles.seal} viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2" /><circle cx="50" cy="50" r="38" stroke="currentColor" /><path d="M43 15H57L62 22L50 34L38 22Z" fill="currentColor" /><text x="50" y="57" textAnchor="middle" fill="currentColor" fontSize="24" fontFamily="Georgia, serif">100%</text><text x="50" y="75" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="700" letterSpacing="1">{uk ? 'ВИВЧЕНО' : 'ВЫУЧЕНО'}</text></svg>}
    {treatment === 'corners' && <>{['nw', 'ne', 'sw', 'se'].map(corner => <Gem key={corner} className={`${styles.gem} ${styles[corner]}`} />)}<span className={styles.cornerLines} /></>}
    {treatment === 'setting' && <span className={styles.rim} />}
    <span className={styles.reflection} />
  </span>;
}
