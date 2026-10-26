// Suara: efek dan musik dibuat langsung dengan WebAudio, tanpa file. Milik sesi desain.
// Mendengar event "v:*" dari tampilan 3D (waktunya sudah pas dengan efek di layar) dan
// memosisikan suara kiri-kanan sesuai letaknya di peta.
(function(){
"use strict";
const BB=window.BB,$=s=>document.querySelector(s);
const AU={c:null,sfx:null,mus:null,noise:null,sOn:true,mOn:true,last:{}};
try{const p=JSON.parse(localStorage.getItem("bb-audio")||"{}");if(p.s===false)AU.sOn=false;if(p.m===false)AU.mOn=false}catch(e){}
function init(){
  if(AU.c){if(AU.c.state==="suspended")AU.c.resume().catch(()=>{});return}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  try{AU.c=new C()}catch(e){return}
  const comp=AU.c.createDynamicsCompressor();comp.connect(AU.c.destination);
  AU.sfx=AU.c.createGain();AU.sfx.gain.value=AU.sOn?.6:0;AU.sfx.connect(comp);
  AU.mus=AU.c.createGain();AU.mus.gain.value=AU.mOn?.2:0;AU.mus.connect(comp);
  const n=AU.c.sampleRate,b=AU.c.createBuffer(1,n,n),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;AU.noise=b;
}
function save(){
  try{localStorage.setItem("bb-audio",JSON.stringify({s:AU.sOn,m:AU.mOn}))}catch(e){}
  if(AU.c){AU.sfx.gain.setTargetAtTime(AU.sOn?.6:0,AU.c.currentTime,.05);AU.mus.gain.setTargetAtTime(AU.mOn?.2:0,AU.c.currentTime,.1)}
  for(const b of document.querySelectorAll("[data-audio]"))b.setAttribute("aria-pressed",String(b.dataset.audio==="sfx"?AU.sOn:AU.mOn));
}
// one voice: oscillator or filtered noise, an envelope, and an optional stereo position (-1..1)
let pan=0;
function out(o){
  let dest=o.dest||AU.sfx;
  if(!o.dest&&pan&&AU.c.createStereoPanner){const p=AU.c.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));p.connect(dest);dest=p}
  return dest;
}
function env(g,t0,vol,att,dur){g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+att);g.gain.exponentialRampToValueAtTime(.0001,t0+Math.max(att+.01,dur))}
function tone(f,dur,o){
  o=o||{};const c=AU.c;if(!c)return;const t0=o.at!=null?o.at:c.currentTime+(o.delay||0);
  const os=c.createOscillator(),g=c.createGain();os.type=o.type||"sine";os.frequency.setValueAtTime(f,t0);
  if(o.slide)os.frequency.exponentialRampToValueAtTime(Math.max(20,f+o.slide),t0+dur);
  env(g,t0,o.vol||.2,o.att||.005,dur);
  let n=os;if(o.lp){const fl=c.createBiquadFilter();fl.type="lowpass";fl.frequency.value=o.lp;os.connect(fl);n=fl}
  n.connect(g);g.connect(out(o));os.start(t0);os.stop(t0+dur+.05);
}
function noise(dur,o){
  o=o||{};const c=AU.c;if(!c)return;const t0=o.at!=null?o.at:c.currentTime+(o.delay||0),f=o.f||2000;
  const src=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();src.buffer=AU.noise;src.loop=true;
  fl.type=o.ft||"lowpass";fl.frequency.setValueAtTime(f,t0);if(o.fs)fl.frequency.exponentialRampToValueAtTime(Math.max(40,f+o.fs),t0+dur);fl.Q.value=o.q||1;
  env(g,t0,o.vol||.2,o.att||.004,dur);
  src.connect(fl);fl.connect(g);g.connect(out(o));src.start(t0,Math.random()*.5);src.stop(t0+dur+.05);
}
const SND={
  arrow(){noise(.09,{ft:"bandpass",f:2600,fs:1400,q:1.5,vol:.12});tone(700,.06,{type:"triangle",slide:-300,vol:.04})},
  cannon(){tone(150,.22,{slide:-95,vol:.3});noise(.18,{f:1300,fs:-1000,vol:.2})},
  ice(){tone(1500,.18,{slide:900,vol:.06});tone(2250,.22,{type:"triangle",slide:600,vol:.03,delay:.03})},
  snipe(){tone(2400,.16,{type:"sawtooth",slide:-2000,vol:.06,lp:5000});noise(.07,{ft:"highpass",f:3000,vol:.08})},
  tick(){noise(.03,{ft:"highpass",f:3500,vol:.05})},
  boom(){tone(80,.4,{slide:-45,vol:.36});noise(.45,{f:900,fs:-750,vol:.28})},
  bigboom(){tone(60,.7,{slide:-30,vol:.45});noise(.8,{f:700,fs:-600,vol:.35});noise(.3,{ft:"highpass",f:2500,vol:.08,delay:.05})},
  frost(){noise(.22,{ft:"highpass",f:4500,vol:.07});tone(3000,.1,{vol:.03,slide:-800})},
  zap(){noise(.06,{ft:"bandpass",f:5000,q:3,vol:.07})},
  splat(){noise(.12,{f:700,fs:-400,vol:.14});tone(320,.1,{slide:-180,vol:.1})},
  buzz(){tone(420,.12,{type:"sawtooth",slide:-260,vol:.04,lp:2000});noise(.06,{ft:"bandpass",f:1800,vol:.06})},
  crack(){noise(.15,{ft:"bandpass",f:1200,q:2,vol:.15});tone(200,.12,{type:"square",slide:-100,vol:.04,lp:900})},
  coin(){tone(1320,.07,{type:"square",vol:.022,lp:4000});tone(1760,.14,{type:"square",vol:.022,lp:4000,delay:.06})},
  bossdie(){SND.bigboom();[523,659,784,1047].forEach((f,i)=>tone(f,i===3?.6:.2,{type:"triangle",vol:.1,delay:.35+i*.12}))},
  build(){tone(220,.07,{type:"triangle",vol:.12,slide:-60});noise(.05,{f:1800,vol:.1});tone(260,.07,{type:"triangle",vol:.1,delay:.09,slide:-60});noise(.05,{f:1800,vol:.08,delay:.09})},
  up(){[523,659,784,1047].forEach((f,i)=>tone(f,.16,{type:"triangle",vol:.08,delay:i*.06}));noise(.4,{ft:"highpass",f:6000,vol:.03,delay:.2})},
  sell(){[988,784,659].forEach((f,i)=>tone(f,.1,{type:"square",vol:.03,lp:3000,delay:i*.06}))},
  horn(){tone(220,.7,{type:"sawtooth",vol:.08,lp:900,att:.08});tone(330,.8,{type:"sawtooth",vol:.06,lp:900,att:.08,delay:.25})},
  roar(){tone(110,1.1,{type:"sawtooth",slide:-60,vol:.12,lp:600,att:.1});noise(1,{f:500,fs:-300,vol:.18,att:.1})},
  leak(){tone(160,.35,{type:"square",slide:-80,vol:.08,lp:800});noise(.2,{f:600,vol:.12})},
  clear(){[523,659,784].forEach((f,i)=>tone(f,.2,{type:"triangle",vol:.09,delay:i*.09}));tone(1047,.45,{type:"triangle",vol:.09,delay:.27})},
  win(){[523,523,784,659,784,1047].forEach((f,i)=>tone(f,i===5?.8:.25,{type:"triangle",vol:.1,delay:i*.15}));tone(262,1.2,{type:"sawtooth",lp:700,vol:.05,delay:.75})},
  lose(){[392,349,311,262].forEach((f,i)=>tone(f,.5,{type:"triangle",vol:.09,delay:i*.24,slide:-12}));noise(.8,{f:400,fs:-250,vol:.12,delay:.9})},
  pop(){noise(.12,{ft:"bandpass",f:1800,q:.8,vol:.12});noise(.5,{ft:"highpass",f:5000,vol:.035,delay:.08})},
  meteor(){noise(.6,{ft:"bandpass",f:600,fs:900,q:.7,vol:.16,att:.2})},
  freeze(){noise(1,{ft:"highpass",f:3000,fs:3000,vol:.08,att:.05});[1568,2093,2637].forEach((f,i)=>tone(f,.6,{vol:.04,delay:i*.08}))},
  gold(){for(let i=0;i<8;i++)tone(1320+i*80,.08,{type:"square",vol:.02,lp:5000,delay:i*.05})},
  repair(){[392,523,659,784].forEach((f,i)=>tone(f,.25,{type:"triangle",vol:.07,delay:i*.08}))},
  rage(){for(let i=0;i<4;i++){tone(90,.18,{slide:-40,vol:.3,delay:i*.18});noise(.08,{f:900,vol:.1,delay:i*.18})}},
  click(){tone(900,.04,{type:"triangle",vol:.05})},
  wail(){tone(660,.55,{slide:-380,vol:.07,att:.03});tone(990,.45,{type:"triangle",slide:-600,vol:.03,att:.05,delay:.04})},
  clang(){tone(1250,.22,{type:"square",vol:.03,lp:5000,slide:-80});tone(1870,.3,{type:"triangle",vol:.04,slide:-120});noise(.05,{ft:"highpass",f:4000,vol:.08})},
  blorp(){tone(170,.28,{slide:280,vol:.14});noise(.16,{f:900,fs:-500,vol:.1,delay:.06})},
  dig(){noise(.55,{f:500,fs:-260,vol:.18,att:.05});tone(70,.42,{slide:-25,vol:.15})},
  emerge(){noise(.35,{f:1400,fs:-1000,vol:.2});tone(95,.3,{slide:-50,vol:.2})},
  thud(){tone(55,.55,{slide:-25,vol:.45});noise(.5,{f:600,fs:-450,vol:.3});noise(.8,{ft:"highpass",f:4500,vol:.06,delay:.08,att:.05})},
  flame(){noise(1.1,{ft:"bandpass",f:700,fs:500,q:.6,vol:.22,att:.12});tone(90,.9,{type:"sawtooth",vol:.05,lp:400,att:.1})}
};
// play with a minimum gap per sound so a busy wave never turns into noise
function play(k,gap,x){
  if(!AU.c||!AU.sOn)return;const now=AU.c.currentTime;
  if(AU.last[k]&&now-AU.last[k]<(gap||.04))return;AU.last[k]=now;
  pan=x==null?0:x/11;try{SND[k]()}catch(e){}pan=0;
}
const FIRE=["arrow","cannon","ice","snipe"],HIT={0:"tick",1:"boom",2:"frost",3:"zap",9:"bigboom"},DIE={lendir:"splat",kilat:"buzz",kura:"crack",hantu:"wail",perisai:"clang"};
const ABIL={summon:"blorp",burrow:"dig",emerge:"emerge",stomp:"thud",breath:"flame",enrage:"roar"};
BB.on("v:fire",d=>play(FIRE[d.k]||"arrow",[.05,.08,.07,.08][d.k]||.06,d.x));
BB.on("v:hit",d=>play(HIT[d.k]||"tick",d.k===9?.12:.08,d.x));
BB.on("v:die",d=>{play(d.boss?"bossdie":DIE[d.m]||"splat",d.boss?.3:.03,d.x);play("coin",.08,d.x)});
BB.on("v:build",d=>play("build",.1,d.x));BB.on("v:upgrade",d=>play("up",.1,d.x));BB.on("v:sell",d=>play("sell",.1,d.x));
BB.on("v:spawn",()=>play("roar",1));BB.on("v:wave",()=>play("horn",.5));BB.on("v:clear",()=>play("clear",.5));
BB.on("v:win",()=>play("win",1));BB.on("v:lose",()=>play("lose",1));BB.on("v:leak",()=>play("leak",.2));BB.on("v:firework",d=>play("pop",.15,d.x));
BB.on("v:help",d=>play(["meteor","freeze","gold","repair","rage"][d.k]||"click",.3));
BB.on("v:ability",d=>play(ABIL[d.k]||"horn",.3,d.x));BB.on("v:block",d=>play("clang",.09,d.x));

