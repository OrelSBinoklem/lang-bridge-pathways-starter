import {readFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function gatewayDevEnvironment(gateway,repository,inherited=process.env){
  const env={...gateway,...inherited};
  // Local development reuses the existing project key in memory; no credential is copied to a file.
  if(!env.OPENAI_API_KEY && repository.OPENAI_API_KEY)env.OPENAI_API_KEY=repository.OPENAI_API_KEY;
  return env;
}

export async function readGatewayDevEnvironment(root=fileURLToPath(new URL('../../../',import.meta.url))){
  const {parse}=await import('dotenv');
  const load=async name=>parse(await readFile(path.join(root,name),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;}));
  return gatewayDevEnvironment(await load('tools/tutor-gateway/.env'),await load('.env'));
}

function stopOwnedChild(child){
  if(!child.pid||child.exitCode!==null)return;
  if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  else child.kill('SIGTERM');
}

export async function ensureLocalTutorGateway({root=fileURLToPath(new URL('../../../',import.meta.url)),env,fetchImpl=fetch,spawnImpl=spawn,terminate=stopOwnedChild,timeoutMs=15000}={}){
  env ??= await readGatewayDevEnvironment(root);
  if(env.LBP_TUTOR_AUTOSTART==='0')return {started:false,stop(){}};
  const port=Number(env.TUTOR_GATEWAY_PORT||8788);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid local tutor port');
  const configuredHost=env.TUTOR_GATEWAY_HOST||'127.0.0.1';
  if(!['127.0.0.1','localhost','::1','0.0.0.0','::'].includes(configuredHost))throw Error('Tutor autostart requires a local host');
  const host=['0.0.0.0','::'].includes(configuredHost)?'127.0.0.1':configuredHost==='::1'?'[::1]':configuredHost;
  const url=`http://${host}:${port}/health`;
  async function healthy(){
    let response;
    try{response=await fetchImpl(url,{signal:AbortSignal.timeout(1000)});}catch{return false;}
    const data=await response.json().catch(()=>null);
    if(!response.ok||data?.service!=='tutor-gateway'||data?.ok!==true)throw Error('Tutor port is occupied by another service');
    return true;
  }
  if(await healthy())return {started:false,port,stop(){}};
  const child=spawnImpl(process.execPath,['--watch','src/server.mjs'],{cwd:path.join(root,'tools/tutor-gateway'),env,stdio:'inherit',windowsHide:true});
  let stopped=false,failed=null;
  const stop=()=>{if(!stopped){stopped=true;terminate(child);}};
  child.once('error',()=>{failed=Error('Cannot launch local tutor gateway');});
  child.once('exit',()=>{failed=Error('Local tutor gateway stopped during startup');});
  try{
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){
      if(failed)throw failed;
      if(await healthy())return {started:true,port,stop};
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    throw Error('Local tutor gateway did not become ready; check its startup log');
  }catch(error){stop();throw error;}
}
