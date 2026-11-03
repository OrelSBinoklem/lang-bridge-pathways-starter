'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useReducer,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { resolveTutorWsUrl, TUTOR_MODEL_OPTIONS, TUTOR_PRICE_USD, tutorTtsPrice } from '@/features/tutor/tutor-config';
import { compactTutorEventForLog, tutorRequestConfig, tutorTtsCatalog, tutorTtsModel, tutorTtsPromotionNote, tutorTtsVoice } from './tutorTts';
import { TutorPcmPlayer, type TtsStreamEvent } from './tutorPcmPlayer';
import { SiteKeeper } from '@/features/tutor-characters/SiteKeeper';
import { GrammarOctopus } from '@/features/tutor-characters/GrammarOctopus';
import { runSiteCharacter, showGrammarCharacter, type SiteCharacterAction } from '@/features/tutor-characters/characterRuntime';
import { HumanTutorAvatar } from '@/features/tutor-avatar/HumanTutorAvatar';
import { getHumanAvatarSelection } from '@/features/tutor-avatar/avatar-selection';
import { clientApi } from '@/lib/client-api';
import { ApiError } from '@/lib/api';
import { notifyCreditsChanged } from '@/lib/credit-refresh';
import { getLessonContext, getServerLessonContext, subscribeLessonContext, getLessonTutorSlot, getServerLessonTutorSlot } from '@/features/tutor/lessonContextBridge';
import styles from '@/features/tutor/floating-tutor-assistant.module.css';
import { SnapshotDiffPair } from '@/features/tutor/SnapshotDiff';
import { expandEscapedNewlines } from '@/features/tutor/textDiff';
import { TutorVoiceControls } from '@/features/tutor/TutorVoiceControls';
import { complexQuestionEffort, tutorReasoningEfforts, type TutorVoiceMode } from '@/features/tutor/voiceTurn';
import { idleTutorActivity, tutorActivityLabel, tutorActivityReducer } from '@/features/tutor/tutorActivity';
import { TutorReconnect } from './tutorReconnect';
import { TutorCostPanel } from './TutorCostPanel';
import { TutorSettingsDialog } from './TutorSettingsDialog';
import { estimateTtsVolume } from './ttsCostVolume';
import { estimateDialogueCost, priceDialogueMemory, type DialogueCostInput, type DialogueMemoryInput } from './dialogueCost';
import { BROWSER_SPEECH_MODEL, BROWSER_SPEECH_LANGUAGES, BrowserSpeechCapture, browserSpeechSupported, subscribeBrowserSpeech, noBrowserSpeechOnServer } from './browserSpeech';
import { useTutorPresets } from './useTutorPresets';
import { TutorPresetPicker } from './TutorPresetPicker';
import { estimatePreset, presetCommissionPercent, type TutorPresetData } from './tutorPresets';
import { browserVoiceLanguages, subscribeBrowserVoices, noBrowserVoices, speakBrowserText } from './browserTts';
import { ChatTour } from '@/features/home-tour/ChatTour';

type Status = 'idle' | 'connecting' | 'ready' | 'closed' | 'error';
type Role = 'system' | 'user' | 'assistant';
type ChatMessage = { id: string; role: Role; text: string; metadata?: Record<string, unknown> };
type LogRow = { id: string; ts: string; direction: 'in' | 'out' | 'system'; text: string };
type TutorConversationSummary = {
  id: number;
  title?: string;
  status?: string;
  summary?: string | null;
  messages_count?: number | null;
  updated_at?: string | null;
};
type TutorStoredMessage = {
  id: number;
  role: Role | 'tool';
  text?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};
type TutorImportantNote = {
  id?: number;
  category?: string;
  key?: string;
  content?: string;
  importance?: number;
  last_seen_at?: string | null;
};
type TutorDailySummary = {
  date?: string;
  conversations_count?: number;
  messages_count?: number;
  summary?: string | null;
  conversations?: Array<{
    id?: number;
    title?: string;
    summary?: string | null;
    messages_count?: number | null;
    updated_at?: string | null;
  }>;
};
type TutorMemoryOverview = {
  important_notes?: TutorImportantNote[];
  notes_total?: number;
  daily_summaries?: TutorDailySummary[];
  daily_summaries_status?: string;
};
type DebugSnapshot = {
  capturedAt?: string;
  currentPage?: string | null;
  lessonContext?: Record<string, unknown> | null;
  tutorVoice?: { voice?: string; gender?: string; russian_self_reference?: string };
  contextSummary?: string;
  importantNotes?: TutorImportantNote[];
  contextStats?: Record<string, unknown> | null;
  promptBuilder?: { source?: string; text?: string };
  routeGuide?: string;
  recentContext?: string[];
  recentContextSource?: string;
  recentMcpInteractions?: Array<Record<string, unknown>>;
  recentAgentIterations?: Array<Record<string, unknown>>;
  promptCacheStats?: Record<string, unknown> | null;
  promptCacheByIteration?: Array<Record<string, unknown>>;
};
type ContextBreakdownPart = {
  key?: string;
  label?: string;
  chars?: number;
  tokens?: number;
};
type ContextStats = {
  context_window_tokens?: number;
  estimated_tokens?: number;
  fill_percent?: number;
  chars?: number;
  breakdown?: ContextBreakdownPart[];
  compression_runs?: Array<Record<string, unknown>>;
  note?: string;
};

type TutorAction = { type: 'navigate'; to: string; title?: string };
type ClientApiAction = {
  type: 'client_api';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  body?: Record<string, unknown> | null;
  description?: string;
};
type GrammarHighlightSelector = {
  selector: string;
  textStartsWith?: string;
};
type GrammarHighlightAction = {
  type: 'grammar_table_highlight';
  tableKey: string;
  tableId?: number | string;
  target: string;
  labelRu?: string;
  durationMs?: number;
  color?: string;
  selectors: GrammarHighlightSelector[];
};
type GrammarLessonStep = GrammarHighlightAction & {
  startAfterMs?: number;
};
type GrammarLessonAction = {
  type: 'grammar_lesson_present';
  tableKeys: string[];
  tableIds: Array<number | string>;
  focusOnlyMultiple?: boolean;
  restoreAfterMs?: number;
  steps: GrammarLessonStep[];
};
type GrammarTableReadAction = {
  type: 'grammar_table_read';
  tableKey: string;
  tableId?: number | string;
  title?: string;
  maxChars?: number;
};
type GrammarTableHintAction = {
  type: 'grammar_table_hint';
  tableKey: string;
  tableId?: number | string;
  hintId?: number | string;
  title?: string;
  maxChars?: number;
};
type SiteMenuActivateAction = {
  type: 'site_menu_activate';
  action: string;
  value?: string;
};
type VerbSearchOpenAction = {
  type: 'verb_search_open';
  query: string;
};
type VerbFormHighlightAction = {
  type: 'verb_form_highlight';
  tense: 'past' | 'present' | 'future';
  person: '1sg' | '2sg' | '3' | '1pl' | '2pl';
  table?: 'generated' | 'reference' | 'any';
  durationMs?: number;
};
type TutorConversationResponse = {
  data: {
    id?: number;
    title?: string;
    conversation?: {
      id: number;
      title?: string;
    };
  };
};
type TutorConversationListResponse = { data: TutorConversationSummary[] };
type TutorMemoryResponse = {
  data?: {
    important_notes?: TutorImportantNote[];
  };
};
type TutorMemoryOverviewResponse = {
  data?: TutorMemoryOverview;
};
type TutorConversationMessagesResponse = {
  data: {
    conversation: TutorConversationSummary;
    pagination?: {
      limit?: number;
      has_more?: boolean;
      before_id?: number | null;
    };
    messages: TutorStoredMessage[];
  };
};
type TutorEvent =
  | { type: 'credits.changed' }
  | TtsStreamEvent
  | { type: 'session.ready'; clientId: string; capabilities?: string[]; tutorModel?: string }
  | { type: 'conversation.ready'; conversationId: number }
  | { type: 'assistant.message'; text: string; metadata?: Record<string, unknown> }
  | { type: 'tutor.thinking'; status: 'started' | 'finished' }
  | {
      type: 'debug.snapshot';
      ok: boolean;
      capturedAt?: string;
      currentPage?: string | null;
      lessonContext?: Record<string, unknown> | null;
      tutorVoice?: { voice?: string; gender?: string; russian_self_reference?: string };
      contextSummary?: string;
      importantNotes?: TutorImportantNote[];
      contextStats?: Record<string, unknown> | null;
      promptBuilder?: { source?: string; text?: string };
      routeGuide?: string;
      recentContext?: string[];
      recentContextSource?: string;
      recentMcpInteractions?: Array<Record<string, unknown>>;
      recentAgentIterations?: Array<Record<string, unknown>>;
      promptCacheStats?: Record<string, unknown> | null;
      promptCacheByIteration?: Array<Record<string, unknown>>;
      error?: { message?: string };
    }
  | {
      type: 'tts.audio';
      playbackId: string;
      ok: boolean;
      audio: string;
      mimeType?: string | null;
      error?: { code?: string; message?: string } | null;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'transcription.result';
      ok: boolean;
      text: string;
      error?: { code?: string; message?: string } | null;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'ui.command';
      commandId: string;
      action:
        | TutorAction
        | ClientApiAction
        | GrammarHighlightAction
        | GrammarLessonAction
        | GrammarTableReadAction
        | GrammarTableHintAction
        | SiteMenuActivateAction
        | VerbSearchOpenAction
        | VerbFormHighlightAction
        | SiteCharacterAction;
    }
  | { type: 'error'; message: string };

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 0);
}

function getRecentContextLines(messages: ChatMessage[], limit = 10) {
  return messages
    .slice(-limit)
    .map((message) => `${message.role}: ${message.text.slice(0, 4000)}`);
}

function getPromptCachePercent(snapshot?: DebugSnapshot) {
  const value = snapshot?.promptCacheStats?.cached_input_percent;
  return typeof value === 'number' ? `${value.toFixed(1)}% cached` : 'no cache data';
}

