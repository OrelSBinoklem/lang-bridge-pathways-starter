import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {Body,Box,Sphere,Vec3,World} from 'cannon-es';
const require=createRequire(import.meta.url);
const code=ts.transpileModule(await readFile(new URL('./dominoArchipelagoPhysics.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from 'cannon-es'/g,`from '${pathToFileURL(require.resolve('cannon-es')).href}'`);
const {createDominoArchipelago,createLocalDominoSleep}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const run=(s,t,fps=60)=>{for(let i=0;i<t*fps;i++)s.update(1/fps);};
const tipped=p=>Math.abs(p.body.quaternion.x)+Math.abs(p.body.quaternion.z)>.25;

test('the saved Impulse II source, physics and tests remain byte-identical after newline normalization',async()=>{
  const snapshot=JSON.parse(await readFile(new URL('./dominoWorkshop.frozen.json',import.meta.url),'utf8'));
  for(const [file,hash] of Object.entries(snapshot.sha256Lf)){
    const source=(await readFile(new URL(file,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
    assert.equal(createHash('sha256').update(source).digest('hex'),hash,file);
  }
});
test('five manual starting stations and no spontaneous activation',()=>{
  const s=createDominoArchipelago();assert.equal(s.launches.length,5);
  const step=s.world.step.bind(s.world);let steps=0;s.world.step=(...args)=>{steps++;return step(...args);};
  const positions=s.dynamic.map(p=>p.body.position.clone());run(s,3);
  s.dynamic.forEach((p,i)=>assert.ok(p.body.position.distanceTo(positions[i])<.02,`${i} moved at rest`));
  assert.equal(s.pushes,0);assert.equal(steps,0,'idle scene still solves collisions');
  assert.ok(s.dynamic.filter(p=>p.kind==='domino').length>150);
  s.push(0);run(s,.1);assert.ok(steps>0,'idle optimization prevented a new launch');s.dispose();
});
test('one spiral start reaches all three branches, the hoop and the front-row finish without stray shortcuts',()=>{
  const s=createDominoArchipelago(),byBody=new Map(s.dynamic.map((p,i)=>[p.body,{p,i}]));
  const unrelated=s.dynamic.filter(p=>[9,11,13].includes(p.lane)),positions=unrelated.map(p=>p.body.position.clone());
  const hoop=s.dynamic.find(p=>p.name==='Катящееся кольцо'),bell=s.dynamic.find(p=>p.name==='Финальный подвес');
  const firstFront=s.dynamic.find(p=>p.lane===10);
  let hoopHit=false,frontHit=false,maxBellTravel=0;
  hoop.body.addEventListener('collide',e=>{if(byBody.get(e.body)?.p.lane===12)hoopHit=true;});
  firstFront.body.addEventListener('collide',e=>{if(e.body===hoop.body)frontHit=true;});
  const firstContact=new Set(),shortcuts=[];
  for(const [i,p] of s.dynamic.entries())if(p.kind==='domino'&&p.lane<=3){
    p.body.addEventListener('collide',e=>{
      const q=byBody.get(e.body);if(!q||firstContact.has(p))return;firstContact.add(p);
      if(q.p.kind==='domino'&&Math.abs(i-q.i)>2)shortcuts.push([i,q.i,s.time]);
    });
  }
  s.push(s.launches[0].index);
  // Check every physical tick, not just the final count: a stray hit can start a
  // lane in the middle and leave an apparently impressive total of fallen tiles.
  for(let frame=0;frame<18*120;frame++){
    s.update(1/120);
    maxBellTravel=Math.max(maxBellTravel,bell.body.position.distanceTo(bell.initial));
    unrelated.forEach((p,i)=>assert.ok(p.body.position.distanceTo(positions[i])<.02,`unrelated lane ${p.lane} moved at ${s.time}`));
  }
  assert.deepEqual(shortcuts,[],'a flying tile bypassed the adjacent predecessor');
  for(const lane of [1,2,3,5,6,7,8,10,12]){
    const pieces=s.dynamic.filter(p=>p.lane===lane);
    assert.ok(pieces.length>0);assert.ok(pieces.every(tipped),`lane ${lane} did not reach its end`);
  }
  assert.ok(hoopHit&&frontHit,'the return lane must strike the hoop, which must strike the front row');
  assert.ok(maxBellTravel>.15,'the front row did not reach its final pendulum');
  for(const joint of s.world.constraints)if(joint.constructor.name==='PointToPointConstraint'){
    assert.ok(joint.bodyA.pointToWorldFrame(joint.pivotA).distanceTo(joint.bodyB.pointToWorldFrame(joint.pivotB))<.04,'connecting rod detached');
  }
  assert.equal(s.pushes,1);
  s.dispose();
});
test('marble, paddle wheel and hammer physically strike their receiving domino lanes',()=>{
  for(const [title,minimum] of [['Шар',3],['Колесо',3],['Молот',15]]){
    const s=createDominoArchipelago();s.push(s.launches.find(l=>l.title===title).index);run(s,12);
    const fallen=s.dynamic.filter(p=>p.kind==='domino'&&tipped(p)).length;
    assert.ok(fallen>=minimum,`${title}: only ${fallen} fallen`);
    for(const p of s.dynamic)assert.ok([p.body.position.x,p.body.position.y,p.body.position.z].every(Number.isFinite));
    s.dispose();
  }
});
test('every station responds to an impulse without resetting other parts',()=>{
  for(let station=1;station<5;station++){
    const s=createDominoArchipelago(),i=s.launches[station].index,p=s.dynamic[i];
    const pos=p.body.position.clone(),q=p.body.quaternion.clone();s.push(i);
    let travel=0,turn=0;
    for(let frame=0;frame<180;frame++){
      s.update(1/120);const r=p.body.quaternion;
      travel=Math.max(travel,p.body.position.distanceTo(pos));
      // Measure the actual angular excursion, including mechanisms that swing back.
      turn=Math.max(turn,2*Math.acos(Math.min(1,Math.abs(r.x*q.x+r.y*q.y+r.z*q.z+r.w*q.w))));
    }
    assert.ok(travel>.1||turn>.1,`${p.name} did not move`);
    assert.ok(!tipped(s.dynamic[0]),'unrelated spiral started');
    const before=s.dynamic.map(p=>p.body.position.clone());s.push(i);
    s.dynamic.forEach((p,k)=>assert.ok(p.body.position.distanceTo(before[k])<1e-12));s.dispose();
  }
});
test('the pinned linkage wakes as one assembly without adding energy or waking unconnected stations',()=>{
  const s=createDominoArchipelago();
  const names=['Качающийся мост','Соединительный шатун','Лопастное колесо'];
  const bodies=names.map(name=>s.dynamic.find(p=>p.name===name).body);
  bodies[0].wakeUp();
  bodies.forEach(b=>{assert.equal(b.sleepState,0);assert.equal(b.velocity.lengthSquared(),0);assert.equal(b.angularVelocity.lengthSquared(),0);});
  assert.equal(s.dynamic.find(p=>p.name==='Катящееся кольцо').body.sleepState,2);
  assert.equal(s.pushes,0);s.dispose();
});
test('hinges remain attached and the hollow hoop rolls into the front row',()=>{
  const s=createDominoArchipelago();s.push(s.launches.find(l=>l.title==='Кольцо').index);run(s,5);
  const front=s.dynamic.filter(p=>p.kind==='domino'&&Math.abs(p.initial.z-9.2)<.01);
  assert.ok(front.filter(tipped).length>=4,'hoop did not strike the domino lane');
  for(const h of s.hinges)assert.ok(h.body.pointToWorldFrame(h.pivot).distanceTo(h.anchor)<.04);
  s.dispose();
});
test('fixed steps agree at 30 and 120 fps, and invalid deltas are ignored',()=>{
  const samples=[30,120].map(fps=>{const s=createDominoArchipelago();s.push(0);run(s,1,fps);const result=s.dynamic.map(p=>p.body.position.clone());const time=s.time;s.update(NaN);s.update(-1);assert.equal(s.time,time);s.dispose();return result;});
  samples[0].forEach((p,i)=>assert.ok(p.distanceTo(samples[1][i])<1e-7));
});

test('settled tiles freeze with their collider and mass, wake locally without energy, and accept another click',()=>{
  const world=new World({gravity:new Vec3(0,-22,0),allowSleep:true});
  world.addBody(new Body({mass:0,shape:new Box(new Vec3(20,.1,20)),position:new Vec3(0,-.1,0)}));
  const body=new Body({mass:.12,allowSleep:false,shape:new Box(new Vec3(.05,.47,.25)),position:new Vec3(0,.052,0)});
  body.quaternion.setFromEuler(0,0,Math.PI/2);world.addBody(body);
  const ball=new Body({mass:1,shape:new Sphere(.15),position:new Vec3(8,.16,0)});world.addBody(ball);ball.sleep();
  const manager=createLocalDominoSleep(world,[{kind:'domino',body},{kind:'ball',body:ball}]);
  for(let i=0;i<240;i++){world.step(1/120);manager.update();}
  assert.equal(body.type,Body.STATIC);assert.equal(body.sleepState,Body.SLEEPING);
  assert.equal(body.mass,.12);assert.equal(body.shapes.length,1);
  const position=body.position.clone();
  for(let i=0;i<120;i++){world.step(1/120);manager.update();}
  assert.ok(position.distanceTo(body.position)<1e-12,'frozen tile drifted');
  ball.wakeUp();ball.velocity.x=-.8;
  for(let i=0;i<4;i++)manager.update();
  assert.equal(body.type,Body.STATIC,'distant activity woke the tile');
  ball.position.set(.8,.16,0);
  for(let i=0;i<4;i++)manager.update();
  assert.equal(body.type,Body.DYNAMIC,'nearby activity did not restore dynamics before contact');
  assert.equal(body.sleepState,Body.AWAKE);assert.equal(body.velocity.lengthSquared(),0);
  ball.position.set(8,.16,0);ball.sleep();
  for(let i=0;i<240;i++){world.step(1/120);manager.update();}
  assert.equal(body.type,Body.STATIC);
  manager.wake(body);body.applyImpulse(new Vec3(.055,0,0));
  assert.equal(body.type,Body.DYNAMIC);assert.ok(body.velocity.x>0);
  manager.dispose();
});

test('a stationary airborne tile is not frozen, and the local query does not scan distant pairs',()=>{
  const world=new World({gravity:new Vec3(),allowSleep:true}),parts=[];
  for(let i=0;i<100;i++){
    const body=new Body({mass:.12,allowSleep:false,shape:new Box(new Vec3(.05,.47,.25)),position:new Vec3(i*10,10,0)});
    world.addBody(body);parts.push({kind:'domino',body});
  }
  parts[99].body.velocity.x=1;
  const manager=createLocalDominoSleep(world,parts);
  for(let i=0;i<240;i++){world.step(1/120);manager.update();}
  assert.equal(manager.stats.freezes,0);assert.ok(parts.every(p=>p.body.type===Body.DYNAMIC));
  assert.ok(manager.stats.checks<10,'neighborhood checks became all-pairs');manager.dispose();
});

test('the hammer passes through five cradle balls and the return lane, then spent tiles leave simulation',()=>{
  const s=createDominoArchipelago(),cradle=s.dynamic.filter(p=>p.kind==='cradle');
  const gate=s.dynamic.find(p=>p.name==='Маятниковый переводчик'),end=s.dynamic.find(p=>p.name==='Обратный финиш');
  const byBody=new Map(s.dynamic.map(p=>[p.body,p]));
  const transfers=new Set();let peak=0,gateHit=false;
  cradle.forEach((p,i)=>p.body.addEventListener('collide',e=>{
    if(i===0&&byBody.get(e.body)?.lane===9)transfers.add('input');
    if(i>0&&e.body===cradle[i-1].body)transfers.add(i);
  }));
  gate.body.addEventListener('collide',e=>{if(e.body===cradle.at(-1).body)gateHit=true;});
  s.push(s.launches.find(l=>l.title==='Молот').index);
  for(let i=0;i<30*120;i++){s.update(1/120);peak=Math.max(peak,end.body.position.distanceTo(end.initial));}
  assert.equal(transfers.size,5);assert.ok(gateHit,'last ball missed the hinged exit');
  assert.ok(s.dynamic.filter(p=>p.lane===13).every(tipped),'return lane stopped');
  assert.ok(peak>.2,'reverse finish did not move');
  const spent=s.dynamic.filter(p=>p.lane===9||p.lane===13);
  assert.ok(spent.filter(p=>p.body.sleepState===Body.SLEEPING).length>spent.length*.8,'settled tiles stayed active');
  const frozen=spent.find(p=>p.body.type===Body.STATIC);assert.ok(frozen);
  s.push(s.dynamic.indexOf(frozen));assert.equal(frozen.body.type,Body.DYNAMIC);assert.ok(frozen.body.velocity.length()>0);
  assert.equal(s.pushes,2);s.dispose();
});
