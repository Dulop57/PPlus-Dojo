const shellCache='pplus-dojo-web-shell-'+__SHELL_ID__;
const filesCache='pplus-dojo-web-files-v1';
const precache=__SHELL_FILES__;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(shellCache);for(const path of precache){const request=new Request(new URL(path,self.registration.scope));const existing=path.startsWith('./assets/')?await caches.match(request):undefined;const response=existing??await fetch(request);if(!response.ok)throw new Error('Offline interface download failed.');await cache.put(request,response);}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const shells=(await caches.keys()).filter(key=>key.startsWith('pplus-dojo-web-shell-'));const retained=new Set([shellCache,...shells.filter(key=>key!==shellCache).slice(-2)]);for(const key of shells)if(!retained.has(key))await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),root=new URL(self.registration.scope);
  if(request.method!=='GET'||url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
  const path=url.pathname.slice(root.pathname.length);
  // Account requests go directly to Firebase and never enter these caches.
  if(path==='web-config.json'){event.respondWith((async()=>{const cache=await caches.open(shellCache);try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}catch{const saved=await cache.match(request);return saved??Response.error();}})());return;}
  if(path.startsWith('web-data/')){
    // The page validates SHA-256 before saving pack/index responses here.
    event.respondWith(caches.open(filesCache).then(async cache=>(await cache.match(request))??fetch(request)));return;
  }
  event.respondWith((async()=>{
    const cache=await caches.open(shellCache),key=request.mode==='navigate'?root.href:request;
    const saved=(await cache.match(key))??(path.startsWith('assets/')?await caches.match(request):undefined);if(saved)return saved;
    const response=await fetch(request);if(response.ok&&response.type!=='opaque')await cache.put(key,response.clone());return response;
  })());
});
