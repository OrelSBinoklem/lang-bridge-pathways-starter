'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useLessonDraft } from '@/features/lessons/useLessonDraft';
import { clientApi } from '@/lib/client-api';
import type { BlockProgress } from '@/features/lessons/blocks/BinaryStatementsTask';
import styles from './grammar-practice.module.css';
import type { TrainingItem } from '@/features/training/item-training';
import { grammarBlankParts, grammarSelectWidth } from './grammarBlank';

export type GrammarConfig = {
    task_kind:
        | 'grammar_gap'
        | 'grammar_select'
        | 'grammar_order'
        | 'grammar_correct'
        | 'grammar_set'
        | 'grammar_items'
        | 'unavailable';
    instruction?: string;
    questions: { prompt: string; options?: string[]; tokens?: string[] }[];
    items?: TrainingItem[];
};
type Result = {
    score: number;
    rank_label: string | null;
    is_practice: boolean;
    progress: BlockProgress;
    feedback: {
        statement: string;
        selected: string;
        correct: string;
        is_correct: boolean;
        explanation: string;
    }[];
};

function QuestionList({ table, children }: { table: boolean; children: ReactNode }) {
    return table ? <div className={styles.questionTableScroll}><table className={`${styles.questionTable} ${styles.questions}`}><caption>Заполните пропуски или соберите предложения</caption><tbody>{children}</tbody></table></div> : <ol className={styles.questions}>{children}</ol>;
}
function QuestionFrame({ table, number, className, children }: { table: boolean; number: number; className: string; children: ReactNode }) {
    return table ? <tr className={className}><th scope="row">{number}</th><td>{children}</td></tr> : <li className={className}>{children}</li>;
}

