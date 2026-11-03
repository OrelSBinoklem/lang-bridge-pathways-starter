'use client';

import { useEffect, useRef, useState } from 'react';
import ExamVisuals, { ExamPhoto } from './ExamVisuals';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import { ExamsTour } from '@/features/home-tour/ExamsTour';
import { useAdminAppearance } from '@/features/admin/useUserPreview';
import { notifyCreditsChanged } from '@/lib/credit-refresh';
import { HumanTutorAvatar } from '@/features/tutor-avatar/HumanTutorAvatar';
import { AvatarAudioProbe } from '@/features/tutor-avatar/AvatarAudioProbe';
import { ExamCertificate } from './ExamCertificate';
import { ExamChoiceOptions } from './ExamChoiceOptions';
import { ExamTaskQuestions } from './ExamTaskQuestions';
import { readingPassages } from './readingPassages';
import { type Attempt, type Question, skillNames } from './types';
import styles from './exams.module.css';

type Catalog = { data: { id: number; level: string; title: string; available: boolean; best_score: number | null; passed: boolean; durations: Record<string, number> }[]; cooldown_hours: number; retain_audio: boolean; is_admin: boolean };
type History = { data: { data: (Pick<Attempt, 'id' | 'status' | 'score' | 'passed' | 'started_at' | 'next_attempt_at'> & { exam: { level: string } })[]; current_page: number; last_page: number } };
const statuses: Record<string, string> = { running: 'В процессе', pending: 'Ожидает проверки', grading: 'Проверяется', completed: 'Завершён' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Запрос не выполнен. Повторите попытку.';
const examSkills = ['listening', 'reading', 'writing', 'speaking'] as const;
const shortSkillNames: Record<(typeof examSkills)[number], string> = { listening: 'Слух', reading: 'Чтен.', writing: 'Письм.', speaking: 'Речь' };
const durationLabel = (seconds?: number) => seconds ? `${Math.floor(seconds / 60)} мин${seconds % 60 ? ` ${seconds % 60} с` : ''}` : '—';
const compactDurationLabel = (seconds?: number) => seconds ? `${Math.floor(seconds / 60)}м${seconds % 60 ? ` ${seconds % 60}с` : ''}` : '—';
const examTotalSeconds = (durations: Record<string, number>) => examSkills.every(skill => durations?.[skill] > 0)
  ? examSkills.reduce((total, skill) => total + durations[skill], 0) : undefined;
const durationCell = (seconds?: number) => <><span className={styles.fullDuration}>{durationLabel(seconds)}</span><span className={styles.shortDuration} aria-hidden="true">{compactDurationLabel(seconds)}</span></>;

export function ExamPage() {
  const uk = useLocale() === 'uk';
  const params = useSearchParams();
  const router = useRouter();
  const attemptId = Number(params.get('attempt')) || null;
  const selectedLevel = params.get('level');
  const language = params.get('learn_lang') === 'en' ? 'en' : 'lv';
  const examUrl = language === 'en' ? '/exams?learn_lang=en' : '/exams';
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<number | null>(null);
  useEffect(() => { setPage(1); setConfirm(null); setError(''); }, [language]);
  const catalog = useQuery({ queryKey: ['exams', language], queryFn: () => clientApi<Catalog>(`/exams?learn_lang=${language}`) });
  const adminAppearance = useAdminAppearance(catalog.data?.is_admin);
  const history = useQuery({ queryKey: ['exam-history', language, page], queryFn: () => clientApi<History>(`/exams/history?learn_lang=${language}&page=${page}`), enabled: !attemptId });
  async function start(id: number) {
    setStarting(true); setError('');
    try { const result = await clientApi<{ data: Attempt }>(`/exams/${id}/start`, { method: 'POST' }); router.push(`${examUrl}${language === 'en' ? '&' : '?'}attempt=${result.data.id}`); }
    catch (err) { setError(errorMessage(err)); }
    finally { setStarting(false); }
  }
  if (attemptId) return <ExamAttemptView key={attemptId} id={attemptId} />;
  if (params.get('preview') === 'all') return <CertificateGallery language={language} />;
  if (params.get('preview')) return <CertificatePreview id={Number(params.get('preview'))} />;
  return <section className={styles.root} data-exam-tour="catalog">
    <header className={styles.header}><div><Link href={language === 'en' ? '/' : '/course'}>{language === 'en' ? (uk ? 'На головну' : 'На главную') : (uk ? 'До курсу' : 'К курсу')}</Link><h1>{uk ? 'Підсумкові іспити' : 'Итоговые экзамены'} · {language === 'en' ? (uk ? 'Англійська' : 'Английский') : (uk ? 'Латиська' : 'Латышский')}</h1></div><i className="pi pi-graduation-cap" aria-hidden /></header>
    <nav className={styles.actions} aria-label={uk ? 'Мова іспиту' : 'Язык экзамена'}><Link href="/exams" aria-current={language === 'lv' ? 'page' : undefined}>{uk ? 'Латиська' : 'Латышский'}</Link><Link href="/exams?learn_lang=en" aria-current={language === 'en' ? 'page' : undefined}>{uk ? 'Англійська' : 'Английский'}</Link></nav>
    {language === 'en' && <p>{uk ? 'Авторські навчальні іспити A1–B2: по п’ять варіантів на рівень.' : 'Авторские учебные экзамены A1–B2: по пять вариантов на уровень.'}</p>}
    {(catalog.isLoading || history.isLoading) && <p role="status">Загрузка…</p>}
    {(catalog.isError || history.isError) && <p role="alert">Не удалось загрузить экзамены. <button onClick={() => { void catalog.refetch(); void history.refetch(); }}>Повторить</button></p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {catalog.data && !starting && confirm === null && <ExamsTour key={language} isAuthenticated />}
    <div className={styles.catalog} data-exam-tour="levels">{catalog.data?.data.map(exam => <article key={exam.id} className={`${styles.level} ${selectedLevel === exam.level ? styles.selected : ''}`}>
      <h2>{exam.level}</h2>
      {exam.best_score !== null && <><progress max={100} value={exam.best_score} /><p className={styles.bestScore}>Лучший результат: {Math.round(Number(exam.best_score))}%</p></>}
      <button disabled={!exam.available || starting} onClick={() => setConfirm(exam.id)}>Начать / продолжить</button>
    </article>)}</div>
    {adminAppearance && <Link href={`${examUrl}${language === 'en' ? '&' : '?'}preview=all`} className={styles.samplesLink}><i className="pi pi-file-pdf" aria-hidden="true" />Образцы результатов A1–B2<i className="pi pi-arrow-right" aria-hidden="true" /></Link>}
    {confirm !== null && <div className={styles.confirm} role="dialog" aria-modal="true" aria-labelledby="exam-confirm-title">
      <div><h2 id="exam-confirm-title">Начать экзамен?</h2><p>Сдача строго по времени. Закрытие страницы и потеря связи не останавливают таймер. Прослушивание каждой записи доступно дважды, без перемотки.</p>
        <div className={styles.durationScroll}><table className={styles.durations}>
          <caption>Время на каждую часть</caption>
          <thead><tr><th scope="col">Уровень</th>{examSkills.map(skill => <th key={skill} scope="col" aria-label={skillNames[skill]}><span className={styles.fullSkill}>{skillNames[skill]}</span><span className={styles.shortSkill} aria-hidden="true">{shortSkillNames[skill]}</span></th>)}<th scope="col">Итого</th></tr></thead>
          <tbody>{catalog.data?.data.map(exam => <tr key={exam.id} className={confirm === exam.id ? styles.currentDuration : undefined}>
            <th scope="row">{exam.level}</th>{examSkills.map(skill => <td key={skill} aria-label={durationLabel(exam.durations?.[skill])}>{durationCell(exam.durations?.[skill])}</td>)}<td className={styles.totalDuration} aria-label={durationLabel(examTotalSeconds(exam.durations))}>{durationCell(examTotalSeconds(exam.durations))}</td>
          </tr>)}</tbody>
        </table></div>
        <p>Для зачёта нужно минимум 60% по каждому навыку. Пересдача через {catalog.data?.cooldown_hours} ч. после завершения попытки. Подсказки во время экзамена недоступны.</p>
        <p>Для устной части нужен микрофон. Ответы обрабатывает AI для проверки.</p>
        {catalog.data?.retain_audio && <p>Записи устных ответов будут храниться приватно 30 дней для пересмотра результата.</p>}
        <div className={styles.actions}><button className={styles.startButton} disabled={starting} onClick={() => void start(confirm)}>Начать</button><button disabled={starting} onClick={() => setConfirm(null)}>Отмена</button></div>
      </div>
    </div>}
    <h2 data-exam-tour="history">История моих попыток</h2>
    <div className={styles.history}>{history.data?.data.data.map(attempt => <Link key={attempt.id} href={`${examUrl}${language === 'en' ? '&' : '?'}attempt=${attempt.id}`}>
      <strong>{attempt.exam.level} · №{attempt.id}</strong><span>{new Date(attempt.started_at).toLocaleString('ru-RU')}</span><span>{statuses[attempt.status]}</span>
      <span>{attempt.score === null ? '—' : `${attempt.score}% · ${attempt.passed ? 'Сдан' : 'Не сдан'}`}</span><i className="pi pi-chevron-right" aria-hidden />
    </Link>)}</div>
    {history.data?.data.data.length === 0 && <p>Попыток пока нет.</p>}
    <div className={styles.actions}><button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Предыдущая страница"><i className="pi pi-chevron-left" /></button><span>{page} / {history.data?.data.last_page ?? 1}</span><button disabled={page >= (history.data?.data.last_page ?? 1)} onClick={() => setPage(page + 1)} aria-label="Следующая страница"><i className="pi pi-chevron-right" /></button></div>
  </section>;
}

function CertificatePreview({ id }: { id: number }) {
  const query = useQuery({ queryKey: ['exam-certificate-preview', id], queryFn: () => clientApi<{ data: Attempt }>(`/exams/${id}/certificate-preview`) });
  return <section className={styles.root}><Link href={query.data?.data.learn_lang === 'en' ? '/exams?learn_lang=en' : '/exams'}>К экзаменам</Link><h1>Образец документа</h1>{query.data ? <ExamCertificate attempt={query.data.data} /> : <p>{query.isError ? 'Предпросмотр доступен только администратору.' : 'Загрузка…'}</p>}</section>;
}

function CertificateGallery({ language }: { language: 'lv' | 'en' }) {
  const catalog = useQuery({ queryKey: ['exams', language], queryFn: () => clientApi<Catalog>(`/exams?learn_lang=${language}`) });
  const exams = catalog.data?.is_admin ? catalog.data.data : [];
  const previews = useQuery({
    queryKey: ['exam-certificate-previews', exams.map(exam => exam.id)],
    queryFn: () => Promise.all(exams.map(exam => clientApi<{ data: Attempt }>(`/exams/${exam.id}/certificate-preview`).then(response => response.data))),
    enabled: exams.length > 0,
  });
  return <section className={styles.root}>
    <Link href={language === 'en' ? '/exams?learn_lang=en' : '/exams'}>К экзаменам</Link><h1>Образцы результатов</h1>
    {catalog.isLoading && <p role="status">Загрузка…</p>}
    {catalog.isError && <p role="alert">Не удалось загрузить список экзаменов.</p>}
    {catalog.data && !catalog.data.is_admin && <p>Предпросмотр доступен только администратору.</p>}
    {previews.isLoading && <p role="status">Загрузка образцов…</p>}
    {previews.isError && <p role="alert">Не удалось загрузить образцы. <button type="button" onClick={() => void previews.refetch()}>Повторить</button></p>}
    {previews.data && <>
      <nav className={styles.sampleNav} aria-label="Уровни образцов">{previews.data.map(attempt => <a key={attempt.level} href={`#exam-sample-${attempt.level}`}>{attempt.level}</a>)}</nav>
      <button type="button" className={styles.printButton} onClick={() => window.print()}><i className="pi pi-print" aria-hidden="true" /> Печать / PDF</button>
      <div className={styles.samples}>{previews.data.map(attempt => <section key={attempt.level} id={`exam-sample-${attempt.level}`}>
        <h2>Уровень {attempt.level}</h2><ExamCertificate attempt={attempt} showPrintButton={false} />
      </section>)}</div>
    </>}
  </section>;
}

function ExamAttemptView({ id }: { id: number }) {
  const uk = useLocale() === 'uk';
  const queryClient = useQueryClient();
  const [gradeError, setGradeError] = useState('');
  const grading = useRef(false);
  const query = useQuery({ queryKey: ['exam-attempt', id], queryFn: async () => {
    const result = await clientApi<{ data: Attempt }>(`/exam-attempts/${id}`);
    result.data.received_at = Date.now();
    return result;
  }, refetchInterval: q => q.state.data?.data.status === 'completed' ? false : 5000 });
  const attempt = query.data?.data;
  useEffect(() => { if (attempt?.status === 'completed') notifyCreditsChanged(); }, [attempt?.status]);
  useEffect(() => {
    if (attempt?.status !== 'pending' || grading.current || attempt.grading_error) return;
    grading.current = true;
    clientApi<{ data: Attempt }>(`/exam-attempts/${id}/grade`, { method: 'POST' })
      .then(data => queryClient.setQueryData(['exam-attempt', id], data)).catch(err => setGradeError(errorMessage(err)))
      .finally(() => { grading.current = false; });
  }, [attempt?.status, attempt?.grading_error, id, queryClient]);
  if (!attempt) return <section className={styles.root}><Link href="/exams">К экзаменам</Link><p role={query.isError ? 'alert' : 'status'}>{query.isError ? 'Не удалось загрузить попытку.' : 'Загрузка…'}</p><button onClick={() => void query.refetch()}>Повторить</button></section>;
  return <section className={styles.root}>
    <header className={styles.header}><div><Link href={attempt.learn_lang === 'en' ? '/exams?learn_lang=en' : '/exams'}>Все экзамены и история</Link><h1>{attempt.level} · {attempt.title}</h1></div><span>№{attempt.id}</span></header>
    {query.isError && <p role="alert">Нет связи с сервером. Таймер продолжает идти.</p>}
    {attempt.status === 'running' ? <ExamRunner key={`${id}:${attempt.section_index}`} attempt={attempt} onSync={data => queryClient.setQueryData(['exam-attempt', id], { data })} refresh={() => { void query.refetch(); }} /> : attempt.status !== 'completed' ? <>
      <h2>Экзамен завершён. Проверяем ответы.</h2><p>Результат сохранится в истории. Эту страницу можно закрыть.</p>
      {(attempt.grading_error || gradeError) && <p role="alert">{attempt.grading_error === 'credits_unavailable'
        ? (uk ? 'Недостатньо кредитів для перевірки. Відповіді збережені; після поповнення перевірка продовжиться.' : 'Недостаточно кредитов для проверки. Ответы сохранены; после пополнения проверка продолжится.')
        : attempt.grading_error === 'subscription_required'
          ? (uk ? 'Підписка більше не потрібна. Повторіть перевірку; відповіді збережено.' : 'Подписка больше не нужна. Повторите проверку; ответы сохранены.')
          : attempt.grading_error || gradeError}</p>}
    </> : <>
      <div className={styles.resultBanner}><h2>{attempt.passed ? 'Экзамен сдан' : 'Экзамен не сдан'}</h2><strong>{attempt.score}%</strong><p>Для зачёта требуется минимум 60% в каждой части.</p><p>{attempt.reviewed_at ? 'Проверено AI и подтверждено администратором' : 'Проверено AI'}</p></div>
      {attempt.next_attempt_at && <p>Следующая попытка: {new Date(attempt.next_attempt_at).toLocaleString('ru-RU')}</p>}
      <ExamCertificate attempt={attempt} />
      <a className={styles.reviewJump} href="#exam-review">Разбор <i className="pi pi-arrow-down" aria-hidden="true" /></a>
      <h2 id="exam-review" className={styles.reviewSection}>Разбор ответов и аналитика бота</h2>
      {attempt.sections.map((section) => <section id={`review-${section.skill}`} key={section.skill} className={styles.reviewSection}>
        <h2>{skillNames[section.skill]} · {attempt.results?.find(result => result.skill === section.skill)?.percent}%</h2>
        {section.skill === 'speaking' && <p>AI оценил содержание и грамматику по распознанной речи; это не отдельная оценка произношения.</p>}
        {section.tasks.map(task => <div key={task.id}><h3>{task.title}</h3>{!task.reading_groups?.length && task.text && <p className={styles.passage}>{task.text}</p>}{task.transcript && <details><summary>Текст аудиозаписи</summary><p className={styles.passage}>{task.transcript}</p></details>}
          {task.visuals?.length ? <ExamVisuals visuals={task.visuals} /> : task.image && <div className={styles.sceneImage}><ExamPhoto src={task.image} /></div>}
          <ExamTaskQuestions task={task} language={attempt.learn_lang} renderQuestion={q => {
            const grade = attempt.results?.find(result => result.skill === section.skill)?.answers[q.id]; const answer = attempt.answers[q.id]?.text;
            return <div key={q.id} className={`${styles.reviewAnswer} ${grade && grade.points < grade.maximum ? styles.incorrect : ''}`}>
              {q.image && <div className={styles.questionImage}><ExamPhoto src={q.image} /></div>}
              <strong>{q.prompt}</strong><p className={styles.answerText}>{q.type === 'speaking' ? 'Распознанная речь' : 'Ваш ответ'}: {q.options?.find(o => o.id === answer)?.text ?? (answer || 'Нет ответа')}</p>
              {!!attempt.answers[q.id]?.transcript_candidates?.length && <details><summary>Варианты распознавания</summary>{attempt.answers[q.id].transcript_candidates?.map(candidate => <div key={candidate.id}><strong>{candidate.model} · {candidate.language === 'auto' ? 'Авто' : candidate.language === 'en' ? 'Английский' : 'Латышский'}{candidate.id === attempt.answers[q.id].transcription_selected ? ' · Основной текст' : ''}</strong><p className={styles.answerText}>{candidate.ok ? candidate.text : 'Этот проход распознавания недоступен.'}</p></div>)}</details>}
              {q.type === 'choice' && <p>Верно: {q.options?.find(o => o.id === q.correct)?.text}</p>}
              <p><strong>{grade?.points} / {q.points}</strong></p>
              {q.type === 'choice' || q.type === 'short' ? <>
                {q.explanation && <p className={styles.answerText}><strong>Комментарий: </strong><span lang={attempt.learn_lang ?? 'lv'}>{q.explanation}</span></p>}
                {q.explanation_translations?.[uk ? 'uk' : 'ru'] && <p className={styles.answerText}><strong>{uk ? 'Переклад: ' : 'Перевод: '}</strong><span lang={uk ? 'uk' : 'ru'}>{q.explanation_translations[uk ? 'uk' : 'ru']}</span></p>}
              </> : <p className={styles.answerText}><strong>Разбор бота: </strong>{grade?.feedback}</p>}
              {!!grade?.errors?.length && <div className={styles.mistakes}>{grade.errors.map((error, i) => <div key={i}><p><del lang={attempt.learn_lang ?? 'lv'}>{error.original}</del><span aria-hidden="true"> → </span><ins lang={attempt.learn_lang ?? 'lv'}>{error.correction}</ins></p><p>{error.explanation}</p></div>)}</div>}
              {grade?.example && <div><strong>Корректный вариант</strong><p className={styles.answerText} lang={attempt.learn_lang ?? 'lv'}>{grade.example}</p></div>}
              {grade?.recommendation && <p><strong>Что повторить: </strong>{grade.recommendation}</p>}
            </div>;
          }} /></div>)}
      </section>)}
    </>}
  </section>;
}

function ExamRunner({ attempt, onSync, refresh }: { attempt: Attempt; onSync: (data: Attempt) => void; refresh: () => void }) {
  const section = attempt.sections[0];
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(attempt.answers).map(([id, a]) => [id, a.text ?? ''])));
  const answersRef = useRef(answers);
  const queue = useRef(Promise.resolve());
  const [saving, setSaving] = useState(0);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const clock = { server: Date.parse(attempt.server_now), local: attempt.received_at ?? now };
  const left = Math.max(0, Math.ceil((Date.parse(attempt.deadline_at) - clock.server - (now - clock.local)) / 1000));
  const activeAudio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audioSpeaking, setAudioSpeaking] = useState(false);
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const audioProbe = useRef<AvatarAudioProbe | null>(null);
  const audioGeneration = useRef(0);
  const [plays, setPlays] = useState(attempt.playbacks);
  const [recording, setRecording] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [speechReceived, setSpeechReceived] = useState<string[]>(() => Object.keys(attempt.answers).filter(id => attempt.answers[id].source === 'speech'));

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (left === 0) { if (recorder.current?.state === 'recording') recorder.current.stop(); refresh(); }
  }, [left, refresh]);
  useEffect(() => () => {
    audioGeneration.current++;
    audioProbe.current?.dispose();
    audioProbe.current = null;
    if (activeAudio.current) {
      activeAudio.current.onplaying = null;
      activeAudio.current.onwaiting = null;
      activeAudio.current.onpause = null;
      activeAudio.current.onended = null;
      activeAudio.current.onerror = null;
    }
    activeAudio.current?.pause();
    if (recorder.current?.state === 'recording') { recorder.current.onstop = null; recorder.current.stop(); }
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);
  function save(values: Record<string, string>, finish = false) {
    setSaving(n => n + 1);
    const request = queue.current.then(async () => {
      const result = await clientApi<{ data: Attempt }>(`/exam-attempts/${attempt.id}`, { method: 'PUT', body: JSON.stringify({ section: attempt.section_index, answers: values, finish }) });
      result.data.received_at = Date.now(); onSync(result.data); setError('');
    });
    queue.current = request.catch(err => { setError(`Ответ не сохранён: ${errorMessage(err)}`); }).finally(() => setSaving(n => n - 1));
    return request;
  }
  function change(id: string, value: string, immediate: boolean) {
    const next = { ...answersRef.current, [id]: value }; answersRef.current = next; setAnswers(next);
    if (immediate) void save({ [id]: value }).catch(() => {});
  }
  useEffect(() => {
    const timeout = setTimeout(() => { void save(answersRef.current).catch(() => {}); }, 1200);
    return () => clearTimeout(timeout);
    // Draft changes are intentionally batched; server responses must not restart this timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);
  async function play(taskId: string, question = false) {
    const generation = audioGeneration.current;
    const probe = audioProbe.current ??= new AvatarAudioProbe({ onAnalyser: setAudioAnalyser });
    probe.unlock();
    setPlaying(taskId); setError('');
    try {
      const result = await clientApi<{ audio: string; playbacks: Attempt['playbacks'] }>(`/exam-attempts/${attempt.id}/audio`, { method: 'POST', body: JSON.stringify(question ? { question_id: taskId } : { task_id: taskId }) });
      if (generation !== audioGeneration.current) return;
      setPlays(result.playbacks);
      const audio = new Audio(`data:audio/mpeg;base64,${result.audio}`); activeAudio.current = audio;
      audio.onplaying = () => { probe.attach(audio); setAudioSpeaking(true); };
      audio.onwaiting = () => setAudioSpeaking(false);
      audio.onpause = () => { probe.detach(); setAudioSpeaking(false); };
      audio.onended = () => { probe.detach(); setAudioSpeaking(false); setPlaying(null); activeAudio.current = null; };
      audio.onerror = () => { probe.detach(); setAudioSpeaking(false); setPlaying(null); setError('Не удалось воспроизвести аудио.'); };
      await audio.play();
    } catch (err) {
      if (generation !== audioGeneration.current) return;
      probe.detach(); setAudioSpeaking(false); setPlaying(null); setError(errorMessage(err));
    }
  }
  async function record(id: string) {
    if (recording) { if (recorder.current?.state === 'recording') recorder.current.stop(); return; }
    setError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
      if (!type) throw new Error('Браузер не поддерживает запись аудио.');
      const rec = new MediaRecorder(stream.current, { mimeType: type }); recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      rec.onstop = async () => {
        setRecording(null); setUploading(id); stream.current?.getTracks().forEach(track => track.stop());
        try {
          const blob = new Blob(chunks, { type });
          const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
          await clientApi(`/exam-attempts/${attempt.id}/speech`, { method: 'POST', body: JSON.stringify({ question_id: id, audio: base64, mime: type }) });
          setSpeechReceived(ids => [...new Set([...ids, id])]);
        } catch (err) { setError(errorMessage(err)); }
        finally { setUploading(null); }
      };
      rec.start(); setRecording(id);
    } catch (err) { stream.current?.getTracks().forEach(track => track.stop()); setError(errorMessage(err)); }
  }
  async function finish() {
    setConfirmFinish(false);
    setFinishing(true);
    try { await save(answersRef.current, true); } catch {} finally { setFinishing(false); }
  }
  const disabled = left === 0 || finishing;
  const renderQuestion = (q: Question, inlineChoices = false) => <div key={q.id} className={styles.question}>
    {q.image && <div className={styles.questionImage}><ExamPhoto src={q.image} label="Attēls" /></div>}
    {!(q.type === 'speaking' && q.has_audio) && !(q.type === 'choice' && inlineChoices) && <label htmlFor={q.id}>{q.prompt}</label>}
    {q.type === 'speaking' && q.has_audio && <button className={styles.audioButton} disabled={disabled || !!playing || !!recording || !!uploading} onClick={() => void play(q.id, true)}><i className={`pi ${playing === q.id ? 'pi-volume-up' : 'pi-play'}`} aria-hidden />{playing === q.id ? 'Воспроизведение…' : 'Слушать вопрос'}</button>}
    {q.type === 'choice' ? inlineChoices
      ? <ExamChoiceOptions question={q} value={answers[q.id] ?? ''} disabled={disabled} onChange={value => change(q.id, value, true)} />
      : <select id={q.id} value={answers[q.id] ?? ''} disabled={disabled} onChange={e => change(q.id, e.target.value, true)}><option value="">— Izvēlieties —</option>{q.options?.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}</select>
      : q.type === 'speaking' ? <div className={styles.actions}><button disabled={disabled || !!playing || !!uploading || (!!recording && recording !== q.id)} onClick={() => void record(q.id)}><i className={`pi ${recording === q.id ? 'pi-stop-circle' : 'pi-microphone'}`} aria-hidden />{recording === q.id ? 'Завершить ответ' : 'Ответить голосом'}</button><span role="status">{uploading === q.id ? 'Обработка…' : speechReceived.includes(q.id) ? 'Ответ принят' : ''}</span></div>
      : q.type === 'essay' ? <><textarea id={q.id} rows={7} value={answers[q.id] ?? ''} maxLength={12000} disabled={disabled} onChange={e => change(q.id, e.target.value, false)} onBlur={() => void save({ [q.id]: answersRef.current[q.id] ?? '' }).catch(() => {})} /><small>{(answers[q.id] ?? '').trim().split(/\s+/).filter(Boolean).length} слов</small></>
      : <input id={q.id} value={answers[q.id] ?? ''} maxLength={500} disabled={disabled} onChange={e => change(q.id, e.target.value, false)} onBlur={() => void save({ [q.id]: answersRef.current[q.id] ?? '' }).catch(() => {})} />}
  </div>;
  return <>
    <div className={styles.timerBar}><strong>{attempt.section_index + 1} / 4 · {skillNames[section.skill]}</strong><time role="timer" aria-label="Осталось времени">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</time><span role="status">{saving ? 'Сохранение…' : 'Ответы сохранены'}</span></div>
    <HumanTutorAvatar compact analyser={audioAnalyser} state={recording ? 'listening' : uploading || (playing && !audioSpeaking) ? 'thinking' : audioSpeaking ? 'speaking' : 'idle'} />
    {error && <p className={styles.error} role="alert">{error} <button onClick={() => void save(answersRef.current).catch(() => {})}>Повторить сохранение</button></p>}
    {section.tasks.map(task => {
      const passages = section.skill === 'reading' ? readingPassages(task) : null;
      return <section key={task.id} className={styles.task}>
      <h2>{task.title}</h2>{!passages && !task.reading_groups?.length && task.text && <p lang={attempt.learn_lang ?? 'lv'} className={styles.passage}>{task.text}</p>}
      {task.visuals?.length ? <ExamVisuals visuals={task.visuals} /> : task.image && <div className={styles.sceneImage}><ExamPhoto src={task.image} /></div>}
      {section.skill === 'listening' && <button className={styles.audioButton} disabled={disabled || !!playing || (plays[task.id]?.count ?? 0) >= 2} onClick={() => void play(task.id)}><i className={`pi ${playing === task.id ? 'pi-volume-up' : 'pi-play'}`} aria-hidden />{playing === task.id ? 'Воспроизведение…' : 'Слушать'} · {plays[task.id]?.count ?? 0}/2</button>}
      <ExamTaskQuestions task={task} language={attempt.learn_lang} interleave={section.skill === 'reading'} renderQuestion={renderQuestion} />
    </section>; })}
    <div className={styles.actions}><button disabled={disabled || !!recording || !!uploading || !!playing} onClick={() => setConfirmFinish(true)}>{attempt.section_index === 3 ? 'Завершить экзамен' : 'Завершить часть'}</button></div>
    {confirmFinish && <div className={styles.confirm} role="dialog" aria-modal="true" aria-labelledby="finish-title"><div>
      <h2 id="finish-title">Завершить эту часть?</h2><p>Вернуться к её ответам будет нельзя.</p>
      <div className={styles.actions}><button disabled={disabled} onClick={() => void finish()}>Подтвердить завершение</button><button onClick={() => setConfirmFinish(false)}>Продолжить работу</button></div>
    </div></div>}
  </>;
}
