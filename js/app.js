// お菓子ログ本体ロジック
const App = (() => {
  let records = [];
  let editingId = null;
  let selectedAmount = "";
  let currentWarningText = "";

  function init() {
    document.getElementById("btn-new").addEventListener("click", openAddForm);
    document.getElementById("btn-cancel").addEventListener("click", () => Util.showView("view-list"));
    document.getElementById("btn-logout").addEventListener("click", async () => { await Auth.signOut(); location.reload(); });
    document.getElementById("record-form").addEventListener("submit", onSave);
    document.getElementById("btn-delete").addEventListener("click", onDelete);
    document.getElementById("btn-stop").addEventListener("click", () => showRandomWarning(true));
    document.getElementById("warning-modal-close").addEventListener("click", () => {
      document.getElementById("warning-modal").style.display = "none";
    });

    document.querySelectorAll("#amount-input span").forEach((el) => {
      el.addEventListener("click", () => {
        selectedAmount = el.dataset.amount;
        document.querySelectorAll("#amount-input span").forEach((s) => s.classList.remove("selected"));
        el.classList.add("selected");
      });
    });

    document.getElementById("btn-pick-image").addEventListener("click", () => {
      document.getElementById("f-image-file").click();
    });
    document.getElementById("f-image-file").addEventListener("change", onImagePicked);

    document.getElementById("btn-settings").addEventListener("click", openSettings);
    document.getElementById("settings-close").addEventListener("click", closeSettings);
    document.getElementById("settings-save").addEventListener("click", saveSettings);
  }

  async function load() {
    records = await DB.listRecords();
    render();
  }

  function render() {
    const wrap = document.getElementById("record-list");
    const empty = document.getElementById("list-empty");
    if (records.length === 0) {
      wrap.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";
    wrap.innerHTML = records.map((r) => `
      <div class="record-card" data-id="${r.id}">
        <div class="record-main">
          <div class="record-name">${Util.esc(r.name)}</div>
          <div class="record-meta">${Util.esc(r.amount || "")} ・ ${Util.esc(Util.relDay(r.eaten_at))}</div>
          ${r.warning_text ? `<div class="record-warning">⚠️ ${Util.esc(r.warning_text)}</div>` : ""}
        </div>
        <button type="button" class="btn btn-ghost btn-sm record-delete" data-id="${r.id}">🗑</button>
      </div>
    `).join("");

    wrap.querySelectorAll(".record-card").forEach((card) => {
      card.addEventListener("click", () => {
        const r = records.find((x) => x.id === card.dataset.id);
        if (r) openEditForm(r);
      });
    });

    wrap.querySelectorAll(".record-delete").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const id = btn.dataset.id;
        if (!confirm("この記録を削除します。よろしいですか？")) return;
        const { error } = await DB.deleteRecord(id);
        if (error) { Util.showBanner("削除に失敗：" + error.message, "error"); return; }
        await load();
      });
    });
  }

  function openAddForm() {
    editingId = null;
    selectedAmount = "";
    currentWarningText = "";
    document.getElementById("record-form").reset();
    document.querySelectorAll("#amount-input span").forEach((s) => s.classList.remove("selected"));
    document.getElementById("btn-delete").style.display = "none";
    document.getElementById("ingredients-status").textContent = "";
    document.getElementById("warning-status").textContent = "";
    document.getElementById("warning-preview").style.display = "none";
    document.querySelector(".form-title").textContent = "お菓子を記録する";
    Util.showView("view-form");
  }

  function openEditForm(r) {
    editingId = r.id;
    selectedAmount = r.amount || "";
    currentWarningText = r.warning_text || "";
    document.getElementById("record-form").reset();
    document.getElementById("f-name").value = r.name || "";
    document.getElementById("f-ingredients").value = r.ingredients_text || "";

    document.querySelectorAll("#amount-input span").forEach((s) => {
      s.classList.toggle("selected", s.dataset.amount === selectedAmount);
    });

    document.getElementById("btn-delete").style.display = "inline-flex";
    document.getElementById("ingredients-status").textContent = "";
    document.getElementById("warning-status").textContent = "";
    const prev = document.getElementById("warning-preview");
    if (currentWarningText) {
      prev.textContent = "⚠️ " + currentWarningText;
      prev.style.display = "block";
    } else {
      prev.style.display = "none";
    }
    document.querySelector(".form-title").textContent = "お菓子の記録を編集";
    Util.showView("view-form");
  }

  async function onImagePicked(ev) {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;

    const status = document.getElementById("ingredients-status");
    status.textContent = "原材料を読み取り中…（10秒ほどかかります）";
    let ingredientsText;
    try {
      ingredientsText = await Gemini.extractIngredients(file);
    } catch (e) {
      status.textContent = "失敗：" + e.message;
      return;
    }
    document.getElementById("f-ingredients").value = ingredientsText;
    status.textContent = "読み取り完了。内容を確認・修正できます。";

    const name = document.getElementById("f-name").value.trim() || "このお菓子";
    const warnStatus = document.getElementById("warning-status");
    warnStatus.textContent = "警告メッセージを作成中…";
    try {
      currentWarningText = await Gemini.generateWarning(name, ingredientsText);
      const prev = document.getElementById("warning-preview");
      prev.textContent = "⚠️ " + currentWarningText;
      prev.style.display = "block";
      warnStatus.textContent = "";
    } catch (e) {
      warnStatus.textContent = "警告メッセージの生成に失敗：" + e.message;
    }
  }

  async function onSave(ev) {
    ev.preventDefault();
    const name = document.getElementById("f-name").value.trim();
    if (!name) { Util.showBanner("お菓子の名前を入力してください", "error"); return; }

    const row = {
      name,
      amount: selectedAmount,
      ingredients_text: document.getElementById("f-ingredients").value.trim(),
      warning_text: currentWarningText,
    };

    const btn = document.getElementById("btn-save");
    btn.disabled = true; btn.textContent = "保存中…";
    const { error } = editingId
      ? await DB.updateRecord(editingId, row)
      : await DB.insertRecord(row);
    btn.disabled = false; btn.textContent = "保存";

    if (error) { Util.showBanner("保存に失敗：" + error.message, "error"); return; }

    Util.showView("view-list");
    await load();
  }

  async function onDelete() {
    if (!editingId) return;
    if (!confirm("この記録を削除します。よろしいですか？")) return;
    const { error } = await DB.deleteRecord(editingId);
    if (error) { Util.showBanner("削除に失敗：" + error.message, "error"); return; }
    Util.showView("view-list");
    await load();
  }

  // 記録済みの中からランダムに1件、警告メッセージを見せる
  function showRandomWarning(isManual) {
    const withWarning = records.filter((r) => r.warning_text);
    if (withWarning.length === 0) {
      if (isManual) Util.showBanner("まだ警告メッセージがありません。記録をつけてみましょう", "info");
      return;
    }
    const r = withWarning[Math.floor(Math.random() * withWarning.length)];
    document.getElementById("warning-modal-name").textContent = r.name;
    document.getElementById("warning-modal-text").textContent = r.warning_text;
    document.getElementById("warning-modal").style.display = "flex";
  }

  function openSettings() {
    document.getElementById("settings-key-input").value = Gemini.getKey();
    document.getElementById("settings-modal").style.display = "flex";
  }
  function closeSettings() {
    document.getElementById("settings-modal").style.display = "none";
  }
  function saveSettings() {
    const v = document.getElementById("settings-key-input").value.trim();
    Gemini.setKey(v);
    closeSettings();
    Util.showBanner("保存しました", "info");
  }

  return { init, load, showRandomWarning };
})();
window.App = App;
