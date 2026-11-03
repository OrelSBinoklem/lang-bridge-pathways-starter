/** Remove a spoken context prefix at the explicitly requested quiet pause, without stretching speech. */
export function removeContextPrefix(wav){
  if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',36,40)!=='data')throw Error('Expected native streaming PCM WAV');
  const pcm=wav.subarray(44),window=240,levels=[];
  for(let offset=0;offset+window*2<=pcm.length;offset+=window*2){
    let energy=0;
    for(let i=0;i<window;i++)energy+=(pcm.readInt16LE(offset+i*2)/32768)**2;
    levels.push(Math.sqrt(energy/window));
  }
  const first=levels.findIndex(level=>level>.006),last=levels.findLastIndex(level=>level>.006),gaps=[];
  for(let i=first+3;i<last;){
    if(levels[i]>.003){i++;continue;}
    const start=i;while(i<last&&levels[i]<=.003)i++;
    if(i-start>=12&&start-first<=65&&last-i>=25)gaps.push({start,end:i});
  }
  gaps.sort((a,b)=>(b.end-b.start)-(a.end-a.start));
  if(!gaps.length||(gaps.length>1&&(gaps[0].end-gaps[0].start)<1.5*(gaps[1].end-gaps[1].start)))throw Error('Context boundary is not unambiguous; preserve native audio for review');
  const cutSample=(gaps[0].end-5)*window,cutBytes=cutSample*2;
  const output=Buffer.concat([wav.subarray(0,44),pcm.subarray(cutBytes)]);
  output.writeUInt32LE(output.length-8,4);output.writeUInt32LE(output.length-44,40);
  return {wav:output,cut:{kind:'remove_context_prefix',cut_samples:cutSample,sample_rate:24000,retained_quiet_lead_ms:50,speed_changed:false}};
}
