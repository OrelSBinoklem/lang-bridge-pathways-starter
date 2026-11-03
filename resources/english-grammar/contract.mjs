const roles = new Set(['subject', 'auxiliary', 'negation', 'verb', 'object', 'complement', 'connector', 'time', 'place', 'question', 'determiner', 'modifier', 'plain']);
const id = /^[a-z][a-z0-9-]{1,79}$/;
const hosts = new Set(['dictionary.cambridge.org', 'learnenglish.britishcouncil.org', 'learnenglishteens.britishcouncil.org']);
const fail = message => { throw new Error(message); };
const text = value => typeof value === 'string' && value.trim().length > 0;
export function attachEnglishPresentation(tables, definitions) {
  if (!Array.isArray(definitions) || definitions.length !== tables.length) fail('Every English table needs presentation metadata.');
  const mapped = new Map();
  for (const item of definitions) {
    if (!tables.some(table => table.id === item.table_id) || mapped.has(item.table_id)
      || !['sentence', 'verb', 'noun', 'modifier', 'connection'].includes(item.family)
      || !['slots', 'paradigm', 'contrast', 'timeline'].includes(item.layout)
      || !['teal', 'blue', 'violet', 'amber', 'rose'].includes(item.accent) || !text(item.section)) fail('Invalid English table presentation.');
    mapped.set(item.table_id, item);
  }
  return tables.map(table => ({ ...table, presentation: mapped.get(table.id) }));
}
export function attachEnglishGrids(tables, grids) {
  if (!Array.isArray(grids) || grids.length !== tables.length) fail('Every English table needs a primary grid.');
  const mapped = new Map();
  for (const grid of grids) {
    const table = tables.find(table => table.id === grid.table_id);
    if (!table || mapped.has(grid.table_id) || !text(grid.title) || !text(grid.summary)) fail('Invalid or duplicate English primary grid.');
    if (grid.use_reference === true) {
      if (!table.reference || grid.columns || grid.rows) fail(`${grid.table_id}: reference grid must use the existing forms.`);
    } else {
      if (!Array.isArray(grid.columns) || grid.columns.length < 2 || grid.columns.length > 6 || !Array.isArray(grid.rows) || grid.rows.length < 3 || grid.rows.length > 12) fail(`${grid.table_id}: expected a comparison matrix.`);
      const keys = new Set();
      for (const column of grid.columns) {
        if (!/^[a-z][a-z0-9_-]{1,79}$/.test(column.key) || keys.has(column.key) || !text(column.label)) fail(`${grid.table_id}: invalid grid column.`);
        keys.add(column.key);
      }
      const rows = new Set();
      for (const row of grid.rows) {
        if (!id.test(row.id) || rows.has(row.id) || !text(row.label) || !row.cells || Object.keys(row.cells).length !== keys.size || [...keys].some(key => !text(row.cells[key]))) fail(`${grid.table_id}: invalid grid row.`);
        rows.add(row.id);
      }
    }
    mapped.set(grid.table_id, grid);
  }
  return tables.map(table => ({ ...table, grid: mapped.get(table.id) }));
}
export function orderEnglishTables(tables) {
  const levels = ['a1', 'a2', 'b1', 'b2'];
  return [...tables].sort((a, b) => levels.indexOf(a.level) - levels.indexOf(b.level));
}

