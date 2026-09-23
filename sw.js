// アプリの外枠（HTML/CSS/JS等の静的ファイル）だけをキャッシュする最小限のService Worker。
// 記録データ（Supabase）はキャッシュしないため、オフライン時は起動は速くなるが一覧の中身は出ない。
// JS/CSSを変えたら、この版と index.html の ?v= を両方上げる
const CACHE_NAME = "okashi-shell-v11";
// 同じドメイン（foggydock.github.io）の他のアプリとキャッシュの置き場が共通なので、消すのはこの接頭辞の古い版だけにする
const CACHE_PREFIX = "okashi-shell-";
// index.html は入れない（Cloudflare Pages では "/" へ転送され、転送済みの応答を画面遷移に返すと開けなくなる）
const SHELL_FILES = [
  "./",
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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return; // 別オリジン（Supabase/Gemini等）は素通し

  if (req.mode === "navigate") {
    // GitHub PagesはCache-Control: max-age=600を返すため、no-storeでブラウザの標準HTTPキャッシュを迂回する
    e.respondWith(
      fetch(req, { cache: "no-store" }).catch(() => caches.match("./"))
    );
    return;
  }

  // ?v= まで一致したものだけキャッシュから返す。index.html の ?v= を上げておけば、
  // 新しいSWに切り替わる前の初回起動でも「新しいHTML＋古いJS/CSS」の食い違いにならない
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req, { cache: "no-store" }).then((res) => {
        if (res.ok && !res.redirected) {
          // 応答の中身はページ側が読むので、複製は返す前に作っておく（後から作ると失敗する）
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)));
        }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true })); // オフライン時は ?v= 違いでも事前キャッシュで代用
    })
  );
});
