// Tampilan 3D, model: material bersama, menara (3 level + penjaga), monster, bos dan proyektil.
// Milik sesi desain. Semua model dibangun dari bentuk dasar low-poly lalu digabung per bagian,
// supaya tiap bagian bisa digambar ratusan kali dalam satu draw call (instancing).
(function(){
"use strict";
const BB=window.BB,V=BB.V,THREE=window.THREE;
if(!THREE)return;
const G=V.G;
const W1="#8a6038",W2="#6b4a2e",W3="#a8784a",WD="#4a3320",GOLD="#e9b949",SKIN="#f3c9a0",INK="#211c28",IRON="#454b58",BRONZE="#b9813f";
const ST=["#8d939e","#7f858f","#999fa9","#878d97"],STL=["#ddd6c6","#cfc7b5","#e6e0d2","#d5cdbc"];
V.TOWER_TOP=[.42,.7,.94]; // where the guardian stands on each base level

V.makeMaterials=()=>{
  const std=o=>new THREE.MeshStandardMaterial(Object.assign({vertexColors:true,flatShading:true,roughness:.84,metalness:0},o));
  V.uTime={value:0};V.uWind={value:.035};
  const wind=std();
  wind.onBeforeCompile=sh=>{
    sh.uniforms.uTime=V.uTime;sh.uniforms.uWind=V.uWind;
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float aSway;uniform float uTime;uniform float uWind;")
      .replace("#include <project_vertex>",`vec4 mvPosition=vec4(transformed,1.0);
#ifdef USE_INSTANCING
mvPosition=instanceMatrix*mvPosition;
#endif
float sw=aSway*uWind;
mvPosition.x+=sin(uTime*1.7+mvPosition.x*0.6+mvPosition.z*0.45)*sw;
mvPosition.z+=cos(uTime*1.3+mvPosition.x*0.4-mvPosition.z*0.3)*sw*0.6;
mvPosition=modelViewMatrix*mvPosition;
gl_Position=projectionMatrix*mvPosition;`);
  };
  wind.customProgramCacheKey=()=>"bb-wind";
  V.MAT={
    std:std(),
    gloss:std({flatShading:false,roughness:.32}),
    cloth:std({side:THREE.DoubleSide,roughness:.92}),
    glow:new THREE.MeshBasicMaterial({vertexColors:true}),
    wing:std({transparent:true,opacity:.5,roughness:.25,side:THREE.DoubleSide,depthWrite:false}),
    ghost:new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,transparent:true,opacity:.55,depthWrite:false,roughness:.6,emissive:new THREE.Color(.12,.12,.12)}),
    wind
  };
};

// a little guardian; std parts into b, owner-coloured parts (white, tinted per player) into c
function chibi(b,c,ox,oz,s){
  ox=ox||0;oz=oz||0;s=s||1;
  b.add(G.cap(.03*s,.05*s,2,6),"#3b3346",ox,.06*s,oz+.042*s);b.add(G.cap(.03*s,.05*s,2,6),"#3b3346",ox,.06*s,oz-.042*s);
  c.add(G.cyl(.068*s,.092*s,.17*s,8),"#ffffff",ox,.18*s,oz);
  b.add(G.cyl(.094*s,.094*s,.026*s,8),"#5a3d22",ox,.13*s,oz);
  b.add(G.box(.02*s,.022*s,.024*s),GOLD,ox+.092*s,.13*s,oz);
  b.add(G.sph(.085*s,10,8),SKIN,ox,.33*s,oz);
  b.add(G.sph(.014*s,5,4),INK,ox+.076*s,.338*s,oz+.03*s);b.add(G.sph(.014*s,5,4),INK,ox+.076*s,.338*s,oz-.03*s);
  b.add(G.sph(.016*s,5,4),"#f29c8a",ox+.068*s,.312*s,oz+.052*s);b.add(G.sph(.016*s,5,4),"#f29c8a",ox+.068*s,.312*s,oz-.052*s);
}

