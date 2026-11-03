import {readFile,writeFile,rename,access} from 'node:fs/promises';

/** A running legacy writer may have opened its receipt but not finished the small write yet. */
export async function readSavedJson(file){
  for(let attempt=0;;attempt++){
    try{return JSON.parse(await readFile(file,'utf8'));}
    catch(error){
      if(!(error instanceof SyntaxError)||attempt>=5)throw error;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  }
}

export async function writeSavedJsonOnce(file,value){
  const temporary=file+'.pending';
  await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  try{await access(file);throw Error('Existing receipt must not be overwritten');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  await rename(temporary,file);
}
