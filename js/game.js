// Benteng Bersama: logika game (data, simulasi, multiplayer, progres pemain, panel DOM).
// Milik sesi logika. Tampilan 3D, efek dan suara ada di js/view/ dan js/audio.js; logika
// menghubunginya hanya lewat BB.emit(...) dan BB.view.*. Kontraknya ada di KOLABORASI.md.
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// ---------- game data ----------
const COLS=20, ROWS=12, LIVES=20, MAXP=4;
const PCOL=["#f0b545","#5fb7e8","#e57aa8","#8fd16a"];
const TW=[
  {n:"Panah", cost:50, range:2.6,dmg:12,rate:.45,col:"#efe0b0",ds:"Cepat, murah"},
  {n:"Meriam",cost:90, range:2.3,dmg:26,rate:1.25,splash:1.0,col:"#e09a62",ds:"Ledakan area"},
  {n:"Es",    cost:70, range:2.2,dmg:5, rate:.9,splash:.75,slow:.5,slowDur:1.6,col:"#9fd8f0",ds:"Memperlambat"},
  {n:"Jitu",  cost:125,range:5,  dmg:80,rate:2.1,col:"#d6a0f0",ds:"Jarak jauh"}
];
const EN=[
  {n:"Lendir",hp:40, spd:1.4, rw:5, r:.27,col:"#8fd16a",leak:1},
  {n:"Kilat", hp:24, spd:2.6, rw:4, r:.21,col:"#f5e07a",leak:1},
  {n:"Kura",  hp:170,spd:.8,  rw:12,r:.35,col:"#b08865",leak:2},
  {n:"Raja",  hp:1100,spd:.55,rw:90,r:.45,col:"#e5625a",leak:5}
];
function stat(t,l){const b=TW[t],k=l-1;return{dmg:b.dmg*Math.pow(1.65,k),range:b.range+.35*k,rate:b.rate*Math.pow(.88,k),splash:b.splash||0,slow:b.slow?Math.max(.25,b.slow-.08*k):0,slowDur:b.slowDur||0}}
const upCost=(t,l)=>Math.round(TW[t].cost*.75*l);

// path layouts in tile coords; enemies walk the tile centres. Levels cycle through the maps.
const MAPS=[
  {n:"Lembah Hijau",p:[[-1,2],[4,2],[4,9],[9,9],[9,3],[15,3],[15,8],[20,8]]},
  {n:"Bukit Kembar",p:[[-1,6],[3,6],[3,1],[8,1],[8,10],[13,10],[13,5],[17,5],[17,2],[20,2]]},
  {n:"Rawa Berliku",p:[[-1,10],[5,10],[5,6],[2,6],[2,2],[10,2],[10,8],[14,8],[14,4],[18,4],[18,9],[20,9]]},
  {n:"Ular Raksasa",p:[[-1,1],[16,1],[16,4],[3,4],[3,7],[16,7],[16,10],[20,10]]}
];
let MAPI=-1,WPI,WP,SEG,PLEN,PATH,EXIT;
// geometry of one map, computed once; the view reads it too (BB.game.geo) so both agree on the road
function buildGeo(i){
  const WPI=MAPS[i].p,WP=WPI.map(([x,y])=>[x+.5,y+.5]),SEG=[];let PLEN=0;
  for(let j=0;j<WP.length-1;j++){const a=WP[j],b=WP[j+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);SEG.push({a,b,l});PLEN+=l}
  const PATH=new Set();
  for(let j=0;j<WPI.length-1;j++){let[x,y]=WPI[j];const[x2,y2]=WPI[j+1];const dx=Math.sign(x2-x),dy=Math.sign(y2-y);
    while(true){if(x>=0&&x<COLS&&y>=0&&y<ROWS)PATH.add(x+","+y);if(x===x2&&y===y2)break;x+=dx;y+=dy}}
  return{i,WPI,WP,SEG,PLEN,PATH,EXIT:WP[WP.length-1][1]};
}
const GEO=MAPS.map((m,i)=>buildGeo(i));
function setMap(i){
  if(i===MAPI)return false;MAPI=i;
  ({WPI,WP,SEG,PLEN,PATH,EXIT}=GEO[i]);
  return true;
}
function posIn(g,d){for(const s of g.SEG){if(d<=s.l){const f=d/s.l;return[s.a[0]+(s.b[0]-s.a[0])*f,s.a[1]+(s.b[1]-s.a[1])*f]}d-=s.l}const e=g.WP[g.WP.length-1];return[e[0],e[1]]}
function posAt(d){return posIn(GEO[MAPI],d)}
setMap(0);

// ---------- levels: more waves, tougher and more crowded enemies as the level number climbs ----------
const MAXL=100;
const levelWaves=L=>Math.min(30,5+Math.floor((L-1)/4));
const levelMul=L=>1+(L-1)*.045;
const levelGold=L=>200+Math.floor((L-1)/5)*15;
const levelRw=L=>1+(L-1)*.03;
const mapOf=L=>(L-1)%MAPS.length;
const bossCount=(n,L)=>Math.min(5,Math.max(1,Math.ceil(L/25))+(n%10===0?1:0));

const WC={};
function waveList(n,L){
  const key=L+":"+n;if(WC[key])return WC[key];
  const e=n+Math.floor((L-1)/3),list=[],cnt=Math.min(60,6+Math.floor(n*1.8)+Math.floor(L/6)),g=Math.max(.3,1-e*.02);
  for(let i=0;i<cnt;i++){let t=0;if(e>=3&&i%3===1)t=1;if(e>=5&&i%5===4)t=2;if(e>=12&&i%4===2)t=2;list.push([t,(t===1?.45:t===2?1.1:.7)*g])}
  if(n%5===0||n>=levelWaves(L))for(let b=0;b<bossCount(n,L);b++)list.push([3,2.5]);
  return WC[key]=list;
}

// helpers: bought with gems or won from challenges, the daily claim and events
const HELP=[
  {id:"meteor",n:"Hujan Meteor",ds:"Hantam semua musuh di peta",price:40,col:"#ff8a4c",ic:"M"},
  {id:"freeze",n:"Badai Es",ds:"Bekukan semua musuh 4 detik",price:30,col:"#9fd8f0",ic:"E"},
  {id:"gold",n:"Kantong Emas",ds:"+150 emas untukmu",price:25,col:"#f0b545",ic:"$"},
  {id:"repair",n:"Tukang Benteng",ds:"+5 nyawa benteng",price:35,col:"#7fcf72",ic:"+"},
  {id:"rage",n:"Genderang Perang",ds:"Damage semua menara +50% selama 15 detik",price:30,col:"#e57aa8",ic:"!"}
];

// ---------- state ----------
let room=null, gr=null, unsubs=[], roomCode="";
let S=null, isHost=false, myPeer=null, mode="";
let wantHost=false, joinTimer=0, hostGoneTimer=0, lastBc=0, lastLobbyPres=0;
let pendF=[];
let selType=null, selXY=null, hover=null;

