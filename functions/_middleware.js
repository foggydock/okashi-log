// 配信してよいファイルだけを通し、それ以外（sql / serve.py / .gitignore / CLAUDE.md など）は 404 にする。
// リポジトリ全体が配信されるため、開発用ファイルが外から取れないようにする許可リスト方式。
// 新しい画面用ファイルを追加したら、ここの許可リストにも足すこと。
const ALLOW_EXACT = new Set([
  "/", "/index.html", "/sw.js", "/manifest.json", "/styles.css",
]);
const ALLOW_PREFIX = [
  { dir: "/js/", ext: ".js", deny: ["/js/config.example.js"] },
  { dir: "/icons/", ext: null, deny: [] },
];

export function isAllowed(pathname) {
  if (ALLOW_EXACT.has(pathname)) return true;
  return ALLOW_PREFIX.some((r) =>
    pathname.startsWith(r.dir) &&
    !pathname.includes("..") &&
    (r.ext === null || pathname.endsWith(r.ext)) &&
    !r.deny.includes(pathname)
  );
}

export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);
  if (!isAllowed(pathname)) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return context.next();
}
