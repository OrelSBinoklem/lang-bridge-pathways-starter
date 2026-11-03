import type { CanvasSceneDef, SceneCtx } from './types';
import { World, T, TAU, v } from './cinematic/world';
import { backdrop, bake, cylinder, group, plant, round } from './cinematic/storyKit';

/** New compositions own one continuous world, also in compact headers. No duplicated side scenes. */
function prepare(c: SceneCtx, color: string) {
  const w = new World(c, color, '#102127');
  backdrop(w, '#142f3a', '#0b171b'); w.cameraMotion = .15;
  w.eye.set(0, 9, 14); w.target.set(0, -3, 0);
  if (w.mobile) { w.eye.set(0, 12, 28); w.root.scale.setScalar(.65); w.target.set(0,-2,0); }
  if (!c.body && c.width / c.height > 3) { w.eye.set(0, 8, 19); w.camera.setViewOffset(c.width, c.height, -c.width * .15, 0, c.width, c.height); }
  return w;
}

export const WEEK_GARDENS: CanvasSceneDef = {
  kind: 'canvas', id: 'week-gardens', label: 'Семь садов недели · живая обсерватория времени',
  palettes: [['#0e222a', '#8fd5bf', '#e7bd79', '#b7a1d9']],
  defaultParams: { cinemaBloom: .32, cinemaCamera: .15 },
  create(c) {
    const w = prepare(c, '#8fd5bf');
    const bronze = w.metal('#bd9862', .8, .3), dark = w.metal('#203d43', .5, .42);
    const jade = w.metal('#3b8b78', .25, .34), stem = w.metal('#417667', .15, .57);
    const ivory = w.metal('#e9e0c5', .08, .35), soil = w.metal('#302c30', .05, .95);
    const glass = w.glass('#b5e7df', .11), rim = w.glow('#83d9c3', .65);
    const base = group(w.root, 0, -3.6);
    cylinder(w, base, 7.8, .28, dark); cylinder(w, base, 7.65, .06, bronze, 0, .17);
    cylinder(w, base, 7.4, .08, dark, 0, .23);
    for (let i=0;i<84;i++) {
      const a=i/84*TAU, length=i%7===0?.38:.15;
      w.beam(base,v(Math.sin(a)*7.04,.3,Math.cos(a)*7.04),v(Math.sin(a)*(7.04+length),.3,Math.cos(a)*(7.04+length)),.012,bronze);
    }
    bake(base);
    const sun = group(w.root,0,-.25);
    w.sphere(sun,.8,[0,0,0],w.glow('#efc98c',1.2));
    for(let i=0;i<3;i++) {const r=w.ring(sun,1.15+i*.22,.025,bronze);r.rotation.set(i*.8,.5+i,.25);}
    const trunk = group(w.root,0,-2.6); cylinder(w,trunk,.22,1.8,bronze);
    const hand=group(w.root,0,-3.18); w.beam(hand,v(),v(0,0,6.7),.022,rim);
    const names=c.locale==='uk'?['ПН','ВТ','СР','ЧТ','ПТ','СБ','НД']:['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
    const latin=['PIRMDIENA','OTRDIENA','TREŠDIENA','CETURTDIENA','PIEKTDIENA','SESTDIENA','SVĒTDIENA'];
    const colors=['#e49a93','#e5be79','#a1c382','#73beb3','#82b1d4','#b19ad2','#d49bc5'];
    const pods=names.map((name,i)=>{
      const a=i/7*TAU, root=group(w.root,Math.sin(a)*5.65,-2.4,Math.cos(a)*4.4);
      const staticPart=group(root); cylinder(w,staticPart,1.17,.28,bronze); cylinder(w,staticPart,1.08,.1,soil,0,.18);
      for(let k=0;k<12;k++){const b=k/12*TAU; w.sphere(staticPart,.035,[Math.sin(b)*1.1,.03,Math.cos(b)*1.1],ivory);}
      const tag=w.text(staticPart,name,'#e9d4b4',.64,.3);tag.position.set(0,-.38,1.1);
      bake(staticPart);
      const dome=group(root,0,.22);
      const shell=w.mesh(new T.SphereGeometry(1.12,32,18,0,TAU,0,Math.PI/2),glass,dome);shell.scale.y=1.85;
      const edge=w.ring(dome,1.12,.025,bronze);edge.rotation.x=Math.PI/2;
      w.sphere(dome,.055,[0,2.1,0],bronze);
      const bloom=group(root,0,.24); cylinder(w,bloom,.035,1.32,stem,0,.65);
      const flower=group(bloom,0,1.35);
      const petalMaterial=w.metal(colors[i],.12,.34), heart=w.glow(colors[i],.55);
      const petals=Array.from({length:8},(_,j)=>{
        const pivot=group(flower);pivot.rotation.y=j/8*TAU;
        const mesh=w.sphere(pivot,.3,[0,.2,.27],petalMaterial);mesh.scale.set(.6,1.5,.4);
        return pivot;
      });
      w.sphere(flower,.14,[0,.08,0],heart);
      for(let j=0;j<3;j++){
        const leaf=w.sphere(bloom,.28,[Math.sin(j*2.4)*.23,.45+j*.22,Math.cos(j*2.4)*.23],jade);leaf.scale.set(.4,.25,1.35);leaf.rotation.y=j*2.4;
      }
      const label=w.text(root,latin[i],'#c5ddd2',1.75,.17);label.position.set(0,-.7,.25);
      return {root,dome,flower,petals,open:0,target:0,phase:i*.82};
    });
    const ray=new T.Raycaster(),mouse=new T.Vector2();
    const comet=w.sphere(w.root,.075,[0,0,0],w.glow('#f5d992',2));
    let next=2, selected=-1;
    w.ticks.push((t,dt,p)=>{
      next-=dt;
      if(p.clicked&&c.params.react>0){
        mouse.set(p.rawX/c.width*2-1,1-p.rawY/c.height*2);ray.setFromCamera(mouse,w.camera);
        let best=-1, distance=Infinity;
        pods.forEach((pod,i)=>{const hits=ray.intersectObject(pod.root,true);if(hits[0]&&hits[0].distance<distance){best=i;distance=hits[0].distance;}});
        if(best>=0){selected=best;pods[best].target=1-pods[best].target;next=12;}
      }
      if(next<0){selected=(selected+1)%7;pods.forEach((pod,i)=>{pod.target=i===selected?1:0;});next=3.6;}
      pods.forEach((pod,i)=>{
        pod.open+=(pod.target-pod.open)*(1-Math.exp(-dt*2.7));
        pod.dome.position.y=.22+pod.open*1.6;
        pod.dome.rotation.z=Math.sin(t*.35+pod.phase)*.035*pod.open;
        pod.flower.rotation.y=t*.12;
        pod.petals.forEach((petal,j)=>{petal.rotation.x=.12+pod.open*(.85+.1*Math.sin(t*.8+j+i));});
      });
      sun.rotation.y=t*.15;sun.rotation.z=Math.sin(t*.21)*.16;hand.rotation.y=-t*.045;
      const a=t*.45;comet.position.set(Math.sin(a)*3.1,-.3+Math.cos(a*1.4)*.6,Math.cos(a)*2.7);
    });
    return w;
  },
};

export const FOLDING_HOME: CanvasSceneDef = {
  kind:'canvas',id:'folding-home',label:'Дом в разрезе · комнаты и раздвигающиеся этажи',
  palettes:[['#1b2d37','#e7c29b','#7bb6af','#c9806d']],
  defaultParams:{cinemaBloom:.18,cinemaCamera:.1},
  create(c){
    const w=prepare(c,'#80bdad');w.eye.set(11,9,17);w.target.set(0,-.5,0);
    if(w.mobile) { w.eye.set(12,12,24); w.target.set(0,-.3,0); }
    const wood=w.metal('#a8744e',.08,.68),plaster=w.metal('#ddd3bc',.02,.84),teal=w.metal('#437c79',.1,.6);
    const metal=w.metal('#2f454a',.6,.4),gold=w.metal('#d1ac6c',.75,.3),linen=w.metal('#e9d5b7',0,.95);
    const coral=w.metal('#b8796b',0,.8),light=w.glow('#f4d2a1',.65),book=w.metal('#63877c',0,.8);
    const foundation=group(w.root,0,-5);
    round(w,foundation,[12,.45,8],[0,0,0],metal,.2);round(w,foundation,[11.8,.08,7.8],[0,.26,0],wood,.1);
    for(let i=0;i<20;i++)w.box(foundation,[.018,.009,7.7],[-5.5+i*.56,.31,0],metal);
    bake(foundation);
    const floors=Array.from({length:3},(_,floor)=>{
      const root=group(w.root,0,-4.6+floor*2.7), structure=group(root);
      round(w,structure,[8.6,.18,5.5],[0,0,0],wood,.08);
      w.box(structure,[8.6,2.5,.16],[0,1.3,-2.67],plaster);
      w.box(structure,[.16,2.5,5.5],[-4.22,1.3,0],plaster);
      w.box(structure,[.12,1.9,2.1],[.3,1,-1.7],teal);
      for(let x=-4;x<=4;x+=.43)w.box(structure,[.012,.01,5.4],[x,.1,0],metal);
      for(let x=-3;x<=3;x+=2){
        round(w,structure,[1.15,1.38,.05],[x,1.43,-2.56],teal,.04);
        w.box(structure,[.94,1.12,.03],[x,1.43,-2.51],light);
        w.box(structure,[.035,1.18,.04],[x,1.43,-2.47],linen);w.box(structure,[1,.035,.04],[x,1.43,-2.47],linen);
        round(w,structure,[1.3,.08,.26],[x,.8,-2.42],wood,.02);
      }
      // Different room equipment on every storey; no facades hiding an empty interior.
      if(floor===0){
        round(w,structure,[3.2,.75,1.8],[-1.8,.5,.8],teal,.2);
        round(w,structure,[3.2,.9,.3],[-1.8,1.05,.03],teal,.13);
        for(const x of [-2.8,-1.8,-.8])round(w,structure,[.9,.18,1.22],[x,.92,.8],linen,.1);
        for(const x of [-3.23,-.37])round(w,structure,[.32,.9,1.7],[x,.83,.8],teal,.1);
        round(w,structure,[1.7,.12,.9],[1.1,.73,1.2],wood,.06);
        for(const x of [.5,1.7])for(const z of [.9,1.5])w.box(structure,[.07,.65,.07],[x,.35,z],metal);
        for(let j=0;j<3;j++)round(w,structure,[.55,.05,.35],[1.05,.83+j*.055,1.15],j%2?coral:book,.02);
        const rug=round(w,structure,[5.8,.025,2.8],[-.6,.13,1],linen,.03);
        rug.position.y=.13;
      }else if(floor===1){
        round(w,structure,[3.1,.55,3.5],[-1.8,.42,-.1],wood,.1);
        round(w,structure,[3,.4,3.35],[-1.8,.88,-.1],linen,.15);
        round(w,structure,[3,.15,2],[-1.8,1.14,.65],coral,.08);
        for(const x of [-2.55,-1.05])round(w,structure,[1.15,.24,.65],[x,1.19,-1.15],linen,.15);
        round(w,structure,[.8,.65,.8],[.4,.45,-1.5],wood,.06);
        cylinder(w,structure,.06,.38,gold,.4,.98,-1.5);
        w.mesh(new T.ConeGeometry(.28,.35,24),light,structure,v(.4,1.3,-1.5));
        round(w,structure,[1.7,2.1,1.1],[2.9,1.15,-1.9],teal,.08);
        w.beam(structure,v(2.9,.5,-1.32),v(2.9,1.85,-1.32),.018,gold);
      }else{
        round(w,structure,[3.6,.17,1.35],[-1.7,1.08,-1.25],wood,.08);
        for(const x of [-3.2,-.2])for(const z of [-1.8,-.7])w.box(structure,[.08,1,.08],[x,.55,z],metal);
        for(let j=0;j<12;j++){
          const b=round(w,structure,[.15,.45+(j%3)*.1,.45],[1.1+j*.19,.47,-2.1],j%3===0?coral:j%3===1?book:linen,.02);b.rotation.z=(j%4===0?.12:0);
        }
        for(let j=0;j<3;j++)w.box(structure,[2.7,.08,.65],[2.15,.2+j*.8,-2.12],wood);
        round(w,structure,[.85,.1,.7],[-1.7,.56,.25],teal,.08);round(w,structure,[.85,.85,.1],[-1.7,.99,.6],teal,.08);
        for(const x of [-2.03,-1.37])for(const z of [-.01,.51])w.box(structure,[.055,.5,.055],[x,.28,z],metal);
      }
      for(let j=0;j<2;j++){
        const frame=round(w,structure,[.7,.9,.05],[-4.1,.9+j*.95,1.4],gold,.03);frame.rotation.y=Math.PI/2;
        const art=round(w,structure,[.56,.75,.06],[-4.06,.9+j*.95,1.4],j?coral:teal,.02);art.rotation.y=Math.PI/2;
      }
      bake(structure);plant(w,root,3.2,.12,1.6,.7,floor===0);
      return root;
    });
    const roof=group(w.root,0,3.7),roofMat=w.metal('#9b554b',.2,.65);
    for(const sign of [-1,1]){
      const panel=round(w,roof,[5.05,.18,6],[sign*2.15,.38,0],roofMat,.03);panel.rotation.z=-sign*.38;
      for(let j=0;j<17;j++){
        const tile=w.beam(roof,v(sign*.1,1.2,-2.8+j*.35),v(sign*4.42,-.5,-2.8+j*.35),.027,coral);tile.castShadow=false;
      }
    }
    bake(roof);
    const porch=group(w.root,-5,-4.7,1.4);plant(w,porch,0,0,0,1.25,true);
    const tree=group(w.root,5,-4.6,-2.2);cylinder(w,tree,.13,2.3,wood,0,1.15);
    for(let i=0;i<7;i++)w.sphere(tree,.65,[Math.sin(i*2.4)*.55,2.4+(i%3)*.35,Math.cos(i*2.4)*.5],teal);
    bake(tree);
    const ray=new T.Raycaster(),mouse=new T.Vector2();let target=0,open=0,manual=false;
    w.ticks.push((t,dt,p)=>{
      if(p.clicked&&c.params.react>0){mouse.set(p.rawX/c.width*2-1,1-p.rawY/c.height*2);ray.setFromCamera(mouse,w.camera);if(ray.intersectObjects([...floors,roof],true).length){target=manual?1-target:1;manual=true;}}
      if(!manual)target=.22+.2*Math.sin(t*.32);
      open+=(target-open)*(1-Math.exp(-dt*3));
      floors.forEach((floor,i)=>{floor.position.y=-4.6+i*(2.7+open*1.1);floor.position.x=(i-1)*open*1.3;floor.rotation.y=(i-1)*open*.08;});
      roof.position.y=3.7+open*3.8;roof.rotation.y=open*.13;
      // Back away as the roof rises so the fully opened house stays inside the view.
      if(w.mobile)w.eye.set(12+open*2,12+open*2,24+open*4);
      else w.eye.set(11+open*1.8,9+open*1.5,17+open*3.5);
      w.target.y=(w.mobile?-.3:-.5)+open*1.3;
    });
    return w;
  },
};