const myName=()=>($("#nameIn").value.trim().slice(0,14)||"Pemain");
try{$("#nameIn").value=localStorage.getItem("bb-name")||""}catch(e){}
if(!$("#nameIn").value)$("#nameIn").value="Pemain "+(10+Math.floor(Math.random()*90));
$("#nameIn").addEventListener("change",()=>{try{localStorage.setItem("bb-name",myName())}catch(e){}
  if(room)room.presence({nm:myName()}).catch(()=>{});if(gr)gr.presence({nm:myName()}).catch(()=>{})});

function newState(multi,me,L){
  L=Math.min(MAXL,Math.max(1,L|0||1));
  return{ph:multi?"lobby":"build",L,mw:levelWaves(L),w:0,lv:LIVES,cd:20,si:0,st:0,wm:1,sp:1,rg:0,h:me,nid:1,
    P:multi?[]:[{p:me,n:myName(),c:0,g:levelGold(L),k:0,off:false}],T:[],E:[]};
}
const mySlot=()=>S?S.P.findIndex(p=>p.p===myPeer&&!p.off):-1;
const towerAt=(x,y)=>S?S.T.findIndex(t=>t.x===x&&t.y===y):-1;
const canBuild=(x,y)=>x>=0&&x<COLS&&y>=0&&y<ROWS&&!PATH.has(x+","+y)&&towerAt(x,y)<0;
const activeCount=()=>S.P.filter(p=>!p.off).length;

// ---------- simulation (host only) ----------
function startWave(){
  S.w++;S.si=0;S.st=0;S.ph="wave";
  const n=Math.max(1,activeCount()),k=S.w-1;
  S.wm=levelMul(S.L)*(1+.14*k+.007*k*k)*(1+.4*(n-1));
}
function addFx(ti,ex,ey){
  const t=S.T[ti];if(!t)return;
  shotFx(t.t,t.x+.5,t.y+.5,ex,ey);
  if(gr&&pendF.length<40)pendF.push([ti,Math.round(ex*10),Math.round(ey*10)]);
}
function deathFx(t,x,y){fxDeath(t,x,y);if(gr&&pendF.length<40)pendF.push([-1-t,Math.round(x*10),Math.round(y*10)])}
function hit(e,s,o){
  if(e.hp<=0)return;e.hp-=s.dmg;e.o=o;
  if(s.slow){if(e.sl<=0||s.slow<e.sf)e.sf=s.slow;e.sl=Math.max(e.sl,s.slowDur)}
}
function sim(dt){
  if(S.ph==="build"){S.cd-=dt;if(S.cd<=0)startWave();return}
  if(S.ph!=="wave")return;
  if(S.rg>0)S.rg=Math.max(0,S.rg-dt);
  const L=waveList(S.w,S.L);
  S.st-=dt;
  while(S.st<=0&&S.si<L.length){const[t,g]=L[S.si++];const hp=EN[t].hp*S.wm;S.E.push({id:S.nid++,t,d:0,hp,sl:0,sf:1,o:-1});S.st+=g}
  for(let i=S.E.length-1;i>=0;i--){const e=S.E[i];const f=e.sl>0?e.sf:1;e.sl=Math.max(0,e.sl-dt);e.d+=EN[e.t].spd*f*dt;
    if(e.d>=PLEN){S.lv-=EN[e.t].leak;S.E.splice(i,1)}}
  if(S.lv<=0){S.lv=0;S.ph="over";S.E=[];return}
  const pos=S.E.map(e=>posAt(e.d));
  for(let ti=0;ti<S.T.length;ti++){
    const tw=S.T[ti];tw.cd=(tw.cd||0)-dt;if(tw.cd>0)continue;
    const s=stat(tw.t,tw.l);if(S.rg>0)s.dmg*=1.5;const cx=tw.x+.5,cy=tw.y+.5,r2=s.range*s.range;
    let bi=-1,bd=-1;
    for(let i=0;i<S.E.length;i++){const e=S.E[i];if(e.hp<=0)continue;const p=pos[i],dx=p[0]-cx,dy=p[1]-cy;if(dx*dx+dy*dy<=r2&&e.d>bd){bd=e.d;bi=i}}
    if(bi<0)continue;
    tw.cd=s.rate;
    const[ex,ey]=pos[bi];
    if(s.splash){for(let i=0;i<S.E.length;i++){const p=pos[i];if(Math.hypot(p[0]-ex,p[1]-ey)<=s.splash)hit(S.E[i],s,tw.o)}}
    else hit(S.E[bi],s,tw.o);
    addFx(ti,ex,ey);
  }
  for(let i=S.E.length-1;i>=0;i--){const e=S.E[i];if(e.hp>0)continue;
    const p=S.P[e.o];if(p){p.g+=Math.round(EN[e.t].rw*(1+S.w*.04)*levelRw(S.L));p.k++}
    deathFx(e.t,pos[i][0],pos[i][1]);S.E.splice(i,1)}
  if(S.si>=L.length&&S.E.length===0){
    const bonus=20+S.w*3;
    S.P.forEach(p=>{if(!p.off)p.g+=bonus});
    if(S.w>=S.mw){S.ph="win";S.rg=0}
    else{S.ph="build";S.cd=12;toast("Gelombang "+S.w+" selesai. Bonus +"+bonus+" emas untuk semua.")}
  }
}
function handle(c,slot,local){
  if(!S||!c||typeof c!=="object")return;
  const x=c.x|0,y=c.y|0;
  if(c.a==="b"){
    const t=c.t|0;if(slot<0||t<0||t>3||S.ph==="lobby"||S.ph==="over"||S.ph==="win"||!canBuild(x,y)||S.T.length>=120)return;
    const p=S.P[slot];if(p.g<TW[t].cost)return;
    p.g-=TW[t].cost;S.T.push({x,y,t,l:1,o:slot,sp:TW[t].cost,cd:0});
  }else if(c.a==="u"){
    const i=towerAt(x,y);if(slot<0||i<0)return;const tw=S.T[i];if(tw.l>=3)return;
    const cost=upCost(tw.t,tw.l),p=S.P[slot];if(p.g<cost)return;
    p.g-=cost;tw.l++;tw.sp+=cost;
  }else if(c.a==="s"){
    const i=towerAt(x,y);if(slot<0||i<0||S.T[i].o!==slot)return;
    S.P[slot].g+=Math.floor(S.T[i].sp*.7);S.T.splice(i,1);
  }else if(c.a==="n"){if(slot>=0&&S.ph==="build")S.cd=0}
  else if(c.a==="sp"){if(slot>=0)S.sp=S.sp===1?2:1}
  else if(c.a==="re"){if(slot>=0&&(S.ph==="over"||S.ph==="win"))resetGame()}
  else if(c.a==="nx"){if(local&&S.ph==="win"&&S.L<MAXL){S.L++;resetGame()}}
  else if(c.a==="h"){const k=c.k|0;if(slot>=0&&k>=0&&k<HELP.length&&(S.ph==="build"||S.ph==="wave"))applyHelp(k,slot)}
  else if(c.a==="go"){if(local&&S.ph==="lobby"&&activeCount()>0){S.ph="build";S.cd=20}}
}
function resetGame(){S.T=[];S.E=[];S.w=0;S.lv=LIVES;S.ph="build";S.cd=20;S.sp=1;S.rg=0;S.mw=levelWaves(S.L);
  S.P.forEach(p=>{p.g=mode==="solo"?levelGold(S.L):Math.round(levelGold(S.L)*.8);p.k=0})}
