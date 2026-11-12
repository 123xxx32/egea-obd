// Çevrimdışı çalışma: uygulama önce telefondaki kopyadan anında açılır (internet yavaş/yoksa beklemez),
// arka planda internetten güncel sürüm indirilir ve bir sonraki açılışta kullanılır.
const C = "egea-obd-v4";
const FILES = ["./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.searchParams.has("fresh")) return; // yönetici ekranının güncel liste kontrolü: önbelleğe hiç dokunma
  const scope = new URL(self.registration.scope).pathname;
  // Uygulama sayfası yalnızca kök adres ya da index.html'dir; başka bir dosyaya gitmek uygulama kopyasını bozmaz
  const isApp = req.mode === "navigate" && (url.pathname === scope || url.pathname === scope + "index.html");
  e.respondWith((async () => {
    const cache = await caches.open(C);
    const hit = isApp ? await cache.match("./index.html") : await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => {
      if (r && r.status === 200 && r.type === "basic") {
        const html = (r.headers.get("content-type") || "").includes("text/html");
        if (isApp && html) cache.put("./index.html", r.clone()).catch(() => {});
        else if (!isApp && req.mode !== "navigate") cache.put(req, r.clone()).catch(() => {});
      }
      return r;
    });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    try { return await net; }
    catch (err) { return Response.error(); }
  })());
});
