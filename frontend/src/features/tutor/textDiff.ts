/**
 * Text diff for the tutor debug panel: an exact line diff (Myers), and inside the lines that were
 * edited a word diff refined to single characters, so every changed letter is marked.
 *
 * Pure functions, no imports: they can be run and tested outside the browser.
 */

export type Op = 'equal' | 'delete' | 'insert';

/**
 * Myers O(ND) diff of two sequences. Returns the edit script, or null when more than `maxEdits`
 * edits would be needed (the caller then falls back to something coarser, never to a wrong result).
 */
export function diffSequences<T>(a: readonly T[], b: readonly T[], maxEdits: number): Op[] | null {
  const n = a.length;
  const m = b.length;

  let start = 0;
  while (start < n && start < m && a[start] === b[start]) start += 1;
  let endA = n;
  let endB = m;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const core = myers(a, start, endA - start, b, start, endB - start, maxEdits);
  if (!core) return null;

  const ops: Op[] = [];
  for (let i = 0; i < start; i += 1) ops.push('equal');
  for (const op of core) ops.push(op);
  for (let i = endA; i < n; i += 1) ops.push('equal');
  return ops;
}

function myers<T>(
  a: readonly T[],
  aOffset: number,
  n: number,
  b: readonly T[],
  bOffset: number,
  m: number,
  maxEdits: number,
): Op[] | null {
  if (n === 0) return new Array<Op>(m).fill('insert');
  if (m === 0) return new Array<Op>(n).fill('delete');

  const max = Math.min(n + m, maxEdits);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  // history[d] holds the furthest x per diagonal after step d (diagonal k at index k + d).
  const history: Int32Array[] = [];
  let found = -1;

  for (let d = 0; d <= max && found < 0; d += 1) {
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
      else x = v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[aOffset + x] === b[bOffset + y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    history.push(v.slice(offset - d, offset + d + 1));
  }
  if (found < 0) return null;

  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d -= 1) {
    const previous = history[d - 1];
    const shift = d - 1;
    const k = x - y;
    const fromAbove = k === -d || (k !== d && previous[k - 1 + shift] < previous[k + 1 + shift]);
    const previousK = fromAbove ? k + 1 : k - 1;
    const previousX = previous[previousK + shift];
    const previousY = previousX - previousK;
    const editX = fromAbove ? previousX : previousX + 1;
    while (x > editX) {
      ops.push('equal');
      x -= 1;
      y -= 1;
    }
    ops.push(fromAbove ? 'insert' : 'delete');
    x = previousX;
    y = previousY;
  }
  while (x > 0) {
    ops.push('equal');
    x -= 1;
  }
  return ops.reverse();
}

export type Part = { text: string; changed: boolean };

function mergeParts(parts: Part[]) {
  const merged: Part[] = [];
  for (const part of parts) {
    if (!part.text) continue;
    const last = merged[merged.length - 1];
    if (last && last.changed === part.changed) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}

const TOKEN_PATTERN = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]+/gu;

/** Diff of two strings by single characters (code points), or all-changed when it is too costly. */
function charSpans(before: string, after: string) {
  const a = Array.from(before);
  const b = Array.from(after);
  const ops = diffSequences(a, b, 400);
  if (!ops) {
    return { a: [{ text: before, changed: true }], b: [{ text: after, changed: true }] };
  }
  const aParts: Part[] = [];
  const bParts: Part[] = [];
  let i = 0;
  let j = 0;
  for (const op of ops) {
    if (op === 'equal') {
      aParts.push({ text: a[i], changed: false });
      bParts.push({ text: b[j], changed: false });
      i += 1;
      j += 1;
    } else if (op === 'delete') {
      aParts.push({ text: a[i], changed: true });
      i += 1;
    } else {
      bParts.push({ text: b[j], changed: true });
      j += 1;
    }
  }
  return { a: aParts, b: bParts };
}

export type InlineDiff = {
  a: Part[];
  b: Part[];
  /** Share of unchanged characters, 0..1; used to decide whether two lines are versions of each other. */
  similarity: number;
};

/**
 * Which characters differ between two versions of one line. Words are matched first (so unrelated
 * letters are not paired up), then each replaced word is refined character by character.
 */