function applyHelp(k,slot){
  if(k===0){for(const e of S.E)hit(e,{dmg:EN[e.t].hp*S.wm*(e.t===3?.2:.6)},slot)}
  else if(k===1){for(const e of S.E){e.sl=4;e.sf=.05}}
  else if(k===2){S.P[slot].g+=150}
  else if(k===3){S.lv=Math.min(99,S.lv+5)}
  else if(k===4){S.rg=15}
  helperFx(k,slot);
  if(gr)pendF.push([-10-k,slot,0]);
}

// ---------- wire format ----------
function encode(){
  return{ph:S.ph,L:S.L,mw:S.mw,rg:+S.rg.toFixed(1),w:S.w,lv:S.lv,cd:+S.cd.toFixed(1),si:S.si,st:+S.st.toFixed(2),wm:+S.wm.toFixed(3),sp:S.sp,h:S.h,nid:S.nid,
    P:S.P.map(p=>[p.p,p.n,p.c,Math.floor(p.g),p.k,p.off?1:0]),
    T:S.T.map(t=>[t.x,t.y,t.t,t.l,t.o,t.sp]),
    E:S.E.map(e=>[e.id,e.t,Math.round(e.d*100),Math.ceil(e.hp),e.sl>0?Math.round(e.sf*100):100,Math.round(e.sl*10),e.o]),
    F:pendF};
}
const num=(v,d)=>{v=Number(v);return Number.isFinite(v)?v:d};
const int=(v,lo,hi)=>Math.min(hi,Math.max(lo,Math.round(num(v,lo))));
function decode(D){
  if(!D||typeof D!=="object"||!Array.isArray(D.P)||!Array.isArray(D.T)||!Array.isArray(D.E))return null;
  const ph=["lobby","build","wave","over","win"].includes(D.ph)?D.ph:"build";
  return{ph,L:int(D.L,1,MAXL),mw:int(D.mw,1,30),rg:num(D.rg,0),w:int(D.w,0,9999),lv:int(D.lv,0,99),cd:num(D.cd,0),si:int(D.si,0,9999),st:num(D.st,0),wm:num(D.wm,1),sp:D.sp===2?2:1,h:String(D.h),nid:int(D.nid,1,1e9),
    P:D.P.slice(0,12).filter(Array.isArray).map(a=>({p:String(a[0]),n:String(a[1]).slice(0,14),c:int(a[2],0,3),g:int(a[3],0,1e9),k:int(a[4],0,1e9),off:!!a[5]})),
    T:D.T.slice(0,120).filter(Array.isArray).map(a=>({x:int(a[0],0,COLS-1),y:int(a[1],0,ROWS-1),t:int(a[2],0,3),l:int(a[3],1,3),o:int(a[4],0,11),sp:int(a[5],0,1e6),cd:0})),
    E:D.E.slice(0,300).filter(Array.isArray).map(a=>({id:int(a[0],0,1e9),t:int(a[1],0,3),d:num(a[2],0)/100,hp:num(a[3],1),sf:num(a[4],100)/100,sl:num(a[5],0)/10,o:int(a[6],-1,11)})),
    F:Array.isArray(D.F)?D.F.slice(0,40).filter(Array.isArray):[]};
}

// ---------- player progress: levels, gems, helpers, challenges, daily claim, events ----------
const ACH=[
  {id:"kills",n:"Pemburu",ds:"Kalahkan {t} musuh",stat:p=>p.kills,t:[100,500,2000,10000],r:[20,40,80,150]},
  {id:"level",n:"Penjelajah",ds:"Tamatkan level {t}",stat:p=>maxCleared(p),t:[5,15,30,60,100],r:[30,50,80,120,300]},
  {id:"stars",n:"Bintang Benteng",ds:"Kumpulkan {t} bintang",stat:p=>totalStars(p),t:[15,60,150,300],r:[25,50,100,200]},
  {id:"towers",n:"Arsitek",ds:"Bangun {t} menara",stat:p=>p.towers,t:[25,100,400],r:[15,40,90]},
  {id:"bosses",n:"Penakluk Raja",ds:"Kalahkan {t} Raja",stat:p=>p.bosses,t:[3,15,50],r:[25,60,120]},
  {id:"used",n:"Ahli Strategi",ds:"Pakai {t} bantuan",stat:p=>p.used,t:[5,25,100],r:[15,35,80]}
];
const DAILY=[{gems:20},{items:{gold:1}},{gems:30},{items:{freeze:1}},{gems:40},{items:{meteor:1}},{gems:80,items:{repair:1}}];
const PROFILE0=()=>({v:1,gems:60,items:{meteor:1,freeze:1,gold:1,repair:0,rage:0},stars:{},kills:0,towers:0,bosses:0,used:0,wins:0,ach:{},daily:{last:"",streak:0},claimed:{}});
const totalStars=p=>Object.values(p.stars).reduce((a,b)=>a+b,0);
const maxCleared=p=>{let m=0;for(const k in p.stars)if(p.stars[k]>0)m=Math.max(m,+k);return m};
const unlocked=L=>L===1||(prof.stars[L-1]||0)>0;
const starsFor=lv=>lv>=18?3:lv>=10?2:1;
const starsHtml=n=>'<span class="stars">'+"★".repeat(n)+"☆".repeat(3-n)+"</span>";
const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
let prof=PROFILE0(),profRef=null,profReady=false,saveTimer=0,saveDue=0,saving=false,dbEvents=[],storeNote="",selLevel=1,lastWin=null,menuTab="level";

