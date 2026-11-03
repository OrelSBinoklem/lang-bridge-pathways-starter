export const LEVELS = ['a1', 'a2', 'b1', 'b2'] as const;
export type Level = typeof LEVELS[number];
export const ROLES = ['subject', 'auxiliary', 'negation', 'verb', 'object', 'complement', 'connector', 'time', 'place', 'question', 'determiner', 'modifier', 'plain'] as const;
export type Role = typeof ROLES[number];
export type Token = { role: Role; text: string };
export type GrammarRow = { id: string; label: string; pattern: Token[]; example: Token[]; translation: string; note?: string };
export type ReferenceGrid = { title: string; columns: { key: string; label: string }[]; rows: { id: string; values: Record<string, string> }[]; note?: string };
export type PrimaryGrid = { table_id: string; title: string; summary: string; use_reference?: boolean; row_label?: string;
  columns?: { key: string; label: string }[]; rows?: { id: string; label: string; cells: Record<string, string> }[] };
export type EnglishTable = {
  id: string; key: string; level: Level; group: string; title: string; subtitle: string;
  rule: string; when: string; rows: GrammarRow[];
  pitfalls: { wrong: string; right: string; why: string }[];
  notes: string[]; related: string[]; sources: { title: string; url: string }[];
  reference?: ReferenceGrid;
  grid?: PrimaryGrid;
  presentation?: { table_id: string; family: 'sentence' | 'verb' | 'noun' | 'modifier' | 'connection'; layout: 'slots' | 'paradigm' | 'contrast' | 'timeline'; section: string; accent: 'teal' | 'blue' | 'violet' | 'amber' | 'rose' };
};
export const ROLE_LABELS: Record<Role, string> = {
  subject: 'Кто / что · S', auxiliary: 'Вспомогательный глагол', negation: 'Отрицание',
  verb: 'Глагол · V', object: 'Дополнение · O', complement: 'Признак / состояние · C',
  connector: 'Связка / предлог', time: 'Когда', place: 'Где / куда', question: 'Вопросительное слово',
  determiner: 'Определитель', modifier: 'Уточнение', plain: 'Другие слова',
};
