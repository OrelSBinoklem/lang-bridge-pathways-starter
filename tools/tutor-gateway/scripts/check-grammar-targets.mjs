#!/usr/bin/env node
/**
 * Prints a snippet for the browser console that checks the highlight targets of grammar table docs.
 *
 *   node tools/tutor-gateway/scripts/check-grammar-targets.mjs sufiksi genitivs   # only these tables
 *   node tools/tutor-gateway/scripts/check-grammar-targets.mjs --all               # every table
 *
 * Open /grammar, choose the level of the tables, paste the snippet into the DevTools console. For each
 * table that is on the page it counts, per target, the elements the selectors find and lists the targets
 * that find nothing (they would make the bot highlight nothing). Tables of other levels are reported as
 * "not on the page": switch the level and run the snippet again.
 *
 * The snippet asks the gallery to mount a table first (the same `grammar.table.reveal` event the bot uses),
 * so it also works for tables that lazy rendering has unmounted.
 */
import { getGrammarTableDoc, listGrammarTableDocs } from '../src/commands/grammarTables.mjs';

const args = process.argv.slice(2);
const keys = args.includes('--all') || args.length === 0 ? listGrammarTableDocs().map((doc) => doc.tableKey) : args;

const selectors = {};
for (const key of keys) {
  const doc = getGrammarTableDoc(key);
  if (!doc) {
    console.error(`Unknown table "${key}". Known keys: node -e "import('./src/commands/grammarTables.mjs').then(m=>console.log(m.listGrammarTableDocs().map(d=>d.tableKey).join(' ')))"`);
    process.exit(1);
  }
  selectors[doc.tableKey] = Object.fromEntries(
    Object.entries(doc.highlightTargets).map(([name, target]) => [name, target.selectors.map((item) => item.selector)]),
  );
}

console.log(`(() => {
  const docs = ${JSON.stringify(selectors)};
  const report = {};
  for (const [key, targets] of Object.entries(docs)) {
    const selector = '[data-grammar-table-key="' + key + '"]';
    let root = document.querySelector(selector);
    if (!root) {
      window.dispatchEvent(new CustomEvent('grammar.table.reveal', { detail: { tableKey: key } }));
      root = document.querySelector(selector);
    }
    if (!root) { report[key] = 'not on the page (other level?)'; continue; }
    const empty = [];
    for (const [name, list] of Object.entries(targets)) {
      let count = 0;
      for (const s of list) count += s === ':scope' ? 1 : root.querySelectorAll(s).length;
      if (!count) empty.push(name);
    }
    report[key] = { targets: Object.keys(targets).length, withoutMatches: empty };
  }
  console.table(report);
  return report;
})();`);