function normProfile(d){
  const p=PROFILE0();if(!d||typeof d!=="object")return p;
  p.gems=int(d.gems,0,1e7);
  for(const h of HELP)p.items[h.id]=int(d.items&&d.items[h.id],0,999);
  if(d.stars&&typeof d.stars==="object")for(const k in d.stars){const L=int(k,0,MAXL);if(L>=1)p.stars[L]=int(d.stars[k],0,3)}
  for(const f of ["kills","towers","bosses","used","wins"])p[f]=int(d[f],0,1e9);
  if(d.ach&&typeof d.ach==="object")for(const a of ACH)p.ach[a.id]=int(d.ach[a.id],0,a.t.length);
  if(d.daily&&typeof d.daily==="object"){p.daily.last=String(d.daily.last||"").slice(0,10);p.daily.streak=int(d.daily.streak,0,7)}
  if(d.claimed&&typeof d.claimed==="object")for(const k of Object.keys(d.claimed).slice(-80))p.claimed[k]=1;
  return p;
}
function lsLoad(){try{const s=localStorage.getItem("bb-profile");return s?JSON.parse(s):null}catch(e){return null}}
async function initProfile(){
  let user=null,db=null,id=null;
  try{if(window.claude&&window.claude.use)[user,db]=await Promise.all([window.claude.use("user"),window.claude.use("db")])}catch(e){}
  try{id=user?await user.id():null}catch(e){}
  if(db&&id){
    try{profRef=db.doc("data/users/"+id+"/profile");const snap=await profRef.get();prof=normProfile(snap.exists?snap.data():lsLoad()||PROFILE0())}catch(e){profRef=null}
  }
  if(db){try{db.collection("events").onSnapshot(q=>{dbEvents=q.docs.map(d=>normEvent(d.id,d.data())).filter(Boolean);renderMeta()},()=>{})}catch(e){}}
  if(!profRef){const d=lsLoad();if(d)prof=normProfile(d);storeNote="Progres disimpan di browser ini saja. Buka lewat claude.ai sambil masuk akun supaya tersimpan di akunmu."}
  profReady=true;selLevel=Math.min(MAXL,maxCleared(prof)+1);renderMeta();
}
// writes are coalesced: progress during play waits a few seconds, purchases and claims go out fast
function saveProfile(delay){
  const due=Date.now()+(delay==null?4000:delay);
  if(saveTimer&&due>=saveDue)return;
  clearTimeout(saveTimer);saveDue=due;saveTimer=setTimeout(flushProfile,Math.max(0,due-Date.now()));
}
async function flushProfile(){
  saveTimer=0;if(saving){saveProfile(800);return}
  saving=true;const body=JSON.parse(JSON.stringify(prof));
  try{localStorage.setItem("bb-profile",JSON.stringify(body))}catch(e){}
  if(profRef){try{await profRef.set(body)}catch(e){if(e&&e.code==="invalid_argument"){profRef=null;storeNote="Akunmu tidak bisa menyimpan data di halaman ini, jadi progres hanya tersimpan di browser ini.";renderMeta()}}}
  saving=false;
}
window.addEventListener("pagehide",()=>{if(saveTimer){clearTimeout(saveTimer);flushProfile()}});

function normEvent(id,d){
  if(!d||typeof d!=="object")return null;
  const items={};if(d.items&&typeof d.items==="object")for(const h of HELP)if(d.items[h.id])items[h.id]=int(d.items[h.id],0,20);
  return{key:"db-"+String(id).slice(0,40),title:String(d.title||"Event").slice(0,40),desc:String(d.desc||"").slice(0,160),
    start:String(d.start||"").slice(0,10),end:String(d.end||"").slice(0,10),gems:int(d.gems,0,1000),items,x2:d.x2===true};
}
function activeEvents(){
  const now=new Date(),today=ymd(now),day=now.getDay(),ev=[];
  if(day===6||day===0){const sat=new Date(now);if(day===0)sat.setDate(now.getDate()-1);
    ev.push({key:"wk-"+ymd(sat),title:"Festival Akhir Pekan",desc:"Setiap Sabtu dan Minggu. Permata dari menamatkan level jadi 2×.",gems:50,items:{meteor:1},x2:true,until:"hari Minggu"})}
  if(now.getDate()<=3)ev.push({key:"bb-"+today.slice(0,7),title:"Pesta Awal Bulan",desc:"Tanggal 1–3 setiap bulan.",gems:30,items:{rage:2},until:"tanggal 3"});
  for(const e of dbEvents)if(e.start<=today&&(!e.end||today<=e.end))ev.push(Object.assign({until:e.end},e));
  return ev;
}
function grant(r){prof.gems+=r.gems||0;for(const k in (r.items||{}))if(k in prof.items)prof.items[k]+=r.items[k]}
const helpName=id=>(HELP.find(h=>h.id===id)||{n:id}).n;
const rewardText=r=>[r.gems?r.gems+" permata":""].concat(Object.keys(r.items||{}).map(k=>r.items[k]+"× "+helpName(k))).filter(Boolean).join(" + ");
function dailyState(){
  const now=new Date(),today=ymd(now),y=new Date(now);y.setDate(now.getDate()-1);
  const can=prof.daily.last!==today,cont=prof.daily.last===ymd(y);
  return{can,today,next:can?(cont?prof.daily.streak%7+1:1):prof.daily.streak};
}
function claimDaily(){
  if(!profReady)return;const s=dailyState();if(!s.can)return;
  const r=DAILY[s.next-1];grant(r);prof.daily={last:s.today,streak:s.next};saveProfile(200);
  toast("Hadiah hari ke-"+s.next+": "+rewardText(r));renderMeta();
}
function claimEvent(key){
  const e=activeEvents().find(x=>x.key===key);if(!e||prof.claimed[key])return;
  grant(e);prof.claimed[key]=1;const ks=Object.keys(prof.claimed);if(ks.length>80)delete prof.claimed[ks[0]];
  saveProfile(200);toast(e.title+": "+rewardText(e));renderMeta();
}
function achState(a){const tier=prof.ach[a.id]||0,done=tier>=a.t.length,target=a.t[Math.min(tier,a.t.length-1)],val=a.stat(prof);return{tier,done,target,val,ready:!done&&val>=target}}
function claimAch(id){
  const a=ACH.find(x=>x.id===id),s=achState(a);if(!s.ready)return;
  prof.gems+=a.r[s.tier];prof.ach[id]=s.tier+1;saveProfile(200);toast(a.n+": +"+a.r[s.tier]+" permata");renderMeta();
}
function buyHelp(k){
  const h=HELP[k];if(!profReady||prof.gems<h.price)return;
  prof.gems-=h.price;prof.items[h.id]++;saveProfile(300);toast("Membeli "+h.n+".");renderMeta();
}
function onLevelWin(L,st){
  const prev=prof.stars[L]||0;let gems=(prev?3:10+Math.floor(L/2))+5*Math.max(0,st-prev);
  const x2=activeEvents().some(e=>e.x2);if(x2)gems*=2;
  prof.stars[L]=Math.max(prev,st);prof.wins++;prof.gems+=gems;saveProfile(300);
  lastWin={L,st,gems,x2};if(L<MAXL&&selLevel===L)selLevel=L+1;renderMeta();
}
function useHelp(k){
  const h=HELP[k];if(!S||mySlot()<0)return;
  if(S.ph!=="build"&&S.ph!=="wave"){toast("Bantuan hanya bisa dipakai saat permainan berjalan.");return}
  if((prof.items[h.id]||0)<=0){toast("Kamu belum punya "+h.n+". Beli di Toko atau klaim dari Hadiah.");return}
  prof.items[h.id]--;prof.used++;saveProfile(500);ui(true);
  const p=sendCmd({a:"h",k});
  if(p&&p.catch)p.catch(()=>{prof.items[h.id]++;prof.used--;saveProfile(500);ui(true)});
}

