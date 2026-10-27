// Tampilan 3D, aktor: menara, monster, proyektil, efek, reaksi kastel dan pertempuran mini di menu.
// Milik sesi desain. Membaca state logika lewat BB.game (read-only) dan bereaksi pada event
// "shot", "death" dan "help". Event suara dikirim sebagai "v:*" untuk audio.js.
(function(){
"use strict";
const BB=window.BB,V=BB.V,THREE=window.THREE;
if(!THREE)return;
const A=V.A={},gm=()=>BB.game,H=V.hash;
let t=0,fdt=1/60,towers=new Map(),enemies=new Map(),corpses=[],sold=[],projs=[],bits=[],fxs=[],later=[];
const wx=tx=>tx-V.HX,wz=ty=>ty-V.HZ;
const _R=new THREE.Matrix4(),_T=new THREE.Matrix4(),_B=new THREE.Matrix4(),_v=new THREE.Vector3(),_s=new THREE.Vector3(),_q=new THREE.Quaternion();
const _P=new THREE.Matrix4(),_Q=new THREE.Matrix4(),_L2=new THREE.Matrix4(),_w=new THREE.Vector3();
const say=(n,d)=>{if(!A.demo)BB.emit(n,d)};

// ---------- models: the logic may name one per enemy type with EN[t].model ----------
const DEFAULT_MODEL=["lendir","kilat","kura","raja"];
const BOSS_MODELS=new Set(["raja","rajalendir","kalajengking","yeti","naga"]);
// models made before the logic has an enemy type for them. Only the gallery (#galeri) and its menu
// battle use them, with these stats; once EN has a type with the same model, the extra is dropped.
A.EXTRA=[
  {n:"Goblin",model:"goblin",hp:48,spd:1.35,r:.26,col:"#6f9a4a",ds:"Goblin berpentungan, datang bergerombol"},
  {n:"Serigala",model:"serigala",hp:30,spd:2.5,r:.27,col:"#7d8794",ds:"Berlari sangat cepat dalam kawanan"},
  {n:"Tengkorak",model:"tengkorak",hp:55,spd:1.25,r:.26,col:"#e8e2cf",res:{3:.5},ds:"Prajurit tulang. Peluru Jitu menembus rongganya, hanya 50% kena"},
  {n:"Kelelawar",model:"kelelawar",hp:26,spd:2.8,r:.23,col:"#4a3a5e",res:{1:.4},ds:"Terbang zig-zag. Ledakan Meriam hanya 40% kena"},
  {n:"Mumi",model:"mumi",hp:220,spd:.75,r:.34,col:"#d9cfb0",ds:"Lambat dan sangat tahan pukulan"},
  {n:"Iblis",model:"iblis",hp:60,spd:1.5,r:.25,col:"#c8382c",res:{2:.5},ds:"Setan kecil bergarpu. Serangan Es hanya 50% kena"},
  {n:"Anjing Api",model:"anjingapi",hp:36,spd:2.7,r:.29,col:"#2e2628",ds:"Anjing neraka yang meninggalkan jejak bara"},
  {n:"Golem Lava",model:"golemlava",hp:260,spd:.7,r:.37,col:"#3a302c",res:{0:.3},ds:"Batu dan magma. Panah hanya 30% kena"}
];
const enModel=i=>{const e=gm().EN[i]||{};return e.model||DEFAULT_MODEL[i]||"x"};
let xl=null,xn=-1;
const extras=()=>{const EN=gm().EN;if(xn!==EN.length){xn=EN.length;const have=new Set(EN.map((e,i)=>enModel(i)));xl=A.EXTRA.filter(x=>!have.has(x.model))}return xl};
// enemy types the view knows: the logic's EN, then (in the gallery) the extras
A.types=()=>gm().EN.length+(V.gallery?extras().length:0);
A.isExtra=ti=>ti>=gm().EN.length;
A.enOf=ti=>{const EN=gm().EN;return ti<EN.length?EN[ti]:extras()[ti-EN.length]};
A.modelOf=ti=>{const EN=gm().EN;if(ti<EN.length)return enModel(ti);const x=extras()[ti-EN.length];return x?x.model:"x"};
A.isBoss=ti=>{const e=A.enOf(ti)||{};return e.boss!=null?!!e.boss:BOSS_MODELS.has(A.modelOf(ti))};
const spdOf=e=>e.t<gm().EN.length?gm().spd(e):(A.enOf(e.t)||{spd:1}).spd*(e.sl>0?e.sf:1);
const sizeOf=ti=>{const e=A.enOf(ti)||{r:.3};return e.r*2.45*(A.isBoss(ti)?1.4:1)};
const HEIGHT={kilat:.75,raja:1.25,hantu:1.05,perisai:1.18,rajalendir:.82,kalajengking:.5,yeti:1.2,naga:.75,
  goblin:1.1,serigala:.78,anjingapi:.82,tengkorak:1.12,kelelawar:1,mumi:1.18,iblis:1.08,golemlava:1.32};
const heightOf=ti=>(HEIGHT[A.modelOf(ti)]||.62)*sizeOf(ti);
A.heightOf=heightOf;

// ---------- short-lived effects: glows, rings, beams, decals ----------
function fx(kit,x,y,z,life,s0,s1,col,a,rot){fxs.push({kit,x,y,z,life,max:life,s0,s1,c:col,a,rot:rot||0})}
const FLAT={ring:1,ringN:1,decal:1,decalA:1};
function fxTick(dt){
  const q=V.cam.quaternion;
  for(let i=fxs.length-1;i>=0;i--){const f=fxs[i];f.life-=dt;if(f.life<=0){fxs.splice(i,1);continue}
    const k=1-f.life/f.max,s=f.s0+(f.s1-f.s0)*V.ease.out(k),a=f.a*(f.kit==="decal"||f.kit==="decalA"?Math.min(1,f.life/f.max*2.5):(1-k)*(1-k*.3));
    if(FLAT[f.kit])V.M(f.x,f.y,f.z,0,f.rot,0,s,1,s,_B);else{_v.set(f.x,f.y,f.z);_s.set(s,s,s);_B.compose(_v,q,_s)}
    V.FX[f.kit].push(_B,f.c[0],f.c[1],f.c[2],a)}
}
// pooled point lights for explosions (a fixed count so shaders never recompile)
let lights=[];
A.makeLights=()=>{for(let i=0;i<2;i++){const l=new THREE.PointLight(0xffaa55,0,5,2);V.scene.add(l);lights.push({l,life:0,max:1,i0:0})}};
function flash(x,y,z,col,i0,life){const s=lights.reduce((a,b)=>a.life<b.life?a:b);s.l.position.set(x,y,z);s.l.color.setRGB(col[0],col[1],col[2]);s.i0=i0;s.life=s.max=life}
function lightTick(dt){for(const s of lights){s.life=Math.max(0,s.life-dt);s.l.intensity=s.life>0?s.i0*Math.pow(s.life/s.max,1.5):0}}

// ---------- debris and coins with a little physics ----------
function bit(kit,x,y,z,vx,vy,vz,life,s,col,spin){bits.push({kit,x,y,z,vx,vy,vz,life,max:life,s,c:col,spin:spin||8,rx:Math.random()*6,ry:Math.random()*6})}
function burst(n,kit,x,y,z,spd,up,life,s,col){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=spd*V.rnd(.4,1);bit(kit,x,y,z,Math.cos(a)*v,up*V.rnd(.6,1.2),Math.sin(a)*v,life*V.rnd(.7,1.1),s*V.rnd(.7,1.3),col)}}
function bitsTick(dt){
  for(let i=bits.length-1;i>=0;i--){const b=bits[i];b.life-=dt;if(b.life<=0){bits.splice(i,1);continue}
    b.vy-=9*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.rx+=b.spin*dt;b.ry+=b.spin*.7*dt;
    if(b.y<.02){b.y=.02;b.vy*=-.35;b.vx*=.6;b.vz*=.6;b.spin*=.6}
    const s=b.s*Math.min(1,b.life/b.max*3);
    V.M(b.x,b.y,b.z,b.kit==="coin"?0:b.rx,b.ry,0,s,s,s,_B);V.K[b.kit].push(_B,b.c[0],b.c[1],b.c[2])}
}
const LC=h=>{const c=V.col(h);return[c.r,c.g,c.b]}; // linear, for lit kits
const SC=V.srgb;                                    // sRGB, for shader effects and particles

// ---------- particles helpers ----------
function puff(P,n,x,y,z,spd,up,life,s0,s1,col,a,g,drag){for(let i=0;i<n;i++){const ang=Math.random()*Math.PI*2,v=spd*V.rnd(.3,1);P.add(x,y,z,Math.cos(ang)*v,up*V.rnd(.5,1.2),Math.sin(ang)*v,life*V.rnd(.7,1.1),s0*V.rnd(.7,1.2),s1,col[0],col[1],col[2],a,g||0,drag==null?2:drag)}}

// ---------- reactions to the logic's events ----------
function towerRecAt(tx,ty){return towers.get(tx+","+ty)}
function enemyNear(tx,ty,maxD){let best=null,bd=maxD*maxD;for(const ev of enemies.values()){const d=(ev.tx-tx)*(ev.tx-tx)+(ev.ty-ty)*(ev.ty-ty);if(d<bd){bd=d;best=ev}}return best}
// where a guardian's weapon is, in world space
function muzzle(rec,k){
  const L=rec.l,cs=crewScale(L),top=rec.h+V.TOWER_TOP[L-1],c=Math.cos(rec.yaw),s=Math.sin(rec.yaw);
  const lx=[.17,.3,.2,.44+.04*L][k]||.2,ly=[.22,.25,.54,.235][k]||.3;
  return[wx(rec.x+.5)+c*lx*cs,top+ly*cs,wz(rec.y+.5)-s*lx*cs];
}
A.onShot=d=>{
  const tx=Math.floor(d.x1),ty=Math.floor(d.y1),rec=towerRecAt(tx,ty),k=d.t|0;
  if(rec){rec.yaw=Math.atan2(-(d.y2-d.y1),d.x2-d.x1);rec.rc=1;rec.fireT=t}
  const from=rec?muzzle(rec,k):[wx(d.x1),.6,wz(d.y1)],tg=enemyNear(d.x2,d.y2,.7),ty2=tg?tg.y+heightOf(tg.t)*.55:.3,to=[wx(d.x2),ty2,wz(d.y2)];
  const dist=Math.hypot(to[0]-from[0],to[2]-from[2]);
  if(k===0)projs.push({k,f:from,to,age:0,dur:Math.max(.07,dist/15),h:dist*.07,tx:d.x2,ty:d.y2});
  else if(k===1){projs.push({k,f:from,to,age:0,dur:.3+dist*.04,h:.45+dist*.16,tx:d.x2,ty:d.y2});
    fx("glow",from[0],from[1],from[2],.12,.3,.9,[1,.82,.5],.9);puff(V.PN,6,from[0],from[1],from[2],.6,.4,.7,.12,.45,[.62,.63,.68],.5,-.2,2.5);flash(from[0],from[1],from[2],[1,.7,.4],2.2,.15)}
  else if(k===2){projs.push({k,f:from,to,age:0,dur:.16+dist*.035,h:dist*.1,tx:d.x2,ty:d.y2});fx("glow",from[0],from[1],from[2],.2,.25,.6,[.6,.9,1],.8)}
  else if(k===3){projs.push({k,f:from,to,age:0,dur:.035,h:0,tx:d.x2,ty:d.y2});fx("glow",from[0],from[1],from[2],.1,.2,.55,[.95,.8,1],1)}
  else projs.push({k,f:from,to,age:0,dur:.2,h:.2,tx:d.x2,ty:d.y2});
  say("v:fire",{k,x:from[0]});
};
// time until the projectile flying at (tx,ty) lands, so deaths wait for the hit that causes them
function landsIn(tx,ty){let best=0;for(const p of projs){if(p.done)continue;if(Math.abs(p.tx-tx)<.45&&Math.abs(p.ty-ty)<.45)best=Math.max(best,p.dur-p.age)}return best}
A.onDeath=d=>{
  const delay=landsIn(d.x,d.y),x=wx(d.x),z=wz(d.y);
  later.push({at:t+delay,fn:()=>dieFx(d.t|0,x,z,d.gold)});
};
A.onHelp=d=>{
  const k=d.k|0,S=d.S||gm().S;if(!S)return;
  const g=V.geo,ex=[];for(const e of S.E.slice(0,24)){const ev=enemies.get(e.id);ex.push(ev?[ev.tx,ev.ty]:gm().posIn(g,e.d))}
  if(k===0){const tg=ex.length?ex:Array.from({length:7},()=>gm().posIn(g,Math.random()*g.PLEN));
    tg.forEach(([tx,ty],i)=>later.push({at:t+i*.07,fn:()=>{const x=wx(tx),z=wz(ty);projs.push({k:9,f:[x+3.2,7.5,z-2.4],to:[x,.05,z],age:0,dur:.55,h:0,tx,ty,spin:V.rnd(4,9)})}}));
    V.ov&&V.ov.tint("rgba(255,120,60,.18)",.9)}
  else if(k===1){V.ov&&V.ov.tint("rgba(150,215,255,.32)",1.8);
    for(const[tx,ty]of ex){const x=wx(tx),z=wz(ty);fx("ring",x,.06,z,.7,.2,1.2,[.75,.92,1],.9);burst(4,"chunk",x,.3,z,1.2,2,.8,.9,LC("#d8f4ff"))}
    for(let i=0;i<140;i++)V.PN.add(V.rnd(-V.HX,V.HX),V.rnd(2,5),V.rnd(-V.HZ,V.HZ),V.rnd(-.3,.3),-1.4,V.rnd(-.3,.3),3,.1,.1,1,1,1,.9,0,0)}
  else if(k===2){for(let i=0;i<36;i++)later.push({at:t+i*.03,fn:()=>bit("coin",V.rnd(-3,3),V.rnd(4,6),V.rnd(-2,2),V.rnd(-.5,.5),0,V.rnd(-.5,.5),2.4,1.3,[1,1,1],4)});
    V.ov&&V.ov.label(0,1.5,0,"+150 emas","gold big")}
  else if(k===3){const c=V.castle;if(c){fx("glow",c.gate[0],c.gate[1]+.5,c.gate[2],.8,1,3,[.5,1,.55],.8);
    for(let i=0;i<60;i++)V.PA.add(c.x+V.rnd(-.4,.4),V.rnd(.1,1.4),V.rnd(V.Z0+.5,V.Z1-.5),0,V.rnd(.4,1),0,1.4,.12,.05,.5,1,.55,1,0,.5,1);
    V.ov&&V.ov.label(c.gate[0]-1,1.8,c.gate[2],"+5 nyawa","heal big")}}
  else if(k===4){V.ov&&V.ov.tint("rgba(229,122,168,.22)",1.2);for(const r of towers.values())fx("ring",wx(r.x+.5),.08,wz(r.y+.5),.6,.3,1.3,[1,.45,.65],.9);
    V.ov&&V.ov.label(0,1.6,0,"Damage +50%","rage big")}
  say("v:help",{k});
};
// boss abilities. One-off actions come as the event "ability" {t,k,x,y,id?,tx?,ty?,r?}; lasting states
// (burrowed, enraged) come as the enemy field e.ab. A tower the logic disables carries tw.fz (seconds left)
// and looks frozen or scorched depending on which ability reached it.
A.onAbility=d=>{
  const k=d.k,x=wx(d.x),z=wz(d.y),r=d.r||1.6,ev=(d.id!=null&&enemies.get(d.id))||evFor(d.t|0,x,z,2);
  if(ev){ev.abK=k;ev.abT=t;ev.abX=d.tx!=null?wx(d.tx):null;ev.abZ=d.ty!=null?wz(d.ty):null}
  const at=()=>ev?[ev.x,ev.y,ev.z,ev.tx,ev.ty]:[x,0,z,d.x,d.y];
  if(k==="summon")later.push({at:t+.4,fn:()=>{const[X,Y,Z]=at(),h=heightOf(d.t|0);
    fx("ring",X,.08,Z,.5,.3,2,[.55,1,.45],.8);puff(V.PN,14,X,Y+h*.7,Z,1.6,2.2,.7,.1,.05,[.6,.9,.45],.9,6,1.2);
    for(let i=0;i<5;i++){const a=Math.random()*6.28,v=V.rnd(1.2,2.2);bit("m0",X,Y+h*.8,Z,Math.cos(a)*v,V.rnd(3,4.2),Math.sin(a)*v,.8,.3,[1,1,1],4)}
    say("v:ability",{k,x:X})}});
  else if(k==="stomp")later.push({at:t+.52,fn:()=>{const[X,,Z,TX,TY]=at();
    fx("ring",X,.08,Z,.6,.4,r*2.4,[.75,.92,1],1);fx("ringN",X,.07,Z,.5,.3,r*1.7,[.92,.97,1],.7);fx("decal",X,.076,Z,3.5,r*1.5,r*1.5,[.85,.95,1],.45);
    puff(V.PN,26,X,.2,Z,2.6,.9,.9,.16,.5,[.93,.97,1],.8,.3,2);burst(8,"chunk",X,.2,Z,2.4,3,1,1,LC("#d8f2ff"));V.shake(.6);
    for(const rec of towers.values())if(Math.hypot(rec.x+.5-TX,rec.y+.5-TY)<=r+.5){rec.fk="ice";const cx=wx(rec.x+.5),cz=wz(rec.y+.5);
      fx("ring",cx,rec.h+.08,cz,.5,.2,1.2,[.8,.95,1],.9);puff(V.PN,8,cx,rec.h+.5,cz,1,.8,.7,.1,.05,[.9,.97,1],.9,1,1.5)}
    say("v:ability",{k,x:X})}});
  else if(k==="breath"){let TX=d.tx,TY=d.ty;
    if(TX==null){const p=ev&&V.geo?gm().posIn(V.geo,ev.vd+2.2):[d.x+1,d.y];TX=p[0];TY=p[1];if(ev){ev.abX=wx(TX);ev.abZ=wz(TY)}}
    later.push({at:t+.62,fn:()=>{const X=wx(TX),Z=wz(TY),h=V.groundAt(TX,TY);
      fx("decal",X,.076,Z,4.5,r*1.7,r*1.7,[.1,.07,.06],.6);fx("glow",X,h+.4,Z,.5,.6,2.4,[1,.6,.25],.8);flash(X,h+.8,Z,[1,.55,.25],2.8,.7);
      for(const rec of towers.values())if(Math.hypot(rec.x+.5-TX,rec.y+.5-TY)<=r+.5)rec.fk="burn"}});
    say("v:ability",{k,x})}
  else{fx("ring",x,.08,z,.5,.3,2,[1,.85,.5],.8);say("v:ability",{k,x})}  // an ability without its own effect yet
};
// the logic changed an enemy's lasting state (e.ab): into the sand, back up, or enraged
function abState(ev,from,to){
  if(to==="burrow"){puff(V.PN,18,ev.x,ev.y+.1,ev.z,1.6,1.2,.9,.16,.55,[.82,.68,.46],.7,.5,2);burst(7,"chunk",ev.x,ev.y+.1,ev.z,1.8,2.6,.9,1,LC("#c99d5c"));
    fx("ringN",ev.x,.08,ev.z,.5,.3,1.8,[.85,.7,.5],.7);say("v:ability",{k:"burrow",x:ev.x})}
  else if(from==="burrow"){puff(V.PN,22,ev.x,ev.y+.1,ev.z,2.2,1.8,1,.18,.6,[.82,.68,.46],.75,.6,2);burst(10,"chunk",ev.x,ev.y+.1,ev.z,2.2,3.4,1,1.1,LC("#c99d5c"));
    fx("ring",ev.x,.08,ev.z,.5,.3,2.4,[1,.8,.5],.8);V.shake(.3);say("v:ability",{k:"emerge",x:ev.x})}
  if(to==="enrage"){fx("ring",ev.x,.08,ev.z,.7,.4,3,[1,.45,.2],1);fx("glow",ev.x,ev.y+.6,ev.z,.5,.6,2.6,[1,.5,.2],.9);flash(ev.x,ev.y+1,ev.z,[1,.45,.2],2.4,.6);
    V.shake(.35);say("v:ability",{k:"enrage",x:ev.x})}
}

// ---------- impacts and deaths ----------
function impact(k,x,y,z,tx,ty){
  const hitR=k===1?1.05:k===2?.8:.4;
  for(const ev of enemies.values())if(Math.abs(ev.tx-tx)<hitR&&Math.abs(ev.ty-ty)<hitR)ev.fl=1;
  // a shot the target mostly shrugs off (EN[t].res from the logic) glances off with sparks
  if(k===0||k===3){const e=enemyNear(tx,ty,.5),rs=e&&(A.enOf(e.t)||{}).res;if(rs&&rs[k]!=null&&rs[k]<.6){puff(V.PA,9,x,y,z,2.6,1.4,.22,.06,.02,[1,.95,.7],1,3);fx("glow",x,y,z,.1,.15,.5,[1,.95,.75],1);say("v:block",{x});return}}
  if(k===0){puff(V.PA,6,x,y,z,2.2,.6,.25,.07,.02,[1,.95,.75],1);puff(V.PN,3,x,.08,z,.4,.3,.5,.1,.3,[.72,.64,.52],.4,-.1)}
  else if(k===1||k===9){const big=k===9?1.7:1;
    fx("glow",x,y+.15,z,.22,.6*big,2.3*big,[1,.78,.45],1);fx("ring",x,.07,z,.45,.3,2.1*big,[1,.75,.4],.8);fx("decal",x,.075,z,3,1.1*big,1.1*big,[.12,.09,.07],.55);
    puff(V.PA,18*big|0,x,y,z,3.2*big,2.2,.45,.18,.05,[1,.62,.25],1,4);puff(V.PN,10*big|0,x,y+.1,z,.9,.9,1.1,.25,.9,[.45,.44,.46],.55,-.25,1.6);
    burst(6*big|0,"chunk",x,.1,z,2,3.2,1,.9,LC(k===9?"#3a2a22":"#6b5a44"));flash(x,y+.4,z,[1,.65,.35],3.2*big,.3);V.shake(.16*big);
    say("v:hit",{k,x})}
  else if(k===2){fx("glow",x,y,z,.25,.3,1.3,[.7,.92,1],.9);fx("ring",x,.07,z,.5,.2,1.5,[.75,.93,1],.9);fx("decal",x,.075,z,1.6,.9,.9,[.85,.95,1],.35);
    puff(V.PN,12,x,y,z,1.8,.9,.6,.08,.03,[.92,.98,1],.9,1.2);burst(5,"chunk",x,y,z,1.3,2.2,.7,.75,LC("#cdefff"));say("v:hit",{k,x})}
  else{fx("glow",x,y,z,.16,.2,.8,[.95,.8,1],1);puff(V.PA,8,x,y,z,3,.8,.25,.08,.02,[.9,.72,1],1);fx("ring",x,y,z,.25,.1,.6,[.9,.7,1],.7);say("v:hit",{k,x})}
}
// the enemy (alive, or a corpse) of type ti nearest to world x,z
function evFor(ti,x,z,maxD){let best=null,bd=maxD*maxD;const test=ev=>{if(ev.t!==ti)return;const d=(ev.x-x)*(ev.x-x)+(ev.z-z)*(ev.z-z);if(d<bd){bd=d;best=ev}};
  for(const ev of enemies.values())test(ev);for(const c of corpses)test(c.ev);return best}
function coinRain(x,y,z,n){for(let i=0;i<n;i++)bit("coin",x,y,z,V.rnd(-2,2),V.rnd(3,5),V.rnd(-2,2),2.2,1.4,[1,1,1],6)}
function dieFx(ti,x,z,gold){
  const m=A.modelOf(ti),boss=A.isBoss(ti),s=sizeOf(ti),y=heightOf(ti)*.5;
  if(m==="lendir"){puff(V.PN,16,x,y,z,1.8,2.2,.7,.09,.04,[.55,.82,.4],.95,7,1.2);burst(6,"chunk",x,y,z,1.6,2.8,.8,1,LC("#8fd16a"));fx("decal",x,.076,z,2.6,.2,.75,[.36,.6,.25],.7)}
  else if(m==="kilat"){puff(V.PA,14,x,y,z,2.5,1,.35,.08,.02,[1,.9,.4],1);burst(4,"chunk",x,y,z,1.4,1.5,.9,.8,LC("#e8f6ff"));puff(V.PN,5,x,y,z,.5,.5,.6,.15,.4,[.9,.9,.85],.45)}
  else if(m==="kura"){burst(9,"chunk",x,y,z,1.8,2.6,1.1,1.25,LC("#8b6a42"));puff(V.PN,8,x,.1,z,.8,.6,.9,.2,.6,[.7,.62,.5],.45,-.1)}
  else if(m==="raja"){for(let i=0;i<5;i++)later.push({at:t+i*.12,fn:()=>{const a=Math.random()*6.28,r=V.rnd(0,.5);impact(9,x+Math.cos(a)*r,y,z+Math.sin(a)*r,0,0)}});
    burst(14,"chunk",x,y,z,2.4,3.8,1.4,1.6,LC("#e9b949"));fx("ring",x,.08,z,1.1,.5,4,[1,.85,.4],1);coinRain(x,y,z,10);V.shake(.9)}
  else if(m==="hantu"){puff(V.PA,22,x,y,z,1,1.5,1.1,.16,.02,[.8,.74,1],.9,-1.3,1.4);fx("glow",x,y,z,.35,.4,1.6,[.75,.7,1],.8);fx("ring",x,.08,z,.5,.2,1.1,[.75,.7,1],.6)}
  else if(m==="perisai"){burst(5,"chunk",x,y,z,1.5,2.6,.9,1,LC("#9aa6bd"));puff(V.PN,6,x,.1,z,.7,.5,.8,.15,.45,[.7,.68,.62],.45,-.1);
    bit("m_per_s",x,y+.15,z,V.rnd(-1.2,1.2),3.4,V.rnd(-1.2,1.2),1.4,s,[1,1,1],7);bit("m_per_w",x,y+.25,z,V.rnd(-1.5,1.5),4,V.rnd(-1.5,1.5),1.3,s,[1,1,1],12)}
  else if(m==="rajalendir"){
    for(let i=0;i<3;i++)later.push({at:t+i*.16,fn:()=>{const a=Math.random()*6.28,r=V.rnd(.1,.5);puff(V.PN,14,x+Math.cos(a)*r,y,z+Math.sin(a)*r,2+i*.6,2.4,.8,.12,.05,[.55,.85,.4],.95,7,1.2);fx("glow",x,y,z,.2,.5,1.6+i*.5,[.7,1,.55],.7)}});
    later.push({at:t+.45,fn:()=>{burst(16,"chunk",x,y,z,2.6,3.6,1.3,1.4,LC("#8fd16a"));fx("decal",x,.076,z,4,.4,2.2,[.36,.6,.25],.75);fx("ring",x,.08,z,.8,.4,3.4,[.6,1,.45],.9);
      bit("m_rl_c",x,y+.6,z,V.rnd(-.8,.8),5,V.rnd(-.8,.8),2.4,s,[1,1,1],6);coinRain(x,y,z,10);V.shake(.8)}})}
  else if(m==="kalajengking"){burst(14,"chunk",x,y,z,2.2,3.4,1.3,1.4,LC("#c97b35"));puff(V.PN,18,x,.15,z,1.8,1,1.1,.22,.8,[.82,.68,.46],.6,-.1,1.6);
    bit("m_kj_s",x,y+.4,z,V.rnd(-1.5,1.5),4.5,V.rnd(-1.5,1.5),2,s,[1,1,1],9);for(const sd of[1,-1])bit("m_kj_p",x,y+.2,z,V.rnd(-1.4,1.4),3.6,1.6*sd,1.8,s,[1,1,1],6);
    fx("ring",x,.08,z,.9,.5,3.6,[1,.75,.4],.9);coinRain(x,y,z,10);V.shake(.8)}
  else if(m==="yeti"){puff(V.PN,34,x,y+.3,z,2.6,2,1.2,.16,.5,[.93,.97,1],.9,1.2,1.4);burst(12,"chunk",x,y,z,2.4,3.4,1.3,1.4,LC("#e2e9f1"));
    fx("ring",x,.08,z,.9,.5,3.8,[.75,.92,1],1);fx("decal",x,.076,z,4,.5,2.6,[.85,.95,1],.5);fx("glow",x,y,z,.4,.6,2.4,[.8,.93,1],.8);coinRain(x,y,z,10);V.shake(.85)}
  else if(m==="naga"){const ev=evFor(ti,x,z,2),sg=ev&&ev.sg?ev.sg.map(p=>p.slice()):[[x,y,z]];
    sg.forEach((p,i)=>later.push({at:t+i*.1,fn:()=>{impact(9,p[0],p[1],p[2],-99,-99);puff(V.PA,10,p[0],p[1],p[2],1.4,1.8,.9,.12,.03,[1,.55,.2],1,-.6,1.2)}}));
    later.push({at:t+sg.length*.1,fn:()=>{fx("ring",x,.08,z,1,.5,4.4,[1,.6,.3],1);coinRain(x,y,z,12);V.shake(.9)}})}
  else if(m==="goblin"){puff(V.PN,10,x,y,z,1.2,1.4,.8,.14,.45,[.62,.7,.45],.6,-.05,2);burst(6,"chunk",x,y,z,1.6,2.6,.9,.9,LC("#6f9a4a"));bit("m_gob_w",x,y+.2,z,V.rnd(-1.4,1.4),3.6,V.rnd(-1.4,1.4),1.3,s,[1,1,1],10)}
  else if(m==="serigala"){puff(V.PN,14,x,y,z,1.6,1.2,.9,.16,.5,[.62,.65,.7],.6,-.05,1.8);burst(7,"chunk",x,y,z,1.8,2.6,.9,.9,LC("#7d8794"))}
  else if(m==="anjingapi"){puff(V.PN,10,x,y,z,1.4,1.2,1,.18,.6,[.3,.26,.26],.6,-.15,1.6);burst(7,"chunk",x,y,z,1.8,2.6,.9,.9,LC("#2e2628"));
    puff(V.PA,22,x,y,z,2.4,2,.6,.16,.03,[1,.55,.2],1,-.8,1.4);fx("glow",x,y,z,.3,.4,1.8,[1,.55,.25],.9);flash(x,y+.4,z,[1,.5,.2],2,.3)}
  else if(m==="tengkorak"){burst(12,"chunk",x,y,z,2,3,1.1,.9,LC("#e8e2cf"));bit("m_tk_s",x,y+.4,z,V.rnd(-1,1),4.2,V.rnd(-1,1),1.6,s,[1,1,1],8);puff(V.PN,8,x,.1,z,.8,.5,.8,.15,.45,[.7,.68,.62],.45,-.1)}
  else if(m==="kelelawar"){puff(V.PN,12,x,y,z,1.4,1,.7,.12,.4,[.35,.28,.45],.7,.4,1.6);burst(5,"chunk",x,y,z,1.4,1.6,.8,.7,LC("#4a3a5e"));puff(V.PA,6,x,y,z,1.8,.6,.3,.06,.02,[1,.3,.3],1)}
  else if(m==="mumi"){for(let i=0;i<6;i++)bit("m_mm_s",x,y+.3,z,V.rnd(-1.6,1.6),V.rnd(2.5,4),V.rnd(-1.6,1.6),1.5,s,[1,1,1],7);puff(V.PN,14,x,.2,z,1.4,.9,1.1,.2,.7,[.78,.72,.58],.55,-.1,1.6);fx("glow",x,y+.4,z,.3,.3,1.2,[.5,1,.4],.7)}
  else if(m==="iblis"){puff(V.PA,20,x,y,z,2,1.6,.5,.14,.03,[1,.5,.2],1,-.6,1.4);puff(V.PN,10,x,y+.2,z,.9,1,1.1,.2,.7,[.3,.28,.28],.5,-.2,1.2);bit("m_ib_f",x,y+.3,z,V.rnd(-1.4,1.4),3.8,V.rnd(-1.4,1.4),1.3,s,[1,1,1],9);fx("glow",x,y,z,.25,.3,1.4,[1,.5,.2],.9)}
  else if(m==="golemlava"){burst(10,"chunk",x,y,z,2.2,3,1.3,1.3,LC("#3a302c"));burst(8,"chunk",x,y,z,2,3.4,1.1,1,[4,1.6,.4]);puff(V.PA,24,x,y,z,2.4,2.2,.7,.16,.03,[1,.5,.15],1,1.2,1.2);
    fx("decal",x,.076,z,3,.3,1.3,[.15,.07,.04],.6);fx("glow",x,y,z,.35,.5,2.2,[1,.5,.2],.9);flash(x,y+.5,z,[1,.45,.15],2.6,.4);V.shake(.2)}
  else{const col=(A.enOf(ti)||{}).col||"#ffffff";puff(V.PA,14,x,y,z,2.2,1.4,.5,.1,.03,SC(col),1,2);burst(6,"chunk",x,y,z,1.6,2.4,.9,1,LC(col))}
  fx("glow",x,y,z,.18,.3*s,1.2*s,[1,1,1],.7);
  if(!boss)bit("coin",x,y+.1,z,V.rnd(-.6,.6),3.2,V.rnd(-.6,.6),.9,1,[1,1,1],10);
  if(gold&&V.ov)V.ov.label(x,y+.5,z,"+"+gold,boss?"gold big":"gold");
  say("v:die",{m,boss,x});
}

// ---------- towers ----------
const crewScale=L=>L===3?1.32:L===2?1.24:1.18;
function ownerCol(S,o){const p=S.P&&S.P[o],c=gm().PCOL[p?p.c:0]||gm().PCOL[0];return V.col(c)}
function drawTower(rec,S,dt){
  const K=V.K,L=Math.min(3,Math.max(1,rec.l)),cx=wx(rec.x+.5),cz=wz(rec.y+.5),age=t-rec.born,oc=ownerCol(S,rec.o);
  let drop=0;if(age<.55)drop=(1-V.ease.bounce(age/.55))*1.8;
  const ua=t-rec.up,pop=ua<.7?Math.sin(ua/.7*Math.PI)*.22*(1-ua/.7):0,sc=1+pop,y=rec.h+drop;
  const rage=S.rg>0,rr=rage?1+.25*(.5+.5*Math.sin(t*10+rec.seed)):1;
  const fz=rec.fzv||0,burn=rec.fk==="burn",still=1-fz,fr=burn?1-fz*.6:1-fz*.3,fg=burn?1-fz*.62:1-fz*.08,fb=burn?1-fz*.64:1+fz*.35;
  const ocr=oc.r*fr,ocg=oc.g*fg,ocb=oc.b*fb;
  V.M(cx,y,cz,0,-Math.PI/2,0,sc,sc*(1-pop*.5),sc,_R);
  K["tb"+L].push(_R,rr*fr,fg,fb);
  const sw=Math.sin(t*3+rec.seed)*still;
  if(L===1)V.put(K.tb1c,_R,-.36,.72,-.36,0,sw*.5-.3,0,1,1,1,ocr,ocg,ocb);
  else if(L===2)V.put(K.tb2c,_R,.43,.6,0,0,0,sw*.06,1,1,1,ocr,ocg,ocb);
  else{V.put(K.tb3c,_R,.445,.78,.2,0,0,sw*.06,1,1,1,ocr,ocg,ocb);V.put(K.tb3c,_R,.445,.78,-.2,0,0,-sw*.06,1,1,1,ocr,ocg,ocb);
    const gl=(1.3+.5*Math.sin(t*3+rec.seed))*(1-fz*.6);V.put(K.tb3g,_R,.47,.58,0,0,t*1.5,0,1,1,1,oc.r*gl,oc.g*gl,oc.b*gl)}
  const cs=crewScale(L)*sc,top=y+V.TOWER_TOP[L-1]*sc*(1-pop*.5),back=rec.rc*.09,c=Math.cos(rec.yaw),s=Math.sin(rec.yaw);
  V.M(cx-c*back,top,cz+s*back,0,rec.yaw,rec.rc*.08,cs,cs*(1+Math.sin(t*2.2+rec.seed)*.025*still),cs,_T);
  const kt=K["c"+rec.t+"_"+L]||K["c0_"+L];kt.push(_T,rr*fr,fg,fb);(K["c"+rec.t+"c"]||K.c0c).push(_T,ocr,ocg,ocb);
  if(rec.t===0&&t-rec.fireT>.28)V.put(K.nock,_T,0,.22,-.035);
  else if(rec.t===1){const f=1+Math.sin(t*23+rec.seed)*.25;V.put(K.flame,_T,-.09,.31,-.25,0,t*3,0,f,f*1.2,f)}
  else if(rec.t===2){const b=Math.sin(t*2.4+rec.seed)*.04,p=1+Math.max(0,.4-(t-rec.fireT))*1.2;V.put(K["crys"+L],_T,.2,.54+b,0,0,t*1.6,0,p,p,p);
    const n=2+L;for(let i=0;i<n;i++){const a=t*2.2+i*Math.PI*2/n;V.put(K.shard,_T,.2+Math.cos(a)*.17,.54+b+Math.sin(a*1.3)*.05,Math.sin(a)*.17,0,a,0)}}
  else if(rec.t===3){const g=1+Math.max(0,.5-(t-rec.fireT))*2;V.put(K.lens,_T,.148,.275,-.05,0,0,0,1,1,1,g,g,g)}
  if(L===3){const tc=SC(gm().TW[rec.t]?gm().TW[rec.t].col:"#ffffff"),a=.22+.12*Math.sin(t*3+rec.seed);V.M(cx,rec.h+.09,cz,0,t*.5,0,1.6,1,1.6,_B);V.FX.decalA.push(_B,tc[0],tc[1],tc[2],a)}
  if(rage){V.M(cx,rec.h+.1,cz,0,0,0,1.35+.12*Math.sin(t*8+rec.seed),1,1.35+.12*Math.sin(t*8+rec.seed),_B);V.FX.ring.push(_B,1,.4,.6,.75)}
  if(fz>.01){
    if(burn){if(Math.random()<dt*9*fz)V.PN.add(cx+V.rnd(-.25,.25),top+.2,cz+V.rnd(-.25,.25),V.rnd(-.1,.1),.7,V.rnd(-.1,.1),1.6,.15,.6,.22,.2,.2,.55*fz,-.15,.6);
      if(Math.random()<dt*12*fz)V.PA.add(cx+V.rnd(-.3,.3),V.rnd(y+.2,top+.3),cz+V.rnd(-.3,.3),V.rnd(-.1,.1),V.rnd(.4,.8),V.rnd(-.1,.1),.7,.07,.02,1,.55,.2,1,-.3,1,1);
      for(let i=0;i<2;i++){const f=(.8+.3*Math.sin(t*21+i*2+rec.seed))*fz;V.M(cx+(i?.18:-.16),top+.05,cz+(i?-.12:.14),0,t*3+i,0,2.6*f,3.4*f,2.6*f,_B);K.flame.push(_B,1.3,1,.9)}}
    else{V.M(cx,rec.h-.02,cz,0,rec.seed,0,1.02,(V.TOWER_TOP[L-1]+.62)*fz,1.02,_B);K.iceblock.push(_B,1,1,1);
      if(Math.random()<dt*3*fz)V.PA.add(cx+V.rnd(-.45,.45),rec.h+V.rnd(.2,V.TOWER_TOP[L-1]+.5),cz+V.rnd(-.45,.45),0,0,0,.4,.1,.02,.85,.95,1,1,0,0)}}
}
function trackAim(rec,S,dt){
  if(t-rec.fireT<.4||rec.fz>0)return;
  const st=gm().stat(rec.t,rec.l),r2=st.range*st.range,cx=rec.x+.5,cy=rec.y+.5;let best=null,bd=-1;
  for(const ev of enemies.values()){if(ev.ab==="burrow")continue;const dx=ev.tx-cx,dy=ev.ty-cy;if(dx*dx+dy*dy<=r2&&ev.vd>bd){bd=ev.vd;best=ev}}
  const goal=best?Math.atan2(-(best.ty-cy),best.tx-cx):rec.idle+Math.sin(t*.4+rec.seed)*.8;
  rec.yaw=V.dampAng(rec.yaw,goal,best?9:1.4,dt);
}
function syncTowers(S,dt){
  const seen=new Set();
  for(const tw of S.T){
    const key=tw.x+","+tw.y;seen.add(key);let rec=towers.get(key);
    if(!rec||rec.t!==tw.t){
      if(rec)sold.push(Object.assign({},rec,{at:t}));
      rec={x:tw.x,y:tw.y,t:tw.t,l:tw.l,o:tw.o,born:A.fresh?t-1:t,up:-9,yaw:-Math.PI/2,idle:-Math.PI/2,rc:0,fireT:-9,h:V.groundAt(tw.x+.5,tw.y+.5),seed:H(tw.x*7,tw.y*3)*6.28};
      towers.set(key,rec);
      if(!A.fresh){later.push({at:t+.42,fn:()=>{const x=wx(tw.x+.5),z=wz(tw.y+.5);fx("ringN",x,rec.h+.03,z,.6,.3,1.4,[.78,.68,.52],.75);
        puff(V.PN,9,x,rec.h+.05,z,1.1,.35,.7,.14,.45,[.75,.68,.55],.55,-.05,2.4);burst(5,"chunk",x,rec.h+.1,z,1.2,1.8,.6,.8,LC("#8a6038"))}});
        say("v:build",{x:wx(tw.x+.5)})}
    }
    if(tw.l>rec.l){rec.up=t;const x=wx(tw.x+.5),z=wz(tw.y+.5);fx("ring",x,rec.h+.06,z,.7,.3,1.6,[1,.85,.4],1);fx("glow",x,rec.h+.7,z,.4,.4,1.6,[1,.85,.45],.8);
      for(let i=0;i<26;i++){const a=i/26*Math.PI*4;V.PA.add(x+Math.cos(a)*.42,rec.h+.1+i*.035,z+Math.sin(a)*.42,-Math.sin(a)*.6,1.1,Math.cos(a)*.6,.9,.1,.03,1,.85,.4,1,0,1.2,1)}
      flash(x,rec.h+1,z,[1,.85,.5],1.8,.35);say("v:upgrade",{x,l:tw.l})}
    rec.l=tw.l;rec.o=tw.o;rec.fz=tw.fz||0;rec.fzv=A.fresh?(rec.fz>0?1:0):V.damp(rec.fzv||0,rec.fz>0?1:0,rec.fz>0?8:3,dt);
    trackAim(rec,S,dt);rec.rc=Math.max(0,rec.rc-dt*7);drawTower(rec,S,dt);
  }
  for(const[key,rec]of towers)if(!seen.has(key)){towers.delete(key);if(!A.fresh){sold.push(Object.assign({},rec,{at:t}));const x=wx(rec.x+.5),z=wz(rec.y+.5);
    puff(V.PN,12,x,rec.h+.1,z,1.2,.5,.8,.16,.55,[.72,.7,.68],.55,-.05,2.2);fx("ringN",x,rec.h+.03,z,.6,.3,1.3,[.7,.7,.72],.7);bit("coin",x,rec.h+.6,z,0,3.5,0,1,1.2,[1,1,1],8);say("v:sell",{x})}}
  for(let i=sold.length-1;i>=0;i--){const r=sold[i],k=(t-r.at)/.45;if(k>=1){sold.splice(i,1);continue}
    const sy=1-k;V.M(wx(r.x+.5),r.h-k*.5,wz(r.y+.5),0,-Math.PI/2,0,1,Math.max(.02,sy),1,_R);V.K["tb"+Math.min(3,r.l)].push(_R)}
}

// ---------- monsters ----------
function tint(ev){const f=ev.fl,sl=ev.sl>0;let r=1+f*2.4,g=1+f*2.4,b=1+f*2.4;if(sl){r*=.72;g*=.9;b*=1.45}if(ev.spawn<1){const k=1+(1-ev.spawn)*2;r*=k;g*=k*.8;b*=k*1.2}return[r,g,b]}
function drawMonster(ev,x,y,z,yaw,ph,s,c){
  const K=V.K,m=A.modelOf(ev.t);
  if(DRAW[m]){DRAW[m](ev,x,y,z,yaw,ph,s,c);return}
  if(m==="lendir"){const hop=Math.abs(Math.sin(ph)),land=1-hop,sy=1+hop*.14-(land>.82?(land-.82)*1.5:0),sxz=1/Math.sqrt(sy);
    V.M(x,y+hop*.22*s,z,0,yaw,0,s*sxz,s*sy,s*sxz,_R);K.m0.push(_R,c[0],c[1],c[2]);
    const bl=((ph*.16+ev.id*.37)%3)<.08?.12:1;V.put(K.m0e,_R,0,.4*(1-bl),0,0,0,0,1,bl,1,c[0],c[1],c[2])}
  else if(m==="kilat"){const fly=.5+Math.sin(ph*.25)*.07;V.M(x,y+fly*s,z,0,yaw,-.18+Math.sin(ph*.25)*.05,s,s,s,_R);K.m1.push(_R,c[0],c[1],c[2]);
    const fl=Math.sin(ph*3)*.75;V.put(K.m1w,_R,0,.1,0,fl,0,0);V.put(K.m1w,_R,0,.1,0,-fl,0,0,1,1,-1)}
  else if(m==="kura"){V.M(x,y,z,0,yaw+Math.sin(ph)*.05,0,s,s,s,_R);K.m2.push(_R,c[0],c[1],c[2]);
    const L=[[.3,.3,0],[.3,-.3,Math.PI],[-.3,.3,Math.PI],[-.3,-.3,0]];for(const[lx,lz,o]of L)V.put(K.m2l,_R,lx,.18,lz,0,0,Math.sin(ph+o)*.5,1,1,1,c[0],c[1],c[2]);
    V.put(K.m2h,_R,.48+Math.sin(ph*.5)*.04,.22,0,0,Math.sin(ph*.3)*.15,Math.sin(ph)*.08,1,1,1,c[0],c[1],c[2])}
  else if(m==="raja"){const bob=Math.abs(Math.sin(ph))*.06;V.M(x,y+bob*s,z,0,yaw,Math.sin(ph)*.04,s,s,s,_R);K.m3.push(_R,c[0],c[1],c[2]);
    const gl=1.2+.4*Math.sin(t*4);K.m3g.push(_R,gl,gl,gl);
    V.put(K.m3c,_R,-.02,1.0,0,0,0,.12+Math.sin(ph*.5)*.1);
    for(const sd of[1,-1]){V.put(K.m3a,_R,.05,.86,.5*sd,.25*sd,0,Math.sin(ph+(sd>0?0:Math.PI))*.55);V.put(K.m3l,_R,0,.32,.2*sd,0,0,Math.sin(ph+(sd>0?Math.PI:0))*.5)}
    V.put(K.m3s,_R,.32,.62,-.52,0,0,-.35+Math.sin(ph)*.1);
    if(!A.icon){V.M(x,.08,z,0,t,0,s*1.6,1,s*1.6,_B);V.FX.ring.push(_B,1,.35,.3,.55+.25*Math.sin(t*5));V.M(x,.08,z,0,0,0,s*2,1,s*2,_B);V.FX.decalA.push(_B,.9,.2,.15,.35)}}
  else{V.M(x,y+Math.abs(Math.sin(ph))*.1*s,z,0,yaw,0,s,s,s,_R);const e=A.enOf(ev.t)||{},cc=V.col(e.col||"#c0c0c0");K.mx.push(_R,cc.r*c[0],cc.g*c[1],cc.b*c[2])}
}

// ---------- the second bestiary: ghost, shield goblin and four more bosses ----------
const DRAW={};
// 0..1 through an ability pose that started at ev.abT, or -1 when none is playing
const abK=(ev,k,dur)=>ev.abK===k&&t-ev.abT<dur?(t-ev.abT)/dur:-1;
function aura(x,z,s,col,a){if(A.icon)return;a=a==null?1:a;V.M(x,.08,z,0,t,0,s*1.6,1,s*1.6,_B);V.FX.ring.push(_B,col[0],col[1],col[2],(.42+.2*Math.sin(t*5))*a);
  V.M(x,.08,z,0,0,0,s*2,1,s*2,_B);V.FX.decalA.push(_B,col[0]*.8,col[1]*.8,col[2]*.8,.2*a)}
function glowAt(x,y,z,sz,col,a){_w.set(x,y,z);_s.set(sz,sz,sz);_B.compose(_w,V.cam.quaternion,_s);V.FX.glow.push(_B,col[0],col[1],col[2],a)}
// ghost: floats, sways and leaves wisps behind; the sheet casts no shadow, so a soft one is painted under it
DRAW.hantu=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,p=ph*.5,hov=.16+Math.sin(p)*.07,br=Math.sin(p*1.8);
  V.M(x,y+hov*s,z,Math.sin(p*.7+ev.id)*.1,yaw+Math.sin(p*.6)*.15,-.15-Math.cos(p)*.05,s*(1+br*.03),s*(1-br*.035),s,_R);
  K.m_hantu.push(_R,c[0],c[1],c[2]);K.m_hantu_f.push(_R,c[0],c[1],c[2]);
  if(A.icon)return;
  const sh=s*(.95-hov*.8);V.M(x,y+.08,z,0,0,0,sh,1,sh,_B);V.FX.decal.push(_B,.12,.1,.2,.3);
  glowAt(x,y+(hov+.5)*s,z,1.7*s,[.62,.56,1],.1+.25*(V.tier?V.tier.night:0));
  if(Math.random()<fdt*14){_w.set(V.rnd(-.4,.4),V.rnd(.05,.25),V.rnd(-.4,.4)).applyMatrix4(_R);V.PA.add(_w.x,_w.y,_w.z,V.rnd(-.1,.1),V.rnd(.15,.4),V.rnd(-.1,.1),V.rnd(.6,1),.11,.02,.78,.72,1,.55,0,1.5)}
};
// shield goblin: waddles on short legs with the sword swinging; when hit it braces behind the shield
DRAW.perisai=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,st=Math.sin(ph),gd=Math.min(1,(ev.fl||0)*1.6);
  V.M(x,y+Math.abs(st)*.05*s,z,st*.07,yaw,-.04-gd*.08,s,s,s,_R);
  K.m_per.push(_R,c[0],c[1],c[2]);K.m_per_g.push(_R,c[0]*1.3,c[1]*1.3,c[2]*1.3);
  for(const sd of[1,-1])V.put(K.m_per_l,_R,0,.26,.15*sd,0,0,Math.sin(ph+(sd>0?0:Math.PI))*.6,1,1,1,c[0],c[1],c[2]);
  V.put(K.m_per_s,_R,.31+gd*.06,.5+Math.sin(ph*.5)*.015,-.3+gd*.13,0,.32-gd*.32,0,1,1,1,c[0],c[1],c[2]);
  V.put(K.m_per_w,_R,.2,.48,.34,0,0,-.55+st*.3+gd*.6,1,1,1,c[0],c[1],c[2]);
};
// king slime: slow heavy hops that squash on landing, a crown that lands a beat late, bubbles inside;
// for "summon" it gulps, then spits small slimes
DRAW.rajalendir=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,p=ph*.55,up=Math.max(0,Math.sin(p)),dn=Math.max(0,-Math.sin(p)),sm=abK(ev,"summon",1.1);
  let sy=1+up*.1-dn*.17+Math.sin(ph*4)*.025*dn,lift=up*.26;
  if(sm>=0){const sq=V.smooth(0,.3,sm)*(1-V.smooth(.3,.4,sm)),st=V.smooth(.3,.4,sm)*(1-V.smooth(.4,1,sm)),k=1-sq-st;sy=sy*k+.66*sq+1.32*st;lift*=k}
  const sxz=1/Math.sqrt(sy);
  V.M(x,y+lift*s,z,0,yaw,Math.sin(p*2)*.03,s*sxz,s*sy,s*sxz,_R);
  K.m_rl_k.push(_R,c[0],c[1],c[2]);K.m_rl.push(_R,c[0],c[1],c[2]);K.m_rl_f.push(_R,c[0],c[1],c[2]);
  const bl=((ph*.1+ev.id*.37)%3)<.06?.12:1;V.put(K.m0e,_R,0,.4*(1-bl),0,0,0,0,1,bl,1,c[0],c[1],c[2]);
  V.M(x,y+(lift+.57*sy+Math.max(0,Math.sin(p-.7))*.05)*s,z,.16+Math.sin(p*2+.6)*.07,yaw,0,s,s,s,_P);K.m_rl_c.push(_P,c[0],c[1],c[2]);
  aura(x,z,s,[.45,1,.35]);
  if(!A.icon&&Math.random()<fdt*5){_w.set(V.rnd(-.25,.25),V.rnd(.1,.3),V.rnd(-.25,.25)).applyMatrix4(_R);V.PN.add(_w.x,_w.y,_w.z,0,.35,0,.9,.05,.04,.85,1,.75,.7,0,.5)}
};
// giant scorpion: eight legs in a walking gait, snapping pincers, a tail that curls over the back and
// strikes now and then; with e.ab "burrow" it sinks into a travelling sand mound and only the sting shows
const KJ_LEG=[[.27,.55],[.14,.2],[.01,-.15],[-.12,-.48]];
DRAW.kalajengking=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,bw=ev.bw||0,g=ph*1.3;
  V.M(x,y+(Math.sin(g*2)*.008-bw*.46)*s,z,0,yaw,0,s,s,s,_R);
  K.m_kj.push(_R,c[0],c[1],c[2]);
  for(let i=0;i<4;i++){const[hx,a]=KJ_LEG[i];for(const sd of[1,-1]){const q=g+((i+(sd>0?0:1))%2)*Math.PI,sw=Math.sin(q)*.24,lf=Math.max(0,Math.cos(q))*.32;
    V.put(K.m_kj_l,_R,hx,.21,.12*sd,-lf,sd>0?a+sw:Math.PI-a-sw,0,1,1,1,c[0],c[1],c[2])}}
  for(const sd of[1,-1]){const sw=Math.sin(ph*.45+sd)*.15,rs=.22+Math.sin(ph*.3+sd*2)*.08,op=Math.sqrt(Math.max(0,Math.sin(ph*.8+sd*1.7)));
    V.M(.4,.24,.13*sd,sd>0?0:Math.PI,sd*sw,sd*rs,1,1,1,_L2);_P.multiplyMatrices(_R,_L2);K.m_kj_p.push(_P,c[0],c[1],c[2]);
    V.put(K.m_kj_f,_P,.56,.03,.13,0,-op*.6,0,1,1,1,c[0],c[1],c[2])}
  const strike=Math.pow(Math.max(0,Math.sin(ph*.22+ev.id)),10),cu=-.43+strike*.08;
  let px=-.58,py=.26,an=2.25-strike*.7;
  for(let i=0;i<6;i++){const L=.155-i*.008,nx=px+Math.cos(an)*L,ny=py+Math.sin(an)*L,sc=1-i*.07;
    V.put(K.m_kj_t,_R,(px+nx)/2,(py+ny)/2,Math.sin(ph*.4-i*.5)*.03*i,0,0,an,sc,sc,sc,c[0],c[1],c[2]);px=nx;py=ny;if(i<5)an+=cu}
  V.M(px,py,Math.sin(ph*.4-2.5)*.15,0,0,an,1,1,1,_L2);_Q.multiplyMatrices(_R,_L2);K.m_kj_s.push(_Q,c[0],c[1],c[2]);
  const vg=1.1+.5*Math.sin(t*6+ev.id);K.m_kj_g.push(_Q,vg,vg,vg);
  aura(x,z,s,[1,.65,.3],1-bw*.6);
  if(bw>.02){V.M(x,y,z,0,yaw,0,s*bw*.75,s*(.6+.4*bw)*(1+Math.sin(ph*2.6)*.06)*.75,s*bw*.75,_P);K.m_kj_m.push(_P,1,1,1)}
  if(A.icon)return;
  if(bw>.2&&Math.random()<fdt*18*bw){const a=Math.random()*6.28;V.PN.add(x+Math.cos(a)*.5*s,y+.05,z+Math.sin(a)*.4*s,Math.cos(a)*.4,V.rnd(.3,.7),Math.sin(a)*.4,.9,.12,.4,.8,.66,.45,.55,.6,1.5)}
  if(bw<.5&&Math.random()<fdt*3){_w.set(.19,-.15,0).applyMatrix4(_Q);V.PA.add(_w.x,_w.y,_w.z,0,-.2,0,.6,.06,.02,.6,1,.4,.9,3,.5)}
};
// yeti: a lumbering walk with swinging arms, frosty breath and its own little snowfall; for "stomp" it
// raises both fists and pounds the ground
DRAW.yeti=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,p=ph*.75,st=Math.sin(p),sp=abK(ev,"stomp",1.15);
  let bob=Math.abs(st)*.05,lean=-.06,up=0,slam=0;
  if(sp>=0){up=V.smooth(0,.4,sp)*(1-V.smooth(.43,.47,sp));slam=V.smooth(.43,.47,sp)*(1-V.smooth(.55,1,sp));bob+=up*.16-slam*.05;lean+=up*.2-slam*.32}
  V.M(x,y+bob*s,z,st*.06*(1-up),yaw,lean,s,s,s,_R);
  K.m_yt.push(_R,c[0],c[1],c[2]);K.m_yt_g.push(_R,c[0]*1.2,c[1]*1.2,c[2]*1.2);
  for(const sd of[1,-1]){
    V.put(K.m_yt_l,_R,0,.3,.22*sd,0,0,Math.sin(p+(sd>0?0:Math.PI))*.45*(1-up),1,1,1,c[0],c[1],c[2]);
    const sw=Math.sin(p+(sd>0?Math.PI:0))*.42+.12;
    V.put(K.m_yt_a,_R,.06,.92,.5*sd,-(.14+up*.25)*sd,0,sw*(1-up-slam)+2.75*up+.35*slam,1,1,1,c[0],c[1],c[2])}
  aura(x,z,s,[.6,.85,1]);
  if(A.icon)return;
  if(Math.random()<fdt*.9){_w.set(.52,.66,0).applyMatrix4(_R);const dx=Math.cos(yaw),dz=-Math.sin(yaw);
    for(let i=0;i<4;i++)V.PN.add(_w.x,_w.y,_w.z,dx*V.rnd(.4,.8)+V.rnd(-.1,.1),V.rnd(0,.2),dz*V.rnd(.4,.8)+V.rnd(-.1,.1),1.1,.07,.3,.92,.96,1,.5,-.05,1.8)}
  if(Math.random()<fdt*10)V.PN.add(x+V.rnd(-.8,.8)*s,y+V.rnd(1.2,1.6)*s,z+V.rnd(-.8,.8)*s,V.rnd(-.1,.1),-.6,V.rnd(-.1,.1),1.6,.05,.03,.95,.97,1,.9,0,.3);
};
// ---------- the third bestiary: the armies of the later chapters ----------
// goblin: a quick waddle with the club swinging
DRAW.goblin=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,p=ph*1.15,st=Math.sin(p);
  V.M(x,y+Math.abs(st)*.06*s,z,st*.09,yaw,-.06,s,s,s,_R);
  K.m_gob.push(_R,c[0],c[1],c[2]);K.m_gob_g.push(_R,c[0]*1.2,c[1]*1.2,c[2]*1.2);
  for(const sd of[1,-1])V.put(K.m_gob_l,_R,0,.24,.11*sd,0,0,Math.sin(p+(sd>0?0:Math.PI))*.7,1,1,1,c[0],c[1],c[2]);
  V.put(K.m_gob_w,_R,.13,.41,.29,.15,0,-.45+Math.sin(p)*.45,1,1,1,c[0],c[1],c[2]);
};
// wolf and hellhound: a bounding gallop, the tail streaming behind; the hellhound burns
function canineDraw(k,ev,x,y,z,yaw,ph,s,c){
  const K=V.K,p=ph*1.35,st=Math.sin(p),pitch=Math.cos(p)*.09;
  V.M(x,y+Math.abs(st)*.07*s,z,0,yaw,pitch,s,s,s,_R);
  K[k].push(_R,c[0],c[1],c[2]);
  V.M(.48,.6,0,0,Math.sin(ph*.4+ev.id)*.15,.05-pitch*1.4,1,1,1,_L2);_P.multiplyMatrices(_R,_L2);K[k+"_h"].push(_P,c[0],c[1],c[2]);K[k+"_g"].push(_P,1.3,1.3,1.3);
  for(const[lx,o]of[[.3,0],[-.3,Math.PI]])for(const sd of[1,-1])V.put(K[k+"_l"],_R,lx,.38,.12*sd,0,0,Math.sin(p+o+(sd>0?0:.45))*.75,1,1,1,c[0],c[1],c[2]);
  V.put(K[k+"_t"],_R,-.42,.5,0,0,Math.sin(ph*.9+ev.id)*.35,1.07-pitch-.15*st,1,1,1,c[0],c[1],c[2]);
}
DRAW.serigala=(ev,x,y,z,yaw,ph,s,c)=>canineDraw("m_srg",ev,x,y,z,yaw,ph,s,c);
DRAW.anjingapi=(ev,x,y,z,yaw,ph,s,c)=>{
  canineDraw("m_anj",ev,x,y,z,yaw,ph,s,c);
  const f=1+Math.sin(t*17+ev.id)*.18;V.put(V.K.m_anj_f,_R,0,0,0,0,0,0,1,f,1,1.3,1,1);
  if(A.icon)return;
  if(Math.random()<fdt*16){_w.set(V.rnd(-.35,.35),.7,V.rnd(-.1,.1)).applyMatrix4(_R);V.PA.add(_w.x,_w.y,_w.z,V.rnd(-.1,.1),V.rnd(.5,1),V.rnd(-.1,.1),.6,.08,.02,1,V.rnd(.45,.7),.2,1,-.2,1,1)}
  if(Math.random()<fdt*10)V.PN.add(x+V.rnd(-.15,.15),y+.06,z+V.rnd(-.15,.15),0,.25,0,1,.08,.25,.3,.24,.22,.4,-.05,1.2);
};
// skeleton: a stiff march, the jaw clacking, red sparks in the eyes, a rusty sword held out
DRAW.tengkorak=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,p=ph*.95,st=Math.sin(p);
  V.M(x,y+Math.abs(st)*.04*s,z,st*.05,yaw,-.03,s,s,s,_R);
  K.m_tk.push(_R,c[0],c[1],c[2]);const gl=1.2+.4*Math.sin(t*9+ev.id);K.m_tk_g.push(_R,gl,gl,gl);
  V.put(K.m_tk_j,_R,.05,.875,0,0,0,-Math.max(0,Math.sin(ph*2.1))*.4,1,1,1,c[0],c[1],c[2]);
  for(const sd of[1,-1])V.put(K.m_tk_l,_R,0,.43,.09*sd,0,0,Math.sin(p+(sd>0?0:Math.PI))*.55,1,1,1,c[0],c[1],c[2]);
  V.put(K.m_tk_a,_R,0,.82,-.19,.12,0,Math.sin(p)*.5,1,1,1,c[0],c[1],c[2]);
  V.M(0,.82,.19,-.15,0,.95+Math.sin(p*2)*.08,1,1,1,_L2);_P.multiplyMatrices(_R,_L2);K.m_tk_a.push(_P,c[0],c[1],c[2]);
  V.put(K.m_per_w,_P,.09,-.41,0,0,0,-Math.PI/2+.2,.85,.85,.85,c[0]*.78,c[1]*.62,c[2]*.5);
};
// bat: flits above the road in a zigzag with fast wingbeats; a soft shadow shows how high it flies
DRAW.kelelawar=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,fl=Math.sin(ph*3.2),zig=Math.sin(ph*.55+ev.id)*.18*s,cx=x+Math.sin(yaw)*zig,cz=z+Math.cos(yaw)*zig,hov=(.62+Math.sin(ph*.8)*.1+fl*.04)*s;
  V.M(cx,y+hov,cz,Math.cos(ph*.55+ev.id)*.3,yaw,-.12,s,s,s,_R);
  K.m_kl.push(_R,c[0],c[1],c[2]);K.m_kl_g.push(_R,1.3,1.3,1.3);
  const w=fl*1.05+.15;V.put(K.m_kl_w,_R,-.02,.05,.08,-w,-.15,0,1,1,1,c[0],c[1],c[2]);V.put(K.m_kl_w,_R,-.02,.05,-.08,Math.PI+w,.15,0,1,1,1,c[0],c[1],c[2]);
  if(A.icon)return;
  V.M(cx,y+.08,cz,0,0,0,s*.7,1,s*.7,_B);V.FX.decal.push(_B,.1,.08,.14,.28);
};
// mummy: a slow shuffle with the arms reaching forward and loose bandages fluttering
DRAW.mumi=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,p=ph*.6,st=Math.sin(p);
  V.M(x,y+Math.abs(st)*.025*s,z,st*.08,yaw,-.1,s,s,s,_R);
  K.m_mm.push(_R,c[0],c[1],c[2]);const gl=1.1+.3*Math.sin(t*4+ev.id);K.m_mm_g.push(_R,gl,gl,gl);
  for(const sd of[1,-1]){V.put(K.m_mm_l,_R,0,.32,.11*sd,0,0,Math.sin(p+(sd>0?0:Math.PI))*.32,1,1,1,c[0],c[1],c[2]);
    V.put(K.m_mm_a,_R,.02,.86,.24*sd,-.08*sd,0,1.45+Math.sin(p*1.3+(sd>0?0:1.7))*.12,1,1,1,c[0],c[1],c[2])}
  for(let i=0;i<4;i++){const sd=i%2?1:-1,f=Math.sin(t*4+i*1.9+ev.id)*.35;
    V.put(K.m_mm_s,_R,i<2?.32:-.2,i<2?.84:.95,(i<2?.25:.12)*sd,f*.6,0,i<2?-.3:.45+f*.5,1,1,1,c[0],c[1],c[2])}
  if(!A.icon&&Math.random()<fdt*3)V.PN.add(x+V.rnd(-.2,.2),y+.05,z+V.rnd(-.2,.2),0,.2,0,.9,.08,.3,.78,.72,.58,.4,-.05,1.5);
};
// imp: hops along, wings fluttering, the pitchfork held ready, sparks rising from its horns
DRAW.iblis=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,p=ph*1.25,hop=Math.abs(Math.sin(p)),sq=1-(1-hop)*.12,sx=s/Math.sqrt(sq);
  V.M(x,y+hop*.16*s,z,0,yaw,-.08+Math.cos(p)*.06,sx,s*sq,sx,_R);
  K.m_ib.push(_R,c[0],c[1],c[2]);K.m_ib_g.push(_R,1.3,1.3,1.3);
  for(const sd of[1,-1])V.put(K.m_ib_l,_R,0,.21,.1*sd,0,0,hop*.6-.2,1,1,1,c[0],c[1],c[2]);
  const w=Math.sin(ph*4)*.7+.3,wr=c[0]*4.5,wg=c[1]*1.2,wb=c[2]*.9;
  V.put(K.m_kl_w,_R,-.12,.55,.07,-w,-.3,0,.55,.55,.55,wr,wg,wb);V.put(K.m_kl_w,_R,-.12,.55,-.07,Math.PI+w,.3,0,.55,.55,.55,wr,wg,wb);
  V.put(K.m_ib_f,_R,.11,.41,.26,0,0,-.45+Math.sin(p)*.15,1,1,1,c[0],c[1],c[2]);
  if(!A.icon&&Math.random()<fdt*6){_w.set(-.02,1.02,(Math.random()<.5?1:-1)*.14).applyMatrix4(_R);V.PA.add(_w.x,_w.y,_w.z,V.rnd(-.1,.1),V.rnd(.4,.8),V.rnd(-.1,.1),.5,.07,.02,1,.55,.2,1,-.2,1,1)}
};
// lava golem: heavy slow steps, arms swinging, magma pulsing, drops of lava falling
DRAW.golemlava=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,p=ph*.55,st=Math.sin(p),gl=1.1+.35*Math.sin(t*3+ev.id);
  V.M(x,y+(Math.abs(st)*.05-.02)*s,z,st*.05,yaw,-.06,s,s,s,_R);
  K.m_gl.push(_R,c[0],c[1],c[2]);K.m_gl_g.push(_R,gl*c[0],gl*c[1],gl*c[2]);
  for(const sd of[1,-1]){V.put(K.m_gl_l,_R,0,.38,.17*sd,0,0,Math.sin(p+(sd>0?0:Math.PI))*.4,1,1,1,c[0],c[1],c[2]);
    V.M(.02,.98,.42*sd,-.12*sd,0,Math.sin(p+(sd>0?Math.PI:0))*.38,1,1,1,_L2);_P.multiplyMatrices(_R,_L2);K.m_gl_a.push(_P,c[0],c[1],c[2]);K.m_gl_k.push(_P,gl,gl,gl)}
  if(A.icon)return;
  if(Math.random()<fdt*4){_w.set(V.rnd(-.2,.35),V.rnd(.5,1),V.rnd(-.3,.3)).applyMatrix4(_R);V.PA.add(_w.x,_w.y,_w.z,0,0,0,.8,.07,.03,1,V.rnd(.45,.65),.15,1,6,.3)}
  if(Math.abs(st)<.06&&Math.random()<.4)V.PN.add(x+V.rnd(-.3,.3),y+.05,z+V.rnd(-.3,.3),V.rnd(-.3,.3),.3,V.rnd(-.3,.3),1,.12,.4,.36,.32,.3,.45,-.05,2);
};
// fire dragon: a hovering head that looks around, a body of plates that follows the road with a slither,
// bat wings and a burning tail. "breath" rears up and pours fire at a target; e.ab "enrage" makes it glow
const NG_N=9,NG=Array.from({length:NG_N+1},()=>({x:0,y:0,z:0,sc:1}));
DRAW.naga=(ev,x,y,z,yaw,ph,s,c)=>{
  const K=V.K,p=ph*.5,sp=.27*s,br=abK(ev,"breath",1.6),rg=ev.rg||0,g=V.geo,path=!A.icon&&ev.vd!=null&&g;
  const rear=br<0?0:V.smooth(0,.2,br)*(1-V.smooth(.2,.3,br)),pour=br<0?0:V.smooth(.2,.3,br)*(1-V.smooth(.78,.95,br));
  const hot=1+rg*(.3+.2*Math.sin(t*9)),cr=c[0]*hot,cg=c[1]*(1+rg*.08),cb=c[2]*(1-rg*.15);
  const P=NG,cy=Math.cos(yaw),sy=Math.sin(yaw);P[0].x=x;P[0].y=y+(.42+Math.sin(p)*.07+rear*.25)*s;P[0].z=z;
  for(let i=1;i<=NG_N;i++){const q=P[i],wave=Math.sin(p*1.2-i*.7)*.16,hy=(.4+Math.sin(p-i*.6)*.08)*s*(1-i*.035);q.sc=1-i*.062;
    if(path){const d=ev.vd-i*sp,dd=Math.max(0,d),a=gm().posIn(g,dd),b=gm().posIn(g,dd+.25),dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,off=(ev.off||0)+wave;
      q.x=wx(a[0]-dy/L*off);q.z=wz(a[1]+dx/L*off);q.y=Math.max(0,V.groundAt(a[0],a[1]))+hy;if(d<0)q.sc*=V.clamp(1+d/.8,0,1)}
    else{const bx=-i*sp*.92,bz=wave*s;q.x=x+bx*cy+bz*sy;q.z=z-bx*sy+bz*cy;q.y=y+hy}}
  const fl=Math.sin(ph*.55+ev.id)*.6+.3;
  for(let i=1;i<=NG_N;i++){const q=P[i],f=P[i-1];if(q.sc<.02)continue;
    const qy=Math.atan2(-(f.z-q.z),f.x-q.x),pt=Math.atan2(f.y-q.y,Math.hypot(f.x-q.x,f.z-q.z)),k=s*q.sc;
    V.M(q.x,q.y,q.z,0,qy,pt,k,k,k,_P);K.m_ng_b.push(_P,cr,cg,cb);
    if(i===1){V.put(K.m_ng_w,_P,-.05,.18,.16,-fl,-.25,0,1.5,1.5,1.5,cr,cg,cb);V.put(K.m_ng_w,_P,-.05,.18,-.16,Math.PI+fl,.25,0,1.5,1.5,1.5,cr,cg,cb)}
    if(i===NG_N){K.m_ng_t.push(_P,cr,cg,cb);
      if(!A.icon){_w.set(-.62,0,0).applyMatrix4(_P);const ff=(.85+.3*Math.sin(t*19+ev.id))*k;V.M(_w.x,_w.y,_w.z,0,t*3,0,3.4*ff,4.2*ff,3.4*ff,_B);K.flame.push(_B,1.3,1,.9);
        if(Math.random()<fdt*14)V.PA.add(_w.x,_w.y,_w.z,V.rnd(-.15,.15),V.rnd(.4,.8),V.rnd(-.15,.15),.6,.09,.02,1,V.rnd(.45,.7),.2,1,-.2,1,1)}}}
  // the head turns toward the breath's target, rears back, then lunges as the fire pours out
  let tw=0;if(br>=0&&ev.abX!=null){tw=Math.atan2(-(ev.abZ-z),ev.abX-x)-yaw;while(tw>Math.PI)tw-=Math.PI*2;while(tw<-Math.PI)tw+=Math.PI*2}
  const turn=Math.max(rear,pour),hy=yaw+tw*turn+Math.sin(p*.6)*.12*(1-turn),pitch=Math.sin(p)*.06+rear*.45-pour*.22;
  V.M(x,P[0].y,z,0,hy,pitch,s,s,s,_R);K.m_ng_h.push(_R,cr,cg,cb);
  V.put(K.m_ng_j,_R,0,-.1,0,0,0,-(.06+Math.sin(ph*.7)*.04+rear*.25+pour*.5),1,1,1,cr,cg,cb);
  const eg=1.2+rg*.8+pour*.6;K.m_ng_g.push(_R,eg,eg,eg);
  aura(x,z,s,[1,.45,.2]);
  if(A.icon)return;
  if(!ev.sg)ev.sg=P.map(()=>[0,0,0]);P.forEach((q,i)=>{ev.sg[i][0]=q.x;ev.sg[i][1]=q.y;ev.sg[i][2]=q.z});
  _w.set(.66,-.12,0).applyMatrix4(_R);const mx=_w.x,my=_w.y,mz=_w.z;
  if(rear>.05)glowAt(mx,my,mz,(.4+rear*.6)*s,[1,.6,.25],.7*rear);
  if(pour>.05){let dx=Math.cos(hy),dz=-Math.sin(hy),dy=-.3;
    if(ev.abX!=null){const tx=ev.abX-mx,tz=ev.abZ-mz,L=Math.hypot(tx,tz)||1;dx=tx/L;dz=tz/L;dy=(.3-my)/L}
    const n=Math.ceil(fdt*260*pour);
    for(let i=0;i<n;i++){const v=V.rnd(5.5,7.5);V.PA.add(mx,my,mz,dx*v+V.rnd(-.4,.4),dy*v+V.rnd(-.2,.5),dz*v+V.rnd(-.4,.4),V.rnd(.35,.5),.12,.55*s,1,V.rnd(.42,.78),.16,1,-.8,1.4,0)}
    if(Math.random()<fdt*30)V.PN.add(mx+dx*1.4,my,mz+dz*1.4,dx*2,.6,dz*2,1.2,.2,.8,.3,.27,.26,.45,-.2,1.2);
    glowAt(mx,my,mz,1.1*s,[1,.6,.25],.85*pour)}
  if(rg>.1&&Math.random()<fdt*25*rg){const q=P[1+Math.floor(Math.random()*NG_N)];V.PA.add(q.x+V.rnd(-.2,.2),q.y+V.rnd(0,.3),q.z+V.rnd(-.2,.2),0,V.rnd(.5,1),0,.8,.08,.02,1,.55,.2,1,-.3,1,1)}
};
// used by the icon renderer: draws one monster into whatever kit set is active
A.drawModel=(ev,x,y,z,yaw,ph,s)=>{A.icon=true;try{drawMonster(ev,x,y,z,yaw,ph,s,[1,1,1])}finally{A.icon=false}};
const _bq=new THREE.Vector3();
function hpBar(x,y,z,f,w){
  const q=V.cam.quaternion;_bq.set(1,0,0).applyQuaternion(q);
  _v.set(x,y,z);_s.set(w+.04,.085,1);_B.compose(_v,q,_s);V.FX.bar.push(_B,.08,.08,.12,.85);
  const fw=w*f,off=(w-fw)/2;_v.set(x-_bq.x*off,y-_bq.y*off,z-_bq.z*off);_s.set(fw,.05,1);_B.compose(_v,q,_s);
  const col=f>.5?[.5,.82,.45]:f>.25?[.94,.71,.27]:[.9,.38,.35];V.FX.bar.push(_B,col[0],col[1],col[2],1);
}
function syncEnemies(S,dt){
  const g=V.geo,seen=new Set(),speed=S.sp||1;
  for(const e of S.E){
    if(e.d<0)continue;seen.add(e.id);let ev=enemies.get(e.id);
    if(!ev){ev={id:e.id,t:e.t,vd:e.d,yaw:0,ph:H(e.id,3)*6,fl:0,hp:e.hp,spawn:A.fresh?1:0,off:(H(e.id,7)-.5)*.22,tx:0,ty:0,y:0,sl:0};enemies.set(e.id,ev);
      const p=gm().posIn(g,e.d),p2=gm().posIn(g,e.d+.3);ev.yaw=Math.atan2(-(p2[1]-p[1]),p2[0]-p[0]);
      if(!A.fresh&&V.portal&&e.d<.6){const P=V.portal;fx("glow",P.x,P.y,P.z,.4,.6,1.8,P.col,.8);puff(V.PA,10,P.x+.2,P.y,P.z,1,.6,.5,.1,.03,P.col,1,0,2);
        if(A.isBoss(e.t)){V.shake(.5);fx("ring",P.x+.5,.08,P.z,1,.4,3,[1,.4,.35],1);say("v:spawn",{boss:true})}}
      else if(!A.fresh&&e.d>=.6){const p=gm().posIn(g,e.d),X=wx(p[0]),Z=wz(p[1]);   // appeared mid-road (summoned)
        puff(V.PN,8,X,.25,Z,1,1.2,.5,.1,.05,SC((A.enOf(e.t)||{}).col||"#ffffff"),.8,4,1.5);fx("ringN",X,.08,Z,.35,.15,.8,[1,1,1],.6)}}
    ev.t=e.t;ev.sl=e.sl;
    const sp=spdOf(e)*speed;
    if(S.ph==="wave")ev.vd+=sp*dt;
    ev.vd=V.damp(ev.vd,e.d,5,dt);if(Math.abs(ev.vd-e.d)>1.2)ev.vd=e.d;
    if(e.hp<ev.hp-.01&&!A.demo&&ev.fl<.2&&!projs.some(p=>!p.done&&Math.abs(p.tx-ev.tx)<.6&&Math.abs(p.ty-ev.ty)<.6))ev.fl=.8;
    ev.hp=e.hp;ev.fl=Math.max(0,ev.fl-dt*6);ev.spawn=Math.min(1,ev.spawn+dt*3);
    ev.ph+=dt*(A.modelOf(e.t)==="kilat"?14:7)*speed*(e.sl>0?.45:1)*(S.ph==="wave"?1:.35);
    place(ev,dt);
    const ab=e.ab||null;if(ab!==(ev.ab||null)){if(!A.fresh)abState(ev,ev.ab||null,ab);ev.ab=ab}
    ev.bw=A.fresh?(ab==="burrow"?1:0):V.damp(ev.bw||0,ab==="burrow"?1:0,4,dt);ev.rg=V.damp(ev.rg||0,ab==="enrage"?1:0,3,dt);
    const s=sizeOf(e.t)*V.ease.back(ev.spawn)*(1+ev.fl*.14);
    drawMonster(ev,ev.x,ev.y,ev.z,ev.yaw,ev.ph,s,tint(ev));
    if(ev.sl>0&&ev.bw<.5&&Math.random()<dt*6)V.PN.add(ev.x+V.rnd(-.2,.2),ev.y+heightOf(e.t),ev.z+V.rnd(-.2,.2),0,-.2,0,.8,.05,.03,.9,.97,1,.9,0,.5);
    const mh=e.mhp||(A.enOf(e.t)||{hp:1}).hp*(S.wm||1),f=V.clamp(e.hp/mh,0,1);
    if(!A.isBoss(e.t)&&f<.999&&!A.demo&&ev.bw<.5)hpBar(ev.x,ev.y+heightOf(e.t)+.16,ev.z,f,Math.max(.42,sizeOf(e.t)*.8));
    if(A.modelOf(e.t)==="kilat"&&Math.random()<dt*20)V.PA.add(ev.x,ev.y+.32,ev.z,0,0,0,.3,.07,.02,1,.9,.5,.5,0,0);
  }
  for(const[id,ev]of enemies)if(!seen.has(id)){enemies.delete(id);
    const leak=ev.vd>g.PLEN-.7,delay=leak?0:landsIn(ev.tx,ev.ty);
    corpses.push({ev,at:t+delay,leak,sp:spdOf({t:ev.t,sl:0,sf:1})*speed})}
}
function place(ev,dt){
  const g=V.geo,p=gm().posIn(g,ev.vd),a=gm().posIn(g,ev.vd+.28),dx=a[0]-p[0],dy=a[1]-p[1],L=Math.hypot(dx,dy)||1;
  ev.tx=p[0]-dy/L*ev.off;ev.ty=p[1]+dx/L*ev.off;
  ev.x=wx(ev.tx);ev.z=wz(ev.ty);ev.y=Math.max(0,V.groundAt(ev.tx,ev.ty));
  if(L>.01)ev.yaw=V.dampAng(ev.yaw,Math.atan2(-dy,dx),8,dt);
}
function corpsesTick(S,dt){
  for(let i=corpses.length-1;i>=0;i--){const c=corpses[i],ev=c.ev;
    if(t<c.at){ev.vd+=c.sp*dt;ev.ph+=dt*7;place(ev,dt);drawMonster(ev,ev.x,ev.y,ev.z,ev.yaw,ev.ph,sizeOf(ev.t),tint(ev));continue}
    const dur=c.leak?.5:.32,k=(t-c.at)/dur;
    if(k>=1){corpses.splice(i,1);if(c.leak&&!A.demo)leakFx(ev);continue}
    if(c.leak){ev.vd+=c.sp*dt;place(ev,dt);const s=sizeOf(ev.t)*(1-k);drawMonster(ev,ev.x+k*.5,ev.y,ev.z,ev.yaw,ev.ph+=dt*7,s,[1,.6,.6])}
    else{const s=sizeOf(ev.t)*(1+k*.35)*(1-k*k),w=1+3*(1-k);drawMonster(ev,ev.x,ev.y+k*.15,ev.z,ev.yaw+k*2,ev.ph,s,[w,w,w])}
  }
}
function leakFx(ev){
  const c=V.castle;if(!c)return;
  fx("glow",c.gate[0],c.gate[1]+.2,c.gate[2],.35,.6,2.2,[1,.35,.3],1);burst(6,"chunk",c.gate[0],.8,c.gate[2],1.4,2.4,1,1,LC("#7f858f"));
  puff(V.PN,10,c.gate[0],.5,c.gate[2],1,1,1,.2,.7,[.55,.55,.58],.6,-.2);flash(c.gate[0],1,c.gate[2],[1,.3,.25],2.5,.35);V.shake(.35);
  V.ov&&V.ov.hurt();
}

