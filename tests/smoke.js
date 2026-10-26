// Uji asap untuk kedua sesi: memuat game, membangun menara lewat klik di peta 3D, menjalankan
// gelombang, memakai bantuan, lalu memastikan tidak ada error JavaScript.
// Jalankan: node tests/smoke.js            (butuh Playwright + Chromium, sudah ada di sesi cloud Claude Code)
// Tangkapan layar disimpan ke folder test-out/ (diabaikan git).
const {chromium}=require("playwright");
const path=require("path"),fs=require("fs");
const root=path.resolve(__dirname,".."),out=path.join(root,"test-out");
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1200,height:820}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
  await page.goto("file://"+path.join(root,"index.html"));
  await page.waitForTimeout(2000);
  const ready=await page.evaluate(()=>!!(window.BB&&BB.V&&BB.V.ok&&BB.game));
  if(!ready)errors.push("tampilan 3D atau BB.game tidak siap");
  await page.screenshot({path:path.join(out,"1-menu.png")});

  await page.click("#btnSolo");await page.waitForTimeout(1800);
  await page.evaluate(()=>{BB.game.S.P[0].g=99999}); // uang tak terbatas, hanya untuk uji
  const spots=await page.evaluate(()=>{const g=BB.game,geo=g.geo(),out=[];
    for(const k of geo.PATH){const[x,y]=k.split(",").map(Number);if(out.length>=8)break;if((x+y)%3)continue;
      if(g.canBuild(x,y+1))out.push([x,y+1,out.length%4])}return out});
  for(const[x,y,t]of spots){
    await page.keyboard.press(String(t+1));
    const pt=await page.evaluate(([x,y])=>{const V=BB.V,v=new THREE.Vector3(x+.5-V.HX,V.groundAt(x+.5,y+.5),y+.5-V.HZ).project(V.cam);
      const r=document.querySelector("#cvWrap canvas").getBoundingClientRect();return[r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]},[x,y]);
    await page.mouse.click(pt[0],pt[1]);await page.waitForTimeout(80);
  }
  await page.keyboard.press("Escape");
  const built=await page.evaluate(()=>BB.game.S.T.length);
  if(built<spots.length)errors.push("menara terbangun "+built+" dari "+spots.length+" klik");

  await page.keyboard.press("Space");await page.waitForTimeout(3500);
  await page.screenshot({path:path.join(out,"2-gelombang.png")});
  await page.click('[data-help="0"]');await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(out,"3-meteor.png")});
  const st=await page.evaluate(()=>{const S=BB.game.S;return{ph:S.ph,w:S.w,musuh:S.E.length,menara:S.T.length}});
  console.log("state:",JSON.stringify(st));
  await browser.close();
  if(errors.length){console.error("GAGAL:\n"+errors.join("\n"));process.exit(1)}
  console.log("OK: tidak ada error. Tangkapan layar ada di test-out/");
})();
