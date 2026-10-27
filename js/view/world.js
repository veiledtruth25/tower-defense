// Tampilan 3D, dunia: pulau melayang per peta (tema) dan suasana per tingkat level (waktu).
// Milik sesi desain. Isi: tekstur tanah, medan dengan jalan bercekung, tebing, dekorasi berangin,
// kastel di ujung jalan, portal musuh, air, langit, cahaya dan cuaca.
(function(){
"use strict";
const BB=window.BB,V=BB.V,THREE=window.THREE;
if(!THREE)return;
const G=V.G,H=V.hash;

// one theme per map of the logic (cycled if the logic adds maps)
V.THEMES=[
  {key:"lembah",grass:"#5c9a43",grassD:"#4a843a",grassL:"#74b252",road:["#6f5232","#a9844f","#bf9a66"],dash:"rgba(85,58,28,.35)",peb:"rgba(90,64,36,.45)",
   strata:["#4f8a3c","#7a5634","#5e4128","#46301f"],portal:"#b07af0",roof:"#3b5ea8",blade:["#3f7a32","#8fc95e"]},
  {key:"bukit",grass:"#e3ecf3",grassD:"#c7d5e3",grassL:"#ffffff",road:["#5f7187","#8ea1b5","#a3b4c6"],dash:"rgba(45,60,80,.3)",peb:"rgba(60,75,95,.3)",
   strata:["#eef4f8","#8fa1b3","#6b7c8e","#56657a"],portal:"#5ac8f0",roof:"#b0413c",blade:null},
  {key:"rawa",grass:"#556f3c",grassD:"#435a30",grassL:"#6a8549",road:["#3e3122","#5e4a33","#6b553b"],dash:null,peb:"rgba(30,22,14,.45)",
   strata:["#556f3c","#4a3b2a","#3a2d20","#2a2118"],portal:"#6ff09a",roof:"#2f5a3a",blade:["#2f4a26","#7d9a4a"],water:"#2e5c55"},
  {key:"ular",grass:"#dcb574",grassD:"#c9a060",grassL:"#ecd09a",road:["#8a5f35","#b07f4c","#c4925c"],dash:"rgba(90,55,25,.3)",peb:"rgba(100,65,30,.4)",
   strata:["#dcb574","#c08850","#a06a3a","#80522c"],portal:"#ff9a4a",roof:"#2f7d86",blade:["#a8843e","#e2c37a"]}
];
// one atmosphere per 25 levels: morning, dusk, night, blood eclipse
V.TIERS=[
  {n:"Pagi",sky:["#6fb8ea","#a9daf6","#e4f4fc"],fog:"#b8dcf0",hemi:["#e2f1ff","#5d4c36",.88],sun:["#fff2dc",1.22],dir:[-.72,1,.62],night:0,cloud:"#ffffff"},
  {n:"Senja",sky:["#2d2f6b","#a35f7a","#f4a565"],fog:"#c98a74",hemi:["#ffd6b8","#3e2f45",.78],sun:["#ffae6e",1.2],dir:[-1,.5,.3],night:.25,cloud:"#f6b3a0"},
  {n:"Malam",sky:["#03060f","#0b1634","#1c2e5a"],fog:"#0e1730",hemi:["#7090d8","#141626",.62],sun:["#b3cbff",.6],dir:[.5,1,-.3],night:1,cloud:"#2a3a60"},
  {n:"Gerhana",sky:["#080105","#33080f","#74161f"],fog:"#34101a",hemi:["#ffa090","#1a060a",.62],sun:["#ff7a62",.85],dir:[-.4,.9,-.5],night:.8,cloud:"#5a1a24"}
];
V.themeOf=mi=>V.THEMES[((mi%V.THEMES.length)+V.THEMES.length)%V.THEMES.length];
V.tierOf=L=>Math.max(0,Math.min(3,Math.floor(((L||1)-1)/25)));

// ---------- road geometry and the height of the ground ----------
// A map can have several roads (geo.routes) from several portals (geo.portals); they all end at the one gate.
let geo=null,theme=null,mapI=-1,roadSeg=[],roadSteps=[],PORTALS=[];
const segDist=(px,py,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;let t=l2?((px-a[0])*dx+(py-a[1])*dy)/l2:0;t=V.clamp(t,0,1);return Math.hypot(px-a[0]-dx*t,py-a[1]-dy*t)};
V.roadDist=(tx,ty)=>{let d=1e9;for(const s of roadSeg)d=Math.min(d,segDist(tx,ty,s.a,s.b));return d};
// the segments of every road (a stretch that several routes share counts once), and the same roads cut into
// one-tile steps, so details painted on a shared stretch are not drawn twice
function roadsOf(g){
  const seen=new Set(),seg=[],steps=new Map();
  for(const R of g.routes||[g])for(const s of R.SEG){
    const k=s.a+"|"+s.b;if(!seen.has(k)){seen.add(k);seg.push(s)}
    const n=Math.max(1,Math.round(s.l)),ux=(s.b[0]-s.a[0])/n,uy=(s.b[1]-s.a[1])/n;
    for(let i=0;i<n;i++){const a=[s.a[0]+ux*i,s.a[1]+uy*i],b=[a[0]+ux,a[1]+uy],key=Math.min(a[0],b[0])+","+Math.min(a[1],b[1])+">"+Math.max(a[0],b[0])+","+Math.max(a[1],b[1]);
      if(!steps.has(key))steps.set(key,{a,b})}}
  return{seg,steps:[...steps.values()]};
}
// each portal with the direction its road leaves in (into the board) and how far behind the road's first
// point its arch stands; a portal on the south edge stands further back so it hides less of the board
function portalsOf(g){
  const RS=g.routes||[g];
  return(g.portals||[{WP0:g.WP[0],routes:[0],side:"Barat"}]).map((P,i)=>{const R=RS[P.routes[0]],a=R.WP[0],b=R.WP[1],L=Math.hypot(b[0]-a[0],b[1]-a[1])||1,dir=[(b[0]-a[0])/L,(b[1]-a[1])/L];
    return{i,WP0:P.WP0,side:P.side,routes:P.routes,dir,back:dir[1]<-.5?.55:.28}});
}
const gauss=(x,y,cx,cy,r)=>Math.exp(-((x-cx)*(x-cx)+(y-cy)*(y-cy))/(r*r));
V.height=(x,z)=>{
  const tx=x+V.HX,ty=z+V.HZ,d=V.roadDist(tx,ty);
  let h=V.TOP*V.smooth(.38,.62,d)+(V.noise(tx*.55,ty*.55)-.5)*.06*V.smooth(.7,1.8,d);
  const out=Math.max(0,-tx,tx-V.COLS,-ty,ty-V.ROWS),mf=V.smooth(.15,1.1,out)*V.smooth(.8,1.6,d);
  const k=theme.key;
  if(k==="lembah")h+=V.noise(tx*.35+11,ty*.35)*.32*mf;
  else if(k==="bukit"){h+=(gauss(tx,ty,3.6,-1.9,2.1)*1.7+gauss(tx,ty,15.8,-2,2)*1.4)*V.smooth(.4,1.4,d)+V.noise(tx*.5,ty*.5)*.2*mf}
  else if(k==="rawa"){const n=V.noise(tx*.42+7,ty*.42+3);h-=V.smooth(.64,.74,n)*.15*V.smooth(1.2,1.8,d)}
  else if(k==="ular")h+=((Math.sin(tx*.55+ty*.25)*.5+.5)*.18+V.noise(tx*.6,ty*.6)*.1)*mf+Math.sin(tx*2.2+ty*1.3)*.012*V.smooth(.7,1.4,d);
  if(tx>V.COLS+.25)h=V.lerp(h,V.TOP,V.smooth(V.COLS+.25,V.COLS+.6,tx));            // castle ground
  const e=Math.min(x-V.X0,V.X1-x,z-V.Z0,V.Z1-z);
  return V.lerp(V.TOP,h,V.smooth(0,.45,e));                                           // rim meets the cliff
};
V.groundAt=(tx,ty)=>V.height(tx-V.HX,ty-V.HZ);

// ---------- the painted ground texture ----------
function paintGround(){
  const PPU=V.mobile?36:52,IW=V.X1-V.X0,ID=V.Z1-V.Z0,cw=Math.round(IW*PPU),ch=Math.round(ID*PPU);
  const cv=document.createElement("canvas");cv.width=cw;cv.height=ch;const m=cv.getContext("2d");
  m.setTransform(PPU,0,0,PPU,-V.X0*PPU,-V.Z0*PPU);
  const T=theme,X0=V.X0,Z0=V.Z0;let seed=mapI*977+13;const R=()=>H(seed++,mapI*31+7);
  m.fillStyle=T.grass;m.fillRect(X0,Z0,IW,ID);
  // soft natural blotches
  for(let i=0;i<260;i++){const x=X0+R()*IW,z=Z0+R()*ID,r=.5+R()*2.2,g=m.createRadialGradient(x,z,0,x,z,r),c=R()<.5?T.grassD:T.grassL;
    g.addColorStop(0,c);g.addColorStop(1,c+"00");m.globalAlpha=.18+R()*.18;m.fillStyle=g;m.fillRect(x-r,z-r,r*2,r*2)}
  m.globalAlpha=1;
  // a quiet pattern on the board so the grid reads without lines
  for(let ty=0;ty<V.ROWS;ty++)for(let tx=0;tx<V.COLS;tx++){
    const k=T.key,a=k==="lembah"?(tx%2?.05:-.03):((tx+ty)%2?.035:-.02);
    m.fillStyle=a>0?"rgba(255,255,255,"+a+")":"rgba(0,0,0,"+(-a)+")";m.fillRect(tx-V.HX,ty-V.HZ,1,1)}
  // margins sit a shade darker so the playable board stands out
  m.fillStyle="rgba(0,0,0,.10)";m.fillRect(X0,Z0,IW,-V.HZ-Z0);m.fillRect(X0,V.HZ,IW,V.Z1-V.HZ);m.fillRect(X0,-V.HZ,-V.HX-X0,V.ROWS);m.fillRect(V.HX,-V.HZ,V.X1-V.HX,V.ROWS);
  m.strokeStyle="rgba(0,0,0,.16)";m.lineWidth=.05;m.strokeRect(-V.HX,-V.HZ,V.COLS,V.ROWS);
  m.strokeStyle="rgba(255,255,255,.08)";m.lineWidth=.03;m.strokeRect(-V.HX+.04,-V.HZ+.04,V.COLS-.08,V.ROWS-.08);
  // small details everywhere
  for(let ty=-3;ty<V.ROWS+2;ty++)for(let tx=-2;tx<V.COLS+3;tx++){
    const h=H(tx*7+mapI,ty*13),h2=H(ty*5+3,tx*11+mapI),x=tx-V.HX,z=ty-V.HZ;
    if(T.key==="lembah"){
      if(h>.45){m.strokeStyle="rgba(170,220,140,.28)";m.lineWidth=.035;const px=x+.2+h2*.6,pz=z+.3+h*.5;m.beginPath();m.moveTo(px,pz);m.lineTo(px-.06,pz-.15);m.moveTo(px,pz);m.lineTo(px+.05,pz-.17);m.stroke()}
      if(h>.9){m.fillStyle=["#f4d06f","#f28fa8","#f5f0e0","#b9a4f0"][Math.floor(h2*4)];for(let i=0;i<3;i++){m.beginPath();m.arc(x+.25+H(tx+i,ty)*.5,z+.25+H(ty+i,tx)*.5,.035,0,7);m.fill()}}
    }else if(T.key==="bukit"){
      if(h>.55){m.fillStyle="rgba(150,175,205,.22)";m.beginPath();m.ellipse(x+.5,z+.7,.4,.12,0,0,7);m.fill()}
      if(h>.8){m.fillStyle="rgba(255,255,255,.9)";m.beginPath();m.arc(x+.2+h2*.6,z+.2+h*.5,.025,0,7);m.fill()}
    }else if(T.key==="rawa"){
      if(h>.5){m.fillStyle="rgba(40,60,30,.25)";m.beginPath();m.ellipse(x+h2,z+h,.3+h2*.3,.18,h*3,0,7);m.fill()}
      if(h>.86){m.fillStyle="rgba(150,180,90,.35)";m.beginPath();m.arc(x+.5,z+.5,.08,0,7);m.fill()}
    }else{
      if(h>.4){m.strokeStyle="rgba(150,105,55,.24)";m.lineWidth=.03;m.beginPath();m.arc(x+.5,z+.95,.42,Math.PI*1.2,Math.PI*1.8);m.stroke()}
      if(h>.88){m.fillStyle="rgba(110,75,40,.45)";m.beginPath();m.arc(x+.2+h2*.6,z+.3+h*.4,.04,0,7);m.fill()}
    }}
  // the roads, from the arch of every portal to the castle gate and on into the courtyard. Each layer is laid
  // over all roads at once, so the dark edge of one road never cuts across another where they fork or meet.
  const toW=([a,b])=>[a-V.HX,b-V.HZ],arch=P=>{const p=toW(P.WP0);return[p[0]-P.dir[0]*P.back,p[1]-P.dir[1]*P.back]};
  const roads=(geo.routes||[geo]).map(R=>[arch(PORTALS[R.portal||0]),...R.WP.map(toW)]),last=roads[0][roads[0].length-1];
  m.lineJoin="round";m.lineCap="butt";
  const stroke=(w,c)=>{m.strokeStyle=c;m.lineWidth=w;m.beginPath();for(const W of roads){W.forEach((p,i)=>i?m.lineTo(p[0],p[1]):m.moveTo(p[0],p[1]));m.lineTo(V.X1,last[1])}m.stroke()};
  stroke(1.08,"rgba(0,0,0,.16)");stroke(1.0,T.road[0]);stroke(.86,T.road[1]);stroke(.5,T.road[2]);
  // the dashed centre line keeps one spacing over the whole board, so the dashes of shared stretches line up
  if(T.dash){m.strokeStyle=T.dash;m.lineWidth=.03;m.beginPath();
    const dash=(a,b)=>{const hor=Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1]),u0=Math.min(a[hor?0:1],b[hor?0:1]),u1=Math.max(a[hor?0:1],b[hor?0:1]),c=a[hor?1:0];
      for(let k=Math.floor(u0/.34);k*.34<u1;k++){const s=Math.max(u0,k*.34),e=Math.min(u1,k*.34+.12);if(e>s){if(hor){m.moveTo(s,c);m.lineTo(e,c)}else{m.moveTo(c,s);m.lineTo(c,e)}}}};
    for(const s of roadSteps)dash(toW(s.a),toW(s.b));
    for(const P of PORTALS)dash(arch(P),toW(P.WP0));
    dash(last,[V.X1,last[1]]);m.stroke()}
  // road surface per theme: boardwalk planks, sled tracks, paving slabs, pebbles
  for(const st of roadSteps){const a=toW(st.a),b=toW(st.b),L=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
    for(let s=0;s<L-.01;s+=T.key==="rawa"?.2:.33){const x=a[0]+ux*s,z=a[1]+uz*s,h=H(Math.round(x*20),Math.round(z*20));
      if(T.key==="rawa"){m.save();m.translate(x,z);m.rotate(Math.atan2(uz,ux));m.fillStyle=["#7a5a38","#6b4e30","#86643f"][Math.floor(h*3)];m.fillRect(-.075,-.43,.15,.86);
        m.fillStyle="rgba(20,14,8,.5)";m.fillRect(.075,-.43,.03,.86);m.fillStyle="rgba(30,20,10,.6)";m.fillRect(-.02,-.36,.03,.03);m.fillRect(-.02,.33,.03,.03);m.restore()}
      else if(T.key==="ular"&&h>.35){m.fillStyle="rgba(120,80,40,.35)";m.beginPath();m.ellipse(x+(h-.5)*.4,z+(H(Math.round(z*9),3)-.5)*.4,.14,.1,h*6,0,7);m.fill()}
      else if(T.key==="bukit"){m.fillStyle="rgba(70,90,115,.18)";m.fillRect(x-uz*.18-.02,z+ux*.18-.02,.04+Math.abs(ux)*.3,.04+Math.abs(uz)*.3);m.fillRect(x+uz*.18-.02,z-ux*.18-.02,.04+Math.abs(ux)*.3,.04+Math.abs(uz)*.3)}
      if(h>.6){m.fillStyle=T.peb;m.beginPath();m.arc(x+(h-.8)*1.4,z+(H(3,Math.round(s*9))-.5)*.6,.03+h*.02,0,7);m.fill()}}}
  // courtyard cobbles behind the gate
  for(let x=V.HX+.55;x<V.X1;x+=.22)for(let z=V.Z0+.2;z<V.Z1-.1;z+=.2){const h=H(Math.round(x*9),Math.round(z*9));m.fillStyle=h>.5?"rgba(120,124,132,.55)":"rgba(95,99,108,.55)";m.fillRect(x,z+(Math.round(x*9)%2)*.1,.2,.18)}
  // scorched ground around each portal
  for(const P of PORTALS){const[cx,cz]=arch(P),g=m.createRadialGradient(cx,cz,0,cx,cz,1.5);
    g.addColorStop(0,"rgba(20,10,30,.55)");g.addColorStop(1,"rgba(20,10,30,0)");m.fillStyle=g;m.fillRect(cx-2,cz-2,4,4)}
  const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=Math.min(8,V.renderer.capabilities.getMaxAnisotropy());
  return tex;
}
function strataTex(){
  const cv=document.createElement("canvas");cv.width=256;cv.height=128;const m=cv.getContext("2d"),S=theme.strata;
  const bands=[[0,.1,S[0]],[.1,.42,S[1]],[.42,.75,S[2]],[.75,1,S[3]]];
  for(const[a,b,c]of bands){m.fillStyle=c;m.fillRect(0,a*128,256,(b-a)*128+1)}
  for(let i=0;i<220;i++){const x=H(i,7)*256,y=12+H(i,9)*116,r=1+H(i,11)*4;m.fillStyle=H(i,13)>.5?"rgba(0,0,0,.18)":"rgba(255,255,255,.08)";m.beginPath();m.ellipse(x,y,r*1.6,r,0,0,7);m.fill()}
  m.fillStyle="rgba(0,0,0,.25)";for(let x=0;x<256;x+=3)m.fillRect(x,12+H(x,1)*4,3,1.5);
  const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;t.wrapS=THREE.RepeatWrapping;return t;
}

