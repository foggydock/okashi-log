// アプリの外枠（HTML/CSS/JS等の静的ファイル）だけをキャッシュする最小限のService Worker。
// 記録データ（Supabase）はキャッシュしないため、オフライン時は起動は速くなるが一覧の中身は出ない。
const CACHE_NAME = "okashi-shell-v1";
const SHELL_FILES = [
  "./",
  "index.html",
  "styles.css",
  "manifest.json",
  "js/config.js",
  "js/util.js",
  "js/db.js",
  "js/auth.js",
  "js/gemini.js",
  "js/app.js",
  "js/main.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return; // 別オリジン（Supabase/Gemini等）は素通し

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("index.html"))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }));
    })
  );
});
