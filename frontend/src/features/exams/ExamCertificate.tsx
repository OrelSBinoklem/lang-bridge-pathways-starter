'use client';

import type { Attempt } from './types';
import styles from './exams.module.css';

const names: Record<string, string> = { listening: 'Klausīšanās prasme', reading: 'Lasītprasme', writing: 'Rakstītprasme', speaking: 'Runātprasme' };

export function ExamCertificate({ attempt, showPrintButton = true }: { attempt: Attempt; showPrintButton?: boolean }) {
  const points = attempt.results?.reduce((sum, section) => sum + section.points, 0) ?? 0;
  const max = attempt.results?.reduce((sum, section) => sum + section.maximum, 0) ?? 0;
  const date = new Date(attempt.submitted_at ?? attempt.started_at).toLocaleDateString('lv-LV', { timeZone: 'Europe/Riga' });
  if (attempt.learn_lang === 'en') return <>
    {showPrintButton && <button type="button" className={styles.printButton} onClick={() => window.print()}><i className="pi pi-print" aria-hidden /> Печать / PDF</button>}
    <article className={styles.certificate} lang="en" aria-label="Результат учебного экзамена по английскому">
      <div className={styles.certificateBrand}>langbridgepathways</div>
      {attempt.is_preview && <p className={styles.previewMark}>ОБРАЗЕЦ · SAMPLE</p>}
      <p className={styles.certificateDate}>{date}</p>
      <p>RESULT STATEMENT No. LBP-EN-{attempt.level}-{String(attempt.id).padStart(6, '0')}</p>
      <h2>ENGLISH LANGUAGE COURSE EXAMINATION</h2><h3>{attempt.student_name}</h3>
      <p className={styles.certificateLevel}>LEVEL {attempt.level}</p>
      <p className={styles.certificateOutcome}><strong>{attempt.passed ? 'PASSED' : 'NOT PASSED'}</strong></p>
      <p>{points} / {max} points · {attempt.score}%</p>
      <dl>{attempt.results?.map(section => <div key={section.skill}><dt>{{listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking'}[section.skill] ?? section.skill}</dt><dd>{section.points} / {section.maximum} points · {section.percent}%</dd></div>)}</dl>
      <p className={styles.certificateNote}>Pass requirement: at least 60% in each of the four skills.</p>
      <p className={styles.certificateNote}>{attempt.is_preview ? 'Sample document. Demonstration results.' : attempt.reviewed_at ? 'AI assessment reviewed by the platform administrator.' : 'Assessed by the LangBridge Pathways AI tutor.'}</p>
      <footer>This is a course assessment result, not an official language qualification.</footer>
    </article>
  </>;
  return <>
    {showPrintButton && <button type="button" className={styles.printButton} onClick={() => window.print()}><i className="pi pi-print" aria-hidden /> Печать / PDF</button>}
    <article className={styles.certificate} lang="lv" aria-label="Учебный результат экзамена">
      <div className={styles.certificateBrand}>langbridgepathways</div>
      {attempt.is_preview && <p className={styles.previewMark}>ОБРАЗЕЦ · PARAUGS</p>}
      <p className={styles.certificateDate}>{date}</p>
      <p>REZULTĀTU PAZIŅOJUMS Nr. LBP-{attempt.level}-{String(attempt.id).padStart(6, '0')}</p>
      <h2>PAR LATVIEŠU VALODAS MĀCĪBU EKSĀMENA REZULTĀTU</h2>
      <h3>{attempt.student_name}</h3>
      <p>kārtoja latviešu valodas mācību eksāmenu</p>
      <p className={styles.certificateLevel}>LĪMENIS {attempt.level}</p>
      <p>{date} · tiešsaistē</p>
      <p className={styles.certificateOutcome}>eksāmenu <strong>{attempt.passed ? 'NOKĀRTOJA' : 'NENOKĀRTOJA'}</strong></p>
      <p>{points} / {max} punkti · {attempt.score}%</p>
      <dl>{attempt.results?.map(section => <div key={section.skill}><dt>{names[section.skill]}</dt><dd>{section.points} / {section.maximum} punkti · {section.percent}%</dd></div>)}</dl>
      <p className={styles.certificateNote}>Eksāmens ir nokārtots, ja katrā daļā iegūti vismaz 60%.</p>
      <p className={styles.certificateNote}>{attempt.is_preview ? 'Dokumenta paraugs. Rezultāti ir demonstrācijas dati.' : attempt.reviewed_at ? 'AI vērtējumu pārskatījis un apstiprinājis platformas administrators.' : 'Darbu novērtēja langbridgepathways AI tutors.'}</p>
      <footer>Šis ir mācību eksāmena rezultāts. Tas nav valsts valodas prasmes apliecinošs dokuments.</footer>
    </article>
  </>;
}
