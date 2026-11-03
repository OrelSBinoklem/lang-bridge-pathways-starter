import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const levels = ['A1', 'A2', 'B1', 'B2'];
const topicsPath = 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-all-words.json';
const frequencyPath = 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-frequencies.json';
const grammarPath = 'docs/notes/e-laipa-grammar-tasks.md';
const aliasesPath = 'resources/course/elaipa-topic-aliases.json';
const sources = ['authored-a2-part1', 'authored-a2-part2', 'authored-b1-part1', 'authored-b1-part2', 'authored-b2'].map(name => `resources/course/${name}.json`);
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const hash = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
export const normalize = value => value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('lv');
export const forms = value => [...new Set(normalize(value).match(/[\p{L}\p{M}]+/gu) ?? [])];
const wordCount = value => normalize(value).match(/[\p{L}\p{M}]+/gu)?.length ?? 0;
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };

export function passiveVocabulary(context, topics, level, topic) {
  requireValue(levels.includes(level) && topics[level]?.[topic], 'Unknown exact E-Laipa level/topic');
  const references = [];
  const currentPosition = Object.keys(topics[level]).indexOf(topic);
  for (const candidateLevel of levels.slice(0, levels.indexOf(level) + 1)) {
    const names = Object.keys(topics[candidateLevel]);
    for (const [position, name] of names.entries()) {
      if (candidateLevel === level && position > currentPosition) break;
      references.push({ level: candidateLevel, topic: name, words: Object.values(topics[candidateLevel][name]).flat().map(entry => entry[0]) });
    }
  }
  const db = [...context.prior_words, ...context.current_words];
  const union = new Map();
  for (const word of db) {
    const key = normalize(word.word);
    if (!union.has(key)) union.set(key, { word: word.word, db_ids: [], elaipa: false });
    union.get(key).db_ids.push(word.id);
  }
  for (const reference of references) for (const word of reference.words) {
    const key = normalize(word);
    if (!union.has(key)) union.set(key, { word, db_ids: [], elaipa: false });
    union.get(key).elaipa = true;
  }
  return {
    source_topics: references.map(({ level, topic }) => ({ level, topic })),
    words: [...union.values()].map(word => ({ ...word, db_ids: [...new Set(word.db_ids)] })),
  };
}

export function checkQuestions(questions, label) {
  requireValue(Array.isArray(questions) && questions.length >= 3 && questions.length <= 10, `${label}: three to ten questions required`);
  for (const question of questions) requireValue(Array.isArray(question) && question.length === 3 && typeof question[0] === 'string' && question[0].trim() && typeof question[1] === 'boolean' && typeof question[2] === 'string' && question[2].trim(), `${label}: malformed statement/answer/evidence`);
  requireValue(new Set(questions.map(q => normalize(q[0]))).size === questions.length
    && Math.abs(2 * questions.filter(q => q[1]).length - questions.length) <= 1, `${label}: unique statements, balanced true/false answers required`);
}

