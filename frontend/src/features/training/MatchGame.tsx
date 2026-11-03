'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { useMemo, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { getWordTranslationFields, type DictWord } from '@/features/training/helpers';

type Pair = {
  wordId: number;
  wordText: string;
  translationText: string;
};

export function MatchGame({
  words,
  categoryId,
  translationLang,
  onClose,
}: {
  words: DictWord[];
  categoryId: number;
  translationLang?: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('Match');
  const qc = useQueryClient();

  const pairs = useMemo<Pair[]>(() => {
    const pool = [...words].sort(() => Math.random() - 0.5).slice(0, Math.min(6, words.length));
    return pool.map((w) => ({
      wordId: w.id,
      wordText: w.word,
      translationText: getWordTranslationFields(w, translationLang).translation_1,
    }));
  }, [words, translationLang]);

  const rightItems = useMemo(
    () =>
      [...pairs]
        .map((p) => ({ id: p.wordId, text: p.translationText }))
        .sort(() => Math.random() - 0.5),
    [pairs],
  );

  const [assigned, setAssigned] = useState<Record<number, number | null>>({});
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const successMutation = useMutation({
    mutationFn: () =>
      clientApi('/training/dense/match-success', {
        method: 'POST',
        body: JSON.stringify({ category_id: categoryId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dense', categoryId] }),
  });

  function assign(wordId: number) {
    if (selectedRight === null) return;
    setAssigned((prev) => ({ ...prev, [wordId]: selectedRight }));
    setSelectedRight(null);
  }

  function check() {
    let correctCount = 0;
    for (const pair of pairs) {
      const chosen = assigned[pair.wordId];
      const chosenText = rightItems.find((r) => r.id === chosen)?.text;
      if (chosenText === pair.translationText) correctCount += 1;
    }
    const all = correctCount === pairs.length;
    setResult(
      all
        ? t('resultPerfect', { correct: correctCount, total: pairs.length })
        : t('result', { correct: correctCount, total: pairs.length }),
    );
    if (all) {
      successMutation.mutate();
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <Button icon="pi pi-times" rounded text onClick={onClose} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            {pairs.map((p) => (
              <button
                key={p.wordId}
                type="button"
                onClick={() => assign(p.wordId)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-left dark:border-zinc-700"
              >
                <div className="font-medium">{p.wordText}</div>
                <div className="text-sm text-zinc-500">
                  {assigned[p.wordId]
                    ? rightItems.find((r) => r.id === assigned[p.wordId])?.text
                    : '—'}
                </div>
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            {rightItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedRight(item.id)}
                className={`rounded-lg border px-3 py-2 text-left ${
                  selectedRight === item.id
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {item.text}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button label={t('check')} onClick={check} />
          <Button label={t('close')} severity="secondary" onClick={onClose} />
        </div>
        {result && <Message className="mt-3 w-full" severity="info" text={result} />}
      </div>
    </div>
  );
}
