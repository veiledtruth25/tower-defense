// Tampilan 3D, pengendali utama: BB.view (dipanggil game.js), renderer, kamera, overlay DOM,
// ikon dari model 3D, pemilihan petak dan kualitas adaptif. Milik sesi desain.
(function(){
"use strict";
const BB=window.BB,V=BB.V,THREE=window.THREE,$=s=>document.querySelector(s);
let ok=false,failed=false,mode="menu",canvas=null,mountEl=null,W=1,H=1,dpr=1,dprMax=1,shake=0,queue=[];
V.time=0;
V.shake=a=>{if(!V.RM)shake=Math.min(1.2,shake+a)};

function fail(msg){
  failed=true;
  for(const el of[$("#cvWrap"),$("#heroView")]){if(!el)continue;const d=document.createElement("div");d.className="nogl";d.textContent=msg;el.append(d)}
}

// ---------- camera: a framed board in game, a slow orbit around the island in the menu ----------
const cam={yaw:0,pitch:.98,dist:30,tx:0,ty:0,tz:.4,fov:32},goal=Object.assign({},cam);
const _p=new THREE.Vector3();
// In a game the HUD covers the canvas edges. V.free holds how many pixels it takes from each side; the
// board is fitted into what is left and the image is shifted (a lens shift) so it sits in the middle of it.
V.free={l:0,r:0,t:0,b:0};
function measureFree(){
  const f={l:0,r:0,t:0,b:0};
  if(mode==="game"&&mountEl){
    const c=mountEl.getBoundingClientRect(),rs=[];
    for(const el of document.querySelectorAll("#scrGame [data-hud]")){const r=el.getBoundingClientRect();if(r.width>1&&r.height>1)rs.push(r)}
    for(const r of rs){
      if(rs.some(o=>o!==r&&r.left>=o.left-1&&r.right<=o.right+1&&r.top>=o.top-1&&r.bottom<=o.bottom+1))continue;   // part of a bigger panel
      if(r.width>=r.height){if(r.top+r.height/2<c.top+c.height/2)f.t=Math.max(f.t,r.bottom-c.top);else f.b=Math.max(f.b,c.bottom-r.top)}
      else if(r.left+r.width/2<c.left+c.width/2)f.l=Math.max(f.l,r.right-c.left);else f.r=Math.max(f.r,c.right-r.left)}
    // never leave the board less than a third of the canvas
    if(f.l+f.r>W*.67){const k=W*.67/(f.l+f.r);f.l*=k;f.r*=k}if(f.t+f.b>H*.67){const k=H*.67/(f.t+f.b);f.t*=k;f.b*=k}
  }
  V.free=f;const st=document.documentElement.style;for(const k of["l","r","t","b"])st.setProperty("--f"+k,Math.round(f[k])+"px");
}
function place(c,dist,out){
  const cp=Math.cos(c.pitch);out.position.set(c.tx+Math.sin(c.yaw)*cp*dist,c.ty+Math.sin(c.pitch)*dist,c.tz+Math.cos(c.yaw)*cp*dist);
  out.fov=c.fov;out.aspect=W/H;out.updateProjectionMatrix();
  if(out===V.cam){const e=out.projectionMatrix.elements,F=V.free;e[8]=-(F.l-F.r)/W;e[9]=-(F.b-F.t)/H;out.projectionMatrixInverse.copy(out.projectionMatrix).invert()}
  out.lookAt(c.tx,c.ty,c.tz);out.updateMatrixWorld();
}
function fitPoints(){
  if(mode==="game"){const ex=V.castle?V.castle.z:0,en=V.portal?V.portal.z:0;
    return[[-V.HX-.3,0,-V.HZ-.3],[V.HX+.3,0,-V.HZ-.3],[-V.HX-.3,0,V.HZ+.25],[V.HX+.3,0,V.HZ+.25],[-V.HX-.3,1.1,-V.HZ-.3],[V.HX+.3,1.1,-V.HZ-.3],[V.HX+1.4,.3,ex],[-V.HX-1.9,.6,en]]}
  return[[V.X0,0,V.Z0],[V.X1,0,V.Z0],[V.X0,0,V.Z1],[V.X1,0,V.Z1],[V.X1-.8,3.6,V.Z0+1],[V.X0,-1.7,V.Z1],[V.X1,-1.7,V.Z1]];
}
const fitCam=new THREE.PerspectiveCamera();
function fitGoal(){
  const pts=fitPoints(),mx=mode==="game"?.025:.06,my=mode==="game"?.03:.08,F=V.free,fw=(W-F.l-F.r)/W,fh=(H-F.t-F.b)/H;let lo=4,hi=160;
  for(let i=0;i<24;i++){const mid=(lo+hi)/2;place(goal,mid,fitCam);
    const fits=pts.every(p=>{_p.set(p[0],p[1],p[2]).project(fitCam);return Math.abs(_p.x)<=fw-mx&&Math.abs(_p.y)<=fh-my&&_p.z<1});
    if(fits)hi=mid;else lo=mid}
  goal.dist=hi;
}
function setGoal(){
  // a portrait free area looks down the long side of the board, so tiles stay big enough to tap
  const F=V.free,fa=Math.max(1,W-F.l-F.r)/Math.max(1,H-F.t-F.b);
  if(mode==="game")Object.assign(goal,fa<.95?{yaw:Math.PI/2,pitch:1.05,tx:0,ty:0,tz:0,fov:34}:{yaw:0,pitch:fa<1.3?1.08:.98,tx:.35,ty:0,tz:.5,fov:32});
  else Object.assign(goal,{yaw:0,pitch:.74,tx:.3,ty:-.2,tz:-.4,fov:30});
  fitGoal();
}
// ---------- the gallery (#galeri): the menu battle parades every model and the camera visits each one ----------
V.gallery=location.hash==="#galeri";
let capEl=null,capKey="";
function caption(ev){
  const key=ev?String(ev.t):"";if(key===capKey)return;capKey=key;
  if(!capEl){const hv=$("#heroView");if(!hv)return;capEl=document.createElement("div");capEl.className="gal-cap";hv.append(capEl)}
  if(!ev){capEl.hidden=true;return}
  const A=V.A,e=A.enOf(ev.t)||{},b=document.createElement("b"),sp=document.createElement("span");
  b.textContent=(e.n||"")+(A.isBoss(ev.t)?" · Bos":"");sp.textContent=e.ds||BEAST_DS[A.modelOf(ev.t)]||"";
  capEl.textContent="";capEl.append(b,sp);
  if(A.isExtra(ev.t)){const i=document.createElement("i");i.textContent="Model baru, belum ada di permainan";capEl.append(i)}
  capEl.hidden=false;
}
function galleryGoal(){
  const ev=V.A.featured();caption(ev);if(!ev)return;
  // a three-quarter view from the front, swaying slowly from side to side
  const h=V.A.heightOf(ev.t),boss=V.A.isBoss(ev.t);
  Object.assign(goal,{tx:ev.x,ty:ev.y+h*.45,tz:ev.z,dist:(boss?4.6:3)+h*1.8,pitch:.6,fov:30,yaw:Math.atan2(Math.cos(ev.yaw),-Math.sin(ev.yaw))+.6+Math.sin(V.time*.35)*.4});
}
function setGallery(on){
  V.gallery=on;const b=$("#btnGal");if(b)b.setAttribute("aria-pressed",String(on));
  if(!on){caption(null);if(ok)setGoal()}
  if(ok)buildBestiary();
}
window.addEventListener("hashchange",()=>setGallery(location.hash==="#galeri"));
function camTick(dt){
  const k=2.6;
  if(mode==="menu"&&V.gallery)galleryGoal();
  for(const f of["pitch","dist","tx","ty","tz","fov"])cam[f]=V.damp(cam[f],goal[f],k,dt);
  const sway=V.RM||(mode==="menu"&&V.gallery)?0:1,base=mode==="game"?Math.sin(V.time*.13)*.012*sway:Math.sin(V.time*.07)*.34*sway;
  cam.yaw=V.dampAng(cam.yaw,goal.yaw+base,k,dt);
  place(cam,cam.dist,V.cam);
  if(V.debugCam){const d=V.debugCam;V.cam.position.set(d[0],d[1],d[2]);V.cam.lookAt(d[3],d[4],d[5]);V.cam.updateMatrixWorld();return}
  if(shake>0){const s=shake*shake*.32,n=V.time*31;V.cam.position.x+=(V.noise(n,1)-.5)*s;V.cam.position.y+=(V.noise(n,7)-.5)*s;V.cam.position.z+=(V.noise(n,13)-.5)*s;shake=Math.max(0,shake-dt*2.4)}
}

// ---------- sizing and adaptive resolution ----------
function applySize(){
  if(!mountEl)return;const r=mountEl.getBoundingClientRect();W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));
  measureFree();
  V.renderer.setPixelRatio(dpr);V.renderer.setSize(W,H,false);
  const sc=H*dpr/(2*Math.tan(THREE.MathUtils.degToRad(cam.fov)/2));V.PA.mat.uniforms.uScale.value=sc;V.PN.mat.uniforms.uScale.value=sc;
  setGoal();
}
let perfT=0,perfN=0;
function perf(dt){
  if(V.lockDpr)return;perfT+=dt;perfN++;if(perfT<2.5)return;const avg=perfT/perfN;perfT=perfN=0;
  if(avg>.026&&dpr>.7){dpr=Math.max(.7,dpr*.82);applySize()}
  else if(avg>.026)lowShadow=true;                       // already at the lowest resolution: refresh shadows every other frame
  else if(avg<.0135){lowShadow=false;if(dpr<dprMax){dpr=Math.min(dprMax,dpr*1.15);applySize()}}
}
let lowShadow=false,frameN=0;

