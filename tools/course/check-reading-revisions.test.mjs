import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical, digest, inspectReadingRevisions } from './check-reading-revisions.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = fileURLToPath(new URL('./check-reading-revisions.mjs', import.meta.url));
const clone = value => structuredClone(value);

function fixture(categories = [{ category_id: 9001, level: 'A1' }]) {
  const baseline = { schema_version: 1, groups: clone(categories), variants: [] }, packs = [];
  for (const [categoryIndex, category] of categories.entries()) {
    const variants = [];
    for (const [kindIndex, kind] of ['reading_binary', 'lv_to_ru'].entries()) {
      for (let index = 0; index < 5; index++) {
        const variantId = 1000 + categoryIndex * 10 + kindIndex * 5 + index;
        const config = { task_kind: kind, instruction: 'Read carefully.', authoring: { dictionary_id: 20, flags: [], settings: {} }, optional: null };
        if (kind === 'reading_binary') {
          config.text = `Anna lasa gr\u0101matu ${category.category_id}-${index + 1}. Vi\u0146a katru r\u012btu iet uz bibliot\u0113ku un vakar\u0101 raksta piez\u012bmes.`;
          config.questions = Array.from({ length: 10 }, (_, q) => ({ statement: `Teksta apgalvojums ${q + 1}.`, correct: q % 2 === 0, explanation: 'Tekst\u0101 min\u0113ta bibliot\u0113ka.' }));
        } else {
          config.source_text = `P\u0113teris brauc uz darbu ${category.category_id}-${index + 1}. Autobuss pietur pie parka un bi\u013cete maks\u0101 divus eiro.`;
          config.reference_translation = '\u041f\u0435\u0442\u0440 \u0435\u0434\u0435\u0442 \u043d\u0430 \u0440\u0430\u0431\u043e\u0442\u0443.';
        }
        const source = { id: variantId, block_id: 100 + categoryIndex * 2 + kindIndex, page_id: 50 + categoryIndex,
          ...category, position: index, seed_key: `seed-${index + 11}`, title: `Reading ${variantId}`, config, config_sha256: digest(config) };
        baseline.variants.push(source);
        variants.push({ variant_id: variantId, block_id: source.block_id, expected_config_sha256: source.config_sha256,
          expected_title: source.title, action: 'keep', title: source.title, config: clone(config), findings: [], changes: [],
          question_review: kind === 'reading_binary' ? Array.from({ length: 10 }, (_, q) => ({ index: q, quote: 'Anna lasa',
            rationale: 'The passage explicitly identifies the reader.', skill: 'detail' })) : [],
          lexical_notes: kind === 'lv_to_ru' ? ['Keep the transport vocabulary and the price.'] : [] });
      }
    }
    packs.push({ schema_version: 1, ...category, variants });
  }
  return { packs, baseline };
}

const check = f => inspectReadingRevisions(f.packs, f.baseline);
const hasError = (result, text) => assert.ok(result.errors.some(message => message.includes(text)), `${text}: ${JSON.stringify(result.errors)}`);
function revise(f, index = 0, action = 'copyedit') {
  const variant = f.packs[0].variants[index];
  variant.action = action;
  variant.title += ' revised';
  variant.findings = [{ kind: 'clarity', detail: 'The original title does not identify the reading task.', old_quote: variant.expected_title }];
  variant.changes = ['Identify the reading task in the title.'];
  return variant;
}
function refreshBaseline(f, index) {
  const source = f.baseline.variants[index];
  source.config_sha256 = digest(source.config);
  f.packs[0].variants[index].expected_config_sha256 = source.config_sha256;
}

test('full coverage comes from arbitrary baseline IDs/categories and preserves input', () => {
  const f = fixture([{ category_id: 9001, level: 'A1' }, { category_id: 12345, level: 'B2' }]);
  const original = clone(f), report = check(f);
  assert.deepEqual(report.errors, []);
  assert.equal(report.rows.length, 20);
  assert.equal(report.summary.baseline_variants, 20);
  assert.equal(report.summary.complete, true);
  assert.equal(report.summary.valid, true);
  assert.equal(report.summary.actions.keep, 20);
  assert.ok(report.rows.every(row => row.before_config_sha256 === row.after_config_sha256));
  assert.deepEqual(f, original);
});

