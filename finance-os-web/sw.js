const CACHE='finance-os-studio-022-goals-v1';
const FILES=['./','./index.html','./style.css?v=9','./pro.css?v=9','./src/app.js?v=9','./src/domain.js','./src/store.js','./src/planning.js','./src/pro.js?v=9','./src/goals.js','./assets/coins.svg','./assets/finance-icon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('finance-os-studio-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin||!e.request.url.startsWith(self.registration.scope))return;e.respondWith(fetch(e.request).catch(async()=>{const c=await caches.open(CACHE);return (await c.match(e.request))||(e.request.mode==='navigate'?await c.match('./index.html'):Response.error())}))});