// ---------- decoration: static instances, cleared from a tile when a tower is built there ----------
let decor=null; // {kits:[{mesh,base[]}], tiles:Map(tile -> {s,goal,items:[[mesh,i,base]]})}
function decorKinds(){
  const B=()=>new V.Build(),k=theme.key,K={};
  const up=(y0,y1)=>(x,y)=>V.smooth(y0,y1,y); // sway grows with height
  if(k==="lembah"){
    K.tree=B().add(G.cyl(.06,.09,.5,6),"#6a4a2c",0,.25,0).add(G.ico(.3,1),["#3f7d36","#4a8a3d","#36702f"],0,.62,0,0,0,0,1,.9,1,up(.4,.9))
      .add(G.ico(.22,1),["#58a048","#4f9441"],.14,.82,.08,0,0,0,1,1,1,up(.4,.9)).add(G.ico(.2,1),["#4a8a3d","#5fa84e"],-.15,.76,-.1,0,0,0,1,1,1,up(.4,.9));
    K.bush=B().add(G.ico(.18,1),["#3f7d36","#4a8a3d"],0,.12,0,0,0,0,1.2,.8,1,up(0,.3)).add(G.ico(.13,1),["#58a048","#4f9441"],.13,.12,.06,0,0,0,1,1,1,up(0,.3))
      .add(G.sph(.025,5,4),"#e5625a",.08,.22,.1).add(G.sph(.025,5,4),"#e5625a",-.06,.2,.12);
    K.rock=B().add(G.dod(.2),["#8a9099","#7c828c","#969ca6"],0,.08,0,0,0,0,1.2,.75,1).add(G.dod(.1),["#8a9099","#a0a6b0"],.2,.04,.1);
    K.flower=B().add(G.cyl(.006,.006,.12,3),"#4f8a3c",0,.06,0,0,0,0,1,1,1,up(0,.12)).add(G.sph(.03,5,4),"#f4d06f",0,.13,0,0,0,0,1,1,1,.6)
      .add(G.cyl(.006,.006,.1,3),"#4f8a3c",.06,.05,.03,0,0,0,1,1,1,up(0,.1)).add(G.sph(.028,5,4),"#f28fa8",.06,.11,.03,0,0,0,1,1,1,.6);
    K.mush=B().add(G.cyl(.02,.025,.07,5),"#f2ead8",0,.035,0).add(G.hemi(.06,7,3),"#d9453a",0,.065,0).add(G.sph(.01,4,3),"#ffffff",.03,.09,.01);
    return{K,big:["tree","tree","bush","rock"],small:["flower","flower","mush"],margin:["tree","tree","tree","bush","rock"]};
  }
  if(k==="bukit"){
    K.pine=B().add(G.cyl(.05,.07,.25,6),"#5a3d22",0,.12,0);
    [[.34,.3,.3],[.27,.28,.52],[.19,.26,.72]].forEach(([r,h,y])=>{K.pine.add(G.cone(r,h,7),["#2e5a4a","#346350"],0,y,0,0,0,0,1,1,1,up(.2,1)).add(G.cone(r*.62,h*.55,7),"#f6fafc",0,y+h*.24,0,0,0,0,1,1,1,up(.2,1))});
    K.rock=B().add(G.dod(.2),["#7f8a96","#6f7a86"],0,.08,0,0,0,0,1.2,.75,1).add(G.dod(.15),"#f6fafc",0,.17,0,0,0,0,1.15,.35,.95);
    K.ice=B().add(G.oct(.1),"#a9d8f2",0,.13,0,0,0,.2,.8,1.8,.8).add(G.oct(.07),"#c7ecff",.09,.09,.04,0,0,-.4,.8,1.6,.8);
    K.snowman=B().add(G.sph(.16,8,6),"#f6fafc",0,.15,0).add(G.sph(.11,8,6),"#f6fafc",0,.37,0).add(G.cone(.025,.12,5),"#f08a3a",.11,.38,0,0,0,-Math.PI/2)
      .add(G.sph(.016,4,3),"#2a2e3a",.095,.41,.04).add(G.sph(.016,4,3),"#2a2e3a",.095,.41,-.04).add(G.cyl(.09,.09,.1,8),"#2a2e3a",0,.5,0).add(G.cyl(.13,.13,.015,8),"#2a2e3a",0,.45,0)
      .add(G.cyl(.01,.01,.22,3),"#6b4a2e",0,.28,.16,1.1,0,0).add(G.cyl(.01,.01,.22,3),"#6b4a2e",0,.28,-.16,-1.1,0,0);
    K.twig=B().add(G.cyl(.008,.012,.18,3),"#6b4a2e",0,.09,0,0,0,.3,1,1,1,up(0,.18)).add(G.cyl(.006,.01,.14,3),"#6b4a2e",.04,.07,.02,0,0,-.4,1,1,1,up(0,.14));
    return{K,big:["pine","pine","rock","snowman"],small:["ice","twig"],margin:["pine","pine","pine","rock"]};
  }
  if(k==="rawa"){
    K.willow=B().add(G.cyl(.07,.11,.55,6),"#4a3a28",0,.27,0,0,0,.08).add(G.ico(.3,1),["#4a6a34","#3c5a2c"],0,.66,0,0,0,0,1.2,.7,1.2,up(.4,.9));
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;K.willow.add(G.cone(.07,.42,4),"#5a7a3c",Math.cos(a)*.27,.47,Math.sin(a)*.27,Math.PI,0,0,1,1,1,up(.75,.25))}
    K.stump=B().add(G.cyl(.12,.15,.18,7),"#5a4532",0,.09,0).add(G.cyl(.11,.11,.01,7),"#a08060",0,.185,0).add(G.hemi(.05,6,3),"#9be86a",.1,.12,.05);
    K.log=B().add(G.cyl(.08,.08,.6,7),"#5a4532",0,.07,0,0,0,Math.PI/2).add(G.cyl(.075,.075,.01,7),"#a08060",.3,.07,0,0,0,Math.PI/2).add(G.hemi(.04,5,3),"#8fd16a",-.1,.13,.03);
    K.reeds=new V.Build();for(let i=0;i<5;i++){const x=(H(i,3)-.5)*.2,z=(H(i,5)-.5)*.2,h=.25+H(i,7)*.2;K.reeds.add(G.cyl(.006,.01,h,3),"#6b8a3c",x,h/2,z,0,0,0,1,1,1,up(0,h));if(i%2===0)K.reeds.add(G.cap(.018,.06,2,4),"#5a3a22",x,h-.02,z,0,0,0,1,1,1,1)}
    K.shroom=B().add(G.cyl(.015,.02,.06,5),"#d8f0e0",0,.03,0).add(G.hemi(.05,7,3),"#7ff0c0",0,.055,0).add(G.cyl(.01,.012,.04,5),"#d8f0e0",.06,.02,.03).add(G.hemi(.03,6,3),"#7ff0c0",.06,.035,.03);
    return{K,big:["willow","willow","stump","log"],small:["reeds","reeds","shroom"],margin:["willow","willow","reeds","stump"],glow:["shroom"]};
  }
  K.cactus=B().add(G.cyl(.08,.09,.62,7),"#4f8a4a",0,.31,0).add(G.sph(.08,7,4),"#4f8a4a",0,.62,0).add(G.cyl(.05,.05,.22,6),"#4f8a4a",.14,.36,0,0,0,Math.PI/2)
    .add(G.cyl(.05,.05,.2,6),"#4f8a4a",.24,.45,0).add(G.cyl(.045,.045,.18,6),"#4f8a4a",-.12,.28,0,0,0,-Math.PI/2).add(G.cyl(.045,.045,.16,6),"#4f8a4a",-.2,.36,0)
    .add(G.sph(.03,5,4),"#f28fa8",0,.7,0);
  K.rock=B().add(G.box(.42,.14,.34),"#b07a45",0,.07,0,0,.3,0).add(G.box(.32,.12,.26),"#c48c52",.03,.2,.02,0,.1,0).add(G.box(.2,.1,.16),"#d39c60",0,.31,0,0,.5,0);
  K.bones=B().add(G.sph(.09,7,5),"#efe6cf",0,.07,0,0,0,0,1.2,.9,1).add(G.sph(.025,4,3),"#3a2a1a",.08,.09,.04).add(G.sph(.025,4,3),"#3a2a1a",.08,.09,-.04)
    .add(G.tor(.12,.012,3,8,Math.PI),"#efe6cf",-.2,0,0,0,0,0).add(G.tor(.1,.012,3,8,Math.PI),"#efe6cf",-.32,0,0);
  K.barrel=B().add(G.sph(.1,8,6),["#5f9a52","#4f8a4a"],0,.08,0,0,0,0,1,.85,1).add(G.sph(.02,4,3),"#f4d06f",0,.17,0);
  K.dry=B();for(let i=0;i<6;i++){const a=i/6*Math.PI*2;K.dry.add(G.cyl(.006,.01,.16,3),"#a8843e",Math.cos(a)*.03,.07,Math.sin(a)*.03,Math.sin(a)*.5,0,-Math.cos(a)*.5,1,1,1,up(0,.16))}
  return{K,big:["cactus","cactus","rock","bones"],small:["barrel","dry","dry"],margin:["rock","cactus","rock","dry"]};
}
function buildDecor(group){
  const D=decorKinds(),items={},tiles=new Map();
  const place=(kind,x,z,tile,s,ry)=>{(items[kind]=items[kind]||[]).push({x,z,tile,s,ry})};
  for(let ty=0;ty<V.ROWS;ty++)for(let tx=0;tx<V.COLS;tx++){
    if(geo.PATH.has(tx+","+ty))continue;
    const r=H(tx*7+mapI*31,ty*13+mapI*17),r2=H(ty*3+mapI,tx*5+1),tile=tx+","+ty;
    if(r<.1)place(D.big[Math.floor(r2*D.big.length)],tx+.5+(r2-.5)*.3,ty+.5+(H(tx,ty+9)-.5)*.3,tile,.75+r2*.35,r*60);
    else if(r<.45){const n=1+Math.floor(r2*2);for(let i=0;i<n;i++)place(D.small[Math.floor(H(tx+i,ty*3)*D.small.length)],tx+.15+H(tx*3+i,ty)*.7,ty+.15+H(ty*3+i,tx)*.7,tile,.8+H(i,tx)*.5,H(tx,i)*9)}
  }
  for(let z=V.Z0+.35;z<V.Z1-.2;z+=.62)for(let x=V.X0+.3;x<V.X1-.2;x+=.62){
    const tx=x+V.HX+(H(Math.round(x*10),Math.round(z*10))-.5)*.4,ty=z+V.HZ+(H(Math.round(z*10),Math.round(x*7))-.5)*.4;
    if(tx>-.25&&tx<V.COLS+.25&&ty>-.25&&ty<V.ROWS+.25)continue;
    if(tx>V.COLS+.3)continue;                                     // castle grounds
    if(V.roadDist(tx,ty)<.9)continue;
    if(PORTALS.some(P=>Math.hypot(tx-P.WP0[0]+P.dir[0]*(P.back+.35),ty-P.WP0[1]+P.dir[1]*(P.back+.35))<1.6))continue;   // portals
    const r=H(Math.round(tx*13),Math.round(ty*17));
    if(r<.55)place(D.margin[Math.floor(H(Math.round(ty*7),Math.round(tx*3))*D.margin.length)],tx,ty,null,.85+r*.6,r*40);
    else if(r<.8)place(D.small[Math.floor(r*7)%D.small.length],tx,ty,null,1,r*9);
  }
  const kits=[];
  for(const kind in items){
    const list=items[kind],g=D.K[kind].build(),glow=D.glow&&D.glow.includes(kind);
    const mesh=new THREE.InstancedMesh(g,glow?V.MAT.glow:V.MAT.wind,list.length);mesh.castShadow=!glow;mesh.receiveShadow=true;mesh.frustumCulled=false;
    const base=[];
    list.forEach((it,i)=>{const x=it.x-V.HX,z=it.z-V.HZ,m=V.M(x,V.height(x,z)-.01,z,0,it.ry,0,it.s);mesh.setMatrixAt(i,m);base.push(m);
      if(it.tile){let t=tiles.get(it.tile);if(!t)tiles.set(it.tile,t={s:1,goal:1,items:[]});t.items.push([mesh,i,m])}});
    mesh.instanceMatrix.needsUpdate=true;group.add(mesh);kits.push(mesh);
  }
  decor={kits,tiles};
}
const _dm=new THREE.Matrix4(),_ds=new THREE.Matrix4();
// called every frame with the set of tiles that hold towers; decor shrinks away or grows back
V.decorTick=(occupied,dt)=>{
  if(!decor)return;
  for(const[key,t]of decor.tiles){
    t.goal=occupied.has(key)?0:1;if(t.s===t.goal)continue;
    const was=t.s;t.s=t.goal?Math.min(1,t.s+dt*1.6):Math.max(0,t.s-dt*5);
    if(was===1&&t.goal===0){const[tx,ty]=key.split(",").map(Number);V.fx&&V.fx.leaves(tx+.5-V.HX,ty+.5-V.HZ,theme.key)}
    const s=t.goal?V.ease.back(t.s):t.s;
    for(const[mesh,i,base]of t.items){_ds.makeScale(s||1e-4,s||1e-4,s||1e-4);_dm.multiplyMatrices(base,_ds);mesh.setMatrixAt(i,_dm);mesh.instanceMatrix.needsUpdate=true}
  }
};

