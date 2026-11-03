import { timingSafeEqual } from 'node:crypto';

export const SERVICE_BOTS = ['examiner', 'translation', 'reference', 'daily_summary', 'dialogue_summary', 'exam_stt_primary', 'exam_stt_secondary'];
export function serviceNodeId(graph, role, kind) { return graph?.nodes?.find(node => node.type === kind && node.data?.role === role)?.id ?? ({ prompt: 'instructions', source: 'data', model: 'model', reply: 'result' }[kind] ?? kind); }
export function serviceGraph(botId, body = {}) {
  const developers = (Array.isArray(body.input) ? body.input : []).filter(item => item.role === 'developer').map(item => typeof item.content === 'string' ? item.content : JSON.stringify(item.content));
  const nodes = [
    { id: 'instructions', type: 'prompt', data: { text: String(developers.join('\n\n') || body.prompt || 'Инструкции сервиса').slice(0, 300) } },
    { id: 'data', type: 'source', data: { source: 'recent_context', title: 'Данные задания и ответа' } },
    { id: 'model', type: 'model', data: { model: body.model || 'Настройки сервиса' } },
    { id: 'result', type: 'reply', data: { title: 'Ответ провайдера · проверяется сервисом' } },
  ].map((node, index) => ({ ...node, position: { x: index * 350, y: 0 } }));
  return { version: 2, name: botId, nodes, edges: nodes.slice(1).map((node, index) => ({ id: `service_${index}`, source: nodes[index].id, target: node.id, sourceHandle: 'out', targetHandle: 'in' })) };
}

export async function handleServiceCapture(req, res, { archive, secret, limit = 2100000 }) {
  const respond = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  const provided = String(req.headers['x-tutor-debug'] || '');
  if (!secret || secret.length < 32 || Buffer.byteLength(provided) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) { respond(403, { error: 'forbidden' }); return; }
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > limit) { respond(413, { error: 'oversized' }); return; } chunks.push(chunk); }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'), (key, value) => /^(authorization|api[_-]?key|access[_-]?token|secret|ticket|headers|audio|audioBase64|audio_base64|encrypted_content)$/i.test(key) ? '[excluded]' : value);
    if (!SERVICE_BOTS.includes(payload.botId) || !Number.isSafeInteger(payload.userId) || payload.userId < 1) throw Error('invalid request');
    const { botId, userId } = payload;
    await archive.ready;
    if (payload.action === 'status') { respond(200, archive.status(userId, botId)); return; }
    if (payload.action === 'begin') {
      const body = payload.request;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('invalid body');
      const graph = payload.graph?.nodes?.length && payload.graph.nodes.length <= 64 ? payload.graph : serviceGraph(botId, body);
      const id = await archive.begin({ userId, botId, conversationId: null, subject: payload.subject, graph, model: body.model,
        event: { type: 'service.request' } });
      if (id) {
        const prompts = graph.nodes.filter(node => node.type === 'prompt' && node.data?.role === botId);
        const actual = Array.isArray(body.input) ? body.input.filter(item => item.role === 'developer').map(item => item.content) : [body.prompt ?? ''];
        if (prompts.length) prompts.forEach((node, index) => archive.append(id, { nodeId: node.id, type: 'prompt', status: 'completed', outputPreview: JSON.stringify(actual[index]) }));
        else archive.append(id, { nodeId: 'instructions', type: 'prompt', status: 'completed', outputPreview: JSON.stringify(Array.isArray(body.input) ? actual : actual[0]) });
        archive.append(id, { nodeId: serviceNodeId(graph, botId, 'source'), type: 'source', status: 'completed', outputPreview: JSON.stringify(Array.isArray(body.input) ? body.input.filter(item => item.role !== 'developer') : body) });
        if (prompts.length) archive.append(id, { nodeId: serviceNodeId(graph, botId, 'serialize'), type: 'serialize', status: 'completed', outputPreview: JSON.stringify(body.input ?? body.prompt) });
        archive.append(id, { nodeId: serviceNodeId(graph, botId, 'model'), type: 'model_request', status: 'running', inputPreview: JSON.stringify(body, null, 2) });
      }
      respond(200, { id }); return;
    }
    if (payload.action === 'finish') {
      const run = archive.active.get(payload.id);
      if (!run || run.userId !== userId || run.botId !== botId) { respond(404, { error: 'not found' }); return; }
      const failed = payload.error || payload.status >= 400;
      if (payload.captureOmitted) run.omitted++;
      archive.append(payload.id, { nodeId: serviceNodeId(run.graph, botId, 'model'), type: 'model_response', status: failed ? 'failed' : 'completed',
        outputPreview: JSON.stringify(payload.response ?? {}), usage: payload.response?.usage ?? null, error: payload.error || undefined });
      if (!failed) archive.append(payload.id, { nodeId: serviceNodeId(run.graph, botId, 'tools'), type: 'provider_result', status: 'completed', outputPreview: JSON.stringify({ providerReturned: true, serviceValidationPending: true, response: payload.response }) });
      await archive.finish(payload.id, failed ? Error(payload.error || `Provider HTTP ${payload.status}`) : null);
      respond(200, { ok: true }); return;
    }
    throw Error('unknown action');
  } catch { respond(422, { error: 'invalid capture' }); }
}