// ---------- overlay: floating numbers, wave banner, boss bar, end title ----------
const ov=V.ov={};
let ovEl=null,labels=[],bossEl=null,bannerEl=null,endEl=null,tintEl=null,hurtEl=null,bossShown=0,bossTrail=1;
function ovInit(){
  ovEl=document.createElement("div");ovEl.className="ov";ovEl.setAttribute("aria-hidden","true");
  ovEl.innerHTML='<div class="ov-tint"></div><div class="ov-hurt"></div><div class="ov-boss"><b></b><span><i class="tr"></i><i class="fi"></i></span></div><div class="ov-banner"><h3></h3><p></p></div><div class="ov-end"></div>';
  tintEl=ovEl.querySelector(".ov-tint");hurtEl=ovEl.querySelector(".ov-hurt");bossEl=ovEl.querySelector(".ov-boss");bannerEl=ovEl.querySelector(".ov-banner");endEl=ovEl.querySelector(".ov-end");
  $("#cvWrap").append(ovEl);
}
const restart=(el,cls)=>{el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)};
ov.label=(x,y,z,text,cls)=>{
  if(mode!=="game"||!ovEl)return;
  let L=labels.find(l=>l.age>=l.life);
  if(!L){if(labels.length>=40)return;const el=document.createElement("div");el.className="ov-lab";ovEl.append(el);L={el};labels.push(L)}
  Object.assign(L,{x,y,z,age:0,life:cls&&cls.includes("big")?1.6:1});L.el.className="ov-lab "+(cls||"");L.el.textContent=text;L.el.style.opacity="1";
};
ov.tint=(color,dur)=>{if(!tintEl)return;tintEl.style.background=color;tintEl.style.setProperty("--d",dur+"s");restart(tintEl,"on")};
ov.hurt=()=>{if(hurtEl)restart(hurtEl,"on")};
ov.banner=(title,sub,cls)=>{if(!bannerEl)return;bannerEl.querySelector("h3").textContent=title;bannerEl.querySelector("p").textContent=sub||"";bannerEl.className="ov-banner "+(cls||"");restart(bannerEl,"on")};
ov.end=(text,cls)=>{if(!endEl)return;if(!text){if(endEl.textContent){endEl.textContent="";endEl.className="ov-end"}return}if(endEl.textContent===text)return;endEl.textContent=text;endEl.className="ov-end "+cls;restart(endEl,"on")};
function ovTick(dt,S){
  for(const L of labels){if(L.age>=L.life)continue;L.age+=dt;const k=L.age/L.life;
    _p.set(L.x,L.y+k*.9,L.z).project(V.cam);const px=(_p.x+1)/2*W,py=(1-_p.y)/2*H,s=k<.15?.6+k/.15*.5:1.1-(k-.15)*.15;
    L.el.style.transform="translate3d("+px.toFixed(1)+"px,"+py.toFixed(1)+"px,0) translate(-50%,-50%) scale("+s.toFixed(3)+")";L.el.style.opacity=k>.65?((1-k)/.35).toFixed(3):"1";
    if(L.age>=L.life)L.el.style.opacity="0"}
  // boss bar with a trailing damage strip
  const b=mode==="game"&&S?V.A.bossOf(S):null;
  if(b){const EN=BB.game.EN,mh=(EN[b.t]||{hp:1}).hp*(S.wm||1),f=V.clamp(b.hp/mh,0,1),n=S.E.filter(e=>V.A.isBoss(e.t)).length;
    if(!bossShown){bossShown=1;bossTrail=f;bossEl.classList.add("on")}
    bossEl.querySelector("b").textContent=(EN[b.t].n||"Bos").toUpperCase()+(n>1?" ×"+n:"");
    bossTrail=Math.max(f,V.damp(bossTrail,f,2.5,dt));bossEl.querySelector(".fi").style.transform="scaleX("+f.toFixed(4)+")";bossEl.querySelector(".tr").style.transform="scaleX("+bossTrail.toFixed(4)+")"}
  else if(bossShown){bossShown=0;bossEl.classList.remove("on")}
}
// banners and sounds that come from watching the state change
let pw=null,pph=null,plv=null;
function watch(S){
  if(mode!=="game"||!S){pw=pph=plv=null;ov.end(null);return}
  const g=BB.game;
  if(pw!==null&&S.w>pw&&S.ph==="wave"){
    const boss=g.waveList(S.w,S.L).find(([t])=>V.A.isBoss(t)),name=boss?(g.EN[boss[0]].n||"Bos"):"";
    ov.banner(S.w>=S.mw?"GELOMBANG TERAKHIR":"GELOMBANG "+S.w,boss?name+" datang! Siapkan meriam.":"Musuh mendekat",boss?"boss":"");
    BB.emit("v:wave",{w:S.w,boss:!!boss})}
  if(pph==="wave"&&S.ph==="build"){ov.banner("Gelombang "+S.w+" selesai","","small");BB.emit("v:clear",{})}
  if(pph!==null&&pph!==S.ph){if(S.ph==="win")BB.emit("v:win",{});if(S.ph==="over")BB.emit("v:lose",{})}
  if(S.ph==="win")ov.end("LEVEL "+S.L+" TAMAT!","win");else if(S.ph==="over")ov.end("BENTENG RUNTUH","lose");else ov.end(null);
  if(plv!==null&&S.lv<plv)BB.emit("v:leak",{n:plv-S.lv});
  pw=S.w;pph=S.ph;plv=S.lv;
}