// ---------- the floating island: ground, cliffs and the rocks hanging underneath ----------
function buildIsland(group,disp){
  const IW=V.X1-V.X0,ID=V.Z1-V.Z0,nx=Math.round(IW*(V.mobile?3:4)),nz=Math.round(ID*(V.mobile?3:4));
  const g=new THREE.PlaneGeometry(IW,ID,nx,nz);g.rotateX(-Math.PI/2);g.translate((V.X0+V.X1)/2,0,(V.Z0+V.Z1)/2);
  const P=g.attributes.position;for(let i=0;i<P.count;i++)P.setY(i,V.height(P.getX(i),P.getZ(i)));
  g.computeVertexNormals();
  const tex=paintGround(),mat=new THREE.MeshStandardMaterial({map:tex,roughness:.96,metalness:0});
  const top=new THREE.Mesh(g,mat);top.receiveShadow=true;group.add(top);disp.push(g,mat,tex);
  const st=strataTex(),sm=new THREE.MeshStandardMaterial({map:st,roughness:.95,flatShading:true,side:THREE.DoubleSide});disp.push(st,sm);
  const sides=[[V.X0,V.Z1,V.X1,V.Z1],[V.X1,V.Z1,V.X1,V.Z0],[V.X1,V.Z0,V.X0,V.Z0],[V.X0,V.Z0,V.X0,V.Z1]];
  sides.forEach(([ax,az,bx,bz],si)=>{
    const L=Math.hypot(bx-ax,bz-az),n=Math.max(4,Math.round(L*2)),sg=new THREE.PlaneGeometry(L,1,n,3),Q=sg.attributes.position,uv=sg.attributes.uv;
    for(let i=0;i<Q.count;i++){const u=(Q.getX(i)+L/2)/L,row=Math.round((.5-Q.getY(i))*3),x=ax+(bx-ax)*u,z=az+(bz-az)*u;
      const depth=[0,.45,1.05,1.75][row]+(row?(H(i,si*7)-.5)*.25*row:0);
      Q.setXYZ(i,x+(row===3?(H(i,si)-.5)*.3:0),row?V.TOP-depth:V.height(x,z),z+(row===3?(H(si,i)-.5)*.3:0));uv.setXY(i,u*L/3,1-depth/1.8)}
    sg.computeVertexNormals();const mesh=new THREE.Mesh(sg,sm);mesh.receiveShadow=true;group.add(mesh);disp.push(sg)});
  const rb=new V.Build(),rc=theme.strata;
  for(let i=0;i<16;i++){const u=H(i,mapI+3),side=i%4,x=side===1?V.X1-.6:side===3?V.X0+.6:V.lerp(V.X0+1,V.X1-1,u),z=side===0?V.Z1-.6:side===2?V.Z0+.6:V.lerp(V.Z0+1,V.Z1-1,u);
    rb.add(G.cone(.7+H(i,5)*.9,1.6+H(i,9)*2.2,6),[rc[2],rc[3]],x,-1.6-(.8+H(i,9)*1.1),z,Math.PI,H(i,2)*3,0)}
  rb.add(G.cone(6.5,4.2,9),[rc[3],rc[2]],0,-3.2,-.5,Math.PI,0,0,1.7,1,1.05);
  const rg=rb.build(),rocks=new THREE.Mesh(rg,V.MAT.std);group.add(rocks);disp.push(rg);
}

