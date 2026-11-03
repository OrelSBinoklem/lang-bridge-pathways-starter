// Read incomplete JSON without repairing it or exposing JSON syntax as speech.
export function readSpeechPrefix(source) {
  let cursor = 0;
  const completed = new Set();
  const whitespace = () => { while (/\s/.test(source[cursor] || '') && cursor < source.length) cursor += 1; };
  function string() {
    const start = cursor++;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === '"') {
        cursor += 1;
        return { value: JSON.parse(source.slice(start, cursor)), complete: true };
      }
      if (char === '\\') {
        const length = source[cursor + 1] === 'u' ? 6 : 2;
        if (cursor + length > source.length) break;
        cursor += length;
      } else cursor += 1;
    }
    let value = JSON.parse(`${source.slice(start, cursor)}"`);
    if (/[\uD800-\uDBFF]$/.test(value)) value = value.slice(0, -1);
    cursor = source.length;
    return { value, complete: false };
  }
  function value(path = []) {
    whitespace();
    const char = source[cursor];
    if (char === '"') return string();
    if (char === '{' || char === '[') {
      const object = char === '{';
      const result = object ? Object.create(null) : [];
      const closing = object ? '}' : ']';
      cursor += 1;
      whitespace();
      while (cursor < source.length && source[cursor] !== closing) {
        let key = result.length;
        if (object) {
          if (source[cursor] !== '"') throw new Error('invalid_json_key');
          const token = string();
          if (!token.complete) return { value: result, complete: false };
          key = token.value;
          if (Object.hasOwn(result, key)) throw new Error('duplicate_json_key');
          whitespace();
          if (cursor === source.length) return { value: result, complete: false };
          if (source[cursor++] !== ':') throw new Error('invalid_json_separator');
        }
        const child = value([...path, key]);
        if (child.value !== undefined) result[key] = child.value;
        if (!child.complete) return { value: result, complete: false };
        whitespace();
        if (source[cursor] === closing) break;
        if (cursor === source.length) return { value: result, complete: false };
        if (source[cursor++] !== ',') throw new Error('invalid_json_separator');
        whitespace();
      }
      if (source[cursor] !== closing) return { value: result, complete: false };
      cursor += 1;
      completed.add(path.join('.'));
      return { value: result, complete: true };
    }
    const start = cursor;
    while (cursor < source.length && !/[\s,}\]]/.test(source[cursor])) cursor += 1;
    if (cursor === source.length) return { value: undefined, complete: false };
    return { value: JSON.parse(source.slice(start, cursor)), complete: true };
  }
  try {
    const root = value().value;
    if (!root || Array.isArray(root) || !Object.hasOwn(root, 'command') || root.command !== null) return null;
    const segments = Array.isArray(root.speech_segments) ? root.speech_segments : [];
    return segments.map((segment, index) => {
      const complete = completed.has(`speech_segments.${index}`);
      // Metadata must be available before speaking, especially for dialogue roles.
      if (typeof segment?.text !== 'string' || (!complete &&
          (typeof segment.style !== 'string' || typeof segment.speaker !== 'string'))) return null;
      return {
        text: segment.text,
        style: segment.style || 'neutral_teacher',
        speaker: ['tutor', 'dialogue_a', 'dialogue_b'].includes(segment.speaker) ? segment.speaker : 'tutor',
        complete,
      };
    });
  } catch {
    return null;
  }
}

export async function* readSseEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = block.split(/\r?\n/).filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart()).join('\n');
        if (data && data !== '[DONE]') yield JSON.parse(data);
      }
      if (done) {
        if (buffer.trim()) throw new Error('incomplete_sse_event');
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readTutorResponseStream(response, { onSpeechPrefix, startedAt }) {
  let text = '';
  let firstTextMs = null;
  let firstSpeechTextMs = null;
  for await (const event of readSseEvents(response.body)) {
    if (event.type === 'response.output_text.delta') {
      firstTextMs ??= Date.now() - startedAt;
      text += event.delta || '';
      const prefix = readSpeechPrefix(text);
      if (prefix) {
        firstSpeechTextMs ??= prefix.some((segment) => segment?.text) ? Date.now() - startedAt : null;
        onSpeechPrefix(prefix);
      }
    } else if (['response.completed', 'response.incomplete', 'response.failed'].includes(event.type)) {
      if (!event.response) throw new Error('missing_stream_response');
      return { payload: event.response, timing: { firstTextMs, firstSpeechTextMs } };
    } else if (event.type === 'error') {
      throw new Error(event.message || event.error?.message || 'response_stream_failed');
    }
  }
  throw new Error('response_stream_ended_without_result');
}
