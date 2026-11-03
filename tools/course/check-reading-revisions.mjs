import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clean = value => typeof value === 'string' && value.trim().length > 0;
const id = value => Number.isSafeInteger(value) && value > 0;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const levels = ['A1', 'A2', 'B1', 'B2'];
const skills = ['detail', 'cause', 'purpose', 'contrast', 'stance', 'inference'];
const actions = ['keep', 'questions_only', 'copyedit', 'rewrite'];
const cyrillic = /\p{Script=Cyrillic}/u;
const tokens = text => typeof text === 'string' ? text.match(/[\p{L}\p{M}\p{N}]+(?:[-\u2019'][\p{L}\p{M}\p{N}]+)*/gu) ?? [] : [];
const words = text => tokens(text).filter(token => /\p{L}/u.test(token)).length;
const norm = text => text.normalize('NFC').toLocaleLowerCase('lv').replace(/\s+/gu, ' ').trim();

// Match the repository's PHP canonicalJson: sorted objects, ordered arrays, literal Unicode/slashes.
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value)) ?? 'null').digest('hex');

function jsonValue(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  if (!Array.isArray(value) && (!object(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index) && jsonValue(value[index], ancestors)).every(Boolean)
    : Object.values(value).every(item => jsonValue(item, ancestors));
  ancestors.delete(value);
  return valid;
}

function fields(value, allowed, required, error, label) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) error(`${label}: unexpected key ${key}`);
  for (const key of required) if (!Object.hasOwn(value, key)) error(`${label}: missing key ${key}`);
}

function preserved(before, after, allowed, error, label) {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (allowed.includes(key)) continue;
    if (!Object.hasOwn(before, key) || !Object.hasOwn(after, key) || digest(before[key]) !== digest(after[key])) {
      error(`unrelated ${label} field changed, added or removed: ${key}`);
    }
  }
}

function similarNames(left, right) {
  if (left.length < 6 || left.length !== right.length) return false;
  const changed = left.map((token, index) => [token, right[index]]).filter(([a, b]) => norm(a) !== norm(b));
  return changed.length > 0 && changed.length / left.length <= 0.2
    && changed.every(([a, b]) => /^\p{Lu}/u.test(a) && /^\p{Lu}/u.test(b));
}

