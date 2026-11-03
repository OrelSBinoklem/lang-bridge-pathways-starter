'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { TabPanel, TabView } from 'primereact/tabview';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { dropdownPortalProps } from '@/features/admin/dropdownPortal';
import { HtmlCodeEditor } from '@/features/admin/HtmlCodeEditor';
import type { DictWord } from '@/features/training/helpers';
import { clientApi } from '@/lib/client-api';

type ProgressForm = {
  id?: number | null;
  attempts: number;
  correct_attempts: number;
  attempts_revert: number;
  correct_attempts_revert: number;
  statistic_attempts: number;
  statistic_attempts_revert: number;
  statistic_correct_attempts: number;
  statistic_correct_attempts_revert: number;
  mode_education: number;
  mode_education_revert: number;
  easy_education: number;
  attempts_all: number;
  correct_attempts_all: number;
  easy_correct: number;
  easy_correct_revert: number;
  cooldown_tier: number;
  cooldown_tier_revert: number;
  last_shown: string;
  last_shown_revert: string;
};

type WordForm = {
  word: string;
  translation_1: string;
  translation_2: string;
  translation_3: string;
  translation_input_variable: string;
  difficult_translation: string;
  translations: Record<string, WordTranslationForm>;
  info: string;
  sound_url: string;
  level: number | null;
  max_level: number | null;
  type: string;
  gender: string;
  is_phrase: boolean;
};

type WordTranslationForm = {
  translation_1: string;
  translation_2: string;
  translation_3: string;
  translation_input_variable: string;
  difficult_translation: string;
  info: string;
};

const EDIT_TRANSLATION_LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'uk', label: 'UK' },
];

const EMPTY_PROGRESS: ProgressForm = {
  id: null,
  attempts: 0,
  correct_attempts: 0,
  attempts_revert: 0,
  correct_attempts_revert: 0,
  statistic_attempts: 0,
  statistic_attempts_revert: 0,
  statistic_correct_attempts: 0,
  statistic_correct_attempts_revert: 0,
  mode_education: 0,
  mode_education_revert: 0,
  easy_education: 0,
  attempts_all: 0,
  correct_attempts_all: 0,
  easy_correct: 0,
  easy_correct_revert: 0,
  cooldown_tier: 0,
  cooldown_tier_revert: 0,
  last_shown: '',
  last_shown_revert: '',
};

const OPT_01 = [
  { label: '0', value: 0 },
  { label: '1', value: 1 },
];

