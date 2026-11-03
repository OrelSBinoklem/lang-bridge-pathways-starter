import styles from './grammar-extension-badge.module.css';

export function GrammarExtensionBadge({ compact = false }: { compact?: boolean }) {
  return <span className={`${styles.badge} ${compact ? styles.compact : ''}`} data-grammar-extension=""
    title="Дополнительное задание, перенесённое из отдельной мини-таблицы">extends</span>;
}
