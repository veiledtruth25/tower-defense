// Tampilan 3D, bagian inti: matematika kecil, warna, penggabung geometri, kit instancing,
// partikel dan kit efek. Milik sesi desain. File js/view/*.js lain memakainya lewat BB.V.
(function(){
"use strict";
const BB=window.BB,THREE=window.THREE,V=BB.V={ok:false};
if(!THREE)return;
const COLS=20,ROWS=12;
Object.assign(V,{COLS,ROWS,HX:COLS/2,HZ:ROWS/2});
// the floating island around the 20×12 board: room on the left for the portal, on the right for
// the castle, and at the back for each map's landmark. One tile is one world unit.
Object.assign(V,{X0:-COLS/2-1.8,X1:COLS/2+2.4,Z0:-ROWS/2-2.6,Z1:ROWS/2+1.2,TOP:.07});
V.RM=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
V.mobile=Math.min(screen.width||1e4,screen.height||1e4)<760;

// ---------- small math ----------
V.clamp=(v,a,b)=>v<a?a:v>b?b:v;
V.lerp=(a,b,t)=>a+(b-a)*t;
V.smooth=(a,b,x)=>{const t=V.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
V.damp=(a,b,k,dt)=>b+(a-b)*Math.exp(-k*dt); // frame-rate independent ease of a toward b
V.dampAng=(a,b,k,dt)=>{let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*(1-Math.exp(-k*dt))};
V.hash=(x,y)=>{let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295};
V.rnd=(a,b)=>a+Math.random()*(b-a);
V.noise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=V.hash(xi,yi),b=V.hash(xi+1,yi),c=V.hash(xi,yi+1),d=V.hash(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};
V.ease={out:t=>1-Math.pow(1-t,3),inOut:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  back:t=>{const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)},
  bounce:t=>{const n=7.5625,d=2.75;if(t<1/d)return n*t*t;if(t<2/d)return n*(t-=1.5/d)*t+.75;if(t<2.5/d)return n*(t-=2.25/d)*t+.9375;return n*(t-=2.625/d)*t+.984375}};

// ---------- colours: authored as sRGB hex, stored linear for lit materials ----------
const CC=new Map();
V.col=h=>{if(h&&h.isColor)return h;let c=CC.get(h);if(!c){c=new THREE.Color(h).convertSRGBToLinear();CC.set(h,c)}return c};
V.srgb=h=>{const c=new THREE.Color(h);return[c.r,c.g,c.b]}; // for unlit shader effects

// ---------- transforms ----------
const _e=new THREE.Euler(),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3();
V.M=(x,y,z,rx,ry,rz,sx,sy,sz,out)=>{
  if(sx==null)sx=1;if(sy==null)sy=sx;if(sz==null)sz=sx;
  _e.set(rx||0,ry||0,rz||0,"YXZ");_q.setFromEuler(_e);_p.set(x,y,z);_s.set(sx,sy,sz);
  return(out||new THREE.Matrix4()).compose(_p,_q,_s);
};
const _L=new THREE.Matrix4(),_W=new THREE.Matrix4();
// push one part of an entity: root × local(x,y,z, rotation, scale), tinted r,g,b (linear, 1 = as modelled)
V.put=(k,root,x,y,z,rx,ry,rz,sx,sy,sz,r,g,b)=>{V.M(x,y,z,rx,ry,rz,sx,sy,sz,_L);_W.multiplyMatrices(root,_L);k.push(_W,r,g,b)};

// ---------- primitive shapes (low poly on purpose; flat shading gives the facets) ----------
V.G={
  box:(w,h,d)=>new THREE.BoxGeometry(w,h,d),
  cyl:(rt,rb,h,s,open)=>new THREE.CylinderGeometry(rt,rb,h,s||8,1,!!open),
  cone:(r,h,s)=>new THREE.ConeGeometry(r,h,s||8),
  sph:(r,w,h)=>new THREE.SphereGeometry(r,w||10,h||7),
  hemi:(r,w,h)=>new THREE.SphereGeometry(r,w||10,h||4,0,Math.PI*2,0,Math.PI/2),
  ico:(r,d)=>new THREE.IcosahedronGeometry(r,d||0),
  dod:r=>new THREE.DodecahedronGeometry(r,0),
  oct:r=>new THREE.OctahedronGeometry(r,0),
  tet:r=>new THREE.TetrahedronGeometry(r,0),
  tor:(r,t,rs,ts,arc)=>new THREE.TorusGeometry(r,t,rs||4,ts||12,arc==null?Math.PI*2:arc),
  cap:(r,l,cs,rs)=>new THREE.CapsuleGeometry(r,l,cs||2,rs||7),
  lathe:(pts,s)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),s||10),
  plane:(w,h,a,b)=>new THREE.PlaneGeometry(w,h,a||1,b||1),
  // flat triangle (a pennant) in the XY plane, pinned at x=0
  tri:(w,h)=>{const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute([0,0,0,w,h/2,0,0,h,0, 0,0,0,0,h,0,w,h/2,0],3));g.computeVertexNormals();return g}
};