export function inlineDiff(before: string, after: string): InlineDiff {
  if (before === after) {
    return { a: [{ text: before, changed: false }], b: [{ text: after, changed: false }], similarity: 1 };
  }

  const tokensA = before.match(TOKEN_PATTERN) || [];
  const tokensB = after.match(TOKEN_PATTERN) || [];
  const ops = diffSequences(tokensA, tokensB, 800);
  let aParts: Part[] = [];
  let bParts: Part[] = [];

  if (!ops) {
    const spans = charSpans(before, after);
    aParts = spans.a;
    bParts = spans.b;
  } else {
    let i = 0;
    let j = 0;
    let removed = '';
    let inserted = '';
    const flush = () => {
      if (removed && inserted) {
        const spans = charSpans(removed, inserted);
        aParts.push(...spans.a);
        bParts.push(...spans.b);
      } else {
        if (removed) aParts.push({ text: removed, changed: true });
        if (inserted) bParts.push({ text: inserted, changed: true });
      }
      removed = '';
      inserted = '';
    };
    for (const op of ops) {
      if (op === 'equal') {
        flush();
        aParts.push({ text: tokensA[i], changed: false });
        bParts.push({ text: tokensB[j], changed: false });
        i += 1;
        j += 1;
      } else if (op === 'delete') {
        removed += tokensA[i];
        i += 1;
      } else {
        inserted += tokensB[j];
        j += 1;
      }
    }
    flush();
  }

  aParts = mergeParts(aParts);
  bParts = mergeParts(bParts);
  const unchanged = aParts.reduce((total, part) => total + (part.changed ? 0 : part.text.length), 0);
  return { a: aParts, b: bParts, similarity: unchanged / Math.max(before.length, after.length, 1) };
}

export type DiffRow =
  | { kind: 'equal'; oldNo: number; newNo: number; parts: Part[] }
  | { kind: 'delete'; oldNo: number; parts: Part[] }
  | { kind: 'insert'; newNo: number; parts: Part[] };

export type DiffResult = {
  rows: DiffRow[];
  addedLines: number;
  removedLines: number;
  /** Characters marked as changed on the removed / added side. */
  removedChars: number;
  addedChars: number;
  /** True when the document was too different for an exact line diff and the middle was replaced whole. */
  approximate: boolean;
};

type NumberedLine = { no: number; text: string };

const PAIR_THRESHOLD = 0.5;
const LOOKAHEAD_THRESHOLD = 0.6;
const LOOKAHEAD = 6;
const MAX_PAIRING_BLOCK = 400;

const plain = (text: string): Part[] => [{ text, changed: false }];

/**
 * A block of consecutive removed and added lines: lines that are versions of each other are put
 * next to each other with their changed characters marked, the rest stay whole-line removals/additions.
 */
function pairBlock(removed: NumberedLine[], added: NumberedLine[]): DiffRow[] {
  const rows: DiffRow[] = [];
  const del = (line: NumberedLine, parts?: Part[]) =>
    rows.push({ kind: 'delete', oldNo: line.no, parts: parts || plain(line.text) });
  const ins = (line: NumberedLine, parts?: Part[]) =>
    rows.push({ kind: 'insert', newNo: line.no, parts: parts || plain(line.text) });

  if (removed.length > MAX_PAIRING_BLOCK || added.length > MAX_PAIRING_BLOCK || !removed.length || !added.length) {
    removed.forEach((line) => del(line));
    added.forEach((line) => ins(line));
    return rows;
  }

  let i = 0;
  let j = 0;
  while (i < removed.length && j < added.length) {
    const direct = inlineDiff(removed[i].text, added[j].text);
    if (direct.similarity >= PAIR_THRESHOLD) {
      del(removed[i], direct.a);
      ins(added[j], direct.b);
      i += 1;
      j += 1;
      continue;
    }

    let skipped = false;
    for (let step = 1; step <= LOOKAHEAD && !skipped; step += 1) {
      if (j + step < added.length && inlineDiff(removed[i].text, added[j + step].text).similarity >= LOOKAHEAD_THRESHOLD) {
        for (let t = 0; t < step; t += 1) ins(added[j + t]);
        j += step;
        skipped = true;
      } else if (i + step < removed.length && inlineDiff(removed[i + step].text, added[j].text).similarity >= LOOKAHEAD_THRESHOLD) {
        for (let t = 0; t < step; t += 1) del(removed[i + t]);
        i += step;
        skipped = true;
      }
    }
    if (!skipped) {
      del(removed[i]);
      ins(added[j]);
      i += 1;
      j += 1;
    }
  }
  for (; i < removed.length; i += 1) del(removed[i]);
  for (; j < added.length; j += 1) ins(added[j]);
  return rows;
}

