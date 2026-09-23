// お菓子ログ本体ロジック
const App = (() => {
  let records = [];
  let loadFailed = false;
  let loadSeq = 0;
  let editingId = null;
  let selectedAmount = "";
  let currentWarningText = "";
  let calDate = new Date();
  let calSelectedKey = null;
  let formInitialState = null;
  let isSaving = false;
  // 読み取り中の画像処理。フォームを開き直したら捨てて、遅れて届いた結果を別の記録に入れない
  let imageJob = null;

  function init() {
    document.getElementById("btn-new").addEventListener("click", () => leaveFormIfNeeded(openForm));
    document.getElementById("btn-cancel").addEventListener("click", () => leaveFormIfNeeded(() => Util.showView("view-list")));
    document.getElementById("btn-calendar").addEventListener("click", () => leaveFormIfNeeded(openCalendar));
    document.getElementById("btn-cal-close").addEventListener("click", () => Util.showView("view-list"));
    document.getElementById("cal-prev").addEventListener("click", () => shiftCalMonth(-1));
    document.getElementById("cal-next").addEventListener("click", () => shiftCalMonth(1));
    document.getElementById("btn-logout").addEventListener("click", async () => {
      if (isFormDirty() && !confirm("入力した内容は保存されていません。破棄してログアウトしますか？")) return;
      // 破棄を選んだので、ログアウト後の再読み込みで「このサイトを離れますか？」をもう一度出さない
      formInitialState = null;
      await Auth.signOut();
      location.reload();
    });
    document.getElementById("record-form").addEventListener("submit", onSave);
    // 候補（datalist）から選んだときも input が起きる。change でも描き直すと、
    // 候補ボタンを押した瞬間に入力欄のフォーカスが外れてボタンが作り直され、1回目のタップが効かなくなる
    document.getElementById("f-name").addEventListener("input", onSnackNameInput);
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
    window.addEventListener("beforeunload", (ev) => {
      if (!isFormDirty() || isSaving) return;
      ev.preventDefault();
      ev.returnValue = "";
    });
  }

  async function load() {
    const seq = ++loadSeq;
    const list = await DB.listRecords();
    if (seq !== loadSeq) return; // 後から始めた読み込みを優先し、古い結果で上書きしない
    // 読み込みに失敗したら手元の一覧は残す（通信エラーで「まだ記録がありません」と見せない）
    loadFailed = !list;
    if (list) records = list;
    renderPastSnackChoices();
    render();
  }

  // 同じ名前の記録をまとめ、直近に使ったお菓子名を入力候補として出す。
  // DBの記録は既に eaten_at 降順なので、最初に見つかったものが最新記録になる。
  function normalizeSnackName(name) {
    return String(name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja-JP");
  }

  function pastRecordsFor(name) {
    const key = normalizeSnackName(name);
    if (!key) return [];
    return records.filter((r) => r.id !== editingId && normalizeSnackName(r.name) === key);
  }

  function snackNameChoices() {
    const seen = new Set();
    return records.filter((r) => {
      const nameKey = normalizeSnackName(r.name);
      if (!nameKey || seen.has(nameKey)) return false;
      seen.add(nameKey);
      return true;
    });
  }

  function renderPastSnackChoices(query = "") {
    const list = document.getElementById("past-snack-names");
    const allChoices = snackNameChoices();
    const key = normalizeSnackName(query);
    const choices = key ? allChoices.filter((r) => normalizeSnackName(r.name).includes(key)) : allChoices;
    list.innerHTML = "";
    allChoices.forEach((r) => {
      const option = document.createElement("option");
      option.value = r.name;
      list.appendChild(option);
    });

    const hint = document.getElementById("past-snack-hint");
    const suggestions = document.getElementById("past-snack-suggestions");
    const options = document.getElementById("past-snack-options");
    options.innerHTML = "";
    if (!allChoices.length) {
      suggestions.style.display = "none";
      return;
    }
    hint.textContent = key
      ? (choices.length ? "該当するお菓子（タップして選ぶ）" : "該当する過去の記録はありません")
      : "最近記録したお菓子（タップして選ぶ）";
    choices.slice(0, 10).forEach((r) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "past-snack-option";
      button.textContent = r.name;
      button.title = r.name;
      button.addEventListener("click", () => {
        document.getElementById("f-name").value = r.name;
        onSnackNameInput();
      });
      options.appendChild(button);
    });
    suggestions.style.display = "block";
  }

  function onSnackNameInput() {
    renderPastSnackChoices(document.getElementById("f-name").value);
    updatePastRecordPreview();
  }

  function updatePastRecordPreview() {
    const name = document.getElementById("f-name").value;
    const matches = pastRecordsFor(name);
    const preview = document.getElementById("past-record-preview");
    if (!matches.length) {
      preview.innerHTML = "";
      preview.style.display = "none";
      return;
    }

    const latest = matches[0];
    const count = matches.length;
    preview.innerHTML = `
      <div class="past-record-title">このお菓子の過去の記録${count > 1 ? `（${count}件中の最新）` : ""}</div>
      <div class="past-record-name">${Util.esc(latest.name)}</div>
      <div class="past-record-meta">${Util.esc(latest.amount || "量の記録なし")} ・ ${Util.esc(Util.fmtDateTime(latest.eaten_at))}</div>
      ${latest.ingredients_text ? `<div class="past-record-ingredients">原材料：${Util.nl2br(latest.ingredients_text)}</div>` : ""}
      ${latest.warning_text ? `<div class="past-record-warning">⚠️ ${Util.esc(latest.warning_text)}</div>` : ""}
    `;
    preview.style.display = "block";
  }

  // 一覧とカレンダーで共通の記録カード。when は「今日」や日時など、量の横に出す文字
  function recordCardHtml(r, when, withDelete) {
    const meta = [r.amount, when].filter(Boolean).join(" ・ ");
    return `
      <div class="record-card" data-id="${r.id}">
        <div class="record-main">
          <div class="record-name">${Util.esc(r.name)}</div>
          <div class="record-meta">${Util.esc(meta)}</div>
          ${r.warning_text ? `<div class="record-warning">⚠️ ${Util.esc(r.warning_text)}</div>` : ""}
        </div>
        ${withDelete ? `<button type="button" class="btn btn-ghost btn-sm record-delete" data-id="${r.id}">🗑</button>` : ""}
      </div>
    `;
  }

  function bindRecordCards(container) {
    container.querySelectorAll(".record-card").forEach((card) => {
      card.addEventListener("click", () => {
        const r = records.find((x) => x.id === card.dataset.id);
        if (r) openForm(r);
      });
    });
  }

  function render() {
    const wrap = document.getElementById("record-list");
    const empty = document.getElementById("list-empty");
    if (records.length === 0) {
      wrap.innerHTML = "";
      empty.textContent = loadFailed
        ? "記録を読み込めませんでした。通信状況を確認して、ページを再読み込みしてください。"
        : "まだ記録がありません。「＋ 記録する」から始めましょう。";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";
    wrap.innerHTML = records.map((r) => recordCardHtml(r, Util.relDay(r.eaten_at), true)).join("");
    bindRecordCards(wrap);

    wrap.querySelectorAll(".record-delete").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        if (await deleteWithConfirm(btn.dataset.id)) await load();
      });
    });
  }

  function openCalendar() {
    calDate = new Date();
    clearCalDay();
    renderCalendar();
    Util.showView("view-calendar");
  }

  function shiftCalMonth(delta) {
    calDate = new Date(calDate.getFullYear(), calDate.getMonth() + delta, 1);
    clearCalDay();
    renderCalendar();
  }

  function clearCalDay() {
    calSelectedKey = null;
    document.getElementById("cal-day-title").style.display = "none";
    document.getElementById("cal-day-list").innerHTML = "";
  }

  function renderCalendar() {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    document.getElementById("cal-title").textContent = `${year}年${month + 1}月`;

    const byDay = {};
    records.forEach((r) => {
      const k = Util.fmtDate(r.eaten_at);
      if (!k) return;
      (byDay[k] = byDay[k] || []).push(r);
    });

    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0=日
    const gridStart = new Date(year, month, 1 - startOffset);
    const daysInGrid = 42; // 6週固定
    const todayKey = Util.fmtDate(new Date());

    const grid = document.getElementById("cal-grid");
    grid.innerHTML = "";
    for (let i = 0; i < daysInGrid; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const k = Util.fmtDate(d);
      const inMonth = d.getMonth() === month;
      const dayRecords = byDay[k] || [];

      const cell = document.createElement("div");
      cell.className = "cal-day" + (inMonth ? "" : " other-month") + (k === todayKey ? " today" : "") + (k === calSelectedKey ? " selected" : "");
      cell.innerHTML = `<span class="cal-day-num">${d.getDate()}</span>` +
        (dayRecords.length ? `<span class="cal-day-dots">${dayRecords.slice(0, 4).map(() => "<span></span>").join("")}</span>` : "");
      cell.addEventListener("click", () => selectCalDay(k));
      grid.appendChild(cell);
    }
  }

  function selectCalDay(key) {
    calSelectedKey = key;
    renderCalendar();
    const dayRecords = records.filter((r) => Util.fmtDate(r.eaten_at) === key);
    const title = document.getElementById("cal-day-title");
    const list = document.getElementById("cal-day-list");
    const [y, m, d] = key.split("-");
    title.textContent = `${y}年${Number(m)}月${Number(d)}日の記録`;
    title.style.display = "block";

    if (dayRecords.length === 0) {
      list.innerHTML = `<div class="empty">この日の記録はありません。</div>`;
      return;
    }
    list.innerHTML = dayRecords.map((r) => recordCardHtml(r, Util.fmtDateTime(r.eaten_at), false)).join("");
    bindRecordCards(list);
  }

  // r を渡すと編集、省略すると新規記録
  function openForm(r = null) {
    editingId = r ? r.id : null;
    selectedAmount = r?.amount || "";
    currentWarningText = r?.warning_text || "";
    imageJob = null;
    document.getElementById("record-form").reset();
    document.getElementById("f-name").value = r?.name || "";
    document.getElementById("f-ingredients").value = r?.ingredients_text || "";

    document.querySelectorAll("#amount-input span").forEach((s) => {
      s.classList.toggle("selected", s.dataset.amount === selectedAmount);
    });

    document.getElementById("btn-delete").style.display = r ? "inline-flex" : "none";
    setStatus(document.getElementById("ingredients-status"), "", null);
    setStatus(document.getElementById("warning-status"), "", null);
    showWarningPreview(currentWarningText);
    document.querySelector(".form-title").textContent = r ? "お菓子の記録を編集" : "お菓子を記録する";
    // 前回入力した名前で絞り込まれた候補が残らないよう、今の名前で描き直す
    onSnackNameInput();
    rememberFormInitialState();
    Util.showView("view-form");
  }

  function showWarningPreview(text) {
    const prev = document.getElementById("warning-preview");
    prev.textContent = text ? "⚠️ " + text : "";
    prev.style.display = text ? "block" : "none";
  }

  function currentFormState() {
    return JSON.stringify({
      name: document.getElementById("f-name").value.trim(),
      amount: selectedAmount,
      ingredients: document.getElementById("f-ingredients").value.trim(),
      warning: currentWarningText,
    });
  }

  function rememberFormInitialState() {
    formInitialState = currentFormState();
  }

  function isFormDirty() {
    return document.getElementById("view-form").classList.contains("active") &&
      formInitialState !== null && currentFormState() !== formInitialState;
  }

  function leaveFormIfNeeded(next) {
    if (isFormDirty() && !confirm("入力した内容は保存されていません。破棄して移動しますか？")) return;
    next();
  }

  async function onImagePicked(ev) {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;

    // 読み取り中に別の記録を開いたり、画像を選び直したりしたら、この結果は捨てる
    const job = {};
    imageJob = job;
    try {
      await readIngredientsAndWarning(file, () => imageJob !== job);
    } finally {
      if (imageJob === job) imageJob = null;
    }
  }

  async function readIngredientsAndWarning(file, isStale) {
    const status = document.getElementById("ingredients-status");
    const warnStatus = document.getElementById("warning-status");
    setStatus(status, "原材料を読み取り中…（10秒ほどかかります）", "pending");
    setStatus(warnStatus, "", null);
    let ingredientsText;
    try {
      ingredientsText = await Gemini.extractIngredients(file);
    } catch (e) {
      if (!isStale()) setStatus(status, "❌ 失敗：" + e.message, "err");
      return;
    }
    if (isStale()) return;
    document.getElementById("f-ingredients").value = ingredientsText;
    setStatus(status, "✅ 読み取り完了。内容を確認・修正できます。", "ok");
    // 前の原材料向けの警告は、新しい原材料と食い違うので消しておく（作り直しに失敗しても残さない）
    currentWarningText = "";
    showWarningPreview("");

    const name = document.getElementById("f-name").value.trim() || "このお菓子";
    setStatus(warnStatus, "警告メッセージを作成中…", "pending");
    try {
      const warningText = await Gemini.generateWarning(name, ingredientsText);
      if (isStale()) return;
      currentWarningText = warningText;
      showWarningPreview(warningText);
      setStatus(warnStatus, "✅ 警告メッセージを作成しました", "ok");
    } catch (e) {
      if (!isStale()) setStatus(warnStatus, "❌ 警告メッセージの生成に失敗：" + e.message, "err");
    }
  }

  function setStatus(el, text, kind) {
    el.textContent = text;
    el.classList.remove("field-hint-ok", "field-hint-err", "field-hint-pending");
    if (kind) el.classList.add(`field-hint-${kind}`);
  }

  async function onSave(ev) {
    ev.preventDefault();
    if (isSaving) return;
    const name = document.getElementById("f-name").value.trim();
    if (!name) { Util.showBanner("お菓子の名前を入力してください", "error"); return; }
    if (imageJob && !confirm("原材料の読み取り（警告メッセージの作成）がまだ終わっていません。終わるのを待たずに保存しますか？")) return;

    const row = {
      name,
      amount: selectedAmount,
      ingredients_text: document.getElementById("f-ingredients").value.trim(),
      warning_text: currentWarningText,
    };

    const btn = document.getElementById("btn-save");
    btn.disabled = true; btn.textContent = "保存中…";
    isSaving = true;
    let error;
    try {
      ({ error } = editingId
        ? await DB.updateRecord(editingId, row)
        : await DB.insertRecord(row));
    } catch (e) {
      error = e instanceof Error ? e : new Error("通信に失敗しました");
    } finally {
      isSaving = false;
      btn.disabled = false;
      btn.textContent = "保存";
    }

    if (error) { Util.showBanner("保存に失敗：" + error.message, "error"); return; }

    // 保存に成功した内容を基準にし、保存後の画面切替・再読み込みでは警告を出さない。
    rememberFormInitialState();
    Util.showView("view-list");
    await load();
  }

  async function deleteWithConfirm(id) {
    if (!confirm("この記録を削除します。よろしいですか？")) return false;
    const { error } = await DB.deleteRecord(id);
    if (error) { Util.showBanner("削除に失敗：" + error.message, "error"); return false; }
    return true;
  }

  async function onDelete() {
    if (!editingId) return;
    if (!(await deleteWithConfirm(editingId))) return;
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
