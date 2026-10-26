// Tampilan, HUD layar penuh: menu permainan, layar penuh, layar tetap menyala, kartu menara terpilih
// yang melayang di samping menaranya, dan ketuk dua kali untuk membangun di layar sentuh.
// Milik sesi desain. Elemen HUD tetap diisi dan diperbarui game.js; file ini hanya mengatur letak dan
// perilakunya, dan membaca state lewat BB.game.
(function(){
"use strict";
const BB=window.BB,V=BB.V,THREE=window.THREE,$=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
if(!V||!THREE)return;
const H=V.hud={},gm=()=>BB.game;
let mode="menu",lastPointer="mouse",armed=null,autoFs=false,lock=null;

// ---------- the game menu ----------
const menu=$("#gameMenu"),info=$("#gmInfo");
function openMenu(){
  const g=gm(),S=g&&g.S;
  if(S&&info){const m=g.MAPS[g.mapOf(S.L)],b=document.createElement("b");b.textContent="Level "+S.L;info.textContent="";info.append(b," · "+(m?m.n:"")+" · gelombang "+S.w+"/"+S.mw)}
  menu.hidden=false;const b=menu.querySelector(".btn[data-close]");if(b)b.focus();
}
function closeMenu(){if(!menu.hidden){menu.hidden=true;const b=$("#btnMenu");if(b&&mode==="game")b.focus()}}
$("#btnMenu").addEventListener("click",openMenu);
menu.addEventListener("click",e=>{if(e.target===menu||e.target.closest("[data-close]"))closeMenu()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!menu.hidden){closeMenu();e.stopPropagation()}},true);

// ---------- full screen where the browser allows it, and a screen that stays awake while playing ----------
const de=document.documentElement;
const fsOn=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
const fsOk=!!((de.requestFullscreen||de.webkitRequestFullscreen)&&(document.fullscreenEnabled||document.webkitFullscreenEnabled));
function enterFs(){if(!fsOk||fsOn())return;try{const r=(de.requestFullscreen||de.webkitRequestFullscreen).call(de,{navigationUI:"hide"});if(r&&r.catch)r.catch(()=>{})}catch(e){}}
function exitFs(){if(!fsOn())return;try{const r=(document.exitFullscreen||document.webkitExitFullscreen).call(document);if(r&&r.catch)r.catch(()=>{})}catch(e){}}
function fsUi(){for(const b of $$("[data-fs]")){b.hidden=!fsOk;b.setAttribute("aria-pressed",String(fsOn()));if(!b.querySelector("svg"))b.textContent=fsOn()?"Keluar dari layar penuh":"Layar penuh"}}
for(const b of $$("[data-fs]"))b.addEventListener("click",()=>{autoFs=false;if(fsOn())exitFs();else enterFs()});
document.addEventListener("fullscreenchange",fsUi);document.addEventListener("webkitfullscreenchange",fsUi);fsUi();
async function wake(on){
  try{if(on&&!lock&&navigator.wakeLock&&document.visibilityState==="visible"){lock=await navigator.wakeLock.request("screen");lock.addEventListener("release",()=>{lock=null})}
    else if(!on&&lock){const l=lock;lock=null;await l.release()}}catch(e){lock=null}
}
document.addEventListener("visibilitychange",()=>{if(mode==="game")wake(document.visibilityState==="visible")});
document.addEventListener("pointerdown",e=>{lastPointer=e.pointerType||"mouse"},true);
// starting a game from a touch screen goes full screen, like an installed game; back in the menu it leaves again
document.addEventListener("click",e=>{
  if(e.target.closest&&e.target.closest("#btnSolo,#btnHost,#btnJoin,#openList button")&&lastPointer==="touch"&&fsOk&&!fsOn()){autoFs=true;enterFs()}
},true);

// ---------- touch: the first tap on a free tile shows the tower's ghost and range, a second tap builds ----------
const board=$("#cvWrap");
board.addEventListener("pointerdown",e=>{
  if(mode!=="game"||e.pointerType!=="touch")return;
  const g=gm(),p=BB.view.pick(e.clientX,e.clientY);
  if(p&&V.A&&V.A.tap)V.A.tap(p.x,p.y);
  if(!g.S||g.selType==null){armed=null;return}
  // the logic answers taps on towers, the road or without enough gold itself
  if(!p||g.towerAt(p.x,p.y)>=0||!g.canBuild(p.x,p.y)||g.myGold()<g.TW[g.selType].cost){armed=null;return}
  if(armed&&armed.x===p.x&&armed.y===p.y&&armed.t===g.selType){armed=null;return}   // second tap: let the logic build
  armed={x:p.x,y:p.y,t:g.selType};e.stopImmediatePropagation();
  board.dispatchEvent(new PointerEvent("pointermove",{clientX:e.clientX,clientY:e.clientY,bubbles:true,pointerType:"touch"}));
},true);
// a lifted finger keeps the preview where it was
board.addEventListener("pointerleave",e=>{if(e.pointerType==="touch")e.stopImmediatePropagation()},true);
// closing the tower card is the same as Esc for the logic
document.addEventListener("click",e=>{if(e.target.closest&&e.target.closest("[data-unselect]"))document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))});

