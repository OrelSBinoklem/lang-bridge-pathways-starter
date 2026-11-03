import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cacheBytes, cacheLimit, cleanCache, formatGiB, frontendRoot, logCleanup } from './next-cache.mjs';
import { ensureLocalTutorGateway } from '../../tools/tutor-gateway/scripts/dev-gateway.mjs';

async function main() {
  logCleanup(await cleanCache());
  let gateway;
  try {
    gateway = await ensureLocalTutorGateway();
    console.info(`[tutor] ${gateway.started ? 'Started' : 'Reusing'} local gateway on port ${gateway.port ?? 8788}`);
  } catch (error) { console.error('[tutor] Local bot is unavailable:', error.message); }
  const require = createRequire(import.meta.url);
  const args = process.argv.slice(2);
  const hasPort = args.some(arg => arg === '-p' || arg === '--port' || arg.startsWith('--port='));
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev',
    ...(!hasPort ? ['--port', '3003'] : []), ...args], { cwd: frontendRoot, stdio: 'inherit', windowsHide: true });
  let scan = Promise.resolve(), warned = false;
  const timer = setInterval(() => {
    scan = scan.then(async () => {
      const bytes = await cacheBytes();
      if (bytes >= cacheLimit && !warned) {
        console.warn(`[next-cache] ${formatGiB(bytes)} reached the 10 GiB limit. Cleanup will run after Next dev stops; no automatic restart.`);
        warned = true;
      }
    }).catch(error => console.error('[next-cache] Size check failed:', error.message));
  }, 60_000);
  // Ctrl+C reaches both processes in a Windows console. Let Next shut down its worker.
  const interrupt = () => { if (process.platform !== 'win32') child.kill('SIGINT'); };
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  const result = await new Promise(resolve => {
    child.once('error', error => resolve({ error, code: 1 }));
    child.once('close', code => resolve({ code }));
  });
  clearInterval(timer);
  gateway?.stop();
  await scan;
  try { logCleanup(await cleanCache()); }
  catch (error) { console.error('[next-cache] Cleanup failed:', error.message); process.exitCode = 1; }
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', terminate);
  if (result.error) console.error('[next-cache] Cannot start Next:', result.error.message);
  process.exitCode ||= result.code ?? 0;
}

main().catch(error => { console.error('[next-cache]', error.message); process.exitCode = 1; });
