// Gemini呼び出し（原材料の画像解析 → 添加物などの警告メッセージ生成）
const Gemini = (() => {
  const MODEL = "gemini-2.5-flash";
  const KEY_STORAGE = "okashi_gemini_key";

  function getKey() { return Util.lsGet(KEY_STORAGE, ""); }
  function setKey(k) { Util.lsSet(KEY_STORAGE, k); }

  function fileToBase64(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1]);
      fr.onerror = () => rej(new Error("画像を読めませんでした"));
      fr.readAsDataURL(file);
    });
  }

  async function callText(prompt, imagePart) {
    const key = getKey();
    if (!key) throw new Error("先に「⚙️ APIキー設定」からGemini APIキーを保存してください");

    const parts = [{ text: prompt }];
    if (imagePart) parts.push(imagePart);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.4 },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`APIエラー ${res.status}：${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AIから応答を読み取れませんでした");
    return text.trim();
  }

  // 原材料表示の写真 → 原材料テキストを抽出
  async function extractIngredients(file) {
    const b64 = await fileToBase64(file);
    const prompt = `この画像はお菓子・食品パッケージの「原材料名」表示欄です。
書かれている原材料・添加物をそのまま、読み取れる順番でカンマ区切りのテキストとして書き出してください。
説明や前置きは不要、原材料名の羅列だけを返してください。読み取れない場合は「読み取れませんでした」とだけ返してください。`;
    return await callText(prompt, {
      inline_data: { mime_type: file.type || "image/jpeg", data: b64 },
    });
  }

  // 原材料テキスト → 強めのトーンの警告メッセージを生成
  async function generateWarning(snackName, ingredientsText) {
    const prompt = `あなたは「お菓子を減らしたい人」を後押しする、少し辛口な健康アドバイザーです。
以下のお菓子「${snackName}」の原材料を見て、含まれている可能性のある添加物・糖分・脂質などについて、
一般に知られている健康リスク（肥満、血糖値スパイク、依存性、発がん性が指摘される添加物、トランス脂肪酸など）を踏まえ、
本人が「うっ、次は控えよう」と思うような、少し強め・辛口のトーンで2〜3文の短い警告メッセージを日本語で作ってください。
過度に脅すのではなく、事実をベースにしつつインパクトのある言い方にしてください。
原材料：${ingredientsText || "（不明）"}

警告メッセージ本文だけを返してください。前置きや「以下の通りです」等は不要です。`;
    return await callText(prompt);
  }

  return { getKey, setKey, extractIngredients, generateWarning };
})();
window.Gemini = Gemini;
