'use client';

import { useState } from 'react';
import styles from './continue-previews.module.css';

const variants = [
  { id: 'glass', title: 'Тёплое стекло', description: 'Полупрозрачная поверхность, тонкие рамки и мягкий свет.' },
  { id: 'book', title: 'Книжная закладка', description: 'Глубокий синий цвет перекликается с обложкой словаря.' },
  { id: 'paper', title: 'Светлый пергамент', description: 'Кремовая кнопка с тёплыми коричневыми значками.' },
  { id: 'sage', title: 'Шалфейное стекло', description: 'Приглушённый зелёный и мягкий свет под прозрачной поверхностью.' },
  { id: 'emerald', title: 'Глубокий изумруд', description: 'Насыщенный зелёный с тонкой золотистой окантовкой и бликом.' },
  { id: 'jade', title: 'Нефритовый сатин', description: 'Спокойный зелёно-бирюзовый с деликатной объёмной поверхностью.' },
  { id: 'forest', title: 'Лесная эмаль', description: 'Тёмный хвойный оттенок с мягким свечением при наведении.' },
] as const;

export function ContinuePreviews() {
  const [active, setActive] = useState<string | null>(null);
  return <main className={styles.page}>
    <header className={styles.intro}><p>ЛАБОРАТОРИЯ ДИЗАЙНА</p><h1>Кнопка «Продолжить»</h1><span>Варианты в контексте шапки. Наведи на кнопки или нажми, чтобы посмотреть состояние.</span></header>
    <div className={styles.previews}>{variants.map((variant, index) => <section className={styles.preview} key={variant.id}>
      <header className={styles.label}><span>0{index + 1}</span><div><h2>{variant.title}</h2><p>{variant.description}</p></div></header>
      <div className={styles.example}>
        <div className={styles.bar}><div className={styles.brand}><span>LB</span><strong>LANGBRIDGE<small> PATHWAYS</small></strong></div><div className={styles.search}>Поиск глагола / слова...</div>
          <div className={styles.actions} data-variant={variant.id}>
            <button type="button" aria-label={`Справка — ${variant.title}`} title="Справка" onClick={() => setActive(`${variant.id}-help`)}><i className="pi pi-question-circle" aria-hidden="true" /></button>
            <button type="button" className={styles.continue} onClick={() => setActive(`${variant.id}-continue`)}><i className="pi pi-play" aria-hidden="true" /><span>Продолжить</span></button>
            <button type="button" aria-label={`Настройки продолжения — ${variant.title}`} title="Настройки" onClick={() => setActive(`${variant.id}-settings`)}><i className="pi pi-chevron-down" aria-hidden="true" /></button>
          </div><span className={styles.menu}><i className="pi pi-bars" aria-hidden="true" /> МЕНЮ</span>
        </div>
        <div className={styles.canvas}><div className={styles.canvasHeading}>Путь курса <span>→</span></div><div className={styles.cards}><i>A1</i><i>A2</i><i>B1</i><i>B2</i></div></div>
      </div>
      <p className={styles.feedback} aria-live="polite">{active?.startsWith(variant.id) ? 'Предпросмотр нажатия — переход не выполняется.' : 'Наведите или нажмите на любую часть кнопки.'}</p>
    </section>)}</div>
  </main>;
}