function itemRow(icon,col,title,sub,btn){return '<div class="item"><span class="ic" style="background:'+col+'">'+icon+'</span><span class="tx"><b>'+title+'</b><span>'+sub+'</span></span>'+btn+'</div>'}
function renderMeta(){
  $("#gemCount").textContent=prof.gems;
  $("#saveNote").hidden=!storeNote;$("#saveNote").textContent=storeNote;
  // levels
  const g=$("#lvGrid");
  if(!profReady){g.innerHTML="";$("#lvInfo").textContent="Memuat progres…"}
  else{
    let h="";for(let L=1;L<=MAXL;L++){const st=prof.stars[L]||0,ok=unlocked(L);
      h+='<button type="button" class="lv'+(L===selLevel?" sel":"")+(L%5===0?" boss":"")+'" data-l="'+L+'"'+(ok?"":" disabled")+' aria-label="Level '+L+'">'+L+'<small>'+(st?"★".repeat(st):"")+'</small></button>'}
    if(g.dataset.k!==h){g.dataset.k=h;g.innerHTML=h;const s=g.querySelector(".sel");if(s&&s.scrollIntoView&&!g.dataset.scrolled){g.dataset.scrolled=1;g.scrollTop=Math.max(0,s.offsetTop-g.offsetTop-90)}}
    const L=selLevel,best=prof.stars[L]||0;
    $("#lvInfo").innerHTML='<b>Level '+L+'</b> · '+MAPS[mapOf(L)].n+' · '+levelWaves(L)+' gelombang · Raja di gelombang terakhir'+
      '<br><span class="hint">'+(best?"Terbaik "+starsHtml(best):"Belum ditamatkan")+(L>1?' · Musuh +'+Math.round((levelMul(L)-1)*100)+'% lebih kuat dari level 1':'')+' · Emas awal '+levelGold(L)+'</span>';
  }
  // shop
  $("#shopList").innerHTML=HELP.map((h,i)=>itemRow(h.ic,h.col,h.n+' <span class="hint">(punya '+prof.items[h.id]+')</span>',h.ds,
    '<button class="btn" data-buy="'+i+'"'+(prof.gems<h.price||!profReady?" disabled":"")+'>'+h.price+' permata</button>')).join("");
  // challenges
  let anyAch=false;
  $("#achList").innerHTML=ACH.map(a=>{const s=achState(a);if(s.ready)anyAch=true;
    const pct=s.done?100:Math.min(100,Math.round(s.val/s.target*100));
    return itemRow(String(s.tier+1>a.t.length?a.t.length:s.tier+1),"var(--accent)",a.n+' <span class="hint">tingkat '+Math.min(s.tier+1,a.t.length)+'/'+a.t.length+'</span>',
      (s.done?"Semua tingkat selesai":a.ds.replace("{t}",s.target)+" · "+Math.min(s.val,s.target)+"/"+s.target)+'<span class="bar"><i style="width:'+pct+'%"></i></span>',
      s.done?'<span class="hint">Tuntas</span>':'<button class="'+(s.ready?"btn":"ghost")+'" data-ach="'+a.id+'"'+(s.ready?"":" disabled")+'>+'+a.r[s.tier]+' permata</button>')}).join("");
  // daily + events
  const d=dailyState();
  $("#dailyStrip").innerHTML=DAILY.map((r,i)=>{const n=i+1,got=d.can?n<d.next:n<=d.next,now=d.can&&n===d.next;
    return '<div class="day'+(got?" got":"")+(now?" now":"")+'"><b>Hari '+n+'</b>'+esc(rewardText(r))+'</div>'}).join("");
  $("#btnDaily").disabled=!d.can||!profReady;$("#btnDaily").textContent=d.can?"Klaim hadiah hari ke-"+d.next:"Sudah diklaim. Kembali besok.";
  const ev=activeEvents();let anyEv=false;
  $("#eventList").innerHTML=ev.map(e=>{const got=!!prof.claimed[e.key];if(!got)anyEv=true;
    return itemRow("★","var(--gem)",esc(e.title),esc(e.desc)+(e.until?" Berlaku sampai "+esc(e.until)+".":"")+" Hadiah: "+esc(rewardText(e)),
      '<button class="'+(got?"ghost":"btn")+'" data-ev="'+esc(e.key)+'"'+(got||!profReady?" disabled":"")+'>'+(got?"Sudah diklaim":"Klaim")+'</button>')}).join("")||
    '<p class="hint">Belum ada event aktif. Festival Akhir Pekan muncul setiap Sabtu–Minggu, Pesta Awal Bulan setiap tanggal 1–3.</p>';
  $("#dotAch").hidden=!anyAch;$("#dotGift").hidden=!(profReady&&(d.can||anyEv));
}
function setTab(t){menuTab=t;document.querySelectorAll(".tab").forEach(b=>{const on=b.dataset.tab===t;b.classList.toggle("on",on);b.setAttribute("aria-selected",on)});
  ["level","shop","ach","gift"].forEach(k=>$("#pane-"+k).hidden=k!==t)}

// ---------- networking ----------
(async()=>{
  try{room=window.claude&&window.claude.use?await window.claude.use("room"):null}catch(e){room=null}
  if(room){
    unsubsLobby();
    room.presence({nm:myName()}).catch(()=>{});
  }
  $("#netNote").hidden=!!room;
  $("#btnHost").disabled=!room;$("#btnJoin").disabled=!room;
})();
function unsubsLobby(){room.onPeers(renderOpen,()=>{})}
function renderOpen(){
  if(!room)return;
  const list=room.peers().filter(p=>!p.sameTab&&p.presence&&p.presence.g&&typeof p.presence.g==="object");
  const ul=$("#openList");ul.textContent="";
  for(const p of list){
    const g=p.presence.g,code=String(g.c||"").replace(/[^a-z0-9]/g,"").slice(0,8);if(!code)continue;
    const li=document.createElement("li");const sp=document.createElement("span");
    sp.textContent=code+" · host "+String(g.h||"?").slice(0,14)+" · level "+int(g.L,1,MAXL)+" · "+int(g.n,0,4)+"/4 pemain"+(g.w?" · gelombang "+int(g.w,0,9999):"");
    const b=document.createElement("button");b.className="ghost";b.textContent="Gabung";b.onclick=()=>enterRoom(code,false);
    li.append(sp,b);ul.append(li);
  }
  $("#openEmpty").hidden=ul.children.length>0;
}
function randCode(){const a="abcdefghjkmnpqrstuvwxyz23456789";let s="";for(let i=0;i<5;i++)s+=a[Math.floor(Math.random()*a.length)];return s}

