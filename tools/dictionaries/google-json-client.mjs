import http2 from 'node:http2';
import {Readable} from 'node:stream';

/** One multiplexed connection; no automatic retries of potentially billed POSTs. */
export class GoogleJsonClient {
  #session;

  async fetch(url, init, capture=()=>{}) {
    const target=new URL(url);
    if(target.origin!=='https://aiplatform.googleapis.com')throw Error('Unexpected Google API origin');
    if(!this.#session||this.#session.closed||this.#session.destroyed){
      this.#session=http2.connect(target.origin);
      this.#session.on('error',()=>{});
    }
    return new Promise((resolve,reject)=>{
      const request=this.#session.request({':method':init.method,':path':target.pathname+target.search,...init.headers});
      const abort=()=>{request.close(http2.constants.NGHTTP2_CANCEL);reject(init.signal.reason??Error('Google request cancelled'));};
      if(init.signal?.aborted){abort();return;}
      init.signal?.addEventListener('abort',abort,{once:true});
      request.on('close',()=>init.signal?.removeEventListener('abort',abort));
      request.on('error',reject);
      request.on('response',headers=>{
        async function* body(){for await(const chunk of request){capture(chunk);yield chunk;}}
        resolve(new Response(Readable.toWeb(Readable.from(body())),{
          status:headers[':status'],headers:{'content-type':headers['content-type']??'application/json'},
        }));
      });
      request.end(init.body);
    });
  }

  async post(apiPath, token, value, timeoutMs=120000) {
    const session=http2.connect('https://aiplatform.googleapis.com');
    session.on('error',()=>{});
    try{return await new Promise((resolve,reject)=>{
      const request=session.request({':method':'POST',':path':apiPath,
        'authorization':`Bearer ${token}`,'content-type':'application/json'});
      let status=null,size=0;
      const chunks=[];
      const timer=setTimeout(()=>{request.close(http2.constants.NGHTTP2_CANCEL);reject(Error('Google request timed out; billing outcome unknown'));},timeoutMs);
      const finish=callback=>value=>{clearTimeout(timer);callback(value);};
      request.on('response',headers=>{status=headers[':status'];});
      request.on('data',chunk=>{
        size+=chunk.length;
        if(size>32*1024*1024){request.close();finish(reject)(Error('Google response exceeds safety limit'));return;}
        chunks.push(chunk);
      });
      request.on('error',finish(reject));
      request.on('end',()=>{
        clearTimeout(timer);
        try{resolve({ok:status>=200&&status<300,status,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}
        catch(error){reject(error);}
      });
      request.end(JSON.stringify(value));
    });}finally{session.close();}
  }

  close(){this.#session?.close();}
}
