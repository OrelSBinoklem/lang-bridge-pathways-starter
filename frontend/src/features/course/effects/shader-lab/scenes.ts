import type { ShaderSceneDef } from '../scenes/types';

const PALETTES = [
  ['#071624', '#25d7da', '#df9052', '#e9f7ff'],
  ['#150f29', '#a886ff', '#f26eae', '#fff0ba'],
  ['#08221c', '#5ae1ac', '#d3b773', '#fff8e6'],
];
const COMMON = `
const float PI=3.14159265359;
const float TAU=6.28318530718;
mat3 cameraBasis(vec3 ro,vec3 target){vec3 f=normalize(target-ro),r=normalize(cross(f,vec3(0,1,0)));return mat3(r,cross(r,f),f);}
vec3 finishLight(vec3 c){return pow(vec3(1)-exp(-max(c,0.)*1.2*uK.y),vec3(.4545));}
float ellipsoid(vec3 p,vec3 r){float a=length(p/r),b=length(p/(r*r));return a*(a-1.)/max(b,.001);}
float torus(vec3 p,vec2 r){return length(vec2(length(p.xz)-r.x,p.y))-r.y;}
vec3 studio(vec3 d){
  vec3 c=mix(vec3(.018,.028,.05),vec3(.22,.3,.4),max(d.y,0.));
  c+=vec3(1.5,1.8,2.1)*pow(max(0.,dot(d,normalize(vec3(-.6,1.,.5)))),28.);
  c+=uPal[2]*2.8*pow(max(0.,dot(d,normalize(vec3(1.,.2,-.4)))),38.);
  c+=uPal[1]*1.4*pow(max(0.,dot(d,normalize(vec3(-1.,.1,-.5)))),24.);
  return c;
}
`;

const MERCURY = COMMON + `
vec2 irisMap(vec3 p,float t){
  vec2 d=vec2(length(p)-.56,2.);
  for(int j=0;j<3;j++){
    float fj=float(j),n=12.+fj*4.,sector=TAU/n;
    float a=atan(p.x,p.z)+fj*.23+t*(.07-fj*.02);
    a=mod(a+sector*.5,sector)-sector*.5;
    vec3 q=vec3(sin(a)*length(p.xz),p.y+fj*.16,cos(a)*length(p.xz));
    q.z-=.88+fj*.34;
    q.yz=rot(-.28+sin(t*.38-fj*.5)*.65+fj*.21)*q.yz;
    q.y+=.14*q.z*q.z;
    float petal=ellipsoid(q,vec3(.26+fj*.045,.10,1.03));
    float groove=.0007*sin(q.z*48.)*sin(q.x*44.);
    if(petal+groove<d.x)d=vec2(petal+groove,1.+fj*.13);
  }
  vec3 g=p;g.xy=rot(.5+sin(t*.2)*.25)*g.xy;
  float halo=torus(g,vec2(2.65,.025));if(halo<d.x)d=vec2(halo,3.);
  for(int i=0;i<7;i++){
    float a=float(i)/7.*TAU+t*.23;vec3 q=p-vec3(cos(a)*2.65,sin(a*2.+t*.6)*.2,sin(a)*2.65);
    float s=length(q)-.075;if(s<d.x)d=vec2(s,3.);
  }
  float floorD=p.y+2.05;return floorD<d.x?vec2(floorD,0.):d;
}
vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
  float az=.35+sin(t*.12)*.45+M.x*.2*uK.z;
  vec3 ro=vec3(sin(az)*5.8,3.8+M.y*.35*uK.z,cos(az)*5.8);
  vec3 rd=cameraBasis(ro,vec3(0,-.15,0))*normalize(vec3(P,2.85*min(1.,uRes.x/uRes.y)));
  float dist=0.;vec2 hit=vec2(0);vec3 p=ro;
  for(int i=0;i<110;i++){p=ro+rd*dist;hit=irisMap(p,t);if(hit.x<.0015||dist>24.)break;dist+=max(.001,hit.x*.7);}
  vec3 col=studio(rd)*.13;
  if(dist<24.){
    vec2 e=vec2(.002,0);vec3 n=normalize(vec3(irisMap(p+e.xyy,t).x-irisMap(p-e.xyy,t).x,irisMap(p+e.yxy,t).x-irisMap(p-e.yxy,t).x,irisMap(p+e.yyx,t).x-irisMap(p-e.yyx,t).x));
    vec3 refl=reflect(rd,n);float fres=pow(1.-max(dot(-rd,n),0.),4.);
    float ao=clamp(irisMap(p+n*.12,t).x/.12,.2,1.);
    vec3 env=studio(refl),light=normalize(vec3(-3,6,4));
    if(hit.y<.5){
      float grid=max(pow(.5+.5*cos(p.x*4.),90.),pow(.5+.5*cos(p.z*4.),90.));
      col=vec3(.003,.006,.009)+grid*.004+env*.008;
      col*=1.-.65*exp(-dot(p.xz,p.xz)*.18);
    }else if(hit.y<1.8){
      float bands=.5+.5*sin(length(p.xz)*32.+p.y*12.);
      vec3 metal=mix(vec3(.56,.72,.79),uPal[2],smoothstep(1.05,1.26,hit.y)*.7);
      col=(env*metal*(.7+fres*.9)+pow(max(dot(n,light),0.),2.)*metal*.27)*ao;
      col+=uPal[1]*pow(1.-abs(dot(n,-rd)),5.)*.42+bands*.018;
    }else if(hit.y<2.5){
      col=env*.22+uPal[1]*(.12+.65*pow(.5+.5*sin(p.y*46.+t*2.),16.));
      col+=uPal[2]*pow(.5+.5*sin(atan(p.x,p.z)*22.+t),32.);
    }else col=env*vec3(.8,.51,.19)+uPal[2]*.2;
    col=mix(col,vec3(.012,.025,.04),1.-exp(-dist*.019));
  }
  return finishLight(col);
}`;

