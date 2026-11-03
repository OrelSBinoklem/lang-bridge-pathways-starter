import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('./practice-awards.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { getPracticeAwards } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('three empty awards before starting, without inventing extra completions', () => {
  assert.deepEqual(getPracticeAwards([null]).map(a => a.percent), [0, 0, 0]);
  assert.deepEqual(getPracticeAwards([{ passed: 2, total: 3, additional_variants: 9 }]).map(a => a.percent), [66, 0, 0]);
});
test('aggregate completed tasks, not an unweighted average of skill percentages', () => {
  const awards = getPracticeAwards([
    { passed: 1, total: 1, practice_rounds: [{passed:1,total:1},{passed:1,total:1},{passed:0,total:1}] },
    { passed: 1, total: 3, practice_rounds: [{passed:1,total:3},{passed:0,total:3},{passed:0,total:3}] },
  ]);
  assert.deepEqual(awards.map(a => a.percent), [50, 25, 0]);
});
test('rank thresholds and diamond only at full completion', () => {
  for (const [passed, rank] of [[0,null],[59,null],[60,'bronze'],[80,'silver'],[90,'gold'],[99,'gold'],[100,'diamond']]) {
    assert.equal(getPracticeAwards([{passed,total:100}])[0].rank, rank);
  }
});
test('all three rounds can reach diamond; invalid values cannot exceed bounds', () => {
  assert.deepEqual(getPracticeAwards([{passed:3,total:3,practice_rounds:Array(3).fill({passed:3,total:3})}]).map(a => a.rank), ['diamond','diamond','diamond']);
  assert.equal(getPracticeAwards([{passed:9,total:3}])[0].percent,100);
  assert.equal(getPracticeAwards([{passed:-1,total:3}])[0].percent,0);
  assert.equal(getPracticeAwards([{passed:NaN,total:3}])[0].percent,0);
});

test('a star is filled only after every required task in its round is passed', () => {
  for (const passed of [0, 3, 4]) {
    assert.equal(getPracticeAwards([{passed,total:5}])[0].completed,false);
  }
  assert.equal(getPracticeAwards([{passed:5,total:5}])[0].completed,true);
  assert.deepEqual(getPracticeAwards([null,{passed:0,total:0}]).map(a=>a.completed),[false,false,false]);
});

test('the triple award requires three fully completed rounds, not partial extra practice', () => {
  const progress={passed:5,total:5,practice_rounds:[{passed:5,total:5},{passed:5,total:5},{passed:4,total:5}]};
  assert.deepEqual(getPracticeAwards([progress]).map(a=>a.completed),[true,true,false]);
  progress.practice_rounds[2].passed=5;
  assert(getPracticeAwards([progress]).every(a=>a.completed));
});