// ---------- the castle at the end of the road ----------
let anim=[]; // animated scenery: flags, windmill, portal, torches
function flag(group,x,y,z,w,h,col,disp){
  const fg=new THREE.PlaneGeometry(w,h,6,2);fg.translate(w/2,0,0);
  const fm=new THREE.MeshStandardMaterial({color:V.col(col),side:THREE.DoubleSide,roughness:.9,flatShading:true});
  const mesh=new THREE.Mesh(fg,fm);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);disp.push(fg,fm);
  const base=fg.attributes.position.array.slice();
  anim.push(t=>{const P=fg.attributes.position;for(let i=0;i<P.count;i++){const bx=base[i*3];P.setZ(i,Math.sin(t*5-bx*7+x)*.06*bx/w+Math.sin(t*3.1-bx*4)*.03*bx/w)}P.needsUpdate=true;fg.computeVertexNormals()});
  return mesh;
}
function buildCastle(group,disp){
  const b=new V.Build(),ST=["#8d939e","#7f858f","#999fa9","#878d97"],roof=theme.roof,ex=geo.EXIT-V.HZ,wx=V.HX+.95,gh=.52,base=V.TOP;
  const wall=(z0,z1)=>{if(z1-z0<.05)return;const L=z1-z0,zm=(z0+z1)/2;b.add(G.box(.42,.95,L),ST,wx,base+.475,zm);
    for(let z=z0+.1;z<z1-.05;z+=.28)b.add(G.box(.13,.15,.14),ST[Math.floor(z*7)&3],wx-.15,base+1.02,z);
    b.add(G.box(.44,.05,L),"#6d737e",wx,base+.95,zm)};
  wall(V.Z0+.5,ex-gh-.42);wall(ex+gh+.42,V.Z1-.4);
  for(const s of[-1,1]){const z=ex+s*(gh+.22);
    b.add(G.cyl(.34,.39,1.4,10),ST,wx,base+.7,z);b.add(G.cyl(.4,.4,.08,10),"#6d737e",wx,base+1.42,z);
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;b.add(G.box(.11,.13,.1),ST[i&3],wx+Math.cos(a)*.36,base+1.52,z+Math.sin(a)*.36,0,-a,0)}
    b.add(G.cone(.46,.62,10),roof,wx,base+1.9,z);b.add(G.cyl(.012,.012,.4,4),"#cfd3dd",wx,base+2.35,z);
    b.add(G.box(.04,.12,.06),"#2a2430",wx-.36,base+.95,z);
    flag(group,wx,base+2.45,z,.36,.2,"#f0b545",disp)}
  for(const s of[-1,1])b.add(G.box(.42,.95,.18),ST,wx,base+.475,ex+s*(gh+.04));
  b.add(G.box(.46,.34,gh*2+.16),ST,wx,base+.95+.04,ex);b.add(G.tor(gh,.06,4,12,Math.PI),"#6d737e",wx-.2,base+.7,ex,0,Math.PI/2,0);
  for(let z=ex-gh+.05;z<ex+gh;z+=.28)b.add(G.box(.13,.15,.14),ST[1],wx-.15,base+1.24,z);
  b.add(G.box(.06,.06,gh*2),"#4a3320",wx-.05,base+.02,ex);
  const kx=V.X1-.78,kz=V.Z0+1.15;
  b.add(G.box(1.1,2.3,1.1),ST,kx,base+1.15,kz);b.add(G.box(1.2,.1,1.2),"#6d737e",kx,base+2.3,kz);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)if(i===0||j===0||i===3||j===3)b.add(G.box(.16,.18,.16),ST[(i+j)&3],kx-.45+i*.3,base+2.44,kz-.45+j*.3);
  b.add(G.cone(.82,1.0,4),roof,kx,base+3.0,kz,0,Math.PI/4,0);
  for(const[wy,wz]of[[1.6,.2],[1.6,-.2],[.9,0]])b.add(G.box(.04,.22,.12),theme.key&&V.tier&&V.tier.night>.5?"#ffd27a":"#2a2430",kx-.56,base+wy,kz+wz);
  b.add(G.cyl(.015,.015,.6,4),"#cfd3dd",kx,base+3.75,kz);
  const g=b.build(),m=new THREE.Mesh(g,V.MAT.std);m.castShadow=true;m.receiveShadow=true;group.add(m);disp.push(g);
  flag(group,kx,base+3.95,kz,.7,.38,"#f0b545",disp);
  // portcullis: drops when the fort falls
  const pg=new V.Build();for(let z=-gh+.08;z<gh;z+=.14)pg.add(G.box(.025,.72,.025),"#30343e",0,0,z);for(let y=-.3;y<.36;y+=.16)pg.add(G.box(.025,.025,gh*2),"#30343e",0,y,0);
  const pgg=pg.build(),port=new THREE.Mesh(pgg,V.MAT.std);port.position.set(wx-.17,base+1.1,ex);group.add(port);disp.push(pgg);
  V.castle={x:wx,z:ex,gate:[wx-.22,base+.4,ex],keep:[kx,base+2.4,kz],port,portY:base+1.1,torches:[[wx-.3,base+.75,ex-gh-.12],[wx-.3,base+.75,ex+gh+.12]]};
  const tb=new V.Build();for(const p of V.castle.torches)tb.add(G.cyl(.02,.025,.32,5),"#4a3320",p[0],p[1]-.18,p[2]).add(G.cyl(.04,.03,.06,6),"#30343e",p[0],p[1]-.02,p[2]);
  const tg=tb.build(),tm=new THREE.Mesh(tg,V.MAT.std);group.add(tm);disp.push(tg);
}