// ---------- projectiles ----------
function projTick(dt){
  const K=V.K;
  for(let i=projs.length-1;i>=0;i--){const p=projs[i];p.age+=dt;
    const f=Math.min(1,p.age/p.dur),arc=p.h*4*f*(1-f),x=V.lerp(p.f[0],p.to[0],f),y=V.lerp(p.f[1],p.to[1],f)+arc,z=V.lerp(p.f[2],p.to[2],f);
    if(f>=1&&!p.done){p.done=true;impact(p.k,p.to[0],p.to[1],p.to[2],p.tx,p.ty)}
    if(p.k===3){const k=p.age/(p.dur+.22);if(k>=1){projs.splice(i,1);continue}
      const dx=p.to[0]-p.f[0],dy=p.to[1]-p.f[1],dz=p.to[2]-p.f[2],L=Math.hypot(dx,dy,dz)||1;beam(p.f,p.to,L,.16*(1-k),[.85,.6,1],1-k);beam(p.f,p.to,L,.05*(1-k)+.01,[1,.96,1],1-k);continue}
    if(p.done){projs.splice(i,1);continue}
    const f2=Math.min(1,f+.03),arc2=p.h*4*f2*(1-f2),nx=V.lerp(p.f[0],p.to[0],f2),ny=V.lerp(p.f[1],p.to[1],f2)+arc2,nz=V.lerp(p.f[2],p.to[2],f2);
    const dx=nx-x,dy=ny-y,dz=nz-z,yaw=Math.atan2(-dz,dx),pitch=Math.atan2(dy,Math.hypot(dx,dz));
    if(p.k===0){V.M(x,y,z,0,yaw,pitch,1,1,1,_B);K.pArrow.push(_B);if(Math.random()<.5)V.PA.add(x,y,z,0,0,0,.15,.04,.01,1,.95,.8,.6,0,0)}
    else if(p.k===1){V.M(x,y,z,p.age*9,p.age*7,0,1,1,1,_B);K.pBall.push(_B);if(Math.random()<.7)V.PN.add(x,y,z,V.rnd(-.1,.1),.15,V.rnd(-.1,.1),.6,.07,.2,.7,.7,.72,.45,-.1,1)}
    else if(p.k===2){V.M(x,y,z,0,yaw+p.age*14,pitch,1,1,1,_B);K.pIce.push(_B);fx("glow",x,y,z,.05,.35,.35,[.55,.85,1],.7);if(Math.random()<.8)V.PA.add(x,y,z,V.rnd(-.3,.3),V.rnd(-.3,.3),V.rnd(-.3,.3),.35,.05,.02,.8,.95,1,.9,0,1)}
    else if(p.k===9){const sp=p.spin||6;V.M(x,y,z,p.age*sp,p.age*sp*.7,0,1,1,1,_B);K.pMeteor.push(_B,1.3,1,.9);fx("glow",x,y,z,.05,1,1,[1,.55,.25],.8);
      for(let j=0;j<3;j++)V.PA.add(x+V.rnd(-.15,.15),y+V.rnd(-.15,.15),z+V.rnd(-.15,.15),V.rnd(-.3,.3),V.rnd(.2,.6),V.rnd(-.3,.3),.45,.3,.05,1,V.rnd(.45,.75),.2,1,0,1.5);
      if(Math.random()<.6)V.PN.add(x,y,z,0,.3,0,1.2,.25,.8,.35,.32,.32,.5,-.1,.8)}
    else{V.M(x,y,z,0,yaw,0,.5,.5,.5,_B);K.pBall.push(_B)}
  }
}
const _ba=new THREE.Vector3(),_bb=new THREE.Vector3(),_bc=new THREE.Vector3(),_bm=new THREE.Matrix4();
function beam(a,b,L,w,col,al){
  _ba.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();_bb.copy(V.cam.position).sub(_v.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2)).normalize();
  _bc.crossVectors(_ba,_bb).normalize();_bb.crossVectors(_bc,_ba).normalize();
  _bm.makeBasis(_ba.multiplyScalar(L),_bc.multiplyScalar(w),_bb);_bm.setPosition((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
  V.FX.beam.push(_bm,col[0],col[1],col[2],al);
}

// ---------- the fort reacts to how many lives are left ----------
let lastPh=null,fortT=0;
function fortTick(S,dt){
  const c=V.castle;if(!c)return;
  const lv=S.lv==null?20:S.lv,max=gm().LIVES||20,hurt=1-lv/max;
  if(hurt>.4&&Math.random()<dt*hurt*10)V.PN.add(c.keep[0]+V.rnd(-.3,.3),c.keep[1]+.6,c.keep[2]+V.rnd(-.3,.3),V.rnd(-.1,.1),.6,V.rnd(-.1,.1),2.5,.25,1,.3,.3,.32,.5,-.08,.4);
  if(hurt>.7&&Math.random()<dt*14)V.PA.add(c.x+V.rnd(-.15,.15),V.rnd(.9,1.2),c.z+V.rnd(-1.2,1.2),0,V.rnd(.4,.9),0,.6,.18,.05,1,.55,.2,1,-.2,1,1);
  const night=V.tier?V.tier.night:0;
  for(const p of c.torches){const f=1+Math.sin(t*19+p[2]*3)*.18+Math.sin(t*7.3+p[2])*.1;V.M(p[0],p[1]+.06,p[2],0,t*2,0,1.4*f,1.8*f,1.4*f,_B);V.K.flame.push(_B,1.3,1.1,1);
    _v.set(p[0],p[1]+.08,p[2]);_s.set(.9*f+night*.8,.9*f+night*.8,1);_B.compose(_v,V.cam.quaternion,_s);V.FX.glow.push(_B,1,.62,.3,.55+night*.35);
    if(night>.3){V.M(p[0]+.2,V.TOP+.02,p[2],0,0,0,2.4,1,2.4,_B);V.FX.decalA.push(_B,1,.55,.25,.22*night*f)}
    if(Math.random()<dt*7)V.PA.add(p[0]+V.rnd(-.03,.03),p[1]+.12,p[2]+V.rnd(-.03,.03),V.rnd(-.1,.1),V.rnd(.5,.9),V.rnd(-.1,.1),.5,.06,.02,1,.7,.3,1,-.1,.8,1)}
  if(V.portal&&night>.3){const P=V.portal;V.M(P.x+.4,V.TOP+.02,P.z,0,0,0,3,1,3,_B);V.FX.decalA.push(_B,P.col[0],P.col[1],P.col[2],.28*night)}
  const down=S.ph==="over";fortT=V.damp(fortT,down?1:0,down?9:3,dt);
  c.port.position.y=c.portY-fortT*.72;
  if(S.ph!==lastPh&&lastPh!==null){
    if(S.ph==="over"){V.shake(1);burst(12,"chunk",c.x,1,c.z,2,3,1.6,1.4,LC("#7f858f"));for(let i=0;i<30;i++)V.PN.add(c.x+V.rnd(-.4,.4),V.rnd(.2,1.4),c.z+V.rnd(-2,2),V.rnd(-.3,.3),.6,V.rnd(-.3,.3),3,.3,1.2,.32,.3,.32,.6,-.05,.5)}
  }
  lastPh=S.ph;
}
function fireworks(dt){
  if(Math.random()>dt*3.2)return;
  const x=V.rnd(-8,8),y=V.rnd(3.5,6),z=V.rnd(-5,3),c=SC(gm().PCOL[Math.floor(Math.random()*4)]);
  fx("glow",x,y,z,.35,.5,2.6,c,1);for(let i=0;i<36;i++){const a=Math.random()*Math.PI*2,u=V.rnd(-1,1),r=Math.sqrt(1-u*u),v=V.rnd(2.2,3.2);
    V.PA.add(x,y,z,Math.cos(a)*r*v,u*v,Math.sin(a)*r*v,1.3,.13,.03,c[0],c[1],c[2],1,1.6,1.4,1)}
  say("v:firework",{x});
}

// ---------- the menu's little battle (visual only, nothing reaches the logic) ----------
// In the gallery (#galeri) it parades every model, the extras included, and the bosses use their abilities.
let demo=null;
function demoState(){
  const g=V.geo,T=[];let i=0;const taken=new Set();
  // in the gallery the towers stand two tiles back from the road, so they do not hide the monsters in close-ups
  const far=V.gallery?2:1,nearRoad=(x,y)=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)if(g.PATH.has((x+a)+","+(y+b)))return true;return false};
  for(const k of g.PATH){if(i++%4!==1)continue;const[x,y]=k.split(",").map(Number);
    for(const[dx,dy]of[[0,-1],[0,1],[1,0],[-1,0]]){const nx=x+dx*far,ny=y+dy*far,kk=nx+","+ny;if(nx<0||ny<0||nx>=V.COLS||ny>=V.ROWS||g.PATH.has(kk)||taken.has(kk)||(far>1&&nearRoad(nx,ny)))continue;
      taken.add(kk);const n=T.length;T.push({x:nx,y:ny,t:n%4,l:1+(n*7)%3,o:n%4,cd:H(n,3)});break}
    if(T.length>=9)break}
  const gal=!!V.gallery,n=A.types(),reg=[],boss=[];for(let k=0;k<n;k++)(A.isBoss(k)?boss:reg).push(k);
  // the menu battle previews the selected level: its last wave's enemies, then its boss
  const L=gm().selLevel||1,lw=gm().waveList(gm().levelWaves(L),L),bs=lw.find(([q])=>A.isBoss(q));
  let order=lw.filter(([q])=>!A.isBoss(q)).slice(0,11).map(q=>q[0]);if(bs)order.push(bs[0]);if(!order.length)order=[0];
  if(gal&&reg.length){order=[];let r=0;for(const b of boss)order.push(reg[r++%reg.length],reg[r++%reg.length],b);if(!boss.length)order=reg}
  return{ph:"wave",sp:1,wm:1,rg:0,lv:20,w:1,P:[{c:0},{c:1},{c:2},{c:3}],T,E:[],nid:1,oi:0,spawnCd:0,order,gal,L};
}
function demoSpawn(S,ti,d){const hp=A.enOf(ti).hp*(S.gal?.5:.35),e={id:S.nid++,t:ti,d:d||0,hp,hp0:hp,sl:0,sf:1,cd:2.2};S.E.push(e);return e}
// what each boss does in the gallery, with the ability events the logic would send; returns the cooldown
function demoAbility(S,e){
  const m=A.modelOf(e.t),g=V.geo,p=gm().posIn(g,e.d);
  if(m==="rajalendir"){A.onAbility({t:e.t,k:"summon",x:p[0],y:p[1],id:e.id});later.push({at:t+.45,fn:()=>{if(demo===S)for(let j=0;j<3;j++)demoSpawn(S,0,Math.max(0,e.d-.35+j*.35))}});return 5.5}
  if(m==="kalajengking"){if(e.ab){e.ab=null;return 4.5}e.ab="burrow";return 2.6}
  if(m==="yeti"){A.onAbility({t:e.t,k:"stomp",x:p[0],y:p[1],id:e.id,r:1.8});
    later.push({at:t+.52,fn:()=>{if(demo!==S)return;const q=gm().posIn(g,e.d);for(const tw of S.T)if(Math.hypot(tw.x+.5-q[0],tw.y+.5-q[1])<=2.3)tw.fz=2.8}});return 6}
  if(m==="naga"){let best=null,bd=3.2;for(const tw of S.T){const dd=Math.hypot(tw.x+.5-p[0],tw.y+.5-p[1]);if(dd<bd){bd=dd;best=tw}}
    if(!best)return .4;A.onAbility({t:e.t,k:"breath",x:p[0],y:p[1],tx:best.x+.5,ty:best.y+.5,r:.8,id:e.id});later.push({at:t+.62,fn:()=>{if(demo===S)best.fz=2.6}});return 5}
  return 99;
}
function demoTick(dt){
  const S=demo,g=V.geo;
  S.spawnCd-=dt;if(S.spawnCd<=0&&S.E.length<(S.gal?10:12)){const ti=S.order[S.oi++%S.order.length];demoSpawn(S,ti,0);S.spawnCd=A.isBoss(ti)?(S.gal?6:2.6):(S.gal?3.4:.9)}
  for(let i=S.E.length-1;i>=0;i--){const e=S.E[i];e.sl=Math.max(0,e.sl-dt);e.d+=spdOf(e)*dt;if(e.d>=g.PLEN){S.E.splice(i,1);continue}
    if(S.gal&&A.isBoss(e.t)){e.cd-=dt;if(e.cd<=0&&e.d>1)e.cd=demoAbility(S,e);if(A.modelOf(e.t)==="naga"&&!e.ab&&e.hp<e.hp0*.5)e.ab="enrage"}}
  for(const tw of S.T){if(tw.fz>0){tw.fz=Math.max(0,tw.fz-dt);continue}tw.cd-=dt;if(tw.cd>0)continue;const st=gm().stat(tw.t,tw.l),r2=st.range*st.range;let best=null,bd=-1;
    for(const e of S.E){if(e.ab==="burrow"||(S.gal&&e.id===feat.id))continue;const p=gm().posIn(g,e.d),dx=p[0]-tw.x-.5,dy=p[1]-tw.y-.5;if(dx*dx+dy*dy<=r2&&e.d>bd){bd=e.d;best=e}}
    if(!best)continue;tw.cd=st.rate*1.3;const p=gm().posIn(g,best.d);A.onShot({t:tw.t,x1:tw.x+.5,y1:tw.y+.5,x2:p[0],y2:p[1]});
    for(const e of S.E){if(e.ab==="burrow")continue;const q=gm().posIn(g,e.d);if(e===best||(st.splash&&Math.hypot(q[0]-p[0],q[1]-p[1])<=st.splash)){if(!(S.gal&&e.id===feat.id))e.hp-=st.dmg;if(st.slow){e.sl=st.slowDur;e.sf=st.slow}}}
    for(let i=S.E.length-1;i>=0;i--){const e=S.E[i];if(e.hp<=0){const q=gm().posIn(g,e.d);A.onDeath({t:e.t,x:q[0],y:q[1],gold:0});S.E.splice(i,1)}}}
}