// ---------- selection: grid, hovered tile, range rings and the ghost of the tower to build ----------
let grid=null,tileHi=null,tileSel=null,ringHover=null,ringSel=null,ghost=null,ghostKey="";
const TILE_FS=`varying vec2 vUv;uniform vec3 uCol;uniform float uTime;
void main(){vec2 p=abs(vUv*2.0-1.0);float d=max(p.x,p.y);float a=smoothstep(0.72,0.97,d)*0.95+0.16;gl_FragColor=vec4(uCol,a*(0.78+0.22*sin(uTime*6.0)));}`;
const RING_FS=`varying vec2 vUv;uniform vec3 uCol;uniform float uTime;uniform float uR;
void main(){vec2 p=vUv*2.0-1.0;float r=length(p);if(r>1.0)discard;float bw=0.05/uR;
float ring=smoothstep(1.0-bw*2.2,1.0-bw,r)*(1.0-smoothstep(1.0-bw*0.25,1.0,r));
float n=max(6.0,floor(uR*6.0));float dash=step(0.42,fract(atan(p.y,p.x)/6.2832*n-uTime*0.35));
gl_FragColor=vec4(uCol,ring*(0.35+0.65*dash)+0.07*(1.0-r*0.4));}`;
const VS="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
function selInit(){
  const pos=[];for(let x=0;x<=V.COLS;x++)pos.push(x-V.HX,0,-V.HZ,x-V.HX,0,V.HZ);for(let y=0;y<=V.ROWS;y++)pos.push(-V.HX,0,y-V.HZ,V.HX,0,y-V.HZ);
  const gg=new THREE.BufferGeometry();gg.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  grid=new THREE.LineSegments(gg,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.16,depthWrite:false}));grid.position.y=.1;grid.renderOrder=8;
  const tm=c=>new THREE.ShaderMaterial({uniforms:{uCol:{value:new THREE.Color(c)},uTime:V.uTime},vertexShader:VS,fragmentShader:TILE_FS,transparent:true,depthWrite:false});
  const pg=new THREE.PlaneGeometry(.96,.96);pg.rotateX(-Math.PI/2);
  tileHi=new THREE.Mesh(pg,tm("#7fcf72"));tileSel=new THREE.Mesh(pg,tm("#f0b545"));
  const rm=c=>new THREE.ShaderMaterial({uniforms:{uCol:{value:new THREE.Color(c)},uTime:V.uTime,uR:{value:2}},vertexShader:VS,fragmentShader:RING_FS,transparent:true,depthWrite:false});
  const cg=new THREE.CircleGeometry(1,64);cg.rotateX(-Math.PI/2);
  ringHover=new THREE.Mesh(cg,rm("#ffffff"));ringSel=new THREE.Mesh(cg,rm("#f0b545"));
  for(const m of[grid,tileHi,tileSel,ringHover,ringSel]){m.visible=false;m.renderOrder=m.renderOrder||9;V.scene.add(m)}
}
function ghostFor(t){
  const key=t+"";if(ghostKey===key)return ghost;
  if(ghost){V.scene.remove(ghost)}
  ghost=new THREE.Group();ghostKey=key;
  const add=(name,y,ry)=>{const k=V.K[name];if(!k)return;const m=new THREE.Mesh(k.mesh.geometry,V.MAT.ghost);m.position.y=y;m.rotation.y=ry;ghost.add(m)};
  add("tb1",0,-Math.PI/2);add("c"+t+"_1",V.TOWER_TOP[0],-Math.PI/2);add("c"+t+"c",V.TOWER_TOP[0],-Math.PI/2);
  V.scene.add(ghost);return ghost;
}
function selTick(S){
  const g=BB.game,on=mode==="game"&&S;
  const st=on?g.selType:null,hv=on?g.hover:null,sx=on?g.selXY:null;
  grid.visible=st!=null;
  let showGhost=false;
  if(st!=null&&hv){
    const okb=g.canBuild(hv.x,hv.y),rich=g.myGold()>=g.TW[st].cost,h=V.groundAt(hv.x+.5,hv.y+.5),x=hv.x+.5-V.HX,z=hv.y+.5-V.HZ;
    tileHi.visible=true;tileHi.position.set(x,h+.035,z);tileHi.material.uniforms.uCol.value.set(okb&&rich?"#7fcf72":"#e5625a");
    if(okb){const r=g.stat(st,1).range;ringHover.visible=true;ringHover.position.set(x,.12,z);ringHover.scale.set(r,1,r);ringHover.material.uniforms.uR.value=r;
      const gh=ghostFor(st);gh.visible=true;gh.position.set(x,h+.02+Math.sin(V.time*4)*.03,z);V.MAT.ghost.color.set(rich?"#ffffff":"#ff9a8a");showGhost=true}
    else ringHover.visible=false;
  }else{tileHi.visible=false;ringHover.visible=false}
  if(ghost&&!showGhost)ghost.visible=false;
  const ti=sx?g.towerAt(sx.x,sx.y):-1;
  if(ti>=0){const tw=S.T[ti],r=g.stat(tw.t,tw.l).range,x=tw.x+.5-V.HX,z=tw.y+.5-V.HZ;
    ringSel.visible=true;ringSel.position.set(x,.13,z);ringSel.scale.set(r,1,r);ringSel.material.uniforms.uR.value=r;
    tileSel.visible=true;tileSel.position.set(x,V.groundAt(tw.x+.5,tw.y+.5)+.04,z)}
  else{ringSel.visible=false;tileSel.visible=false}
}