const OPT_02 = [
  { label: '0', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
];

function toLocalDt(v?: string | null): string {
  if (!v) return '';
  return String(v).replace(' ', 'T').slice(0, 19);
}

function clamp02(n: number) {
  return Math.min(2, Math.max(0, n));
}

function wordToForm(w: DictWord): WordForm {
  const translations: Record<string, WordTranslationForm> = {};
  for (const { code } of EDIT_TRANSLATION_LANGS) {
    const fromWord = w.translations?.[code];
    translations[code] = {
      translation_1: fromWord?.translation_1 ?? (code === 'ru' ? w.translation_1 ?? '' : ''),
      translation_2: fromWord?.translation_2 ?? (code === 'ru' ? w.translation_2 ?? '' : ''),
      translation_3: fromWord?.translation_3 ?? (code === 'ru' ? w.translation_3 ?? '' : ''),
      translation_input_variable:
        fromWord?.translation_input_variable ?? (code === 'ru' ? w.translation_input_variable ?? '' : ''),
      difficult_translation:
        fromWord?.difficult_translation ?? (code === 'ru' ? w.difficult_translation ?? '' : ''),
      info: fromWord?.info ?? (code === 'ru' ? w.info ?? '' : ''),
    };
  }

  return {
    word: w.word ?? '',
    translation_1: w.translation_1 ?? '',
    translation_2: w.translation_2 ?? '',
    translation_3: w.translation_3 ?? '',
    translation_input_variable: w.translation_input_variable ?? '',
    difficult_translation: w.difficult_translation ?? '',
    translations,
    info: w.info ?? '',
    sound_url: w.sound_url ?? '',
    level: w.level ?? null,
    max_level: w.max_level ?? null,
    type: w.type ?? '',
    gender: w.gender ?? '',
    is_phrase: !!w.is_phrase,
  };
}

function mapProgress(p: Record<string, unknown> | null | undefined): ProgressForm {
  if (!p) return { ...EMPTY_PROGRESS };
  return {
    id: p.id != null ? Number(p.id) : null,
    attempts: Number(p.attempts ?? 0),
    correct_attempts: clamp02(Number(p.correct_attempts ?? 0)),
    attempts_revert: Number(p.attempts_revert ?? 0),
    correct_attempts_revert: clamp02(Number(p.correct_attempts_revert ?? 0)),
    statistic_attempts: Number(p.statistic_attempts ?? 0),
    statistic_attempts_revert: Number(p.statistic_attempts_revert ?? 0),
    statistic_correct_attempts: Number(p.statistic_correct_attempts ?? 0),
    statistic_correct_attempts_revert: Number(p.statistic_correct_attempts_revert ?? 0),
    mode_education: Number(!!p.mode_education),
    mode_education_revert: Number(!!p.mode_education_revert),
    easy_education: Number(!!p.easy_education),
    attempts_all: Number(p.attempts_all ?? 0),
    correct_attempts_all: Number(p.correct_attempts_all ?? 0),
    easy_correct: Number(!!p.easy_correct),
    easy_correct_revert: Number(!!p.easy_correct_revert),
    cooldown_tier: clamp02(Number(p.cooldown_tier ?? 0)),
    cooldown_tier_revert: clamp02(Number(p.cooldown_tier_revert ?? 0)),
    last_shown: toLocalDt(p.last_shown as string | null),
    last_shown_revert: toLocalDt(p.last_shown_revert as string | null),
  };
}

function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid w-full content-start items-stretch gap-1.5 self-start ${className}`}>
      <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
      {hint && (
        <span className="text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">{hint}</span>
      )}
    </label>
  );
}

const inputClass = 'w-full';
const dropdownClass = 'lbp-dropdown-sm w-full';

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'sky' | 'zinc' | 'emerald' | 'amber';
  children: ReactNode;
}) {
  const tones = {
    sky: 'border-sky-200/80 from-sky-50/90 to-white dark:border-sky-900 dark:from-sky-950/50 dark:to-zinc-900',
    zinc: 'border-zinc-200 from-zinc-50/80 to-white dark:border-zinc-700 dark:from-zinc-900/80 dark:to-zinc-950',
    emerald:
      'border-emerald-200/80 from-emerald-50/80 to-white dark:border-emerald-900 dark:from-emerald-950/40 dark:to-zinc-900',
    amber:
      'border-amber-200/80 from-amber-50/70 to-white dark:border-amber-900 dark:from-amber-950/35 dark:to-zinc-900',
  } as const;
  const titles = {
    sky: 'text-sky-700 dark:text-sky-300',
    zinc: 'text-zinc-600 dark:text-zinc-300',
    emerald: 'text-emerald-800 dark:text-emerald-300',
    amber: 'text-amber-800 dark:text-amber-300',
  } as const;

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${tones[tone]}`}>
      <div className={`mb-3 text-xs font-bold tracking-wider uppercase ${titles[tone]}`}>{title}</div>
      {children}
    </div>
  );
}

