'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import styles from './holographic-foil.module.css';

const HolographicFoil = dynamic(() => import('./HolographicFoil').then(module => module.HolographicFoil), { ssr: false });
const artwork = '/course/holographic-foil/island-v1.png';

export function FoilPreviewCard({ running, onStart, onStop }: { running: boolean; onStart: () => void; onStop: () => void }) {
    return <div id="holographic-foil" className={styles.previewCard}>
        {running ? <HolographicFoil embedded onStop={onStop} /> : <>
            <Image src={artwork} alt="Остров с каменными арками и водопадами" fill unoptimized className={styles.previewPoster} sizes="(max-width: 600px) 100vw, 560px" />
            <button type="button" className={styles.previewStart} onClick={onStart}>
                <i className="pi pi-play" aria-hidden="true" /> Запустить
            </button>
            <h3 className={styles.previewTitle}>Голографический остров</h3>
        </>}
    </div>;
}