// ---------- icons for the shop and the bestiary, rendered from the 3D models ----------
let iconScene=null,iconCam=null,iconRT=null,iconKits=null;
function iconSetup(){
  iconScene=new THREE.Scene();
  iconScene.add(new THREE.HemisphereLight(0xeaf2ff,0x4a3a2a,1));const d=new THREE.DirectionalLight(0xffffff,1.1);d.position.set(3,5,4);iconScene.add(d);
  iconCam=new THREE.PerspectiveCamera(30,1,.05,60);
  iconRT=new THREE.WebGLRenderTarget(192,192);iconRT.texture.encoding=THREE.sRGBEncoding;
  iconKits={};for(const def of V.KDEF){const k=new V.Kit(def.geo,def.mat,12,false);iconKits[def.name]=k;iconScene.add(k.mesh)}
}
const _m=new THREE.Matrix4();
function renderIcon(cv,kind,id){
  if(!iconScene)iconSetup();
  const keep=V.K;V.K=iconKits;for(const k in iconKits)iconKits[k].n=0;
  let look=.45,dist=3.1;
  if(kind==="tower"){
    const t=id|0,oc=V.col(BB.game.PCOL[0]);
    V.M(0,0,0,0,-Math.PI/2,0,1,1,1,_m);iconKits.tb1.push(_m);V.put(iconKits.tb1c,_m,-.36,.72,-.36,0,-.4,0,1,1,1,oc.r,oc.g,oc.b);
    V.M(0,V.TOWER_TOP[0],0,0,-Math.PI/4,0,1.15,1.15,1.15,_m);(iconKits["c"+t+"_1"]||iconKits.c0_1).push(_m);(iconKits["c"+t+"c"]||iconKits.c0c).push(_m,oc.r,oc.g,oc.b);
    if(t===2)V.put(iconKits.crys1,_m,.2,.54,0,0,.5,0);
    look=.48;dist=3.2;
  }else{
    const ev={id:1,t:id|0,fl:0,sl:0,spawn:1},m=V.A.modelOf(id|0),f=ICON[m]||[.3,2.3,.66,0];
    V.A.drawModel(ev,f[3],0,f[3],-Math.PI/4,1.2,f[2]);
    look=f[0];dist=f[1];
  }
  for(const k in iconKits)iconKits[k].flush();V.K=keep;
  iconCam.position.set(dist*.55,look+dist*.5,dist*.75);iconCam.lookAt(0,look,0);
  const r=V.renderer,prevT=r.getRenderTarget(),fog=V.scene.fog;
  r.setRenderTarget(iconRT);r.setClearColor(0x000000,0);r.clear();r.render(iconScene,iconCam);
  const buf=new Uint8Array(192*192*4);r.readRenderTargetPixels(iconRT,0,0,192,192,buf);r.setRenderTarget(prevT);r.setClearColor(0x000000,1);
  const tmp=document.createElement("canvas");tmp.width=tmp.height=192;const tc=tmp.getContext("2d"),img=tc.createImageData(192,192);
  for(let y=0;y<192;y++)img.data.set(buf.subarray((191-y)*192*4,(192-y)*192*4),y*192*4);tc.putImageData(img,0,0);
  const c=cv.getContext("2d");c.clearRect(0,0,cv.width,cv.height);c.drawImage(tmp,0,0,cv.width,cv.height);
  void fog;
}

