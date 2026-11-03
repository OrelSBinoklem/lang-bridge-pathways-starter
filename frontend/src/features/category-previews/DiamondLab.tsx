'use client';

import { useState } from 'react';
import { GlassShelves } from './GlassShelves';
import type { DiamondTreatment, LayoutProps } from './types';
import styles from './diamond-decoration.module.css';

const OPTIONS: { id: DiamondTreatment; ru: string; uk: string; description: string; descriptionUk: string }[] = [
  { id: 'stamp', ru: 'Штамп', uk: 'Штамп', description: 'Круглая печать «100% · выучено» и мягкий блик на фольге.', descriptionUk: 'Кругла печатка «100% · вивчено» та м’який полиск фольги.' },
  { id: 'corners', ru: 'Камни по углам', uk: 'Камені в кутах', description: 'Четыре гранёных камня: грани переливаются вслед за курсором.', descriptionUk: 'Чотири ограновані камені: грані переливаються за курсором.' },
  { id: 'setting', ru: 'Ювелирная оправа', uk: 'Ювелірна оправа', description: 'Платиновая рамка с радужным отражением и штампом «100%» внутри.', descriptionUk: 'Платинова рамка з райдужним відблиском та штампом «100%» усередині.' },
];

export function DiamondLab({ groups, uk }: LayoutProps) {
  const [treatment, setTreatment] = useState<DiamondTreatment>('setting');
  const selected = OPTIONS.find(option => option.id === treatment)!;
  return <div>
    <section className={styles.controls} aria-label={uk ? 'Оформлення діамантових карток' : 'Оформление бриллиантовых карточек'}>
      <div className={styles.options} role="group" aria-label={uk ? 'Варіант оправи' : 'Вариант оправы'}>{OPTIONS.map(option => <button key={option.id} type="button" aria-pressed={option.id === treatment} onClick={() => setTreatment(option.id)}>{uk ? option.uk : option.ru}</button>)}</div>
      <p>{uk ? selected.descriptionUk : selected.description}</p>
      <small>{uk ? 'Рухай курсором над карткою. Оздоблення з’являється лише за справжніх 100%. На основній сторінці обрана оправа зі штампом.' : 'Поводи курсором над карточкой. Украшения появляются только при настоящих 100%. На основной странице выбрана оправа со штампом.'}</small>
      {!groups.some(group => group.items.some(item => item.percent === 100)) && <p role="status">{uk ? 'У видимих категоріях ще немає діамантових — приберіть фільтр або відкрийте вивчену тему.' : 'Среди видимых категорий пока нет бриллиантовых — уберите фильтр или откройте выученную тему.'}</p>}
    </section>
    <GlassShelves groups={groups} uk={uk} mastery diamondTreatment={treatment} />
  </div>;
}