async function enterRoom(code,host){
  if(!room)return;
  code=String(code).toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8);
  if(!code){toast("Tulis kode room dulu.");return}
  try{localStorage.setItem("bb-name",myName())}catch(e){}
  try{gr=await room.join("td-"+code)}catch(e){toast("Gagal masuk room ("+(e&&e.code||"error")+"). Coba lagi.");return}
  mode="multi";roomCode=code;isHost=false;S=null;myPeer=null;wantHost=host;clearFx();pendF=[];
  gr.presence({nm:myName()}).catch(()=>{});
  unsubs.push(gr.on("state",onState,()=>{}),gr.on("cmd",onCmd,()=>{}),gr.onPeers(onGamePeers,()=>{}));
  showGame();
  if(!host){clearTimeout(joinTimer);joinTimer=setTimeout(()=>{
    if(gr&&!S&&myPeer){const others=gr.peers().filter(p=>!p.sameTab&&p.kind==="viewer");
      if(!others.length){wantHost=true;tryHost();toast("Room masih kosong, kamu jadi host-nya.")}}},5000)}
}
function tryHost(){if(wantHost&&myPeer&&!S){S=newState(true,myPeer,selLevel);isHost=true;wantHost=false;syncPlayers()}}
function onGamePeers(ch){
  const me=ch.peers.find(p=>p.sameTab);if(me)myPeer=me.peer;
  tryHost();
  if(isHost)syncPlayers();else checkHostAlive();
}
function syncPlayers(){
  if(!gr||!S)return;
  const peers=gr.peers().filter(p=>p.kind==="viewer"),present=new Set(peers.map(p=>p.peer));
  S.P.forEach(p=>{if(!present.has(p.p))p.off=true});
  for(const pr of peers){
    const nm=String(pr.presence&&pr.presence.nm||"").trim().slice(0,14);if(!nm)continue;
    let slot=S.P.find(p=>p.p===pr.peer);
    if(slot){if(slot.off&&activeCount()>=MAXP)continue;slot.off=false;slot.n=nm;continue}
    if(activeCount()>=MAXP)continue;
    slot=S.P.find(p=>p.off&&p.n===nm&&!present.has(p.p));
    if(slot){slot.p=pr.peer;slot.off=false;continue}
    if(S.P.length>=12)continue;
    const used=new Set(S.P.filter(p=>!p.off).map(p=>p.c));let c=0;while(used.has(c))c++;
    S.P.push({p:pr.peer,n:nm,c,g:Math.round(levelGold(S.L)*.8),k:0,off:false});
  }
}
function checkHostAlive(){
  if(!gr||!S||isHost)return;
  if(gr.peers().some(p=>p.peer===S.h))return;
  if(hostGoneTimer)return;
  hostGoneTimer=setTimeout(()=>{hostGoneTimer=0;
    if(!gr||!S||isHost)return;
    const peers=gr.peers().filter(p=>p.kind==="viewer");if(peers.some(p=>p.peer===S.h))return;
    const present=new Set(peers.map(p=>p.peer));
    let c=S.P.filter(p=>!p.off&&p.p!==S.h&&present.has(p.p)).map(p=>p.p).sort();
    if(!c.length)c=[...present].sort();
    if(c[0]===myPeer){isHost=true;S.h=myPeer;S.F=[];syncPlayers();toast("Host keluar. Kamu sekarang memegang permainan.")}
  },2000);
}
function onState(msg){
  if(msg.sameTab||!msg.data||msg.data.h!==msg.peer)return;
  if(isHost){if(myPeer&&msg.peer<myPeer){isHost=false}else return}
  const ns=decode(msg.data);if(!ns)return;
  clearTimeout(joinTimer);wantHost=false;
  for(const f of ns.F){const ti=int(f[0],-20,119),x=num(f[1],0)/10,y=num(f[2],0)/10;
    if(ti<=-10){if(-10-ti<HELP.length)helperFx(-10-ti,int(f[1],0,11),ns)}
    else if(ti<0){if(ti>=-4)fxDeath(-1-ti,x,y)}else{const t=ns.T[ti];if(t)shotFx(t.t,t.x+.5,t.y+.5,x,y)}}
  S=ns;
}
function onCmd(msg){if(!isHost||!S||msg.sameTab)return;handle(msg.data,S.P.findIndex(p=>p.p===msg.peer&&!p.off),false)}
function sendCmd(c){
  if(!S)return;
  if(isHost){handle(c,mySlot(),true);return}
  if(gr)return gr.emit("cmd",c).catch(e=>{if(e&&e.code==="not_permitted")toast("Aksesmu hanya untuk menonton. Minta pemilik memberi akses Contributor.");if(c.a==="h")throw e});
}
function broadcast(){
  const D=encode();let s=JSON.stringify(D);
  if(s.length>3800){D.F=[];s=JSON.stringify(D)}
  while(s.length>3800&&D.E.length){D.E.length=Math.floor(D.E.length*.8);s=JSON.stringify(D)}
  pendF=[];
  gr.emit("state",D).catch(e=>{if(e&&e.code==="not_permitted")toast("Aksesmu tidak cukup untuk menjadi host. Minta akses Contributor.")});
}
function lobbyPresence(){
  if(!room)return;
  if(gr&&isHost&&S)room.presence({nm:myName(),g:{c:roomCode,h:myName(),n:activeCount(),w:S.w,L:S.L}}).catch(()=>{});
  else room.presence({nm:myName(),g:null}).catch(()=>{});
}

function startSolo(){
  try{localStorage.setItem("bb-name",myName())}catch(e){}
  mode="solo";myPeer="solo";S=newState(false,"solo",selLevel);isHost=true;clearFx();showGame();
}
function leave(){
  if(gr){const g=gr;gr=null;unsubs.forEach(u=>{try{u()}catch(e){}});unsubs=[];g.leave().catch(()=>{})}
  clearTimeout(joinTimer);clearTimeout(hostGoneTimer);hostGoneTimer=0;
  S=null;isHost=false;wantHost=false;mode="";selType=null;selXY=null;
  lobbyPresence();
  $("#scrGame").hidden=true;$("#scrMenu").hidden=false;$("#stats").hidden=true;$("#btnLeave").hidden=true;
  setBanner("");BB.view.show("menu");renderMeta();
}
function showGame(){
  $("#scrMenu").hidden=true;$("#scrGame").hidden=false;$("#stats").hidden=false;$("#btnLeave").hidden=false;
  $("#hRoomWrap").hidden=mode!=="multi";$("#hRoom").textContent=roomCode;
  selType=null;selXY=null;BB.view.show("game");ui(true);
}

// ---------- hooks to the view: it draws and plays these, the logic never waits on it ----------
function shotFx(t,x1,y1,x2,y2){BB.emit("shot",{t,x1,y1,x2,y2})}
function fxDeath(t,x,y){
  if(t===3&&S&&mySlot()>=0){prof.bosses++;saveProfile()}
  const w=S?S.w:1;BB.emit("death",{t,x,y,gold:Math.round(EN[t].rw*(1+w*.04)*levelRw(S?S.L:1))});
}
function helperFx(k,slot,st){
  st=st||S;if(!st)return;toast(((st.P[slot]||{}).n||"Seseorang")+" memakai "+HELP[k].n+"!");
  BB.emit("help",{k,slot,S:st});
}
let prevPh=null,prevK=null,prevW=null,known={};
function clearFx(){prevPh=null;prevK=null;prevW=null;lastWin=null;known={};BB.view.reset()}
// progress counters that come from watching the state: towers built, kills, level wins
function observe(){
  if(!S){prevW=null;return}
  setMap(mapOf(S.L));
  const slot=mySlot(),seen={};
  for(const tw of S.T){const k=tw.x+","+tw.y;seen[k]=1;
    if(known[k]!==tw.t){known[k]=tw.t;if(prevW!==null&&slot>=0&&tw.o===slot){prof.towers++;saveProfile()}}}
  for(const k in known)if(!seen[k])delete known[k];
  if(slot>=0){const k=S.P[slot].k;if(prevK!==null&&k>prevK){prof.kills+=k-prevK;saveProfile()}prevK=k}else prevK=null;
  if(prevPh!==null&&prevPh!==S.ph&&S.ph==="win"&&slot>=0)onLevelWin(S.L,starsFor(S.lv));
  prevPh=S.ph;prevW=S.w;
}