V.makeModels=()=>{
  const M=V.MAT,B=()=>new V.Build();
  // ---------- tower bases ----------
  let b=B();
  for(const[sx,sz]of[[1,1],[1,-1],[-1,1],[-1,-1]]){b.add(G.cyl(.045,.055,.36,6),W2,.31*sx,.18,.31*sz);b.add(G.dod(.075),ST,.31*sx,.02,.31*sz)}
  b.add(G.box(.82,.07,.82),W1,0,.37,0);
  for(let i=0;i<4;i++)b.add(G.box(.8,.016,.185),i%2?W3:"#7f5734",0,.41,-.3+i*.2);
  for(const s of[1,-1]){b.add(G.box(.66,.035,.03),W2,0,.19,.31*s,0,0,.5);b.add(G.box(.03,.035,.66),W2,.31*s,.19,0,.5,0,0)}
  b.add(G.cyl(.014,.014,.48,5),WD,-.36,.63,-.36);b.add(G.sph(.025,6,4),GOLD,-.36,.88,-.36);
  V.defKit("tb1",b.build(),M.std,130);
  b=B();b.add(G.tri(.22,.13),"#ffffff");V.defKit("tb1c",b.build(),M.cloth,130);

  b=B();
  b.add(G.cyl(.4,.46,.06,8),"#5d636e",0,.03,0);
  b.add(G.cyl(.36,.41,.6,8),ST,0,.33,0);
  b.add(G.cyl(.43,.43,.07,8),"#6d737e",0,.665,0);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8;b.add(G.box(.12,.1,.1),ST[i%4],Math.cos(a)*.38,.75,Math.sin(a)*.38,0,-a,0)}
  b.add(G.box(.05,.22,.16),"#4a3320",.385,.14,0);b.add(G.cyl(.08,.08,.05,8),"#4a3320",.385,.25,0,0,0,Math.PI/2);
  for(const a of[Math.PI/2,-Math.PI/2,Math.PI])b.add(G.box(.04,.1,.05),"#2a2430",Math.cos(a)*.385,.45,Math.sin(a)*.385,0,-a,0);
  V.defKit("tb2",b.build(),M.std,130);
  b=B();b.add(G.box(.014,.26,.18),"#ffffff",0,-.13,0);b.add(G.box(.014,.05,.18),"#ffffff",0,-.27,0,0,0,0,1,1,.6);V.defKit("tb2c",b.build(),M.cloth,130);

  b=B();
  b.add(G.cyl(.44,.5,.08,8),"#9c958a",0,.04,0);
  b.add(G.cyl(.39,.44,.78,8),STL,0,.47,0);
  b.add(G.tor(.425,.03,4,16),GOLD,0,.28,0,Math.PI/2,0,0);b.add(G.tor(.4,.03,4,16),GOLD,0,.8,0,Math.PI/2,0,0);
  b.add(G.cyl(.47,.47,.08,8),"#c9c1b0",0,.9,0);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8;b.add(G.box(.12,.11,.1),STL[i%4],Math.cos(a)*.41,.995,Math.sin(a)*.41,0,-a,0);b.add(G.cone(.05,.07,4),GOLD,Math.cos(a)*.41,1.085,Math.sin(a)*.41,0,-a+Math.PI/4,0)}
  b.add(G.box(.05,.26,.18),"#3a2818",.43,.17,0);b.add(G.tor(.1,.02,3,10,Math.PI),GOLD,.445,.3,0,0,Math.PI/2,0);
  for(const a of[Math.PI/2,-Math.PI/2,Math.PI])b.add(G.box(.04,.12,.05),"#2a2430",Math.cos(a)*.42,.58,Math.sin(a)*.42,0,-a,0);
  V.defKit("tb3",b.build(),M.std,130);
  b=B();b.add(G.box(.014,.3,.15),"#ffffff",0,-.15,0);b.add(G.box(.014,.06,.15),"#ffffff",0,-.31,0,0,0,0,1,1,.55);V.defKit("tb3c",b.build(),M.cloth,260);
  b=B();b.add(G.oct(.055),"#ffffff",0,0,0,0,0,0,1,1.3,1);V.defKit("tb3g",b.build(),M.glow,130,false);

  // ---------- guardians, one kit per tower type and level (weapon changes with the level) ----------
  const cloth=[];
  // archer
  for(let l=1;l<=3;l++){
    b=B();const c=B();chibi(b,c);
    c.add(G.cone(.1,.17,8),"#ffffff",-.015,.4,0,0,0,.35);c.add(G.tor(.072,.022,4,10),"#ffffff",0,.255,0,Math.PI/2,0,0);
    b.add(G.cyl(.032,.028,.19,6),"#7a4a2a",-.09,.25,.045,0,0,.35);
    for(let i=0;i<3;i++)b.add(G.cone(.014,.045,4),i===1?"#e5625a":"#f2ecdc",-.13+i*.012,.36,.03+i*.014);
    b.add(G.cap(.022,.07,2,5),SKIN,.05,.22,-.055,0,0,-1.3);b.add(G.cap(.022,.06,2,5),SKIN,.03,.22,.06,0,0,-1.1);
    const bow=["#6b4a2e","#3c3540",GOLD][l-1];
    b.add(G.tor(.17,.014,4,10,Math.PI*.9),bow,-.04,.22,-.035,0,0,-Math.PI*.45);
    b.add(G.box(.005,.335,.005),"#efe6d0",-.013,.22,-.035);
    if(l>=2){b.add(G.cone(.018,.05,4),"#d8dde6",.0,.39,-.035);b.add(G.cone(.018,.05,4),"#d8dde6",.0,.05,-.035,Math.PI,0,0)}
    if(l===3){b.add(G.tor(.088,.012,3,10),GOLD,-.005,.4,0,Math.PI/2,0,0);b.add(G.oct(.03),"#ff6b8a",.13,.22,-.035)}
    V.defKit("c0_"+l,b.build(),M.std,130);if(l===1)cloth[0]=c;
  }
  b=B();b.add(G.cyl(.007,.007,.3,4),"#e8d9b0",.12,0,0,0,0,-Math.PI/2);b.add(G.cone(.02,.06,4),"#dfe3ea",.29,0,0,0,0,-Math.PI/2);
  b.add(G.box(.05,.003,.03),"#e5625a",-.02,0,.012);b.add(G.box(.05,.003,.03),"#e5625a",-.02,0,-.012);V.defKit("nock",b.build(),M.std,130);
  // cannon crew
  for(let l=1;l<=3;l++){
    b=B();const c=B();
    b.add(G.box(.32,.09,.2),W1,-.03,.1,0);b.add(G.box(.14,.05,.18),W2,-.17,.06,0,0,0,.3);
    for(const s of[1,-1]){b.add(G.cyl(.1,.1,.035,10),W2,.02,.1,.125*s,Math.PI/2,0,0);b.add(G.tor(.1,.014,3,12),IRON,.02,.1,.125*s);b.add(G.cyl(.025,.025,.06,6),IRON,.02,.1,.135*s,Math.PI/2,0,0)}
    const bar=(z,r0,r1,len,col)=>{b.add(G.cyl(r0,r1,len,10),col,.1,.2,z,0,0,-Math.PI/2+.22);b.add(G.tor(r0+.008,.016,4,10),col===BRONZE?"#8a5a24":"#30343e",.1+Math.cos(.22)*len/2,.2+Math.sin(.22)*len/2,z,0,Math.PI/2,0);
      b.add(G.sph(r1*.8,8,6),col,.1-Math.cos(.22)*len/2,.2-Math.sin(.22)*len/2,z);for(const f of[-.15,.12])b.add(G.tor(r1+(r0-r1)*(f+.5)+.006,.01,3,10),l===3?GOLD:"#30343e",.1+Math.cos(.22)*len*f,.2+Math.sin(.22)*len*f,z,0,Math.PI/2,0)};
    if(l===1)bar(0,.056,.074,.38,BRONZE);else if(l===2)bar(0,.064,.086,.42,IRON);else{bar(.068,.055,.07,.42,IRON);bar(-.068,.055,.07,.42,IRON)}
    chibi(b,c,-.22,-.17,.78);b.add(G.hemi(.075,8,4),IRON,-.22,.272,-.17);
    b.add(G.cyl(.01,.012,.2,5),W2,-.13,.2,-.25,0,0,-.4);
    V.defKit("c1_"+l,b.build(),M.std,130);if(l===1)cloth[1]=c;
  }
  b=B();b.add(G.oct(.04),"#ffd27a",0,0,0,0,0,0,1,1.6,1);V.defKit("flame",b.build(),M.glow,130,false);
  // frost mage
  for(let l=1;l<=3;l++){
    b=B();const c=B();
    b.add(G.cap(.03,.04,2,6),"#3b3346",0,.05,.04);b.add(G.cap(.03,.04,2,6),"#3b3346",0,.05,-.04);
    c.add(G.cone(.14,.3,8),"#ffffff",0,.15,0);c.add(G.cap(.025,.07,2,5),"#ffffff",.05,.22,.08,-.7,0,-.5);c.add(G.cap(.025,.07,2,5),"#ffffff",.05,.22,-.08,.7,0,-.5);
    b.add(G.tor(.135,.016,3,10),"#e8f6ff",0,.02,0,Math.PI/2,0,0);
    b.add(G.sph(.085,10,8),SKIN,0,.31,0);b.add(G.sph(.014,5,4),INK,.076,.318,.03);b.add(G.sph(.014,5,4),INK,.076,.318,-.03);
    b.add(G.cone(.045,.1,5),"#f4f4f4",.065,.245,0,0,0,Math.PI);
    const hat=["#2f4f9a","#3a3f9c","#25306e"][l-1];
    b.add(G.cyl(.14,.14,.02,10),hat,0,.37,0);b.add(G.cone(.105,.27,8),hat,-.03,.5,0,0,0,.3);
    b.add(G.tor(.1,.012,3,10),l===3?GOLD:l===2?"#d8dde6":"#8fb3e0",0,.385,0,Math.PI/2,0,0);
    b.add(G.cyl(.012,.014,.5,5),l===3?GOLD:"#c9b48a",.07,.23,.12);b.add(G.oct(.035),"#bfe9ff",.07,.5,.12);
    V.defKit("c2_"+l,b.build(),M.std,130);if(l===1)cloth[2]=c;
  }
  for(let l=1;l<=3;l++){b=B();b.add(G.oct(.065+.012*l),"#c8f2ff",0,0,0,0,0,0,1,1.7,1);V.defKit("crys"+l,b.build(),M.glow,130,false)}
  b=B();b.add(G.oct(.026),"#e6fbff",0,0,0,0,0,0,1,1.5,1);V.defKit("shard",b.build(),M.glow,700,false);
  // marksman
  for(let l=1;l<=3;l++){
    b=B();const c=B();chibi(b,c);
    c.add(G.cyl(.092,.098,.035,10),"#ffffff",-.012,.405,0,0,0,.22);c.add(G.sph(.02,5,4),"#ffffff",-.02,.43,0);
    b.add(G.cap(.022,.07,2,5),SKIN,.07,.24,-.06,0,0,-1.4);b.add(G.cap(.022,.07,2,5),SKIN,.0,.22,.06,0,0,-1.1);
    const gb=l===3?GOLD:IRON;
    b.add(G.cyl(.014,.017,.52+.04*l,6),IRON,.17,.235,-.05,0,0,-Math.PI/2);
    b.add(G.box(.17,.05,.036),l===3?"#3a2818":W1,-.06,.22,-.05);
    b.add(G.cyl(.023,.023,.13,8),"#3a3f4c",.08,.275,-.05,0,0,-Math.PI/2);
    b.add(G.tor(.024,.008,3,8),gb,.145,.275,-.05,0,Math.PI/2,0);b.add(G.tor(.024,.008,3,8),gb,.015,.275,-.05,0,Math.PI/2,0);
    if(l>=2){b.add(G.cyl(.024,.024,.08,8),"#2a2d36",.47+.02*l,.235,-.05,0,0,-Math.PI/2)}
    for(const s of[1,-1])b.add(G.cyl(.008,.008,.2,4),IRON,.3,.15,-.05+.04*s,.35*s,0,0);
    V.defKit("c3_"+l,b.build(),M.std,130);if(l===1)cloth[3]=c;
  }
  b=B();b.add(G.cyl(.019,.019,.01,8),"#e4b8ff",0,0,0,0,0,-Math.PI/2);V.defKit("lens",b.build(),M.glow,130,false);
  cloth.forEach((c,t)=>V.defKit("c"+t+"c",c.build(),M.cloth,130));

  // ---------- monsters (modelled around a body radius of .5, scaled from the logic's EN[t].r) ----------
  // slime
  b=B();
  b.add(G.lathe([[0,0],[.42,0],[.5,.07],[.52,.19],[.47,.35],[.36,.49],[.2,.59],[0,.62]],14),(x,y)=>y<.1?"#5f9f45":y>.42?"#b6ea8a":"#8fd16a");
  b.add(G.sph(.09,8,6),"#ffffff",-.12,.5,.16,0,0,0,1.4,.7,1);
  b.add(G.tor(.075,.016,3,8,Math.PI),INK,.47,.21,0,0,Math.PI/2,Math.PI);
  V.defKit("m0",b.build(),M.gloss,320);
  b=B();for(const s of[1,-1]){b.add(G.sph(.11,8,6),"#ffffff",.4,.4,.15*s);b.add(G.sph(.055,6,5),INK,.49,.41,.15*s);b.add(G.sph(.02,4,3),"#ffffff",.53,.44,.13*s)}
  V.defKit("m0e",b.build(),M.std,320);
  // wasp
  b=B();
  b.add(G.sph(.3,10,7),"#f5d33a",-.32,0,0,0,0,0,1.25,.88,.88);
  for(const[x,r]of[[-.22,.255],[-.4,.24]])b.add(G.tor(r,.045,4,12),"#2a2416",x,0,0,0,Math.PI/2,0);
  b.add(G.cone(.05,.17,5),"#2a2416",-.72,0,0,0,0,Math.PI/2);
  b.add(G.sph(.2,8,6),"#3b3020",0,.02,0);
  b.add(G.sph(.19,8,6),"#f5e07a",.25,.05,0);
  for(const s of[1,-1]){b.add(G.sph(.085,6,5),INK,.33,.1,.1*s);b.add(G.cyl(.01,.01,.22,4),"#2a2416",.33,.25,.06*s,.35*s,0,-.5)}
  for(let i=0;i<3;i++)for(const s of[1,-1])b.add(G.cyl(.012,.012,.2,4),"#2a2416",-.08+i*.08,-.12,.1*s,.5*s,0,0);
  V.defKit("m1",b.build(),M.std,200);
  b=B();b.add(G.sph(.3,8,4),"#e8f6ff",-.1,0,.32,0,0,0,1,.06,.5);V.defKit("m1w",b.build(),M.wing,400,false);
  // turtle
  b=B();
  b.add(G.cyl(.5,.45,.12,10),"#d9c28a",0,.1,0,0,0,0,1.12,1,.98);
  b.add(G.cyl(.56,.58,.07,10),"#c9a46a",0,.18,0,0,0,0,1.12,1,.98);
  b.add(new THREE.SphereGeometry(.5,9,5,0,Math.PI*2,0,Math.PI/2),["#7a5a38","#8b6a42","#6d4f30","#9a7448","#83623c"],0,.2,0,0,0,0,1.12,.72,.98);
  b.add(G.cone(.06,.15,5),"#7d9c4f",-.62,.14,0,0,0,Math.PI/2);
  V.defKit("m2",b.build(),M.std,200);
  b=B();b.add(G.cyl(.085,.1,.2,6),"#7d9c4f",0,-.1,0);b.add(G.sph(.1,6,4),"#6f8c44",.03,-.2,0,0,0,0,1.2,.5,1);V.defKit("m2l",b.build(),M.std,800);
  b=B();b.add(G.cyl(.07,.08,.16,6),"#7d9c4f",.08,0,0,0,0,-Math.PI/2);b.add(G.sph(.14,8,6),"#86a85a",.2,.03,0);
  for(const s of[1,-1]){b.add(G.sph(.03,5,4),INK,.3,.07,.06*s)}b.add(G.tor(.04,.01,3,6,Math.PI),INK,.33,.0,0,0,Math.PI/2,Math.PI);
  V.defKit("m2h",b.build(),M.std,200);
  // the king (boss)
  b=B();
  b.add(G.sph(.5,12,9),(x)=>x>.3?"#f0a089":"#d9534a",0,.56,0,0,0,0,1,.95,1);
  for(const s of[1,-1]){b.add(G.box(.12,.035,.05),"#3a1a1a",.43,.8,.15*s,.4*s,0,-.25*s);b.add(G.cone(.03,.09,4),"#fff6e0",.44,.42,.12*s)}
  b.add(G.box(.06,.05,.22),"#3a1010",.46,.38,0);
  for(const s of[1,-1])b.add(G.cone(.07,.26,5),"#3a2a2a",.05,1.03,.3*s,.55*s,0,0);
  b.add(G.cyl(.25,.28,.16,8,true),GOLD,-.03,1.03,0);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;b.add(G.cone(.05,.14,4),GOLD,-.03+Math.cos(a)*.26,1.17,Math.sin(a)*.26)}
  V.defKit("m3",b.build(),M.std,40);
  b=B();for(const s of[1,-1])b.add(G.sph(.07,6,5),"#ffe36a",.43,.7,.15*s,0,0,0,1,.8,1);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2+Math.PI/5;b.add(G.oct(.035),"#ff3a5a",-.03+Math.cos(a)*.27,1.04,Math.sin(a)*.27)}
  b.add(G.sph(.08,6,5),"#ff4a6a",.55,1.05,-.42);
  V.defKit("m3g",b.build(),M.glow,40,false);
  b=B();b.add(new THREE.CylinderGeometry(.5,.66,.78,10,1,true,Math.PI,Math.PI),"#5b2a7a",0,-.39,0);b.add(G.tor(.5,.04,3,10,Math.PI),GOLD,0,0,0,Math.PI/2,0,Math.PI*.5);
  V.defKit("m3c",b.build(),M.cloth,40);
  b=B();b.add(G.cap(.11,.22,3,7),"#d9534a",0,-.17,0);b.add(G.sph(.12,7,5),"#c94a42",0,-.38,0);V.defKit("m3a",b.build(),M.std,80);
  b=B();b.add(G.cap(.12,.12,3,7),"#a8403a",0,-.12,0);b.add(G.box(.22,.07,.16),"#3a1a1a",.04,-.25,0);V.defKit("m3l",b.build(),M.std,80);
  b=B();b.add(G.cyl(.022,.022,.9,6),GOLD,0,.0,0);b.add(G.tor(.07,.015,3,8),GOLD,0,.45,0);V.defKit("m3s",b.build(),M.std,40);
  // anything the logic adds without a model: a tinted blob with eyes
  b=B();b.add(G.ico(.5,1),"#ffffff",0,.5,0);for(const s of[1,-1]){b.add(G.sph(.1,6,5),"#ffffff",.42,.6,.16*s);b.add(G.sph(.05,6,4),INK,.5,.61,.16*s)}
  V.defKit("mx",b.build(),M.std,200);

  // ---------- projectiles and debris ----------
  b=B();b.add(G.cyl(.012,.012,.42,4),"#d9c08a",0,0,0,0,0,-Math.PI/2);b.add(G.cone(.03,.08,4),"#e8ecf2",.23,0,0,0,0,-Math.PI/2);
  b.add(G.box(.08,.004,.05),"#e5625a",-.18,0,.02);b.add(G.box(.08,.004,.05),"#e5625a",-.18,0,-.02);V.defKit("pArrow",b.build(),M.std,200);
  b=B();b.add(G.sph(.1,8,6),"#2b2b33");b.add(G.sph(.03,4,3),"#8a8f9a",.05,.06,.03);V.defKit("pBall",b.build(),M.std,100);
  b=B();b.add(G.oct(.09),"#dff8ff",0,0,0,0,0,0,1.7,1,1);V.defKit("pIce",b.build(),M.glow,100,false);
  b=B();b.add(G.dod(.32),["#4a3428","#3a2a22","#5a4030"]);V.defKit("pMeteor",b.build(),M.std,40);
  b=B();b.add(G.cyl(.07,.07,.022,10),"#f3c64e",0,0,0,Math.PI/2,0,0);b.add(G.cyl(.045,.045,.026,8),"#ffe08a",0,0,0,Math.PI/2,0,0);V.defKit("coin",b.build(),M.std,160);
  b=B();b.add(G.tet(.06),"#ffffff");V.defKit("chunk",b.build(),M.std,500);
  // a bird (or a bat at night): body plus one wing; the wing is drawn twice, mirrored
  b=B();b.add(G.sph(.06,6,4),"#ffffff",0,0,0,0,0,0,1.8,.8,.8);b.add(G.cone(.03,.07,4),"#ffffff",.13,0,0,0,0,-Math.PI/2);V.defKit("bird",b.build(),M.std,24);
  b=B();b.add(G.tri(.12,.26),"#ffffff",-.06,0,0,-Math.PI/2,0,0);V.defKit("birdw",b.build(),M.cloth,48);
};
})();