// ---------- per frame: speed label, hint, the floating tower card ----------
const box=$("#selBox"),hintEl=$("#hudHint"),spd=$("#btnSpeed"),_v=new THREE.Vector3();
function hint(t){if(!t){if(!hintEl.hidden)hintEl.hidden=true;return}if(hintEl.textContent!==t)hintEl.textContent=t;if(hintEl.hidden)hintEl.hidden=false}
function placeCard(S,g,W,Ht){
  const sx=g.selXY,ti=g.towerAt(sx.x,sx.y);if(ti<0)return;
  const L=Math.min(3,Math.max(1,S.T[ti].l)),x0=sx.x+.5-V.HX,z0=sx.y+.5-V.HZ,y0=V.groundAt(sx.x+.5,sx.y+.5);
  _v.set(x0,y0+V.TOWER_TOP[L-1]+.85,z0).project(V.cam);const px=(_v.x+1)/2*W,top=(1-_v.y)/2*Ht;
  _v.set(x0,y0,z0).project(V.cam);const foot=(1-_v.y)/2*Ht;
  const F=V.free,bw=box.offsetWidth,bh=box.offsetHeight,m=8;
  let y=top-bh-14,below=false;if(y<F.t+m){y=foot+18;below=true}
  y=Math.max(F.t+m,Math.min(Ht-F.b-bh-m,y));
  const x=Math.max(F.l+m,Math.min(W-F.r-bw-m,px-bw/2));
  box.style.transform="translate3d("+x.toFixed(1)+"px,"+y.toFixed(1)+"px,0)";
  box.classList.toggle("below",below);box.style.setProperty("--ax",Math.max(18,Math.min(bw-18,px-x)).toFixed(1)+"px");
}
H.show=m=>{
  mode=m;armed=null;closeMenu();hint(null);
  if(m==="game")wake(true);else{wake(false);if(autoFs){autoFs=false;exitFs()}}
};
H.tick=(dt,S,W,Ht)=>{
  if(mode!=="game"||!S)return;
  const g=gm(),v=S.sp+"×";if(spd.dataset.sp!==v)spd.dataset.sp=v;
  if(armed&&(g.selType!==armed.t||!g.canBuild(armed.x,armed.y)))armed=null;
  const tw=g.selType!=null?g.TW[g.selType]:null;
  hint(tw&&lastPointer==="touch"?(armed?"Ketuk sekali lagi untuk membangun "+tw.n+" ("+tw.cost+" emas)":"Ketuk petak kosong untuk menaruh "+tw.n):null);
  if(!box.hidden&&g.selXY)placeCard(S,g,W,Ht);
};
})();
