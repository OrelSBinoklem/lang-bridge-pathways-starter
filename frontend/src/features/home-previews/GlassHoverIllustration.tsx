'use client';

import { useId } from 'react';
import { BookPageTurn } from './BookPageTurn';
import styles from './glass-hover-illustration.module.css';

const ART = '/course/categories/transparent/';

/** Registered 400 × 400 scenes. Motion belongs to individual parts, not the image plane. */
export default function GlassHoverIllustration({ index, className }: { index: number; className: string }) {
  const id = useId().replace(/:/g, '');
  if (index === 0) return <svg viewBox="0 0 400 400" aria-hidden="true" className={`${className} ${styles.scene}`} data-scene="greeting">
    <defs>
      <clipPath id={`${id}-man`}><path d="M6 107Q15 96 23 104L28 98Q35 95 39 110L42 101Q49 97 54 114L60 109Q68 110 72 134L77 141Q85 127 94 129Q101 132 92 145L72 173Q65 183 65 194L79 222Q91 246 74 263Q52 281 23 267Q5 259 3 237L12 191L20 173Q10 155 8 136Z" /></clipPath>
      <clipPath id={`${id}-woman`}><path d="M342 192L344 174Q345 163 351 170L354 160Q359 153 363 166L368 158Q374 157 374 172L379 167Q386 167 384 183L388 179Q395 179 389 196L379 215Q375 223 376 236L384 262Q383 288 365 301Q344 308 327 293L324 266L334 230L337 215Q325 204 326 197Q330 192 342 204Z" /></clipPath>
    </defs>
    <image href="/home-previews/hover/greeting-body-v1.webp" width="400" height="400" />
    <g transform="translate(-6 -12)"><g className={styles.manArm}><image href={`${ART}1763-light.webp`} width="400" height="400" clipPath={`url(#${id}-man)`} /></g></g>
    <g transform="translate(0 0)"><g className={styles.womanArm}><image href={`${ART}1763-light.webp`} width="400" height="400" clipPath={`url(#${id}-woman)`} /></g></g>
  </svg>;

  if (index === 1) return <svg viewBox="0 0 400 400" aria-hidden="true" className={`${className} ${styles.scene}`} data-scene="family">
    <defs>
      <radialGradient id={`${id}-bird`} cx="30%" cy="20%"><stop stopColor="#a7d8df" /><stop offset=".55" stopColor="#578fa9" /><stop offset="1" stopColor="#2d5976" /></radialGradient>
      <linearGradient id={`${id}-wing`}><stop stopColor="#87bdc9" /><stop offset="1" stopColor="#3c6b86" /></linearGradient>
      <clipPath id={`${id}-dad-eyes`}><ellipse cx="140" cy="153" rx="8" ry="8" /><ellipse cx="168" cy="159" rx="8" ry="8" /></clipPath>
      <clipPath id={`${id}-mom-eyes`}><ellipse cx="218" cy="197" rx="7" ry="7" /><ellipse cx="241" cy="187" rx="7" ry="7" /></clipPath>
      <clipPath id={`${id}-kid-eyes`}><ellipse cx="174" cy="253" rx="7" ry="7" /><ellipse cx="199" cy="248" rx="7" ry="7" /></clipPath>
    </defs>
    <image href={`${ART}1766-light.webp`} width="400" height="400" />
    <g clipPath={`url(#${id}-dad-eyes)`} className={styles.dadBlink}><path fill="#eeb780" d="M128 142H180V170H128Z" /><path d="M134 154q6 4 12 0m16 6q6 4 12 0" fill="none" stroke="#6f432a" strokeWidth="2" strokeLinecap="round" /></g>
    <g clipPath={`url(#${id}-mom-eyes)`} className={styles.momBlink}><path fill="#f2bd88" d="M208 176H253V209H208Z" /><path d="M213 198q5 3 10-1m13-10q5 3 10-1" fill="none" stroke="#75402c" strokeWidth="1.8" strokeLinecap="round" /></g>
    <g clipPath={`url(#${id}-kid-eyes)`} className={styles.kidBlink}><path fill="#f4c28b" d="M163 237H211V265H163Z" /><path d="M169 254q5 3 10-1m15-5q5 3 10-1" fill="none" stroke="#70442d" strokeWidth="1.8" strokeLinecap="round" /></g>
    <g className={styles.birdTravel}>
      <ellipse className={styles.birdShadow} cx="0" cy="20" rx="12" ry="3" fill="#593a29" opacity=".16" />
      <path d="M-12 5l-14-9 5 13 12 1" fill="#426d87" stroke="#2f5972" strokeWidth=".8" />
      <path d="M-5 11l-1 7m8-8 2 7m-12 1h5m5-1h5" stroke="#886b46" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="0" cy="2" rx="15" ry="11" fill={`url(#${id}-bird)`} />
      <ellipse cx="5" cy="5" rx="8" ry="7" fill="#d4ccab" opacity=".9" />
      <g className={styles.birdWing}><path d="M-7-1Q-21-24-13-26Q0-20 4 2Q-3 11-9 5Z" fill={`url(#${id}-wing)`} stroke="#32637d" strokeWidth=".7" /><path d="M-12-19l5 17m0-13 4 13" stroke="#abcbd0" strokeWidth="1" opacity=".6" /></g>
      <circle cx="10" cy="-6" r="9" fill={`url(#${id}-bird)`} /><path d="M17-7l8 3-8 3" fill="#d6a258" /><circle cx="12" cy="-8" r="2.1" fill="#173e52" /><circle cx="12.6" cy="-8.7" r=".7" fill="#fff" />
    </g>
  </svg>;

  if (index === 2) return <svg viewBox="0 0 400 400" aria-hidden="true" className={`${className} ${styles.scene}`} data-scene="city">
    <defs>
      <radialGradient id={`${id}-sun`}><stop stopColor="#fff6c7" /><stop offset=".65" stopColor="#f3cc79" /><stop offset="1" stopColor="#dfa64d" /></radialGradient>
      <radialGradient id={`${id}-moon`} cx="30%" cy="20%"><stop stopColor="#ffffdf" /><stop offset="1" stopColor="#d9d5bc" /></radialGradient>
      <radialGradient id={`${id}-window-light`}><stop stopColor="#ffdf94" /><stop offset="1" stopColor="#d49a48" /></radialGradient>
    </defs>
    <image className={styles.cityGround} href={`${ART}1765-light.webp`} width="400" height="400" />
    <g className={styles.windowGlow} fill={`url(#${id}-window-light)`} stroke="#73522f" strokeWidth="1.4">
      {[80,125,170].map((x,i)=><g key={i}><path d={`M${x} 130v-15a9 11 0 0 1 18 0v15Z`} /><path d={`M${x-1} 180v-15a9 11 0 0 1 18 0v15Z`} /><path d={`M${x+9} 106v24m-9-9h18m-10 34v25m-9-10h18`} fill="none" /></g>)}
    </g>
    <g className={styles.nightSky}><circle cx="282" cy="39" r="15" fill={`url(#${id}-moon)`} /><circle cx="277" cy="35" r="3.6" fill="#cbc6aa" opacity=".5" /><circle cx="288" cy="43" r="2.7" fill="#bbb89f" opacity=".4" /><circle cx="278" cy="45" r="1.7" fill="#b9b69c" opacity=".3" />{[[240,32],[313,26],[334,59],[259,16],[304,69]].map(([x,y],i)=><path key={i} d={`M${x-2} ${y}h4m-2-2v4`} stroke="#f1de9f" strokeWidth="1.3" />)}</g>
    <g className={styles.daySky}><circle cx="282" cy="39" r="25" fill="#f5d78a" opacity=".12" /><circle cx="282" cy="39" r="15" fill={`url(#${id}-sun)`} /><g className={styles.sunRays} stroke="#edc374" strokeWidth="2.1" strokeLinecap="round">{Array.from({length:8},(_,i)=><path key={i} d="M282 15v-5" transform={`rotate(${i*45} 282 39)`} />)}</g></g>
  </svg>;

  return <svg viewBox="0 0 400 400" aria-hidden="true" className={`${className} ${styles.scene}`} data-scene="book">
    <defs>
      <clipPath id={`${id}-pencil`}><path d="M223 349L244 280L304 202Q314 184 333 195L347 207Q356 219 343 238L282 321L226 354Z" /></clipPath>
    </defs>
    <image href={`${ART}1774-light.webp`} width="400" height="400" />
    <BookPageTurn />
    <image href={`${ART}1774-light.webp`} width="400" height="400" clipPath={`url(#${id}-pencil)`} />
  </svg>;
}