const REEF = COMMON + `
vec2 reefMap(vec3 p,float t){
  p.xz=rot(t*.065)*p.xz;p.yz=rot(.16*sin(t*.17))*p.yz;
  vec3 z=p;float dr=1.,r=0.,trap=10.;
  for(int i=0;i<7;i++){
    r=length(z);trap=min(trap,abs(z.y)+length(z.xz)*.12);if(r>2.6)break;
    float safeR=max(r,.00001),theta=acos(clamp(z.z/safeR,-1.,1.)),phi=atan(z.y,z.x);
    float power=7.;dr=pow(safeR,power-1.)*power*dr+1.;float zr=pow(safeR,power);
    theta*=power;phi*=power;z=zr*vec3(sin(theta)*cos(phi),sin(phi)*sin(theta),cos(theta))+p;
  }
  return vec2(.5*log(max(r,1.00001))*r/max(dr,.001),trap);
}
vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
  float a=t*.05+M.x*.12*uK.z;vec3 ro=vec3(sin(a)*3.45,.75+M.y*.22*uK.z,cos(a)*3.45);
  vec3 rd=cameraBasis(ro,vec3(0))*normalize(vec3(P,2.25*min(1.,uRes.x/uRes.y)));
  float b=dot(ro,rd),disc=b*b-dot(ro,ro)+2.05*2.05;
  vec3 bg=mix(vec3(.001,.004,.008),vec3(.003,.018,.024),uv.y);
  float dust=pow(hash21(floor(uv*uRes*.6)),400.)*.035;vec3 col=bg+dust;
  if(disc>0.){
    float dist=max(0.,-b-sqrt(disc)),limit=-b+sqrt(disc);vec2 h=vec2(1);vec3 p=ro;
    for(int i=0;i<120;i++){p=ro+rd*dist;h=reefMap(p,t);if(h.x<.0009||dist>limit)break;dist+=max(.0003,h.x*.75);}
    if(dist<limit){
      vec2 e=vec2(.0015,0);vec3 n=normalize(vec3(reefMap(p+e.xyy,t).x-reefMap(p-e.xyy,t).x,reefMap(p+e.yxy,t).x-reefMap(p-e.yxy,t).x,reefMap(p+e.yyx,t).x-reefMap(p-e.yyx,t).x));
      float ao=clamp(reefMap(p+n*.025,t).x/.025,.32,1.);
      float diffuse=max(dot(n,normalize(vec3(-3,4,5))),0.);
      vec3 mineral=mix(uPal[1]*.72,uPal[2],.5+.5*sin(h.y*19.+length(p)*3.));
      float fres=pow(1.-max(dot(-rd,n),0.),3.);
      col=mineral*(.22+diffuse*1.25)*ao+studio(reflect(rd,n))*.24*ao;
      col+=uPal[1]*fres*.33+uPal[3]*pow(max(dot(reflect(rd,n),normalize(vec3(-3,4,5))),0.),48.)*.5;
      col+=uPal[2]*pow(.5+.5*sin(h.y*110.-t*.9),28.)*.035;
      col=mix(col,bg,1.-exp(-dist*.05));
    }
  }
  col+=uPal[1]*.02*pow(max(0.,sin(P.x*3.+t*.1+sin(P.y*2.))),8.);
  return finishLight(col);
}`;

