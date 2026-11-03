'use client';

import { GrammarTablesGallery } from '@/features/grammar/GrammarTablesGallery';
import type { GrammarTableItem, GrammarTablesData } from '@/features/grammar/data/tablesData';
import type { ComponentType } from 'react';
import { ENGLISH_TABLES, filterTables } from './catalog';
import { EnglishGrammarTable } from './EnglishGrammarTable';
import type { Level } from './types';
import styles from './english-tables.module.css';

const components = new Map<string, ComponentType>();
export const ENGLISH_GALLERY_CATALOG: GrammarTablesData = { group1: [], group2: [], group3: [] };
for (const table of ENGLISH_TABLES) {
  const Component = () => <div className={`${styles.page} ${styles.courseEmbed} ${styles.scaled}`}><EnglishGrammarTable table={table} tables={ENGLISH_TABLES} withinGallery /></div>;
  components.set(table.key, Component);
  const group = table.level === 'a1' ? 'group1' : table.level === 'a2' ? 'group2' : 'group3';
  ENGLISH_GALLERY_CATALOG[group].push({ id: table.id, componentKey: table.key, title: table.grid?.title ?? table.title, alt: table.grid?.title ?? table.title,
    level: table.level, src: '', hintId: table.id, width: 748, height: table.reference && table.grid?.use_reference ? 520 : 420, fontScalePercent: 130 });
}
const componentFor = (item: GrammarTableItem) => components.get(item.componentKey ?? '') ?? null;
const matchesQuery = (item: GrammarTableItem, query: string) => filterTables(ENGLISH_TABLES.filter(table => table.id === item.id), 'all', query).length > 0;

export function EnglishGrammarGallery({ initialLevel = 'a1' }: { initialLevel?: Level | 'all'; authenticated?: boolean }) {
  return <GrammarTablesGallery language="en" catalog={ENGLISH_GALLERY_CATALOG} componentFor={componentFor} ownsTableRoot matchesQuery={matchesQuery}
    initialSettings={{ 'gallery-level': initialLevel === 'all' ? 'a1' : initialLevel }} />;
}
