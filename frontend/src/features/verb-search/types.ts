export type VerbTranslation = {
  ru?: string;
  uk?: string;
};

export type VerbEntry = {
  lemma?: string;
  class?: string;
  forms?: string[];
  translation?: VerbTranslation;
};

export type VerbSuggestion = {
  index: number;
  latvian: string;
  russian: string;
  ukrainian: string;
  className: string;
  forms: string[];
  diff: number;
  raw: VerbEntry;
  text?: never;
};

export type VerbStatusSuggestion = {
  text: string;
  index?: never;
  latvian?: never;
};

export type VerbListItem = VerbSuggestion | VerbStatusSuggestion;

export type DictSuggestionWord = {
  id: number;
  word?: string;
  translation_1?: string | null;
  category_ids: number[];
  category_id?: number | null;
  info?: string | null;
  /** Which dictionary this word came from — results can now be merged from several dictionaries
   * searched at once, so each one needs to remember its own source for category lookups/links. */
  dictionaryId: number;
};

export type DictSuggestion = {
  kind: 'dict';
  id: number;
  word: string;
  translation_1: string;
  category_ids?: number[];
  category_id?: number | null;
  diff: number;
  raw: DictSuggestionWord;
  text?: never;
};

export type DictStatusSuggestion = {
  kind: 'status';
  text: string;
  id?: never;
};

export type DictListItem = DictSuggestion | DictStatusSuggestion;

export type ReferenceTenseForms = {
  '1sg'?: string;
  '2sg'?: string;
  '3sg'?: string;
  '1pl'?: string;
  '2pl'?: string;
  '3pl'?: string;
};

export type ReferenceTableSource = {
  infinitive?: string;
  table_number?: number | string;
  tableNumber?: number | string;
  forms?: {
    past?: ReferenceTenseForms;
    present?: ReferenceTenseForms;
    future?: ReferenceTenseForms;
  };
};

export type VerbModalData = {
  lemma: string;
  translation: VerbTranslation;
  className: string;
  forms: string[];
  generatedFormsAvailable: boolean;
  matchedTableNumbers: number[];
  referenceTable?: {
    tableNumber: number;
    source: ReferenceTableSource;
  } | null;
  latvian?: string;
  russian?: string;
  ukrainian?: string;
  verb?: string;
  class?: string;
};

export type VerbSelectPayload = VerbEntry & {
  latvian?: string;
  russian?: string;
  ukrainian?: string;
  className?: string;
  tableNumbers?: number[];
  translationRu?: string;
  translationUk?: string;
};