export function validateSource(group, context, topics) {
  const label = `${group.category_id}/${group.level}`;
  requireValue(['A2', 'B1', 'B2'].includes(group.level), `${label}: this builder preserves A1`);
  requireValue(context?.category_id === group.category_id && (!context.level || context.level === group.level) && Array.isArray(context.current_words) && context.current_words.length && Array.isArray(context.prior_words), `${label}: missing shared DB vocabulary`);
  requireValue(!context.user_id && !context.user_vocabulary_progress, `${label}: personal data not allowed`);
  requireValue(topics[group.level]?.[group.elaipa_topic], `${label}: exact E-Laipa topic not found`);
  const topicTitle = normalize(group.elaipa_topic.replace(/^\d+\.\s*/u, '').replace(/[!…]+$/u, ''));
  const alias = read(aliasesPath).aliases.find(item => item.category_id === group.category_id && item.level === group.level && item.elaipa_topic === group.elaipa_topic && item.category_name === (context.category_name ?? context.current_category?.name));
  requireValue(alias || context.current_words.some(word => normalize(word.word.replace(/[!…]+$/u, '')) === topicTitle), `${label}: DB/E-Laipa topic mismatch`);
  requireValue(/^\/course\/[a-zA-Z0-9/_-]+\.(webp|png|jpg)$/u.test(group.image_url) && existsSync(resolve(root, `frontend/public${group.image_url}`)) && group.image_facts?.trim(), `${label}: missing verified illustration`);
  requireValue(Array.isArray(group.grammar_focus) && group.grammar_focus.length && group.grammar_focus.every(item => typeof item === 'string' && item.trim()), `${label}: grammar reference required`);
  requireValue(group.variants?.length === 5 && new Set(group.variants.map(v => normalize(v.title))).size === 5, `${label}: five distinct titled variants required`);
  requireValue(new Set(group.variants.map(v => normalize(v.reading?.text ?? ''))).size === 5, `${label}: reading texts repeat`);
  requireValue(new Set(group.variants.map(v => JSON.stringify(v.listening?.segments))).size === 5, `${label}: listening scripts repeat`);
  for (const [index, variant] of group.variants.entries()) {
    const scope = `${label}/${index + 1}`;
    requireValue(typeof variant.reading?.text === 'string' && wordCount(variant.reading.text) > 0, `${scope}: nonempty reading required; load is reviewed separately`);
    checkQuestions(variant.reading.questions, `${scope}/reading`);
    for (const key of ['translation', 'writing_translation']) for (const language of ['lv', 'ru']) requireValue(typeof variant[key]?.[language] === 'string' && variant[key][language].trim(), `${scope}: missing ${key}.${language}`);
    requireValue(wordCount(variant.writing_translation.lv) < wordCount(variant.reading.text), `${scope}: productive text must be shorter`);
    for (const key of ['image', 'questions', 'roleplay', 'speaking_questions']) for (const field of ['instruction', 'prompt']) requireValue(typeof variant[key]?.[field] === 'string' && variant[key][field].trim(), `${scope}: missing ${key}.${field}`);
    requireValue(variant.targets?.length && variant.targets.every(target => context.current_words.some(w => w.word === target)), `${scope}: targets must be exact current DB words`);
    requireValue(variant.grammar_features?.length && variant.grammar_features.every(item => typeof item === 'string' && item.trim()), `${scope}: actual grammar features required`);
    const listening = variant.listening;
    for (const speaker of ['a', 'b']) {
      const profile = listening?.speakers?.[speaker];
      requireValue(profile?.name?.trim() && ['male', 'female'].includes(profile.gender), `${scope}: speaker profile missing`);
      requireValue(!profile.age_group || ['young_adult', 'adult', 'older_adult'].includes(profile.age_group), `${scope}: invalid casting age`);
      requireValue(!profile.delivery || typeof profile.delivery === 'string' && profile.delivery.trim() && profile.delivery.length <= 240, `${scope}: invalid delivery direction`);
    }
    requireValue(Array.isArray(listening.segments) && listening.segments.length >= 2, `${scope}: dialogue requires at least two turns; load is reviewed separately`);
    requireValue(listening.segments.every(s => Array.isArray(s) && s.length === 2 && ['a', 'b'].includes(s[0]) && typeof s[1] === 'string' && s[1].trim()) && new Set(listening.segments.map(s => s[0])).size === 2, `${scope}: invalid dialogue`);
    requireValue(listening.segments.reduce((sum, s) => sum + [...s[1].trim()].length, 0) <= 2000, `${scope}: more than 2000 spoken characters`);
    checkQuestions(listening.questions, `${scope}/listening`);
    requireValue(JSON.stringify(listening.questions) !== JSON.stringify(variant.reading.questions), `${scope}: listening must have its own evidence`);
  }
}