test('translation findings can cite the actual old Russian reference but not an invented reference', () => {
  const f = fixture();
  const variant = revise(f, 5);
  variant.findings = [{ kind: 'translation_naturalness', detail: 'Make the Russian translation more natural.',
    old_quote: f.baseline.variants[5].config.reference_translation }];
  variant.config.reference_translation = 'Пётр добирается до работы на автобусе.';
  assert.deepEqual(check(f).errors, []);
  variant.findings[0].old_quote = 'Не существовавший исходный перевод.';
  hasError(check(f), 'verbatim baseline quote');
});

test('canonical hashes sort recursively, keep arrays and empty objects, and leave Unicode/slashes unescaped', () => {
  const value = { z: {}, a: [], nested: { z: 2, a: '\u0100/\u0434/\u2028/\u2029' }, list: [{ b: 2, a: 1 }, null] };
  const serialized = '{"a":[],"list":[{"a":1,"b":2},null],"nested":{"a":"\u0100/\u0434/\u2028/\u2029","z":2},"z":{}}';
  assert.equal(JSON.stringify(canonical(value)), serialized);
  assert.equal(digest(value), createHash('sha256').update(serialized).digest('hex'));
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
  assert.notEqual(digest([1, 2]), digest([2, 1]));
  assert.notEqual(digest({}), digest([]));
  assert.equal(JSON.stringify(canonical(JSON.parse('{"__proto__":{"b":2,"a":1}}'))), '{"__proto__":{"a":1,"b":2}}');
});