const BLACK_STAR = COMMON + `
vec3 cosmos(vec3 d){
  vec2 p=vec2(atan(d.z,d.x),asin(clamp(d.y,-1.,1.)));
  vec2 cell=p*280.;float star=pow(hash21(floor(cell)),95.)*exp(-length(fract(cell)-.5)*12.);
  float mist=fbm(p*3.+vec2(4,8))*fbm(p*6.);
  return mix(vec3(.0003,.0005,.0012),uPal[1]*.018,pow(mist,2.))+star*vec3(.4,.5,.8);
}
vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
  float a=.16*sin(t*.09)+M.x*.16*uK.z;
  vec3 ro=vec3(sin(a)*7.8,2.1+M.y*.5*uK.z,cos(a)*7.8);
  vec3 rd=cameraBasis(ro,vec3(0))*normalize(vec3(P,2.0*min(1.,uRes.x/uRes.y)));
  vec3 p=ro,col=vec3(0);float trans=1.,nearR=20.;bool swallowed=false;
  for(int i=0;i<210;i++){
    float r=length(p);nearR=min(nearR,r);
    if(r<.78){swallowed=true;break;}if(r>13.)break;
    float stepLen=clamp(r*.1,.025,.28);
    if(abs(p.y)<.35&&length(p.xz)>1.1&&length(p.xz)<4.5)stepLen=.025;
    rd=normalize(rd-p*(.46*stepLen/(r*r*r)));
    p+=rd*stepLen;
    float radius=length(p.xz);
    if(abs(p.y)<.24&&radius>1.18&&radius<4.4){
      float angle=atan(p.z,p.x),whirl=angle-t*.55/sqrt(radius)+radius*1.6;
      float grain=fbm(vec2(whirl*5.,radius*15.-t*.3));
      float strands=.35+.65*pow(.5+.5*sin(radius*64.+grain*10.),3.);
      float density=exp(-abs(p.y)*28.)*smoothstep(1.18,1.5,radius)*(1.-smoothstep(3.,4.4,radius));
      float heat=pow(1.5/radius,1.9),doppler=.65+.7*dot(normalize(vec3(-p.z,0,p.x)),-rd);
      vec3 fire=mix(uPal[2]*1.25,uPal[3]*2.,clamp(heat*.4,0.,1.));
      float alpha=1.-exp(-density*stepLen*9.);
      col+=trans*fire*alpha*(.35+strands*.7)*max(.25,doppler);trans*=1.-alpha*.85;
    }
    col+=trans*uPal[2]*exp(-abs(r-1.1)*22.)*.018*stepLen;
  }
  if(!swallowed)col+=cosmos(rd)*trans;
  col+=uPal[2]*.004*exp(-abs(nearR-1.15)*7.);
  return finishLight(col);
}`;

