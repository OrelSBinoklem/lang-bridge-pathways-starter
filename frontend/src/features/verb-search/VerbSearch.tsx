'use client';

import { useQueries } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import {
  buildCategoryMetaMap,
  getDeepestCategoryPaths,
  getTrainingCategoryId,
  type CategoryMeta,
} from '@/features/admin/similarWords';
import type { CategoryNode } from '@/features/dictionaries/category-tree';
import type { DictWord } from '@/features/training/helpers';
import { getLearnLangFromCookie, LEARN_LANG_EVENT, type LearnLang } from '@/lib/learn-lang';
import { normalizeLatvian } from '@/features/verb-search/normalizeLatvian';
import type {
  DictListItem,
  VerbEntry,
  VerbListItem,
  VerbSelectPayload,
  VerbSuggestion,
} from '@/features/verb-search/types';
import styles from '@/features/verb-search/verb-search.module.css';
import { apiFetch } from '@/lib/api';

const DICT_RESULTS_MAX = 10;
const VERBS_URL = '/verbs/verbs.15cells.tr_gpt5.json';
/** The site's two Latvian "author's" word dictionaries (base + supplementary) — searched and kept
 * in memory whenever the user is learning Latvian, regardless of which page they're on, so the
 * dictionary section of the header search always has something to search rather than only
 * working while literally browsing a /dictionaries/{id} page. */
const LV_DICTIONARY_IDS = [20, 21];

