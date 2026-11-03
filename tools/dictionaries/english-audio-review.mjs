/** Orthographic equivalence only; homophones and expanded contractions stay reviewable. */
function numberTranscript(text){
 const value=text.toLowerCase().replace(/[,!.]/g,'').trim();
 if(/^\d+(?:st|nd|rd|th)?$/.test(value))return value;
 const units=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
 const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
 const ordinals={first:'1st',second:'2nd',third:'3rd',fourth:'4th',fifth:'5th',sixth:'6th',seventh:'7th',eighth:'8th',ninth:'9th',tenth:'10th',eleventh:'11th',twelfth:'12th',thirteenth:'13th',fourteenth:'14th',fifteenth:'15th',sixteenth:'16th',seventeenth:'17th',eighteenth:'18th',nineteenth:'19th',twentieth:'20th',thirtieth:'30th',fortieth:'40th',fiftieth:'50th',sixtieth:'60th',seventieth:'70th',eightieth:'80th',ninetieth:'90th',hundredth:'100th'};
 if(value==='forth')return '4th';
 if(ordinals[value])return ordinals[value];
 const ordinalParts=value.split(/[\s-]+/),last=ordinalParts.at(-1);
 if(ordinalParts.length>1&&ordinals[last]){
  const prefix=numberTranscript(ordinalParts.slice(0,-1).join(' '));
  if(prefix!==null&&/^\d+$/.test(prefix)){
   const n=Number(prefix)+Number.parseInt(ordinals[last],10),remainder=n%100;
   return n+((remainder>=11&&remainder<=13)?'th':({1:'st',2:'nd',3:'rd'}[n%10]??'th'));
  }
 }
 let current=0,total=0;
 for(const token of value.split(/[\s-]+/)){
  if(units.includes(token))current+=units.indexOf(token);
  else if(tens[token])current+=tens[token];
  else if(token==='hundred')current=(current||1)*100;
  else if(token==='thousand'||token==='million'||token==='billion'){total+=(current||1)*({thousand:1000,million:1e6,billion:1e9})[token];current=0;}
  else return null;
 }
 return String(total+current);
}
export function normalizeTranscript(text) {
  const number=numberTranscript(text);
  if(number!==null)return 'number:'+number;
  return text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’‘]/g,"'")
    .replace(/\b(?:okay|o\.?\s?k\.?)\b/g,'ok')
    .replace(/\b(?:mrs\.?|missus)\b/g,'missus')
    .replace(/\b(?:mr\.?|mister)\b/g,'mister')
    .replace(/\b(?:dr\.?|doctor)\b/g,'doctor')
    .replace(/\b(?:ms\.?|miz)\b/g,'miz')
    .replace(/\b(?:favourite|honour|dialogue|recognise|agonise|mould|authorise|personalisation|sombre|grey|metre|neighbour|coloured|favour|tyre|disc|tumour|catalogue|rumour|endeavour|specialised)\b/g,
      word=>({favourite:'favorite',honour:'honor',dialogue:'dialog',recognise:'recognize',agonise:'agonize',
        mould:'mold',authorise:'authorize',personalisation:'personalization',sombre:'somber',grey:'gray',
        metre:'meter',neighbour:'neighbor',coloured:'colored',favour:'favor',tyre:'tire',disc:'disk',tumour:'tumor',catalogue:'catalog',rumour:'rumor',endeavour:'endeavor',specialised:'specialized'})[word])
    // These spellings are indistinguishable in an isolated spoken headword.
    .replace(/\b(?:site|aide|base|compliment|councilor|feet)\b/g,
      word=>({site:'sight',aide:'aid',base:'bass',compliment:'complement',councilor:'counselor',feet:'feat'})[word])
    .replace(/\bshh+\b/g,'sh')
    .replace(/[^a-z0-9']/g,'');
}

export function reviewTranscript(job, observation) {
  const problems=[];
  if(normalizeTranscript(job.text)!==normalizeTranscript(observation.text??'')) problems.push('transcript_mismatch');
  if(observation.issue?.trim())problems.push('audio_issue');
  if(job.hint&&!observation.ipa?.trim())problems.push('missing_pronunciation_observation');
  if(job.hint&&observation.ipa?.trim()){
    const ipa=observation.ipa.trim().replace(/^[\[/\s]+|[\]/\s]+$/g,'');
    const plain=ipa.replace(/[\s.ˈˌː]/g,'');
    let wrong=false;
    if(['close','use','house'].includes(job.text)&&['s','z'].includes(job.variant))wrong=!plain.endsWith(job.variant);
    if(job.text==='live')wrong=job.variant==='long-i'?!plain.includes('aɪ'):plain.includes('aɪ');
    if(job.text==='wind')wrong=job.variant==='turn'?!plain.includes('aɪ'):plain.includes('aɪ');
    if(job.text==='read')wrong=job.variant==='present'?!plain.includes('i'):!/[ɛe]/.test(plain);
    const strictStress=new Set(['record','present','object','permit','produce','conduct','convict','insult','subject','suspect','rebel','increase','perfect','content','minute','desert']);
    if(strictStress.has(job.text)){
      const second=job.variant==='verb'||job.variant==='happy'||job.variant==='tiny';
      const firstStress=ipa.indexOf('ˈ');
      if(firstStress>=0)wrong||=second?firstStress===0:firstStress!==0;
    }
    if(job.text==='aged')wrong=!/[ɪə]d$/.test(plain);
    if(job.text==='résumé')wrong=!plain.endsWith('meɪ');
    if(job.text==='resume')wrong=plain.endsWith('meɪ');
    if(wrong)problems.push('pronunciation_needs_review');
  }
  return {job_id:job.id,text:job.text,heard:observation.text,ipa:observation.ipa,issue:observation.issue,problems};
}