const SNAPSHOT_COLORS = ['#2563eb', '#ea580c', '#059669', '#ca8a04', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#64748b', '#b45309'];
const CONTEXT_PART_COLORS: Record<string, string> = {
  system_rules: '#2563eb',
  route_guide: '#f97316',
  session_context: '#06b6d4',
  summary: '#8b5cf6',
  memory: '#64748b',
  messages: '#16a34a',
  request_format: '#eab308',
};

function formatTokenCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatSnapshotCost(value: number | null) {
  if (value == null) return 'n/a';
  if (value === 0) return '$0.0000';
  if (value < 0.0001) return '<$0.0001';
  return `$${value.toFixed(4)}`;
}

function formatSnapshotInterval(milliseconds: number | null) {
  if (milliseconds == null || milliseconds < 0) return 'нет пары';
  if (milliseconds < 60_000) return `${Math.max(1, Math.round(milliseconds / 1000))} c`;
  if (milliseconds < 3_600_000) return `${Math.round(milliseconds / 60_000)} мин`;
  return `${(milliseconds / 3_600_000).toFixed(1)} ч`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

type SnapshotCharge = {
  id: string;
  model: string | null;
  usage: Record<string, unknown> | null;
  kind: 'tutor' | 'summary';
};
type SnapshotCost = {
  total: number | null;
  knownCalls: number;
  unknownCalls: number;
  chargeIds: Set<string>;
};

function snapshotCharges(snapshot: DebugSnapshot | null) {
  const agentCharges = (snapshot?.recentAgentIterations || []).flatMap((iteration, index) => {
    const response = asRecord(iteration.model_response);
    const metadata = asRecord(response?.metadata);
    const usage = asRecord(metadata?.usage);
    const model = typeof metadata?.model === 'string'
      ? metadata.model
      : typeof asRecord(iteration.model_config)?.tutorModel === 'string'
        ? String(asRecord(iteration.model_config)?.tutorModel)
        : null;
    const id = String(iteration.id || iteration.createdAt || `agent-${index}`);
    return usage ? [{ id: `tutor-${id}`, model, usage, kind: 'tutor' as const }] : [];
  });
  const summaryCharges = (getContextStats(snapshot).compression_runs || []).flatMap((run, index) => {
    const usage = asRecord(run.usage);
    const model = typeof run.model === 'string' ? run.model : null;
    const id = String(run.id || run.createdAt || `summary-${index}`);
    return usage ? [{ id: `summary-${id}`, model, usage, kind: 'summary' as const }] : [];
  });
  return [...agentCharges, ...summaryCharges];
}

function calculateChargeCost(charge: SnapshotCharge) {
  if (!charge.model) return null;
  const rate = TUTOR_PRICE_USD.textPerMillionTokens[charge.model as keyof typeof TUTOR_PRICE_USD.textPerMillionTokens];
  if (!rate) return null;

  const inputTokens = asFiniteNumber(charge.usage?.input_tokens) ?? 0;
  const outputTokens = asFiniteNumber(charge.usage?.output_tokens) ?? 0;
  const inputDetails = asRecord(charge.usage?.input_tokens_details);
  const cachedTokens = Math.min(inputTokens, asFiniteNumber(inputDetails?.cached_tokens) ?? 0);
  const uncachedTokens = Math.max(0, inputTokens - cachedTokens);
  const cacheWriteTokens = Math.min(uncachedTokens, Math.max(0, asFiniteNumber(inputDetails?.cache_write_tokens) ?? 0));
  const cacheWriteRate = 'cacheWrite' in rate ? rate.cacheWrite : rate.input;
  return ((uncachedTokens - cacheWriteTokens) * rate.input + cacheWriteTokens * cacheWriteRate + cachedTokens * rate.cachedInput + outputTokens * rate.output) / 1_000_000;
}

function calculateSnapshotCost(charges: SnapshotCharge[]): SnapshotCost {
  const uniqueCharges = new Map(charges.map((charge) => [charge.id, charge]));
  let total = 0;
  let knownCalls = 0;
  let unknownCalls = 0;
  uniqueCharges.forEach((charge) => {
    const cost = calculateChargeCost(charge);
    if (cost == null) {
      unknownCalls += 1;
      return;
    }
    total += cost;
    knownCalls += 1;
  });
  return {
    total: unknownCalls && !knownCalls ? null : total,
    knownCalls,
    unknownCalls,
    chargeIds: new Set(uniqueCharges.keys()),
  };
}

function getSnapshotCostDelta(current: DebugSnapshot | null, previous: DebugSnapshot | null) {
  const previousChargeIds = calculateSnapshotCost(snapshotCharges(previous)).chargeIds;
  const newCharges = snapshotCharges(current).filter((charge) => !previousChargeIds.has(charge.id));
  return calculateSnapshotCost(newCharges);
}

function getSnapshotInterval(current: DebugSnapshot | null, previous: DebugSnapshot | null) {
  const currentAt = current?.capturedAt ? Date.parse(current.capturedAt) : NaN;
  const previousAt = previous?.capturedAt ? Date.parse(previous.capturedAt) : NaN;
  return Number.isFinite(currentAt) && Number.isFinite(previousAt) ? Math.max(0, currentAt - previousAt) : null;
}

function getContextStats(snapshot?: DebugSnapshot | null) {
  return (snapshot?.contextStats || {}) as ContextStats;
}

function ContextSnapshotWindow({
  snapshots,
  selectedIndex,
  onSelect,
}: {
  snapshots: DebugSnapshot[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const selectedSnapshot = snapshots[selectedIndex] || null;
  const stats = getContextStats(selectedSnapshot);
  const capacity = typeof stats.context_window_tokens === 'number' ? stats.context_window_tokens : 128_000;
  const used = typeof stats.estimated_tokens === 'number' ? stats.estimated_tokens : 0;
  const parts = (stats.breakdown || []).filter((part) => typeof part.tokens === 'number' && part.tokens > 0);
  const knownParts = parts.reduce((total, part) => total + (part.tokens || 0), 0);
  const freeTokens = Math.max(capacity - used, 0);
  const previousSnapshot = snapshots[selectedIndex + 1] || null;
  const selectedCost = getSnapshotCostDelta(selectedSnapshot, previousSnapshot);
  const selectedInterval = getSnapshotInterval(selectedSnapshot, previousSnapshot);
  const hourlyCost =
    selectedCost.total != null && selectedInterval != null && selectedInterval > 0
      ? (selectedCost.total / selectedInterval) * 3_600_000
      : null;

  return (
    <section className={styles.contextWindow} aria-label="Контекст модели по снапшотам">
      <header className={styles.contextWindowHeader}>
        <div>
          <h4>Контекст модели</h4>
          <span>{stats.note || 'Оценка следующего запроса модели.'}</span>
        </div>
        <strong>
          {formatTokenCount(used)} / {formatTokenCount(capacity)} ({((used / Math.max(capacity, 1)) * 100).toFixed(1)}%)
        </strong>
      </header>

      <div className={styles.contextWindowBar} aria-label={`Занято ${used} из ${capacity} токенов`}>
        {parts.map((part) => (
          <span
            key={part.key || part.label}
            title={`${part.label || 'Контекст'}: ${formatTokenCount(part.tokens || 0)} токенов`}
            style={{
              width: `${Math.min(100, ((part.tokens || 0) / Math.max(capacity, 1)) * 100)}%`,
              backgroundColor: CONTEXT_PART_COLORS[part.key || ''] || '#64748b',
            }}
          />
        ))}
        {freeTokens > 0 && <span className={styles.contextWindowFree} style={{ width: `${(freeTokens / capacity) * 100}%` }} />}
      </div>

      <div className={styles.contextWindowLegend}>
        {parts.map((part) => {
          const tokens = part.tokens || 0;
          return (
            <div key={part.key || part.label}>
              <i style={{ backgroundColor: CONTEXT_PART_COLORS[part.key || ''] || '#64748b' }} />
              <span>{part.label || 'Контекст'}</span>
              <b>{formatTokenCount(tokens)}</b>
              <small>{((tokens / Math.max(knownParts, 1)) * 100).toFixed(1)}%</small>
            </div>
          );
        })}
        <div>
          <i className={styles.contextWindowFreeDot} />
          <span>Свободно</span>
          <b>{formatTokenCount(freeTokens)}</b>
          <small>{((freeTokens / Math.max(capacity, 1)) * 100).toFixed(1)}%</small>
        </div>
      </div>

      <div className={styles.contextSnapshotHistory} aria-label="История снапшотов">
        {snapshots.map((snapshot, index) => {
          const snapshotStats = getContextStats(snapshot);
          const snapshotCapacity = typeof snapshotStats.context_window_tokens === 'number' ? snapshotStats.context_window_tokens : capacity;
          const snapshotUsed = typeof snapshotStats.estimated_tokens === 'number' ? snapshotStats.estimated_tokens : 0;
          const snapshotCost = getSnapshotCostDelta(snapshot, snapshots[index + 1] || null);
          const color = SNAPSHOT_COLORS[index % SNAPSHOT_COLORS.length];
          return (
            <button
              key={`${index}-${snapshotUsed}-${snapshotStats.chars || ''}`}
              type="button"
              className={index === selectedIndex ? styles.contextSnapshotActive : ''}
              aria-pressed={index === selectedIndex}
              onClick={() => onSelect(index)}
              style={{ '--snapshot-color': color } as CSSProperties}
              title={index === 0 ? 'Новый снапшот' : `Снапшот ${index + 1}`}
            >
              <span>#{index + 1}</span>
              <b>{formatTokenCount(snapshotUsed)}</b>
              <small>{formatSnapshotCost(snapshotCost.total)}</small>
              <i>
                <em style={{ width: `${Math.min(100, (snapshotUsed / Math.max(snapshotCapacity, 1)) * 100)}%` }} />
              </i>
            </button>
          );
        })}
        {!snapshots.length && <span className={styles.contextSnapshotEmpty}>Нажми refresh, чтобы получить первый снапшот.</span>}
      </div>

      <div className={styles.contextSnapshotCost}>
        <div>
          <strong>Токены за интервал</strong>
          <span>
            {previousSnapshot ? `между #${selectedIndex + 2} и #${selectedIndex + 1}` : 'в окне первого снапшота'}
          </span>
        </div>
        <b>{formatSnapshotCost(selectedCost.total)}</b>
        <span>{formatSnapshotInterval(selectedInterval)}</span>
        <b>{hourlyCost == null ? 'n/a / ч' : `${formatSnapshotCost(hourlyCost)} / ч`}</b>
        <small>
          {selectedCost.unknownCalls
            ? `${selectedCost.unknownCalls} выз. без цены`
            : `${selectedCost.knownCalls} выз. · input/cache/output`}
        </small>
      </div>
    </section>
  );
}

function normalizeNavigationPath(value: string) {
  try {
    return new URL(value, window.location.origin).pathname;
  } catch {
    return String(value || '').split('?')[0] || '/';
  }
}

function waitForNavigationResult(requestedTo: string, previousPath: string) {
  const requestedPath = normalizeNavigationPath(requestedTo);
  const startedAt = Date.now();

  return new Promise<{ currentPath: string; redirected: boolean }>((resolve) => {
    const check = () => {
      const currentPath = window.location.pathname;
      const changed = currentPath !== previousPath;
      const reachedRequestedPath = currentPath === requestedPath;
      const timedOut = Date.now() - startedAt > 1400;

      if (reachedRequestedPath || (changed && timedOut) || timedOut) {
        resolve({
          currentPath,
          redirected: currentPath !== requestedPath,
        });
        return;
      }

      window.setTimeout(check, 80);
    };

    window.setTimeout(check, 80);
  });
}

function DebugCodeBlock({ value, language = 'text' }: { value: string; language?: 'json' | 'text' }) {
  return (
    <div className={styles.debugCodeBlock}>
      <CodeMirror
        value={value}
        height="100%"
        theme={oneDark}
        extensions={[...(language === 'json' ? [json()] : []), EditorView.lineWrapping]}
        editable={false}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
      />
    </div>
  );
}

function asNumber(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function shortUsd(value: number) {
  return `$${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(value < 1 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '')}`;
}

function transcriptionModelLabel(model: string) {
  if (model === BROWSER_SPEECH_MODEL) return 'В браузере — бесплатно';
  const rate = TUTOR_PRICE_USD.transcriptionPerMinute[
    model as keyof typeof TUTOR_PRICE_USD.transcriptionPerMinute
  ];
  return typeof rate === 'number' ? `${model} · ${shortUsd(rate)}/min` : model;
}

function liveTranscriptionModelLabel(model: string) {
  const rate = TUTOR_PRICE_USD.liveTranscriptionPerMinute[
    model as keyof typeof TUTOR_PRICE_USD.liveTranscriptionPerMinute
  ];
  return typeof rate === 'number' ? `${model} · ${shortUsd(rate)}/min` : model;
}

function textModelLabel(model: string) {
  const rate = TUTOR_PRICE_USD.textPerMillionTokens[
    model as keyof typeof TUTOR_PRICE_USD.textPerMillionTokens
  ];
  return rate ? `${model} · in ${shortUsd(rate.input)} / out ${shortUsd(rate.output)} MTok` : model;
}

function ttsModelLabel(model: string) {
  const rate = tutorTtsPrice(model);
  return rate ? `${model} · in ${shortUsd(rate.input)} / aud ${shortUsd(rate.outputAudio)} MTok` : model;
}

function embeddingModelLabel(model: string) {
  const rate = TUTOR_PRICE_USD.embeddingPerMillionTokens[
    model as keyof typeof TUTOR_PRICE_USD.embeddingPerMillionTokens
  ];
  return rate ? `${model} · ${shortUsd(rate.input)} MTok` : model;
}

function summaryModelLabel(model: string) {
  return model === 'same_as_tutor' ? 'same_as_tutor · as text model' : textModelLabel(model);
}

function cssEscape(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

let queuedGrammarLesson: GrammarLessonAction | null = null;
let grammarLessonTimers: number[] = [];

function clearGrammarLessonTimers() {
  grammarLessonTimers.forEach((timer) => window.clearTimeout(timer));
  grammarLessonTimers = [];
}

function setGrammarPresentation(tableIds: Array<number | string> | null) {
  window.dispatchEvent(
    new CustomEvent('tutor.grammar.presentation', {
      detail: { tableIds: tableIds?.map(String) || null },
    }),
  );
}

function scrollGrammarTable(tableId: number | string) {
  const card = document.getElementById(`table-${tableId}`);
  if (!card) return false;
  card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  return true;
}

/**
 * The grammar gallery unmounts tables that are far off screen (see LazyTableBody), so a table the bot
 * asks about may not exist in the DOM yet. Ask the gallery to mount it (it does so synchronously) and look again.
 */
function findGrammarTableRoot(tableKey: string) {
  const selector = `[data-grammar-table-key="${cssEscape(tableKey)}"]`;
  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) return existing;
  window.dispatchEvent(new CustomEvent('grammar.table.reveal', { detail: { tableKey } }));
  return document.querySelector<HTMLElement>(selector);
}

function runGrammarHighlight(action: GrammarHighlightAction, { scroll = true } = {}) {
  const tableRoot = findGrammarTableRoot(action.tableKey);
  if (!tableRoot) {
    return { matched: 0, reason: 'table_not_found' };
  }

  const matched = new Set<HTMLElement>();
  for (const item of action.selectors || []) {
    // ':scope' means the whole table (querySelectorAll only sees descendants).
    if (item.selector === ':scope') {
      matched.add(tableRoot);
      continue;
    }
    const elements = tableRoot.querySelectorAll<HTMLElement>(item.selector);
    elements.forEach((element) => {
      const text = element.textContent?.trim() || '';
      if (item.textStartsWith && !text.startsWith(item.textStartsWith)) return;
      matched.add(element);
    });
  }

  const durationMs = Math.min(15000, Math.max(1000, Number(action.durationMs || 5000)));
  matched.forEach((element) => {
    element.classList.remove('tutor-grammar-highlight', 'tutor-grammar-highlight-blue');
    if (action.color === 'blue') {
      element.classList.add('tutor-grammar-highlight-blue');
    } else {
      element.classList.add('tutor-grammar-highlight');
    }
    window.setTimeout(() => {
      element.classList.remove('tutor-grammar-highlight', 'tutor-grammar-highlight-blue');
    }, durationMs);
  });

  if (scroll) {
    const first = matched.values().next().value || tableRoot;
    first.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  if (matched.size) showGrammarCharacter({ targets: [...matched], label: action.labelRu || action.tableKey, durationMs });

  return { matched: matched.size, reason: matched.size ? null : 'target_not_found' };
}

function normalizeReadableText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function clipText(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/**
 * Visible text of an element with line breaks between blocks and bars between
 * table cells. Inline elements are joined without a gap, so a word split across
 * highlight spans (e.g. "laim" + "īgs") stays one word. Hidden elements are skipped.
 */
function extractReadableText(root: HTMLElement) {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    if (/^(SCRIPT|STYLE|SVG)$/i.test(element.tagName)) return;

    const display = window.getComputedStyle(element).display;
    if (display === 'none') return;

    const isCell = display === 'table-cell';
    const isBlock = display !== 'inline' && display !== 'contents' && !isCell;
    if (isBlock) parts.push('\n');
    element.childNodes.forEach(walk);
    if (isCell) parts.push(' | ');
    else if (isBlock) parts.push('\n');
  };
  walk(root);

  return parts
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Reads what a grammar table on the page says, for the model to explain it. */
function runGrammarTableRead(action: GrammarTableReadAction) {
  const tableRoot = findGrammarTableRoot(action.tableKey);
  if (!tableRoot) {
    return { matched: 0, reason: 'table_not_found' };
  }

  const maxChars = Math.min(12000, Math.max(500, Number(action.maxChars || 6000)));
  const fullText = extractReadableText(tableRoot);
  if (!fullText) {
    // The card exists but is hidden (e.g. another level filter is active).
    return { matched: 0, reason: 'table_not_visible' };
  }
  showGrammarCharacter({ targets: [tableRoot], label: action.title || action.tableKey, durationMs: 5000 });

  const sections = Array.from(tableRoot.querySelectorAll<HTMLElement>('[data-tutor-target]'))
    .map((element) => ({
      target: element.getAttribute('data-tutor-target') || '',
      text: clipText(normalizeReadableText(element.textContent), 240),
    }))
    .filter((section) => section.target && section.text)
    .slice(0, 60);

  // Real <table>s keep their row/column structure, which plain text loses.
  const tables = Array.from(tableRoot.querySelectorAll('table'))
    .slice(0, 6)
    .map((table) =>
      Array.from(table.rows)
        .slice(0, 40)
        .map((row) =>
          Array.from(row.cells).map((cell) => clipText(normalizeReadableText(cell.textContent), 60)),
        ),
    );

  return {
    matched: 1,
    tableKey: action.tableKey,
    title: action.title || null,
    text: fullText.length > maxChars ? `${fullText.slice(0, maxChars - 1)}…` : fullText,
    truncated: fullText.length > maxChars,
    sections,
    tables,
  };
}

/** Loads the "?" hint document of a table as plain readable text. */
async function runGrammarTableHint(action: GrammarTableHintAction) {
  const hintId = action.hintId ?? action.tableId;
  if (hintId === undefined || hintId === null || hintId === '') {
    return { matched: 0, reason: 'hint_not_defined' };
  }

  const maxChars = Math.min(16000, Math.max(500, Number(action.maxChars || 8000)));
  const isUk = /^uk/i.test(document.documentElement.lang || '');
  const id = encodeURIComponent(String(hintId));
  const urls = isUk
    ? [`/grammar/hints/uk/${id}.html`, `/grammar/hints/${id}.html`]
    : [`/grammar/hints/${id}.html`];

  for (const url of urls) {
    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      continue;
    }
    if (!response.ok) continue;

    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    doc.querySelectorAll('script, style, link').forEach((node) => node.remove());
    // Keep block boundaries readable: line breaks after blocks, bars between cells.
    doc.body.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    doc.body.querySelectorAll('h1, h2, h3, h4, p, li, tr, .example, .note').forEach((node) => {
      node.append('\n');
    });
    doc.body.querySelectorAll('td, th').forEach((node) => {
      node.append(' | ');
    });

    const text = (doc.body.textContent || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();

    return {
      matched: 1,
      tableKey: action.tableKey,
      hintId,
      language: url.includes('/uk/') ? 'uk' : 'ru',
      title: normalizeReadableText(doc.querySelector('h1')?.textContent) || action.title || null,
      text: clipText(text, maxChars),
      truncated: text.length > maxChars,
    };
  }

  return { matched: 0, reason: 'hint_not_found', hintId };
}

function runGrammarLessonPresentation(action: GrammarLessonAction) {
  clearGrammarLessonTimers();
  queuedGrammarLesson = action;
  setGrammarPresentation(action.tableIds);

  // React needs one frame to apply the temporary component/table filter before scrolling.
  grammarLessonTimers.push(window.setTimeout(() => {
    scrollGrammarTable(action.tableIds[0]);
  }, 120));

  return {
    prepared: true,
    tableIds: action.tableIds,
    steps: action.steps.length,
    starts: 'first_tts_playback',
  };
}

function runSiteMenuAction(action: SiteMenuActivateAction) {
  window.dispatchEvent(
    new CustomEvent('tutor.site.menu.activate', {
      detail: { action: action.action, value: action.value },
    }),
  );

  return {
    action: action.action,
    value: action.value || null,
    current_path: window.location.pathname,
  };
}

function runVerbSearchOpen(action: VerbSearchOpenAction) {
  window.dispatchEvent(
    new CustomEvent('tutor.verb.open', {
      detail: { query: action.query },
    }),
  );

  return {
    query: action.query,
    opened: true,
  };
}

function runVerbFormHighlight(action: VerbFormHighlightAction) {
  const tableSelector = action.table && action.table !== 'any'
    ? `[data-verb-table="${cssEscape(action.table)}"]`
    : '';
  const selector = `${tableSelector}[data-verb-tense="${cssEscape(action.tense)}"][data-verb-person="${cssEscape(action.person)}"]`;
  const elements = [...document.querySelectorAll<HTMLElement>(selector)];
  const durationMs = Math.min(15000, Math.max(1000, Number(action.durationMs || 4500)));

  elements.forEach((element) => {
    element.classList.add('tutor-verb-highlight');
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    window.setTimeout(() => element.classList.remove('tutor-verb-highlight'), durationMs);
  });

  return {
    matched: elements.length,
    tense: action.tense,
    person: action.person,
    table: action.table || 'generated',
  };
}

function startQueuedGrammarLesson() {
  const action = queuedGrammarLesson;
  if (!action) return;
  queuedGrammarLesson = null;

  action.steps.forEach((step) => {
    const startAfterMs = Math.min(60000, Math.max(0, Number(step.startAfterMs || 0)));
    grammarLessonTimers.push(window.setTimeout(() => {
      scrollGrammarTable(step.tableId ?? action.tableIds[0]);
      runGrammarHighlight(step, { scroll: false });
    }, startAfterMs));
  });

  const restoreAfterMs = Math.min(75000, Math.max(3500, Number(action.restoreAfterMs || 5000)));
  grammarLessonTimers.push(window.setTimeout(() => {
    setGrammarPresentation(null);
    grammarLessonTimers = [];
  }, restoreAfterMs));
}

function getTranscriptionCandidateTooltip(message: ChatMessage) {
  const candidates = message.metadata?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';

  return candidates
    .slice(0, 2)
    .map((candidate, index) => {
      if (!candidate || typeof candidate !== 'object') return '';
      const row = candidate as Record<string, unknown>;
      const label = row.id || (index === 0 ? 'primary' : 'secondary');
      const model = row.model ? ` / ${row.model}` : '';
      const language = row.language ? ` / ${row.language}` : '';
      const text = typeof row.text === 'string' && row.text.trim() ? row.text.trim() : '[empty]';
      return `${label}${model}${language}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');
}

function savedNoteMessage(note: TutorImportantNote | null, fallback?: Record<string, unknown> | null) {
  const key = note?.key || (typeof fallback?.key === 'string' ? fallback.key : '');
  const content = note?.content || (typeof fallback?.content === 'string' ? fallback.content : '');
  const normalized = content.trim();
  const shortContent = normalized.length > 280 ? `${normalized.slice(0, 280)}...` : normalized;

  if (!shortContent) return 'Сохранил важную заметку.';
  return key ? `Сохранил важную заметку (${key}): ${shortContent}` : `Сохранил важную заметку: ${shortContent}`;
}

function buildDebugModelContext(
  snapshot: DebugSnapshot | null,
  fallback: {
    pathname: string;
    ttsVoice: string;
    importantNotes: TutorImportantNote[];
  },
) {
  return {
    note: 'Это payload, который кладется в user-message для TutorAgent. Runtime/cache counters ниже в этот payload не входят.',
    current_page: snapshot?.currentPage || fallback.pathname,
    lesson_context: snapshot?.lessonContext || null,
    tutor_voice: snapshot?.tutorVoice || {
      voice: fallback.ttsVoice,
      note: 'local UI config until snapshot refresh',
    },
    important_notes: snapshot?.importantNotes || fallback.importantNotes,
    old_messages_summary_sent_to_model: snapshot?.contextSummary || '',
    recent_context_source: snapshot?.recentContextSource || 'browser fallback until snapshot refresh',
    recent_context_limit: 10,
    recent_context_sent_to_model: snapshot?.recentContext || [],
  };
}

function buildDebugAgentTrace(snapshot: DebugSnapshot | null) {
  return {
    note: 'Это trace итераций агента и MCP/tool-команд. Он нужен для debug; в следующий запрос модели автоматически целиком не подмешивается.',
    iterations_shown: snapshot?.recentAgentIterations?.length || 0,
    mcp_tools_last_10: snapshot?.recentMcpInteractions || [],
    agent_iterations: snapshot?.recentAgentIterations || [],
  };
}

function buildFullDebugDocument(
  snapshot: DebugSnapshot | null,
  fallback: { pathname: string; ttsVoice: string; importantNotes: TutorImportantNote[] },
) {
  return {
    actual_openai_static_messages: {
      developer_prompt_builder_rules: {
        source: snapshot?.promptBuilder?.source || 'Prompt builder',
        text: snapshot?.promptBuilder?.text || '',
      },
      developer_route_guide: snapshot?.routeGuide || '',
    },
    actual_latest_context_payload: buildDebugModelContext(snapshot, fallback),
    actual_iteration_payloads: snapshot?.recentAgentIterations?.map((iteration) => ({
      turn: iteration.turn,
      context_sent: iteration.context_sent,
      model_response: iteration.model_response,
    })) || [],
    mcp_tool_trace: snapshot?.recentMcpInteractions || [],
    debug_only_diagnostics_not_sent_to_model: {
      openai_cache_report_from_last_response: snapshot?.promptCacheStats || null,
      openai_prompt_cache_by_iteration: snapshot?.promptCacheByIteration || [],
      context_stats: snapshot?.contextStats || null,
    },
  };
}

function stringifyDebugDocument(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function cacheSummary(snapshot: DebugSnapshot | null | undefined) {
  const stats = snapshot?.promptCacheStats || {};
  const input = typeof stats.input_tokens === 'number' ? stats.input_tokens : null;
  const cached = typeof stats.cached_input_tokens === 'number' ? stats.cached_input_tokens : null;
  const percent = typeof stats.cached_input_percent === 'number' ? stats.cached_input_percent : null;

  return {
    input,
    cached,
    percent,
    label:
      input == null
        ? 'no cache data'
        : `${cached ?? 0}/${input} tokens cached${percent == null ? '' : ` (${percent.toFixed(1)}%)`}`,
  };
}

function createDebugDiffPairs(
  snapshots: DebugSnapshot[],
  fallback: { pathname: string; ttsVoice: string; importantNotes: TutorImportantNote[] },
) {
  const availableSnapshots = snapshots.filter(Boolean);
  return availableSnapshots.slice(0, -1).map((current, index) => {
    const previous = availableSnapshots[index + 1];
    const previousCache = cacheSummary(previous);
    const currentCache = cacheSummary(current);
    return {
      // Stable across new snapshots, so an opened pair stays opened while the list shifts.
      id: `${previous?.capturedAt ?? `prev-${index}`}|${current?.capturedAt ?? `cur-${index}`}`,
      title: `Snapshot ${index + 2} -> ${index + 1}`,
      previousLabel: previousCache.label,
      currentLabel: currentCache.label,
      before: expandEscapedNewlines(stringifyDebugDocument(buildFullDebugDocument(previous, fallback))),
      after: expandEscapedNewlines(stringifyDebugDocument(buildFullDebugDocument(current, fallback))),
    };
  });
}

const LOADED_LLM_COST_INPUT = {
  dialogueActs: '60',
  callsPerAct: '1.5',
  fixedContextTokens: '20000',
  initialHistoryTokens: '12000',
  userTokensPerAct: '200',
  outputTokensPerCall: '400',
  reasoningTokensPerCall: '1000',
  toolTokensPerCall: '1000',
  cacheHitPercent: '50',
  historyTokenLimit: '64000',
  retainedHistoryActs: '5',
  summaryBatchActs: '10',
  summaryTokensPerRun: '600',
  summaryReasoningTokensPerRun: '200',
  memorySearchesPerHour: '6',
  memoryQueryTokens: '120',
  memoryResultTokens: '1500',
};

const WELCOME_MESSAGE = 'Привет! Я Рикс. Помогу разобраться в языке, найти нужный раздел и продолжить обучение.';

export function FloatingTutorAssistant({ isAdmin = false }: { isAdmin?: boolean }) {
  const presets = useTutorPresets();
  const browserTtsRef = useRef<ReturnType<typeof speakBrowserText> | null>(null);
  const browserVoices = useSyncExternalStore(subscribeBrowserVoices, browserVoiceLanguages, noBrowserVoices);
  const router = useRouter();
  const pathname = usePathname();
  const lessonContext = useSyncExternalStore(subscribeLessonContext, getLessonContext, getServerLessonContext);
  const lessonTutorSlot = useSyncExternalStore(subscribeLessonContext, getLessonTutorSlot, getServerLessonTutorSlot);
  const lessonDocked = !!lessonContext && !!lessonTutorSlot;
  const lessonAnnouncedRef = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const recoveryRef = useRef(new TutorReconnect());
  const connectionPausedRef = useRef(false);
  const durableGatewayRef = useRef(false);
  const conversationReadyRef = useRef(false);
  const gatewayAuthenticatedRef = useRef(false);
  const gatewayConversationIdRef = useRef<number | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const chatRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLButtonElement | null>(null);
  const conversationIdRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingPendingRef = useRef(false);
  const recordingStopRequestedRef = useRef(false);
  const browserSpeechRef = useRef<BrowserSpeechCapture | null>(null);
  const [browserSpeechState, setBrowserSpeechState] = useState<'starting' | 'listening' | 'stopping' | 'idle'>('idle');
  const [browserSpeechDraft, setBrowserSpeechDraft] = useState('');
  const browserSpeechAvailable = useSyncExternalStore(subscribeBrowserSpeech, browserSpeechSupported, noBrowserSpeechOnServer);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const pcmPlayerRef = useRef<TutorPcmPlayer | null>(null);
  const activePlaybackIdRef = useRef<string | null>(null);
  const rememberedTtsVoicesRef = useRef<Record<string, string>>({});
  const micTestUrlRef = useRef<string | null>(null);
  const chatPaneRef = useRef<HTMLDivElement | null>(null);
  const suppressNextAutoScrollRef = useRef(false);
  const [openState, setOpen] = useState(false);
  // Дежурная кнопка чата может быть закрыта, но урок форсирует открытие для своего блока,
  // пока пользователь явно не свернёт его (см. closeChat) — без эффекта, чистое вычисление.
  const [dismissedLessonBlockId, setDismissedLessonBlockId] = useState<number | null>(null);
  const open = openState || (!!lessonContext && dismissedLessonBlockId !== lessonContext.lessonBlockId);
  const [fullscreenState, setFullscreen] = useState(false);
  const fullscreen = isAdmin && fullscreenState && !lessonContext;
  const [status, setStatus] = useState<Status>('idle');
  const [activity, dispatchActivity] = useReducer(tutorActivityReducer, idleTutorActivity);
  const [recording, setRecording] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [avatarAnalyser, setAvatarAnalyser] = useState<AnalyserNode | null>(null);
  const [recordingMode, setRecordingMode] = useState<TutorVoiceMode | null>(null);
  const [gatewayModel, setGatewayModel] = useState<string | null>(null);
  const [micTesting, setMicTesting] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [input, setInput] = useState('');
  const [testModeState, setTestMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatTourActive, setChatTourActive] = useState(false);
  const testMode = isAdmin && testModeState;
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [debugSnapshots, setDebugSnapshots] = useState<DebugSnapshot[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugDiffOpen, setDebugDiffOpen] = useState(false);
  const debugOpenRef = useRef(false);
  const [debugSnapshotIndex, setDebugSnapshotIndex] = useState(0);
  const [conversations, setConversations] = useState<TutorConversationSummary[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [oldestLoadedMessageId, setOldestLoadedMessageId] = useState<number | null>(null);
  const [importantNotes, setImportantNotes] = useState<TutorImportantNote[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryOverview, setMemoryOverview] = useState<TutorMemoryOverview | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'assistant',
      text: WELCOME_MESSAGE,
    },
  ]);
  const [customConfig, setCustomConfig] = useState({
    maxOutputTokens: 8192,
    transcriptionModel: 'gpt-transcribe',
    primaryTranscriptionLanguage: '',
    dualTranscriptionEnabled: true,
    secondaryTranscriptionModel: 'gpt-4o-transcribe',
    secondaryTranscriptionLanguage: 'lv',
    liveTranscriptionModel: '',
    voiceModel: 'gpt-realtime-2.1',
    tutorPipeline: 'stt_text_tts',
    tutorModel: 'gpt-5.4',
    reasoningEnabled: false,
    reasoningEffort: 'none',
    ttsModel: tutorTtsCatalog.defaultModel,
    ttsVoice: tutorTtsCatalog.defaultVoice,
    ttsStartMode: 'first_sentence',
    liveDelay: 'medium',
    contextCompressionEnabled: true,
    contextSummaryModel: 'gpt-6-luna',
    messageEmbeddingModel: 'text-embedding-3-large',
    summaryEmbeddingModel: 'text-embedding-3-large',
    contextMode: 'full',
    ttsMode: 'api',
    longMemoryEnabled: true,
  });
  const [captureLanguage, setCaptureLanguage] = useState<string | null>(null);
  const definition = presets.data?.presets[presets.selected];
  const config = useMemo(() => {
    const value = !testMode && definition ? { ...customConfig, ...definition.config, primaryTranscriptionLanguage: captureLanguage ?? definition.config.primaryTranscriptionLanguage } : customConfig;
    return { ...value, ttsVoice: tutorTtsVoice(value.ttsModel, value.ttsVoice) };
  }, [customConfig, testMode, definition, captureLanguage]);
  const setConfig = (value: SetStateAction<typeof customConfig>) => {
    setCustomConfig(typeof value === 'function' ? value(config) : value);
    setCustomCostInput(costInput); setCustomLoadedInput(loadedCostInput);
    if (isAdmin) setTestMode(true);
  };
  const configRef = useRef(config);
  const [customLoadedInput, setCustomLoadedInput] = useState(LOADED_LLM_COST_INPUT);
  const [customCostInput, setCustomCostInput] = useState({
    audioMinutes: '12',
    liveAudioMinutes: '30',
    dialogueActs: '120',
    callsPerAct: '1.2',
    fixedContextTokens: '12000',
    initialHistoryTokens: '3000',
    userTokensPerAct: '60',
    outputTokensPerCall: '120',
    reasoningTokensPerCall: '200',
    toolTokensPerCall: '300',
    cacheHitPercent: '90',
    historyTokenLimit: '32000',
    ttsWordsPerMinute: '150',
    ttsMinutes: '10',
    retainedHistoryActs: '5',
    summaryBatchActs: '10',
    summaryTokensPerRun: '400',
    summaryReasoningTokensPerRun: '100',
    memorySearchesPerHour: '3',
    memoryQueryTokens: '80',
    memoryResultTokens: '1000',
  });
  const costInput = useMemo(() => !testMode && definition ? { ...customCostInput, ...Object.fromEntries(Object.entries(definition.scenario).map(([key, value]) => [key, String(value)])) } : customCostInput, [testMode, definition, customCostInput]);
  const loadedCostInput = useMemo(() => !testMode && definition ? { ...customLoadedInput, ...Object.fromEntries(Object.entries(definition.loadedScenario).map(([key, value]) => [key, String(value)])) } : customLoadedInput, [testMode, definition, customLoadedInput]);
  const setCostInput = (change: (previous: typeof customCostInput) => typeof customCostInput) => {
    setCustomConfig(config); setCustomLoadedInput(loadedCostInput); setCustomCostInput(change(costInput)); if (isAdmin) setTestMode(true);
  };
  const setLoadedCostInput = (change: (previous: typeof customLoadedInput) => typeof customLoadedInput) => {
    setCustomConfig(config); setCustomCostInput(costInput); setCustomLoadedInput(change(loadedCostInput)); if (isAdmin) setTestMode(true);
  };
  const [presetSaveState, setPresetSaveState] = useState('');
  const [presetSaving, setPresetSaving] = useState(false);
  useEffect(() => {
    stopPlayback();
  // Stop the external audio/socket work when the selected server definition changes.
  }, [definition]);

  function selectPreset(id: typeof presets.selected) {
    stopPlayback(); setTestMode(false); setPresetSaveState(''); presets.select(id);
  }
  async function savePreset() {
    if (!isAdmin || presetSaving) return;
    setPresetSaving(true); setPresetSaveState('');
    try {
      const result = await clientApi<{ data: TutorPresetData }>(`/tutor/presets/${presets.selected}`, {
        method: 'PUT', body: JSON.stringify({ config, scenario: costInput, loadedScenario: loadedCostInput }),
      });
      presets.updated(result.data); setTestMode(false); setPresetSaveState('Пресет сохранён для всех пользователей.');
    } catch (error) { setPresetSaveState(error instanceof ApiError && error.errors ? Object.values(error.errors).flat()[0] || error.message : error instanceof Error ? error.message : 'Не удалось сохранить пресет.'); }
    finally { setPresetSaving(false); }
  }

  const wsUrl = useMemo(resolveTutorWsUrl, []);
  const activeTutorModel = testMode || presets.data ? config.tutorModel || gatewayModel : gatewayModel;
  const reasoningEfforts = tutorReasoningEfforts(activeTutorModel);
  const complexAvailable = Boolean(complexQuestionEffort(activeTutorModel));

  useEffect(() => {
    configRef.current = config;
  }, [config]);
  const usesSttTextTts = config.tutorPipeline === 'stt_text_tts';
  const usesBrowserStt = usesSttTextTts && config.transcriptionModel === BROWSER_SPEECH_MODEL;
  const costReasoningEnabled = reasoningEfforts.length > 0 && (!reasoningEfforts.includes('none') || Boolean(config.reasoningEnabled) && config.reasoningEffort !== 'none');
  const usesRealtimeVoice = config.tutorPipeline === 'realtime_voice';
  const usesLiveStt = usesSttTextTts && !usesBrowserStt && Boolean(config.liveTranscriptionModel);
  const availableTtsVoices: readonly string[] = tutorTtsModel(config.ttsModel).voices;
  const costEstimate = useMemo(() => {
    const sttRate =
      usesBrowserStt ? 0 : usesSttTextTts
        ? TUTOR_PRICE_USD.transcriptionPerMinute[
            config.transcriptionModel as keyof typeof TUTOR_PRICE_USD.transcriptionPerMinute
          ]
        : undefined;
    const stt2Rate =
      usesSttTextTts && !usesBrowserStt && config.dualTranscriptionEnabled
        ? TUTOR_PRICE_USD.transcriptionPerMinute[
            config.secondaryTranscriptionModel as keyof typeof TUTOR_PRICE_USD.transcriptionPerMinute
          ]
        : undefined;
    const liveRate = usesLiveStt
      ? TUTOR_PRICE_USD.liveTranscriptionPerMinute[
          config.liveTranscriptionModel as keyof typeof TUTOR_PRICE_USD.liveTranscriptionPerMinute
        ]
      : undefined;
    const textRate =
      usesSttTextTts
        ? TUTOR_PRICE_USD.textPerMillionTokens[
            (config.tutorModel || 'gpt-5.4') as keyof typeof TUTOR_PRICE_USD.textPerMillionTokens
          ]
        : undefined;
    const ttsRate =
      usesSttTextTts
        ? tutorTtsPrice(config.ttsModel)
        : undefined;
    const messageEmbeddingRate =
      TUTOR_PRICE_USD.embeddingPerMillionTokens[
        config.messageEmbeddingModel as keyof typeof TUTOR_PRICE_USD.embeddingPerMillionTokens
      ];
    const summaryModel =
      config.contextSummaryModel === 'same_as_tutor'
        ? config.tutorModel || 'gpt-5.4'
        : config.contextSummaryModel || 'gpt-6-luna';
    const summaryRate =
      TUTOR_PRICE_USD.textPerMillionTokens[
        summaryModel as keyof typeof TUTOR_PRICE_USD.textPerMillionTokens
      ];
    const summaryEfforts = tutorReasoningEfforts(summaryModel);
    const summaryReasoningRequired = summaryEfforts.length > 0 && !summaryEfforts.includes('none');

    const estimate = (input: DialogueCostInput & DialogueMemoryInput & {
      audioMinutes: number;
      liveAudioMinutes: number;
      ttsWordsPerMinute: number;
      ttsMinutes: number;
      memorySearchesPerHour: number;
      memoryQueryTokens: number;
      memoryResultTokens: number;
    }) => {
      const stt = typeof sttRate === 'number' ? sttRate * input.audioMinutes : null;
      const stt2 = typeof stt2Rate === 'number' ? stt2Rate * input.audioMinutes : null;
      const liveStt = typeof liveRate === 'number' ? liveRate * input.liveAudioMinutes : null;
      const memoryQueries = config.longMemoryEnabled ? input.memorySearchesPerHour : 0;
      const dialogue = estimateDialogueCost({ ...input,
        fixedContextTokens: input.fixedContextTokens + memoryQueries * input.memoryResultTokens / Math.max(1, input.dialogueActs),
        reasoningTokensPerCall: costReasoningEnabled ? input.reasoningTokensPerCall : 0 }, config.tutorModel || 'gpt-5.4', textRate, {
        enabled: config.contextCompressionEnabled,
        retainedHistoryActs: input.retainedHistoryActs,
        summaryBatchActs: input.summaryBatchActs,
        summaryTokensPerRun: input.summaryTokensPerRun,
        summaryReasoningTokensPerRun: summaryReasoningRequired ? input.summaryReasoningTokensPerRun : 0,
      });
      const text = dialogue.cost;
      const speech = estimateTtsVolume(input.ttsWordsPerMinute, input.ttsMinutes, config.ttsModel);
      const tts = ttsRate
        ? (speech.ttsInputTokens * ttsRate.input + speech.ttsAudioTokens * ttsRate.outputAudio) /
          1_000_000
        : null;
      const { messageEmbeddings, summary, brainTotal } = priceDialogueMemory(dialogue, summaryModel, summaryRate, config.longMemoryEnabled ? messageEmbeddingRate?.input : 0);
      const longMemory = memoryQueries * input.memoryQueryTokens * (messageEmbeddingRate?.input ?? 0) / 1e6;
      const parts = [stt, stt2, liveStt, text, tts, messageEmbeddings, summary, longMemory].filter((part): part is number => part != null);

      return {
        stt,
        stt2,
        liveStt,
        text,
        tts,
        messageEmbeddings,
        summary,
        longMemory,
        brainTotal: brainTotal == null ? null : brainTotal + longMemory,
        dialogue,
        total: parts.reduce((sum, part) => sum + part, 0),
      };
    };

    const averageInput = {
      audioMinutes: asNumber(costInput.audioMinutes),
      liveAudioMinutes: asNumber(costInput.liveAudioMinutes),
      dialogueActs: asNumber(costInput.dialogueActs),
      callsPerAct: asNumber(costInput.callsPerAct),
      fixedContextTokens: asNumber(costInput.fixedContextTokens),
      initialHistoryTokens: asNumber(costInput.initialHistoryTokens),
      userTokensPerAct: asNumber(costInput.userTokensPerAct),
      outputTokensPerCall: asNumber(costInput.outputTokensPerCall),
      reasoningTokensPerCall: asNumber(costInput.reasoningTokensPerCall),
      toolTokensPerCall: asNumber(costInput.toolTokensPerCall),
      cacheHitPercent: asNumber(costInput.cacheHitPercent),
      historyTokenLimit: asNumber(costInput.historyTokenLimit),
      ttsWordsPerMinute: asNumber(costInput.ttsWordsPerMinute),
      ttsMinutes: asNumber(costInput.ttsMinutes),
      retainedHistoryActs: asNumber(costInput.retainedHistoryActs),
      summaryBatchActs: asNumber(costInput.summaryBatchActs),
      summaryTokensPerRun: asNumber(costInput.summaryTokensPerRun),
      summaryReasoningTokensPerRun: asNumber(costInput.summaryReasoningTokensPerRun),
      memorySearchesPerHour: asNumber(costInput.memorySearchesPerHour),
      memoryQueryTokens: asNumber(costInput.memoryQueryTokens),
      memoryResultTokens: asNumber(costInput.memoryResultTokens),
    };

    const loadedInput = {
      ...averageInput,
      dialogueActs: asNumber(loadedCostInput.dialogueActs),
      callsPerAct: asNumber(loadedCostInput.callsPerAct),
      fixedContextTokens: asNumber(loadedCostInput.fixedContextTokens),
      initialHistoryTokens: asNumber(loadedCostInput.initialHistoryTokens),
      userTokensPerAct: asNumber(loadedCostInput.userTokensPerAct),
      outputTokensPerCall: asNumber(loadedCostInput.outputTokensPerCall),
      reasoningTokensPerCall: asNumber(loadedCostInput.reasoningTokensPerCall),
      toolTokensPerCall: asNumber(loadedCostInput.toolTokensPerCall),
      cacheHitPercent: asNumber(loadedCostInput.cacheHitPercent),
      historyTokenLimit: asNumber(loadedCostInput.historyTokenLimit),
      retainedHistoryActs: asNumber(loadedCostInput.retainedHistoryActs),
      summaryBatchActs: asNumber(loadedCostInput.summaryBatchActs),
      summaryTokensPerRun: asNumber(loadedCostInput.summaryTokensPerRun),
      summaryReasoningTokensPerRun: asNumber(loadedCostInput.summaryReasoningTokensPerRun),
      memorySearchesPerHour: asNumber(loadedCostInput.memorySearchesPerHour),
      memoryQueryTokens: asNumber(loadedCostInput.memoryQueryTokens),
      memoryResultTokens: asNumber(loadedCostInput.memoryResultTokens),
    };
    return {
      average: estimate(averageInput),
      max: estimate(loadedInput),
      averageInput,
      maxInput: loadedInput,
      textRate,
      ttsRate,
      messageEmbeddingRate,
      summaryRate,
      summaryModel,
      summaryReasoningRequired,
    };
  }, [config, costInput, loadedCostInput, usesLiveStt, usesSttTextTts, usesBrowserStt, costReasoningEnabled]);

  const debugSnapshot = debugSnapshots[debugSnapshotIndex] || null;
  const debugContextFallback = { pathname, ttsVoice: config.ttsVoice, importantNotes };
  const debugModelContext = buildDebugModelContext(debugSnapshot, debugContextFallback);
  const debugAgentTrace = buildDebugAgentTrace(debugSnapshot);
  const debugDiffPairs = useMemo(
    () =>
      debugDiffOpen ? createDebugDiffPairs(debugSnapshots, { pathname, ttsVoice: config.ttsVoice, importantNotes }) : [],
    [debugDiffOpen, debugSnapshots, pathname, config.ttsVoice, importantNotes],
  );
  const debugDiffNewestCache = cacheSummary(debugSnapshots[0]);
  const debugDiffOldestCache = cacheSummary(debugSnapshots[debugSnapshots.length - 1]);
  const lastMessage = messages[messages.length - 1];
  const lastMessageScrollKey = `${messages.length}:${lastMessage?.id || ''}:${lastMessage?.text.length || 0}`;

  useEffect(() => {
    debugOpenRef.current = debugOpen;
  }, [debugOpen]);

  useEffect(() => {
    if (suppressNextAutoScrollRef.current) {
        suppressNextAutoScrollRef.current = false;
        return;
    }
    if (!autoScrollEnabled || !open) return;
    const pane = chatPaneRef.current;
    if (!pane) return;

    const scrollToBottom = () => {
      // Compact/mobile layouts scroll the outer body instead of the chat pane.
      let container: HTMLElement | null = pane;
      while (container && container !== document.body) {
        const overflow = window.getComputedStyle(container).overflowY;
        if (/(auto|scroll)/.test(overflow) && container.scrollHeight > container.clientHeight) {
          const bottom = pane.getBoundingClientRect().bottom - container.getBoundingClientRect().top;
          container.scrollTo({
            top: container === pane ? pane.scrollHeight : container.scrollTop + bottom - container.clientHeight,
            behavior: 'instant',
          });
          break;
        }
        container = container.parentElement;
      }
    };

    let frameId = 0;
    const scheduleScroll = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(scrollToBottom);
    };
    scheduleScroll();
    const observer = new ResizeObserver(scheduleScroll);
    observer.observe(pane);
    if (pane.firstElementChild) observer.observe(pane.firstElementChild);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [autoScrollEnabled, lastMessageScrollKey, open, fullscreen]);

  function pushLog(direction: LogRow['direction'], text: string) {
    if (!debugOpenRef.current) return;
    setLogs((prev) =>
      [
        ...prev,
        {
          id: createId(),
          ts: new Date().toLocaleTimeString(),
          direction,
          text,
        },
      ].slice(-80),
    );
  }

  function addMessage(role: Role, text: string, metadata?: Record<string, unknown>) {
    setMessages((prev) => [...prev, { id: createId(), role, text, metadata }].slice(-300));
  }

  function notifyConversationChanged(conversationId: number | null) {
    stopPlayback();
    dispatchActivity({ type: 'activity.reset' });
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !gatewayAuthenticatedRef.current) return;
    if (durableGatewayRef.current && gatewayConversationIdRef.current === conversationId) return;
    gatewayConversationIdRef.current = conversationId;
    if (durableGatewayRef.current) {
      conversationReadyRef.current = false;
      setStatus('connecting');
    }
    const event = {
      type: 'client.event',
      event: 'conversation.changed',
      payload: { conversation_id: conversationId, pathname },
    };
    ws.send(compactJson(event));
    pushLog('out', compactJson(event));
  }

  function notifyMemoryUpdated(notes: TutorImportantNote[]) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const compactNotes = notes
      .map((note) => ({
        id: note.id,
        category: note.category,
        key: note.key,
        content: note.content,
        importance: note.importance,
        last_seen_at: note.last_seen_at,
      }))
      .filter((note) => note.key && note.content)
      .slice(0, 8);
    const event = {
      type: 'client.event',
      event: 'memory.updated',
      payload: { important_notes: compactNotes },
    };
    ws.send(compactJson(event));
    pushLog('out', `memory.updated: ${compactNotes.length} important notes`);
  }

  async function syncImportantNotesToGateway() {
    try {
      const response = await clientApi<TutorMemoryResponse>('/tutor/memory');
      const notes = (response.data?.important_notes || []).slice(0, 8);
      setImportantNotes(notes);
      notifyMemoryUpdated(notes);
      pushLog('system', `important notes loaded: ${notes.length}`);
      return notes;
    } catch (error) {
      pushLog('system', `important notes load failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return [];
    }
  }

  async function openMemoryOverview() {
    setMemoryOpen(true);
    setMemoryLoading(true);
    try {
      const response = await clientApi<TutorMemoryOverviewResponse>('/tutor/memory/overview');
      const overview = response.data || {};
      setMemoryOverview(overview);
      setImportantNotes((overview.important_notes || []).slice(0, 8));
      pushLog('system', `memory overview loaded: ${overview.important_notes?.length || 0} notes`);
    } catch (error) {
      pushLog('system', `memory overview failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      setMemoryOverview({
        important_notes: importantNotes,
        daily_summaries: [],
        daily_summaries_status: 'load_failed',
      });
    } finally {
      setMemoryLoading(false);
    }
  }

  function mapStoredMessages(storedMessages: TutorStoredMessage[]): ChatMessage[] {
    return storedMessages
      .map((message) => ({
        id: `stored-${message.id}`,
        role: (message.role === 'tool' ? 'system' : message.role) as Role,
        text: String(message.text || '').trim(),
        metadata: message.metadata || undefined,
      }))
      .filter((message) => message.text.length > 0);
  }

  function upsertConversationSummary(summary: TutorConversationSummary) {
    setConversations((prev) => {
      const withoutCurrent = prev.filter((conversation) => conversation.id !== summary.id);
      return [summary, ...withoutCurrent].sort((a, b) => {
        const left = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const right = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return right - left;
      });
    });
  }

  async function refreshConversations() {
    const response = await clientApi<TutorConversationListResponse>('/tutor/conversations');
    setConversations(response.data || []);
    return response.data || [];
  }

  async function loadConversationMessages(conversationId: number) {
    stopPlayback();
    setConversationLoading(true);
    try {
      const response = await clientApi<TutorConversationMessagesResponse>(
        `/tutor/conversations/${conversationId}/messages?limit=30`,
      );
      conversationIdRef.current = response.data.conversation.id;
      upsertConversationSummary(response.data.conversation);
      const restoredMessages = mapStoredMessages(response.data.messages || []);
      const firstMessage = response.data.messages?.[0];
      setOldestLoadedMessageId(firstMessage?.id ?? null);
      setHasMoreOlderMessages(Boolean(response.data.pagination?.has_more));
      setMessages(restoredMessages.length ? restoredMessages : [
        {
          id: createId(),
          role: 'assistant',
          text: WELCOME_MESSAGE,
        },
      ]);
      notifyConversationChanged(response.data.conversation.id);
      pushLog('system', `conversation loaded: ${response.data.conversation.id}`);
    } catch (error) {
      pushLog('system', `conversation load failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setConversationLoading(false);
    }
  }

  async function loadOlderConversationMessages() {
    const conversationId = conversationIdRef.current;
    if (!conversationId || !oldestLoadedMessageId || olderMessagesLoading) return;

    setOlderMessagesLoading(true);
    try {
      const pane = chatPaneRef.current;
      const previousScrollHeight = pane?.scrollHeight ?? 0;
      const previousScrollTop = pane?.scrollTop ?? 0;
      const response = await clientApi<TutorConversationMessagesResponse>(
        `/tutor/conversations/${conversationId}/messages?limit=30&before_id=${oldestLoadedMessageId}`,
      );
      const olderMessages = mapStoredMessages(response.data.messages || []);
      const firstMessage = response.data.messages?.[0];
      setOldestLoadedMessageId(firstMessage?.id ?? oldestLoadedMessageId);
      setHasMoreOlderMessages(Boolean(response.data.pagination?.has_more));
      suppressNextAutoScrollRef.current = true;
      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.id));
        const uniqueOlder = olderMessages.filter((message) => !existingIds.has(message.id));
        return [...uniqueOlder, ...prev];
      });
      window.requestAnimationFrame(() => {
        if (!pane) return;
        pane.scrollTop = pane.scrollHeight - previousScrollHeight + previousScrollTop;
      });
      upsertConversationSummary(response.data.conversation);
      pushLog('system', `older messages loaded: ${olderMessages.length}`);
    } catch (error) {
      pushLog('system', `older messages load failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setOlderMessagesLoading(false);
    }
  }

  async function loadCurrentConversation() {
    setConversationLoading(true);
    try {
      const response = await clientApi<TutorConversationResponse>('/tutor/conversation/current');
      const conversationId = response.data.id ?? response.data.conversation?.id ?? null;
      await refreshConversations();
      if (typeof conversationId === 'number') {
        await loadConversationMessages(conversationId);
      }
    } catch (error) {
      pushLog('system', `conversation init failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setConversationLoading(false);
    }
  }

  async function createNewConversation() {
    setConversationLoading(true);
    stopPlayback();
    try {
      const response = await clientApi<TutorConversationResponse>('/tutor/conversations', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const conversationId = response.data.id ?? response.data.conversation?.id ?? null;
      if (typeof conversationId === 'number') {
        conversationIdRef.current = conversationId;
        setHasMoreOlderMessages(false);
        setOldestLoadedMessageId(null);
        setMessages([
          {
            id: createId(),
            role: 'assistant',
            text: WELCOME_MESSAGE,
          },
        ]);
        notifyConversationChanged(conversationId);
        await refreshConversations();
        pushLog('system', `conversation created: ${conversationId}`);
      }
    } catch (error) {
      pushLog('system', `conversation create failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setConversationLoading(false);
    }
  }

  function pcmPlayer() {
    if (!pcmPlayerRef.current) {
      pcmPlayerRef.current = new TutorPcmPlayer({
        onAnalyser: setAvatarAnalyser,
        onPlaybackState: setAvatarSpeaking,
        onFirstPlayback: (playbackId) => {
          if (activePlaybackIdRef.current !== playbackId) return;
          dispatchActivity({ type: 'tts.playback.started' });
          startQueuedGrammarLesson();
        },
        onError: (message) => {
          stopPlayback();
          dispatchActivity({ type: 'activity.reset' });
          addMessage('assistant', `TTS: ${message}`);
          pushLog('system', `TTS playback failed: ${message}`);
        },
      });
    }
    return pcmPlayerRef.current;
  }

  function beginPlayback(userGesture: boolean) {
    stopPlayback();
    const playbackId = crypto.randomUUID();
    activePlaybackIdRef.current = playbackId;
    const player = pcmPlayer();
    player.begin(playbackId);
    if (userGesture) void player.unlock();
    return playbackId;
  }

  function stopPlayback() {
    window.dispatchEvent(new Event('tutor.character.clear'));
    browserTtsRef.current?.cancel(); browserTtsRef.current = null;
    browserSpeechRef.current?.cancel();
    browserSpeechRef.current = null;
    setBrowserSpeechDraft('');
    activePlaybackIdRef.current = null;
    dispatchActivity({ type: 'activity.reset' });
    pcmPlayerRef.current?.stop();
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(compactJson({ type: 'tts.cancel' }));
    queuedGrammarLesson = null;
    clearGrammarLessonTimers();
    setGrammarPresentation(null);
    playbackRef.current?.pause();
    playbackRef.current?.removeAttribute('src');
    playbackRef.current?.load();
    playbackRef.current = null;
  }

  function playLocalAudioUrl(url: string) {
    stopPlayback();
    const audio = new Audio(url);
    playbackRef.current = audio;
    audio.play().catch((error) => {
      pushLog('system', `mic test playback failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    });
  }

  useEffect(() => () => {
    recoveryRef.current.cancel();
    stopPlayback();
    pcmPlayerRef.current?.dispose();
    pcmPlayerRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
    recorder?.stream.getTracks().forEach(track => track.stop());
    wsRef.current?.close();
    wsRef.current = null;
    if (micTestUrlRef.current) URL.revokeObjectURL(micTestUrlRef.current);
  // The cleanup reads refs, so it must run only on unmount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistTutorMessage(
    role: Role | 'tool',
    text: string | null,
    metadata?: Record<string, unknown>,
  ) {
    const conversationId = conversationIdRef.current;
    clientApi<TutorConversationResponse>('/tutor/messages', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        role,
        original_text: text,
        source: 'floating_widget',
        metadata,
        embedding_model: configRef.current.messageEmbeddingModel,
        embedding_dimensions: 1536,
        index_memory: configRef.current.longMemoryEnabled,
      }),
    })
      .then((response) => {
        if (conversationIdRef.current !== conversationId) return;
        const nextId = response.data.conversation?.id ?? response.data.id;
        if (typeof nextId === 'number') conversationIdRef.current = nextId;
        refreshConversations().catch(() => undefined);
      })
      .catch((error) => {
        pushLog('system', `persist failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      });
  }

  useEffect(() => {
    if (!open) {
      recoveryRef.current.cancel();
      connectionPausedRef.current = false;
      return;
    }
    if (wsRef.current || connectionPausedRef.current) return;

    const conversationLoad = conversationIdRef.current
      ? loadConversationMessages(conversationIdRef.current) : loadCurrentConversation();

    conversationReadyRef.current = false;
    gatewayAuthenticatedRef.current = false;
    gatewayConversationIdRef.current = null;
    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    pushLog('system', `connect ${wsUrl}`);

    ws.addEventListener('open', async () => {
      if (wsRef.current !== ws) return;
      pushLog('system', 'socket open');
      try {
        const { ticket } = await clientApi<{ ticket: string }>('/tutor/ticket', { method: 'POST' });
        if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'session.authenticate', ticket }));
      } catch (error) {
        connectionPausedRef.current = error instanceof ApiError && [401, 402, 403].includes(error.status);
        addMessage('assistant', error instanceof Error ? error.message : 'Не удалось подключиться к боту. Попробуйте ещё раз.');
        ws.close();
      }
    });
    ws.addEventListener('close', () => {
      if (wsRef.current !== ws) return;
      stopPlayback();
      dispatchActivity({ type: 'activity.reset' });
      setStatus('closed');
      wsRef.current = null;
      conversationReadyRef.current = false;
      if (!connectionPausedRef.current) recoveryRef.current.schedule(() => setConnectionAttempt(value => value + 1));
      pushLog('system', 'socket closed');
    });
    ws.addEventListener('error', () => {
      if (wsRef.current !== ws) return;
      stopPlayback();
      dispatchActivity({ type: 'activity.reset' });
      setStatus('error');
      pushLog('system', 'socket error');
    });
    ws.addEventListener('message', (event) => {
      if (wsRef.current !== ws) return;
      pushLog('in', compactTutorEventForLog(event.data));
      let payload: TutorEvent;
      try {
        payload = JSON.parse(event.data) as TutorEvent;
        if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') throw new Error('Invalid event');
      } catch {
        stopPlayback();
        dispatchActivity({ type: 'activity.reset' });
        addMessage('assistant', 'Не удалось прочитать ответ репетитора.');
        return;
      }
      if ('playbackId' in payload && payload.playbackId !== activePlaybackIdRef.current) return;
      if (payload.type === 'credits.changed') {
        notifyCreditsChanged();
        return;
      }
      if (payload.type === 'tts.stream.start' || payload.type === 'tts.stream.chunk' || payload.type === 'tts.stream.end') {
        if (payload.type === 'tts.stream.end' && payload.cancelled) {
          stopPlayback();
          return;
        }
        pcmPlayerRef.current?.handle(payload);
        return;
      }
      if (payload.type === 'tts.audio' && !pcmPlayerRef.current?.accepts(payload.playbackId)) return;
      dispatchActivity(payload);
      if (payload.type === 'tutor.thinking') return;
      if (payload.type === 'session.ready') {
        gatewayAuthenticatedRef.current = true;
        durableGatewayRef.current = Boolean(payload.capabilities?.includes('context.persistence.v1'));
        if (!durableGatewayRef.current) recoveryRef.current.ready();
        conversationReadyRef.current = !durableGatewayRef.current;
        setStatus(durableGatewayRef.current ? 'connecting' : 'ready');
        ws.send(compactJson({ type: 'client.event', event: 'page.changed', payload: { pathname } }));
        setGatewayModel(payload.tutorModel || null);
        void conversationLoad.then(() => {
          if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) return;
          if (durableGatewayRef.current && conversationIdRef.current) notifyConversationChanged(conversationIdRef.current);
          void syncImportantNotesToGateway();
        });
        return;
      }
      if (payload.type === 'conversation.ready') {
        if (payload.conversationId !== conversationIdRef.current) return;
        conversationReadyRef.current = true;
        recoveryRef.current.ready();
        setStatus('ready');
        return;
      }
      if (payload.type === 'assistant.message') {
        addMessage('assistant', payload.text);
        if (payload.metadata?.browserSpeech && payload.metadata.playbackId === activePlaybackIdRef.current) {
          browserTtsRef.current?.cancel();
          browserTtsRef.current = speakBrowserText(payload.text, document.documentElement.lang === 'uk' ? 'uk' : 'ru', message => addMessage('system', message));
        }
        if (!payload.metadata?.persisted) persistTutorMessage('assistant', payload.text, { ws_event: payload.type });
        return;
      }
      if (payload.type === 'debug.snapshot') {
        if (!payload.ok) {
          const message = 'error' in payload ? payload.error?.message : 'debug snapshot failed';
          pushLog('system', `Debug snapshot failed: ${message || 'unknown error'}`);
          return;
        }
        const nextSnapshot = {
          currentPage: payload.currentPage || null,
          capturedAt: payload.capturedAt || new Date().toISOString(),
          lessonContext: payload.lessonContext || null,
          tutorVoice: payload.tutorVoice,
          contextSummary: payload.contextSummary || '',
          importantNotes: payload.importantNotes || [],
          contextStats: payload.contextStats || null,
          promptBuilder: payload.promptBuilder,
          routeGuide: payload.routeGuide || '',
          recentContext: payload.recentContext || [],
          recentContextSource: payload.recentContextSource || 'gateway',
          recentMcpInteractions: payload.recentMcpInteractions || [],
          recentAgentIterations: payload.recentAgentIterations || [],
          promptCacheStats: payload.promptCacheStats || null,
          promptCacheByIteration: payload.promptCacheByIteration || [],
        };
        setDebugSnapshots((prev) => [nextSnapshot, ...prev].slice(0, 10));
        setDebugSnapshotIndex(0);
        pushLog(
          'system',
          `Agent iterations: ${(payload.recentAgentIterations || []).length}; MCP/tools: ${
            (payload.recentMcpInteractions || []).length
          }`,
        );
        if (payload.promptCacheByIteration?.length) {
          pushLog(
            'system',
            `OpenAI prompt cache by iteration:\n${payload.promptCacheByIteration
              .map((item, index) => {
                const cached = typeof item.cached_input_percent === 'number'
                  ? `${item.cached_input_percent.toFixed(1)}%`
                  : 'n/a';
                return `#${index + 1}: ${cached} cached (${item.cached_input_tokens ?? '?'} / ${item.input_tokens ?? '?'} input tokens)`;
              })
              .join('\n')}`,
          );
        }
        pushLog(
          'system',
          `Prompt builder (${payload.promptBuilder?.source || 'unknown'}):\n${payload.promptBuilder?.text || ''}`,
        );
        if (payload.recentContext?.length) {
          pushLog('system', `Recent context:\n${payload.recentContext.join('\n')}`);
        }
        return;
      }
      if (payload.type === 'tts.audio') {
        if (!payload.ok) {
          stopPlayback();
          console.error('[AI Tutor] TTS error', payload.error, payload.metadata || {});
          addMessage('assistant', `TTS error: ${payload.error?.message || 'unknown error'}`);
          return;
        }
        void pcmPlayerRef.current?.playLegacy(payload);
        return;
      }
      if (payload.type === 'transcription.result') {
        if (!payload.ok) {
          console.error('[AI Tutor] STT error', payload.error, payload.metadata || {});
        } else {
          console.info('[AI Tutor] STT result', {
            text: payload.text,
            metadata: payload.metadata || {},
          });
        }
        if (payload.ok) {
          const transcript = payload.text.trim();
          if (!transcript) {
            addMessage('assistant', 'Не расслышал. Попробуй сказать чуть дольше или ближе к микрофону.');
            pushLog('system', 'empty transcript ignored');
            return;
          }
          addMessage('user', transcript, payload.metadata);
          if (!durableGatewayRef.current) persistTutorMessage('user', transcript, {
            ws_event: payload.type,
            metadata: payload.metadata,
            source: 'push_to_talk',
          });
          return;
        }
        addMessage('assistant', `STT error: ${payload.error?.message || 'unknown error'}`);
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'navigate') {
        const action = payload.action;
        const previousPath = window.location.pathname;
        router.push(action.to);
        persistTutorMessage('tool', `ui.command: ${action.type}`, {
          commandId: payload.commandId,
          action,
        });
        waitForNavigationResult(action.to, previousPath).then(({ currentPath, redirected }) => {
          const ack = {
            type: 'client.event',
            event: 'tool.result',
            payload: {
              commandId: payload.commandId,
              ok: true,
              action,
              data: {
                requested_to: action.to,
                current_path: currentPath,
                redirected,
              },
            },
          };
          ws.send(compactJson(ack));
          pushLog('out', compactJson(ack));
        });
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'site_character') {
        const action = payload.action;
        const startedAt = performance.now();
        pushLog('system', `site character received: ${payload.commandId} ${action.operation}`);
        void runSiteCharacter(action).then(data => {
          pushLog('system', `site character resolved: ${payload.commandId} ${Math.round(performance.now() - startedAt)}ms ${compactJson(data)}`);
          if (ws.readyState !== WebSocket.OPEN) return;
          const ack = { type: 'client.event', event: 'tool.result', payload: {
            commandId: payload.commandId, ok: data.matched > 0, action, data,
          } };
          ws.send(compactJson(ack));
          pushLog('out', compactJson(ack));
        }).catch(error => {
          console.error('[Site keeper] command failed', error);
          if (ws.readyState === WebSocket.OPEN) ws.send(compactJson({ type: 'client.event', event: 'tool.result', payload: {
            commandId: payload.commandId, ok: false, action, data: { reason: 'site_keeper_command_failed' },
          } }));
        });
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'grammar_table_highlight') {
        const result = runGrammarHighlight(payload.action);
        persistTutorMessage('tool', `ui.command: ${payload.action.type}`, {
          commandId: payload.commandId,
          action: payload.action,
          result,
        });
        const ack = {
          type: 'client.event',
          event: 'tool.result',
          payload: {
            commandId: payload.commandId,
            ok: result.matched > 0,
            action: payload.action,
            data: result,
          },
        };
        ws.send(compactJson(ack));
        pushLog('out', compactJson(ack));
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'grammar_table_read') {
        const result = runGrammarTableRead(payload.action);
        const ack = {
          type: 'client.event',
          event: 'tool.result',
          payload: {
            commandId: payload.commandId,
            ok: result.matched > 0,
            action: payload.action,
            data: result,
          },
        };
        ws.send(compactJson(ack));
        pushLog('out', compactJson(ack));
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'grammar_table_hint') {
        const { commandId } = payload;
        const hintAction = payload.action;
        void runGrammarTableHint(hintAction).then((result) => {
          const ack = {
            type: 'client.event',
            event: 'tool.result',
            payload: {
              commandId,
              ok: result.matched > 0,
              action: hintAction,
              data: result,
            },
          };
          ws.send(compactJson(ack));
          pushLog('out', compactJson(ack));
        });
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'grammar_lesson_present') {
        const result = runGrammarLessonPresentation(payload.action);
        persistTutorMessage('tool', `ui.command: ${payload.action.type}`, {
          commandId: payload.commandId,
          action: payload.action,
          result,
        });
        const ack = {
          type: 'client.event',
          event: 'tool.result',
          payload: {
            commandId: payload.commandId,
            ok: true,
            action: payload.action,
            data: result,
          },
        };
        ws.send(compactJson(ack));
        pushLog('out', compactJson(ack));
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'site_menu_activate') {
        const result = runSiteMenuAction(payload.action);
        const ack = {
          type: 'client.event',
          event: 'tool.result',
          payload: {
            commandId: payload.commandId,
            ok: true,
            action: payload.action,
            data: result,
          },
        };
        ws.send(compactJson(ack));
        pushLog('out', compactJson(ack));
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'verb_search_open') {
        const result = runVerbSearchOpen(payload.action);
        const ack = {
          type: 'client.event',
          event: 'tool.result',
          payload: {
            commandId: payload.commandId,
            ok: true,
            action: payload.action,
            data: result,
          },
        };
        ws.send(compactJson(ack));
        pushLog('out', compactJson(ack));
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'verb_form_highlight') {
        const result = runVerbFormHighlight(payload.action);
        const ack = {
          type: 'client.event',
          event: 'tool.result',
          payload: {
            commandId: payload.commandId,
            ok: result.matched > 0,
            action: payload.action,
            data: result,
          },
        };
        ws.send(compactJson(ack));
        pushLog('out', compactJson(ack));
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'client_api') {
        const action = payload.action;
        const lessonCompletion = action.endpoint.match(/^\/tutor\/lesson-blocks\/(\d+)\/complete$/);
        const currentLesson = lessonCompletion ? getLessonContext() : null;
        const actionBody = lessonCompletion && currentLesson?.lessonBlockId === Number(lessonCompletion[1])
          ? { ...(action.body || {}), variant_id: currentLesson.variantId }
          : action.endpoint === '/tutor/memory/search-history'
          ? {
              ...(action.body || {}),
              embedding_model: configRef.current.messageEmbeddingModel,
              embedding_dimensions: 1536,
            }
          : action.body || {};
        clientApi(action.endpoint, {
          method: action.method,
          body: action.method === 'GET' ? undefined : JSON.stringify(actionBody),
        })
          .then((data) => {
            persistTutorMessage('tool', `client_api: ${action.endpoint}`, {
              commandId: payload.commandId,
              action,
              data,
            });
            if (action.endpoint === '/tutor/memory/notes') {
              const savedNote = data && typeof data === 'object'
                ? ((data as { data?: TutorImportantNote }).data || null)
                : null;
              addMessage('system', savedNoteMessage(savedNote, actionBody));
              syncImportantNotesToGateway();
            }
            if (/^\/tutor\/lesson-blocks\/\d+\/complete$/.test(action.endpoint)) {
              window.dispatchEvent(new CustomEvent('tutor.lesson.completed', { detail: { endpoint: action.endpoint,
                variantId: 'variant_id' in actionBody ? actionBody.variant_id : null } }));
            }
            const ack = {
              type: 'client.event',
              event: 'tool.result',
              payload: {
                commandId: payload.commandId,
                ok: true,
                action,
                data,
              },
            };
            ws.send(compactJson(ack));
            pushLog('out', compactJson(ack));
          })
          .catch((error) => {
            const ack = {
              type: 'client.event',
              event: 'tool.result',
              payload: {
                commandId: payload.commandId,
                ok: false,
                action,
                error: error instanceof Error ? error.message : 'unknown error',
              },
            };
            ws.send(compactJson(ack));
            pushLog('out', compactJson(ack));
          })
          .finally(() => {
            if (action.endpoint === '/tutor/references') {
              dispatchActivity({ type: 'reference.settled', commandId: payload.commandId });
            }
          });
        return;
      }
      if (payload.type === 'error') {
        dispatchActivity({ type: 'activity.reset' });
        addMessage('assistant', payload.message);
      }
    });
  }, [open, router, wsUrl, pathname, connectionAttempt]);

  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const event = {
      type: 'client.event',
      event: 'page.changed',
      payload: { pathname },
    };
    wsRef.current.send(compactJson(event));
    pushLog('out', compactJson(event));
  }, [pathname]);

  useEffect(() => {
    if (!open || settingsOpen || chatTourActive) return;

    function handleOutsidePointerDown(event: MouseEvent | TouchEvent) {
      if (lessonContext) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (chatRef.current?.contains(target)) return;
      if (bubbleRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-tutor-help-popover]')) return;

      closeChat();
    }

    document.addEventListener('mousedown', handleOutsidePointerDown);
    document.addEventListener('touchstart', handleOutsidePointerDown, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsidePointerDown);
      document.removeEventListener('touchstart', handleOutsidePointerDown);
    };
  }, [open, lessonContext, settingsOpen, chatTourActive]);

  function sendText(text: string, options: { silent?: boolean; questionMode?: TutorVoiceMode } = {}) {
    if (!presets.ready && !testMode) return;
    const trimmed = text.trim();
    const ws = wsRef.current;
    if (!trimmed || !ws || ws.readyState !== WebSocket.OPEN || conversationLoading || !conversationReadyRef.current) return;

    const playbackId = beginPlayback(!options.silent);
    const turnConfig = { ...tutorRequestConfig(config, testMode), ...(lessonContext ? { humanAvatar: getHumanAvatarSelection() } : {}), ...(!testMode ? { preset: presets.selected, primaryTranscriptionLanguage: config.primaryTranscriptionLanguage } : {}) };
    const payload = {
      type: 'user.message',
      playbackId,
      conversationId: conversationIdRef.current,
      text: trimmed,
      config: turnConfig,
      questionMode: options.questionMode === 'complex' ? 'complex' : undefined,
      currentPage: pathname,
      recentContext: getRecentContextLines(messages, 10),
    };
    if (!options.silent) {
      addMessage('user', trimmed);
      if (!durableGatewayRef.current) persistTutorMessage('user', trimmed, {
        page: pathname,
        config: turnConfig,
      });
    }
    dispatchActivity({ type: 'request.text' });
    ws.send(compactJson(payload));
    pushLog('out', compactJson(payload));
    if (!options.silent) setInput('');
  }

  // Lesson block (writing/speaking) told us via lessonContextBridge which task is open. Forward
  // it to the gateway on every change (keeps the model's live context current), and — only the
  // first time this exact block+completion state shows up, checked against the already-loaded
  // conversation history, not a per-mount flag — drop a *persisted* system message into the same
  // ongoing conversation ("lesson X started") and nudge the model to react to it. Reusing the
  // existing conversation (not starting a new one) means: reload the page and, if the marker is
  // still within the last 30 loaded messages, it won't repeat; scroll it out via enough other
  // activity (i.e. genuinely stale) and the bot naturally re-introduces the task.
  useEffect(() => {
    const ws = wsRef.current;
    if (conversationLoading || status !== 'ready' || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (!lessonContext) {
      ws.send(compactJson({ type: 'client.event', event: 'lesson.context', payload: null }));
      return;
    }
    const event = {
      type: 'client.event',
      event: 'lesson.context',
      payload: {
        topic: lessonContext.topic,
        text: lessonContext.text,
        instructions: lessonContext.instructions,
        lessonBlockId: lessonContext.lessonBlockId,
        variantId: lessonContext.variantId,
        format: lessonContext.format,
        completed: lessonContext.completed,
      },
    };
    ws.send(compactJson(event));
    pushLog('out', compactJson(event));

    const announceKey = `${lessonContext.lessonBlockId}:${lessonContext.variantId}:${lessonContext.completed}`;
    if (lessonAnnouncedRef.current.has(announceKey)) return;
    const alreadyInHistory = messages.some(
      (message) =>
        message.role === 'system' &&
        message.metadata?.event === 'lesson.start' &&
        message.metadata?.lesson_block_id === lessonContext.lessonBlockId &&
        (message.metadata?.variant_id ?? null) === lessonContext.variantId &&
        message.metadata?.completed === lessonContext.completed,
    );
    if (alreadyInHistory) {
      lessonAnnouncedRef.current.add(announceKey);
      return;
    }
    lessonAnnouncedRef.current.add(announceKey);
    const formatLabel = lessonContext.format === 'speaking' ? 'говорение' : 'письмо';
    const announceText = lessonContext.completed
      ? `Пользователь вернулся к уже зачтённому заданию «${lessonContext.topic}» (${formatLabel}).`
      : `Начинается задание «${lessonContext.topic}» (${formatLabel}).`;
    // Legitimate "synchronize with an external system" case the rule's own docs carve out
    // (lessonContextBridge is exactly that external system) — just not recognized because the
    // setState call is one function-call hop away (addMessage) rather than inline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    addMessage('system', announceText);
    persistTutorMessage('system', announceText, {
      event: 'lesson.start',
      lesson_block_id: lessonContext.lessonBlockId,
      variant_id: lessonContext.variantId,
        topic: lessonContext.topic,
        format: lessonContext.format,
        instructions: lessonContext.instructions,
        completed: lessonContext.completed,
    });
    sendText(announceText, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonContext, status, conversationLoading, presets.ready]);

  function disconnect() {
    connectionPausedRef.current = true;
    recoveryRef.current.cancel();
    conversationReadyRef.current = false;
    stopPlayback();
    dispatchActivity({ type: 'activity.reset' });
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('closed');
  }

  function requestDebugSnapshot() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = {
      type: 'debug.snapshot',
      config: { ...tutorRequestConfig(config, testMode), ...(lessonContext ? { humanAvatar: getHumanAvatarSelection() } : {}), ...(!testMode ? { preset: presets.selected } : {}) },
      recentContext: getRecentContextLines(messages, 10),
    };
    ws.send(compactJson(payload));
    pushLog('out', compactJson(payload));
  }

  function openDebugSnapshot() {
    debugOpenRef.current = true;
    setDebugOpen(true);
    requestDebugSnapshot();
  }

  function closeDebugSnapshot() {
    debugOpenRef.current = false;
    setDebugOpen(false);
    setDebugDiffOpen(false);
  }

  function openDebugDiffReport() {
    if (debugSnapshots.length < 2) {
      pushLog('system', 'Need at least 2 debug snapshots for context diff');
      requestDebugSnapshot();
    }
    setDebugDiffOpen(true);
  }

  function closeChat() {
    setSettingsOpen(false);
    browserSpeechRef.current?.cancel();
    browserSpeechRef.current = null;
    recoveryRef.current.cancel();
    conversationReadyRef.current = false;
    dispatchActivity({ type: 'activity.reset' });
    stopRecording();
    if (lessonContext) setDismissedLessonBlockId(lessonContext.lessonBlockId);
    setOpen(false);
    setFullscreen(false);
    stopPlayback();
    wsRef.current?.close();
    wsRef.current = null;
  }

  async function blobToBase64(blob: Blob) {
    const buffer = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
  }

  async function startRecording(mode: TutorVoiceMode, event?: PointerEvent<HTMLButtonElement>, language?: string) {
    if (!presets.ready && !testMode) return;
    event?.preventDefault();
    if (event?.currentTarget && event.pointerId != null) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (error) {
        console.debug('[AI Tutor] setPointerCapture failed', error);
      }
    }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || recording || recordingPendingRef.current || mediaRecorderRef.current || browserSpeechRef.current || micTesting || conversationLoading || !conversationReadyRef.current) return;
    if (mode === 'complex' && !complexAvailable) return;
    const playbackId = beginPlayback(true);
    if (usesBrowserStt) {
      const recognitionLanguage = language || config.primaryTranscriptionLanguage || 'lv';
      setCaptureLanguage(recognitionLanguage);
      setCustomConfig(prev => ({ ...prev, primaryTranscriptionLanguage: recognitionLanguage }));
      const conversationId = conversationIdRef.current;
      const capture = new BrowserSpeechCapture({
        language: recognitionLanguage,
        onDraft: text => { if (browserSpeechRef.current === capture) setBrowserSpeechDraft(text); },
        onState: state => {
          if (browserSpeechRef.current !== capture) return;
          setBrowserSpeechState(state);
          setRecording(state === 'starting' || state === 'listening');
          if (state === 'stopping' || state === 'idle') setRecordingMode(null);
          if (state === 'stopping') dispatchActivity({ type: 'request.audio' });
        },
        onText: text => {
          if (browserSpeechRef.current !== capture) return;
          browserSpeechRef.current = null;
          setBrowserSpeechDraft('');
          if (activePlaybackIdRef.current !== playbackId || wsRef.current !== ws || ws.readyState !== WebSocket.OPEN || conversationIdRef.current !== conversationId) return;
          sendText(text, { questionMode: mode });
        },
        onError: message => {
          if (browserSpeechRef.current !== capture) return;
          browserSpeechRef.current = null;
          setBrowserSpeechDraft('');
          dispatchActivity({ type: 'activity.reset' });
          addMessage('assistant', message);
        },
      });
      browserSpeechRef.current = capture;
      setRecordingMode(mode);
      setBrowserSpeechDraft('');
      capture.start();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      addMessage('assistant', 'Браузер не поддерживает запись микрофона.');
      return;
    }

    recordingPendingRef.current = true;
    recordingStopRequestedRef.current = false;
    setRecordingMode(mode);
    const turnConfig = { ...tutorRequestConfig(config, testMode), ...(lessonContext ? { humanAvatar: getHumanAvatarSelection() } : {}), ...(!testMode ? { preset: presets.selected, primaryTranscriptionLanguage: config.primaryTranscriptionLanguage } : {}) };
    const conversationId = conversationIdRef.current;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingStopRequestedRef.current || activePlaybackIdRef.current !== playbackId || wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) {
        stream.getTracks().forEach((track) => track.stop());
        recordingPendingRef.current = false;
        setRecordingMode(null);
        return;
      }
      const recordingStream = stream;
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      audioChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      mediaRecorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event) => {
        console.debug('[AI Tutor] recorder dataavailable', {
          size: event.data.size,
          type: event.data.type,
        });
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });
      recorder.addEventListener('stop', async () => {
        setRecording(false);
        setRecordingMode(null);
        recordingStream.getTracks().forEach((track) => track.stop());
        const durationMs = Math.max(0, Date.now() - recordingStartedAtRef.current);
        const chunkCount = audioChunksRef.current.length;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        recordingStartedAtRef.current = 0;
        console.info('[AI Tutor] recording blob ready', {
          sizeBytes: blob.size,
          durationMs,
          mimeType: blob.type || recorder.mimeType,
          chunks: chunkCount,
          recorderMimeType: recorder.mimeType,
        });
        if (activePlaybackIdRef.current !== playbackId || wsRef.current !== ws || ws.readyState !== WebSocket.OPEN || conversationIdRef.current !== conversationId) return;
        if (blob.size === 0) {
          console.warn('[AI Tutor] empty recording blob, nothing to send', {
            durationMs,
            mimeType: blob.type || recorder.mimeType,
          });
          return;
        }

        const payload = {
          type: 'user.audio',
          playbackId,
          conversationId,
          audio: await blobToBase64(blob),
          mimeType: blob.type || 'audio/webm',
          sizeBytes: blob.size,
          durationMs,
          config: turnConfig,
          questionMode: mode === 'complex' ? 'complex' : undefined,
          currentPage: pathname,
          recentContext: getRecentContextLines(messages, 10),
        };
        console.info('[AI Tutor] sending audio to gateway', {
          mimeType: payload.mimeType,
          sizeBytes: payload.sizeBytes,
          durationMs: payload.durationMs,
          base64Chars: payload.audio.length,
        });
        pushLog('out', compactJson({ ...payload, audio: `[base64 ${payload.audio.length} chars]` }));
        if (activePlaybackIdRef.current === playbackId && wsRef.current === ws && ws.readyState === WebSocket.OPEN && conversationIdRef.current === conversationId) {
          dispatchActivity({ type: 'request.audio' });
          ws.send(compactJson(payload));
        }
      });

      recorder.start(250);
      recordingPendingRef.current = false;
      setRecording(true);
      pushLog('system', 'recording started');
    } catch (error) {
      recordingPendingRef.current = false;
      stream?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      setRecordingMode(null);
      setRecording(false);
      console.error('[AI Tutor] mic start error', error);
      addMessage('assistant', `Mic error: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  function stopRecording(event?: PointerEvent<HTMLButtonElement>) {
    event?.preventDefault();
    recordingStopRequestedRef.current = true;
    if (event?.currentTarget && event.pointerId != null) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (error) {
        console.debug('[AI Tutor] releasePointerCapture failed', error);
      }
    }
    if (browserSpeechRef.current) {
      browserSpeechRef.current.stop();
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch (error) {
        console.warn('[AI Tutor] recorder.requestData failed', error);
      }
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 80);
      pushLog('system', 'recording stopped');
    }
  }

  async function runMicTest() {
    if (recording || micTesting) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      addMessage('assistant', 'Браузер не поддерживает запись микрофона.');
      return;
    }

    try {
      stopPlayback();
      setMicTesting(true);
      addMessage('system', 'Mic test: говори 5 секунд...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      const chunks: Blob[] = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((track) => track.stop());
        setMicTesting(false);
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (micTestUrlRef.current) URL.revokeObjectURL(micTestUrlRef.current);
        const url = URL.createObjectURL(blob);
        micTestUrlRef.current = url;
        addMessage('system', `Mic test готов: ${(blob.size / 1024).toFixed(1)} KB, проигрываю запись.`);
        pushLog('system', `mic test recorded ${blob.size} bytes (${recorder.mimeType})`);
        playLocalAudioUrl(url);
      }, { once: true });

      recorder.start();
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 5000);
    } catch (error) {
      setMicTesting(false);
      addMessage('assistant', `Mic test error: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  const activeConversationId = conversationIdRef.current;

  const assistant = (
    <div className={`${styles.host} ${fullscreen ? styles.hostFullscreen : ''} ${lessonDocked ? styles.hostLessonDocked : ''}`}>
      <SiteKeeper active={open && !lessonContext} state={recording ? 'listening' : avatarSpeaking ? 'speaking' : activity.phase !== 'idle' ? 'thinking' : 'idle'} analyser={avatarAnalyser} />
      <GrammarOctopus speaking={avatarSpeaking} />
      {open && (
        <section
          data-site-character-chat=""
          ref={chatRef}
          className={`${styles.chat} ${fullscreen ? styles.chatFullscreen : ''} ${lessonDocked ? styles.chatLessonDocked : ''}`}
          aria-label="AI tutor assistant"
        >
          <header className={styles.header}>
            <div>
              <h2>{lessonContext ? 'Практика с собеседником' : 'Рикс · помощник'}</h2>
              <div className={styles.statusRow}>
                <span className={`${styles.status} ${styles[status]}`}>{status}</span>
                <span
                  className={`${styles.status} ${styles.activityStatus}`}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {activity.phase !== 'idle' && <i className="pi pi-spinner pi-spin" aria-hidden="true" />}
                  {tutorActivityLabel(activity)}
                </span>
              </div>
            </div>
            <div className={styles.headerActions}>
              <button data-chat-tour="stop" type="button" className={styles.iconButton} title="Остановить озвучку" aria-label="Остановить озвучку" onClick={stopPlayback}>
                <i className="pi pi-stop" aria-hidden="true" />
              </button>
              {!lessonContext && <ChatTour disabled={recording || micTesting || activity.phase !== 'idle' || settingsOpen} onActiveChange={setChatTourActive} onBeforeStart={stopPlayback} />}
              <button data-chat-tour="settings" type="button" className={styles.iconButton} title="Настройки режима и расчёт расходов" aria-label="Настройки режима и расчёт расходов"
                aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}>⚙</button>
              {isAdmin && (
                <>
                  <button type="button" className={styles.iconButton} title="Контекст и история снимков" aria-label="Контекст и история снимков" disabled={status !== 'ready'} onClick={openDebugSnapshot}><i className="pi pi-code" aria-hidden="true" /></button>
                  <a className={styles.iconButton} href={`/tutor/context-studio?live=1${conversationIdRef.current ? `&conversation=${conversationIdRef.current}` : ''}`} target="_blank" rel="noreferrer" title="Наблюдать эту беседу в конструкторе" aria-label="Наблюдать эту беседу в конструкторе"><i className="pi pi-sitemap" aria-hidden="true" /></a>
                  {!lessonContext && <button
                    type="button"
                    className={`${styles.iconButton} ${fullscreen ? styles.iconButtonActive : ''}`}
                    title={fullscreen ? 'Compact chat' : 'Fullscreen chat'}
                    onClick={() => {
                      setFullscreen((v) => !v);
                      setTestMode(true);
                    }}
                  >
                    {fullscreen ? '▣' : '□'}
                  </button>}
                </>
              )}
              <button type="button" className={styles.iconButton} aria-label="Close AI tutor" onClick={closeChat}>
                ×
              </button>
            </div>
          </header>

          {lessonContext && <HumanTutorAvatar compact state={recording ? 'listening' : avatarSpeaking ? 'speaking' : activity.phase !== 'idle' ? 'thinking' : 'idle'} analyser={avatarAnalyser} />}

          <div data-chat-tour="presets" className={styles.presetBar}>
            <TutorPresetPicker compact plansLink data={presets.data} selected={presets.selected} onSelect={selectPreset} disabled={recording || chatTourActive} />
            {presets.error && <p role="alert">{presets.error}</p>}
            {config.ttsMode === 'browser' && <p>Озвучка устройства — бесплатно. {browserVoices.split(',').includes('lv') ? 'Латышский голос доступен.' : 'Латышского голоса на устройстве нет: латышский ответ будет текстом.'}</p>}
            {testMode && <p>Админ: сейчас используются несохранённые настройки.</p>}
          </div>

          <div className={styles.body}>
            {fullscreen && (
              <aside className={styles.conversationRail} aria-label="Tutor conversations">
                <div className={styles.conversationRailHeader}>
                  <span>Диалоги</span>
                  <button type="button" onClick={createNewConversation} disabled={conversationLoading}>
                    Новый
                  </button>
                </div>
                <div className={styles.conversationList}>
                  {conversations.length === 0 && (
                    <div className={styles.conversationEmpty}>
                      {conversationLoading ? 'Загружаю...' : 'Пока нет старых диалогов'}
                    </div>
                  )}
                  {conversations.map((conversation) => (
                    <button
                      type="button"
                      key={conversation.id}
                      className={`${styles.conversationItem} ${
                        conversation.id === activeConversationId ? styles.conversationItemActive : ''
                      }`}
                      disabled={conversationLoading || conversation.id === activeConversationId}
                      onClick={() => loadConversationMessages(conversation.id)}
                    >
                      <span>{conversation.title || 'Новый диалог'}</span>
                      <small>
                        {conversation.messages_count ?? 0} сообщений
                      </small>
                    </button>
                  ))}
                </div>
              </aside>
            )}
            <div data-chat-tour="messages" ref={chatPaneRef} className={styles.chatPane}>
              <div className={styles.messages}>
                {hasMoreOlderMessages && (
                  <button
                    type="button"
                    className={styles.loadMoreMessages}
                    onClick={loadOlderConversationMessages}
                    disabled={olderMessagesLoading}
                  >
                    {olderMessagesLoading ? 'Загружаю...' : 'Загрузить ещё 30'}
                  </button>
                )}
                {messages.map((message) => {
                  const sttHint = getTranscriptionCandidateTooltip(message);
                  return (
                    <div
                      key={message.id}
                      className={`${styles.message} ${styles[message.role]} ${
                        sttHint ? styles.messageWithHint : ''
                      }`}
                      data-tooltip={sttHint || undefined}
                      title={sttHint || undefined}
                    >
                      {lessonContext && message.text === WELCOME_MESSAGE ? 'Привет! Начнём практику по этому заданию.' : message.text}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

            {settingsOpen && (
              <TutorSettingsDialog visible={settingsOpen} onHide={() => setSettingsOpen(false)}>
              <TutorPresetPicker compact data={presets.data} selected={presets.selected} onSelect={selectPreset} disabled={presetSaving} />
              {isAdmin ? <div className={styles.presetSave}>
                <button type="button" disabled={presetSaving || !presets.data} onClick={savePreset}>{presetSaving ? 'Сохраняю…' : 'Сохранить настройки и расчёт в этот пресет для всех'}</button>
                <button type="button" onClick={() => { setTestMode(false); setPresetSaveState(''); }}>Загрузить сохранённые</button>
                {presetSaveState && <p role="status">{presetSaveState}</p>}
              </div> : <p>Параметры задаёт администратор. Вы можете выбрать режим и посмотреть его настройки.</p>}
              {presets.data && <p>Оценка по текущим полям: ≈ {estimatePreset({ config: { ...config, ttsMode: 'api' }, scenario: costInput, loadedScenario: loadedCostInput }, presets.data.commission_percent, undefined, testMode ? undefined : presets.selected).credits?.toFixed(2) ?? '—'} кредитов/час, с комиссией {presetCommissionPercent(testMode ? undefined : presets.selected, presets.data.commission_percent)}%. Поля расчёта описывают примерный час, а не ограничивают реальные запросы.</p>}
              <fieldset disabled={!isAdmin} className={styles.presetFields}>
              <div className={`${styles.testPanel} ${styles.settingsPanel}`}>
                {isAdmin && <div className={styles.testTitle}>
                  <p>Изменения применяются в этом чате для проверки. Кнопка сохранения публикует настройки выбранного пресета для всех.</p>
                  <code>{wsUrl}</code>
                  <div className={styles.logHeader}>
                    <button type="button" onClick={() => { setSettingsOpen(false); openDebugSnapshot(); }} disabled={status !== 'ready'}>
                      fullscreen debug
                    </button>
                  </div>
                </div>}
                <div className={styles.pipelineGrid}>
                  <label>Контекст<select value={config.contextMode} onChange={event => setConfig(previous => ({ ...previous, contextMode: event.target.value }))}>
                    <option value="basic">Короткая история · без подсветки таблиц</option><option value="full">Полный · с подсветкой таблиц</option>
                  </select></label>
                  <label>Долгая память · поиск по старым беседам<select aria-label="Долгая память · поиск по старым беседам" value={config.longMemoryEnabled ? 'on' : 'off'} onChange={event => setConfig(previous => ({ ...previous, longMemoryEnabled: event.target.value === 'on' }))}>
                    <option value="on">Включена</option><option value="off">Выключена</option>
                  </select></label>
                  <label>
                    Pipeline
                    <select
                      value={config.tutorPipeline}
                      disabled
                      onChange={(event) => setConfig((prev) => ({ ...prev, tutorPipeline: event.target.value }))}
                    >
                      <option value="realtime_voice">full voice model</option>
                      <option value="stt_text_tts">STT → text → TTS</option>
                    </select>
                  </label>
                </div>
                <div className={styles.aiSettingsSections}>
                  <section className={styles.aiSettingsSection}>
                    <h4>Распознавание</h4>
                    <div className={styles.selectGrid}>
                  <label>
                    STT
                    <select
                      value={config.transcriptionModel}
                      disabled={!usesSttTextTts}
                      onChange={(event) => {
                        stopPlayback();
                        const transcriptionModel = event.target.value;
                        setConfig(prev => ({ ...prev, transcriptionModel,
                          primaryTranscriptionLanguage: transcriptionModel === BROWSER_SPEECH_MODEL ? prev.primaryTranscriptionLanguage || 'lv' : ['lv', 'ru', ''].includes(prev.primaryTranscriptionLanguage) ? prev.primaryTranscriptionLanguage : '' }));
                      }}
                    >
                      {TUTOR_MODEL_OPTIONS.transcription.map((model) => (
                        <option key={model} value={model} disabled={model === BROWSER_SPEECH_MODEL && !browserSpeechAvailable}>
                          {transcriptionModelLabel(model)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {usesBrowserStt ? 'Язык распознавания' : 'STT language'}
                    <select
                      value={config.primaryTranscriptionLanguage}
                      aria-label={usesBrowserStt ? 'Язык распознавания' : 'STT language'}
                      disabled={!usesSttTextTts}
                      onChange={(event) => {
                        stopPlayback();
                        setConfig((prev) => ({ ...prev, primaryTranscriptionLanguage: event.target.value }));
                      }}
                    >
                      {(usesBrowserStt ? BROWSER_SPEECH_LANGUAGES : TUTOR_MODEL_OPTIONS.transcriptionLanguage).map((language) => (
                        <option key={language.value || 'auto'} value={language.value}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Dual STT
                    <select
                      value={config.dualTranscriptionEnabled ? 'on' : 'off'}
                      disabled={!usesSttTextTts || usesBrowserStt}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          dualTranscriptionEnabled: event.target.value === 'on',
                        }))
                      }
                    >
                      <option value="off">off</option>
                      <option value="on">two models</option>
                    </select>
                  </label>
                  <label>
                    STT 2
                    <select
                      value={config.secondaryTranscriptionModel}
                      disabled={!usesSttTextTts || usesBrowserStt || !config.dualTranscriptionEnabled}
                      onChange={(event) =>
                        setConfig((prev) => ({ ...prev, secondaryTranscriptionModel: event.target.value }))
                      }
                    >
                      {TUTOR_MODEL_OPTIONS.transcription.filter(model => model !== BROWSER_SPEECH_MODEL).map((model) => (
                        <option key={model} value={model}>
                          {transcriptionModelLabel(model)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    STT 2 language
                    <select
                      value={config.secondaryTranscriptionLanguage}
                      disabled={!usesSttTextTts || usesBrowserStt || !config.dualTranscriptionEnabled}
                      onChange={(event) =>
                        setConfig((prev) => ({ ...prev, secondaryTranscriptionLanguage: event.target.value }))
                      }
                    >
                      {TUTOR_MODEL_OPTIONS.transcriptionLanguage.map((language) => (
                        <option key={language.value || 'auto'} value={language.value}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Live STT
                    <select
                      value={config.liveTranscriptionModel}
                      disabled
                      onChange={(event) =>
                        setConfig((prev) => ({ ...prev, liveTranscriptionModel: event.target.value }))
                      }
                    >
                      <option value="">off</option>
                      {TUTOR_MODEL_OPTIONS.liveTranscription.map((model) => (
                        <option key={model} value={model}>
                          {liveTranscriptionModelLabel(model)}
                        </option>
                      ))}
                    </select>
                  </label>
                    </div>
                    <p className={styles.browserSpeechNote}>
                      {usesBrowserStt
                        ? `Распознавание без списания кредитов. Удерживайте кнопку нужного языка, затем отпустите — бот получит текст. «Сложный вопрос» использует последний выбранный язык. В Chrome звук обычно отправляется сервису браузера. ${config.ttsMode === 'browser' ? 'Ответы бота оплачиваются кредитами. Голос устройства бесплатный, если доступен.' : 'Ответы и озвучка оплачиваются отдельно.'}`
                        : !browserSpeechAvailable ? 'Встроенное распознавание недоступно в этом браузере.' : 'Доступен бесплатный вариант распознавания в браузере.'}
                    </p>
                  </section>
                  <section className={styles.aiSettingsSection}>
                    <h4>Мозг</h4>
                    <div className={styles.selectGrid}>
                  <label>
                    Text model
                    <select
                      value={config.tutorModel}
                      disabled={!usesSttTextTts}
                      onChange={(event) => {
                        const model = event.target.value;
                        const efforts = tutorReasoningEfforts(model || gatewayModel);
                        setConfig((prev) => {
                          const effort = efforts.includes(prev.reasoningEffort) ? prev.reasoningEffort : efforts[0] || 'none';
                          return { ...prev, tutorModel: model, reasoningEffort: effort, reasoningEnabled: effort !== 'none' };
                        });
                      }}
                    >
                      <option value="">env default</option>
                      {TUTOR_MODEL_OPTIONS.tutor.map((model) => (
                        <option key={model} value={model}>
                          {textModelLabel(model)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reasoning
                    <select
                      value={reasoningEfforts.length && (config.reasoningEnabled || !reasoningEfforts.includes('none')) ? 'on' : 'off'}
                      disabled={!reasoningEfforts.length || !reasoningEfforts.includes('none')}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          reasoningEnabled: event.target.value === 'on',
                          reasoningEffort:
                            event.target.value === 'on'
                              ? prev.reasoningEffort === 'none'
                                ? 'medium'
                                : prev.reasoningEffort
                              : 'none',
                        }))
                      }
                    >
                      <option value="on">reasoning on</option>
                      <option value="off">no reasoning</option>
                    </select>
                  </label>
                  <label>
                    Reasoning effort
                    <select
                      value={reasoningEfforts.includes(config.reasoningEffort) ? config.reasoningEffort : reasoningEfforts[0] || 'none'}
                      disabled={!reasoningEfforts.length || (!config.reasoningEnabled && reasoningEfforts.includes('none'))}
                      onChange={(event) =>
                        setConfig((prev) => ({ ...prev, reasoningEffort: event.target.value }))
                      }
                    >
                      {(reasoningEfforts.length ? reasoningEfforts : ['none']).map((effort) => (
                        <option key={effort} value={effort}>
                          {effort}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Context compression
                    <select
                      value={config.contextCompressionEnabled ? 'on' : 'off'}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          contextCompressionEnabled: event.target.value === 'on',
                        }))
                      }
                    >
                      <option value="on">on</option>
                      <option value="off">off</option>
                    </select>
                  </label>
                  <label>
                    Summary model
                    <select
                      value={config.contextSummaryModel}
                      disabled={!config.contextCompressionEnabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          contextSummaryModel: event.target.value,
                        }))
                      }
                    >
                      {TUTOR_MODEL_OPTIONS.contextSummaryModel.map((model) => (
                        <option key={model} value={model}>
                          {summaryModelLabel(model)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Message embeddings
                    <select
                      value={config.messageEmbeddingModel}
                      onChange={(event) => setConfig((prev) => ({ ...prev, messageEmbeddingModel: event.target.value }))}
                    >
                      {TUTOR_MODEL_OPTIONS.embedding.map((model) => (
                        <option key={model} value={model}>
                          {embeddingModelLabel(model)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Summary embeddings
                    <select
                      value={config.summaryEmbeddingModel}
                      onChange={(event) => setConfig((prev) => ({ ...prev, summaryEmbeddingModel: event.target.value }))}
                    >
                      {TUTOR_MODEL_OPTIONS.embedding.map((model) => (
                        <option key={model} value={model}>
                          {embeddingModelLabel(model)}
                        </option>
                      ))}
                    </select>
                  </label>
                    </div>
                  </section>
                  <section className={styles.aiSettingsSection}>
                    <h4>Озвучивание</h4>
                    <div className={styles.selectGrid}>
                  <label>
                    Voice model
                    <select
                      value={config.voiceModel}
                      disabled={!usesRealtimeVoice}
                      onChange={(event) => setConfig((prev) => ({ ...prev, voiceModel: event.target.value }))}
                    >
                      {TUTOR_MODEL_OPTIONS.voice.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    TTS
                    <select
                      value={config.ttsModel}
                      disabled={!usesSttTextTts}
                      onChange={(event) => {
                        const ttsModel = event.target.value;
                        rememberedTtsVoicesRef.current[tutorTtsModel(config.ttsModel).provider] = config.ttsVoice;
                        const rememberedVoice = rememberedTtsVoicesRef.current[tutorTtsModel(ttsModel).provider];
                        setConfig((prev) => ({
                          ...prev,
                          ttsModel,
                          ttsVoice: tutorTtsVoice(ttsModel, rememberedVoice),
                        }));
                      }}
                    >
                      {TUTOR_MODEL_OPTIONS.tts.map((model) => (
                        <option key={model} value={model}>
                          {ttsModelLabel(model)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Voice
                    <select
                      value={config.ttsVoice}
                      disabled={!usesSttTextTts}
                      onChange={(event) => setConfig((prev) => ({ ...prev, ttsVoice: event.target.value }))}
                    >
                      {availableTtsVoices.map((voice) => (
                        <option key={voice} value={voice}>
                          {voice}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    TTS start
                    <select
                      value={config.ttsStartMode}
                      disabled={!usesSttTextTts}
                      onChange={(event) => setConfig((prev) => ({ ...prev, ttsStartMode: event.target.value }))}
                    >
                      <option value="first_sentence">after first sentence</option>
                      <option value="full_reply">after full reply</option>
                    </select>
                  </label>
                  <label>
                    Delay
                    <select
                      value={config.liveDelay}
                      disabled={!usesLiveStt}
                      onChange={(event) => setConfig((prev) => ({ ...prev, liveDelay: event.target.value }))}
                    >
                      {TUTOR_MODEL_OPTIONS.liveDelay.map((delay) => (
                        <option key={delay} value={delay}>
                          {delay}
                        </option>
                      ))}
                    </select>
                  </label>
                    </div>
                    {tutorTtsPromotionNote(config.ttsModel) && <p className={styles.ttsPromotionNote}>{tutorTtsPromotionNote(config.ttsModel)}</p>}
                  </section>
                </div>
                <TutorCostPanel
                  input={costInput}
                  onChange={(key, value) => setCostInput(prev => ({ ...prev, [key]: value }))}
                  loadedInput={loadedCostInput}
                  onLoadedChange={(key, value) => setLoadedCostInput(prev => ({ ...prev, [key]: value }))}
                  estimate={costEstimate}
                  pipeline={usesSttTextTts}
                  live={usesLiveStt}
                  dual={config.dualTranscriptionEnabled && !usesBrowserStt}
                  browserRecognition={usesBrowserStt}
                  browserVoice={config.ttsMode === 'browser'}
                  compression={config.contextCompressionEnabled}
                  longMemory={config.longMemoryEnabled}
                  reasoning={costReasoningEnabled}
                  summaryReasoning={costEstimate.summaryReasoningRequired}
                />
              </div>
              </fieldset>
              </TutorSettingsDialog>
            )}

          {isAdmin && debugOpen && (
            <div className={styles.debugOverlay} role="dialog" aria-modal="true" aria-label="Tutor debug">
              <div className={styles.debugModal}>
                <header className={styles.debugHeader}>
                  <div>
                    <h3>AI Tutor Debug</h3>
                    <span>Prompt builder, agent iterations, MCP/tool calls, recent context</span>
                  </div>
                  <div className={styles.debugHeaderActions}>
                    <button type="button" onClick={openDebugDiffReport}>
                      diff context
                    </button>
                    <button type="button" onClick={requestDebugSnapshot} disabled={status !== 'ready'}>
                      refresh
                    </button>
                    <button type="button" onClick={closeDebugSnapshot}>
                      close
                    </button>
                  </div>
                </header>
                <ContextSnapshotWindow
                  snapshots={debugSnapshots}
                  selectedIndex={debugSnapshotIndex}
                  onSelect={setDebugSnapshotIndex}
                />
                <div className={styles.debugGrid}>
                  <section className={styles.debugSection}>
                    <div className={styles.debugSectionHeader}>
                      <h4>Agent Iterations / Tools</h4>
                      <span>{debugSnapshot?.recentAgentIterations?.length || 0} iterations</span>
                    </div>
                    <DebugCodeBlock language="json" value={JSON.stringify(debugAgentTrace, null, 2)} />
                  </section>
                  <section className={styles.debugSection}>
                    <h4>{debugSnapshot?.promptBuilder?.source || 'Prompt builder'}</h4>
                    <DebugCodeBlock value={debugSnapshot?.promptBuilder?.text || 'No debug snapshot yet.'} />
                  </section>
                  <section className={styles.debugSection}>
                    <div className={styles.debugSectionHeader}>
                      <h4>Context sent to model</h4>
                      <span>{getPromptCachePercent(debugSnapshot || undefined)}</span>
                    </div>
                    <DebugCodeBlock language="json" value={JSON.stringify(debugModelContext, null, 2)} />
                  </section>
                  <section className={styles.debugSection}>
                    <div className={styles.debugSectionHeader}>
                      <h4>Browser logs</h4>
                      <span>{logs.length} rows</span>
                    </div>
                    <div className={styles.logs}>
                      {logs.length ? (
                        logs.map((log) => (
                          <div key={log.id} className={styles.logRow}>
                            <span>{log.ts}</span>
                            <b>{log.direction}</b>
                            <code>{log.text}</code>
                          </div>
                        ))
                      ) : (
                        <div className={styles.logRow}>
                          <span>now</span>
                          <b>system</b>
                          <code>Logs are collected only while fullscreen debug is open.</code>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {isAdmin && debugDiffOpen && (
            <div className={styles.debugDiffOverlay} role="dialog" aria-modal="true" aria-label="Tutor context diff">
              <div className={styles.debugDiffModal}>
                <header className={styles.debugDiffHeader}>
                  <div>
                    <h3>Cache / Context Diff</h3>
                    <span>Точная разница между соседними debug snapshots: строки, а внутри изменённых строк каждая буква.</span>
                  </div>
                  <div className={styles.debugDiffHeaderStats}>
                    <span>snapshots: {debugSnapshots.length}</span>
                    <span>oldest: {debugDiffOldestCache.label}</span>
                    <span>newest: {debugDiffNewestCache.label}</span>
                    <button type="button" onClick={() => setDebugDiffOpen(false)}>
                      close
                    </button>
                  </div>
                </header>
                <div className={styles.debugDiffBody}>
                  {debugDiffPairs.length ? (
                    debugDiffPairs.map((pair, index) => (
                      <SnapshotDiffPair
                        key={pair.id}
                        title={pair.title}
                        previousLabel={pair.previousLabel}
                        currentLabel={pair.currentLabel}
                        before={pair.before}
                        after={pair.after}
                        defaultOpen={index === 0}
                      />
                    ))
                  ) : (
                    <div className={styles.debugDiffEmpty}>
                      Нужно хотя бы 2 debug snapshots для сравнения. Я уже запросил свежий snapshot; после ещё одного
                      сообщения или refresh тут появится полный diff.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {memoryOpen && (
            <div className={styles.memoryOverlay} role="dialog" aria-modal="true" aria-label="Tutor memory">
              <div className={styles.memoryModal}>
                <header className={styles.memoryHeader}>
                  <div>
                    <h3>Память бота</h3>
                    <span>Важные заметки и суммаризации по суткам</span>
                  </div>
                  <div className={styles.memoryHeaderActions}>
                    <button type="button" onClick={openMemoryOverview} disabled={memoryLoading}>
                      обновить
                    </button>
                    <button type="button" onClick={() => setMemoryOpen(false)}>
                      закрыть
                    </button>
                  </div>
                </header>
                <div className={styles.memoryBody}>
                  {memoryLoading ? (
                    <div className={styles.memoryEmpty}>Загружаю память...</div>
                  ) : (
                    <>
                      <section className={styles.memorySection}>
                        <div className={styles.memorySectionHeader}>
                          <h4>Важные заметки</h4>
                          <span>{memoryOverview?.notes_total ?? memoryOverview?.important_notes?.length ?? 0}</span>
                        </div>
                        <div className={styles.memoryList}>
                          {(memoryOverview?.important_notes || []).length ? (
                            (memoryOverview?.important_notes || []).map((note) => (
                              <article key={`${note.id || note.key}`} className={styles.memoryItem}>
                                <div>
                                  <b>{note.key || 'заметка'}</b>
                                  <small>
                                    {note.category || 'general'}
                                    {typeof note.importance === 'number' ? ` · importance ${note.importance}` : ''}
                                  </small>
                                </div>
                                <p>{note.content}</p>
                              </article>
                            ))
                          ) : (
                            <div className={styles.memoryEmpty}>Важных заметок пока нет.</div>
                          )}
                        </div>
                      </section>

                      <section className={styles.memorySection}>
                        <div className={styles.memorySectionHeader}>
                          <h4>Суммаризации по суткам</h4>
                          <span>{memoryOverview?.daily_summaries?.length || 0}</span>
                        </div>
                        <div className={styles.memoryList}>
                          {(memoryOverview?.daily_summaries || []).length ? (
                            (memoryOverview?.daily_summaries || []).map((summary) => (
                              <article key={summary.date || createId()} className={styles.memoryItem}>
                                <div>
                                  <b>{summary.date || 'без даты'}</b>
                                  <small>
                                    {(summary.conversations_count || 0).toLocaleString()} диалогов ·{' '}
                                    {(summary.messages_count || 0).toLocaleString()} сообщений
                                  </small>
                                </div>
                                <p>{summary.summary}</p>
                              </article>
                            ))
                          ) : (
                            <div className={styles.memoryEmpty}>
                              Дневных суммаризаций пока нет. Сейчас здесь показываются summary сохранённых диалогов,
                              сгруппированные по датам.
                            </div>
                          )}
                        </div>
                      </section>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <form
            data-chat-tour="composer"
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              if (chatTourActive) return;
              sendText(input);
            }}
          >
            <input
              disabled={chatTourActive}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Напиши команду..."
            />
            <button type="submit" disabled={chatTourActive || status !== 'ready' || conversationLoading || !input.trim() || (!presets.ready && !testMode)}>
              Send
            </button>
          </form>

          {usesBrowserStt && browserSpeechState !== 'idle' && <p className={styles.browserSpeechCaption} role="status" aria-live="polite">
            {browserSpeechState === 'starting' ? 'Запускаю распознавание…' : browserSpeechState === 'stopping' ? 'Завершаю распознавание…' : browserSpeechDraft || 'Говорите…'}
          </p>}
          <div className={styles.footerActions}>
            <TutorVoiceControls
              ready={!chatTourActive && (presets.ready || testMode) && status === 'ready' && !micTesting && !conversationLoading && browserSpeechState !== 'stopping' && (!usesBrowserStt || browserSpeechAvailable)}
              activeMode={recordingMode}
              complexAvailable={complexAvailable}
              browserRecognition={usesBrowserStt}
              recognitionLanguage={config.primaryTranscriptionLanguage || 'lv'}
              onStart={startRecording}
              onStop={stopRecording}
            />
            {isAdmin && (
              <button type="button" onClick={runMicTest} disabled={chatTourActive || recording || micTesting}>
                {micTesting ? 'Тест 5 сек...' : 'Тест микрофона'}
              </button>
            )}
            <button data-chat-tour="memory" type="button" disabled={chatTourActive} onClick={openMemoryOverview}>
              Память
            </button>
            <label className={styles.autoScrollToggle}>
              <input
                type="checkbox"
                checked={autoScrollEnabled}
                onChange={(event) => setAutoScrollEnabled(event.target.checked)}
              />
              автоскролл
            </label>
          </div>
        </section>
      )}

      {(!lessonContext || !open) && (
        <button
          ref={bubbleRef}
          type="button"
          className={`${styles.bubble} ${open ? styles.bubbleOpen : ''}`}
          aria-label={open ? 'Close AI tutor' : 'Open AI tutor'}
          onClick={() => {
            if (open) closeChat();
            else {
              void pcmPlayer().unlock();
              setOpen(true);
            }
          }}
        >
          {open ? '×' : 'AI'}
        </button>
      )}
    </div>
  );
  return lessonDocked ? createPortal(assistant, lessonTutorSlot) : assistant;
}