export function inspectReadingRevisions(packs, baseline, { requireComplete = true } = {}) {
  const errors = [], warnings = [], rows = [];
  const sources = new Map(), blocks = new Map(), pages = new Map(), categories = new Map();
  const seen = new Set(), packCategories = new Set(), passages = [];
  const error = message => errors.push(message);
  if (!object(baseline) || baseline.schema_version !== 1 || !Array.isArray(baseline.groups)
    || !Array.isArray(baseline.variants) || baseline.variants.length === 0) {
    error('baseline: schema_version 1, groups array and nonempty variants array required');
  }
  const groupLevels = new Map();
  for (const [index, group] of (Array.isArray(baseline?.groups) ? baseline.groups : []).entries()) {
    if (!object(group)) { error(`baseline group ${index}: object required`); continue; }
    // Group metadata is snapshot-owned; introductory groups may have no category.
    if (group.category_id == null) continue;
    if (!id(group.category_id)) error(`baseline group ${index}: invalid category_id`);
    if (groupLevels.has(group.category_id)) error(`baseline group ${index}: duplicate category_id`);
    groupLevels.set(group.category_id, group.level);
  }
  for (const [index, source] of (Array.isArray(baseline?.variants) ? baseline.variants : []).entries()) {
    const label = `baseline variant ${object(source) ? source.id : index}`;
    const fail = message => error(`${label}: ${message}`);
    if (!object(source)) { fail('object required'); continue; }
    if (!id(source.id) || !id(source.block_id) || !id(source.page_id) || !id(source.category_id)
      || !levels.includes(source.level) || !Number.isSafeInteger(source.position) || source.position < 0 || !clean(source.seed_key)
      || !clean(source.title)) fail('invalid IDs, level, position, seed_key or title');
    if (!object(source.config) || !jsonValue(source.config)) { fail('config must be a JSON object with safe numbers'); continue; }
    if (!['reading_binary', 'lv_to_ru'].includes(source.config.task_kind)) fail('unsupported task_kind');
    if (!hash(source.config_sha256) || source.config_sha256 !== digest(source.config)) fail('config_sha256 differs from canonical baseline hash');
    if (sources.has(source.id)) fail('duplicate baseline ID');
    else if (id(source.id)) sources.set(source.id, source);
    if (groupLevels.has(source.category_id) && groupLevels.get(source.category_id) !== undefined
      && groupLevels.get(source.category_id) !== source.level) fail('category/level differs from baseline group');
    if (categories.has(source.category_id) && categories.get(source.category_id) !== source.level) fail('inconsistent category/level');
    categories.set(source.category_id, source.level);
    const page = pages.get(source.page_id);
    if (page && (page.category_id !== source.category_id || page.level !== source.level)) fail('inconsistent page/category/level');
    pages.set(source.page_id, source);
    const block = blocks.get(source.block_id) ?? [];
    if (block.length && ['page_id', 'category_id', 'level'].some(key => block[0][key] !== source[key])) fail('inconsistent block/page/category/level');
    if (block.length && block[0].config.task_kind !== source.config.task_kind) fail('mixed task kinds in block');
    block.push(source);
    blocks.set(source.block_id, block);
  }
  for (const [blockId, block] of blocks) {
    if (block.length !== 5 || new Set(block.map(source => source.seed_key)).size !== 5) error(`baseline block ${blockId}: five distinct seed keys required`);
  }
  if (!Array.isArray(packs)) error('packs: array required');
  for (const [packIndex, pack] of (Array.isArray(packs) ? packs : []).entries()) {
    const label = `pack ${packIndex}`;
    const fail = message => error(`${label}: ${message}`);
    if (!object(pack)) { fail('object required'); continue; }
    fields(pack, ['schema_version', 'category_id', 'level', 'variants'], ['schema_version', 'category_id', 'level', 'variants'], fail, 'pack');
    if (pack.schema_version !== 1 || !id(pack.category_id) || !levels.includes(pack.level)) fail('invalid category/level/schema');
    if (!categories.has(pack.category_id) || categories.get(pack.category_id) !== pack.level) fail('category/level absent from baseline');
    if (packCategories.has(pack.category_id)) fail('duplicate category pack');
    packCategories.add(pack.category_id);
    if (!Array.isArray(pack.variants) || !pack.variants.length) { fail('nonempty variants array required'); continue; }
    for (const [variantIndex, variant] of pack.variants.entries()) {
      const key = `${pack.category_id}:${object(variant) ? variant.variant_id : variantIndex}`;
      const localError = message => error(`${key}: ${message}`);
      const warn = message => warnings.push(`${key}: ${message}`);
      if (!object(variant)) { localError('variant object required'); continue; }
      const variantKeys = ['variant_id', 'block_id', 'expected_config_sha256', 'expected_title', 'action', 'title', 'config', 'findings', 'changes', 'question_review', 'lexical_notes'];
      fields(variant, variantKeys, variantKeys, localError, 'variant');
      if (!id(variant.variant_id) || !id(variant.block_id)) localError('invalid variant_id/block_id');
      if (seen.has(variant.variant_id)) localError('duplicate candidate ID');
      seen.add(variant.variant_id);
      const source = sources.get(variant.variant_id);
      if (!source) { localError('no baseline for candidate ID'); continue; }
      if (source.category_id !== pack.category_id || source.level !== pack.level || source.block_id !== variant.block_id) localError('category/level/block_id differs from baseline');
      const beforeHash = digest(source.config);
      if (!hash(variant.expected_config_sha256) || variant.expected_config_sha256 !== beforeHash
        || variant.expected_config_sha256 !== source.config_sha256) localError('stale expected_config_sha256');
      if (variant.expected_title !== source.title) localError('stale expected_title');
      if (!actions.includes(variant.action)) localError('invalid action');
      if (!clean(variant.title)) localError('nonempty title required');
      for (const field of ['findings', 'changes', 'question_review', 'lexical_notes']) {
        if (!Array.isArray(variant[field])) localError(`${field}: array required`);
      }
      const findings = Array.isArray(variant.findings) ? variant.findings : [];
      const changes = Array.isArray(variant.changes) ? variant.changes : [];
      const review = Array.isArray(variant.question_review) ? variant.question_review : [];
      const lexical = Array.isArray(variant.lexical_notes) ? variant.lexical_notes : [];
      if (variant.action !== 'keep' && (!findings.length || !changes.length)) localError('changed variant needs concrete findings and changes');
      if (changes.some(change => !clean(change))) localError('changes: nonempty strings required');
      if (lexical.some(note => !clean(note))) localError('lexical_notes: nonempty strings required');
      const oldQuotes = [source.title, source.config.text, source.config.source_text, source.config.reference_translation,
        ...(Array.isArray(source.config.questions) ? source.config.questions : []).flatMap(q => object(q) ? [q.statement, q.explanation] : [])].filter(clean);
      for (const finding of findings) {
        if (!object(finding)) { localError('finding: object required'); continue; }
        fields(finding, ['kind', 'detail', 'old_quote'], ['kind', 'detail', 'old_quote'], localError, 'finding');
        if (!clean(finding.kind) || !clean(finding.detail) || !clean(finding.old_quote)
          || !oldQuotes.some(text => text.includes(finding.old_quote))) localError('finding needs kind, detail and a verbatim baseline quote');
      }
      const config = variant.config;
      if (!object(config) || !jsonValue(config)) { localError('config must be a JSON object with safe numbers'); continue; }
      const kind = source.config.task_kind;
      preserved(source.config, config, kind === 'reading_binary' ? ['text', 'questions'] : ['source_text', 'reference_translation'], localError, 'config');
      for (const field of ['question_review', 'findings', 'changes', 'lexical_notes']) {
        if (Object.hasOwn(config, field)) localError(`${field} is editorial metadata, forbidden in config`);
      }
      const afterHash = digest(config);
      const changed = beforeHash !== afterHash || variant.title !== source.title;
      if (variant.action === 'keep' && changed) localError('keep action changes title or config');
      if (variant.action !== 'keep' && !changed) localError('non-keep action has no title or config changes');
      if (variant.action === 'questions_only' && (kind !== 'reading_binary' || config.text !== source.config.text)) localError('questions_only requires reading_binary and unchanged text');
      const text = kind === 'reading_binary' ? config.text : config.source_text;
      const oldText = kind === 'reading_binary' ? source.config.text : source.config.source_text;
      if (!clean(text)) localError('nonempty Latvian text/source_text required');
      else if (cyrillic.test(text)) localError('Cyrillic in Latvian text/source_text');
      let answerPattern = null;
      if (kind === 'reading_binary') {
        const questions = Array.isArray(config.questions) ? config.questions : [];
        if (questions.length !== 10) localError('ten binary questions required');
        const statements = new Set();
        for (const [index, question] of questions.entries()) {
          if (!object(question)) { localError(`Q${index}: question object required`); continue; }
          const oldQuestion = object(source.config.questions?.[index]) ? source.config.questions[index] : {};
          preserved(oldQuestion, question, ['statement', 'correct', 'explanation'], localError, `Q${index} question`);
          if (Object.hasOwn(question, 'skill') || Object.hasOwn(question, 'evidence')) localError(`Q${index}: review metadata belongs in question_review`);
          if (!clean(question.statement) || !clean(question.explanation) || typeof question.correct !== 'boolean') localError(`Q${index}: nonempty statement/explanation and boolean correct required`);
          if (clean(question.statement)) {
            if (statements.has(norm(question.statement))) localError(`Q${index}: duplicate statement`);
            statements.add(norm(question.statement));
          }
          for (const field of ['statement', 'explanation']) if (clean(question[field]) && cyrillic.test(question[field])) localError(`Q${index}: Cyrillic in Latvian ${field}`);
        }
        const trueCount = questions.filter(q => q?.correct === true).length;
        const falseCount = questions.filter(q => q?.correct === false).length;
        if (questions.length === 10 && (trueCount !== 5 || falseCount !== 5)) warn('recommended answer balance is five true and five false; retained originals are allowed');
        answerPattern = questions.map(q => q?.correct === true ? 'T' : q?.correct === false ? 'F' : '?').join('');
        if (review.length !== 10) localError('question_review: ten entries with indexes 0..9 required');
        const indexes = new Set();
        for (const entry of review) {
          if (!object(entry)) { localError('question_review: entry object required'); continue; }
          fields(entry, ['index', 'quote', 'rationale', 'skill'], ['index', 'quote', 'rationale', 'skill'], localError, 'question_review');
          if (!Number.isInteger(entry.index) || entry.index < 0 || entry.index > 9 || indexes.has(entry.index)) localError('question_review: invalid or duplicate index');
          indexes.add(entry.index);
          if (!clean(entry.quote) || !clean(text) || !text.includes(entry.quote)) localError(`question_review ${entry.index}: verbatim quote absent from text`);
          if (!clean(entry.rationale)) localError(`question_review ${entry.index}: nonempty rationale required`);
          if (!skills.includes(entry.skill)) localError(`question_review ${entry.index}: invalid skill`);
        }
      } else if (kind === 'lv_to_ru') {
        if (!clean(config.reference_translation) || !cyrillic.test(config.reference_translation)) localError('nonempty Russian reference_translation required');
        if (!lexical.length) localError('lv_to_ru requires lexical_notes');
        if (review.length) localError('lv_to_ru question_review must be empty');
      }
      const count = words(text);
      // Editorial length flags only: these ranges are not a CEFR classifier.
      const ranges = kind === 'reading_binary'
        ? { A1: [40, 180], A2: [80, 300], B1: [140, 500], B2: [200, 750] }
        : { A1: [8, 100], A2: [12, 160], B1: [20, 220], B2: [25, 260] };
      const range = ranges[source.level];
      if (range && (count < range[0] || count > range[1])) warn(`${source.level}: ${count} words outside informal ${kind} range ${range[0]}..${range[1]}; inspect level fit, not CEFR certification`);
      if (clean(text)) {
        const normalized = norm(text), textTokens = tokens(text);
        for (const other of passages) {
          if (other.normalized === normalized) localError(`duplicate full text across variants: ${other.key}`);
          else if (similarNames(other.tokens, textTokens)) warn(`possible hidden name substitution / similar text to ${other.key}; editorial review required`);
        }
        if (clean(oldText) && norm(oldText) !== normalized && similarNames(tokens(oldText), textTokens)) warn('possible hidden name substitution in baseline text; editorial review required');
        passages.push({ key, normalized, tokens: textTokens });
      }
      rows.push({ variant_id: source.id, block_id: source.block_id, page_id: source.page_id, category_id: source.category_id,
        level: source.level, position: source.position, seed_key: source.seed_key, task_kind: kind,
        before_title: source.title, title: variant.title, action: variant.action,
        expected_config_sha256: variant.expected_config_sha256, before_config_sha256: beforeHash, after_config_sha256: afterHash,
        changed, before_words: words(oldText), after_words: count, answer_pattern: answerPattern,
        findings, changes, question_review: review, lexical_notes: lexical });
    }
  }
  const missing = [...sources.keys()].filter(sourceId => !seen.has(sourceId));
  if (requireComplete) for (const sourceId of missing) error(`${sourceId}: missing candidate (full baseline coverage required)`);
  return { schema_version: 1,
    summary: { baseline_variants: sources.size, candidate_variants: Array.isArray(packs) ? packs.reduce((sum, pack) => sum + (Array.isArray(pack?.variants) ? pack.variants.length : 0), 0) : 0,
      inspected_variants: rows.length, missing_variants: missing.length, complete: missing.length === 0 && seen.size === sources.size,
      require_complete: requireComplete, errors: errors.length, warnings: warnings.length, valid: errors.length === 0,
      actions: Object.fromEntries(actions.map(action => [action, rows.filter(row => row.action === action).length])) },
    errors, warnings, rows,
    limitations: ['Verbatim quotes do not prove logical entailment, Latvian correctness or translation accuracy.',
      'Name substitution and word counts are editorial heuristics, not CEFR certification.',
      'Skill labels and lexical notes are editor assertions; no database, network or paid services are used.'] };
}

function candidateFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? candidateFiles(file) : entry.isFile() && entry.name.endsWith('.json') ? [file] : [];
  });
}

function reportTarget(output) {
  const temporary = path.resolve(root, '.tmp'), target = path.resolve(output);
  const relative = path.relative(temporary, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || path.extname(target) !== '.json') {
    throw new Error('Report must be a JSON file inside repository .tmp');
  }
  // Reject directory symlinks/junctions before mkdir or write can escape .tmp.
  let directory = temporary;
  for (const part of ['', ...path.dirname(relative).split(path.sep).filter(part => part !== '.')]) {
    directory = path.join(directory, part);
    try {
      if (lstatSync(directory).isSymbolicLink()) throw new Error('Report directory must not use symlinks/junctions');
    } catch (exception) {
      if (exception.code !== 'ENOENT') throw exception;
    }
  }
  mkdirSync(path.dirname(target), { recursive: true });
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), requireComplete = !args.includes('--allow-partial');
    const positional = args.filter(argument => argument !== '--allow-partial');
    if (positional.length !== 3 || positional.some(argument => argument.startsWith('--'))) {
      throw new Error('Usage: node tools/course/check-reading-revisions.mjs <candidate-dir> <baseline.json> <output-in-.tmp.json> [--allow-partial]');
    }
    const [directory, baselinePath, output] = positional;
    const read = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
    const report = inspectReadingRevisions(candidateFiles(directory).map(read), read(baselinePath), { requireComplete });
    writeFileSync(reportTarget(output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify(report.summary));
    for (const message of report.errors) console.error(message);
    if (report.errors.length) process.exitCode = 1;
  } catch (exception) {
    console.error(exception.message);
    process.exitCode = 1;
  }
}