export function GrammarTask({
    blockId,
    variantId,
    config,
    progress,
    practice,
    compact = false,
    layout = 'list',
    onProgress,
    onRetry,
}: {
    blockId: number;
    variantId: number | null;
    config: GrammarConfig;
    progress: BlockProgress;
    practice: boolean;
    compact?: boolean;
    layout?: 'list' | 'table';
    onProgress?: (progress: BlockProgress) => void;
    onRetry?: () => Promise<unknown>;
}) {
    const [answers, setAnswers] = useLessonDraft<string[]>(`grammar-answers:${practice ? 'practice' : 'scored'}`, config.questions.map(() => ''),
        (value): value is string[] => Array.isArray(value) && value.length === config.questions.length && value.every(answer => typeof answer === 'string'));
    const [orders, setOrders] = useLessonDraft<number[][]>(`grammar-orders:${practice ? 'practice' : 'scored'}`, config.questions.map(() => []),
        (value): value is number[][] => Array.isArray(value) && value.length === config.questions.length && value.every((row, i) => Array.isArray(row) && new Set(row).size === row.length && row.every(n => Number.isInteger(n) && n >= 0 && n < (config.questions[i].tokens?.length ?? 0))));
    const [result, setResult] = useState<Result | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const currentProgress = result?.progress ?? progress;
    const until = currentProgress?.next_scored_at;
    const [expiredUntil, setExpiredUntil] = useState<string | null>(null);
    useEffect(() => {
        if (!until) return;
        const timer = window.setTimeout(
            () => setExpiredUntil(until),
            Math.max(0, Date.parse(until) - Date.now()),
        );
        return () => window.clearTimeout(timer);
    }, [until]);
    const training =
        practice ||
        Boolean(currentProgress?.is_training && until !== expiredUntil);
    const change = (index: number, value: string) =>
        setAnswers((current) =>
            current.map((old, i) => (i === index ? value : old)),
        );
    const order = (index: number, next: number[]) => {
        setOrders((current) =>
            current.map((old, i) => (i === index ? next : old)),
        );
        change(
            index,
            next
                .map((token) => config.questions[index].tokens![token])
                .join(' ')
                .replace(/\s+([,.!?;:])/g, '$1'),
        );
    };
    const complete =
        answers.length > 0 &&
        answers.every(
            (answer, i) =>
                answer.trim() &&
                (config.task_kind !== 'grammar_order' ||
                    orders[i].length === config.questions[i].tokens?.length),
        );
    async function submit() {
        if (busy || result || !complete) return;
        setBusy(true);
        setError('');
        try {
            const tier = /(?:^|;)\s*lbp_cooldown_tier_pref=2(?:;|$)/.test(
                document.cookie,
            )
                ? 2
                : 0;
            const response = await clientApi<{ data: Result }>(
                `/lessons/blocks/${blockId}/attempt`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        variant_id: variantId,
                        answers,
                        cooldown_tier: tier,
                        practice,
                    }),
                },
            );
            setResult(response.data);
            onProgress?.(response.data.progress);
        } catch (cause) {
            console.error('[grammar-attempt]', cause);
            setError(
                'Не удалось проверить ответы. Обновите задание и попробуйте снова.',
            );
        } finally {
            setBusy(false);
        }
    }
    async function retry() {
        setBusy(true);
        setError('');
        try {
            await onRetry?.();
            setAnswers(config.questions.map(() => ''));
            setOrders(config.questions.map(() => []));
            setResult(null);
        } catch {
            setError('Не удалось загрузить новую попытку.');
        } finally {
            setBusy(false);
        }
    }
    if (!variantId || config.task_kind === 'unavailable')
        return <p role="status">Задание готовится.</p>;
    return (
        <div className={`${styles.task} ${compact ? styles.compactTask : ''}`}>
            <div className={styles.taskMeta}>
                <span>{training ? 'Тренировка' : 'Зачётная попытка'}</span>
                <span>
                    Рекорд:{' '}
                    {currentProgress?.best_score == null
                        ? '—'
                        : `${currentProgress.best_score}% · ${currentProgress.best_rank_label ?? 'Без ранга'}`}
                </span>
            </div>
            {config.instruction && (layout === 'table' || !['grammar_set', 'grammar_select'].includes(config.task_kind)) && <p>{config.instruction}</p>}
            {training && currentProgress?.next_scored_at && (
                <p className={styles.muted}>
                    Следующий зачёт:{' '}
                    {new Date(currentProgress.next_scored_at).toLocaleString(
                        'ru-RU',
                    )}
                    . Тренировка не меняет рекорд.
                </p>
            )}
            <form className={compact ? styles.answerRow : undefined} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <QuestionList table={layout === 'table'}>
                {config.questions.map((q, i) => {
                    const feedback = result?.feedback[i];
                    const disabled = busy || Boolean(result);
                    const id = `grammar-${blockId}-${i}`;
                    const blank = ['grammar_gap', 'grammar_select'].includes(config.task_kind)
                        ? grammarBlankParts(q.prompt) : null;
                    const answerControl = config.task_kind === 'grammar_gap' ? (
                        <input
                            id={id}
                            className={blank ? styles.inlineControl : undefined}
                            aria-label={`Пропуск ${i + 1}`}
                            value={answers[i]}
                            disabled={disabled}
                            maxLength={2000}
                            autoComplete="off"
                            onChange={(e) => change(i, e.target.value)}
                        />
                    ) : config.task_kind === 'grammar_select' ? (
                        <select
                            id={id}
                            className={blank ? styles.inlineControl : undefined}
                            style={blank ? { width: `${grammarSelectWidth(q.options)}ch` } : undefined}
                            value={answers[i]}
                            disabled={disabled}
                            onChange={(e) => change(i, e.target.value)}
                        >
                            <option value="">{blank ? '…' : 'Выберите…'}</option>
                            {q.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                    ) : null;
                    return (
                        <QuestionFrame table={layout === 'table'} number={i + 1}
                            key={i}
                            className={
                                feedback
                                    ? feedback.is_correct
                                        ? styles.correct
                                        : styles.wrong
                                    : ''
                            }
                        >
                            {blank ? (
                                <label className={styles.gap} htmlFor={id}>
                                    {blank.before}{answerControl}{blank.after}
                                </label>
                            ) : (
                                <>
                                    <label
                                        htmlFor={
                                            config.task_kind === 'grammar_order'
                                                ? undefined
                                                : id
                                        }
                                    >
                                        {q.prompt.replaceAll('{{blank}}', '…')}
                                    </label>
                                    {answerControl}
                                </>
                            )}
                            {(config.task_kind === 'grammar_correct' || config.task_kind === 'grammar_set') && (
                                <input
                                    id={id}
                                    value={answers[i]}
                                    disabled={disabled}
                                    maxLength={2000}
                                    autoComplete="off"
                                    onChange={(e) => change(i, e.target.value)}
                                />
                            )}
                            {config.task_kind === 'grammar_order' && (
                                <>
                                    <div
                                        className={styles.sentence}
                                        role="group"
                                        aria-label={`Предложение ${i + 1}`}
                                    >
                                        {orders[i].map((token, at) => (
                                            <button
                                                key={token}
                                                type="button"
                                                disabled={disabled}
                                                title="Вернуть слово"
                                                onClick={() =>
                                                    order(
                                                        i,
                                                        orders[i].filter(
                                                            (_, n) => n !== at,
                                                        ),
                                                    )
                                                }
                                            >
                                                {q.tokens![token]}
                                            </button>
                                        ))}
                                    </div>
                                    <div
                                        className={styles.words}
                                        role="group"
                                        aria-label={`Слова ${i + 1}`}
                                    >
                                        {q.tokens?.map((word, token) => (
                                            <button
                                                key={token}
                                                type="button"
                                                disabled={
                                                    disabled ||
                                                    orders[i].includes(token)
                                                }
                                                onClick={() =>
                                                    order(i, [
                                                        ...orders[i],
                                                        token,
                                                    ])
                                                }
                                            >
                                                {word}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                            {feedback && (
                                <div className={styles.feedback}>
                                    <strong>
                                        {feedback.is_correct
                                            ? 'Верно'
                                            : `Правильно: ${feedback.correct}`}
                                    </strong>
                                    {feedback.explanation && (
                                        <span>{feedback.explanation}</span>
                                    )}
                                </div>
                            )}
                        </QuestionFrame>
                    );
                })}
            </QuestionList>
            {!result && (
                <button
                    className={styles.primary}
                    type="submit"
                    disabled={!complete || busy}
                >
                    {busy ? 'Проверка…' : compact ? 'Проверить' : 'Проверить ответы'}
                </button>
            )}
            </form>
            {result ? (
                <div className={styles.result} role="status">
                    <strong>
                        {result.score}% · {result.rank_label ?? 'Без ранга'}
                    </strong>
                    <span>
                        {result.is_practice
                            ? 'Тренировка, рекорд не изменён.'
                            : 'Результат сохранён.'}
                    </span>
                    <button type="button" disabled={busy} onClick={retry}>
                        <i className="pi pi-refresh" /> Новая попытка
                    </button>
                </div>
            ) : null}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