// ---------- the portals the monsters come through ----------
// uOn dims a portal that the current or next wave does not use
const SW=`varying vec2 vUv;uniform float uTime;uniform vec3 uCol;uniform float uOn;
void main(){vec2 p=vUv*2.0-1.0;float r=length(p);if(r>1.0)discard;float a=atan(p.y,p.x);
float s=sin(a*3.0+r*9.0-uTime*(1.2+2.3*uOn))*0.5+0.5;float s2=sin(a*5.0-r*14.0+uTime*2.3)*0.5+0.5;
vec3 c=uCol*(0.35+s*0.9+s2*0.3)+vec3(1.0)*pow(max(0.0,1.0-r),3.0)*0.9;
gl_FragColor=vec4(c*(0.3+0.7*uOn),(0.55+0.45*(1.0-r))*(1.0-smoothstep(0.88,1.0,r))*(0.45+0.55*uOn));}`;
function buildPortal(group,disp){
  V.portals=[];
  const ST=["#5e5868","#4f4a58","#6b6576"],base=V.TOP-.02,rc=new THREE.Color(theme.portal);
  for(const P of PORTALS){
    // built facing +x like the west portal, then turned to face along its road
    const d=P.dir,[ax,az]=[P.WP0[0]-V.HX-d[0]*P.back,P.WP0[1]-V.HZ-d[1]*P.back],grp=new THREE.Group();
    grp.position.set(ax,0,az);grp.rotation.y=Math.atan2(-d[1],d[0]);group.add(grp);
    const b=new V.Build();
    for(const s of[-1,1]){b.add(G.box(.26,1.15,.3),ST,0,base+.575,s*.66);b.add(G.box(.34,.12,.38),"#3e3946",0,base+.06,s*.66)}
    b.add(G.tor(.66,.14,5,12,Math.PI),ST,0,base+1.15,0,0,Math.PI/2,0);b.add(G.box(.3,.22,.24),"#3e3946",0,base+1.82,0);
    // the rock behind the arch, left out on the south edge where it would stand between the camera and the portal
    if(d[1]>-.5)b.add(G.dod(.75),["#3a3542","#2f2b36"],-.75,base+.35,0,0,0,0,1,1.2,1.6);
    else for(const s of[-1,1])b.add(G.dod(.28),["#3a3542","#2f2b36"],-.2,base+.12,s*1.05,0,s,0,1.2,.9,1);
    const g=b.build(),m=new THREE.Mesh(g,V.MAT.std);m.castShadow=true;m.receiveShadow=true;grp.add(m);disp.push(g);
    const rb=new V.Build();for(let i=0;i<7;i++){const a=Math.PI*(i+.5)/7;rb.add(G.box(.06,.08,.02),"#ffffff",.15,base+1.15+Math.sin(a)*.66,Math.cos(a)*.66,0,Math.PI/2,a)}
    const rg=rb.build(),rm=new THREE.Mesh(rg,new THREE.MeshBasicMaterial({color:rc.clone(),vertexColors:true}));grp.add(rm);disp.push(rg,rm.material);
    const sg=new THREE.CircleGeometry(.6,40),sm=new THREE.ShaderMaterial({uniforms:{uTime:V.uTime,uCol:{value:rc.clone()},uOn:{value:1}},
      vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",fragmentShader:SW,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const sw=new THREE.Mesh(sg,sm);sw.position.set(0,base+.68,0);sw.rotation.y=Math.PI/2;sw.scale.set(1,1.05,1);grp.add(sw);disp.push(sg,sm);
    const portal={i:P.i,x:ax+d[0]*.1,y:base+.6,z:az+d[1]*.1,dir:d,col:V.srgb(theme.portal),on:1,goal:1};V.portals.push(portal);
    anim.push((t,dt)=>{portal.on=V.damp(portal.on,portal.goal,3,dt||.016);sm.uniforms.uOn.value=portal.on;
      rm.material.color.copy(rc).multiplyScalar((.75+.35*Math.sin(t*3+P.i*2))*(.35+.65*portal.on))});
  }
  V.portal=V.portals[0];
}

// ---------- landmarks at the back of each island ----------
function buildLandmark(group,disp){
  const b=new V.Build(),k=theme.key,zb=V.Z0+1.2;
  if(k==="lembah"){
    const x=-V.HX+2.2,z=zb,y=V.height(x,z);
    b.add(G.cyl(.38,.55,1.6,8),["#e8dcc4","#d8ccb2"],x,y+.8,z).add(G.cone(.6,.65,8),"#a8433a",x,y+1.92,z).add(G.box(.05,.3,.2),"#4a3320",x+.5,y+.18,z)
     .add(G.box(.04,.16,.12),"#2a2430",x+.4,y+1.1,z);
    const hub=new THREE.Group();hub.position.set(x+.42,y+1.55,z);group.add(hub);
    const bl=new V.Build();for(let i=0;i<4;i++){const a=i*Math.PI/2;bl.add(G.box(.02,1.1,.2),"#efe6d0",0,Math.sin(a)*.6,Math.cos(a)*.6,a,0,0).add(G.box(.03,1.15,.03),"#6b4a2e",0,Math.sin(a)*.58,Math.cos(a)*.58,a,0,0)}
    bl.add(G.cyl(.06,.06,.1,6),"#4a3320",0,0,0,0,0,Math.PI/2);
    const bg=bl.build(),bm=new THREE.Mesh(bg,V.MAT.std);bm.castShadow=true;hub.add(bm);disp.push(bg);anim.push(t=>{hub.rotation.x=t*.9});
    for(let i=0;i<6;i++)b.add(G.box(.04,.25,.04),"#8a6038",-V.HX+4+i*.45,V.height(-V.HX+4+i*.45,zb+.5)+.12,zb+.5).add(G.box(.45,.04,.03),"#8a6038",-V.HX+4.22+i*.45,V.height(-V.HX+4.22+i*.45,zb+.5)+.2,zb+.5);
  }else if(k==="bukit"){
    const x=V.HX-3.2,z=zb+.1,y=V.height(x,z);
    b.add(G.box(.9,.55,.7),["#7a5634","#6b4a2e"],x,y+.27,z).add(G.cone(.72,.42,4),"#f6fafc",x,y+.76,z,0,Math.PI/4,0,1,1,.8).add(G.box(.12,.32,.12),"#5e636e",x+.25,y+.85,z-.15)
     .add(G.box(.04,.18,.2),V.tier&&V.tier.night>.5?"#ffd27a":"#2a2430",x+.46,y+.28,z);
    V.smoke=[x+.25,y+1.05,z-.15];
  }else if(k==="rawa"){
    const x=-V.HX+5.5,z=zb,y=V.height(x,z);
    for(const[dx,dz]of[[.4,.3],[.4,-.3],[-.4,.3],[-.4,-.3]])b.add(G.cyl(.04,.05,.7,5),"#4a3a28",x+dx,y+.2,z+dz);
    b.add(G.box(1,.06,.8),"#6b553b",x,y+.55,z).add(G.box(.8,.45,.6),["#7a6040","#6b553b"],x,y+.8,z).add(G.cone(.72,.45,4),"#8a7a4a",x,y+1.25,z,0,Math.PI/4,0,1.1,1,.9)
     .add(G.box(.04,.15,.15),"#ffd27a",x+.41,y+.85,z);
    V.smoke=null;
  }else{
    const sx=-V.HX+1.6,sz=zb+.1,sy=V.height(sx,sz);
    b.add(G.sph(.55,10,7),"#efe6cf",sx,sy+.4,sz,0,0,0,1.25,.8,1).add(G.box(.7,.18,.55),"#e6dcc0",sx+.55,sy+.12,sz,0,0,-.1)
     .add(G.sph(.13,6,5),"#2a1a10",sx+.35,sy+.5,sz+.25).add(G.sph(.13,6,5),"#2a1a10",sx+.35,sy+.5,sz-.25);
    for(let i=0;i<4;i++)b.add(G.cone(.05,.22,4),"#fff8e8",sx+.75+i*.1,sy+.05,sz+(i%2?.2:-.2),Math.PI,0,0);
    for(let i=0;i<11;i++){const x=sx+1.4+i*1.25,z=zb+.15+Math.sin(i*.9)*.35,y=V.height(x,z);
      b.add(G.tor(.75-i*.02,.085,4,10,Math.PI),["#efe6cf","#e2d6b8"],x,y-.05,z,0,Math.PI/2-.75,0).add(G.sph(.14,6,5),"#e6dcc0",x,y+.68-i*.02,z)}
  }
  if(b.items.length){const g=b.build(),m=new THREE.Mesh(g,V.MAT.std);m.castShadow=true;m.receiveShadow=true;group.add(m);disp.push(g)}
}

// ---------- grass blades swaying in the wind ----------
function buildGrass(group,disp){
  const bc=theme.blade;if(!bc)return;
  const n=(V.mobile?700:1500)*(theme.key==="ular"?.35:1),pos=[],col=[],sw=[],c0=V.col(bc[0]),c1=V.col(bc[1]);let made=0;
  for(let i=0;i<n*3&&made<n;i++){
    const x=V.lerp(V.X0+.2,V.X1-.4,H(i,mapI*3+1)),z=V.lerp(V.Z0+.2,V.Z1-.2,H(mapI*5+2,i));
    const tx=x+V.HX,ty=z+V.HZ;if(tx>V.COLS+.3||V.roadDist(tx,ty)<.62)continue;
    const y=V.height(x,z);if(theme.key==="rawa"&&y<-.03)continue;
    const h=(theme.key==="rawa"?.2:.12)+H(i,7)*.1,a=H(i,9)*Math.PI,w=.025,dx=Math.cos(a)*w,dz=Math.sin(a)*w,lean=(H(i,11)-.5)*.06;
    pos.push(x-dx,y,z-dz, x+dx,y,z+dz, x+lean,y+h,z+lean*.5);
    for(const c of[c0,c0,c1])col.push(c.r,c.g,c.b);sw.push(0,0,h*1.6);made++;
  }
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.setAttribute("aSway",new THREE.Float32BufferAttribute(sw,1));g.computeVertexNormals();
  const mat=V.MAT.wind.clone();mat.side=THREE.DoubleSide;mat.onBeforeCompile=V.MAT.wind.onBeforeCompile;mat.customProgramCacheKey=()=>"bb-wind2";
  const mesh=new THREE.Mesh(g,mat);mesh.receiveShadow=true;group.add(mesh);disp.push(g,mat);
}

// ---------- swamp water ----------
function buildWater(group,disp){
  if(!theme.water)return;
  const cv=document.createElement("canvas");cv.width=cv.height=128;const m=cv.getContext("2d"),img=m.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){const n=V.noise(x/16,y/16)*.6+V.noise(x/6,y/6)*.4,i=(y*128+x)*4;
    const nx=V.noise((x+1)/16,y/16)-V.noise((x-1)/16,y/16),ny=V.noise(x/16,(y+1)/16)-V.noise(x/16,(y-1)/16);
    img.data[i]=128+nx*300;img.data[i+1]=128+ny*300;img.data[i+2]=255*(.8+n*.2);img.data[i+3]=255}
  m.putImageData(img,0,0);
  const nt=new THREE.CanvasTexture(cv);nt.wrapS=nt.wrapT=THREE.RepeatWrapping;nt.repeat.set(6,4);
  const wg=new THREE.PlaneGeometry(V.X1-V.X0-.1,V.Z1-V.Z0-.1);wg.rotateX(-Math.PI/2);wg.translate((V.X0+V.X1)/2,-.035,(V.Z0+V.Z1)/2);
  const wm=new THREE.MeshStandardMaterial({color:V.col(theme.water),roughness:.18,metalness:.1,normalMap:nt,normalScale:new THREE.Vector2(.6,.6),transparent:true,opacity:.86});
  const w=new THREE.Mesh(wg,wm);w.receiveShadow=true;group.add(w);disp.push(wg,wm,nt);
  anim.push((t)=>{nt.offset.set(t*.012,t*.008)});
}

// ---------- sky: gradient, stars and clouds around the island ----------
function skyTex(tier){
  const cv=document.createElement("canvas");cv.width=4;cv.height=256;const m=cv.getContext("2d"),g=m.createLinearGradient(0,0,0,256);
  g.addColorStop(0,tier.sky[0]);g.addColorStop(.55,tier.sky[1]);g.addColorStop(1,tier.sky[2]);m.fillStyle=g;m.fillRect(0,0,4,256);
  const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;return t;
}
let stars=null,clouds=[];
function buildSky(group,disp,tier){
  const n=tier.night>.5?700:0;
  // stars keep a fixed size on screen: the camera's swoop into a game passes through the star shell, and a
  // distance-scaled point next to the lens filled the view as a big square. One in seven is a bigger star.
  if(n){stars=new THREE.Group();group.add(stars);
    for(const big of[0,1]){const pos=[],col=[];
      for(let i=0;i<n;i++){if((i%7===0)!==!!big)continue;const u=H(i,1)*2-1,a=H(i,2)*Math.PI*2,r=60+H(i,3)*25,s=Math.sqrt(1-u*u);pos.push(Math.cos(a)*s*r,u*r*.7-8,Math.sin(a)*s*r);
        const w=.6+H(i,4)*.4;col.push(w,w,w*(tier.n==="Gerhana"?.7:1.05))}
      const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
      const m=new THREE.PointsMaterial({size:big?2.3:1.4,vertexColors:true,transparent:true,opacity:.9,sizeAttenuation:false,fog:false,depthWrite:false});
      stars.add(new THREE.Points(g,m));disp.push(g,m)}}
  clouds=[];const cc=V.srgb(tier.cloud);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2+H(i,5),r=19+H(i,6)*14;clouds.push({x:Math.cos(a)*r,y:-5-H(i,7)*6,z:Math.sin(a)*r*.75-4,s:5+H(i,8)*6,sp:.15+H(i,9)*.25,c:cc,a:tier.night>.5?.35:.55})}
}

