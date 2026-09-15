/* Оффлайн-кэш. Сеть в приоритете: так обновление приезжает сразу,
   а кэш выручает только когда сети нет. Версию поднимать при смене состава файлов. */
const V='tasks-v83';
const ASSETS=['./','./index.html','./panels.html','./app.css','./app.js','./Pixelizer.ttf','./play-cyrillic-400-normal.woff2','./play-cyrillic-700-normal.woff2','./play-latin-400-normal.woff2','./play-latin-700-normal.woff2','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  /* Чужие адреса (воркер чата) не трогаем вовсе */
  if(new URL(e.request.url).origin!==self.location.origin)return;
  e.respondWith(
    /* cache:'reload' обязателен. Обычный fetch внутри воркера идёт через HTTP-кэш браузера,
       а Pages отдаёт файлы с max-age=600 — установленное приложение продолжало бы
       исполнять старый код, и правка «не приезжала» без всяких признаков ошибки. */
    fetch(e.request,{cache:'reload'}).then(r=>{
      const copy=r.clone();
      caches.open(V).then(c=>c.put(e.request,copy)).catch(()=>{});
      return r;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});
