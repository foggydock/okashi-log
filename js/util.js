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

  const p2 = (n) => String(n).padStart(2, "0");

  // ISO日時 または Date -> "YYYY-MM-DD"（端末の時刻で。カレンダーの日付キーにも使う）
  function fmtDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d)) return "";
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }

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
    return fmtDate(then);
  }

  function fmtDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return `${fmtDate(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }

  function lsGet(key, fallback = "") {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch (_) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  return { showView, showBanner, esc, nl2br, fmtDate, relDay, fmtDateTime, lsGet, lsSet };
})();
window.Util = Util;