test('hashes match the actual PHP canonicalJson without bootstrapping the app or a database', t => {
  const php = process.env.PHP_BINARY ?? (existsSync('C:/ospanel2/modules/PHP-8.4/PHP/php.exe') ? 'C:/ospanel2/modules/PHP-8.4/PHP/php.exe' : 'php');
  const values = [fixture().baseline.variants[0].config,
    { z: {}, a: [], numbers: [-0, 1, 1e-7, 1e-6, 1e20, 1e21], keys: { 10: 'ten', 2: 'two', '01': 'one' } },
    { '\ud83d\ude00': '\u0101/\u0434/\u2028/\u2029', '\ue000': [{ z: [], a: {} }], '10': 'ten', '2': 'two' }];
  const code = 'namespace Illuminate\\Console { class Command {} } namespace { require $argv[1]; foreach (json_decode(stream_get_contents(STDIN), false, 512, JSON_THROW_ON_ERROR) as $value) { echo \\App\\Console\\Commands\\PublishCourseListeningRevision::fingerprint($value), PHP_EOL; } }';
  const result = spawnSync(php, ['-d', 'display_errors=stderr', '-r', code, path.join(root, 'app/Console/Commands/PublishCourseListeningRevision.php')], { input: JSON.stringify(values), encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') { t.skip('PHP executable unavailable; exact serialization is tested separately'); return; }
  if (result.stderr.trim()) t.diagnostic(`PHP diagnostics: ${result.stderr.trim()}`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/u), values.map(digest));
});

test('stale candidate hashes, stale titles and corrupted baseline hashes are rejected independently', () => {
  const f = fixture();
  f.packs[0].variants[0].expected_config_sha256 = '0'.repeat(64);
  f.packs[0].variants[1].expected_title = 'Obsolete title';
  f.baseline.variants[2].config_sha256 = '1'.repeat(64);
  const report = check(f);
  hasError(report, 'stale expected_config_sha256');
  hasError(report, 'stale expected_title');
  hasError(report, 'canonical baseline hash');
  assert.equal(report.rows[0].before_config_sha256, digest(f.baseline.variants[0].config));
});

for (const [name, mutate] of [
  ['nested mutation', config => { config.authoring.dictionary_id = 99; }],
  ['removed field', config => { delete config.instruction; }],
  ['added field', config => { config.new_setting = null; }],
  ['null replaced with object', config => { config.optional = {}; }],
  ['array replaced with object', config => { config.authoring.flags = {}; }],
  ['task_kind changed', config => { config.task_kind = 'lv_to_ru'; }],
]) {
  test(`unrelated config keys are protected against ${name}`, () => {
    const f = fixture(), variant = revise(f);
    mutate(variant.config);
    hasError(check(f), 'unrelated config field');
  });
}

test('reading text/questions and translation source/reference are the only editable config fields', () => {
  const f = fixture();
  const binary = revise(f, 0, 'rewrite');
  binary.config.text += ' Vi\u0146a mekl\u0113 jaunu darbu.';
  binary.config.questions[0].statement = 'Anna lasa bibliot\u0113k\u0101.';
  const translation = revise(f, 5, 'copyedit');
  translation.config.source_text += ' Brauciens ilgst stundu.';
  translation.config.reference_translation += ' \u041f\u043e\u0435\u0437\u0434\u043a\u0430 \u0434\u043b\u0438\u0442\u0441\u044f \u0447\u0430\u0441.';
  const report = check(f);
  assert.deepEqual(report.errors, []);
  assert.notEqual(report.rows[0].before_config_sha256, report.rows[0].after_config_sha256);
  assert.ok(!Object.hasOwn(binary.config, 'question_review'));
});

test('missing baseline reference_translation may be added for lv_to_ru', () => {
  const f = fixture();
  delete f.baseline.variants[5].config.reference_translation;
  refreshBaseline(f, 5);
  revise(f, 5);
  assert.deepEqual(check(f).errors, []);
  f.packs[0].variants[0].config.reference_translation = 'Forbidden here';
  hasError(check(f), 'unrelated config field');
});

test('keep requires identical full config and title, including absent keys', () => {
  const f = fixture();
  f.packs[0].variants[0].title += ' changed';
  f.packs[0].variants[1].config.questions[0].correct = false;
  f.packs[0].variants[2].config.text += ' Jauns teikums.';
  delete f.baseline.variants[5].config.reference_translation;
  refreshBaseline(f, 5);
  const report = check(f);
  assert.equal(report.errors.filter(message => message.includes('keep action')).length, 4);
});

test('questions_only preserves the passage and is unavailable for translation', () => {
  const f = fixture(), variant = revise(f, 0, 'questions_only');
  variant.config.questions[0].statement = 'Anna dodas uz bibliot\u0113ku.';
  assert.deepEqual(check(f).errors, []);
  variant.config.text += ' Jauns teikums.';
  revise(f, 5, 'questions_only');
  assert.equal(check(f).errors.filter(message => message.includes('questions_only requires')).length, 2);
});

test('invalid pack, variant, finding and question_review keys cannot be ignored', () => {
  const f = fixture(), variant = revise(f);
  f.packs[0].ignored = true;
  variant.page_id = 50;
  variant.findings[0].severity = 'low';
  variant.question_review[0].evidence = {};
  variant.action = 'rewrite_dialogue';
  const report = check(f);
  for (const text of ['unexpected key ignored', 'unexpected key page_id', 'unexpected key severity', 'unexpected key evidence', 'invalid action']) hasError(report, text);
});

test('missing required keys, review metadata in config and invalid question keys fail', () => {
  const f = fixture(), variant = f.packs[0].variants[0];
  delete variant.expected_title;
  variant.config.question_review = variant.question_review;
  variant.config.questions[0].evidence = { quote: 'Anna lasa' };
  variant.config.questions[1].skill = 'detail';
  const report = check(f);
  hasError(report, 'missing key expected_title');
  hasError(report, 'metadata, forbidden in config');
  hasError(report, 'review metadata belongs in question_review');
});

test('non-keep actions require findings, concrete change strings and actual changes', () => {
  const f = fixture(), variant = revise(f);
  variant.findings = [];
  variant.changes = ['   ', null];
  const report = check(f);
  hasError(report, 'concrete findings and changes');
  hasError(report, 'nonempty strings');
  variant.findings = [{ kind: 'clarity', detail: 'Clarify the title.', old_quote: variant.expected_title }];
  variant.changes = ['Clarify the title.'];
  variant.title = variant.expected_title;
  hasError(check(f), 'no title or config changes');
});

test('findings accept quotes from separate baseline fields and reject invented or cross-field quotes', () => {
  const f = fixture(), binary = revise(f), translation = revise(f, 5);
  const source = f.baseline.variants[0];
  binary.findings = [source.title, source.config.text, source.config.questions[0].statement, source.config.questions[0].explanation]
    .map(old_quote => ({ kind: 'clarity', detail: 'Review this wording.', old_quote }));
  translation.findings[0].old_quote = f.baseline.variants[5].config.source_text;
  assert.deepEqual(check(f).errors, []);
  binary.config.text += ' Jauns fakts.';
  binary.findings.push({ kind: 'clarity', detail: 'Invented baseline evidence.', old_quote: 'Jauns fakts.' });
  binary.findings.push({ kind: 'clarity', detail: 'Cross-field evidence.', old_quote: `${source.title}\n${source.config.text}` });
  assert.equal(check(f).errors.filter(message => message.includes('verbatim baseline quote')).length, 2);
});

test('question_review covers indexes 0..9 exactly once and uses verbatim current text', () => {
  const f = fixture(), variant = f.packs[0].variants[0];
  variant.question_review.reverse();
  assert.deepEqual(check(f).errors, []);
  variant.question_review[0] = { index: 10, quote: 'Anna  lasa', rationale: ' ', skill: 'vocabulary' };
  variant.question_review[1].index = variant.question_review[2].index;
  const report = check(f);
  for (const text of ['invalid or duplicate index', 'verbatim quote absent', 'nonempty rationale', 'invalid skill']) hasError(report, text);
  variant.question_review.pop();
  hasError(check(f), 'ten entries');
});

test('ten unique binary statements require real booleans and nonempty explanations', () => {
  const f = fixture(), variant = revise(f);
  variant.config.questions[0].correct = 'true';
  variant.config.questions[1].explanation = ' ';
  variant.config.questions[2].statement = `  ${variant.config.questions[3].statement.toUpperCase()}  `;
  variant.config.questions.pop();
  const report = check(f);
  hasError(report, 'ten binary questions');
  hasError(report, 'boolean correct');
  hasError(report, 'duplicate statement');
});

test('unbalanced retained originals only produce balance warnings', () => {
  const f = fixture();
  f.baseline.variants[0].config.questions.forEach(question => { question.correct = true; });
  f.packs[0].variants[0].config = clone(f.baseline.variants[0].config);
  refreshBaseline(f, 0);
  const report = check(f);
  assert.deepEqual(report.errors, []);
  assert.ok(report.warnings.some(message => message.includes('five true and five false')));
  assert.equal(report.rows[0].answer_pattern, 'TTTTTTTTTT');
});

test('translation requires source, Russian reference and lexical notes; Latvian fields reject Cyrillic', () => {
  const f = fixture();
  f.packs[0].variants[0].config.text += ' \u0442\u0435\u043a\u0441\u0442';
  f.packs[0].variants[1].config.questions[0].statement = '\u0412\u043e\u043f\u0440\u043e\u0441';
  f.packs[0].variants[2].config.questions[0].explanation = '\u041e\u0442\u0432\u0435\u0442';
  f.packs[0].variants[5].config.source_text = ' ';
  f.packs[0].variants[6].config.reference_translation = 'English only';
  f.packs[0].variants[7].lexical_notes = [];
  f.packs[0].variants[8].lexical_notes = [' '];
  f.packs[0].variants[9].question_review = [{ index: 0 }];
  const report = check(f);
  for (const text of ['Cyrillic in Latvian text', 'Cyrillic in Latvian statement', 'Cyrillic in Latvian explanation',
    'nonempty Latvian', 'Russian reference_translation', 'requires lexical_notes', 'lexical_notes: nonempty strings', 'question_review must be empty']) hasError(report, text);
});

test('full coverage rejects omissions, unknown IDs and duplicate candidates; partial mode only waives omissions', () => {
  const f = fixture([{ category_id: 9001, level: 'A1' }, { category_id: 80001, level: 'A2' }]);
  f.packs.pop();
  hasError(check(f), 'missing candidate');
  assert.deepEqual(inspectReadingRevisions(f.packs, f.baseline, { requireComplete: false }).errors, []);
  f.packs[0].variants[0].variant_id = 999999;
  f.packs[0].variants.push(clone(f.packs[0].variants[1]));
  const report = inspectReadingRevisions(f.packs, f.baseline, { requireComplete: false });
  hasError(report, 'no baseline');
  hasError(report, 'duplicate candidate ID');
  assert.equal(report.summary.complete, false);
});

test('a category may have a single baseline block; no fixed category or course size is required', () => {
  const f = fixture();
  f.baseline.variants = f.baseline.variants.slice(0, 5);
  f.packs[0].variants = f.packs[0].variants.slice(0, 5);
  assert.deepEqual(check(f).errors, []);
  f.packs[0].variants = f.packs[0].variants.slice(0, 1);
  assert.deepEqual(inspectReadingRevisions(f.packs, f.baseline, { requireComplete: false }).errors, []);
  hasError(check(f), 'missing candidate');
});

test('category, level and block IDs must match baseline; duplicate category packs fail', () => {
  const f = fixture();
  f.packs[0].level = 'B1';
  f.packs[0].variants[0].block_id++;
  f.packs.push(clone(f.packs[0]));
  const report = check(f);
  hasError(report, 'category/level absent');
  hasError(report, 'category/level/block_id differs');
  hasError(report, 'duplicate category pack');
  f.packs[0].category_id = 77777;
  hasError(check(f), 'category/level/block_id differs');
});

test('baseline IDs, per-block seeds and block/page/group relationships are checked', () => {
  const f = fixture();
  f.baseline.variants[1].seed_key = f.baseline.variants[0].seed_key;
  f.baseline.variants[2].page_id++;
  f.baseline.groups[0].level = 'B2';
  f.baseline.variants[4].id = f.baseline.variants[3].id;
  const report = check(f);
  for (const text of ['five distinct seed keys', 'inconsistent block/page', 'differs from baseline group', 'duplicate baseline ID']) hasError(report, text);
  const missing = fixture();
  missing.baseline.variants.pop();
  hasError(check(missing), 'five distinct seed keys');
});

test('duplicate full passages across categories and task kinds fail; name substitutions only warn', () => {
  const f = fixture(), binary = revise(f, 1, 'rewrite'), translation = revise(f, 5, 'rewrite');
  binary.config.text = f.packs[0].variants[0].config.text.replace('Anna', 'Ilze');
  translation.config.source_text = f.packs[0].variants[0].config.text;
  binary.question_review.forEach(entry => { entry.quote = 'Ilze lasa'; });
  const report = check(f);
  hasError(report, 'duplicate full text across variants');
  assert.ok(report.warnings.some(message => message.includes('hidden name substitution')));
  const crossCategory = fixture([{ category_id: 9001, level: 'A1' }, { category_id: 77777, level: 'A2' }]);
  crossCategory.packs[1].variants[0].config.text = crossCategory.packs[0].variants[0].config.text;
  hasError(check(crossCategory), 'duplicate full text across variants');
});

test('informal wordcount flags respect levels and never fail otherwise valid packs', () => {
  const f = fixture([{ category_id: 9001, level: 'B2' }]), report = check(f);
  assert.deepEqual(report.errors, []);
  assert.ok(report.warnings.some(message => message.includes('B2:') && message.includes('not CEFR certification')));
  assert.ok(report.rows.every(row => row.after_words > 0 && row.before_words === row.after_words));
});

test('null, primitive and malformed top-level inputs report errors without throwing', () => {
  for (const [packs, baseline] of [[null, null], [undefined, undefined], [{}, []], [[null, 7, []], fixture().baseline], [[], { schema_version: 1, groups: [], variants: [] }]]) {
    const report = inspectReadingRevisions(packs, baseline);
    assert.ok(report.errors.length > 0);
    assert.equal(report.summary.valid, false);
  }
});

for (const [name, mutate] of [
  ['null variant', f => { f.packs[0].variants[0] = null; }],
  ['null pack variants', f => { f.packs[0].variants = null; }],
  ['null baseline group', f => { f.baseline.groups[0] = null; }],
  ['null baseline variant', f => { f.baseline.variants[0] = null; }],
  ['null baseline config', f => { f.baseline.variants[0].config = null; }],
  ['null config', f => { f.packs[0].variants[0].config = null; }],
  ['null question', f => { f.packs[0].variants[0].config.questions[0] = null; }],
  ['null questions', f => { f.packs[0].variants[0].config.questions = null; }],
  ['null finding', f => { f.packs[0].variants[0].findings = [null]; }],
  ['null review entry', f => { f.packs[0].variants[0].question_review[0] = null; }],
  ['null lexical notes', f => { f.packs[0].variants[5].lexical_notes = null; }],
  ['malformed metadata arrays', f => { Object.assign(f.packs[0].variants[0], { findings: {}, changes: 'bad', question_review: null }); }],
  ['unsafe number', f => { f.packs[0].variants[0].config.authoring.dictionary_id = 9007199254740992; }],
  ['undefined value', f => { f.packs[0].variants[0].config.optional = undefined; }],
  ['circular config', f => { f.packs[0].variants[0].config.loop = f.packs[0].variants[0].config; }],
]) {
  test(`${name} is rejected without throwing`, () => {
    const f = fixture();
    mutate(f);
    assert.ok(check(f).errors.length > 0);
  });
}

function temporary(t) {
  const temporaryRoot = path.join(root, '.tmp');
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(path.join(temporaryRoot, 'check-reading-revisions-test-'));
  t.after(() => {
    const relative = path.relative(temporaryRoot, directory);
    assert.ok(relative.startsWith('check-reading-revisions-test-') && !relative.includes(path.sep));
    rmSync(directory, { recursive: true });
  });
  return directory;
}
function cliFixture(t) {
  const directory = temporary(t), f = fixture(), candidates = path.join(directory, 'candidates');
  mkdirSync(path.join(candidates, 'nested'), { recursive: true });
  const baseline = path.join(directory, 'baseline.json');
  writeFileSync(baseline, JSON.stringify(f.baseline));
  writeFileSync(path.join(candidates, 'category.json'), `\uFEFF${JSON.stringify(f.packs[0])}`);
  return { directory, candidates, baseline, output: path.join(directory, 'reports/check.json'), f };
}
const run = (f, output = f.output, extra = []) => spawnSync(process.execPath, [script, f.candidates, f.baseline, output, ...extra], { cwd: root, encoding: 'utf8' });

test('CLI writes a JSON report exclusively inside .tmp and preserves an existing report', t => {
  const f = cliFixture(t), first = run(f);
  assert.equal(first.status, 0, first.stderr);
  const saved = readFileSync(f.output, 'utf8'), report = JSON.parse(saved);
  assert.equal(report.rows.length, 10);
  assert.deepEqual(JSON.parse(first.stdout), report.summary);
  const second = run(f);
  assert.equal(second.status, 1);
  assert.match(second.stderr, /EEXIST/u);
  assert.equal(readFileSync(f.output, 'utf8'), saved);
  const forbidden = path.join(root, 'reading-revisions-forbidden.json');
  assert.equal(existsSync(forbidden), false);
  const outside = run(f, forbidden);
  assert.equal(outside.status, 1);
  assert.match(outside.stderr, /inside repository \.tmp/u);
  assert.equal(existsSync(forbidden), false);
});

test('CLI scans nested categories, reports validation errors and supports explicit partial coverage', t => {
  const f = cliFixture(t);
  f.f.packs[0].variants.pop();
  writeFileSync(path.join(f.candidates, 'nested/category.json'), JSON.stringify(f.f.packs[0]));
  rmSync(path.join(f.candidates, 'category.json'));
  const result = run(f);
  assert.equal(result.status, 1);
  hasError(JSON.parse(readFileSync(f.output, 'utf8')), 'missing candidate');
  const partialOutput = path.join(f.directory, 'partial.json'), partial = run(f, partialOutput, ['--allow-partial']);
  assert.equal(partial.status, 0, partial.stderr);
  const report = JSON.parse(readFileSync(partialOutput, 'utf8'));
  assert.equal(report.summary.complete, false);
  assert.equal(report.summary.require_complete, false);
});

test('CLI rejects report directory junctions/symlinks before writing', t => {
  const f = cliFixture(t), linked = path.join(f.directory, 'linked');
  try {
    symlinkSync(f.candidates, linked, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (exception) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(exception.code)) { t.skip('Directory links unavailable'); return; }
    throw exception;
  }
  const result = run(f, path.join(linked, 'should-not-exist.json'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /symlinks\/junctions/u);
  assert.equal(existsSync(path.join(f.candidates, 'should-not-exist.json')), false);
});
