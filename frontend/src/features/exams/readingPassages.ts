import type { ExamTask, Question } from './types';

export function readingPassages(task: ExamTask): { text: string; question: Question }[] | null {
  // English notice sets have five or six independent texts with explicit matching labels.
  // Shared advertisement banks and a single article remain unsplit.
  if (task.id.startsWith('en-') && task.text && task.questions.every(q => q.type === 'choice')) {
    const text = task.text.replace(/\r\n?/g, '\n').trim();
    const parts = text.split(/\n\s*\n(?=(?:[A-H]|[1-8])\.\s)/u);
    if (parts.length === task.questions.length && parts.length >= 2 && parts.every((part, index) => {
      const marker = part.match(/^([A-H]|[1-8])\.\s/u)?.[1];
      return marker && new RegExp(`^(?:Notice|Message|Text|Email|Post) ${marker}(?:[:.]|\\s)`, 'iu').test(task.questions[index].prompt);
    })) return parts.map((text, index) => ({text, question: task.questions[index]}));
  }
  if (!task.text || task.questions.length !== 4 || task.questions.some(q => q.type !== 'choice' || q.options?.length !== 3)) return null;
  const text = task.text.replace(/\r\n?/g, '\n').trim();
  const markers = text.startsWith('I. ') ? ['I', 'II', 'III', 'IV']
    : text.startsWith('A. ') ? ['A', 'B', 'C', 'D'] : null;
  if (!markers) return null;
  const parts = text.split(/\n\s*\n(?=(?:I|II|III|IV|A|B|C|D)\.\s)/u);
  if (parts.length !== markers.length) return null;
  // Pair only explicitly labelled independent texts, never a shared matching bank.
  if (parts.some((part, index) => !part.startsWith(`${markers[index]}. `)
    || !new RegExp(`(?:^|\\s)${markers[index]}(?:[.?:]|\\s|$)`, 'u').test(task.questions[index].prompt))) return null;
  return parts.map((part, index) => ({ text: part, question: task.questions[index] }));
}