export function validateEnglishTables(tables) {
  if (!Array.isArray(tables) || !tables.length) fail('English catalog must be a nonempty array.');
  const ids = new Set(), keys = new Set();
  for (const table of tables) {
    if (!table || !id.test(table.id) || !table.id.startsWith('en-') || !/^english[A-Z][a-zA-Z0-9]{1,60}$/.test(table.key)) fail('Invalid English table identity.');
    if (ids.has(table.id) || keys.has(table.key)) fail(`Duplicate table ${table.id}.`);
    ids.add(table.id); keys.add(table.key);
    if (!['a1', 'a2', 'b1', 'b2'].includes(table.level)) fail(`${table.id}: invalid level.`);
    for (const field of ['group', 'title', 'subtitle', 'rule', 'when']) if (!text(table[field])) fail(`${table.id}: missing ${field}.`);
    if (!Array.isArray(table.rows) || table.rows.length < 3 || table.rows.length > 12) fail(`${table.id}: expected 3..12 meaningful rows.`);
    const rowIds = new Set();
    for (const row of table.rows) {
      if (!id.test(row.id) || rowIds.has(row.id) || !text(row.label) || !text(row.translation)) fail(`${table.id}: invalid row.`);
      rowIds.add(row.id);
      for (const field of ['pattern', 'example']) if (!Array.isArray(row[field]) || !row[field].length || row[field].some(token => !roles.has(token.role) || !text(token.text))) fail(`${table.id}/${row.id}: invalid ${field}.`);
    }
    if (table.reference) {
      const grid = table.reference;
      if (!text(grid.title) || !Array.isArray(grid.columns) || grid.columns.length < 2 || grid.columns.length > 8 || !Array.isArray(grid.rows) || grid.rows.length < 1 || grid.rows.length > 100) fail(`${table.id}: invalid reference grid.`);
      const columns = new Set();
      for (const column of grid.columns) {
        if (!id.test(column.key) || columns.has(column.key) || !text(column.label)) fail(`${table.id}: invalid reference column.`);
        columns.add(column.key);
      }
      const rows = new Set();
      for (const row of grid.rows) {
        if (!id.test(row.id) || rows.has(row.id) || !row.values || Object.keys(row.values).length !== columns.size || [...columns].some(key => !Object.hasOwn(row.values, key) || !text(row.values[key]))) fail(`${table.id}: invalid reference row.`);
        rows.add(row.id);
      }
      if (grid.note != null && !text(grid.note)) fail(`${table.id}: invalid reference note.`);
    }
    if (!Array.isArray(table.notes) || !table.notes.length || table.notes.some(note => !text(note))) fail(`${table.id}: missing scope notes.`);
    if (!Array.isArray(table.pitfalls) || !table.pitfalls.length || table.pitfalls.some(item => !text(item.wrong) || !text(item.right) || !text(item.why) || item.wrong === item.right)) fail(`${table.id}: invalid pitfalls.`);
    if (!Array.isArray(table.related) || !Array.isArray(table.sources) || !table.sources.length) fail(`${table.id}: missing references.`);
    for (const source of table.sources) {
      let url; try { url = new URL(source.url); } catch { fail(`${table.id}: invalid source URL.`); }
      if (!text(source.title) || url.protocol !== 'https:' || !hosts.has(url.hostname) || url.username || url.password) fail(`${table.id}: source must be Cambridge or British Council HTTPS.`);
    }
  }
  for (const table of tables) for (const target of table.related) if (target === table.id || !ids.has(target)) fail(`${table.id}: unresolved related table ${target}.`);
  return tables;
}

export function englishHighlightTargets(table) {
  const target = (labelRu, selector) => ({ labelRu, selectors: [{ selector }] });
  const result = {
    all: target(`Вся английская таблица: ${table.title}`, ':scope'),
    rule: target('Правило построения конструкции', '.tt-rule'),
    pattern: target('Все схемы предложения', '.tt-pattern'),
    example: target('Все английские примеры', '.tt-example'),
    translation: target('Русские переводы примеров', '.tt-translation'),
    pitfalls: target('Типичные ошибки и исправления', '.tt-pitfalls'),
    notes: target('Раскрывающаяся справка о нюансах и границах правила', '.tt-notes > summary'),
  };
  if (table.grid) {
    result.grid = target('Основная сравнительная таблица', '.tt-grid');
    result.grid_summary = target('Краткая подсказка под таблицей', '.tt-grid-summary');
    result.explanation = target('Раскрыть правило и подробные примеры', '.tt-explanation > summary');
    for (const column of table.grid.columns ?? []) result[`grid_col_${column.key}`] = target(column.label, `.tt-grid-col-${column.key}`);
    for (const row of table.grid.rows ?? []) result[`grid_row_${row.id}`] = target(row.label, `.tt-grid-row-${row.id}`);
  }
  for (const row of table.rows) result[`row_${row.id}`] = target(row.label, `.tt-row-${row.id}`);
  if (table.reference) {
    result.reference = target(table.reference.title, '.tt-reference');
    for (const column of table.reference.columns) result[`ref_col_${column.key}`] = target(`Справочные формы: ${column.label}`, `.tt-ref-col-${column.key}`);
    for (const row of table.reference.rows) result[`ref_row_${row.id}`] = target(`Справочная строка: ${row.values[table.reference.columns[0].key]}`, `.tt-ref-row-${row.id}`);
  }
  const usedRoles = new Set(table.rows.flatMap(row => [...row.pattern, ...row.example].map(part => part.role)));
  const labels = { subject: 'Подлежащее', auxiliary: 'Вспомогательный глагол', negation: 'Отрицание', verb: 'Смысловой глагол', object: 'Дополнение', complement: 'Признак / состояние', connector: 'Связка', time: 'Время', place: 'Место', question: 'Вопросительное слово', determiner: 'Определитель', modifier: 'Уточнение', plain: 'Другие слова' };
  for (const role of usedRoles) result[`role_${role}`] = target(labels[role], `.tt-role-${role}`);
  return result;
}
