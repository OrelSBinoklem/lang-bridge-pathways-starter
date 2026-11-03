# Grammar Component Tables

Imported React/HTML grammar tables from:

`C:\ospanel2\home\interactive-cheat-sheet.local\react-app\src\components\tables`

Test route:

`/grammar/components`

Current setup:

- `components/tables/index.js` is the imported registry of all table components.
- `GrammarComponentTablesPage.jsx` renders the registry with a simple search field.
- Imported table JSX is kept raw in `components/tables/` and excluded from ESLint until each table is migrated.
- Component-level `.scss` files are kept next to JSX for future editing/reference.
- The test page currently uses one generated CSS bundle:
  `frontend/src/app/grammar/components/grammar-component-tables.css`
- The generated CSS is scoped under `.grammar-component-tables-page` so legacy table selectors do not leak into the rest of the site.

Migration plan:

1. Keep `/grammar` as the current image gallery.
2. Use `/grammar/components` to verify HTML/React table rendering.
3. Replace image entries in `frontend/src/features/grammar/data/tablesData.ts` with component-backed entries one by one.
4. When a table is fully migrated, move its active styles out of the generated bundle and into the final grammar table styling system.