// look-at height, distance, scale and offset of each model's portrait
const ICON={kilat:[.42,2.3,.66,0],raja:[.55,2.9,.72,0],hantu:[.48,2.3,.82,0],perisai:[.5,2.4,.85,0],rajalendir:[.42,2.4,.8,0],kalajengking:[.36,2.6,.78,.18],yeti:[.62,2.9,.68,0],naga:[.42,3,.6,.35]};

// ---------- the bestiary in the menu: one portrait per enemy type (in the gallery, the new models too) ----------
const BEAST_DS={lendir:"Lemah tapi datang berbondong-bondong",kilat:"Tawon super cepat",kura:"Tempurung tebal, jalannya lambat",raja:"Bos di gelombang ke-5 dan terakhir"};
function buildBestiary(){
  const el=$("#bestiary");if(!el)return;el.textContent="";
  const A=V.A,n=A.types();
  for(let i=0;i<n;i++){const e=A.enOf(i);if(!e)continue;
    const d=document.createElement("button");d.type="button";d.className="beast"+(A.isBoss(i)?" boss":"")+(A.isExtra(i)?" new":"");d.dataset.t=i;d.title="Lihat "+e.n+" dari dekat";
    const c=document.createElement("canvas");c.width=88;c.height=88;const b=document.createElement("b");b.textContent=e.n;
    const s=document.createElement("span");s.textContent=e.ds||BEAST_DS[A.modelOf(i)]||"";d.append(c,b,s);
    if(A.isExtra(i)){const tg=document.createElement("em");tg.textContent="Baru";d.append(tg)}
    el.append(d);renderIcon(c,"enemy",i)}
}
// a card shows that monster up close in the gallery; the button turns the gallery on and off
document.addEventListener("click",e=>{
  if(!e.target.closest)return;
  const card=e.target.closest(".beast[data-t]");
  if(card){if(!V.gallery)setGallery(true);V.A.feature(+card.dataset.t);const hv=$("#heroView");if(hv&&hv.scrollIntoView)hv.scrollIntoView({behavior:"smooth",block:"nearest"});return}
  if(e.target.closest("#btnGal"))setGallery(!V.gallery);
});

