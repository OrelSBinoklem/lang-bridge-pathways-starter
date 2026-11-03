import catalog from './practiceConsolidation.json';

const retired: Record<string, { id: string; tables: string[] }> = catalog.retired;

export function resolveGrammarTableKeys(keys: string[]): string[] {
  return [...new Set(keys.flatMap(key => retired[key]?.tables ?? [key]))];
}

export function resolveGrammarTableLink(value: string): string {
  const entry = retired[value] ?? Object.values(retired).find(item => item.id === value);
  return entry?.tables[0] ?? value;
}
