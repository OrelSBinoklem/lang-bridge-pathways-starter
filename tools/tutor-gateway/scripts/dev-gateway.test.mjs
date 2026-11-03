import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {gatewayDevEnvironment,ensureLocalTutorGateway} from './dev-gateway.mjs';

test('local fallback uses only the missing model key and preserves explicit gateway/environment settings',()=>{
 const env=gatewayDevEnvironment({CREDITS_ENABLED:'true',CREDITS_API_URL:'http://lbpw.loc/api/internal/credits'},{OPENAI_API_KEY:'fixture-root',DB_PASSWORD:'never-copy'},{});
 assert.equal(env.OPENAI_API_KEY,'fixture-root');assert.equal(env.DB_PASSWORD,undefined);
 assert.equal(env.CREDITS_API_URL,'http://lbpw.loc/api/internal/credits');
 assert.equal(gatewayDevEnvironment({OPENAI_API_KEY:'fixture-gateway'},{OPENAI_API_KEY:'fixture-root'},{}).OPENAI_API_KEY,'fixture-gateway');
 assert.equal(gatewayDevEnvironment({OPENAI_API_KEY:'fixture-gateway'},{OPENAI_API_KEY:'fixture-root'},{OPENAI_API_KEY:'fixture-environment'}).OPENAI_API_KEY,'fixture-environment');
});
test('an existing healthy gateway is reused and never stopped',async()=>{
 const gateway=await ensureLocalTutorGateway({env:{},fetchImpl:async()=>Response.json({ok:true,service:'tutor-gateway'}),spawnImpl:()=>assert.fail('Duplicate gateway')});
 assert.equal(gateway.started,false);gateway.stop();
});
test('a missing gateway is started hidden in its own directory; only the owned child is stopped',async()=>{
 let polls=0,stops=0;
 const child=new EventEmitter();child.pid=123;child.exitCode=null;
 const gateway=await ensureLocalTutorGateway({root:'fixture-root',env:{OPENAI_API_KEY:'fixture-key'},fetchImpl:async()=>{if(++polls===1)throw Error('offline');return Response.json({ok:true,service:'tutor-gateway'});},spawnImpl:(binary,args,options)=>{assert.deepEqual(args,['--watch','src/server.mjs']);assert.equal(options.windowsHide,true);assert.match(options.cwd,/tools[\\/]tutor-gateway$/);assert.equal(options.env.OPENAI_API_KEY,'fixture-key');return child;},terminate:c=>{assert.equal(c,child);stops++;}});
 assert.equal(gateway.started,true);gateway.stop();gateway.stop();assert.equal(stops,1);
});
test('foreign services, remote hosts and invalid ports are never taken over',async()=>{
 const noSpawn=()=>assert.fail('Unexpected start');
 await assert.rejects(ensureLocalTutorGateway({env:{},fetchImpl:async()=>Response.json({ok:true,service:'other'}),spawnImpl:noSpawn}),/another service/);
 await assert.rejects(ensureLocalTutorGateway({env:{TUTOR_GATEWAY_HOST:'remote.invalid'},spawnImpl:noSpawn}),/local host/);
 await assert.rejects(ensureLocalTutorGateway({env:{TUTOR_GATEWAY_PORT:'wrong'},spawnImpl:noSpawn}),/Invalid/);
 const disabled=await ensureLocalTutorGateway({env:{LBP_TUTOR_AUTOSTART:'0'},fetchImpl:noSpawn,spawnImpl:noSpawn});assert.equal(disabled.started,false);
});
