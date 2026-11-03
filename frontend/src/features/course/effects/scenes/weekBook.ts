import type { CanvasSceneDef } from './types';
import { T, World, v } from './cinematic/world';
import { backdrop, bake, cylinder, group, person, round } from './cinematic/storyKit';
import { WEEK_BOOK_DAYS, WeekBookTurn } from './weekBookState';
import { WEEK_BOOK_STORY, weekBookPath, type WeekBookPanorama } from './weekBookStory';
import { weekBookExtras, type DayExtras } from './weekBookExtras';

const PAGE_W=5.15, PAGE_D=6.5;

/** Page art is baked once. No downloaded models, image sequences or per-frame texture uploads. */
function pageTexture(w: World, index: number | null) {
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;
  const g=canvas.getContext('2d')!;
  g.fillStyle='#f2e9d5';g.fillRect(0,0,768,1024);
  for(let i=0;i<7000;i++){
    const x=w.c.rand()*768,y=w.c.rand()*1024;
    g.fillStyle=i%2?'#8f775109':'#ffffff24';g.fillRect(x,y,1,1);
  }
  const day=index===null?null:WEEK_BOOK_DAYS[index],color=day?.color??'#657f79';
  g.strokeStyle='#b6a58670';g.lineWidth=2;g.strokeRect(34,30,700,958);
  g.fillStyle=color;g.fillRect(52,52,6,92);
  g.fillStyle='#354b4b';g.font='28px Georgia';g.fillText('LANGBRIDGE · NEDĒĻA',80,85);
  g.font='52px Georgia';g.fillText(day?.lv??'Septiņas dienas',80,145);
  g.fillStyle='#7b7569';g.font='23px system-ui';
  g.fillText(day?`${day.time}  /  ${day.place}`:'7 dienas · 7 mazi piedzīvojumi',80,190);
  if(day){
    // Faint architectural map remains visible round the raised paper miniatures.
    g.strokeStyle='#a9b6a22a';g.lineWidth=1;
    for(let x=76;x<710;x+=42){g.beginPath();g.moveTo(x,250);g.lineTo(x,860);g.stroke();}
    for(let y=260;y<890;y+=42){g.beginPath();g.moveTo(65,y);g.lineTo(705,y);g.stroke();}
    g.setLineDash([7,9]);g.strokeStyle=color+'88';g.lineWidth=3;
    // The dotted route: the path Anna actually walks (page coordinates → canvas).
    g.beginPath();
    for(let k=0;k<=40;k++){const [px,pz]=weekBookPath(index!,k/40);const cx=px/PAGE_W*768,cy=(pz+PAGE_D/2)/PAGE_D*1024;if(k)g.lineTo(cx,cy);else g.moveTo(cx,cy);}
    g.stroke();g.setLineDash([]);
    g.fillStyle='#4d655f';g.font='24px Georgia';
    const activity=w.c.locale==='uk'?day.activityUk:day.activity;
    g.fillText(activity,65,925,640);
    g.fillStyle=color;g.font='28px Georgia';g.fillText(String(index!+1).padStart(2,'0'),660,966);
  }else{
    WEEK_BOOK_DAYS.forEach((d,i)=>{
      const y=286+i*81;
      g.fillStyle=d.color;g.beginPath();g.arc(90,y-8,14,0,Math.PI*2);g.fill();
      g.fillStyle='#354b4b';g.font='29px Georgia';g.fillText(d.lv,127,y);
      g.fillStyle='#8c8170';g.font='20px system-ui';g.fillText(`${d.time}  ·  ${d.place}`,127,y+28);
      g.strokeStyle='#b6a58650';g.beginPath();g.moveTo(70,y+46);g.lineTo(690,y+46);g.stroke();
    });
    g.fillStyle='#8c8170';g.font='19px system-ui';g.fillText(w.c.locale==='uk'?'Обери день — відкрий маленьку історію':'Выбери день — открой маленькую историю',65,954,640);
  }
  const texture=w.ownTexture(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;
  texture.anisotropy=Math.min(8,w.renderer.capabilities.getMaxAnisotropy());return texture;
}

/** The left page of a day: its story, Anna's phrase in Latvian with the translation, a little vignette. */
function storyTexture(w: World, index: number) {
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;
  const g=canvas.getContext('2d')!;
  g.fillStyle='#f2e9d5';g.fillRect(0,0,768,1024);
  for(let i=0;i<7000;i++){g.fillStyle=i%2?'#8f775109':'#ffffff24';g.fillRect(w.c.rand()*768,w.c.rand()*1024,1,1);}
  const day=WEEK_BOOK_DAYS[index],story=WEEK_BOOK_STORY[index],uk=w.c.locale==='uk';
  g.strokeStyle='#b6a58670';g.lineWidth=2;g.strokeRect(34,30,700,958);
  g.fillStyle=day.color;g.fillRect(52,52,6,92);
  g.fillStyle='#354b4b';g.font='28px Georgia';g.fillText(`ANNA RĪGĀ · ${String(index+1).padStart(2,'0')}/07`,80,85);
  g.font='52px Georgia';g.fillText(day.lv,80,145);
  g.fillStyle='#7b7569';g.font='23px system-ui';g.fillText(`${uk?day.uk:day.ru} · ${day.time} · ${day.place}`,80,190);
  // The story, wrapped.
  g.fillStyle='#22302e';g.font='600 31px Georgia';
  const words=(uk?story.uk:story.ru).split(' ');let line='',y=275;
  for(const word of words){const next=line?line+' '+word:word;if(g.measureText(next).width>620){g.fillText(line,72,y);y+=42;line=word;}else line=next;}
  if(line)g.fillText(line,72,y);
  // The phrase, as a speech bubble printed on the page.
  y+=70;
  g.fillStyle=day.color+'33';g.strokeStyle=day.color;g.lineWidth=3;
  g.beginPath();g.roundRect(64,y-46,640,150,24);g.fill();g.stroke();
  g.beginPath();g.moveTo(120,y+104);g.lineTo(150,y+140);g.lineTo(170,y+104);g.fill();
  g.fillStyle='#24423f';g.font='italic 38px Georgia';g.fillText(story.phrase,92,y+8,590);
  g.fillStyle='#6d685d';g.font='25px system-ui';g.fillText(uk?story.phraseUk:story.phraseRu,92,y+60,590);
  // A small engraving at the foot: the day's place in line, and the heroine's silhouette.
  g.strokeStyle='#8a7d66';g.lineWidth=2;
  const fy=900;g.beginPath();g.moveTo(80,fy);g.lineTo(690,fy);g.stroke();
  for(let k=0;k<14;k++){const x=95+k*43,h=20+((k*37+index*11)%5)*12;g.strokeRect(x,fy-h,30,h);}
  g.fillStyle='#b5534c';g.beginPath();g.arc(640,fy-62,11,0,Math.PI*2);g.fill();g.fillRect(631,fy-50,18,40);
  g.fillStyle='#7b7569';g.font='19px system-ui';g.fillText(uk?'Обери інший день — гортай історію':'Выбери другой день — листай историю',72,960);
  const texture=w.ownTexture(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;
  texture.anisotropy=Math.min(8,w.renderer.capabilities.getMaxAnisotropy());return texture;
}

/** A pop-up panorama flat of Riga for a day: far (with the sky, opaque) or near (a cut-out silhouette). */
function panoramaTexture(w: World, kind: WeekBookPanorama, sky: [string,string], night: boolean, near: boolean) {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const g=canvas.getContext('2d')!;const H=512,base=500;
  const rnd=w.c.rand;
  if(!near){
    const grad=g.createLinearGradient(0,0,0,H);grad.addColorStop(0,sky[0]);grad.addColorStop(1,sky[1]);
    g.fillStyle=grad;g.beginPath();g.roundRect(4,4,1016,504,40);g.fill();
    if(night){for(let i=0;i<120;i++){g.fillStyle=`rgba(255,250,220,${(.3+rnd()*.6).toFixed(2)})`;g.fillRect(rnd()*1024,rnd()*300,2,2);}
      g.fillStyle='#f6eed6';g.beginPath();g.arc(820,110,38,0,Math.PI*2);g.fill();}
    else{g.fillStyle='rgba(255,246,214,.85)';g.beginPath();g.arc(180,120,46,0,Math.PI*2);g.fill();
      g.fillStyle='rgba(255,255,255,.7)';for(const [x,y] of [[420,110],[640,70],[860,150]])for(let k=0;k<4;k++){g.beginPath();g.ellipse(x+k*34,y+(k%2)*8,46,22,0,0,Math.PI*2);g.fill();}}
  }
  const ink=near?(night?'#1d2234':'#4c5f63'):(night?'#2e3557':'#9fb0b6');
  g.fillStyle=ink;
  const lit=(x:number,y:number,ww:number,hh:number)=>{if(!night)return;g.fillStyle='#ffd27a';for(let yy=y+10;yy<y+hh-14;yy+=26)for(let xx=x+8;xx<x+ww-12;xx+=22)if(rnd()<.55)g.fillRect(xx,yy,9,13);g.fillStyle=ink;};
  const gable=(x:number,ww:number,hh:number)=>{g.beginPath();g.moveTo(x,base);g.lineTo(x,base-hh);for(let k=0;k<4;k++){g.lineTo(x+ww*(k*.125+.06),base-hh-k*14);g.lineTo(x+ww*(k*.125+.125),base-hh-k*14);}g.lineTo(x+ww/2,base-hh-70);g.lineTo(x+ww,base-hh);g.lineTo(x+ww,base);g.fill();lit(x,base-hh,ww,hh);};
  const spire=(x:number,ww:number,hh:number,top:number)=>{g.fillRect(x,base-hh,ww,hh);g.beginPath();g.moveTo(x-6,base-hh);g.lineTo(x+ww/2,base-hh-top);g.lineTo(x+ww+6,base-hh);g.fill();g.fillRect(x+ww/2-2,base-hh-top-24,4,26);};
  const tree=(x:number,r:number)=>{g.fillRect(x-4,base-r*1.2,8,r*1.2);g.beginPath();g.arc(x,base-r*1.6,r,0,Math.PI*2);g.arc(x-r*.6,base-r*1.2,r*.7,0,Math.PI*2);g.arc(x+r*.6,base-r*1.25,r*.7,0,Math.PI*2);g.fill();};
  if(kind==='oldtown'||kind==='nightgables'){
    if(!near){spire(470,70,170,210);spire(250,60,130,120);g.fillRect(600,base-150,180,150);g.beginPath();g.arc(690,base-150,60,Math.PI,0);g.fill();}
    else for(let x=-10;x<1024;x+=110+Math.floor(rnd()*30))gable(x,90+rnd()*20,120+rnd()*90);
  }else if(kind==='stadium'){
    if(!near){g.beginPath();g.ellipse(512,base,420,120,0,Math.PI,0);g.fill();for(const x of [150,874]){g.fillRect(x-6,base-300,12,300);g.fillRect(x-40,base-310,80,30);}}
    else{g.fillRect(0,base-160,1024,160);g.fillStyle=near?'#e2e8e6':ink;for(let x=30;x<1000;x+=70)g.fillRect(x,base-130,46,70);}
  }else if(kind==='lightcastle'){
    if(!near){g.beginPath();g.moveTo(260,base);g.lineTo(512,base-330);g.lineTo(560,base-300);g.lineTo(780,base);g.fill();g.fillStyle=night?'#ffd27a':'#d7e6ee';for(let y=base-280;y<base-20;y+=30)g.fillRect(470-(base-y)*.0,y,90+(base-y)*0,4);}
    else{g.fillStyle=near?'#6f8f9e':ink;g.fillRect(0,base-60,1024,60);g.fillStyle=ink;for(let x=0;x<1024;x+=120)tree(x+40,34+rnd()*14);}
  }else if(kind==='hangars'){
    for(let k=0;k<5;k++){const x=40+k*200,ww=180,hh=near?120:200;if(near&&k%2)continue;g.beginPath();g.moveTo(x,base);g.lineTo(x,base-hh*.4);g.quadraticCurveTo(x+ww/2,base-hh*1.25,x+ww,base-hh*.4);g.lineTo(x+ww,base);g.fill();}
    if(near){for(let x=0;x<1024;x+=60){g.fillStyle=['#c8513d','#e9b44a','#6f9f5a'][Math.floor(x/60)%3];g.beginPath();g.moveTo(x,base-70);g.lineTo(x+60,base-70);g.lineTo(x+52,base-40);g.lineTo(x+8,base-40);g.fill();}}
  }else if(kind==='jugend'){
    for(let x=0;x<1024;x+=200){const hh=near?220:300;g.fillStyle=ink;g.fillRect(x+10,base-hh,180,hh);g.beginPath();g.arc(x+100,base-hh,70,Math.PI,0);g.fill();
      g.fillStyle=near?'#e9dfc8':'rgba(255,255,255,.35)';for(let k=0;k<3;k++){g.beginPath();g.arc(x+50+k*50,base-hh+70,14,0,Math.PI*2);g.fill();}
      g.beginPath();g.arc(x+100,base-hh-20,24,0,Math.PI*2);g.fill();}
  }else{
    if(!near){g.fillRect(500,base-300,26,300);g.beginPath();g.moveTo(490,base-300);g.lineTo(536,base-300);g.lineTo(513,base-380);g.fill();g.beginPath();g.arc(513,base-390,14,0,Math.PI*2);g.fill();for(let x=0;x<1024;x+=90)if(Math.abs(x-512)>80)tree(x,40+rnd()*20);}
    else{g.fillStyle=near?'#7aa4b7':ink;g.fillRect(0,base-40,1024,40);g.fillStyle=ink;for(let x=0;x<1024;x+=130)tree(x+60,48+rnd()*16);}
  }
  const texture=w.ownTexture(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;return texture;
}

export const WEEK_BOOK: CanvasSceneDef = {
  kind:'canvas',id:'week-book',label:'Книга недели · семь объёмных историй',
  palettes:[['#14282d','#e4c59b','#79b5ac','#c38c73']],
  defaultParams:{quality:1,zoom:1.05,cinemaBloom:.15,cinemaCamera:0,weekBookDay:0},
  warmupFrames:1,
  create(c){
    const w=new World(c,'#98c9bc','#14282d');backdrop(w,'#203b40','#101e24');
    w.cameraMotion=0;w.exposure=.92;w.camera.fov=40;w.eye.set(7,9,12);w.target.set(0,-3,0);
    if(w.mobile){w.eye.set(8,13,24);w.target.set(0,-2,0);w.root.scale.setScalar(.72);}
    if(!c.body&&c.width/c.height>3){w.eye.set(6,11,18);w.camera.setViewOffset(c.width,c.height,-c.width*.17,0,c.width,c.height);}
    const cream=w.metal('#f0e5cb',0,.85),wood=w.metal('#9b7656',.05,.72),dark=w.metal('#324b50',.2,.6);
    const gold=w.metal('#bd9b60',.75,.35),teal=w.metal('#639a94',.08,.65),red=w.metal('#b67668',.06,.72);
    const green=w.metal('#78a075',.05,.78),black=w.metal('#253b43',.15,.55),light=w.glow('#ead1a2',.35);
    const cover=w.metal('#315c59',.15,.5),sceneColors=WEEK_BOOK_DAYS.map(d=>w.metal(d.color,.08,.65));
    const book=group(w.root,0,-2.25);
    const binding=group(book);
    for(const side of [-1,1]){
      round(w,binding,[5.48,.22,6.85],[side*2.67,-.08,0],cover,.1);
      round(w,binding,[5.31,.05,6.65],[side*2.66,.035,0],cream,.035);
      for(const z of [-3.18,3.18])w.beam(binding,v(side*.23,.06,z),v(side*5.12,.06,z),.012,gold);
      for(const x of [side*.22,side*5.1])w.beam(binding,v(x,.06,-3.17),v(x,.06,3.17),.012,gold);
      for(let j=0;j<46;j++)for(const z of [-3.26,3.26])w.box(binding,[.035,.012,.045],[side*(.25+j*.106),.065,z],gold);
    }
    const spine=cylinder(w,binding,.18,6.75,cover,0,-.02);spine.rotation.x=Math.PI/2;
    for(const z of [-2.7,-1.4,0,1.4,2.7]){const band=w.ring(binding,.19,.018,gold,v(0,-.02,z));band.rotation.x=Math.PI/2;}
    bake(binding);
    const overview=pageTexture(w,null);
    const overviewMaterial=new T.MeshStandardMaterial({map:overview,roughness:.85,metalness:0});
    const storyMaterials=WEEK_BOOK_DAYS.map((_,i)=>new T.MeshStandardMaterial({map:storyTexture(w,i),roughness:.85,metalness:0}));
    const indexPage=w.mesh(new T.PlaneGeometry(PAGE_W,PAGE_D),storyMaterials[0],book,v(-PAGE_W/2,.072,0));indexPage.rotation.x=-Math.PI/2;
    const motion=new WeekBookTurn(c.params.weekBookDay);
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const actors:{day:number; actor:ReturnType<typeof person>}[]=[];
    const heroes:{hinge:T.Group;hero:ReturnType<typeof person>;bubble:T.Group}[]=[];
    const unfold=WEEK_BOOK_DAYS.map(()=>0);
    const extras:DayExtras[]=[];
    const wheels:{day:number;mesh:T.Object3D}[]=[];
    const sheets=WEEK_BOOK_DAYS.map((day,index)=>{
      const sheet=group(book),hinges:T.Group[]=[];
      const edge=w.mesh(new T.BoxGeometry(PAGE_W,.026,PAGE_D),cream,sheet,v(PAGE_W/2,-.012,0));edge.receiveShadow=true;
      const surface=new T.PlaneGeometry(PAGE_W,PAGE_D,28,20),positions=surface.getAttribute('position');
      for(let i=0;i<positions.count;i++)positions.setZ(i,.025*Math.sin((positions.getX(i)/PAGE_W+.5)*Math.PI));
      surface.rotateX(-Math.PI/2);surface.translate(PAGE_W/2,.012,0);surface.computeVertexNormals();
      w.mesh(surface,new T.MeshStandardMaterial({map:pageTexture(w,index),roughness:.86,metalness:0}),sheet);
      const back=new T.PlaneGeometry(PAGE_W,PAGE_D);back.rotateX(Math.PI/2);back.rotateY(Math.PI);back.translate(PAGE_W/2,-.028,0);
      w.mesh(back,index<6?storyMaterials[index+1]:overviewMaterial,sheet);
      const pop=(x:number,z:number,build:(root:T.Group)=>void,flatten=true,layer=1)=>{
        const root=group(sheet,x,.065,z);root.userData.layer=layer;hinges.push(root);build(root);if(flatten)bake(root);return root;
      };
      const actor=(x:number,z:number,color:string,scale=.9)=>pop(x,z,p=>{
        const a=person(w,p,color,scale);actors.push({day:index,actor:a});
        // Others in the scene turn towards where Anna will stand.
        const [dx,dz]=WEEK_BOOK_STORY[index].dest;p.rotation.y=Math.atan2(dx-x,dz-z);
      },false,3);
      // The day's panorama of Riga: a far card with the sky, and a nearer cut-out, layer 0 (first up).
      const story=WEEK_BOOK_STORY[index];
      for(const [near,z,h] of [[false,-2.95,2.7],[true,-2.55,1.9]] as const){
        pop(PAGE_W/2,z,p=>{
          const geo=new T.PlaneGeometry(PAGE_W-.35,h);geo.translate(0,h/2,0);
          const flat=w.mesh(geo,new T.MeshStandardMaterial({map:panoramaTexture(w,story.panorama,story.sky,!!story.night,near),transparent:true,alphaTest:.5,side:T.DoubleSide,roughness:.9}),p);
          flat.castShadow=true;
        },false,near?.5:0);
      }
      const label=(p:T.Group,name:string,y:number,width=2.6)=>{w.text(p,name,'#f4ead3',width,.25).position.set(0,y,.145);};
      if(index===0){
        pop(2.6,-.8,p=>{
          round(w,p,[3.5,2.45,.16],[0,1.225,-.4],teal,.04);
          for(let j=0;j<3;j++)for(let k=0;k<2;k++){
            round(w,p,[.79,.63,.06],[-1.1+j*1.1,.65+k*.88,-.29],cream,.02);
            w.box(p,[.035,.63,.08],[-1.1+j*1.1,.65+k*.88,-.24],gold);
          }
          round(w,p,[3.7,.2,.5],[0,2.6,-.35],dark,.03);label(p,'BIROJS',2.23);
          round(w,p,[2.4,.13,.95],[0,1,.65],wood,.04);
          for(const x of [-.94,.94])for(const z of [.3,1])w.box(p,[.07,.95,.07],[x,.5,z],dark);
          round(w,p,[.78,.5,.055],[.25,1.34,.47],black,.025);round(w,p,[.65,.36,.015],[.25,1.35,.508],light,.01);
          round(w,p,[.8,.025,.48],[.25,1.08,.79],dark,.015);
          for(let k=0;k<3;k++)w.box(p,[.34,.02,.38],[-.7,1.09+k*.025,.7],cream);
        });actor(1,1.3,'#c48b79');actor(3.7,1.45,'#7da6b1');
      }else if(index===1){
        pop(2.5,-1,p=>{
          round(w,p,[3.6,2.3,.14],[0,1.15,-.3],sceneColors[index],.04);label(p,'SPORTA ZĀLE',2.03,3);
          for(const x of [-1.4,1.4]){w.beam(p,v(x,0,0),v(x,1.9,0),.055,dark);for(let j=0;j<5;j++)w.beam(p,v(-1.4,.28+j*.3,0),v(1.4,.28+j*.3,0),.025,wood);}
        });
        pop(2.8,.9,p=>{
          round(w,p,[2.05,.17,1.1],[0,.15,0],dark,.06);
          for(const x of [-.85,.85])w.beam(p,v(x,.2,.35),v(x,1.3,-.35),.045,teal);
          w.beam(p,v(-.85,1.3,-.35),v(.85,1.3,-.35),.05,dark);
          const roller=cylinder(w,p,.13,.85,black,0,.3,.2);roller.rotation.z=Math.PI/2;wheels.push({day:index,mesh:roller});
        });actor(1,1.25,'#dfb35c');
        pop(4.3,1.4,p=>{for(const y of [.2,.65]){const bar=cylinder(w,p,.035,.75,dark,0,y,0);bar.rotation.z=Math.PI/2;for(const x of [-.4,.4]){const weight=cylinder(w,p,.16,.12,dark,x,y,0);weight.rotation.z=Math.PI/2;}}});
      }else if(index===2){
        pop(2.6,-.9,p=>{
          round(w,p,[3.6,2.4,.2],[0,1.2,-.5],wood,.04);
          const inks=[teal,red,green,sceneColors[index]];
          for(let row=0;row<3;row++){
            w.box(p,[3.4,.075,.65],[0,.3+row*.65,-.15],wood);
            for(let j=0;j<14;j++){
              const h=.35+(j%4)*.035;
              w.box(p,[.16,h,.3],[-1.52+j*.23,.34+row*.65+h/2,-.12],inks[(j+row)%4]);
              w.box(p,[.1,.017,.012],[-1.52+j*.23,.43+row*.65,-.037],gold);
            }
          }label(p,'BIBLIOTĒKA',2.17,3.2);
        });
        pop(2.75,1.05,p=>{
          cylinder(w,p,.78,.09,wood,0,.7);cylinder(w,p,.06,.7,dark,0,.35);
          for(const s of [-1,1]){const leaf=w.box(p,[.48,.035,.6],[s*.25,.78,0],cream);leaf.rotation.z=s*.12;}
        });actor(1,1.3,'#bd8396');
      }else if(index===3){
        pop(2.6,-.6,p=>{
          for(const x of [-1.6,1.6])w.beam(p,v(x,0,0),v(x,2.2,0),.055,wood);
          for(let j=0;j<9;j++){
            const awning=w.box(p,[.4,.07,1.8],[-1.6+j*.4,2.2,-.05],j%2?cream:green);awning.rotation.x=-.12;
            w.box(p,[.4,.24,.045],[-1.6+j*.4,2.03,.86],j%2?cream:green);
          }
          round(w,p,[3.5,.8,1.25],[0,.4,.1],wood,.04);label(p,'TIRGUS',.43);
          for(let j=0;j<3;j++){
            const x=(j-1)*1.1;round(w,p,[1,.18,.85],[x,.88,.1],cream,.02);
            for(let k=0;k<6;k++)w.mesh(new T.SphereGeometry(.13,12,8),j%2?green:red,p,v(x+(k%3-1)*.25,1.06,Math.floor(k/3)*.3));
          }
        });actor(1.1,1.55,'#bd9478');actor(4,1.3,'#729db5');
      }else if(index===4){
        pop(2.6,-1.1,p=>{
          round(w,p,[3.7,2.45,.15],[0,1.225,-.3],sceneColors[index],.04);
          round(w,p,[2.8,.45,.2],[0,2.15,-.15],dark,.02);label(p,'KAFEJNĪCA',2.15,2.5);
          for(const x of [-1.35,1.35]){w.box(p,[.65,1.2,.04],[x,1.2,-.17],cream);w.box(p,[.035,1.25,.05],[x,1.2,-.13],gold);}
          round(w,p,[2.8,.9,.85],[0,.45,.4],wood,.04);
          round(w,p,[.9,.55,.6],[.5,1.2,.25],dark,.08);cylinder(w,p,.11,.1,gold,.5,1.52,.25);
          for(const x of [-.65,-.25]){cylinder(w,p,.12,.19,cream,x,1.05,.45);cylinder(w,p,.095,.008,wood,x,1.15,.45);}
        });
        pop(2.7,1.45,p=>{cylinder(w,p,.65,.08,wood,0,.68);cylinder(w,p,.055,.68,dark,0,.34);for(const x of [-.25,.25])cylinder(w,p,.1,.16,cream,x,.81);});
        actor(1.2,1.55,'#81a497');actor(4,1.55,'#d3a76e');
      }else if(index===5){
        pop(2.6,-.7,p=>{
          round(w,p,[3.8,.15,1.8],[0,.08,0],cream,.03);
          round(w,p,[3.8,.24,1.3],[0,2.05,-.3],cream,.03);
          for(const x of [-1.55,1.55]){cylinder(w,p,.14,1.8,cream,x,1,-.05);cylinder(w,p,.22,.12,gold,x,.2,-.05);cylinder(w,p,.22,.12,gold,x,1.85,-.05);}
          const roof=w.mesh(new T.ConeGeometry(2.15,.65,3),cream,p,v(0,2.5,-.3));roof.rotation.y=Math.PI/2;
          w.box(p,[2.8,1.65,.12],[0,1.08,-.6],teal);label(p,'MUZEJS',2.06,2);
          round(w,p,[.7,.68,.7],[0,.49,.25],wood,.025);
          w.sphere(p,.24,[0,1.29,.25],cream);round(w,p,[.52,.43,.3],[0,.95,.25],cream,.08);
        });actor(1.1,1.5,'#769fb0');actor(4.1,1.25,'#b68b81');
      }else{
        pop(1.1,-.55,p=>{
          cylinder(w,p,.11,1.5,wood,0,.75);
          for(let j=0;j<6;j++)w.mesh(new T.SphereGeometry(.52,18,12),j%2?green:teal,p,v(Math.sin(j*2.4)*.38,1.6+(j%3)*.22,Math.cos(j*2.4)*.3));
        });
        pop(3.65,-.8,p=>{cylinder(w,p,.08,1.1,wood,0,.55);for(let j=0;j<4;j++)w.mesh(new T.SphereGeometry(.45,18,12),green,p,v(Math.sin(j*2.4)*.3,1.35+(j%2)*.25,Math.cos(j*2.4)*.25));});
        pop(2.65,.65,p=>{
          for(let j=0;j<4;j++)w.box(p,[1.9,.07,.13],[0,.5,j*.16],wood);
          for(const x of [-.78,.78])for(const z of [0,.5])w.box(p,[.07,.45,.07],[x,.25,z],dark);
          for(let j=0;j<3;j++)w.box(p,[1.9,.1,.06],[0,.75+j*.17,-.08],wood);
        });actor(1.15,1.65,'#cb916f');actor(4,1.4,'#80a3ad');
        pop(3.5,1.7,p=>{w.sphere(p,.13,[0,.16,0],wood).scale.set(1.8,1,1);w.sphere(p,.1,[.2,.3,0],wood);for(const x of [-.14,.14])for(const z of [-.07,.07])w.box(p,[.035,.14,.035],[x,.07,z],wood);});
      }
      // Anna: red coat, yellow scarf, a beret. Her hinge moves with her, so she folds about her own feet.
      const heroHinge=group(sheet,0,.065,0);heroHinge.userData.layer=4;hinges.push(heroHinge);
      const hero=person(w,heroHinge,'#c9453f',.95);
      const scarf=w.ring(hero.root,.12,.035,w.metal('#e8b93c',0,.8),v(0,.86,0));scarf.rotation.x=Math.PI/2;
      const beret=w.sphere(hero.root,.15,[0,1.17,-.01],w.metal('#6b2a3a',0,.8));beret.scale.set(1.15,.38,1.15);
      // Her speech bubble: a board with the Latvian phrase, popping up when she arrives.
      const bubble=group(heroHinge,0,1.75,0);
      round(w,bubble,[2.5,.5,.05],[0,0,0],w.metal('#fffaf0',0,.6),.12);
      const said=w.text(bubble,story.phrase,'#24423f',2.3,.3);said.position.z=.035;
      const tail=w.mesh(new T.ConeGeometry(.1,.3,3),w.metal('#fffaf0',0,.6),bubble,v(-.3,-.32,0));tail.rotation.z=Math.PI;
      heroes[index]={hinge:heroHinge,hero,bubble};
      // Each day its own ground, weather and life (weekBookExtras.ts).
      extras[index]=weekBookExtras(w,sheet,pop,index);
      // Paper-fold support tabs under the raised scene, visible at the front edge.
      const tabMat=new T.MeshStandardMaterial({color:day.color,side:T.DoubleSide,roughness:.8});
      const tabs=group(sheet);
      for(const x of [1.1,2.6,4.1]){
        const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(.32,.25);shape.lineTo(.64,0);shape.closePath();
        const tab=w.mesh(new T.ShapeGeometry(shape),tabMat,tabs,v(x-.32,.07,1.85));tab.rotation.x=Math.PI*.15;
      }
      return {sheet,hinges,tabs};
    });
    w.ticks.push((time,dt)=>{
      motion.step(dt,c.params.weekBookDay,reduce);
      sheets.forEach(({sheet,hinges,tabs},i)=>{
        sheet.rotation.z=motion.angle(i);sheet.position.y=motion.height(i);
        const rise=motion.rise(i);tabs.visible=rise>.015;tabs.scale.y=Math.max(.001,rise);
        // Once the page has landed its layers stand up one after another: panorama, buildings, props, people, Anna.
        if(reduce)unfold[i]=99;
        else if(motion.current===i&&!motion.turning)unfold[i]+=dt;
        else if(rise<=0)unfold[i]=0;
        for(const hinge of hinges){
          const layer=(hinge.userData.layer as number|undefined)??1;
          const k=Math.max(0,Math.min(1,(unfold[i]-layer*.38)/.55)),up=Math.min(rise,k*k*(3-2*k));
          // A little overshoot, as paper springs up.
          const spring=up<1&&up>0?Math.sin(up*Math.PI)*.12:0;
          hinge.visible=up>.005;hinge.rotation.x=-(1-up)*Math.PI/2-spring;
        }
        // Anna: walks the route, then does the day's thing, then says her phrase.
        const story=WEEK_BOOK_STORY[i],h=heroes[i],t=unfold[i]-1.9;
        const walkT=3.4,s=Math.max(0,Math.min(1,t/walkT)),es=s*s*(3-2*s);
        const [x,z]=weekBookPath(i,es),[x2,z2]=weekBookPath(i,Math.min(1,es+.02));
        h.hinge.position.set(x,.065,z);
        const limbs=h.hero.limbs;
        h.hero.root.position.y=0;h.hero.root.rotation.set(0,0,0);
        for(const l of limbs){l.rotation.set(0,0,0);}
        if(s<1){h.hero.root.rotation.y=Math.atan2(x2-x,z2-z);h.hero.walk(time,.9);h.hero.root.position.y=Math.abs(Math.sin(time*5))*.03;}
        else{
          const a=time-((walkT+1.9));h.hero.root.rotation.y=story.face;
          if(story.action==='wave'){limbs[3].rotation.z=2.6+Math.sin(time*8)*.35;}
          else if(story.action==='run'){h.hero.walk(time*2.3,1.1);h.hero.root.position.y=Math.abs(Math.sin(time*11.5))*.06;}
          else if(story.action==='read'){limbs[1].rotation.x=-1.25;limbs[3].rotation.x=-1.25;h.hero.root.rotation.x=.08+Math.sin(time*.8)*.03;}
          else if(story.action==='buy'){limbs[3].rotation.x=-1.5+Math.sin(time*3)*.15;}
          else if(story.action==='cheers'){limbs[3].rotation.x=-2.7+Math.sin(time*2.4)*.12;limbs[1].rotation.x=-.6;}
          else if(story.action==='look'){h.hero.root.rotation.y=story.face+Math.sin(time*.7)*.6;limbs[1].rotation.x=.5;limbs[3].rotation.x=.5;}
          else{h.hero.root.position.y=-.28;limbs[0].rotation.x=-1.45;limbs[2].rotation.x=-1.45;limbs[1].rotation.z=-.3;limbs[3].rotation.z=.3;}
          void a;
        }
        // The phrase pops up after she arrives and stays, facing the reader.
        const b=Math.max(0,Math.min(1,(t-walkT-.3)/.35));
        h.bubble.scale.setScalar(Math.max(.001,b*(1+Math.sin(b*Math.PI)*.15)));h.bubble.visible=b>0;
        if(b>0)h.bubble.lookAt(w.camera.position);
      });
      // The others: breathe and shift weight, and turn their heads a little when Anna speaks.
      for(const {day,actor} of actors)if(motion.rise(day)>.98){actor.walk(time*.23,.055);actor.root.rotation.y=Math.sin(time*.6+day)*.12;}
      for(const {day,mesh} of wheels)if(motion.rise(day)>.98)mesh.rotation.y=time*.7;
      extras.forEach((tick,i)=>tick(time,dt,motion.rise(i)>.98&&unfold[i]>1.2));
    });
    const draw=w.draw.bind(w);let lastReport='';
    w.draw=g=>{draw(g);const report=JSON.stringify({day:motion.current,requested:motion.requested,turning:motion.turning,angles:sheets.map(s=>Number(s.sheet.rotation.z.toFixed(3)))});if(report!==lastReport){g.canvas.dataset.weekBook=report;lastReport=report;}};
    return w;
  },
};