// background music: a small step sequencer per map theme, slower at night, darker in the eclipse,
// and busier while a wave runs or a boss walks
const THEME_MUS=[
  {bpm:96, root:60,sc:[0,2,4,7,9],      bass:[0,0,5,7],  lead:"triangle"},
  {bpm:76, root:62,sc:[0,2,4,6,7,9,11], bass:[0,4,5,0],  lead:"sine"},
  {bpm:84, root:57,sc:[0,3,5,7,10],     bass:[0,-2,-4,-2],lead:"triangle"},
  {bpm:90, root:57,sc:[0,1,4,5,7,8,10], bass:[0,0,1,0],  lead:"square"}
];
let musNext=0,musStep=0;
const mf=n=>440*Math.pow(2,(n-69)/12);
const hash=(x,y)=>{let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295};
function musTick(){
  const g=BB.game,S=g&&g.S;
  if(!AU.c||!AU.mOn||!S||$("#scrGame").hidden||AU.c.state!=="running"){musNext=0;return}
  const ti=Math.max(0,Math.min(3,Math.floor((S.L-1)/25))),M=THEME_MUS[g.mapOf(S.L)%THEME_MUS.length];
  const bpm=M.bpm*(ti===2?.85:ti===3?1.12:1),root=M.root-(ti===3?3:0),st=60/bpm/2,busy=S.ph==="wave",A=BB.V&&BB.V.A,boss=S.E.some(e=>A&&A.isBoss?A.isBoss(e.t):e.t===3);
  const now=AU.c.currentTime;if(musNext<now)musNext=now+.05;
  while(musNext<now+.3){
    const s=musStep%8,bar=Math.floor(musStep/8),rt=root+M.bass[bar%4],o={dest:AU.mus,at:musNext};
    if(s===0||s===4)tone(mf(rt-24),st*3.6,Object.assign({},o,{type:"triangle",vol:.16,lp:600}));
    const h=hash(bar%4*31+s,M.root);
    if(h<(busy?.75:.5)){const n=rt+M.sc[Math.floor(hash(s,bar%8)*M.sc.length)]+(h<.2?12:0);tone(mf(n),st*1.6,Object.assign({},o,{type:ti===2?"sine":M.lead,vol:.05,lp:2400,att:.01}))}
    if(busy){if(s%2)noise(.04,Object.assign({},o,{ft:"highpass",f:7000,vol:.04}));if(s===0||(boss&&s===4))tone(130,.18,Object.assign({},o,{slide:-90,vol:.22}))}
    musNext+=st;musStep++;
  }
}
setInterval(musTick,60);
["pointerdown","keydown"].forEach(ev=>document.addEventListener(ev,init,{passive:true}));
document.addEventListener("click",e=>{if(e.target.closest&&e.target.closest("button"))play("click",.03)});
window.addEventListener("DOMContentLoaded",()=>{
  for(const b of document.querySelectorAll("[data-audio]"))b.addEventListener("click",()=>{if(b.dataset.audio==="sfx")AU.sOn=!AU.sOn;else AU.mOn=!AU.mOn;save()});
  save();
});
})();