export function diffText(before: string, after: string): DiffResult {
  const linesA = before.split('\n');
  const linesB = after.split('\n');
  let approximate = false;
  let ops = diffSequences(linesA, linesB, 3000);

  if (!ops) {
    // Too many edits for the exact algorithm: keep the shared head and tail, replace the middle whole.
    approximate = true;
    let head = 0;
    while (head < linesA.length && head < linesB.length && linesA[head] === linesB[head]) head += 1;
    let tail = 0;
    while (
      tail < linesA.length - head &&
      tail < linesB.length - head &&
      linesA[linesA.length - 1 - tail] === linesB[linesB.length - 1 - tail]
    ) {
      tail += 1;
    }
    ops = [
      ...new Array<Op>(head).fill('equal'),
      ...new Array<Op>(linesA.length - head - tail).fill('delete'),
      ...new Array<Op>(linesB.length - head - tail).fill('insert'),
      ...new Array<Op>(tail).fill('equal'),
    ];
  }

  const rows: DiffRow[] = [];
  let oldNo = 1;
  let newNo = 1;
  let removed: NumberedLine[] = [];
  let added: NumberedLine[] = [];
  const flush = () => {
    if (!removed.length && !added.length) return;
    for (const row of pairBlock(removed, added)) rows.push(row);
    removed = [];
    added = [];
  };

  for (const op of ops) {
    if (op === 'equal') {
      flush();
      rows.push({ kind: 'equal', oldNo, newNo, parts: plain(linesA[oldNo - 1]) });
      oldNo += 1;
      newNo += 1;
    } else if (op === 'delete') {
      removed.push({ no: oldNo, text: linesA[oldNo - 1] });
      oldNo += 1;
    } else {
      added.push({ no: newNo, text: linesB[newNo - 1] });
      newNo += 1;
    }
  }
  flush();

  let addedLines = 0;
  let removedLines = 0;
  let addedChars = 0;
  let removedChars = 0;
  for (const row of rows) {
    if (row.kind === 'insert') {
      addedLines += 1;
      addedChars += row.parts.reduce((total, part) => total + (part.changed ? part.text.length : 0), 0);
    } else if (row.kind === 'delete') {
      removedLines += 1;
      removedChars += row.parts.reduce((total, part) => total + (part.changed ? part.text.length : 0), 0);
    }
  }
  return { rows, addedLines, removedLines, addedChars, removedChars, approximate };
}

export type FoldedSegment =
  | { type: 'rows'; rows: DiffRow[] }
  | { type: 'fold'; rows: DiffRow[] };

/** Unchanged stretches longer than the context around changes become collapsible folds. */
export function foldRows(rows: DiffRow[], context = 3): FoldedSegment[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  rows.forEach((row, index) => {
    if (row.kind === 'equal') return;
    for (let i = Math.max(0, index - context); i <= Math.min(rows.length - 1, index + context); i += 1) keep[i] = true;
  });

  const segments: FoldedSegment[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const type = keep[index] ? 'rows' : 'fold';
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.rows.push(rows[index]);
    else segments.push({ type, rows: [rows[index]] });
  }
  // A fold of one or two lines saves nothing; show it.
  return segments.map((segment) => (segment.type === 'fold' && segment.rows.length <= 2 ? { type: 'rows', rows: segment.rows } : segment));
}

/**
 * Pretty JSON keeps a long text (the tutor rules, a route guide) on one line with `\n` escapes, which
 * hides where exactly it changed. Each escaped line break starts a new display line instead.
 */
export function expandEscapedNewlines(json: string): string {
  const out: string[] = [];
  for (const line of json.split('\n')) {
    const indent = line.match(/^\s*/)?.[0] ?? '';
    const pieces: string[] = [];
    let start = 0;
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] !== '\\') continue;
      if (line[i + 1] === 'n') {
        pieces.push(line.slice(start, i + 2));
        start = i + 2;
      }
      i += 1;
    }
    pieces.push(line.slice(start));
    pieces.forEach((piece, index) => out.push(index === 0 ? piece : `${indent}  ${piece}`));
  }
  return out.join('\n');
}
