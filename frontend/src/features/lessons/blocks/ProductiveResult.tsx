import styles from './blocks.module.css';

export type ProductiveGrade = { score: number; rank_label: string | null; target_score: number; target_reached: boolean; can_improve: boolean; feedback: string; recommendation: string };

export function ProductiveResult({ result, completed, uk }: { result?: ProductiveGrade | null; completed: boolean; uk: boolean }) {
  if (!result) return completed ? <p className={styles.done}>{uk ? '✓ Зараховано · без бальної оцінки' : '✓ Зачтено · без балльной оценки'}</p> : null;
  return <div className={styles.scoreResult} role="status">
    <strong>{result.score}%{result.rank_label ? ` · ${result.rank_label}` : ''}</strong>
    <span>{result.target_reached ? (uk ? 'Обраної мети досягнуто.' : 'Выбранная цель достигнута.') : `${uk ? 'Ваша мета' : 'Ваша цель'}: ${result.target_score}%.`}</span>
    <p>{result.feedback}</p>
    {result.can_improve && <p>{uk ? 'Можна покращити відповідь у бесіді.' : 'Можно улучшить ответ в беседе.'} {result.recommendation}</p>}
  </div>;
}
