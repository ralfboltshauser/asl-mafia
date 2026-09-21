// Version is derived from the public shell by scripts/build-pwa.mjs.
const CACHE='asl-mafia-shell-a2b211ddad911b33';
const SHELL=['/','/app.js','/pwa.js','/style.css','/audio.js','/qrcode.js','/asl-logo.svg','/favicon.svg','/inter.woff2','/mono.woff2','/manifest.webmanifest','/icon-192.png','/icon-512.png','/icon-maskable.png','/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
// Let existing clients finish. No skipWaiting, claim, or forced reload during games.
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('asl-mafia-shell-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 // Only the public shell is cached. Room APIs, credentials, and audio stay network-only.
 if(event.request.method!=='GET'||url.origin!==location.origin)return;
 const key=event.request.mode==='navigate'&&url.pathname==='/'?'/':url.pathname;
 if(!SHELL.includes(key))return;
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(key))||fetch(event.request)));
});
