'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { HOME_DESIGNS, type HomeDesign } from './types';
import styles from './home-preview.module.css';

export function PreviewSwitcher({ design }: { design: HomeDesign }) {
  const uk = useLocale() === 'uk';
  const titles: Record<HomeDesign, string> = {
    studio: uk ? 'Студія' : 'Студия', atlas: 'Атлас 3D', exam: uk ? 'Іспити' : 'Экзамены',
    workspace: uk ? 'Кабінет' : 'Кабинет', journal: 'Журнал', route: 'Маршрут',
    riga: 'Рига', signal: 'Пульт', unified: uk ? 'Єдиний стиль' : 'Единый стиль',
    'glass-daybreak': uk ? 'Світанок' : 'Рассвет', 'glass-nocturne': 'Ноктюрн', 'glass-mosaic': uk ? 'Вітраж' : 'Витраж',
    'glass-daybreak-original': uk ? 'Світанок · оригінал' : 'Рассвет · оригинал',
    'glass-nocturne-original': uk ? 'Ноктюрн · оригінал' : 'Ноктюрн · оригинал',
    'glass-mosaic-original': uk ? 'Вітраж · оригінал' : 'Витраж · оригинал',
    'liquid-atlas': uk ? 'Рідкий атлас' : 'Жидкий атлас',
    'prism-theatre': uk ? 'Театр призм' : 'Театр призм',
    'chromatic-studio': uk ? 'Хроматика' : 'Хроматика',
    'glass-mosaic-illustrated': uk ? 'Вітраж · ілюстрації' : 'Витраж · иллюстрации',
    'glass-mosaic-animated': uk ? 'Вітраж · живі сцени' : 'Витраж · живые сцены',
    'glass-mosaic-rounded': uk ? 'Вітраж · кути B2' : 'Витраж · углы B2',
  };
  return <div className={styles.previewBar}>
    <Link href="/admin-tools" title={uk ? 'Карта сторінок' : 'Карта страниц'} aria-label={uk ? 'Карта сторінок' : 'Карта страниц'}><i className="pi pi-th-large" aria-hidden="true" /></Link>
    <nav aria-label={uk ? 'Варіанти головної' : 'Варианты главной'}>{HOME_DESIGNS.map((id, index) => <Link key={id} href={`/home-previews/${id}`} aria-current={design === id ? 'page' : undefined}>{index + 1}<span>{titles[id]}</span></Link>)}</nav>
    <Link href="/" title={uk ? 'Поточна головна' : 'Текущая главная'} aria-label={uk ? 'Поточна головна' : 'Текущая главная'}><i className="pi pi-times" aria-hidden="true" /></Link>
  </div>;
}