function fetchSharedContext(group) {
  const result = spawnSync(process.env.PHP_BINARY || 'php', ['-d', 'display_errors=0', '-d', 'display_startup_errors=0', 'artisan', 'task-generator:context', String(group.category_id), '--dictionary_id=20', '--shared'], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Read-only vocabulary export failed for ${group.category_id}; inspect task-generator:context separately.`);
  const context = JSON.parse(result.stdout);
  requireValue(context.mode === 'shared_course' && context.user_vocabulary_progress === null, 'Expected shared, not personal vocabulary');
  return { ...context.category_vocabulary, category_id: context.category_vocabulary.current_category.id };
}

export function buildPackages(sourcePaths = sources, contextPath) {
  const topics = read(topicsPath);
  const frequencies = read(frequencyPath).frequencies;
  const contexts = contextPath ? read(contextPath) : null;
  const prepared = [];
  const categoryIds = new Set();
  for (const sourcePath of sourcePaths) {
    const source = read(sourcePath);
    requireValue(source.schema_version === 1 && source.groups?.length, `Invalid source ${sourcePath}`);
    for (const group of source.groups) {
      requireValue(!categoryIds.has(group.category_id), `Duplicate authored category ${group.category_id}`);
      categoryIds.add(group.category_id);
      const context = contexts ? contexts.find(c => c.category_id === group.category_id) : fetchSharedContext(group);
      validateSource(group, context, topics);
      const passive = passiveVocabulary(context, topics, group.level, group.elaipa_topic);
      const knownForms = new Set(passive.words.map(w => normalize(w.word)));
      const lexicalAudit = text => {
        const tokens = forms(text);
        return { word_count: wordCount(text), frequency_forms: Object.fromEntries(tokens.map(form => [form, frequencies[form] ?? null])), unmatched_exact_forms: tokens.filter(form => !knownForms.has(form)) };
      };
      const skills = [], listening = [], variants = [];
      for (const variant of group.variants) {
        const { targets, grammar_features, listening: audio, ...skill } = variant;
        const ids = [...new Set(context.current_words.filter(w => targets.includes(w.word)).map(w => w.id))];
        skills.push({ ...skill, target_word_ids: ids });
        listening.push({ title: variant.title, target_word_ids: ids, ...audio });
        variants.push({ title: variant.title, target_word_ids: ids, grammar_features,
          reading: lexicalAudit(variant.reading.text), listening: lexicalAudit(audio.segments.map(s => s[1]).join(' ')), writing: lexicalAudit(variant.writing_translation.lv),
        });
      }
      const base = { schema_version: 1, dictionary_id: 20, category_id: group.category_id, level: group.level, elaipa_topic: group.elaipa_topic };
      const notes = 'Shared pre-authored tasks. Passive vocabulary assumed from DB + E-Laipa current/prior topics, not personal mastery. No live generation or TTS.';
      const audit = { mode: 'shared_course', ...base, knowledge: 'assumed_passive_curriculum_not_assessed', source: { path: sourcePath, sha256: hash(sourcePath) }, grammar_reference: { path: grammarPath, sha256: hash(grammarPath), focus: group.grammar_focus }, frequency_source: { path: frequencyPath, sha256: hash(frequencyPath) }, elaipa_reference: { path: topicsPath, sha256: hash(topicsPath), reviewed_aliases: { path: aliasesPath, sha256: hash(aliasesPath) } }, current_word_ids: context.current_words.map(w => w.id), prior_word_ids: context.prior_words.map(w => w.id), passive_vocabulary: passive, limitation: 'Exact forms and inferred lemmas are editorial aids, not a CEFR lexicon or evidence of knowledge. Unmatched forms include inflections and names; review, do not automatically exclude.', variants };
      const packages = { skills: { ...base, image_url: group.image_url, image_facts: group.image_facts, grammar_focus: group.grammar_focus, editorial_notes: notes, writing_title: 'Письмо: задания по теме', speaking_title: 'Говорение: диалог по теме', variants: skills }, listening: { ...base, editorial_notes: notes, variants: listening }, vocabulary: audit };
      prepared.push({ group, packages });
    }
  }
  // Validate the complete batch before replacing any generated artifact.
  for (const { group, packages } of prepared) {
    for (const [kind, data] of Object.entries(packages)) writeFileSync(resolve(root, `resources/course/${kind}-${group.category_id}-${group.level.toLowerCase()}.json`), `${JSON.stringify(data, null, 2)}\n`);
    console.log(`${group.category_id}/${group.level}: 35 skill variants + 5 listening scripts; no audio`);
  }
  const manifest = { schema_version: 1, packages: prepared.map(({ group }) => ({ category_id: group.category_id, level: group.level, ...Object.fromEntries(['skills', 'listening', 'vocabulary'].map(kind => {
    const path = `resources/course/${kind}-${group.category_id}-${group.level.toLowerCase()}.json`;
    return [kind, { path, sha256: hash(path) }];
  })) })) };
  writeFileSync(resolve(root, 'resources/course/task-packages-a2-b2.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return prepared;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const contextIndex = args.indexOf('--context');
  const contextPath = contextIndex >= 0 ? args.splice(contextIndex, 2)[1] : undefined;
  requireValue(contextIndex < 0 || contextPath, '--context requires a shared JSON path');
  buildPackages(args.length ? args : sources, contextPath);
}
