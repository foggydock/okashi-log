// 小さな共通ユーティリティ
const Util = (() => {
  function showView(id) {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
    window.scrollTo(0, 0);
  }

  let bannerTimer = null;
  function showBanner(msg, type = "info") {
    let b = document.getElementById("banner");
    if (!b) {
      b = document.createElement("div");
      b.id = "banner";
      document.body.appendChild(b);
    }
    b.textContent = msg;
    b.className = `banner banner-${type} show`;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove("show"), 4000);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }

  // ISO日時 -> "今日 / 昨日 / N日前 / YYYY-MM-DD"（ざっくり表示用）
  function relDay(iso) {
    if (!iso) return "";
    const then = new Date(iso);
    if (isNaN(then)) return "";
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86400000);
    if (days <= 0) return "今日";
    if (days === 1) return "昨日";
    if (days < 30) return `${days}日前`;
    const p = (n) => String(n).padStart(2, "0");
    return `${then.getFullYear()}-${p(then.getMonth() + 1)}-${p(then.getDate())}`;
  }

  function fmtDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function debounce(fn, ms = 200) {
    let t = null;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function lsGet(key, fallback = "") {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch (_) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  return { showView, showBanner, esc, nl2br, relDay, fmtDateTime, debounce, lsGet, lsSet };
})();
window.Util = Util;
