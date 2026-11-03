import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const contextPath = process.argv[2];
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const sourcePath = 'resources/course/a1-skill-content.json';
const source = read(sourcePath);
const detailsPath = 'resources/course/a1-skill-details.json';
const details = read(detailsPath);
const topicsPath = 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-all-words.json';
const frequenciesPath = 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-frequencies.json';
const topics = read(topicsPath).A1;
const frequencies = read(frequenciesPath).frequencies;
const contexts = contextPath ? read(contextPath) : source.groups.map(group => {
  const result = spawnSync(process.env.PHP_BINARY || 'php', ['-d', 'display_errors=0', '-d', 'display_startup_errors=0', 'artisan', 'task-generator:context', String(group.category_id), '--dictionary_id=20', '--shared'], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Shared vocabulary export failed for ${group.category_id}. Run task-generator:context to inspect the error.`);
  const context = JSON.parse(result.stdout);
  if (context.mode !== 'shared_course' || context.user_vocabulary_progress !== null) throw new Error('Only shared vocabulary may be persisted.');
  return { ...context.category_vocabulary, category_id: context.category_vocabulary.current_category.id };
});
const forms = text => [...new Set(text.toLocaleLowerCase('lv').match(/[\p{L}\p{M}]+/gu) ?? [])];
const normalize = text => text.trim().toLocaleLowerCase('lv');
const profiles = [
  { a: { name: 'Mārtiņš', gender: 'male' }, b: { name: 'Anna', gender: 'female' } },
  { a: { name: 'Līga', gender: 'female' }, b: { name: 'Andris', gender: 'male' } },
  { a: { name: 'Mārtiņš', gender: 'male' }, b: { name: 'Laura', gender: 'female' } },
  { a: { name: 'Līga', gender: 'female' }, b: { name: 'Jānis', gender: 'male' } },
  { a: { name: 'Mārtiņš', gender: 'male' }, b: { name: 'Elīna', gender: 'female' } },
];

for (const group of source.groups) {
  const context = contexts.find(item => item.category_id === group.category_id);
  if (!context || !context.current_words?.length || !Array.isArray(context.prior_words)) throw new Error(`Missing shared DB context: ${group.category_id}`);
  if (context.user_vocabulary_progress || context.user_id) throw new Error('Do not persist personal vocabulary context in shared course resources.');
  const topic = Object.keys(topics).find(key => context.current_words.some(word => normalize(key.replace(/^\d+\.\s*/, '').replace(/…$/, '')) === normalize(word.word)));
  if (!topic) throw new Error(`Review exact E-Laipa topic mapping for ${group.category_id}`);
  const targetWords = context.current_words.filter(word => group.targets.includes(word.word));
  if (!targetWords.length) throw new Error(`No matching DB targets: ${group.category_id}`);
  const imageUrl = `/course/categories/${group.category_id}-v1.webp`;
  const speakers = profiles.map((profile, index) => group.category_id === 1766 && index === 0 ? { ...profile, b: { ...profile.b, name: 'Marta' } } : profile);
  if (!existsSync(resolve(root, `frontend/public${imageUrl}`))) throw new Error(`Missing illustration ${imageUrl}`);
  const candidates = Object.values(topics[topic]).flat().map(([word]) => word);
  const auditVariants = [];
  const variants = group.variants.map((variant, index) => {
    if (variant.facts.length !== 5 || variant.goals.length !== 3 || variant.translation.length !== 2 || variant.dialogue.length < 4) throw new Error(`Invalid authored scenario ${group.category_id}/${index}`);
    const extraFacts = details[group.category_id]?.[index];
    if (extraFacts?.length !== 5) throw new Error('Five additional independent facts required.');
    const allFacts = [...variant.facts, ...extraFacts];
    const text = `${allFacts.map(fact => fact[0]).join(' ')} ${variant.extra}`;
    const dialogue = [...variant.dialogue, 'Pastāsti vēl mazliet par šo vietu.', extraFacts.map(fact => fact[0]).join(' ')];
    const tokens = forms(`${text} ${dialogue.join(' ')}`);
    // Conservative stem candidates are editorial references, never evidence of mastery.
    const targets = targetWords.filter(word => {
      const stems = forms(word.word).map(form => form.replace(/(?:ties|ēt|īt|ot|a|e|s|i)$/u, ''));
      return stems.every(stem => stem.length >= 3 && tokens.some(token => token.startsWith(stem)));
    }).map(word => word.id);
    if (!targets.length) throw new Error(`Review target vocabulary: ${group.category_id}/${variant.title}`);
    const questions = allFacts.map(([truth, falsehood, explanation], offset) => (index + offset) % 2
      ? [falsehood, false, explanation]
      : [truth, true, explanation]);
    const goalText = variant.goals.join('; ');
    const tutorCheck = `Цели: ${goalText}. Сюжет и проверенные факты: ${variant.facts.map(fact => fact[2]).join(' ')} Не требуй дословности, принимай корректные вопросы и перефразирования. Не раскрывай готовые ответы до попытки. Не выдумывай сохранённые оценки. Объясняй ошибки на языке интерфейса ученика.`;
    auditVariants.push({ title: variant.title, target_word_ids: targets, frequency_forms: Object.fromEntries(tokens.map(form => [form, frequencies[form] ?? null])), exact_forms_not_in_db: tokens.filter(form => ![...context.current_words, ...context.prior_words].some(word => normalize(word.word) === form)) });
    return {
      title: variant.title, target_word_ids: targets,
      reading: { text, questions },
      translation: { lv: variant.translation[0], ru: variant.translation[1] },
      writing_translation: { lv: variant.translation[0], ru: variant.translation[1] },
      image: { instruction: `${group.image_goals[index]} тремя-четырьмя предложениями по-латышски.`, prompt: `Проверь описание только видимых предметов по цели «${group.image_goals[index]}». Не требуй выдуманных имён, адресов, цен и истории. Принимай простые правильные предложения A1.` },
      questions: { instruction: `Напиши три вопроса по-латышски, чтобы узнать: ${goalText}.`, prompt: tutorCheck },
      roleplay: { instruction: `Поговори по-латышски на тему «${variant.title}». Представь ситуацию и узнай у собеседника: ${goalText}.`, prompt: `Играй ${speakers[index].b.name}, пол ${speakers[index].b.gender === 'female' ? 'женский' : 'мужской'}. Используй верные формы рода. ${tutorCheck} Отвечай на вопросы по одному, короткими репликами A1. Если ученик рассказал свою ситуацию, не заставляй его копировать биографию персонажа.` },
      speaking_questions: { instruction: `Задай вслух три вопроса по-латышски: ${goalText}.`, prompt: tutorCheck },
    };
  });
  if (variants.length !== 5) throw new Error('Five authored variants required.');
  const base = { schema_version: 1, category_id: group.category_id, dictionary_id: 20, level: 'A1', elaipa_topic: topic };
  const skills = { ...base, image_url: imageUrl, image_facts: group.image_facts, writing_title: 'Письмо: задания по теме', speaking_title: 'Говорение: диалог по теме', editorial_notes: 'Shared pre-authored tasks. DB current/prior vocabulary + exact E-Laipa topic reviewed. No personal mastery assumed; stem matches are editorial candidates. No paid generation or TTS.', variants };
  const listening = { ...base, variants: group.variants.map((variant, index) => ({ title: variant.title, target_word_ids: variants[index].target_word_ids, speakers: speakers[index], segments: [...variant.dialogue, 'Pastāsti vēl mazliet par šo vietu.', details[group.category_id][index].map(fact => fact[0]).join(' ')].map((line, turn) => [turn % 2 ? 'b' : 'a', line]), questions: variants[index].reading.questions })) };
  const audit = { mode: 'shared_course', category_id: group.category_id, source_sha256: sha(sourcePath), frequency_source: { path: frequenciesPath, sha256: sha(frequenciesPath) }, elaipa_topic_reference: { path: topicsPath, sha256: sha(topicsPath), topic, candidates }, current_word_ids: context.current_words.map(w => w.id), prior_word_ids: context.prior_words.map(w => w.id), knowledge: 'not_assessed', limitation: 'Exact-form frequency and conservative stems are not a validated CEFR lexicon or user mastery. Inflected forms and JSON-only words require editorial review.', variants: auditVariants };
  audit.details_sha256 = sha(detailsPath);
  for (const [name, data] of [['skills', skills], ['listening', listening], ['vocabulary', audit]]) {
    writeFileSync(resolve(root, `resources/course/${name}-${group.category_id}-a1.json`), `${JSON.stringify(data, null, 2)}\n`);
  }
  console.log(`${group.category_id}: ${topic}; 35 skill variants + 5 listening scripts; audio not generated`);
}