// ---------- the API game.js calls ----------
const view={};
view.init=()=>{
  if(!THREE){fail("Tampilan 3D gagal dimuat. Muat ulang halaman ini.");return}
  canvas=document.createElement("canvas");canvas.className="view3d";
  let r=null;try{r=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"})}catch(e){r=null}
  if(!r||!r.getContext()){fail("Perangkat ini tidak mendukung WebGL, jadi peta 3D tidak bisa ditampilkan.");return}
  V.renderer=r;r.outputEncoding=THREE.sRGBEncoding;r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;
  dprMax=Math.min(window.devicePixelRatio||1,V.mobile?1.6:2);dpr=Math.min(dprMax,1.5);
  V.scene=new THREE.Scene();V.cam=new THREE.PerspectiveCamera(32,1,.3,260);
  V.makeMaterials();V.makeLights();V.makeModels();V.A.makeLights();
  V.PA=new V.Particles(V.mobile?1400:2600,true);V.PN=new V.Particles(V.mobile?1100:2000,false);V.scene.add(V.PA.pts,V.PN.pts);
  V.FX={glow:new V.FxKit(0,true,320),ring:new V.FxKit(1,true,220,{flat:true}),ringN:new V.FxKit(1,false,60,{flat:true}),decal:new V.FxKit(3,false,160,{flat:true,order:5}),
    decalA:new V.FxKit(3,true,220,{flat:true,order:6}),beam:new V.FxKit(2,true,80),bar:new V.FxKit(4,false,640,{depthTest:false,order:60}),cloud:new V.FxKit(0,false,80,{order:1})};
  for(const k in V.FX)V.scene.add(V.FX[k].mesh);
  const q=new THREE.Quaternion(),_v=new THREE.Vector3(),_s=new THREE.Vector3(),cm=new THREE.Matrix4();
  V.fxCloud={place(c){q.copy(V.cam.quaternion);for(let i=0;i<3;i++){_v.set(c.x+(i-1)*c.s*.42,c.y+(i===1?c.s*.12:0),c.z+(i-1)*.6);const s=c.s*(i===1?1:.72);_s.set(s,s*.62,1);cm.compose(_v,q,_s);V.FX.cloud.push(cm,c.c[0],c.c[1],c.c[2],c.a)}}};
  selInit();ovInit();
  BB.on("shot",d=>V.A.onShot(d));BB.on("death",d=>V.A.onDeath(d));BB.on("help",d=>V.A.onHelp(d));BB.on("ability",d=>V.A.onAbility(d));
  const ro=new ResizeObserver(()=>{if(mountEl)applySize()});
  for(const el of[document.body,$("#cvWrap"),$("#hudTop"),$("#hudDock"),$("#helpBar")])if(el)ro.observe(el);
  V.ok=ok=true;
  for(const[cv,kind,id]of queue)renderIcon(cv,kind,id);queue=[];
  setGallery(V.gallery);
};
view.show=which=>{
  mode=which==="game"?"game":"menu";
  document.documentElement.classList.toggle("playing",mode==="game");
  if(V.hud)V.hud.show(mode);
  if(failed||!ok)return;
  mountEl=mode==="game"?$("#cvWrap"):$("#heroView");if(!mountEl)return;
  mountEl.prepend(canvas);V.A.reset();V.worldKey="";
  for(const L of labels){L.age=L.life;L.el.style.opacity="0"}
  applySize();
  // a short swoop into the board when a game starts
  Object.assign(cam,goal);
  if(mode==="game"&&!V.RM){cam.yaw=goal.yaw-.55;cam.pitch=1.32;cam.dist=goal.dist*1.45}
};
view.frame=dt=>{
  if(!ok||!mountEl)return;
  V.time+=dt;V.uTime.value=V.time;
  const g=BB.game,S=g.S,L=mode==="game"&&S?S.L:g.selLevel;
  if(V.buildWorld(g.mapOf(L||1),V.tierOf(L||1))){V.A.reset();setGoal()}
  V.worldTick(dt,V.time);
  const st=V.A.tick(dt,mode);
  selTick(S);
  V.flushKits(V.K);for(const k in V.FX)V.FX[k].flush();
  V.PA.update(dt,V.time);V.PN.update(dt,V.time);
  watch(S);
  camTick(dt);
  frameN++;V.renderer.shadowMap.autoUpdate=!lowShadow;if(lowShadow&&frameN%2===0)V.renderer.shadowMap.needsUpdate=true;
  V.renderer.render(V.scene,V.cam);
  ovTick(dt,mode==="game"?S:null);
  if(V.hud)V.hud.tick(dt,mode==="game"?S:null,W,H);
  perf(dt);void st;
};
view.reset=()=>{if(ok){V.A.reset();pw=pph=plv=null}};
view.pick=(cx,cy)=>{
  if(!ok||mode!=="game")return null;
  const r=canvas.getBoundingClientRect();if(!r.width)return null;
  const ray=new THREE.Raycaster();ray.setFromCamera({x:(cx-r.left)/r.width*2-1,y:-((cy-r.top)/r.height*2-1)},V.cam);
  const pl=new THREE.Plane(new THREE.Vector3(0,1,0),-V.TOP*.7),hit=new THREE.Vector3();if(!ray.ray.intersectPlane(pl,hit))return null;
  const x=Math.floor(hit.x+V.HX),y=Math.floor(hit.z+V.HZ);
  return x>=0&&x<V.COLS&&y>=0&&y<V.ROWS?{x,y}:null;
};
view.icon=(cv,kind,id)=>{if(failed)return;if(!ok){queue.push([cv,kind,id]);return}renderIcon(cv,kind,id)};
BB.view=view;
})();
