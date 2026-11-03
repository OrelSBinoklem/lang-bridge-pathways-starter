import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdir, open, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const numbers = new Set(['user_id','input_bytes','audio_bytes','text_chars','output_chars','duration_ms','first_byte_ms','first_audio_ms','status_code','close_code','chunks','stream_bytes','events','segments','segment_index','pending','input_tokens','output_tokens','cached_tokens','cache_write_tokens','input_audio_tokens','web_search_calls','seconds','reserved_micros','balance_micros','available_micros','cost_micros','amount_micros','commission_bps','attempt']);
const flags = new Set(['ok','cancelled','terminal','has_usage','dual','reasoning_enabled','authenticated','rejected','streaming']);
const labels = new Set(['trace_id','connection_id','call_id','operation','reference','playback_id','stream_id','model','secondary_model','voice','kind','purpose','action','phase','reason','error_type','request_id','terminal_event','message_type','turn_mode','reasoning_effort','preset','language','status']);
export function safeDiagnosticFields(fields = {}) {
  const result = {};
  for (const [key,value] of Object.entries(fields)) {
    if (numbers.has(key) && typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    if (flags.has(key) && typeof value === 'boolean') result[key] = value;
    if (labels.has(key) && typeof value === 'string' && /^[a-zA-Z0-9_.:/-]{1,140}$/.test(value)) result[key] = value;
  }
  return result;
}

export function createTutorDiagnostics({ enabled = process.env.TUTOR_DIAGNOSTICS_ENABLED !== 'false' && !process.env.NODE_TEST_CONTEXT,
  directory = fileURLToPath(new URL('../../../storage/logs/tutor-diagnostics/',import.meta.url)), maxBytes = 20*1024*1024, now = () => new Date() } = {}) {
  const context = new AsyncLocalStorage();
  let tail = Promise.resolve(), maintenanceDay = '', warned = false;
  function log(event,fields = {}) {
    if (!enabled || !/^[a-z0-9_.-]{1,80}$/.test(event)) return;
    const date = now(), day = date.toISOString().slice(0,10);
    const line = JSON.stringify({v:1,time:date.toISOString(),source:'gateway',event,...safeDiagnosticFields(context.getStore()),...safeDiagnosticFields(fields)})+'\n';
    tail = tail.then(async () => {
      await mkdir(directory,{recursive:true,mode:0o770});
      const file = await open(path.join(directory,`tutor-${day}.jsonl`),'a',0o660);
      await file.chmod(0o660);
      try { if ((await file.stat()).size < maxBytes) await file.write(line); else if (!warned) { warned=true; console.error('tutor_diagnostics_daily_limit'); } }
      finally { await file.close(); }
      if (maintenanceDay !== day) {
        maintenanceDay=day;
        const cutoff=new Date(date.getTime()-7*86400000).toISOString().slice(0,10);
        for (const name of await readdir(directory)) {
          const match=/^tutor-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(name);
          if (match && match[1]<cutoff) await unlink(path.join(directory,name)).catch(error=>{if(error.code!=='ENOENT')throw error;});
        }
      }
    }).catch(()=>{if(!warned){warned=true;console.error('tutor_diagnostics_write_failed');}});
  }
  return {log,run:(fields,callback)=>context.run({...context.getStore(),...safeDiagnosticFields(fields)},callback),flush:()=>tail};
}
export const tutorDiagnostics = createTutorDiagnostics();