export const SHOWCASE_SCENES: ShaderSceneDef[] = [
  { kind: 'shader', id: 'mercury-iris', label: 'Ртутный ирис', palettes: PALETTES, fragment: MERCURY, pixelBudget: 4200000, pixelRatioCap: 2, adaptiveQuality: false },
  { kind: 'shader', id: 'crystal-reef', label: 'Кристаллический риф', palettes: PALETTES, fragment: REEF, pixelBudget: 4200000, pixelRatioCap: 2, adaptiveQuality: false },
  { kind: 'shader', id: 'black-star', label: 'Чёрная звезда', palettes: [PALETTES[0], ['#080611','#5465d4','#ec5299','#fff2dc'], PALETTES[2]], fragment: BLACK_STAR, pixelBudget: 4200000, pixelRatioCap: 2, adaptiveQuality: false },
];

export const SHOWCASE_NOTES = [
  { id: 'mercury-iris', number: '01', subtitle: 'Жидкий металл · кинетическая скульптура', description: '48 лепестков, тонкая гравировка и орбита ртутных капель. Цветок раскрывается, отражая холодный и золотой свет.', colors: ['#23bdc9','#eab676'] },
  { id: 'crystal-reef', number: '02', subtitle: 'Фрактальная геология · макромир', description: 'Объёмный риф с ветвлением на семи уровнях. Ледяные грани переходят в золотые впадины — форму можно рассматривать с разных сторон.', colors: ['#4bbec3','#937cf6'] },
  { id: 'black-star', number: '03', subtitle: 'Гравитационный театр · свет и пустота', description: 'Луч искривляется, диск закручивается, звёзды появляются за горизонтом. Художественная модель линзы, не астрофизический симулятор.', colors: ['#ec9b55','#6457c8'] },
] as const;

function study(id: string, label: string, code: string): ShaderSceneDef {
  return { kind: 'shader', id, label, palettes: PALETTES, fragment: COMMON + code, pixelBudget: 4200000, pixelRatioCap: 2, adaptiveQuality: false };
}

