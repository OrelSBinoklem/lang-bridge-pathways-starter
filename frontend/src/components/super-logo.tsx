'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import styles from '@/components/super-logo.module.css';
import { WebglGuiToggle } from '@/components/webgl-gui-toggle';

const SuperLogoCanvas = dynamic(
  () => import('@/components/super-logo-canvas').then((m) => m.SuperLogoCanvas),
  {
    ssr: false,
    loading: () => (
      <div id="super-logo-bg" className={`${styles.bg} ${styles.bgFallback}`}>
        <div className={`${styles.gradient} ${styles.gradientTop}`} />
        <div className={`${styles.gradient} ${styles.gradientBottom}`} />
        <div className={`${styles.gradient} ${styles.gradientLeft}`} />
        <div className={`${styles.gradient} ${styles.gradientRight}`} />
      </div>
    ),
  },
);

export function SuperLogo({
  onSkyChange,
}: {
  onSkyChange?: (sky: { rgb: string; bright: boolean; arr?: string }) => void;
}) {
  return (
    <div className={styles.root}>
      <SuperLogoCanvas onSkyChange={onSkyChange} />
      <Link href="/" className={styles.logoLink} aria-label="LangBridge Pathways">
        <Image
          src="/brand/lbp-bridge.png"
          alt="LangBridge Pathways"
          width={300}
          height={96}
          className={styles.logo}
          priority
        />
      </Link>
      <WebglGuiToggle />
    </div>
  );
}
