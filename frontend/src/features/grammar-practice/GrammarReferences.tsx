'use client';

import tablesData from '@/features/grammar/data/tablesData';
import { getGrammarTableComponent } from '@/features/grammar/componentRegistry';
import { ScaledTableEmbed } from '@/features/grammar/ScaledTableEmbed';
import { resolveGrammarTableKeys } from '@/features/grammar/data/grammarTableBindings';
import { ENGLISH_TABLES } from '@/features/english-grammar/catalog';
import { EnglishGrammarTable } from '@/features/english-grammar/EnglishGrammarTable';
import englishStyles from '@/features/english-grammar/english-tables.module.css';

export default function GrammarReferences({
    tableKeys,
}: {
    tableKeys: string[];
}) {
    const resolved = resolveGrammarTableKeys(tableKeys);
    const tables = Object.values(tablesData)
        .flat()
        .filter(
            (table) =>
                table.componentKey && resolved.includes(table.componentKey),
        );
    return (
        <>
            {ENGLISH_TABLES.filter(table => resolved.includes(table.key)).map(table => <details key={table.id}>
                <summary>{table.title}</summary>
                <div className={`${englishStyles.page} ${englishStyles.courseEmbed}`}><EnglishGrammarTable table={table} tables={ENGLISH_TABLES} /></div>
            </details>)}
            {tables.map((table) => {
                const Component = getGrammarTableComponent(table.componentKey);
                if (!Component) return null;
                return (
                    <details key={String(table.id)}>
                        <summary>{table.title}</summary>
                        <ScaledTableEmbed
                            fontScalePercent={table.fontScalePercent}
                            className="grammar-component-tables-page grammar-component-table-embed"
                            data-grammar-table-key={table.componentKey}
                            data-grammar-table-id={table.id}
                        >
                            <Component />
                        </ScaledTableEmbed>
                    </details>
                );
            })}
        </>
    );
}