// ---------- UI ----------
const myGold=()=>{const i=mySlot();return i>=0?S.P[i].g:0};
function buildShop(){
  const el=$("#shop");el.textContent="";
  TW.forEach((t,i)=>{
    const b=document.createElement("button");b.className="tw";b.id="tw"+i;b.type="button";
    const ic=document.createElement("canvas");ic.width=64;ic.height=64;BB.view.icon(ic,"tower",i);
    b.innerHTML='<span class="nm">'+t.n+' <kbd>'+(i+1)+'</kbd></span><span class="ds">'+t.ds+'</span><span class="cost">'+t.cost+' emas</span>';
    b.prepend(ic);b.onclick=()=>{selType=selType===i?null:i;selXY=null;ui(true)};el.append(b);
  });
}
let bannerKey="",lastUi="";
function setBanner(key,html,bind){
  const b=$("#banner");if(key===bannerKey)return;bannerKey=key;
  if(!key){b.hidden=true;b.innerHTML="";return}
  b.hidden=false;b.innerHTML=html;if(bind)bind(b);
}
function ui(force){
  if(!S){
    if(mode==="multi")setBanner("conn",'<p>Menghubungkan ke room <span class="code">'+esc(roomCode)+'</span>… Kalau room ini masih kosong, kamu akan jadi host-nya.</p>');
    return;
  }
  const slot=mySlot(),me=S.P[slot];
  $("#hLevel").textContent=S.L;$("#hWave").textContent=S.w+"/"+S.mw;$("#hLives").textContent=S.lv;$("#hGold").textContent=me?me.g:"–";
  // banner
  if(S.ph==="lobby"){
    const n=activeCount();
    setBanner("lobby"+isHost+n+S.L,'<p>Level <b>'+S.L+'</b> ('+MAPS[mapOf(S.L)].n+', '+S.mw+' gelombang). Bagikan kode <span class="code">'+esc(roomCode)+'</span> ke teman. Mereka buka halaman ini dan pilih “Gabung”. '+n+'/4 pemain siap.</p>'+
      (isHost?'<button class="btn" id="bGo">Mulai permainan</button>':'<p class="hint">Menunggu host memulai.</p>'),
      b=>{const g=b.querySelector("#bGo");if(g)g.onclick=()=>sendCmd({a:"go"})});
  }else if(S.ph==="over"){
    setBanner("over"+S.L+S.w+(slot>=0),'<p><b>Benteng runtuh di gelombang '+S.w+'/'+S.mw+' (level '+S.L+').</b> Semua menara dibongkar kalau kalian main lagi. Coba pakai bantuan dari Toko.</p>'+(slot>=0?'<button class="btn" id="bRe">Ulangi level</button>':''),
      b=>{const r=b.querySelector("#bRe");if(r)r.onclick=()=>sendCmd({a:"re"})});
  }else if(S.ph==="win"){
    const w=lastWin&&lastWin.L===S.L?lastWin:null;
    setBanner("win"+S.L+(w?w.gems:"")+isHost+(slot>=0),'<p><b>Level '+S.L+' tamat!</b> '+(w?starsHtml(w.st)+' · +'+w.gems+' permata'+(w.x2?' (2× event)':''):'')+'</p>'+
      (slot>=0?'<button class="ghost" id="bRe">Ulangi</button>':'')+(isHost&&S.L<MAXL?'<button class="btn" id="bNx">Lanjut ke level '+(S.L+1)+'</button>':'')+(!isHost?'<p class="hint">Host memilih level berikutnya.</p>':''),
      b=>{const r=b.querySelector("#bRe");if(r)r.onclick=()=>sendCmd({a:"re"});const n=b.querySelector("#bNx");if(n)n.onclick=()=>sendCmd({a:"nx"})});
  }else if(mode==="multi"&&slot<0){
    setBanner("spec",'<p>Room penuh (4 pemain). Kamu menonton.</p>');
  }else setBanner("");
  // wave box
  const L=S.w?waveList(S.w,S.L):[];
  $("#waveTxt").innerHTML=S.ph==="build"?'Gelombang <b>'+(S.w+1)+'/'+S.mw+'</b> datang dalam <b>'+Math.ceil(Math.max(0,S.cd))+'</b> detik'+((S.w+1)%5===0||S.w+1>=S.mw?' · <b style="color:var(--danger)">ada Raja</b>':''):
    S.ph==="win"?'Level '+S.L+' tamat':
    S.ph==="wave"?'Gelombang <b>'+S.w+'</b> berjalan · <b>'+(S.E.length+Math.max(0,L.length-S.si))+'</b> musuh tersisa':
    S.ph==="lobby"?'Menunggu pemain di lobi':'Permainan selesai';
  $("#btnNext").disabled=S.ph!=="build"||slot<0;
  $("#btnSpeed").textContent="Kecepatan "+S.sp+"×";$("#btnSpeed").disabled=slot<0;
  // shop
  const gold=me?me.g:0;
  TW.forEach((t,i)=>{const b=$("#tw"+i);b.classList.toggle("on",selType===i);b.classList.toggle("poor",gold<t.cost)});
  // helpers
  const hk=JSON.stringify([HELP.map(h=>prof.items[h.id]),slot,S.ph]);
  if(force||$("#helpBar").dataset.k!==hk){$("#helpBar").dataset.k=hk;const live=slot>=0&&(S.ph==="build"||S.ph==="wave");
    $("#helpBar").innerHTML=HELP.map((h,i)=>'<button type="button" class="hp" data-help="'+i+'" title="'+h.ds+'"'+(live&&prof.items[h.id]>0?"":" disabled")+'><span class="ic" style="background:'+h.col+'">'+h.ic+'</span><span>'+h.n+'</span><b>×'+prof.items[h.id]+'</b></button>').join("")}
  // selected tower
  const ti=selXY?towerAt(selXY.x,selXY.y):-1;
  $("#selBox").hidden=ti<0;
  if(ti>=0){const tw=S.T[ti],s=stat(tw.t,tw.l),own=S.P[tw.o];
    $("#selTitle").textContent=TW[tw.t].n+" · level "+tw.l;
    const kv=[["Pemilik",own?own.n:"?"],["Damage",Math.round(s.dmg)],["Jangkauan",s.range.toFixed(1)+" petak"],["Tembakan",(1/s.rate).toFixed(1)+"/detik"]];
    if(s.splash)kv.push(["Area",s.splash.toFixed(2)+" petak"]);if(s.slow)kv.push(["Lambat",Math.round((1-s.slow)*100)+"%"]);
    const key=JSON.stringify(kv);if(force||$("#selKv").dataset.k!==key){$("#selKv").dataset.k=key;$("#selKv").innerHTML=kv.map(([k,v])=>"<dt>"+k+"</dt><dd>"+esc(v)+"</dd>").join("")}
    const uc=tw.l<3?upCost(tw.t,tw.l):0;
    $("#btnUp").textContent=tw.l<3?"Tingkatkan ("+uc+" emas)":"Level maksimal";$("#btnUp").disabled=tw.l>=3||gold<uc||slot<0;
    $("#btnSell").textContent="Jual (+"+Math.floor(tw.sp*.7)+")";$("#btnSell").hidden=tw.o!==slot||slot<0;
  }
  // players
  const pk=JSON.stringify(S.P.map(p=>[p.n,p.c,p.g,p.k,p.off,p.p===S.h,p.p===myPeer]));
  if(force||pk!==lastUi){lastUi=pk;
    $("#plist").innerHTML=S.P.map(p=>'<li class="'+(p.off?"off":"")+'"><span class="dot" style="background:'+PCOL[p.c]+'"></span><span class="nmc">'+esc(p.n)+
      (p.p===myPeer?'<span class="tag">kamu</span>':'')+(mode==="multi"&&p.p===S.h?'<span class="tag">host</span>':'')+(p.off?'<span class="tag">keluar</span>':'')+
      '</span><span>'+p.g+' emas · '+p.k+' kill</span></li>').join("")||'<li><span></span><span class="nmc">Belum ada pemain</span><span></span></li>';}
}

