'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { SelectButton } from 'primereact/selectbutton';
import { TabPanel, TabView } from 'primereact/tabview';
import { useEffect, useMemo, useState } from 'react';
import type { DictWord } from '@/features/training/helpers';
import styles from '@/features/admin/admin-panel.module.css';
import { CategorySimilarDrawer } from '@/features/admin/CategorySimilarDrawer';
import drawerStyles from '@/features/admin/category-similar-drawer.module.css';
import {
  categoryDropdownPortalProps,
  dropdownPortalProps,
} from '@/features/admin/dropdownPortal';
import {
  flattenCategoryOptions,
  type CategoryNode,
} from '@/features/dictionaries/category-tree';
import { apiFetch } from '@/lib/api';
import { clientApi } from '@/lib/client-api';

type DictionaryItem = { id: number; name: string; learn_lang: string };
type ProgressRow = {
  attempts?: number;
  correct_attempts?: number;
  attempts_revert?: number;
  correct_attempts_revert?: number;
  mode_education?: boolean;
  mode_education_revert?: boolean;
  easy_education?: boolean;
  easy_correct?: boolean;
  easy_correct_revert?: boolean;
  cooldown_tier?: number;
  cooldown_tier_revert?: number;
};

function normalize(s: string) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function WordAdminPanel({
  dictionaryId,
  categoryId,
  words,
  allDictionaryWords,
  initialEditId,
}: {
  dictionaryId: number;
  categoryId: number;
  words: DictWord[];
  allDictionaryWords?: DictWord[];
  initialEditId?: number | null;
}) {
  const t = useTranslations('Admin');
  const qc = useQueryClient();
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [bulk, setBulk] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [editId, setEditId] = useState<number | null>(initialEditId ?? null);
  const [editWord, setEditWord] = useState('');
  const [editTr1, setEditTr1] = useState('');
  const [editTr2, setEditTr2] = useState('');
  const [editTr3, setEditTr3] = useState('');
  const [editInfo, setEditInfo] = useState('');
  const [editLevel, setEditLevel] = useState<number | null>(null);
  const [mode, setMode] = useState<'move' | 'copy'>('move');
  const [targetDictionaryId, setTargetDictionaryId] = useState<number>(dictionaryId);
  const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressRow | null>(null);
  const [similarCsv, setSimilarCsv] = useState('');
  const [showSimilarCat, setShowSimilarCat] = useState(false);
  const [showCategorySimilarDrawer, setShowCategorySimilarDrawer] = useState(false);

  const sortedWords = useMemo(
    () => [...words].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id),
    [words],
  );

  const dictWords = allDictionaryWords ?? words;

  const similarByCategory = useMemo(() => {
    if (!showSimilarCat) return [];
    const inCat = new Set(words.map((w) => w.id));
    const keys = new Set(words.map((w) => normalize(w.word)));
    return dictWords.filter((w) => !inCat.has(w.id) && keys.has(normalize(w.word))).slice(0, 80);
  }, [showSimilarCat, words, dictWords]);

  const similarByCsv = useMemo(() => {
    const needles = similarCsv
      .split(/[\n,;]+/)
      .map((s) => normalize(s))
      .filter(Boolean);
    if (!needles.length) return [];
    return dictWords
      .filter((w) => needles.some((n) => normalize(w.word).includes(n) || n.includes(normalize(w.word))))
      .slice(0, 80);
  }, [similarCsv, dictWords]);

  const dictsQuery = useQuery({
    queryKey: ['all-dictionaries'],
    queryFn: () => apiFetch<{ data: DictionaryItem[] }>('/dictionaries'),
  });

  const targetCatsQuery = useQuery({
    queryKey: ['target-cats', targetDictionaryId],
    enabled: !!targetDictionaryId,
    queryFn: () =>
      apiFetch<{ data: CategoryNode[] }>(`/dictionaries/${targetDictionaryId}/categories`),
  });

  const targetCatOptions = useMemo(
    () => flattenCategoryOptions(targetCatsQuery.data?.data ?? []),
    [targetCatsQuery.data],
  );

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['dictionary-words', dictionaryId] });
    await qc.invalidateQueries({ queryKey: ['progress', dictionaryId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      clientApi('/admin/words', {
        method: 'POST',
        body: JSON.stringify({
          dictionary_id: dictionaryId,
          category_ids: [categoryId],
          word,
          translation_1: translation,
        }),
      }),
    onSuccess: async () => {
      setWord('');
      setTranslation('');
      setMsg(t('msgWordAdded'));
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      clientApi<{ created: number }>('/admin/words/bulk', {
        method: 'POST',
        body: JSON.stringify({
          dictionary_id: dictionaryId,
          category_ids: [categoryId],
          lines: bulk,
        }),
      }),
    onSuccess: async (res) => {
      setBulk('');
      setMsg(t('msgBulkInserted', { count: res.created }));
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: () =>
      clientApi<{ message: string }>('/admin/words/move', {
        method: 'POST',
        body: JSON.stringify({
          word_ids: selected,
          source_category_id: categoryId,
          target_category_id: targetCategoryId,
          target_dictionary_id: targetDictionaryId,
          mode: targetDictionaryId !== dictionaryId ? 'copy' : mode,
        }),
      }),
    onSuccess: async (res) => {
      setSelected([]);
      setMsg(res.message);
      setErr(null);
      await qc.invalidateQueries({ queryKey: ['dictionary-words'] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      clientApi(`/admin/words/${id}?category_id=${categoryId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setMsg(t('msgDeletedFromCategory'));
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () =>
      clientApi<{ message: string }>('/admin/words/delete-all-in-category', {
        method: 'POST',
        body: JSON.stringify({ category_id: categoryId, confirm: 'DELETE_ALL' }),
      }),
    onSuccess: async (res) => {
      setMsg(res.message);
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      clientApi(`/admin/words/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          word: editWord,
          translation_1: editTr1,
          translation_2: editTr2 || null,
          translation_3: editTr3 || null,
          info: editInfo || null,
          level: editLevel,
        }),
      }),
    onSuccess: async () => {
      setMsg(t('msgWordUpdated'));
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (payload: { id: number; dir: -1 | 1 } | { shuffle: true }) => {
      if ('shuffle' in payload) {
        const shuffled = [...sortedWords].sort(() => Math.random() - 0.5);
        return clientApi('/admin/words/reorder', {
          method: 'POST',
          body: JSON.stringify({
            category_id: categoryId,
            word_orders: shuffled.map((w, i) => ({ word_id: w.id, order: i + 1 })),
          }),
        });
      }
      const idx = sortedWords.findIndex((w) => w.id === payload.id);
      const swapIdx = idx + payload.dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= sortedWords.length) throw new Error(t('errAlreadyEdge'));
      const a = sortedWords[idx];
      const b = sortedWords[swapIdx];
      return clientApi('/admin/words/reorder', {
        method: 'POST',
        body: JSON.stringify({
          category_id: categoryId,
          word_orders: [
            { word_id: a.id, order: b.order ?? swapIdx + 1 },
            { word_id: b.id, order: a.order ?? idx + 1 },
          ],
        }),
      });
    },
    onSuccess: async () => {
      setMsg(t('msgOrderUpdated'));
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const aiSortMutation = useMutation({
    mutationFn: () =>
      clientApi<{ updated_count: number }>('/admin/words/sort-ai', {
        method: 'POST',
        body: JSON.stringify({
          category_id: categoryId,
          words: sortedWords.map((w) => ({
            id: w.id,
            word: w.word,
            translation: w.translation_1,
          })),
        }),
      }),
    onSuccess: async (res) => {
      setMsg(t('msgAiSort', { count: res.updated_count }));
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const loadProgressMutation = useMutation({
    mutationFn: (id: number) =>
      clientApi<{ progress: ProgressRow | null; word: DictWord }>(`/admin/words/${id}/progress`),
    onSuccess: (res) => {
      if (res.word) {
        setEditWord(res.word.word);
        setEditTr1(res.word.translation_1 ?? '');
        setEditTr2(res.word.translation_2 ?? '');
        setEditTr3(res.word.translation_3 ?? '');
        setEditInfo(res.word.info ?? '');
        setEditLevel(res.word.level ?? null);
      }
      setProgress(
        res.progress ?? {
          attempts: 0,
          correct_attempts: 0,
          attempts_revert: 0,
          correct_attempts_revert: 0,
          cooldown_tier: 0,
          cooldown_tier_revert: 0,
          easy_education: false,
          mode_education: false,
          mode_education_revert: false,
          easy_correct: false,
          easy_correct_revert: false,
        },
      );
    },
    onError: (e: Error) => setErr(e.message),
  });

  const saveProgressMutation = useMutation({
    mutationFn: () =>
      clientApi(`/admin/words/${editId}/progress`, {
        method: 'PATCH',
        body: JSON.stringify(progress ?? {}),
      }),
    onSuccess: () => {
      setMsg(t('msgProgressSaved'));
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllWords() {
    setSelected(sortedWords.map((w) => w.id));
  }

  function clearSelection() {
    setSelected([]);
  }

  function startEdit(w: DictWord) {
    setEditId(w.id);
    setEditWord(w.word);
    setEditTr1(w.translation_1 ?? '');
    setEditTr2(w.translation_2 ?? '');
    setEditTr3(w.translation_3 ?? '');
    setEditInfo(w.info ?? '');
    setEditLevel(w.level ?? null);
    setProgress(null);
    loadProgressMutation.mutate(w.id);
  }

  useEffect(() => {
    if (!initialEditId) return;
    const w = words.find((x) => x.id === initialEditId);
    if (w) startEdit(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditId]);

  return (
    <div className={`${styles.panel} grid gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">⚙️ {t('wordsTitle', { count: sortedWords.length })}</div>
        <button
          type="button"
          className={`${drawerStyles.openBtn} ${showCategorySimilarDrawer ? drawerStyles.openBtnActive : ''}`}
          title={t('similarOpen')}
          disabled={!sortedWords.length}
          onClick={() => setShowCategorySimilarDrawer((v) => !v)}
        >
          {showCategorySimilarDrawer ? t('similarClose') : t('similarOpen')}
        </button>
      </div>
      {msg && <Message severity="success" text={msg} />}
      {err && <Message severity="error" text={err} />}

      <CategorySimilarDrawer
        open={showCategorySimilarDrawer}
        onClose={() => setShowCategorySimilarDrawer(false)}
        dictionaryId={dictionaryId}
        categoryId={categoryId}
        categoryWords={words}
        dictionaryWords={dictWords}
      />

      <TabView>
        <TabPanel header={t('listTab')}>
          <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            {t('listHint')}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              label={t('selectAll')}
              size="small"
              outlined
              onClick={selectAllWords}
              disabled={!sortedWords.length}
            />
            <Button
              label={t('clearSelection')}
              size="small"
              text
              onClick={clearSelection}
              disabled={!selected.length}
            />
            <Button
              label={t('shuffleOrder')}
              size="small"
              outlined
              onClick={() => reorderMutation.mutate({ shuffle: true })}
              loading={reorderMutation.isPending}
            />
            <Button
              label={t('aiSort')}
              size="small"
              outlined
              onClick={() => aiSortMutation.mutate()}
              loading={aiSortMutation.isPending}
            />
            <Button
              label={t('deleteAllInCategory')}
              size="small"
              severity="danger"
              outlined
              onClick={() => {
                if (confirm(t('confirmDeleteAll'))) {
                  deleteAllMutation.mutate();
                }
              }}
              loading={deleteAllMutation.isPending}
            />
          </div>

          {sortedWords.map((w, idx) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 py-1.5 text-sm dark:border-zinc-700"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={selected.includes(w.id)}
                  onChange={() => toggle(w.id)}
                  inputId={`sel-${w.id}`}
                  className="shrink-0"
                />
                <button type="button" className="min-w-0 text-left hover:underline" onClick={() => startEdit(w)}>
                  <span className="text-zinc-400">{w.order ?? idx + 1}.</span> {w.word} — {w.translation_1}
                </button>
              </label>
              <div className="flex gap-1">
                <Button icon="pi pi-arrow-up" rounded text size="small" onClick={() => reorderMutation.mutate({ id: w.id, dir: -1 })} />
                <Button icon="pi pi-arrow-down" rounded text size="small" onClick={() => reorderMutation.mutate({ id: w.id, dir: 1 })} />
                <Button icon="pi pi-pencil" rounded text size="small" onClick={() => startEdit(w)} />
                <Button icon="pi pi-trash" rounded text severity="danger" size="small" onClick={() => deleteMutation.mutate(w.id)} />
              </div>
            </div>
          ))}

          {editId && (
            <div className="mt-3 grid gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
              <div className="font-medium">{t('editorTitle', { id: editId })}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <InputText value={editWord} onChange={(e) => setEditWord(e.target.value)} placeholder={t('word')} />
                <InputText value={editTr1} onChange={(e) => setEditTr1(e.target.value)} placeholder={t('translation1')} />
                <InputText value={editTr2} onChange={(e) => setEditTr2(e.target.value)} placeholder={t('translation2')} />
                <InputText value={editTr3} onChange={(e) => setEditTr3(e.target.value)} placeholder={t('translation3')} />
                <InputText value={editInfo} onChange={(e) => setEditInfo(e.target.value)} placeholder={t('info')} />
                <InputNumber value={editLevel} onValueChange={(e) => setEditLevel(e.value ?? null)} placeholder={t('level')} />
              </div>
              <Button label={t('saveWord')} onClick={() => updateMutation.mutate()} loading={updateMutation.isPending} />

              {progress && (
                <div className="mt-2 grid gap-2 border-t border-amber-200 pt-2">
                  <div className="text-sm font-medium">{t('progressYourAccount')}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ['attempts', 'attempts'],
                        ['correct_attempts', 'correct_attempts'],
                        ['attempts_revert', 'attempts_revert'],
                        ['correct_attempts_revert', 'correct_attempts_revert'],
                        ['cooldown_tier', 'cooldown_tier'],
                        ['cooldown_tier_revert', 'cooldown_tier_revert'],
                      ] as const
                    ).map(([label, key]) => (
                      <label key={key} className="grid gap-1 text-xs">
                        {label}
                        <InputNumber
                          value={(progress[key] as number) ?? 0}
                          min={key.includes('cooldown') ? 0 : 0}
                          max={key.includes('cooldown') ? 2 : undefined}
                          onValueChange={(e) => setProgress({ ...progress, [key]: e.value ?? 0 })}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={!!progress.easy_education}
                        onChange={(e) => setProgress({ ...progress, easy_education: !!e.checked })}
                      />
                      easy_education
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={!!progress.mode_education}
                        onChange={(e) => setProgress({ ...progress, mode_education: !!e.checked })}
                      />
                      mode_education
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={!!progress.mode_education_revert}
                        onChange={(e) =>
                          setProgress({ ...progress, mode_education_revert: !!e.checked })
                        }
                      />
                      mode_education_revert
                    </label>
                  </div>
                  <Button
                    label={t('saveProgress')}
                    outlined
                    onClick={() => saveProgressMutation.mutate()}
                    loading={saveProgressMutation.isPending}
                  />
                </div>
              )}
            </div>
          )}
        </TabPanel>

        <TabPanel header={t('addTab')}>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <InputText value={word} onChange={(e) => setWord(e.target.value)} placeholder={t('word')} />
            <InputText value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder={t('translation')} />
            <Button
              label={t('addWord')}
              onClick={() => createMutation.mutate()}
              disabled={!word || !translation}
              loading={createMutation.isPending}
            />
          </div>
          <div className="mt-3 grid gap-2">
            <div className="text-sm text-zinc-600">{t('bulkCsv')}</div>
            <InputTextarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} className="w-full" />
            <Button
              label={t('bulkInsert')}
              onClick={() => bulkMutation.mutate()}
              disabled={!bulk.trim()}
              loading={bulkMutation.isPending}
            />
          </div>
        </TabPanel>

        <TabPanel header={t('moveTab')}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span>
              {t('selected', { count: selected.length })}
            </span>
            <Button label={t('all')} size="small" outlined onClick={selectAllWords} disabled={!sortedWords.length} />
            <Button label={t('clear')} size="small" text onClick={clearSelection} disabled={!selected.length} />
          </div>

          <div className="mb-3 max-h-[40vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            {sortedWords.length === 0 ? (
              <div className="p-3 text-sm text-zinc-500">{t('emptyCategory')}</div>
            ) : (
              sortedWords.map((w) => (
                <label
                  key={w.id}
                  className="flex cursor-pointer items-center gap-2.5 border-b border-zinc-100 px-3 py-1.5 text-sm last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                >
                  <Checkbox
                    checked={selected.includes(w.id)}
                    onChange={() => toggle(w.id)}
                    inputId={`move-sel-${w.id}`}
                  />
                  <span>
                    {w.word} — {w.translation_1}
                  </span>
                </label>
              ))
            )}
          </div>

          <SelectButton
            value={mode}
            onChange={(e) => e.value && setMode(e.value)}
            options={[
              { label: t('move'), value: 'move' },
              { label: t('copy'), value: 'copy' },
            ]}
          />
          <div className="mt-2 grid gap-2">
            <Dropdown
              value={targetDictionaryId}
              onChange={(e) => {
                setTargetDictionaryId(e.value);
                setTargetCategoryId(null);
              }}
              options={(dictsQuery.data?.data ?? []).map((d) => ({
                label: `${d.name} (${d.learn_lang})`,
                value: d.id,
              }))}
              className="lbp-dropdown-sm w-full"
              {...dropdownPortalProps}
            />
            <Dropdown
              value={targetCategoryId}
              onChange={(e) => setTargetCategoryId(e.value)}
              options={targetCatOptions}
              placeholder={t('targetCategory')}
              className="lbp-dropdown-sm w-full"
              filter
              {...categoryDropdownPortalProps}
            />
            <Button
              label={t('execute')}
              onClick={() => moveMutation.mutate()}
              disabled={!selected.length || !targetCategoryId}
              loading={moveMutation.isPending}
            />
          </div>
        </TabPanel>

        <TabPanel header={t('similarTab')}>
          <div className="grid gap-3">
            <Button
              label={showSimilarCat ? t('hideDuplicates') : t('showDuplicates')}
              outlined
              onClick={() => setShowSimilarCat((v) => !v)}
            />
            {showSimilarCat && (
              <div className="grid gap-1 text-sm">
                {similarByCategory.length === 0 && <div className="text-zinc-500">{t('noDuplicates')}</div>}
                {similarByCategory.map((w) => (
                  <div key={w.id} className="flex justify-between gap-2">
                    <span>
                      {w.word} — {w.translation_1}{' '}
                      <span className="text-zinc-400">cats: {w.category_ids.join(',')}</span>
                    </span>
                    <Button icon="pi pi-pencil" rounded text size="small" onClick={() => startEdit(w)} />
                  </div>
                ))}
              </div>
            )}
            <div className="text-sm font-medium">{t('csvSearch')}</div>
            <InputTextarea
              value={similarCsv}
              onChange={(e) => setSimilarCsv(e.target.value)}
              rows={3}
              placeholder={t('csvPlaceholder')}
              className="w-full"
            />
            <div className="grid gap-1 text-sm">
              {similarByCsv.map((w) => (
                <div key={w.id} className="flex justify-between gap-2">
                  <span>
                    {w.word} — {w.translation_1}
                  </span>
                  <div className="flex gap-1">
                    <Button icon="pi pi-pencil" rounded text size="small" onClick={() => startEdit(w)} />
                    <Button
                      icon="pi pi-trash"
                      rounded
                      text
                      severity="danger"
                      size="small"
                      onClick={() => deleteMutation.mutate(w.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>
  );
}
