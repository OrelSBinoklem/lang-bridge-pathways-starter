const sentenceSegmenter = new Intl.Segmenter('lv', { granularity: 'sentence' });
const normalize = (text) => String(text || '').replace(/\s+/gu, ' ').trim();

function finishedSentenceLength(text, complete) {
  for (const item of sentenceSegmenter.segment(text)) {
    const end = item.index + item.segment.length;
    const finished = end < text.length || complete || /[.!?\u2026]["'\u201d\u00bb)]*\s+$/u.test(item.segment);
    if (!finished) break;
    // Do not speak list markers, decimals or punctuation on their own.
    if (/\p{L}/u.test(item.segment)) return end;
  }
  return 0;
}

export function createEarlySpeech({ speak, onError, isActive = () => true }) {
  const controller = new AbortController();
  const offsets = [];
  const spoken = [];
  let tail = Promise.resolve();
  let count = 0;
  let failed = false;
  let finished = false;
  let firstRequestAt = null;
  function cancel() { controller.abort(); }
  function enqueue(segment) {
    const index = count++;
    spoken.push(segment.text);
    tail = tail.then(async () => {
      if (controller.signal.aborted || failed || !isActive()) return;
      firstRequestAt ??= Date.now();
      await speak(segment, index, controller.signal);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      failed = true;
      cancel();
      onError(error);
    });
  }
  function update(segments) {
    if (finished || controller.signal.aborted) return;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (!segment) break;
      let offset = offsets[index] || 0;
      while (offset < segment.text.length) {
        const remaining = segment.text.slice(offset);
        const length = finishedSentenceLength(remaining, segment.complete);
        if (!length) break;
        offsets[index] = offset + length;
        enqueue({ ...segment, text: remaining.slice(0, length).trim() });
        offset += length;
      }
      if (!segment.complete) break;
    }
  }
  return {
    update,
    cancel,
    get started() { return count > 0; },
    get firstRequestAt() { return firstRequestAt; },
    get done() { return tail; },
    finish(segments) {
      if (finished || controller.signal.aborted) return;
      const expected = normalize(segments.map((segment) => segment.text).join(' '));
      const emitted = normalize(spoken.join(' '));
      if (emitted && expected !== emitted && !expected.startsWith(`${emitted} `)) {
        cancel();
        onError(new Error('streamed_speech_does_not_match_final_reply'));
        return;
      }
      update(segments.map((segment) => ({ ...segment, complete: true })));
      finished = true;
    },
  };
}
