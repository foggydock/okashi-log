// エントリーポイント：接続 → 認証チェック → ビュー切替
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

(async function main() {
  const client = DB.init();
  if (!client) { showLogin(); return; }

  App.init();
  wireLogin();

  const session = await Auth.refreshSession();
  if (session) await startApp();
  else showLogin();

  Auth.onChange((event) => {
    if (event === "SIGNED_OUT") location.reload();
  });
})();

function showLogin() {
  document.getElementById("app-header").style.display = "none";
  Util.showView("view-login");
}

async function startApp() {
  document.getElementById("app-header").style.display = "flex";
  await App.load();
  Util.showView("view-list");
  // 起動時：記録済みの中からランダムに1件、警告メッセージを自動表示
  App.showRandomWarning(false);
}

function wireLogin() {
  document.getElementById("login-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btn = document.getElementById("btn-login");
    const email = document.getElementById("login-email").value.trim();
    const pw = document.getElementById("login-password").value;
    btn.disabled = true; btn.textContent = "ログイン中…";
    const { error } = await Auth.signInWithPassword(email, pw);
    if (error) {
      Util.showBanner(`ログインできません: ${error.message}`, "error");
      btn.disabled = false; btn.textContent = "ログイン";
      return;
    }
    location.reload();
  });
}