// ---------- lights ----------
V.makeLights=()=>{
  const s=V.scene;
  V.hemi=new THREE.HemisphereLight(0xffffff,0x444444,.9);s.add(V.hemi);
  const sun=V.sun=new THREE.DirectionalLight(0xffffff,1);sun.castShadow=true;
  sun.shadow.mapSize.set(V.mobile?1024:2048,V.mobile?1024:2048);
  const c=sun.shadow.camera;c.left=-15;c.right=15;c.top=12;c.bottom=-12;c.near=1;c.far=70;
  sun.shadow.bias=-.0006;sun.shadow.normalBias=.025;
  s.add(sun);s.add(sun.target);
};
function setLights(tier){
  V.hemi.color.set(tier.hemi[0]).convertSRGBToLinear();V.hemi.groundColor.set(tier.hemi[1]).convertSRGBToLinear();V.hemi.intensity=tier.hemi[2];
  V.sun.color.set(tier.sun[0]).convertSRGBToLinear();V.sun.intensity=tier.sun[1];
  const d=new THREE.Vector3(...tier.dir).normalize();V.sun.position.copy(d.multiplyScalar(32));V.sun.target.position.set(0,0,0);
  V.scene.background=skyTex(tier);V.scene.fog=new THREE.Fog(new THREE.Color(tier.fog).convertSRGBToLinear(),38,95);
}

