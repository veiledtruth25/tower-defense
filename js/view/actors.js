// Tampilan 3D, aktor: menara, monster, proyektil, efek, reaksi kastel dan pertempuran mini di menu.
// Milik sesi desain. Membaca state logika lewat BB.game (read-only) dan bereaksi pada event
// "shot", "death" dan "help". Event suara dikirim sebagai "v:*" untuk audio.js.
(function(){
"use strict";
const BB=window.BB,V=BB.V,THREE=window.THREE;
if(!THREE)return;
const A=V.A={},gm=()=>BB.game,H=V.hash;
let t=0,towers=new Map(),enemies=new Map(),corpses=[],sold=[],projs=[],bits=[],fxs=[],later=[];
const wx=tx=>tx-V.HX,wz=ty=>ty-V.HZ;
const _R=new THREE.Matrix4(),_T=new THREE.Matrix4(),_B=new THREE.Matrix4(),_v=new THREE.Vector3(),_s=new THREE.Vector3(),_q=new THREE.Quaternion();
const say=(n,d)=>{if(!A.demo)BB.emit(n,d)};

// ---------- models: the logic may name one per enemy type with EN[t].model ----------
const DEFAULT_MODEL=["lendir","kilat","kura","raja"];
A.modelOf=ti=>{const e=gm().EN[ti]||{};return e.model||DEFAULT_MODEL[ti]||"x"};
A.isBoss=ti=>{const e=gm().EN[ti]||{};return e.boss!=null?!!e.boss:A.modelOf(ti)==="raja"};
const sizeOf=ti=>{const e=gm().EN[ti]||{r:.3};return e.r*2.45*(A.isBoss(ti)?1.4:1)};
const heightOf=ti=>{const m=A.modelOf(ti),s=sizeOf(ti);return(m==="kilat"?.75:m==="raja"?1.25:.62)*s};

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

// ---------- impacts and deaths ----------
function impact(k,x,y,z,tx,ty){
  const hitR=k===1?1.05:k===2?.8:.4;
  for(const ev of enemies.values())if(Math.abs(ev.tx-tx)<hitR&&Math.abs(ev.ty-ty)<hitR)ev.fl=1;
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
function dieFx(ti,x,z,gold){
  const m=A.modelOf(ti),boss=A.isBoss(ti),s=sizeOf(ti),y=heightOf(ti)*.5;
  if(m==="lendir"){puff(V.PN,16,x,y,z,1.8,2.2,.7,.09,.04,[.55,.82,.4],.95,7,1.2);burst(6,"chunk",x,y,z,1.6,2.8,.8,1,LC("#8fd16a"));fx("decal",x,.076,z,2.6,.2,.75,[.36,.6,.25],.7)}
  else if(m==="kilat"){puff(V.PA,14,x,y,z,2.5,1,.35,.08,.02,[1,.9,.4],1);burst(4,"chunk",x,y,z,1.4,1.5,.9,.8,LC("#e8f6ff"));puff(V.PN,5,x,y,z,.5,.5,.6,.15,.4,[.9,.9,.85],.45)}
  else if(m==="kura"){burst(9,"chunk",x,y,z,1.8,2.6,1.1,1.25,LC("#8b6a42"));puff(V.PN,8,x,.1,z,.8,.6,.9,.2,.6,[.7,.62,.5],.45,-.1)}
  else if(m==="raja"){for(let i=0;i<5;i++)later.push({at:t+i*.12,fn:()=>{const a=Math.random()*6.28,r=V.rnd(0,.5);impact(9,x+Math.cos(a)*r,y,z+Math.sin(a)*r,0,0)}});
    burst(14,"chunk",x,y,z,2.4,3.8,1.4,1.6,LC("#e9b949"));fx("ring",x,.08,z,1.1,.5,4,[1,.85,.4],1);for(let i=0;i<10;i++)bit("coin",x,y,z,V.rnd(-2,2),V.rnd(3,5),V.rnd(-2,2),2.2,1.4,[1,1,1],6);V.shake(.9)}
  else{const c=SC((gm().EN[ti]||{}).col||"#ffffff");puff(V.PA,14,x,y,z,2.2,1.4,.5,.1,.03,c,1,2);burst(6,"chunk",x,y,z,1.6,2.4,.9,1,LC((gm().EN[ti]||{}).col||"#ffffff"))}
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
  V.M(cx,y,cz,0,-Math.PI/2,0,sc,sc*(1-pop*.5),sc,_R);
  K["tb"+L].push(_R,rr,1,1);
  const sw=Math.sin(t*3+rec.seed);
  if(L===1)V.put(K.tb1c,_R,-.36,.72,-.36,0,sw*.5-.3,0,1,1,1,oc.r,oc.g,oc.b);
  else if(L===2)V.put(K.tb2c,_R,.43,.6,0,0,0,sw*.06,1,1,1,oc.r,oc.g,oc.b);
  else{V.put(K.tb3c,_R,.445,.78,.2,0,0,sw*.06,1,1,1,oc.r,oc.g,oc.b);V.put(K.tb3c,_R,.445,.78,-.2,0,0,-sw*.06,1,1,1,oc.r,oc.g,oc.b);
    const gl=1.3+.5*Math.sin(t*3+rec.seed);V.put(K.tb3g,_R,.47,.58,0,0,t*1.5,0,1,1,1,oc.r*gl,oc.g*gl,oc.b*gl)}
  const cs=crewScale(L)*sc,top=y+V.TOWER_TOP[L-1]*sc*(1-pop*.5),back=rec.rc*.09,c=Math.cos(rec.yaw),s=Math.sin(rec.yaw);
  V.M(cx-c*back,top,cz+s*back,0,rec.yaw,rec.rc*.08,cs,cs*(1+Math.sin(t*2.2+rec.seed)*.025),cs,_T);
  const kt=K["c"+rec.t+"_"+L]||K["c0_"+L];kt.push(_T,rr,1,1);(K["c"+rec.t+"c"]||K.c0c).push(_T,oc.r,oc.g,oc.b);
  if(rec.t===0&&t-rec.fireT>.28)V.put(K.nock,_T,0,.22,-.035);
  else if(rec.t===1){const f=1+Math.sin(t*23+rec.seed)*.25;V.put(K.flame,_T,-.09,.31,-.25,0,t*3,0,f,f*1.2,f)}
  else if(rec.t===2){const b=Math.sin(t*2.4+rec.seed)*.04,p=1+Math.max(0,.4-(t-rec.fireT))*1.2;V.put(K["crys"+L],_T,.2,.54+b,0,0,t*1.6,0,p,p,p);
    const n=2+L;for(let i=0;i<n;i++){const a=t*2.2+i*Math.PI*2/n;V.put(K.shard,_T,.2+Math.cos(a)*.17,.54+b+Math.sin(a*1.3)*.05,Math.sin(a)*.17,0,a,0)}}
  else if(rec.t===3){const g=1+Math.max(0,.5-(t-rec.fireT))*2;V.put(K.lens,_T,.148,.275,-.05,0,0,0,1,1,1,g,g,g)}
  if(L===3){const tc=SC(gm().TW[rec.t]?gm().TW[rec.t].col:"#ffffff"),a=.22+.12*Math.sin(t*3+rec.seed);V.M(cx,rec.h+.09,cz,0,t*.5,0,1.6,1,1.6,_B);V.FX.decalA.push(_B,tc[0],tc[1],tc[2],a)}
  if(rage){V.M(cx,rec.h+.1,cz,0,0,0,1.35+.12*Math.sin(t*8+rec.seed),1,1.35+.12*Math.sin(t*8+rec.seed),_B);V.FX.ring.push(_B,1,.4,.6,.75)}
}
function trackAim(rec,S,dt){
  if(t-rec.fireT<.4)return;
  const st=gm().stat(rec.t,rec.l),r2=st.range*st.range,cx=rec.x+.5,cy=rec.y+.5;let best=null,bd=-1;
  for(const ev of enemies.values()){const dx=ev.tx-cx,dy=ev.ty-cy;if(dx*dx+dy*dy<=r2&&ev.vd>bd){bd=ev.vd;best=ev}}
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
    rec.l=tw.l;rec.o=tw.o;
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
  else{V.M(x,y+Math.abs(Math.sin(ph))*.1*s,z,0,yaw,0,s,s,s,_R);const e=gm().EN[ev.t]||{},cc=V.col(e.col||"#c0c0c0");K.mx.push(_R,cc.r*c[0],cc.g*c[1],cc.b*c[2])}
}
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
        if(A.isBoss(e.t)){V.shake(.5);fx("ring",P.x+.5,.08,P.z,1,.4,3,[1,.4,.35],1);say("v:spawn",{boss:true})}}}
    ev.t=e.t;ev.sl=e.sl;
    const sp=gm().spd(e)*speed;
    if(S.ph==="wave")ev.vd+=sp*dt;
    ev.vd=V.damp(ev.vd,e.d,5,dt);if(Math.abs(ev.vd-e.d)>1.2)ev.vd=e.d;
    if(e.hp<ev.hp-.01&&!A.demo&&ev.fl<.2&&!projs.some(p=>!p.done&&Math.abs(p.tx-ev.tx)<.6&&Math.abs(p.ty-ev.ty)<.6))ev.fl=.8;
    ev.hp=e.hp;ev.fl=Math.max(0,ev.fl-dt*6);ev.spawn=Math.min(1,ev.spawn+dt*3);
    ev.ph+=dt*(A.modelOf(e.t)==="kilat"?14:7)*speed*(e.sl>0?.45:1)*(S.ph==="wave"?1:.35);
    place(ev,dt);
    const s=sizeOf(e.t)*V.ease.back(ev.spawn)*(1+ev.fl*.14);
    drawMonster(ev,ev.x,ev.y,ev.z,ev.yaw,ev.ph,s,tint(ev));
    if(ev.sl>0&&Math.random()<dt*6)V.PN.add(ev.x+V.rnd(-.2,.2),ev.y+heightOf(e.t),ev.z+V.rnd(-.2,.2),0,-.2,0,.8,.05,.03,.9,.97,1,.9,0,.5);
    const mh=(gm().EN[e.t]||{hp:1}).hp*(S.wm||1),f=V.clamp(e.hp/mh,0,1);
    if(!A.isBoss(e.t)&&f<.999&&!A.demo)hpBar(ev.x,ev.y+heightOf(e.t)+.16,ev.z,f,Math.max(.42,sizeOf(e.t)*.8));
    if(A.modelOf(e.t)==="kilat"&&Math.random()<dt*20)V.PA.add(ev.x,ev.y+.32,ev.z,0,0,0,.3,.07,.02,1,.9,.5,.5,0,0);
  }
  for(const[id,ev]of enemies)if(!seen.has(id)){enemies.delete(id);
    const leak=ev.vd>g.PLEN-.7,delay=leak?0:landsIn(ev.tx,ev.ty);
    corpses.push({ev,at:t+delay,leak,sp:gm().spd({t:ev.t,sl:0,sf:1})*speed})}
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
let demo=null;
function demoState(){
  const g=V.geo,EN=gm().EN,T=[];let i=0;const taken=new Set();
  for(const k of g.PATH){if(i++%4!==1)continue;const[x,y]=k.split(",").map(Number);
    for(const[dx,dy]of[[0,-1],[0,1],[1,0],[-1,0]]){const nx=x+dx,ny=y+dy,kk=nx+","+ny;if(nx<0||ny<0||nx>=V.COLS||ny>=V.ROWS||g.PATH.has(kk)||taken.has(kk))continue;
      taken.add(kk);const n=T.length;T.push({x:nx,y:ny,t:n%4,l:1+(n*7)%3,o:n%4,cd:H(n,3)});break}
    if(T.length>=9)break}
  return{ph:"wave",sp:1,wm:1,rg:0,lv:20,w:1,P:[{c:0},{c:1},{c:2},{c:3}],T,E:[],nid:1,spawnCd:0,order:[0,1,0,2,1,0,0,2,1,3].filter(x=>x<EN.length)};
}
function demoTick(dt){
  const S=demo,g=V.geo,EN=gm().EN;
  S.spawnCd-=dt;if(S.spawnCd<=0&&S.E.length<12){const ti=S.order[S.nid%S.order.length];S.E.push({id:S.nid++,t:ti,d:0,hp:EN[ti].hp*.35,sl:0,sf:1});S.spawnCd=A.isBoss(ti)?2.6:.9}
  for(let i=S.E.length-1;i>=0;i--){const e=S.E[i];e.sl=Math.max(0,e.sl-dt);e.d+=gm().spd(e)*dt;if(e.d>=g.PLEN)S.E.splice(i,1)}
  for(const tw of S.T){tw.cd-=dt;if(tw.cd>0)continue;const st=gm().stat(tw.t,tw.l),r2=st.range*st.range;let best=null,bd=-1;
    for(const e of S.E){const p=gm().posIn(g,e.d),dx=p[0]-tw.x-.5,dy=p[1]-tw.y-.5;if(dx*dx+dy*dy<=r2&&e.d>bd){bd=e.d;best=e}}
    if(!best)continue;tw.cd=st.rate*1.3;const p=gm().posIn(g,best.d);A.onShot({t:tw.t,x1:tw.x+.5,y1:tw.y+.5,x2:p[0],y2:p[1]});
    for(const e of S.E){const q=gm().posIn(g,e.d);if(e===best||(st.splash&&Math.hypot(q[0]-p[0],q[1]-p[1])<=st.splash)){e.hp-=st.dmg;if(st.slow){e.sl=st.slowDur;e.sf=st.slow}}}
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

// ---------- per frame ----------
A.reset=()=>{towers.clear();enemies.clear();corpses=[];sold=[];projs=[];bits=[];fxs=[];later=[];lastPh=null;A.fresh=true;demo=null;V.PA&&V.PA.clear();V.PN&&V.PN.clear()};
A.fresh=true;
A.tick=(dt,mode)=>{
  t+=dt;
  for(let i=later.length-1;i>=0;i--)if(t>=later[i].at){const f=later[i].fn;later.splice(i,1);f()}
  let S=gm().S;
  const demoNow=mode!=="game"||!S;
  if(demoNow!==A.demo){A.reset()}  // switching between the menu battle and a real game starts clean
  A.demo=demoNow;
  if(A.demo){if(!demo||demo.g!==V.geo){A.reset();demo=demoState();demo.g=V.geo}demoTick(dt);S=demo}
  syncTowers(S,dt);syncEnemies(S,dt);A.fresh=false;corpsesTick(S,dt);if(!V.RM)birdsTick();projTick(dt);bitsTick(dt);fxTick(dt);lightTick(dt);
  if(!A.demo){fortTick(S,dt);if(S.ph==="win")fireworks(dt)}
  const occ=new Set();for(const r of towers.values())occ.add(r.x+","+r.y);V.decorTick(occ,dt);
  return S;
};
A.enemies=enemies;A.towers=towers;
A.bossOf=S=>{let b=null;for(const e of S.E)if(A.isBoss(e.t)&&(!b||e.d>b.d))b=e;return b};
})();
