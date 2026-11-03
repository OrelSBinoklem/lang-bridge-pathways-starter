import handlers from '../../../../../resources/tutor-flow/command-handlers.json';

/** handler accepts a whitelisted handler id or a structured command name.
 * service accepts grammar_search, grammar_table or web_search. Unknowns render nothing. */
export function HandlerSourceLinks({ handler, service }: { handler?: string; service?: string }) {
  const selected = handlers.find(item => item.id === handler)
    ?? handlers.find(item => item.kind === 'command' && item.id !== 'structured-command' && item.commands.includes(handler ?? ''))
    ?? handlers.find(item => item.kind === 'mcp' && item.service === service)
    ?? handlers.find(item => item.kind === 'command' && item.commands.includes(handler ?? ''));
  if (!selected) return null;
  return <a href={`/tutor/context-studio/source?handler=${encodeURIComponent(selected.id)}`} target="_blank" rel="noopener noreferrer" title={`${selected.sourceFile} · ${selected.contractFile}`}>
    <i className="pi pi-code" aria-hidden="true" /> Исходник и контракт · {selected.label}
  </a>;
}
