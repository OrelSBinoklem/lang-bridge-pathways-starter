import {ensureLocalTutorGateway} from './dev-gateway.mjs';
try{
  const gateway=await ensureLocalTutorGateway();
  console.info(`[tutor] ${gateway.started?'Started':'Reusing'} local gateway on port ${gateway.port??8788}`);
  if(gateway.started){
    const stop=()=>{gateway.stop();process.exit(0);};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
  }
}catch(error){console.error('[tutor]',error.message);process.exitCode=1;}