function toast(msg){const d=document.createElement("div");d.textContent=msg;$("#toast").append(d);setTimeout(()=>d.remove(),3200)}

// ---------- input ----------
// the view turns a pointer position into a board tile (null off the board)
const board=$("#cvWrap"),tileOf=ev=>BB.view.pick(ev.clientX,ev.clientY);
board.addEventListener("pointermove",ev=>{hover=tileOf(ev)});
board.addEventListener("pointerleave",()=>{hover=null});
board.addEventListener("contextmenu",ev=>{ev.preventDefault();selType=null;selXY=null;ui(true)});
board.addEventListener("pointerdown",ev=>{
  if(!S||ev.button===2)return;const p=tileOf(ev);hover=p;
  if(!p){selXY=null;ui(true);return}
  const ti=towerAt(p.x,p.y);
  if(ti>=0){selXY=p;selType=null}
  else if(selType!==null){
    if(!canBuild(p.x,p.y))toast("Tidak bisa membangun di jalan.");
    else if(myGold()<TW[selType].cost)toast("Emas belum cukup untuk "+TW[selType].n+".");
    else sendCmd({a:"b",x:p.x,y:p.y,t:selType});
  }else selXY=null;
  ui(true);
});
document.addEventListener("keydown",ev=>{
  if(!S||ev.target.tagName==="INPUT")return;
  if(ev.key>="1"&&ev.key<="4"){const i=+ev.key-1;selType=selType===i?null:i;selXY=null}
  else if(ev.key==="Escape"){selType=null;selXY=null}
  else if((ev.key==="u"||ev.key==="U")&&selXY)sendCmd({a:"u",x:selXY.x,y:selXY.y});
  else if((ev.key==="s"||ev.key==="S")&&selXY){sendCmd({a:"s",x:selXY.x,y:selXY.y});selXY=null}
  else if(ev.key===" "){ev.preventDefault();sendCmd({a:"n"})}
  else return;
  ui(true);
});
$("#btnUp").onclick=()=>{if(selXY)sendCmd({a:"u",x:selXY.x,y:selXY.y})};
$("#btnSell").onclick=()=>{if(selXY){sendCmd({a:"s",x:selXY.x,y:selXY.y});selXY=null;ui(true)}};
$("#btnNext").onclick=()=>sendCmd({a:"n"});
$("#btnSpeed").onclick=()=>sendCmd({a:"sp"});
$("#btnSolo").onclick=startSolo;
$("#btnHost").onclick=()=>enterRoom(randCode(),true);
$("#btnJoin").onclick=()=>enterRoom($("#codeIn").value,false);
$("#codeIn").addEventListener("keydown",e=>{if(e.key==="Enter")enterRoom($("#codeIn").value,false)});
$("#btnLeave").onclick=leave;
$("#helpBar").addEventListener("click",e=>{const b=e.target.closest("[data-help]");if(b)useHelp(+b.dataset.help)});
$("#lvGrid").addEventListener("click",e=>{const b=e.target.closest("[data-l]");if(b&&!b.disabled){selLevel=+b.dataset.l;renderMeta()}});
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
$("#shopList").addEventListener("click",e=>{const b=e.target.closest("[data-buy]");if(b)buyHelp(+b.dataset.buy)});
$("#achList").addEventListener("click",e=>{const b=e.target.closest("[data-ach]");if(b)claimAch(b.dataset.ach)});
$("#eventList").addEventListener("click",e=>{const b=e.target.closest("[data-ev]");if(b)claimEvent(b.dataset.ev)});
$("#btnDaily").onclick=claimDaily;

// ---------- read-only window for the view (view3d.js, audio.js); see KOLABORASI.md ----------
BB.game={
  COLS,ROWS,LIVES,MAXL,PCOL,TW,EN,MAPS,HELP,
  stat,mapOf,levelWaves,waveList,posIn,canBuild,towerAt,mySlot,myGold,
  geo:i=>GEO[i==null?MAPI:i],
  spd:e=>EN[e.t].spd*(e.sl>0?e.sf:1),
  get S(){return S},get selType(){return selType},get selXY(){return selXY},get hover(){return hover},
  get selLevel(){return selLevel},get mode(){return mode},get isHost(){return isHost}
};

// ---------- loop ----------
let last=performance.now(),acc=0,uiT=0;
function frame(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(S){
    if(isHost){acc+=dt;const step=1/30;while(acc>=step){for(let k=0;k<S.sp;k++)sim(step);acc-=step}
      if(gr&&now-lastBc>125){lastBc=now;broadcast()}
      if(gr&&now-lastLobbyPres>2500){lastLobbyPres=now;lobbyPresence()}}
    else{const k=dt*S.sp;
      if(S.ph==="wave")for(const e of S.E){e.d+=EN[e.t].spd*(e.sl>0?e.sf:1)*k;e.sl=Math.max(0,e.sl-k)}
      if(S.ph==="build")S.cd=Math.max(0,S.cd-k)}
  }
  const inGame=!$("#scrGame").hidden;
  if(inGame)observe();
  BB.view.frame(dt);
  if(inGame){uiT+=dt;if(uiT>.2){uiT=0;ui(false)}}
  requestAnimationFrame(frame);
}
BB.view.init();buildShop();renderMeta();initProfile();BB.view.show("menu");
requestAnimationFrame(frame);
})();
