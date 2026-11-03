'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { useMemo, useState } from 'react';
import styles from '@/features/admin/admin-panel.module.css';
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

type DictionaryItem = {
  id: number;
  name: string;
  learn_lang: string;
};

type CategoryTranslationForm = Record<string, string>;

const CATEGORY_TRANSLATION_LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'uk', label: 'UK' },
];

function findNode(nodes: CategoryNode[], id: number): CategoryNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = findNode(n.children ?? [], id);
    if (child) return child;
  }
  return null;
}

function siblingsAt(nodes: CategoryNode[], parentId: number | null): CategoryNode[] {
  if (parentId === null) return nodes;
  return findNode(nodes, parentId)?.children ?? [];
}

export function CategoryAdminPanel({
  dictionaryId,
  tree,
}: {
  dictionaryId: number;
  tree: CategoryNode[];
}) {
  const t = useTranslations('Admin');
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [nameTranslations, setNameTranslations] = useState<CategoryTranslationForm>({ ru: '', uk: '' });
  const [parentId, setParentId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rename, setRename] = useState('');
  const [renameTranslations, setRenameTranslations] = useState<CategoryTranslationForm>({ ru: '', uk: '' });
  const [moveDictId, setMoveDictId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const flat = useMemo(() => flattenCategoryOptions(tree), [tree]);
  const selected = selectedId ? findNode(tree, selectedId) : null;

  const dictsQuery = useQuery({
    queryKey: ['all-dictionaries'],
    queryFn: () => apiFetch<{ data: DictionaryItem[] }>('/dictionaries'),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['dictionary-categories', dictionaryId] });
    await qc.invalidateQueries({ queryKey: ['dictionary', dictionaryId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      clientApi('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          dictionary_id: dictionaryId,
          name,
          name_translations: nameTranslations,
          parent_id: parentId,
        }),
      }),
    onSuccess: async () => {
      setName('');
      setNameTranslations({ ru: '', uk: '' });
      setMsg(t('msgCategoryCreated'));
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const renameMutation = useMutation({
    mutationFn: () =>
      clientApi(`/admin/categories/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: rename, name_translations: renameTranslations }),
      }),
    onSuccess: async () => {
      setMsg(t('msgCategoryRenamed'));
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => clientApi(`/admin/categories/${selectedId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setSelectedId(null);
      setRename('');
      setMsg(t('msgCategoryDeleted'));
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (dir: -1 | 1) => {
      if (!selected) throw new Error(t('errNoCategorySelected'));
      const siblings = siblingsAt(tree, selected.parent_id).slice().sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex((s) => s.id === selected.id);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) {
        throw new Error(t('errAlreadyEdgeList'));
      }
      const a = siblings[idx];
      const b = siblings[swapIdx];
      return clientApi('/admin/categories/reorder', {
        method: 'POST',
        body: JSON.stringify({
          dictionary_id: dictionaryId,
          parent_id: selected.parent_id,
          category_orders: [
            { category_id: a.id, order: b.order },
            { category_id: b.id, order: a.order },
          ],
        }),
      });
    },
    onSuccess: async () => {
      setMsg(t('msgCategoryOrderUpdated'));
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: () =>
      clientApi<{ message: string }>(`/admin/categories/${selectedId}/move`, {
        method: 'POST',
        body: JSON.stringify({ target_dictionary_id: moveDictId }),
      }),
    onSuccess: async (res) => {
      setMsg(res.message);
      setErr(null);
      setSelectedId(null);
      await invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const shuffleMutation = useMutation({
    mutationFn: () =>
      clientApi<{ message: string }>('/admin/dictionaries/shuffle', {
        method: 'POST',
        body: JSON.stringify({
          dictionary_id: dictionaryId,
          confirm: 'YES_SHUFFLE_PERMANENTLY',
        }),
      }),
    onSuccess: async (res) => {
      setMsg(res.message);
      setErr(null);
      await qc.invalidateQueries({ queryKey: ['dictionary-words', dictionaryId] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className={`${styles.panel} grid gap-4`}>
      <div className="font-semibold">{t('categoriesPanelTitle')}</div>
      {msg && <Message severity="success" text={msg} />}
      {err && <Message severity="error" text={err} />}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="grid gap-2">
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('categoryName')}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORY_TRANSLATION_LANGS.map(({ code, label }) => (
              <InputText
                key={code}
                value={nameTranslations[code] ?? ''}
                onChange={(e) => {
                  setNameTranslations((prev) => ({ ...prev, [code]: e.target.value }));
                  if (code === 'ru') setName(e.target.value);
                }}
                placeholder={`${t('categoryName')} ${label}`}
              />
            ))}
          </div>
        </div>
        <Dropdown
          value={parentId}
          onChange={(e) => setParentId(e.value)}
          options={[{ label: t('root'), value: null }, ...flat.map((c) => ({ label: c.label, value: c.value }))]}
          placeholder={t('parent')}
          className="lbp-dropdown-sm w-full"
          showClear
          {...categoryDropdownPortalProps}
        />
        <Button
          label={t('create')}
          onClick={() => createMutation.mutate()}
          disabled={name.trim().length < 2}
          loading={createMutation.isPending}
        />
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-medium">{t('selectCategory')}</div>
        <Dropdown
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.value);
            const node = e.value ? findNode(tree, e.value) : null;
            setRename(node?.name ?? '');
            setRenameTranslations({
              ru: node?.name_translations?.ru ?? node?.name ?? '',
              uk: node?.name_translations?.uk ?? '',
            });
          }}
          options={flat.map((c) => ({ label: c.label, value: c.value }))}
          placeholder={t('category')}
          className="lbp-dropdown-sm w-full"
          filter
          {...categoryDropdownPortalProps}
        />
        {selected && (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <div className="grid gap-2">
              <InputText value={rename} onChange={(e) => setRename(e.target.value)} />
              <div className="grid gap-2 sm:grid-cols-2">
                {CATEGORY_TRANSLATION_LANGS.map(({ code, label }) => (
                  <InputText
                    key={code}
                    value={renameTranslations[code] ?? ''}
                    onChange={(e) => {
                      setRenameTranslations((prev) => ({ ...prev, [code]: e.target.value }));
                      if (code === 'ru') setRename(e.target.value);
                    }}
                    placeholder={`${t('categoryName')} ${label}`}
                  />
                ))}
              </div>
            </div>
            <Button
              label={t('rename')}
              onClick={() => renameMutation.mutate()}
              disabled={rename.trim().length < 2}
              loading={renameMutation.isPending}
            />
            <Button
              icon="pi pi-arrow-up"
              rounded
              outlined
              onClick={() => reorderMutation.mutate(-1)}
              loading={reorderMutation.isPending}
            />
            <Button
              icon="pi pi-arrow-down"
              rounded
              outlined
              onClick={() => reorderMutation.mutate(1)}
              loading={reorderMutation.isPending}
            />
          </div>
        )}
        {selected && (
          <div className="flex flex-wrap gap-2">
            <Button
              label={t('deleteCategory')}
              severity="danger"
              outlined
              onClick={() => {
                if (confirm(t('confirmDeleteCategory', { name: selected.name }))) {
                  deleteMutation.mutate();
                }
              }}
              loading={deleteMutation.isPending}
            />
          </div>
        )}
      </div>

      {selected && (
        <div className="grid gap-2">
          <div className="text-sm font-medium">{t('moveCategoryToDict')}</div>
          <Dropdown
            value={moveDictId}
            onChange={(e) => setMoveDictId(e.value)}
            options={(dictsQuery.data?.data ?? [])
              .filter((d) => d.id !== dictionaryId)
              .map((d) => ({ label: `${d.name} (${d.learn_lang})`, value: d.id }))}
            placeholder={t('targetDictionary')}
            className="lbp-dropdown-sm w-full"
            {...dropdownPortalProps}
          />
          <Button
            label={t('moveWithSubtree')}
            onClick={() => {
              if (confirm(t('confirmMoveSubtree'))) {
                moveMutation.mutate();
              }
            }}
            disabled={!moveDictId}
            loading={moveMutation.isPending}
          />
        </div>
      )}

      <div className="grid gap-2 border-t border-zinc-200 pt-3">
        <div className="text-sm font-medium text-red-700">{t('shuffleWarning')}</div>
        <Button
          label={t('shuffleDictionary')}
          severity="danger"
          outlined
          onClick={() => {
            if (confirm(t('confirmShuffle'))) {
              shuffleMutation.mutate();
            }
          }}
          loading={shuffleMutation.isPending}
        />
      </div>
    </div>
  );
}
