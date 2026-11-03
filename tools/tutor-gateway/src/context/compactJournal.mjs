import { compressTutorContext } from '../agent/contextCompressor.mjs';
import { canonicalJson, userMessageCount } from '../../../../resources/tutor-flow/journal.mjs';

export async function compactJournal(builder, { keepPairs = 5, durable = null, model, signal, isActive = () => true, compress = compressTutorContext } = {}) {
  let batches = 0, records = 0;
  let usageSeen = false;
  const usage = { input_tokens: 0, output_tokens: 0, input_tokens_details: { cached_tokens: 0 } };
  while (isActive()) {
    signal?.throwIfAborted();
    const messages = builder.journalCompressionMessages({ keepPairs, force: true });
    if (!messages.length) break;
    if (new TextEncoder().encode(canonicalJson(messages)).length > 140000) throw new Error('Одна реплика слишком велика для безопасного сжатия. История сохранена.');
    const result = await compress({ previousSummary: builder.contextSummary, messages, model, signal });
    signal?.throwIfAborted();
    if (!isActive()) throw new Error('Сжатие остановлено.');
    if (!result.ok || !result.summary.trim()) throw new Error('Не удалось сжать беседу. Переписка и параметры сохранены; повторите позже.');
    if (result.metadata?.usage) {
      usageSeen = true;
      usage.input_tokens += Number(result.metadata.usage.input_tokens || 0);
      usage.output_tokens += Number(result.metadata.usage.output_tokens || 0);
      usage.input_tokens_details.cached_tokens += Number(result.metadata.usage.input_tokens_details?.cached_tokens || 0);
    }
    builder.applyJournalSummary(result.summary, messages, { ...result.metadata, model, keepPairs });
    if (durable) await durable.save();
    batches++; records += messages.length;
  }
  return { batches, records, retainedUserMessages: userMessageCount(builder.messages), summaryThroughId: builder.summaryThroughId,
    usage: usageSeen ? usage : null,
    summary: builder.contextSummary, parameter_state: builder.parameterSnapshot, message_stream: builder.journalMessages() };
}