// ---------- birds circling the island (bats at night) ----------
const birds=Array.from({length:7},(_,i)=>({r:7+H(i,1)*6,y:3.4+H(i,2)*1.6,w:(.18+H(i,3)*.12)*(i%2?1:-1),p:H(i,4)*6.28,f:H(i,5)*6}));
function birdsTick(){
  const night=V.tier?V.tier.night>.5:false,col=night?V.col("#3a2c4a"):V.col(V.theme&&V.theme.key==="bukit"?"#5a4a3a":"#2a2a32");
  for(const b of birds){const a=b.p+t*b.w,x=Math.cos(a)*b.r,z=Math.sin(a)*b.r*.65-1,yaw=Math.atan2(-Math.cos(a)*b.r*.65*Math.sign(b.w),-Math.sin(a)*b.r*Math.sign(b.w)),fl=Math.sin(t*(night?16:11)+b.f)*.9;
    V.M(x,b.y+Math.sin(t*1.3+b.f)*.2,z,0,yaw,0,1,1,1,_R);V.K.bird.push(_R,col.r,col.g,col.b);
    V.put(V.K.birdw,_R,0,.02,-.04,fl,0,0,1,1,1,col.r,col.g,col.b);V.put(V.K.birdw,_R,0,.02,.04,-fl,0,0,1,1,-1,col.r,col.g,col.b)}
}