function dictionaryIdFromPath(pathname: string): number {
  const m = pathname.match(/^\/dictionaries\/(\d+)(?:\/|$)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type Props = {
  onVerbSelect?: (payload: VerbSelectPayload) => void;
  bright?: boolean;
  initialLearnLang: LearnLang;
};

export function VerbSearch({ onVerbSelect, bright = false, initialLearnLang }: Props) {
  const t = useTranslations('VerbSearch');
  const pathname = usePathname();
  const router = useRouter();
  const pathDictionaryId = dictionaryIdFromPath(pathname);

  const [learnLang, setLearnLang] = useState<LearnLang>(initialLearnLang);
  useEffect(() => {
    const update = () => setLearnLang(getLearnLangFromCookie() ?? initialLearnLang);
    update();
    window.addEventListener(LEARN_LANG_EVENT, update);
    return () => window.removeEventListener(LEARN_LANG_EVENT, update);
  }, [initialLearnLang]);

  useEffect(() => setLearnLang(initialLearnLang), [initialLearnLang]);

  // Whichever dictionary the URL currently points at, plus — while learning Latvian — both
  // "author's" dictionaries, always, no matter what page this header is rendered on.
  const searchDictionaryIds = useMemo(() => {
    const ids = new Set<number>();
    if (pathDictionaryId > 0) ids.add(pathDictionaryId);
    if (learnLang === 'lv') LV_DICTIONARY_IDS.forEach((id) => ids.add(id));
    return [...ids];
  }, [pathDictionaryId, learnLang]);

  const [verbData, setVerbData] = useState<VerbEntry[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [verbSuggestions, setVerbSuggestions] = useState<VerbListItem[]>([]);
  const [dictSuggestions, setDictSuggestions] = useState<DictListItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [openHintWordId, setOpenHintWordId] = useState<number | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wordsQueries = useQueries({
    queries: searchDictionaryIds.map((id) => ({
      queryKey: ['dictionary-words', id],
      queryFn: () => apiFetch<{ data: DictWord[] }>(`/dictionaries/${id}/words`),
    })),
  });

  const categoriesQueries = useQueries({
    queries: searchDictionaryIds.map((id) => ({
      queryKey: ['dictionary-categories', id],
      queryFn: () => apiFetch<{ data: CategoryNode[] }>(`/dictionaries/${id}/categories`),
    })),
  });

  // Every word tagged with the dictionary it came from — results merged across dictionaries still
  // need to remember their source to build the right "open category" link and category path.
  const dictionaryWords = useMemo(
    () =>
      searchDictionaryIds.flatMap((id, index) =>
        (wordsQueries[index]?.data?.data ?? []).map((w) => ({ ...w, dictionaryId: id })),
      ),
    [searchDictionaryIds, wordsQueries],
  );
  const dictLoading =
    searchDictionaryIds.length > 0 &&
    (wordsQueries.some((q) => q.isLoading) || categoriesQueries.some((q) => q.isLoading));

  // Category ids are only unique *within* one dictionary's tree, so each dictionary keeps its own
  // meta map — a search result picks the map matching its own `dictionaryId`.
  const categoryMetaByDictId = useMemo(() => {
    const map = new Map<number, Map<number, CategoryMeta>>();
    searchDictionaryIds.forEach((id, index) => {
      map.set(id, buildCategoryMetaMap(categoriesQueries[index]?.data?.data ?? []));
    });
    return map;
  }, [searchDictionaryIds, categoriesQueries]);

  useEffect(() => {
    let cancelled = false;
    fetch(VERBS_URL)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        setVerbData(Array.isArray(data) ? (data as VerbEntry[]) : []);
      })
      .catch(() => {
        if (!cancelled) setVerbData([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setOpenHintWordId(null);
        if (isMobileSearchOpen && window.innerWidth <= 768) {
          setIsMobileSearchOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileSearchOpen]);

  const searchVerbs = useCallback(
    (term: string): VerbListItem[] => {
      if (!verbData) return [{ text: t('verbsLoading') }];
      if (!verbData.length) return [{ text: t('verbsEmpty') }];

      const normalizedTerm = normalizeLatvian(term.toLowerCase());
      const rawTerm = term.toLowerCase();
      const found: VerbSuggestion[] = [];

      verbData.forEach((verb, index) => {
        const lemma = (verb.lemma || '').toLowerCase();
        const normalizedLemma = normalizeLatvian(lemma);
        const russian = (verb.translation?.ru || '').toLowerCase();
        const ukrainian = (verb.translation?.uk || '').toLowerCase();
        const forms = Array.isArray(verb.forms) ? verb.forms : [];

        const matchLemma = lemma.includes(rawTerm) || normalizedLemma.includes(normalizedTerm);
        const matchRussian = russian.includes(rawTerm);
        const matchUkrainian = ukrainian.includes(rawTerm);
        const matchForms = forms.some((form) => {
          const lowerForm = form.toLowerCase();
          return (
            lowerForm.includes(rawTerm) || normalizeLatvian(lowerForm).includes(normalizedTerm)
          );
        });

        if (matchLemma || matchRussian || matchUkrainian || matchForms) {
          const diffs: number[] = [];
          if (normalizedLemma) diffs.push(Math.abs(normalizedLemma.length - normalizedTerm.length));
          if (russian) diffs.push(Math.abs(russian.length - rawTerm.length));
          if (ukrainian) diffs.push(Math.abs(ukrainian.length - rawTerm.length));
          forms.forEach((form) => {
            diffs.push(Math.abs(form.toLowerCase().length - rawTerm.length));
          });

          found.push({
            index,
            latvian: verb.lemma || '',
            russian: verb.translation?.ru || '',
            ukrainian: verb.translation?.uk || '',
            className: verb.class || '',
            forms: forms.slice(),
            diff: diffs.length ? Math.min(...diffs) : Number.MAX_SAFE_INTEGER,
            raw: verb,
          });
        }
      });

      found.sort((a, b) => a.diff - b.diff);
      if (!found.length) return [{ text: t('verbsNotFound') }];
      return found.slice(0, 10);
    },
    [verbData, t],
  );

  const searchDictionary = useCallback(
    (term: string): DictListItem[] => {
      if (!searchDictionaryIds.length) return [];
      if (dictLoading) return [{ kind: 'status', text: t('dictLoading') }];
      if (!dictionaryWords.length) return [{ kind: 'status', text: t('dictEmpty') }];

      const normalizedTerm = normalizeLatvian(term.toLowerCase());
      const rawTerm = term.toLowerCase();
      const found: Extract<DictListItem, { kind: 'dict' }>[] = [];

      dictionaryWords.forEach((w) => {
        const word = String(w.word || '').toLowerCase();
        const normWord = normalizeLatvian(word);
        const t1 = String(w.translation_1 || '').toLowerCase();
        const t2 = String(w.translation_2 || '').toLowerCase();
        const t3 = String(w.translation_3 || '').toLowerCase();

        const match =
          word.includes(rawTerm) ||
          normWord.includes(normalizedTerm) ||
          t1.includes(rawTerm) ||
          t2.includes(rawTerm) ||
          t3.includes(rawTerm);

        if (!match) return;

        found.push({
          kind: 'dict',
          id: w.id,
          word: w.word || '',
          translation_1: w.translation_1 || '',
          category_ids: w.category_ids,
          diff: Math.min(
            Math.abs(normWord.length - normalizedTerm.length),
            Math.abs(t1.length - rawTerm.length),
          ),
          raw: {
            id: w.id,
            word: w.word,
            translation_1: w.translation_1,
            category_ids: w.category_ids ?? [],
            info: w.info,
            dictionaryId: w.dictionaryId,
          },
        });
      });

      found.sort((a, b) => a.diff - b.diff);
      if (!found.length) return [{ kind: 'status', text: t('dictNotFound') }];
      return found.slice(0, DICT_RESULTS_MAX);
    },
    [searchDictionaryIds, dictLoading, dictionaryWords, t],
  );

  const runSearch = useCallback(
    (term: string) => {
      if (term.length < 2) {
        setShowSuggestions(false);
        setOpenHintWordId(null);
        setVerbSuggestions([]);
        setDictSuggestions([]);
        return;
      }
      setVerbSuggestions(searchVerbs(term));
      setDictSuggestions(searchDictionaryIds.length ? searchDictionary(term) : []);
      setShowSuggestions(true);
    },
    [searchVerbs, searchDictionary, searchDictionaryIds],
  );

  const handleSuggestionClick = (verb: VerbListItem) => {
    if ('text' in verb && verb.text) return;
    const suggestion = verb as VerbSuggestion;
    setSearchTerm(suggestion.latvian || '');
    setShowSuggestions(false);
    setIsMobileSearchOpen(false);

    if (onVerbSelect) {
      const payload: VerbSelectPayload = suggestion.raw
        ? {
            ...suggestion.raw,
            latvian: suggestion.latvian,
            russian: suggestion.russian,
            ukrainian: suggestion.ukrainian,
            className: suggestion.className,
          }
        : suggestion;
      onVerbSelect(payload);
    }
  };

  const handleOpenDictionaryCategory = (
    item: Extract<DictListItem, { kind: 'dict' }>,
    e: MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const itemDictionaryId = item.raw?.dictionaryId ?? 0;
    const metaMap = categoryMetaByDictId.get(itemDictionaryId);
    const categoryId = metaMap ? getTrainingCategoryId(metaMap, item.raw || item) : 0;
    if (!categoryId || !itemDictionaryId) return;
    setShowSuggestions(false);
    setOpenHintWordId(null);
    setIsMobileSearchOpen(false);
    router.push(`/dictionaries/${itemDictionaryId}/category/${categoryId}`);
  };

  const handleToggleWordHint = (wordId: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenHintWordId((prev) => (prev === wordId ? null : wordId));
  };

  const handleInputFocus = (e: FocusEvent<HTMLInputElement>) => {
    setTimeout(() => e.target.select(), 0);
    if (searchTerm.length >= 2) runSearch(searchTerm);
  };

  useEffect(() => {
    const onTutorVerbOpen = (event: Event) => {
      const query = String((event as CustomEvent<{ query?: string }>).detail?.query || '').trim();
      if (!query) return;
      setSearchTerm(query);
      setIsMobileSearchOpen(true);
      setTimeout(() => inputRef.current?.focus(), 60);
      runSearch(query);
    };

    window.addEventListener('tutor.verb.open', onTutorVerbOpen);
    return () => window.removeEventListener('tutor.verb.open', onTutorVerbOpen);
  }, [runSearch]);

  const handleMobileSearchToggle = () => {
    setIsMobileSearchOpen((open) => {
      if (!open) setTimeout(() => inputRef.current?.focus(), 100);
      return !open;
    });
  };

  const handleMobileSearchClose = () => {
    setIsMobileSearchOpen(false);
    setShowSuggestions(false);
    setOpenHintWordId(null);
  };

  const hasDictSection = searchDictionaryIds.length > 0;
  const showDropdown =
    showSuggestions &&
    (verbSuggestions.length > 0 || (hasDictSection && dictSuggestions.length > 0));

  return (
    <div
      className={`${styles.wrapper} ${bright ? styles.bright : ''} ${
        isMobileSearchOpen ? styles.wrapperMobileOpen : ''
      }`}
      ref={searchRef}
    >
      <div className={styles.container}>
        <button
          className={styles.iconBtn}
          onClick={handleMobileSearchToggle}
          aria-label={t('openSearch')}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"
              fill="currentColor"
            />
          </svg>
        </button>

        <div
          className={`${styles.inputWrapper} ${
            isMobileSearchOpen ? styles.inputWrapperMobileOpen : ''
          }`}
        >
          <input
            ref={inputRef}
            type="text"
            className={`${styles.input} ${hasDictSection ? styles.inputWide : ''}`}
            placeholder={hasDictSection ? t('placeholderDict') : t('placeholder')}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              runSearch(e.target.value);
            }}
            onFocus={handleInputFocus}
            autoComplete="off"
          />
          {isMobileSearchOpen ? (
            <button
              className={styles.closeBtn}
              onClick={handleMobileSearchClose}
              aria-label={t('closeSearch')}
              type="button"
            >
              ×
            </button>
          ) : null}
        </div>

        {showDropdown ? (
          <div className={hasDictSection ? styles.suggestionsSplit : styles.suggestions}>
            <div className={`${styles.col} ${styles.colVerbs}`}>
              <div className={styles.sectionTitle}>{t('verbs')}</div>
              {verbSuggestions.map((suggestion, index) => {
                if ('text' in suggestion && suggestion.text) {
                  return (
                    <div key={`v-status-${index}`} className={styles.itemDisabled}>
                      {suggestion.text}
                    </div>
                  );
                }
                const s = suggestion as VerbSuggestion;
                return (
                  <div
                    key={`v-${s.index}-${index}`}
                    className={styles.item}
                    onClick={() => handleSuggestionClick(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleSuggestionClick(s);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <strong>{s.latvian}</strong>
                    <small>
                      {s.russian || '—'}
                      {s.ukrainian ? ` / ${s.ukrainian}` : ''}
                    </small>
                    {s.className ? (
                      <span className={styles.classTag}>
                        {t('classLabel')}: {s.className}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {hasDictSection ? (
              <div className={styles.col}>
                <div className={styles.sectionTitle}>{t('dictionary')}</div>
                {dictSuggestions.map((item, index) => {
                  if (item.kind === 'status' || ('text' in item && item.text)) {
                    return (
                      <div key={`d-status-${index}`} className={styles.itemDisabled}>
                        {'text' in item ? item.text : ''}
                      </div>
                    );
                  }
                  const itemMetaMap = categoryMetaByDictId.get(item.raw?.dictionaryId ?? 0);
                  const paths = itemMetaMap ? getDeepestCategoryPaths(itemMetaMap, item.raw || item) : [];
                  const wordInfo = String(item.raw?.info || '').trim();
                  const hintOpen = openHintWordId === item.id;
                  return (
                    <div key={`d-${item.id}`} className={styles.dictItem}>
                      <div className={styles.dictTop}>
                        <div className={styles.dictMain}>
                          <span className={styles.dictLemma}>
                            <strong>{item.word}</strong>
                            {wordInfo ? (
                              <button
                                type="button"
                                className={styles.hintBtn}
                                title={t('hint')}
                                aria-label={t('hint')}
                                aria-expanded={hintOpen}
                                onClick={(e) => handleToggleWordHint(item.id, e)}
                              >
                                ?
                              </button>
                            ) : null}
                          </span>
                          <small>{item.translation_1 || '—'}</small>
                        </div>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.openBtn}
                            title={t('openInDict')}
                            aria-label={t('openCategory')}
                            onClick={(e) => handleOpenDictionaryCategory(item, e)}
                          >
                            {t('open')}
                          </button>
                        </div>
                      </div>
                      {paths.length > 0 ? (
                        <span className={styles.cats}>{paths.join(', ')}</span>
                      ) : (
                        <span className={styles.catsEmpty}>{t('noCategory')}</span>
                      )}
                      {hintOpen && wordInfo ? (
                        <div
                          className={styles.popoverBackdrop}
                          onClick={() => setOpenHintWordId(null)}
                          role="presentation"
                        >
                          <div
                            className={styles.popover}
                            role="dialog"
                            aria-label={t('hint')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              className={styles.popoverContent}
                              dangerouslySetInnerHTML={{ __html: wordInfo }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
