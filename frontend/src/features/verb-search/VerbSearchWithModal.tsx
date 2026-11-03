'use client';

import { useEffect, useState } from 'react';
import { VerbModal } from '@/features/verb-search/VerbModal';
import { VerbSearch } from '@/features/verb-search/VerbSearch';
import { normalizeLatvian } from '@/features/verb-search/normalizeLatvian';
import type { LearnLang } from '@/lib/learn-lang';
import type {
  ReferenceTableSource,
  VerbEntry,
  VerbModalData,
  VerbSelectPayload,
} from '@/features/verb-search/types';

type LookupMaps = {
  byLemma: Record<string, VerbEntry>;
  byNormalized: Record<string, VerbEntry>;
};

type TableLookup = {
  byLemma: Record<string, number[]>;
  byNormalized: Record<string, number[]>;
};

type ReferenceTables = {
  list: ReferenceTableSource[];
  byNumber: Record<string, ReferenceTableSource>;
};

type Props = {
  bright?: boolean;
  initialLearnLang: LearnLang;
};

function addTableNumber(
  map: Record<string, number[]>,
  key: string,
  tableNumber: number,
) {
  if (!key) return;
  if (!map[key]) map[key] = [tableNumber];
  else if (!map[key].includes(tableNumber)) map[key].push(tableNumber);
}

export function VerbSearchWithModal({ bright = false, initialLearnLang }: Props) {
  const [verbModalData, setVerbModalData] = useState<VerbModalData | null>(null);
  const [verbFormsLookup, setVerbFormsLookup] = useState<LookupMaps>({
    byLemma: {},
    byNormalized: {},
  });
  const [verbTableLookup, setVerbTableLookup] = useState<TableLookup>({
    byLemma: {},
    byNormalized: {},
  });
  const [referenceVerbTables, setReferenceVerbTables] = useState<ReferenceTables>({
    list: [],
    byNumber: {},
  });

  useEffect(() => {
    fetch('/verbs/verbs.15cells.tr_gpt5.json')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const byLemma: Record<string, VerbEntry> = {};
        const byNormalized: Record<string, VerbEntry> = {};
        (data as VerbEntry[]).forEach((item) => {
          if (!item?.lemma) return;
          const lower = String(item.lemma).trim().toLowerCase();
          if (!lower) return;
          byLemma[lower] = item;
          const norm = normalizeLatvian(lower);
          if (norm && !byNormalized[norm]) byNormalized[norm] = item;
        });
        setVerbFormsLookup({ byLemma, byNormalized });
      })
      .catch(() => setVerbFormsLookup({ byLemma: {}, byNormalized: {} }));
  }, []);

  useEffect(() => {
    fetch('/verbs/darbs.json')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        const byLemma: Record<string, number[]> = {};
        const byNormalized: Record<string, number[]> = {};
        Object.entries(data as Record<string, unknown>).forEach(([tableId, verbs]) => {
          const tn = parseInt(tableId, 10);
          if (!Number.isFinite(tn) || !Array.isArray(verbs)) return;
          verbs.forEach((v) => {
            const lower = String(v || '')
              .trim()
              .toLowerCase();
            if (!lower) return;
            addTableNumber(byLemma, lower, tn);
            const norm = normalizeLatvian(lower);
            if (norm) addTableNumber(byNormalized, norm, tn);
          });
        });
        setVerbTableLookup({ byLemma, byNormalized });
      })
      .catch(() => setVerbTableLookup({ byLemma: {}, byNormalized: {} }));
  }, []);

  useEffect(() => {
    fetch('/verbs/latvian_verb_tables_15forms.json')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const byNumber: Record<string, ReferenceTableSource> = {};
        (data as ReferenceTableSource[]).forEach((item) => {
          if (!item) return;
          const k = item.table_number ?? item.tableNumber;
          if (k != null) byNumber[String(k)] = item;
        });
        setReferenceVerbTables({ list: data as ReferenceTableSource[], byNumber });
      })
      .catch(() => setReferenceVerbTables({ list: [], byNumber: {} }));
  }, []);

  const buildModalPayload = (suggestion: {
    lemma: string;
    translationRu?: string;
    translationUk?: string;
    tableNumbers?: number[];
    className?: string;
  }): VerbModalData => {
    const lemma = suggestion.lemma.trim();
    const lemmaLower = lemma.toLowerCase();
    const formsSource =
      verbFormsLookup.byLemma[lemmaLower] ||
      verbFormsLookup.byNormalized[normalizeLatvian(lemmaLower)];
    const forms = Array.isArray(formsSource?.forms) ? formsSource.forms.slice(0, 15) : [];

    const matched = new Set<number>();
    if (lemmaLower) {
      (verbTableLookup.byLemma[lemmaLower] || []).forEach(
        (n) => Number.isFinite(n) && matched.add(n),
      );
      const norm = normalizeLatvian(lemmaLower);
      if (norm) {
        (verbTableLookup.byNormalized[norm] || []).forEach(
          (n) => Number.isFinite(n) && matched.add(n),
        );
      }
    }
    (suggestion.tableNumbers || []).forEach((n) => Number.isFinite(n) && matched.add(n));
    const matchedTableNumbers = [...matched].sort((a, b) => a - b);

    let referenceTable: VerbModalData['referenceTable'] = null;
    for (const tn of matchedTableNumbers) {
      const entry = referenceVerbTables.byNumber[String(tn)];
      if (entry) {
        referenceTable = { tableNumber: tn, source: entry };
        break;
      }
    }

    return {
      lemma,
      translation: {
        ru: suggestion.translationRu || '',
        uk: suggestion.translationUk || '',
      },
      className: formsSource?.class || suggestion.className || '',
      forms,
      generatedFormsAvailable: forms.length >= 15,
      matchedTableNumbers,
      referenceTable,
    };
  };

  const onVerbSelect = (p: VerbSelectPayload) => {
    if (!p?.lemma && !p?.latvian) return;
    setVerbModalData(
      buildModalPayload({
        lemma: p.lemma || p.latvian || '',
        translationRu: p.translationRu || p.russian || p.translation?.ru,
        translationUk: p.translationUk || p.ukrainian || p.translation?.uk,
        tableNumbers: p.tableNumbers,
        className: p.className || p.class,
      }),
    );
  };

  useEffect(() => {
    const onTutorVerbOpen = (event: Event) => {
      const query = String((event as CustomEvent<{ query?: string }>).detail?.query || '')
        .trim()
        .toLowerCase();
      if (!query) return;

      const normalizedQuery = normalizeLatvian(query);
      const found =
        verbFormsLookup.byLemma[query] ||
        verbFormsLookup.byNormalized[normalizedQuery] ||
        Object.values(verbFormsLookup.byLemma).find((entry) => {
          const lemma = String(entry.lemma || '').toLowerCase();
          return lemma.includes(query) || normalizeLatvian(lemma).includes(normalizedQuery);
        });

      if (!found?.lemma) return;
      setVerbModalData(
        buildModalPayload({
          lemma: found.lemma,
          translationRu: found.translation?.ru,
          translationUk: found.translation?.uk,
          className: found.class,
        }),
      );
    };

    window.addEventListener('tutor.verb.open', onTutorVerbOpen);
    return () => window.removeEventListener('tutor.verb.open', onTutorVerbOpen);
  }, [verbFormsLookup, verbTableLookup, referenceVerbTables]);

  return (
    <>
      <VerbSearch onVerbSelect={onVerbSelect} bright={bright} initialLearnLang={initialLearnLang} />
      <VerbModal verbData={verbModalData} onClose={() => setVerbModalData(null)} />
    </>
  );
}