// ---------- the gallery's close-up: one monster at a time, cycling through the types ----------
let feat={ti:-1,id:-1,at:-99},featWant=null;
// a monster asked for from the bestiary walks alone for a while, then the parade carries on
A.feature=ti=>{if(!demo||!demo.gal||!A.demo){featWant=ti;return}
  demo.E.length=0;demo.spawnCd=A.isBoss(ti)?11:7;const e=demoSpawn(demo,ti,2.4);feat={ti,id:e.id,at:t}};
A.featured=()=>{
  if(!A.demo||!demo||!demo.gal)return null;
  let ev=enemies.get(feat.id);
  if(!ev){const c=corpses.find(c=>c.ev.id===feat.id);if(c)return c.ev;if(t-feat.at<.3)return null}   // stay for the death; a monster asked for appears next frame
  if(!ev||t-feat.at>(A.isBoss(ev.t)?9:5.5)){
    const n=A.types();let pick=null;
    for(let k=1;k<=n&&!pick;k++){const ti=(feat.ti+k)%n;for(const e of enemies.values())if(e.t===ti&&e.vd>1.3&&e.vd<V.geo.PLEN-4&&e.spawn>=1&&(!pick||e.vd<pick.vd))pick=e}
    if(pick){feat={ti:pick.t,id:pick.id,at:t};ev=pick}
  }
  return ev||null;
};

