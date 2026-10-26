// Jembatan antara logika (game.js) dan tampilan (view3d.js, audio.js).
// Logika memanggil BB.emit(nama, data); tampilan mendengar dengan BB.on(nama, fn).
// Daftar event dan bentuk datanya ada di KOLABORASI.md. Jangan taruh logika game di sini.
window.BB=window.BB||{};
(function(BB){
  "use strict";
  const H={};
  BB.on=(name,fn)=>{(H[name]=H[name]||[]).push(fn);return()=>{H[name]=(H[name]||[]).filter(f=>f!==fn)}};
  BB.emit=(name,data)=>{const L=H[name];if(!L)return;for(const fn of L.slice()){try{fn(data)}catch(e){console.error("[BB] "+name,e)}}};
  // the view replaces this stub; the game still runs (without visuals) if the 3D view cannot start
  BB.view=BB.view||{init(){},show(){},frame(){},reset(){},pick(){return null},icon(){}};
})(window.BB);
