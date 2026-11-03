/** Shared Node service request serializer. Never promotes task data into developer instructions. */
export function assembleServiceInput(plan, input, variables = {}) {
  const request = input.filter(item => item.role !== 'developer');
  const instructions = [], parts = [];
  for (const part of plan.parts) {
    if (part.kind === 'prompt') {
      const text = part.text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (all, key) => Object.hasOwn(variables, key) ? String(variables[key]) : all);
      const message = { role: 'developer', content: text }; instructions.push(message); parts.push({ kind: 'prompt', messages: [message], port: part.port });
    } else parts.push({ kind: 'source', messages: part.source === 'request' ? request : [{ role: 'user', content: JSON.stringify(variables) }], port: part.port });
  }
  if (plan.format === 'messages' && plan.mode === 'object') return parts.flatMap(part => part.messages);
  const data = {};
  for (const part of parts) if (part.kind === 'source') {
    const key = plan.inputs.find(input => input.id === part.port).key;
    data[key] = [...(data[key] ?? []), ...part.messages];
  }
  const asText = data => Object.entries(data).map(([key, value]) => `${key}:\n${JSON.stringify(value)}`).join('\n\n');
  const assembled = plan.mode === 'json' ? JSON.stringify(data) : plan.mode === 'text' ? asText(data) : data;
  const content = plan.format === 'json' ? JSON.stringify(assembled) : typeof assembled === 'string' ? assembled : asText(assembled);
  return [...instructions, { role: 'user', content }];
}