// ---------- merging many coloured parts into one geometry ----------
// colour: hex, THREE.Color, an array (cycled per triangle: masonry, shell plates) or fn(x,y,z)->hex
// sway: number or fn(x,y,z) for the wind shader (0 = rigid)
V.Build=class{
  constructor(){this.items=[]}
  add(geo,col,x,y,z,rx,ry,rz,sx,sy,sz,sway){this.items.push({geo,col,m:V.M(x||0,y||0,z||0,rx,ry,rz,sx,sy,sz),sway:sway||0});return this}
  addM(geo,col,m,sway){this.items.push({geo,col,m,sway:sway||0});return this}
  build(){
    let n=0;const parts=[];
    for(const it of this.items){const g=it.geo.index?it.geo.toNonIndexed():it.geo.clone();it.geo.dispose();g.applyMatrix4(it.m);if(!g.attributes.normal)g.computeVertexNormals();parts.push([g,it]);n+=g.attributes.position.count}
    const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3),sw=new Float32Array(n);let o=0;
    for(const[g,it]of parts){
      const P=g.attributes.position.array,N=g.attributes.normal.array,cnt=g.attributes.position.count,c=it.col;
      pos.set(P,o*3);nor.set(N,o*3);
      const pal=Array.isArray(c)?c.map(V.col):null,fn=typeof c==="function"?c:null,one=pal||fn?null:V.col(c);
      for(let i=0;i<cnt;i++){
        const cc=one||(pal?pal[Math.floor(i/3)%pal.length]:V.col(fn(P[i*3],P[i*3+1],P[i*3+2])));
        col[(o+i)*3]=cc.r;col[(o+i)*3+1]=cc.g;col[(o+i)*3+2]=cc.b;
        sw[o+i]=typeof it.sway==="function"?it.sway(P[i*3],P[i*3+1],P[i*3+2]):it.sway;
      }
      o+=cnt;g.dispose();
    }
    const G=new THREE.BufferGeometry();
    G.setAttribute("position",new THREE.BufferAttribute(pos,3));G.setAttribute("normal",new THREE.BufferAttribute(nor,3));
    G.setAttribute("color",new THREE.BufferAttribute(col,3));G.setAttribute("aSway",new THREE.BufferAttribute(sw,1));
    G.computeBoundingSphere();return G;
  }
};

// ---------- instanced kits: every frame each entity pushes its parts, then the kit is flushed ----------
V.Kit=class{
  constructor(geo,mat,cap,shadow){
    const m=this.mesh=new THREE.InstancedMesh(geo,mat,cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cap*3).fill(1),3);m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled=false;m.castShadow=!!shadow;m.receiveShadow=true;m.count=0;m.visible=false;
    this.cap=cap;this.n=0;
  }
  push(mat,r,g,b){
    if(this.n>=this.cap)return;
    mat.toArray(this.mesh.instanceMatrix.array,this.n*16);
    const c=this.mesh.instanceColor.array,i=this.n*3;c[i]=r==null?1:r;c[i+1]=g==null?1:g;c[i+2]=b==null?1:b;this.n++;
  }
  flush(){
    const m=this.mesh,n=this.n;m.count=n;m.visible=n>0;
    if(n){m.instanceMatrix.updateRange.count=n*16;m.instanceMatrix.needsUpdate=true;m.instanceColor.updateRange.count=n*3;m.instanceColor.needsUpdate=true}
    this.n=0;
  }
};
V.KDEF=[];V.K={};V.KSETS=[V.K];
// define a kit once; it exists in the main scene and, lazily, in the icon scene
V.defKit=(name,geo,mat,cap,shadow)=>{V.KDEF.push({name,geo,mat,cap,shadow:shadow!==false});const k=new V.Kit(geo,mat,cap,shadow!==false);V.K[name]=k;V.scene.add(k.mesh);return k};
V.flushKits=set=>{for(const k in set)set[k].flush()};