// ---------- build / tear down ----------
let worldGroup=null,disp=[];
V.worldKey="";
V.buildWorld=(mi,tierI)=>{
  const key=mi+":"+tierI;if(key===V.worldKey)return false;V.worldKey=key;
  if(worldGroup){V.scene.remove(worldGroup);for(const d of disp)d.dispose&&d.dispose();if(V.scene.background&&V.scene.background.dispose)V.scene.background.dispose()}
  disp=[];anim=[];decor=null;stars=null;V.smoke=null;
  mapI=mi;geo=BB.game.geo(mi);theme=V.themeOf(mi);V.theme=theme;V.tier=V.TIERS[tierI];V.geo=geo;
  ({seg:roadSeg,steps:roadSteps}=roadsOf(geo));PORTALS=portalsOf(geo);
  // a portal on the south edge needs a wider strip of island below the board (the north strip is wide already)
  V.Z1=V.HZ+(PORTALS.some(P=>P.dir[1]<-.5)?2.1:1.2);
  worldGroup=new THREE.Group();V.scene.add(worldGroup);
  setLights(V.tier);
  buildIsland(worldGroup,disp);buildWater(worldGroup,disp);buildDecor(worldGroup);buildGrass(worldGroup,disp);
  buildCastle(worldGroup,disp);buildPortal(worldGroup,disp);buildLandmark(worldGroup,disp);buildSky(worldGroup,disp,V.tier);
  if(decor)for(const m of decor.kits)disp.push(m.geometry);
  return true;
};
// per-frame scenery animation and the weather
V.worldTick=(dt,t)=>{
  for(const f of anim)f(t,dt);
  if(stars)stars.rotation.y=t*.004;
  if(!V.fxCloud)return;
  for(const c of clouds){c.x+=c.sp*dt;if(c.x>40)c.x-=80;V.fxCloud.place(c)}
  const P=V.PA,PN=V.PN,k=theme.key,ti=V.tier,X0=V.X0,X1=V.X1,Z0=V.Z0,Z1=V.Z1,rx=()=>V.rnd(X0,X1),rz=()=>V.rnd(Z0,Z1);
  if(V.RM)return;
  if(k==="bukit"&&Math.random()<dt*40)PN.add(rx(),V.rnd(3,6),rz(),V.rnd(-.2,.2),-.6,V.rnd(-.1,.1),7,.09,.09,1,1,1,.85,0,0);
  if(k==="ular"&&Math.random()<dt*18)PN.add(X0-1,V.rnd(.1,.9),rz(),V.rnd(2.2,3.4),0,V.rnd(-.2,.2),8,.16,.3,.93,.82,.62,.35,0,0);
  if(k==="rawa"&&Math.random()<dt*5)PN.add(rx(),V.rnd(.1,.4),rz(),V.rnd(-.1,.1),.02,V.rnd(-.1,.1),6,1.2,2.4,.85,.92,.88,.12,0,0);
  if((ti.night>.5||k==="rawa")&&k!=="bukit"&&Math.random()<dt*(ti.night>.5?14:4))P.add(rx(),V.rnd(.2,1.2),rz(),V.rnd(-.2,.2),V.rnd(-.05,.1),V.rnd(-.2,.2),4,.12,.08,k==="rawa"?.6:.85,1,.45,.9,0,.2,1);
  if(k==="lembah"&&ti.night<.5&&Math.random()<dt*8)PN.add(rx(),V.rnd(.2,1),rz(),V.rnd(-.15,.15),V.rnd(-.02,.05),V.rnd(-.15,.15),5,.06,.05,1,.95,.7,.6,0,.3);
  if(ti.n==="Gerhana"&&Math.random()<dt*22)P.add(rx(),0,rz(),V.rnd(-.2,.2),V.rnd(.4,1),V.rnd(-.2,.2),3,.09,.03,1,.45,.2,1,-.05,.3,1);
  if(V.smoke&&Math.random()<dt*6)PN.add(V.smoke[0],V.smoke[1],V.smoke[2],V.rnd(.05,.2),.5,V.rnd(-.05,.05),3,.15,.6,.75,.75,.78,.35,-.05,.4);
};
})();
