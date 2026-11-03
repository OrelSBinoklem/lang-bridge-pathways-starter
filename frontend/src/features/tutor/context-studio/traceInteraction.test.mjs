import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { defaultFlow } from '../../../../../resources/tutor-flow/graph.mjs';

function compile(file, require = () => { throw Error('Unexpected import'); }) {
  const compiled = { exports: {} };
  new Function('exports', 'require', ts.transpileModule(readFileSync(new URL(`./${file}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(compiled.exports, require);
  return compiled.exports;
}
class ElementFixture {
  constructor(matches = {}, id = null) { this.matches = matches; this.id = id; this.classList = { contains: name => name === 'react-flow__node' && id === 'source_2' }; }
  closest(selector) { return this.matches[selector] ?? null; }
  getAttribute(name) { return name === 'data-id' ? this.id : null; }
  getBoundingClientRect() { return { left: 10, top: 20, width: 12, height: 12 }; }
}

test('trace window opens only on explicit edge/port activation; hover, focus and card controls never open it', () => {
  const previousWindow = globalThis.window, previousElement = globalThis.Element;
  const listeners = new Map(), cleanups = [], state = []; let index = 0, first = true;
  globalThis.Element = ElementFixture;
  globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  try {
    const react = {
      useState(initial) { const slot = index++; if (!(slot in state)) state[slot] = initial; return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }]; },
      useId: () => 'preview', useEffect: fn => { if (first) cleanups.push(fn()); },
    };
    const deps = { react, './flowEditor': compile('flowEditor'), './tracePreview': compile('tracePreview') };
    const { useTraceHover } = compile('useTraceHover', name => deps[name]);
    const Render = () => { index = 0; const result = useTraceHover(defaultFlow(), []); first = false; return result; };
    let hook = Render(); const node = new ElementFixture({}, 'source_2');
    const body = new ElementFixture({ '.react-flow__node, .react-flow__edge': node });
    hook.onNodeMouseEnter({}, node); hook.focus({ target: body }); hook.portClick({ target: body });
    hook = Render(); assert.equal(hook.target, null); assert.equal(hook.highlight.id, 'source_2');
    const edge = defaultFlow().edges[0];
    hook.onEdgeMouseEnter({}, edge); hook = Render(); assert.equal(hook.target, null);
    hook.onEdgeClick({ clientX: 50, clientY: 60 }, edge);
    hook = Render(); assert.equal(hook.target.id, edge.id);
    hook.leave(); hook = Render(); assert.equal(hook.target.id, edge.id, 'Moving off a clicked connection must not dismiss the window');
    listeners.get('pointerdown')({ target: body }); hook = Render(); assert.equal(hook.target, null);
    const port = new ElementFixture({ '.react-flow__node': node });
    const portTarget = new ElementFixture({ '.react-flow__handle': port });
    hook.portClick({ target: portTarget, clientX: 10, clientY: 20 }); hook = Render(); assert.equal(hook.target.id, node.id);
    const popup = new ElementFixture(); popup.matches['[data-tutor-trace-preview], .react-flow__handle, .react-flow__edge'] = popup;
    listeners.get('pointerdown')({ target: popup }); hook = Render(); assert(hook.target);
    listeners.get('keydown')({ key: 'Escape' }); hook = Render(); assert.equal(hook.target, null);
    hook.activate({ key: 'Enter', target: body }); hook = Render(); assert.equal(hook.target, null);
    const keyboardPort = new ElementFixture({ '.react-flow__handle, .react-flow__edge': port });
    hook.activate({ key: 'Enter', target: keyboardPort, preventDefault() {}, stopPropagation() {} }); hook = Render(); assert.equal(hook.target.id, node.id);
  } finally {
    for (const cleanup of cleanups) cleanup?.();
    assert.equal(listeners.size, 0);
    globalThis.window = previousWindow; globalThis.Element = previousElement;
  }
});
