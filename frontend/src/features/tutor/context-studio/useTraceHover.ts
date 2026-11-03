import { useEffect, useId, useState, type FocusEvent, type MouseEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { META, SOURCE_LABELS, type FlowGraph, type FlowNode, type TraceEvent } from './flowEditor';
import { edgeTracePreview, nodeTracePreview, type HoverTarget } from './tracePreview';

export function useTraceHover(graph: FlowGraph, events: TraceEvent[], fullData = false) {
  const [target, setTarget] = useState<HoverTarget | null>(null);
  const [highlight, setHighlight] = useState<{ kind: 'node' | 'edge'; id: string } | null>(null);
  const id = useId();
  const close = () => setTarget(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setTarget(null); };
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-tutor-trace-preview], .react-flow__handle, .react-flow__edge')) setTarget(null);
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', escape); window.removeEventListener('pointerdown', outside); };
  }, []);
  const open = (kind: HoverTarget['kind'], itemId: string, x: number, y: number, port: Pick<HoverTarget, 'handleId' | 'direction'> = {}) => {
    setTarget(current => current?.kind === kind && current.id === itemId && current.handleId === port.handleId && current.direction === port.direction ? null : { kind, id: itemId, x, y, ...port });
  };
  const portClick = (event: MouseEvent<HTMLDivElement>) => {
    const port = event.target instanceof Element ? event.target.closest('.react-flow__handle') : null;
    const nodeId = port?.closest('.react-flow__node')?.getAttribute('data-id');
    if (port && nodeId) { const handleId = port.getAttribute('data-handleid') ?? undefined; open('node', nodeId, event.clientX, event.clientY, { handleId: handleId?.startsWith('event-link:') ? 'out' : handleId, direction: port.classList.contains('source') ? 'source' : 'target' }); }
  };
  const activate = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const element = event.target instanceof Element ? event.target.closest('.react-flow__handle, .react-flow__edge') : null;
    if (!element) return;
    const node = element.closest('.react-flow__node'), itemId = node?.getAttribute('data-id') ?? element.getAttribute('data-id');
    if (!itemId) return;
    event.preventDefault(); event.stopPropagation();
    const rect = element.getBoundingClientRect(), handleId = element.getAttribute('data-handleid') ?? undefined; open(node ? 'node' : 'edge', itemId, rect.left + rect.width / 2, rect.top + Math.min(40, rect.height), node ? { handleId: handleId?.startsWith('event-link:') ? 'out' : handleId, direction: element.classList.contains('source') ? 'source' : 'target' } : {});
  };
  const focus = (event: FocusEvent<HTMLDivElement>) => {
    const element = event.target.closest('.react-flow__node, .react-flow__edge'), itemId = element?.getAttribute('data-id');
    if (element && itemId) setHighlight({ kind: element.classList.contains('react-flow__node') ? 'node' : 'edge', id: itemId });
  };
  const leave = () => setHighlight(null);
  const node = target?.kind === 'node' ? graph.nodes.find(node => node.id === target.id) : undefined;
  const edge = target?.kind === 'edge' ? graph.edges.find(edge => edge.id === target.id) : undefined;
  const label = (node?: FlowNode) => !node ? 'Удалённый узел' : `${(node.data.runtimeCard as { title?: string } | undefined)?.title ?? (node.type === 'source' ? SOURCE_LABELS[String(node.data.source)] ?? META.source.label : META[node.type].label)} · ${node.id}`;
  return { target: node || edge ? target : null, highlight, id, title: edge ? `${label(graph.nodes.find(node => node.id === edge.source))} → ${label(graph.nodes.find(node => node.id === edge.target))}` : label(node),
    preview: edge ? edgeTracePreview(edge, events, fullData ? Infinity : 4000) : nodeTracePreview(node?.id ?? '', events, fullData ? Infinity : 4000, target ?? undefined), close, leave, focus, portClick, activate,
    onNodeMouseEnter: (_event: MouseEvent, node: { id: string }) => setHighlight({ kind: 'node', id: node.id }),
    onEdgeMouseEnter: (_event: MouseEvent, edge: { id: string }) => setHighlight({ kind: 'edge', id: edge.id }),
    onEdgeClick: (event: MouseEvent, edge: { id: string }) => open('edge', edge.id, event.clientX, event.clientY),
  };
}
