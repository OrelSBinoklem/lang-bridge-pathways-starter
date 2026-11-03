'use client';
import { useId, type Ref } from 'react';
import styles from './table-bot.module.css';
/** Same character in the lab and live grammar MCP. */
export function OctopusFace({ pupils }: { pupils?: Ref<SVGGElement> }) {
  const skinId = useId();
  return (
        <svg viewBox="0 0 200 170" aria-label="Осьминог-табличник">
          <defs>
            <radialGradient id={skinId} cx="38%" cy="30%" r="75%"><stop offset="0" stopColor="#ffb1dd" /><stop offset=".55" stopColor="#c27af0" /><stop offset="1" stopColor="#7e48c9" /></radialGradient>
          </defs>
          <path className={styles.mantle} d="M100 8C150 8 178 46 176 92c-1 30-14 52-30 62-14 8-30 10-46 10s-32-2-46-10C38 144 25 122 24 92 22 46 50 8 100 8Z" fill={`url(#${skinId})`} />
          <g className={styles.spots}><circle cx="58" cy="52" r="7" /><circle cx="140" cy="44" r="5" /><circle cx="152" cy="74" r="8" /><circle cx="70" cy="30" r="4" /></g>
          <g className={styles.eyesOpen}>
            <ellipse cx="74" cy="96" rx="19" ry="23" className={styles.white} /><ellipse cx="126" cy="96" rx="19" ry="23" className={styles.white} />
            <g ref={pupils}>
              <circle cx="74" cy="99" r="12" className={styles.iris} /><circle cx="126" cy="99" r="12" className={styles.iris} />
              <circle cx="69" cy="93" r="4.5" fill="#fff" /><circle cx="121" cy="93" r="4.5" fill="#fff" /><circle cx="78" cy="104" r="2" fill="#fff" /><circle cx="130" cy="104" r="2" fill="#fff" />
            </g>
          </g>
          <g className={styles.eyesHappy}><path d="M58 102q16-18 32 0" /><path d="M110 102q16-18 32 0" /></g>
          <g className={styles.glasses}><circle cx="74" cy="96" r="25" /><circle cx="126" cy="96" r="25" /><path d="M99 92q1-5 2 0" /></g>
          <ellipse cx="52" cy="126" rx="11" ry="6" className={styles.blush} /><ellipse cx="148" cy="126" rx="11" ry="6" className={styles.blush} />
          <path className={styles.smile} d="M88 132q12 10 24 0" /><ellipse className={styles.talk} cx="100" cy="134" rx="9" ry="7" />
          <g className={styles.cap}><path d="M60 14 100 -2 140 14 100 30Z" /><path d="M78 20v12q22 10 44 0V20" /><path className={styles.tassel} d="M138 14v22" /><circle className={styles.tassel} cx="138" cy="38" r="4" /></g>
        </svg>
  );
}
