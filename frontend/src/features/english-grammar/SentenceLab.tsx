'use client';

import { useState } from 'react';
import { SentenceTokens } from './EnglishGrammarTable';
import { buildLabSentence, SUBJECTS, TENSES, TENSE_LABELS, type LabOptions, type LabFamily, type LabMode, type LabSubject, type LabTense } from './sentenceModel';
import styles from './english-grammar.module.css';

export function SentenceLab() {
  const [options, setOptions] = useState<LabOptions>({ family: 'work', subject: 'she', tense: 'present', mode: 'statement' });
  const { tokens, explanation } = buildLabSentence(options);
  function family(value: LabFamily) { setOptions(current => ({ ...current, family: value, tense: value === 'be' && ['continuous', 'perfect'].includes(current.tense) ? 'present' : current.tense })); }
  return <section className={styles.lab} aria-labelledby="english-lab-title"><div className={styles.labIntro}><span className={styles.eyebrow}>Меняй форму — следи за блоками</span><h2 id="english-lab-title">Одна мысль, другой порядок</h2><p>Посмотри, куда уходит вспомогательный глагол и что остаётся от смыслового.</p></div>
    <div className={styles.labControls}><label>Мысль<select value={options.family} onChange={event => family(event.target.value as LabFamily)}><option value="work">Работать в Лондоне · work</option><option value="be">Быть готовым · be ready</option></select></label><label>Кто<select value={options.subject} onChange={event => setOptions(current => ({ ...current, subject: event.target.value as LabSubject }))}>{SUBJECTS.map(subject => <option key={subject} value={subject}>{subject}</option>)}</select></label><label>Форма<select value={options.tense} onChange={event => setOptions(current => ({ ...current, tense: event.target.value as LabTense }))}>{TENSES.filter(tense => options.family === 'work' || ['present', 'past', 'future'].includes(tense)).map(tense => <option key={tense} value={tense}>{TENSE_LABELS[tense]}</option>)}</select></label></div>
    <div className={styles.modeButtons} role="group" aria-label="Тип предложения">{([['statement', 'Утверждение'], ['negative', 'Отрицание'], ['question', 'Вопрос']] as [LabMode, string][]).map(([mode, label]) => <button key={mode} type="button" aria-pressed={options.mode === mode} onClick={() => setOptions(current => ({ ...current, mode }))}>{label}</button>)}</div>
    <div className={styles.labResult} aria-live="polite" aria-atomic="true"><SentenceTokens tokens={tokens} /><p>{explanation}</p></div><p className={styles.labScope}>Две учебные модели. Вопросы здесь общие: «да / нет»; особые случаи и другие конструкции — в таблицах ниже.</p>
  </section>;
}
