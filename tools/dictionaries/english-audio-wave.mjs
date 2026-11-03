/** Inspect native mono PCM16 without starting a media process per short word. */
export function inspectNativeWav(bytes) {
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Expected native WAV');
  let format=null,pcm=null;
  for(let offset=12;offset+8<=bytes.length;){
    const name=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8;
    if(start+size>bytes.length)throw Error('Truncated WAV chunk');
    if(name==='fmt ')format={encoding:bytes.readUInt16LE(start),channels:bytes.readUInt16LE(start+2),rate:bytes.readUInt32LE(start+4),bits:bytes.readUInt16LE(start+14)};
    if(name==='data')pcm=bytes.subarray(start,start+size);
    offset=start+size+(size%2);
  }
  if(!format||format.encoding!==1||format.channels!==1||format.rate!==24000||format.bits!==16||!pcm?.length||pcm.length%2)throw Error('Unexpected PCM format');
  let energy=0,peak=0;
  for(let i=0;i<pcm.length;i+=2){const sample=pcm.readInt16LE(i)/32768;energy+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
  const seconds=pcm.length/48000,rms=Math.sqrt(energy/(pcm.length/2));
  if(seconds<0.15||seconds>12||rms<0.001)throw Error('Speech duration or volume needs review');
  return {seconds,rms,peak,sample_rate:24000,channels:1};
}