/** Nine original, small shader studies; no third-party shader sources or texture downloads. */
export const STUDY_SCENES = [
  study('lab-silk', 'Текучий шёлк', `vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
    vec2 q=P;for(int i=0;i<5;i++){float f=float(i)+1.;q+=.18*sin(q.yx*f+vec2(t*.22,-t*.15)+f);}
    float fold=sin(q.x*7.+q.y*2.),thread=.5+.5*sin(q.x*230.+q.y*35.);
    vec3 c=mix(uPal[1],uPal[2],.5+.5*sin(q.x*2.+t*.1));
    return finishLight(c*(.12+pow(.5+.5*fold,4.))*mix(.8,1.,thread)+pow(.5+.5*fold,32.)*.5);}`),
  study('lab-ferrofluid', 'Магнитная жидкость', `vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
    vec2 q=P*3.;q.y+=sin(q.x*.6+t*.4)*.5;vec2 cell=floor(q),f=fract(q)-.5;
    float h=exp(-dot(f,f)*15.)*(.6+.4*sin(length(cell-M*3.)*.9-t*1.2));
    vec3 n=normalize(vec3(f*18.*h,1.));vec3 c=studio(reflect(vec3(0,0,-1),n))*(.08+h*.7);
    c+=uPal[1]*pow(1.-n.z,4.)*.35;return finishLight(c);}`),
  study('lab-opal', 'Живой опал', `vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
    vec2 p=P*4.+M*.1;float n=fbm(p+t*.08);float cells=1.;vec2 id=floor(p);
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y);vec2 a=o+hash22(id+o);cells=min(cells,length(a-fract(p)));}
    vec3 c=.5+.5*cos(TAU*(vec3(.1,.45,.7)+cells*.7+n*.45+t*.025));
    return finishLight(c*(.25+pow(1.-cells,3.))*1.2+pow(1.-cells,24.)*.8);}`),
  study('lab-circuit', 'Город микросхем', `vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
    vec2 p=rot(.4)*P*10.;vec2 id=floor(p),q=fract(p)-.5;
    float turn=step(.5,hash21(id));q=rot(turn*PI*.5)*q;
    float line=min(abs(q.x),abs(q.y-.28)*1.8);float trace=exp(-line*110.);
    float pulse=pow(.5+.5*sin(id.x*.7+id.y*.9-t*2.),14.);
    float pad=exp(-length(q-vec2(0,.28))*60.);vec3 c=vec3(.008,.018,.025)+uPal[1]*trace*(.15+pulse*2.);
    c+=uPal[2]*pad*2.+uPal[3]*exp(-length(q)*120.)*pulse;return finishLight(c);}`),
  study('lab-vortex', 'Тоннель из световых колец', `vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
    vec2 q=P-M*.15;float r=max(length(q),.025),a=atan(q.y,q.x),z=1.4/r+t*.8;
    float rings=pow(.5+.5*cos(z*TAU),30.),spokes=pow(.5+.5*sin(a*16.+z*.6+t*.2),35.);
    vec3 c=mix(uPal[1],uPal[2],.5+.5*sin(z*.4+a));
    return finishLight(c*(rings+spokes*.5)*smoothstep(.02,.3,r)/(1.+r*.9)+vec3(.005,.008,.018));}`),
  study('lab-caustics', 'Свет под водой', `vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
    vec2 p=P*2.;float light=0.;for(int i=0;i<4;i++){float f=float(i)+1.;vec2 q=p*f;q+=sin(q.yx*1.4+t*.35+f);float v=sin(q.x*3.+t*.5)*cos(q.y*3.-t*.4);light+=pow(1.-abs(v),18.)/f;}
    vec3 c=mix(uPal[0],uPal[1]*.2,uv.y)+vec3(.4,.8,1.)*light*.35;
    c+=exp(-length(P-M)*3.)*uPointer.w*.2;return finishLight(c);}`),
  study('lab-contours', 'Рельеф из жидкого золота', `vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
    vec2 p=P*1.5+M*.06;float h=fbm(p+fbm(p+t*.08));float edge=pow(.5+.5*cos(h*100.-t),28.);
    vec3 c=mix(uPal[0],uPal[2],h)*(.3+edge);c+=uPal[3]*edge*.18;
    return finishLight(c);}`),
  study('lab-weave', 'Фотонная ткань', `vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
    vec2 p=rot(.3+sin(t*.1)*.1)*P*9.;p+=sin(p.yx*.4+t*.3)*.6;
    vec2 f=abs(fract(p)-.5);float a=pow(1.-f.x*2.,10.),b=pow(1.-f.y*2.,10.);
    float over=mod(floor(p.x)+floor(p.y),2.);vec3 c=mix(uPal[1]*a*(1.-b*.7)+uPal[2]*b,uPal[2]*b*(1.-a*.7)+uPal[1]*a,over);
    return finishLight(c+uPal[3]*(pow(a,6.)+pow(b,6.))*.3);}`),
  study('lab-plasma', 'Плазменная орхидея', `vec3 scene(vec2 uv,vec2 P,vec2 M,float t){
    vec2 p=P-M*.1;float r=length(p),a=atan(p.y,p.x);float field=0.;
    for(int i=0;i<6;i++){float f=float(i);float petal=.5+f*.1+.22*sin(a*(5.+mod(f,3.))+t*.35+f);
      field+=.009/(.008+abs(r-petal))*(.5+.5*sin(a*2.+f+t*.15));}
    vec3 c=mix(uPal[1],uPal[2],.5+.5*sin(a*3.+r*4.-t*.2))*field;
    return finishLight(c+uPal[3]*pow(field*.3,3.));}`),
];