// ---------- per frame ----------
A.reset=()=>{towers.clear();enemies.clear();corpses=[];sold=[];projs=[];bits=[];fxs=[];later=[];lastPh=null;A.fresh=true;demo=null;feat={ti:-1,id:-1,at:-99};V.PA&&V.PA.clear();V.PN&&V.PN.clear()};
A.fresh=true;
A.tick=(dt,mode)=>{
  t+=dt;fdt=dt;
  for(let i=later.length-1;i>=0;i--)if(t>=later[i].at){const f=later[i].fn;later.splice(i,1);f()}
  let S=gm().S;
  const demoNow=mode!=="game"||!S;
  if(demoNow!==A.demo){A.reset()}  // switching between the menu battle and a real game starts clean
  A.demo=demoNow;
  if(A.demo){if(!demo||demo.g!==V.geo||demo.gal!==!!V.gallery||(!demo.gal&&demo.L!==(gm().selLevel||1))){A.reset();demo=demoState();demo.g=V.geo}
    if(featWant!=null&&demo.gal){const w=featWant;featWant=null;A.feature(w)}
    demoTick(dt);S=demo}
  syncTowers(S,dt);syncEnemies(S,dt);A.fresh=false;corpsesTick(S,dt);if(!V.RM)birdsTick();projTick(dt);bitsTick(dt);fxTick(dt);lightTick(dt);
  if(!A.demo){fortTick(S,dt);if(S.ph==="win")fireworks(dt)}
  const occ=new Set();for(const r of towers.values())occ.add(r.x+","+r.y);V.decorTick(occ,dt);
  return S;
};
// a tap on the board (touch screens have no hover to show where it landed)
A.tap=(tx,ty)=>{const h=V.groundAt(tx+.5,ty+.5);fx("ringN",wx(tx+.5),h+.05,wz(ty+.5),.35,.25,.95,[1,1,1],.75)};
A.enemies=enemies;A.towers=towers;
A.bossOf=S=>{let b=null;for(const e of S.E)if(A.isBoss(e.t)&&(!b||e.d>b.d))b=e;return b};
})();
