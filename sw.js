/* Service worker : l'appli marche hors connexion une fois ouverte une première fois.
   Avant chaque mise en ligne, lance : node nouvelle-version.js (il change le numéro partout). */
const VERSION = "v9";
const CACHE = "colis-" + VERSION;
const FILES = ["./", "index.html", "asso.html", "style.css?v=9", "app.js?v=9", "config.js?v=9", "asso.js?v=9", "lib/qrcode.js?v=9", "lib/zxing.min.js?v=9", "recettes.json", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("colis-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Réseau d'abord, en revalidant toujours auprès du serveur (jamais le cache du navigateur) ;
   la copie locale ne sert que hors connexion. */
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  const network = sameOrigin ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req);
  e.respondWith(
    network
      .then(res => {
        if (res.ok && (res.type === "basic" || res.type === "cors")) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match(req, { ignoreSearch: true })))
  );
});
