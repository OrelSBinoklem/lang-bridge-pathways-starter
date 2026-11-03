import type { Token } from './types';

export const SUBJECTS = ['I', 'you', 'he', 'she', 'we', 'they'] as const;
export const TENSES = ['present', 'past', 'future', 'continuous', 'perfect'] as const;
export type LabSubject = typeof SUBJECTS[number];
export type LabTense = typeof TENSES[number];
export type LabMode = 'statement' | 'negative' | 'question';
export type LabFamily = 'work' | 'be';
export type LabOptions = { subject: LabSubject; tense: LabTense; mode: LabMode; family: LabFamily };
const token = (role: Token['role'], text: string): Token => ({ role, text });
export const TENSE_LABELS: Record<LabTense, string> = { present: 'Present Simple', past: 'Past Simple', future: 'Future · will', continuous: 'Present Continuous', perfect: 'Present Perfect' };

/** Two deliberately limited teaching models, not an arbitrary English conjugator. */
export function buildLabSentence({ subject, tense, mode, family }: LabOptions): { tokens: Token[]; explanation: string } {
  if (!SUBJECTS.includes(subject) || !TENSES.includes(tense) || !['statement', 'negative', 'question'].includes(mode) || !['work', 'be'].includes(family)) throw new Error('Неизвестная модель предложения.');
  if (family === 'be' && (tense === 'continuous' || tense === 'perfect')) throw new Error('В этой демонстрации be ready сравнивается только в трёх простых формах.');
  const third = subject === 'he' || subject === 'she';
  const be = tense === 'past' ? subject === 'I' || third ? 'was' : 'were' : subject === 'I' ? 'am' : third ? 'is' : 'are';
  let auxiliary: string | undefined, verbs: string[];
  if (family === 'be') { auxiliary = tense === 'future' ? 'will' : be; verbs = tense === 'future' ? ['be'] : []; }
  else if (tense === 'continuous') { auxiliary = be; verbs = ['working']; }
  else if (tense === 'perfect') { auxiliary = third ? 'has' : 'have'; verbs = ['worked']; }
  else if (tense === 'future') { auxiliary = 'will'; verbs = ['work']; }
  else if (mode !== 'statement') { auxiliary = tense === 'past' ? 'did' : third ? 'does' : 'do'; verbs = ['work']; }
  else verbs = [tense === 'past' ? 'worked' : third ? 'works' : 'work'];
  const who = token('subject', mode === 'question' ? subject : subject[0].toUpperCase() + subject.slice(1));
  const aux = auxiliary ? token(family === 'be' && tense !== 'future' ? 'verb' : 'auxiliary', mode === 'question' ? auxiliary[0].toUpperCase() + auxiliary.slice(1) : auxiliary) : undefined;
  const tokens = mode === 'question' && aux ? [aux, who] : [who, ...(aux ? [aux] : [])];
  if (mode === 'negative') tokens.push(token('negation', 'not'));
  tokens.push(...verbs.map(word => token('verb', word)), token(family === 'be' ? 'complement' : 'place', `${family === 'be' ? 'ready' : 'in London'}${mode === 'question' ? '?' : '.'}`));
  const explanation = family === 'be'
    ? 'У be свой порядок: am / is / are или was / were сами выходят перед подлежащим. В форме с will перед подлежащим выходит will. Do / does / did не добавляются.'
    : tense === 'present' || tense === 'past'
      ? mode === 'statement' ? 'В утверждении время показывает смысловой глагол: work / works / worked.' : 'Вопрос и отрицание забирают время в do / does / did. После них смысловой глагол возвращается к V1: work.'
      : 'Перед подлежащим в вопросе стоит первый вспомогательный глагол. Not идёт после него. Остальная цепочка сохраняется.';
  return { tokens, explanation };
}