// ---------- shader effects: soft particles and instanced quads (glows, rings, beams, decals) ----------
const PV=`attribute vec4 aCol;attribute float aSize;varying vec4 vCol;uniform float uScale;
void main(){vCol=aCol;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uScale/max(0.5,-mv.z);gl_Position=projectionMatrix*mv;}`;
const PF=`varying vec4 vCol;
void main(){vec2 c=gl_PointCoord-0.5;float d=dot(c,c)*4.0;if(d>1.0)discard;
#if SOFT
float a=1.0-d;a*=a;
#else
float a=1.0-smoothstep(0.5,1.0,d);
#endif
gl_FragColor=vec4(vCol.rgb,vCol.a*a);}`;
V.Particles=class{
  constructor(cap,additive){
    this.cap=cap;this.n=0;
    this.p=new Float32Array(cap*3);this.v=new Float32Array(cap*3);this.life=new Float32Array(cap);this.max=new Float32Array(cap);
    this.s0=new Float32Array(cap);this.s1=new Float32Array(cap);this.c=new Float32Array(cap*4);this.g=new Float32Array(cap);this.dr=new Float32Array(cap);this.fl=new Float32Array(cap);
    const geo=new THREE.BufferGeometry();
    this.aPos=new THREE.BufferAttribute(new Float32Array(cap*3),3).setUsage(THREE.DynamicDrawUsage);
    this.aCol=new THREE.BufferAttribute(new Float32Array(cap*4),4).setUsage(THREE.DynamicDrawUsage);
    this.aSize=new THREE.BufferAttribute(new Float32Array(cap),1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position",this.aPos);geo.setAttribute("aCol",this.aCol);geo.setAttribute("aSize",this.aSize);geo.setDrawRange(0,0);
    this.mat=new THREE.ShaderMaterial({uniforms:{uScale:{value:600}},vertexShader:PV,fragmentShader:PF,defines:{SOFT:additive?1:0},
      transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
    this.pts=new THREE.Points(geo,this.mat);this.pts.frustumCulled=false;this.pts.renderOrder=additive?30:20;
  }
  // colour is sRGB 0..1; flick>0 makes the particle twinkle (fireflies, embers)
  add(x,y,z,vx,vy,vz,life,s0,s1,r,g,b,a,grav,drag,flick){
    if(this.n>=this.cap)return;const i=this.n++,j=i*3,k=i*4;
    this.p[j]=x;this.p[j+1]=y;this.p[j+2]=z;this.v[j]=vx;this.v[j+1]=vy;this.v[j+2]=vz;
    this.life[i]=this.max[i]=life;this.s0[i]=s0;this.s1[i]=s1;this.c[k]=r;this.c[k+1]=g;this.c[k+2]=b;this.c[k+3]=a;
    this.g[i]=grav||0;this.dr[i]=drag==null?1:drag;this.fl[i]=flick||0;
  }
  update(dt,t){
    let n=this.n;const P=this.aPos.array,C=this.aCol.array,Z=this.aSize.array;
    for(let i=0;i<n;i++){
      this.life[i]-=dt;
      if(this.life[i]<=0){n--;if(i<n){this.copy(n,i)}i--;continue}
      const j=i*3,d=Math.exp(-this.dr[i]*dt);
      this.v[j]*=d;this.v[j+1]=this.v[j+1]*d-this.g[i]*dt;this.v[j+2]*=d;
      this.p[j]+=this.v[j]*dt;this.p[j+1]+=this.v[j+1]*dt;this.p[j+2]+=this.v[j+2]*dt;
      if(this.p[j+1]<0&&this.g[i]>0){this.p[j+1]=0;this.v[j+1]*=-.3;this.v[j]*=.6;this.v[j+2]*=.6}
    }
    this.n=n;
    for(let i=0;i<n;i++){
      const j=i*3,k=i*4,f=this.life[i]/this.max[i],fl=this.fl[i]?.55+.45*Math.sin(t*12+i*1.7):1;
      P[j]=this.p[j];P[j+1]=this.p[j+1];P[j+2]=this.p[j+2];
      C[k]=this.c[k];C[k+1]=this.c[k+1];C[k+2]=this.c[k+2];C[k+3]=this.c[k+3]*Math.min(1,f*2.2)*fl;
      Z[i]=this.s1[i]+(this.s0[i]-this.s1[i])*f;
    }
    const geo=this.pts.geometry;geo.setDrawRange(0,n);
    if(n){this.aPos.updateRange.count=n*3;this.aPos.needsUpdate=true;this.aCol.updateRange.count=n*4;this.aCol.needsUpdate=true;this.aSize.updateRange.count=n;this.aSize.needsUpdate=true}
  }
  copy(from,to){
    const a=from*3,b=to*3,c=from*4,d=to*4;
    for(let q=0;q<3;q++){this.p[b+q]=this.p[a+q];this.v[b+q]=this.v[a+q]}
    for(let q=0;q<4;q++)this.c[d+q]=this.c[c+q];
    this.life[to]=this.life[from];this.max[to]=this.max[from];this.s0[to]=this.s0[from];this.s1[to]=this.s1[from];
    this.g[to]=this.g[from];this.dr[to]=this.dr[from];this.fl[to]=this.fl[from];
  }
  clear(){this.n=0;this.pts.geometry.setDrawRange(0,0)}
};
const FV=`attribute vec4 aCol;varying vec4 vCol;varying vec2 vUv;
void main(){vCol=aCol;vUv=uv*2.0-1.0;vec4 p=vec4(position,1.0);
#ifdef USE_INSTANCING
p=instanceMatrix*p;
#endif
gl_Position=projectionMatrix*modelViewMatrix*p;}`;
const FF=`varying vec4 vCol;varying vec2 vUv;
void main(){float r=length(vUv);float a;
#if MODE==0
a=max(0.0,1.0-r);a*=a;
#elif MODE==1
a=smoothstep(0.62,0.84,r)*(1.0-smoothstep(0.9,1.0,r));
#elif MODE==2
a=(1.0-smoothstep(0.2,1.0,abs(vUv.y)))*(1.0-smoothstep(0.92,1.0,abs(vUv.x)));
#elif MODE==3
a=1.0-smoothstep(0.3,1.0,r);
#else
a=1.0;
#endif
if(a<=0.003)discard;gl_FragColor=vec4(vCol.rgb,vCol.a*a);}`;
// modes: 0 soft glow, 1 ring, 2 beam, 3 soft decal, 4 solid quad
V.FxKit=class{
  constructor(mode,additive,cap,opts){
    opts=opts||{};this.cap=cap;this.n=0;
    const geo=new THREE.PlaneGeometry(1,1);if(opts.flat)geo.rotateX(-Math.PI/2);
    this.aCol=new THREE.InstancedBufferAttribute(new Float32Array(cap*4),4).setUsage(THREE.DynamicDrawUsage);geo.setAttribute("aCol",this.aCol);
    const mat=new THREE.ShaderMaterial({vertexShader:FV,fragmentShader:FF,defines:{MODE:mode},transparent:true,depthWrite:false,
      depthTest:opts.depthTest!==false,side:THREE.DoubleSide,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
    const m=this.mesh=new THREE.InstancedMesh(geo,mat,cap);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;m.count=0;m.visible=false;
    m.renderOrder=opts.order||25;
  }
  push(mat,r,g,b,a){if(this.n>=this.cap)return;mat.toArray(this.mesh.instanceMatrix.array,this.n*16);const c=this.aCol.array,i=this.n*4;c[i]=r;c[i+1]=g;c[i+2]=b;c[i+3]=a;this.n++}
  flush(){const m=this.mesh,n=this.n;m.count=n;m.visible=n>0;if(n){m.instanceMatrix.updateRange.count=n*16;m.instanceMatrix.needsUpdate=true;this.aCol.updateRange.count=n*4;this.aCol.needsUpdate=true}this.n=0}
};
})();
