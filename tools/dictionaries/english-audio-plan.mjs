import {createHash} from 'node:crypto';

export const model='gemini-3.8-flash-tts';
export const voice='Enceladus';
export const sha=value=>createHash('sha256').update(value).digest('hex');
export function cleanText(value){
 let text=value.normalize('NFKC').replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim();
 // Imported editorial labels are not spoken. Keep the original database headword intact.
 text=text.replace(/\s+(?:(?:exclam|adj|adv|det|pron|prep|conj|noun)\.|number)[\s\S]*$/i,'')
  .replace(/\s+B[12]$/i,'').replace(/\s*\/$/,'').replace(/^(bass|bow|content|recount|minute|pension)[12]$/i,'$1')
  .replace(/\s+[vn]\.?$/i,'');
 if(text==="'m")text='am';
 if(text==='castle n. B2 casual')text='casual';
 // American/British spelling alternatives sound once, using the American headword.
 const alternatives={'Mrs./Mrs':'Mrs.','favorite/favourite':'favorite','honor/honour':'honor','dialog/dialogue':'dialog',
  'recognize/recognise':'recognize','agonize/agonise':'agonize','mold/mould':'mold','authorize/authorise':'authorize',
  'personalization/personalisation':'personalization','somber/sombre':'somber'};
 return alternatives[text]??text;
}
const stress={
 record:['REK-erd','rih-KORD'],present:['PREZ-ent','prih-ZENT'],object:['OB-jekt','ub-JEKT'],
 permit:['PER-mit','per-MIT'],produce:['PROH-doos','pruh-DOOS'],project:['PRAH-jekt','pruh-JEKT'],
 conduct:['KON-dukt','kun-DUKT'],contract:['KON-trakt','kun-TRAKT'],convert:['KON-vert','kun-VERT'],
 convict:['KON-vikt','kun-VIKT'],conflict:['KON-flikt','kun-FLIKT'],contest:['KON-test','kun-TEST'],
 contrast:['KON-trast','kun-TRAST'],digest:['DYE-jest','dye-JEST'],export:['EK-sport','ik-SPORT'],
 extract:['EK-strakt','ik-STRAKT'],import:['IM-port','im-PORT'],increase:['IN-krees','in-KREES'],
 insult:['IN-sult','in-SULT'],subject:['SUB-jekt','sub-JEKT'],suspect:['SUS-pekt','suh-SPEKT'],
 survey:['SUR-vay','sur-VAY'],transfer:['TRANS-fer','trans-FER'],transport:['TRANS-port','trans-PORT'],
 progress:['PRAH-gress','pruh-GRESS'],protest:['PROH-test','pruh-TEST'],reject:['REE-jekt','rih-JEKT'],
 rebel:['REB-ul','rih-BEL'],refund:['REE-fund','rih-FUND'],discount:['DIS-kount','dis-KOUNT'],
};
const grammaticalHomographs=new Set('abuse excuse diffuse loose abstract absent accent alternate attribute combine compound compress console converse decrease defect deliberate duplicate elaborate intimate legitimate moderate coordinate syndicate advocate delegate discharge entrance invalid refill replay rerun rewrite reset retake retell retest initiate perfect'.split(' '));
export function pronunciation(word){
 let text=cleanText(word.word);const lower=text.toLowerCase();
 const verb=['verb','be-verb','have-verb','auxiliary verb','modal verb','modal auxiliary'].includes(word.type);
 const meaning=(word.translation_1??'')+' '+(word.translation_2??'')+' '+(word.info??'');
 let hint='',variant='default';
 const set=(v,h)=>{variant=v;hint=h;};
 if(stress[lower])set(verb?'verb':'nominal',`Use the ${verb?'verb':'noun/adjective'} pronunciation, stressed as ${stress[lower][verb?1:0]}.`);
 if(grammaticalHomographs.has(lower))set(verb?'verb':word.type,`This headword is a ${word.type}; use its standard American English ${word.type} pronunciation, with the appropriate sounds and word stress.`);
 const pair=(name,a,b,ha,hb)=>{if(lower===name)set(verb?a:b,verb?ha:hb);};
 pair('close','z','s','The verb close, final voiced /z/, as close a door.','The adjective/adverb close, final unvoiced /s/, as close friends.');
 pair('use','z','s','The verb use, /juːz/.','The noun use, /juːs/.');
 pair('house','z','s','The verb house, /haʊz/.','The noun house, /haʊs/.');
 pair('live','short-i','long-i','The verb live, /lɪv/, as I live here.','The adjective/adverb live, /laɪv/, as live music.');
 pair('desert','verb','noun','The verb desert, /dɪˈzɝt/.','The noun desert, /ˈdɛzɚt/.');
 pair('refuse','verb','noun','The verb refuse, /rɪˈfjuːz/.','The noun refuse, /ˈrɛfjuːs/, meaning rubbish.');
 pair('separate','verb','adjective','The verb separate, ending /reɪt/.','The adjective separate, ending /rət/.');
 pair('appropriate','verb','adjective','The verb appropriate, ending /eɪt/.','The adjective appropriate, ending /ət/.');
 pair('graduate','verb','nominal','The verb graduate, ending /eɪt/.','The noun/adjective graduate, ending /ət/.');
 pair('estimate','verb','noun','The verb estimate, ending /meɪt/.','The noun estimate, ending /mət/.');
 pair('associate','verb','nominal','The verb associate, ending /eɪt/.','The noun/adjective associate, ending /ət/.');
 if(lower==='lead')set(/свин/u.test(meaning)?'metal':'guide',/свин/u.test(meaning)?'The metal lead, /lɛd/.':'Lead /liːd/, as lead the way.');
 if(lower==='wind')set(verb?'turn':'air',verb?'Wind /waɪnd/, meaning turn or wind a clock.':'Wind /wɪnd/, meaning moving air.');
 if(lower==='tear')set(/сл[её]з/u.test(meaning)?'eye':'rip',/сл[её]з/u.test(meaning)?'Tear /tɪr/, a tear from an eye.':'Tear /tɛr/, meaning rip.');
 if(lower==='bow')set(/поклон|клан|нос суд/u.test(meaning)||verb?'bend':'ribbon',/поклон|клан|нос суд/u.test(meaning)||verb?'Bow /baʊ/, a bow or bending forward.':'Bow /boʊ/, as a ribbon bow or a bow and arrow.');
 if(lower==='bass')set(/рыб|окун/u.test(meaning)?'fish':'music',/рыб|окун/u.test(meaning)?'Bass /bæs/, the fish.':'Bass /beɪs/, the low musical range.');
 if(lower==='content')set(word.type==='adjective'?'happy':'material',word.type==='adjective'?'Content /kənˈtɛnt/, meaning satisfied.':'Content /ˈkɑntɛnt/, meaning material or contents.');
 if(lower==='minute')set(word.type==='adjective'?'tiny':'time',word.type==='adjective'?'Minute /maɪˈnuːt/, meaning very small.':'Minute /ˈmɪnɪt/, a unit of time.');
 if(lower==='polish')set(/польск/u.test(meaning)?'nationality':'shine',/польск/u.test(meaning)?'Polish /ˈpoʊlɪʃ/, related to Poland.':'Polish /ˈpɑlɪʃ/, to make shiny or a polishing substance.');
 if(lower==='read')set(/прошед|past|треть/u.test(meaning)?'past':'present',/прошед|past|треть/u.test(meaning)?'Past-tense read /rɛd/.':'Present-tense read /riːd/.');
 if(lower==='aged'&&word.type==='adjective')set('elderly','The adjective aged meaning old or elderly, pronounced /ˈeɪdʒɪd/, two syllables.');
 if(lower==='wound')set('injury','Wound /wuːnd/, meaning an injury or to injure, not the past tense of wind.');
 if(lower==='resume')set('continue','The verb resume, /rɪˈzuːm/, meaning continue; not résumé.');
 if(lower==='row')set('line','Row /roʊ/, meaning a line, the first dictionary meaning.');
 const clarified={
  noise:'Read the English NOUN noise, /nɔɪz/. This is a spoken dictionary entry, not a request for a noise or sound effect. Say the WORD noise once.',
  wonder:'Read wonder, /ˈwʌndɚ/, with the STRUT vowel in the first syllable, rhyming with under. Do not say wander /wɑndɚ/.',
  dull:'Read dull, /dʌl/, rhyming with hull and skull. Use the STRUT vowel, not doll /dɑl/.',
  madame:'Read the title Madame, /məˈdɑːm/, stress on the LAST syllable, rhyming with calm. Do not substitute madam /ˈmædəm/.',
  'résumé':'Read the noun résumé, /ˈrɛzəmeɪ/, meaning a CV. The final syllable rhymes with day. Do not use the verb resume /rɪˈzuːm/.',
 };
 if(clarified[lower])set('clarified',clarified[lower]);
 if(lower==='increase'&&!verb)set('nominal','Read the NOUN increase /ˈɪŋkriːs/. Strong primary stress on the FIRST syllable IN, as IN-crease. Do not use the verb pronunciation in-CREASE. Say only increase, with no article.');
 if(/^[A-Z]{2,6}$/.test(text))set('initialism',text==='IT'?'IT means information technology; read the letters I T, not the pronoun it.':'Read this common English abbreviation or acronym appropriately, without expanding it into a definition.');
 if(variant!=='initialism')text=lower==='i'?'I':lower;
 return {text,variant,hint};
}
export function buildPlan(source){
 const jobs=new Map(),records=[];
 for(const word of source.words){
  if(String(word.learn_lang).toLowerCase()!=='en')throw Error('Non-English record');
  const {text,variant,hint}=pronunciation(word);
  if(!text||text.length>250||/[\r\n<>]/.test(text))throw Error('Review spoken text: '+word.id);
  const key=text.toLowerCase()+'::'+variant;
  const style='Natural standard American English, calm neutral dictionary narrator. Say only the supplied headword or short phrase exactly once. Clear, unhurried but fluent articulation; normal word stress. Do not add definitions, examples, spelling, labels or introductions. No exaggerated stretching, whisper, singing, music or sound effects. '+hint;
  const contextPrefix=text==='insult'&&variant==='verb';
  const spokenText=text==='madame'?'ma-dahm':contextPrefix?'to <short pause> insult':text;
  const request={contents:[{role:'user',parts:[{text:spokenText,speechMetadata:{style}}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{voice}}}};
  const id=sha(JSON.stringify({model,request}));
  if(jobs.has(key)&&jobs.get(key).id!==id)throw Error('Conflicting pronunciation '+key);
  if(!jobs.has(key))jobs.set(key,{id,text,variant,hint,model,voice,request,context_prefix:contextPrefix,word_ids:[]});
  jobs.get(key).word_ids.push(word.id);
  records.push({id:word.id,dictionary_id:word.dictionary_id,word:word.word,type:word.type,old_sound_url:word.sound_url,job_id:id});
 }
 return {version:1,model,voice,source_sha256:sha(JSON.stringify(source)),records,jobs:[...jobs.values()],budget:{maximum_effective_usd:8,tts_effective_usd:6.5,verification_reserve_usd:1.5,regular_input_per_million:1,regular_output_per_million:18,promotional_credit_fraction:0.5},created_at:new Date().toISOString()};
}
