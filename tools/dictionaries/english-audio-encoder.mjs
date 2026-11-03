import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';

const execute=promisify(execFile);

/** Independent encoders in one media process; no concatenation or cutting of words. */
export class EnglishAudioBatchEncoder {
  #pending=[];
  #timer;
  #running=false;

  encode(stem) {
    return new Promise((resolve,reject)=>{
      this.#pending.push({stem,resolve,reject});
      if(this.#pending.length>=16)void this.#flush();
      else this.#timer??=setTimeout(()=>{this.#timer=null;void this.#flush();},1000);
    });
  }

  async #flush(){
    if(this.#running||!this.#pending.length)return;
    clearTimeout(this.#timer);this.#timer=null;
    this.#running=true;
    const batch=this.#pending.splice(0,16);
    try{
      const args=['-v','error','-xerror','-n'];
      for(const {stem} of batch)args.push('-i',stem+'.wav');
      batch.forEach(({stem},index)=>args.push('-map',`${index}:a:0`,'-map_metadata','-1','-codec:a','libmp3lame','-b:a','96k',stem+'.mp3'));
      await execute('ffmpeg',args,{maxBuffer:8e6});
      const check=['-v','error','-xerror'];
      for(const {stem} of batch)check.push('-i',stem+'.mp3');
      batch.forEach((_,index)=>check.push('-map',`${index}:a:0`));
      check.push('-f','null','-');
      await execute('ffmpeg',check,{maxBuffer:8e6});
      for(const item of batch)item.resolve(await readFile(item.stem+'.mp3'));
    }catch(error){for(const item of batch)item.reject(error);}
    finally{this.#running=false;if(this.#pending.length)void this.#flush();}
  }
}
