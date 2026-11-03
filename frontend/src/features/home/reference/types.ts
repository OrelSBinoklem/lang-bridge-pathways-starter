import type { GrammarTableComponentKey } from '@/features/grammar/componentRegistry';

export type ReferenceLocale = 'ru' | 'uk';
export type LocalizedText = { ru: string; uk: string };
export const L = (ru: string, uk: string): LocalizedText => ({ ru, uk });
export const V = (value: string): LocalizedText => L(value, value);
export type ReferenceTableSpec = {
  key: GrammarTableComponentKey;
  focus: { label: LocalizedText; selector: string; description?: LocalizedText }[];
};
export type ReferenceSection = {
  id: string;
  level: 'A1' | 'A2' | 'B1' | 'B2';
  title: LocalizedText;
  summary: LocalizedText;
  paragraphs: LocalizedText[];
  examples: (({ lv: string } | { en: string }) & { translation: LocalizedText; note?: LocalizedText })[];
  comparison?: { headings: LocalizedText[]; rows: LocalizedText[][] };
  remember: LocalizedText;
  table?: ReferenceTableSpec;
  tableLinks?: { href: string; label: LocalizedText }[];
};
