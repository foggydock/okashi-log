// Supabase クライアントと CRUD ラッパー（お菓子ログ）
const DB = (() => {
  let client = null;

  function init() {
    const cfg = window.OKASHI_CONFIG;
    if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_ANON_KEY.startsWith("PASTE_") ||
        cfg.SUPABASE_URL.includes("YOUR-PROJECT")) {
      Util.showBanner("js/config.js に Supabase の URL と Publishable key を設定してください", "error");
      return null;
    }
    if (!window.supabase) {
      Util.showBanner("Supabase JS が読み込めていません（ネット未接続？）", "error");
      return null;
    }
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return client;
  }

  function getClient() { return client; }

  // 全件取得（1000件上限を超えてもページネーションで全部取る）
  async function listRecords() {
    if (!client) return [];
    let all = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await client
        .from("snack_records")
        .select("*")
        .order("eaten_at", { ascending: false })
        .range(from, from + step - 1);
      if (error) {
        Util.showBanner(`読み込みエラー: ${error.message}`, "error");
        return all;
      }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < step) break;
      from += step;
    }
    return all;
  }

  async function insertRecord(row) {
    if (!client) return { error: { message: "未接続" } };
    const payload = { ...row, user_id: window.Auth?.getUserId?.() || undefined };
    const { data, error } = await client
      .from("snack_records").insert(payload).select().single();
    return { data, error };
  }

  async function updateRecord(id, fields) {
    if (!client) return { error: { message: "未接続" } };
    const { data, error } = await client
      .from("snack_records").update(fields).eq("id", id).select().single();
    return { data, error };
  }

  async function deleteRecord(id) {
    if (!client) return { error: { message: "未接続" } };
    const { error } = await client.from("snack_records").delete().eq("id", id);
    return { error };
  }

  return { init, getClient, listRecords, insertRecord, updateRecord, deleteRecord };
})();
window.DB = DB;