export function WordEditor({
  dictionaryId,
  word,
  onClose,
}: {
  dictionaryId: number;
  word: DictWord;
  onClose: () => void;
}) {
  const t = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const qc = useQueryClient();
  const [form, setForm] = useState<WordForm>(() => wordToForm(word));
  const [progress, setProgress] = useState<ProgressForm>({ ...EMPTY_PROGRESS });
  const [userDisplay, setUserDisplay] = useState('');
  const [wordStatus, setWordStatus] = useState<string | null>(null);
  const [wordError, setWordError] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);

  const yesNo = useMemo(
    () => [
      { label: t('no'), value: false },
      { label: t('yes'), value: true },
    ],
    [t],
  );

  const progressQuery = useQuery({
    queryKey: ['admin-word-progress', word.id],
    queryFn: () =>
      clientApi<{
        progress: Record<string, unknown> | null;
        user_display?: string;
        word?: DictWord;
      }>(`/admin/words/${word.id}/progress`),
  });

  useEffect(() => {
    if (!progressQuery.data) return;
    const remote = progressQuery.data.word;
    if (remote) setForm(wordToForm({ ...word, ...remote }));
    setProgress(mapProgress(progressQuery.data.progress));
    setUserDisplay(progressQuery.data.user_display ?? '');
  }, [progressQuery.data, word]);

  const saveWordMutation = useMutation({
    mutationFn: () =>
      clientApi(`/admin/words/${word.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          word: form.word,
          translation_1: form.translation_1,
          translation_2: form.translation_2 || null,
          translation_3: form.translation_3 || null,
          translation_input_variable: form.translation_input_variable || null,
          difficult_translation: form.difficult_translation || null,
          translations: form.translations,
          info: form.info || null,
          sound_url: form.sound_url || null,
          level: form.level,
          max_level: form.max_level,
          type: form.type || null,
          gender: form.gender || null,
          is_phrase: form.is_phrase,
        }),
      }),
    onSuccess: async () => {
      setWordStatus(t('msgWordSaved'));
      setWordError(null);
      await qc.invalidateQueries({ queryKey: ['dictionary-words', dictionaryId] });
      await qc.invalidateQueries({ queryKey: ['admin-word-progress', word.id] });
    },
    onError: (e: Error) => {
      setWordError(e.message || t('errSaveWord'));
      setWordStatus(null);
    },
  });

  const saveProgressMutation = useMutation({
    mutationFn: () =>
      clientApi(`/admin/words/${word.id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({
          attempts: Number(progress.attempts) || 0,
          correct_attempts: clamp02(Number(progress.correct_attempts) || 0),
          attempts_revert: Number(progress.attempts_revert) || 0,
          correct_attempts_revert: clamp02(Number(progress.correct_attempts_revert) || 0),
          statistic_attempts: Number(progress.statistic_attempts) || 0,
          statistic_attempts_revert: Number(progress.statistic_attempts_revert) || 0,
          statistic_correct_attempts: Number(progress.statistic_correct_attempts) || 0,
          statistic_correct_attempts_revert: Number(progress.statistic_correct_attempts_revert) || 0,
          mode_education: !!Number(progress.mode_education),
          mode_education_revert: !!Number(progress.mode_education_revert),
          easy_education: !!Number(progress.easy_education),
          attempts_all: Number(progress.attempts_all) || 0,
          correct_attempts_all: Number(progress.correct_attempts_all) || 0,
          easy_correct: !!Number(progress.easy_correct),
          easy_correct_revert: !!Number(progress.easy_correct_revert),
          cooldown_tier: clamp02(Number(progress.cooldown_tier) || 0),
          cooldown_tier_revert: clamp02(Number(progress.cooldown_tier_revert) || 0),
          last_shown: progress.last_shown ? progress.last_shown.replace('T', ' ') : null,
          last_shown_revert: progress.last_shown_revert
            ? progress.last_shown_revert.replace('T', ' ')
            : null,
        }),
      }),
    onSuccess: async () => {
      setProgressStatus(t('msgProgressSaved'));
      setProgressError(null);
      await qc.invalidateQueries({ queryKey: ['progress', dictionaryId] });
      await qc.invalidateQueries({ queryKey: ['admin-word-progress', word.id] });
    },
    onError: (e: Error) => {
      setProgressError(e.message || t('errSaveProgress'));
      setProgressStatus(null);
    },
  });

  function setField<K extends keyof WordForm>(name: K, value: WordForm[K]) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function setTranslationField(lang: string, name: keyof WordTranslationForm, value: string) {
    setForm((prev) => ({
      ...prev,
      translations: {
        ...prev.translations,
        [lang]: {
          ...(prev.translations[lang] ?? {
            translation_1: '',
            translation_2: '',
            translation_3: '',
            translation_input_variable: '',
            difficult_translation: '',
            info: '',
          }),
          [name]: value,
        },
      },
    }));
  }

  function setProgressField<K extends keyof ProgressForm>(name: K, value: ProgressForm[K]) {
    setProgress((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <Dialog
      header={
        <div className="pr-6">
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t('editWordHeader')}
          </div>
          <div className="mt-0.5 text-sm font-normal text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">{word.word}</span>
            <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
            <span>#{word.id}</span>
          </div>
        </div>
      }
      visible
      onHide={onClose}
      modal
      dismissableMask
      blockScroll
      draggable={false}
      resizable={false}
      style={{ width: 'min(720px, 96vw)' }}
      breakpoints={{ '768px': '96vw' }}
      contentClassName="!p-0"
      onClick={(e) => e.stopPropagation()}
    >
      <TabView>
        <TabPanel header={t('tabWord')}>
          <div className="grid gap-4 px-1 pb-2 pt-1">
            <Section title={t('sectionBasics')} tone="sky">
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <Field label={t('word')} className="sm:col-span-2">
                  <InputText
                    value={form.word}
                    onChange={(e) => setField('word', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                {EDIT_TRANSLATION_LANGS.map(({ code, label }) => {
                  const translation = form.translations[code];
                  return (
                    <div
                      key={code}
                      className="grid gap-3 rounded-lg border border-sky-100 bg-white/70 p-3 dark:border-sky-900 dark:bg-zinc-950/30 sm:col-span-2 sm:grid-cols-2"
                    >
                      <div className="text-xs font-bold tracking-wider text-sky-700 uppercase dark:text-sky-300 sm:col-span-2">
                        {label}
                      </div>
                      <Field label={`${t('translation1')} ${label}`}>
                        <InputText
                          value={translation?.translation_1 ?? ''}
                          onChange={(e) => {
                            setTranslationField(code, 'translation_1', e.target.value);
                            if (code === 'ru') setField('translation_1', e.target.value);
                          }}
                          className={inputClass}
                        />
                      </Field>
                      <Field label={`${t('translation2')} ${label}`}>
                        <InputText
                          value={translation?.translation_2 ?? ''}
                          onChange={(e) => {
                            setTranslationField(code, 'translation_2', e.target.value);
                            if (code === 'ru') setField('translation_2', e.target.value);
                          }}
                          className={inputClass}
                        />
                      </Field>
                      <Field label={`${t('translation3')} ${label}`}>
                        <InputText
                          value={translation?.translation_3 ?? ''}
                          onChange={(e) => {
                            setTranslationField(code, 'translation_3', e.target.value);
                            if (code === 'ru') setField('translation_3', e.target.value);
                          }}
                          className={inputClass}
                        />
                      </Field>
                      <Field label={`${t('extraVariants')} ${label}`} hint={t('extraVariantsHint')}>
                        <InputText
                          value={translation?.translation_input_variable ?? ''}
                          onChange={(e) => {
                            setTranslationField(code, 'translation_input_variable', e.target.value);
                            if (code === 'ru') setField('translation_input_variable', e.target.value);
                          }}
                          placeholder={t('extraVariantsPlaceholder')}
                          className={inputClass}
                        />
                      </Field>
                      <Field label={`${t('difficultTranslation')} ${label}`} className="sm:col-span-2">
                        <InputText
                          value={translation?.difficult_translation ?? ''}
                          onChange={(e) => {
                            setTranslationField(code, 'difficult_translation', e.target.value);
                            if (code === 'ru') setField('difficult_translation', e.target.value);
                          }}
                          className={inputClass}
                        />
                      </Field>
                      <Field
                        label={`${t('hintHtml')} ${label}`}
                        hint={t('hintHtmlHint')}
                        className="sm:col-span-2"
                      >
                        <HtmlCodeEditor
                          value={translation?.info ?? ''}
                          onChange={(value) => {
                            setTranslationField(code, 'info', value);
                            if (code === 'ru') setField('info', value);
                          }}
                        />
                      </Field>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title={t('sectionMeta')} tone="zinc">
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <Field label={t('soundUrl')} className="sm:col-span-2">
                  <InputText
                    value={form.sound_url}
                    onChange={(e) => setField('sound_url', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('levelLabel')}>
                  <InputNumber
                    value={form.level}
                    onValueChange={(e) => setField('level', e.value ?? null)}
                    min={1}
                    max={6}
                    showButtons
                    className={inputClass}
                    inputClassName="w-full"
                  />
                </Field>
                <Field label={t('maxLevel')}>
                  <InputNumber
                    value={form.max_level}
                    onValueChange={(e) => setField('max_level', e.value ?? null)}
                    min={1}
                    max={6}
                    showButtons
                    className={inputClass}
                    inputClassName="w-full"
                  />
                </Field>
                <Field label={t('type')}>
                  <InputText
                    value={form.type}
                    onChange={(e) => setField('type', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('gender')}>
                  <InputText
                    value={form.gender}
                    onChange={(e) => setField('gender', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('phrase')}>
                  <Dropdown
                    value={form.is_phrase}
                    options={yesNo}
                    onChange={(e) => setField('is_phrase', !!e.value)}
                    className={dropdownClass}
                    {...dropdownPortalProps}
                  />
                </Field>
              </div>
            </Section>

            {(wordStatus || wordError) && (
              <Message
                severity={wordError ? 'error' : 'success'}
                text={wordError || wordStatus || ''}
                className="w-full"
              />
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <Button label={tCommon('close')} text severity="secondary" onClick={onClose} />
              <Button
                label={t('saveWord')}
                icon="pi pi-check"
                loading={saveWordMutation.isPending}
                onClick={() => saveWordMutation.mutate()}
              />
            </div>
          </div>
        </TabPanel>

        <TabPanel header={t('tabProgress')}>
          <div className="grid gap-4 px-1 pb-2 pt-1">
            <Section title={t('sectionCurrentUser')} tone="emerald">
              <p className="m-0 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {userDisplay || '—'}
                </span>
                <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-100">{word.word}</span>
                <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  dict_word_id: {word.id}
                </span>
                {progress.id != null && (
                  <>
                    <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
                    <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      progress #{progress.id}
                    </span>
                  </>
                )}
              </p>
              {progressQuery.isLoading && (
                <p className="mt-2 mb-0 text-xs text-zinc-400">{t('loadingProgress')}</p>
              )}
            </Section>

            <Section title={t('sectionLearning')} tone="amber">
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <Field label="correct_attempts">
                  <Dropdown
                    value={progress.correct_attempts}
                    options={OPT_02}
                    onChange={(e) => setProgressField('correct_attempts', e.value)}
                    className={dropdownClass}
                    {...dropdownPortalProps}
                  />
                </Field>
                <Field label="correct_attempts_revert">
                  <Dropdown
                    value={progress.correct_attempts_revert}
                    options={OPT_02}
                    onChange={(e) => setProgressField('correct_attempts_revert', e.value)}
                    className={dropdownClass}
                    {...dropdownPortalProps}
                  />
                </Field>
                <Field label="attempts">
                  <InputNumber
                    value={progress.attempts}
                    onValueChange={(e) => setProgressField('attempts', e.value ?? 0)}
                    min={0}
                    className={inputClass}
                    inputClassName="w-full"
                  />
                </Field>
                <Field label="attempts_revert">
                  <InputNumber
                    value={progress.attempts_revert}
                    onValueChange={(e) => setProgressField('attempts_revert', e.value ?? 0)}
                    min={0}
                    className={inputClass}
                    inputClassName="w-full"
                  />
                </Field>
                <Field label="attempts_all">
                  <InputNumber
                    value={progress.attempts_all}
                    onValueChange={(e) => setProgressField('attempts_all', e.value ?? 0)}
                    min={0}
                    className={inputClass}
                    inputClassName="w-full"
                  />
                </Field>
                <Field label="correct_attempts_all">
                  <InputNumber
                    value={progress.correct_attempts_all}
                    onValueChange={(e) => setProgressField('correct_attempts_all', e.value ?? 0)}
                    min={0}
                    className={inputClass}
                    inputClassName="w-full"
                  />
                </Field>
              </div>
            </Section>

            <Section title={t('sectionModes')} tone="zinc">
              <div className="grid items-start gap-3 sm:grid-cols-2">
                {(
                  [
                    ['mode_education', OPT_01],
                    ['mode_education_revert', OPT_01],
                    ['easy_education', OPT_01],
                    ['easy_correct', OPT_01],
                    ['easy_correct_revert', OPT_01],
                    ['cooldown_tier', OPT_02],
                    ['cooldown_tier_revert', OPT_02],
                  ] as const
                ).map(([key, opts]) => (
                  <Field key={key} label={key}>
                    <Dropdown
                      value={progress[key]}
                      options={[...opts]}
                      onChange={(e) => setProgressField(key, e.value)}
                      className={dropdownClass}
                      {...dropdownPortalProps}
                    />
                  </Field>
                ))}
              </div>
            </Section>

            <Section title={t('sectionStats')} tone="zinc">
              <div className="grid items-start gap-3 sm:grid-cols-2">
                {(
                  [
                    'statistic_attempts',
                    'statistic_correct_attempts',
                    'statistic_attempts_revert',
                    'statistic_correct_attempts_revert',
                  ] as const
                ).map((key) => (
                  <Field key={key} label={key}>
                    <InputNumber
                      value={progress[key]}
                      onValueChange={(e) => setProgressField(key, e.value ?? 0)}
                      min={0}
                      className={inputClass}
                      inputClassName="w-full"
                    />
                  </Field>
                ))}
                <Field label="last_shown">
                  <InputText
                    type="datetime-local"
                    value={progress.last_shown}
                    onChange={(e) => setProgressField('last_shown', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="last_shown_revert">
                  <InputText
                    type="datetime-local"
                    value={progress.last_shown_revert}
                    onChange={(e) => setProgressField('last_shown_revert', e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </Section>

            {(progressStatus || progressError) && (
              <Message
                severity={progressError ? 'error' : 'success'}
                text={progressError || progressStatus || ''}
                className="w-full"
              />
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <Button
                label={t('refreshFromDb')}
                icon="pi pi-refresh"
                outlined
                severity="secondary"
                loading={progressQuery.isFetching}
                onClick={() => progressQuery.refetch()}
              />
              <Button
                label={t('saveProgress')}
                icon="pi pi-save"
                loading={saveProgressMutation.isPending}
                onClick={() => saveProgressMutation.mutate()}
              />
            </div>
          </div>
        </TabPanel>
      </TabView>
    </Dialog>
  );
}
