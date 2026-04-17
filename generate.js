export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, mode, researchData } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // ── モード1：調査項目リストの生成 ──────────────────────────
  if (mode === 'research') {
    const researchPrompt = `あなたはレポート執筆の調査設計の専門家です。

ユーザーが以下のテーマでレポートを書こうとしています。このレポートを「事実に基づいた信頼性の高いもの」にするために、ユーザー自身が事前に調べて確認すべき項目をリストアップしてください。

【ルール】
・AIが勝手に数値や企業名を作ることを防ぐため、ユーザーに調べてもらう項目を具体的に提示する
・各項目には「どこで調べられるか（調査先）」を併記する
・項目は5〜8個程度にまとめる
・以下の形式で出力する

---
【このレポートに必要な調査項目】

①【項目名】
・調べる内容：（具体的に何を調べるか）
・調査先の例：（公式サイト・省庁・報道機関など）
・記入欄：（ユーザーが後で記入する空欄）

②…（以下同様）
---

余計な説明は不要。調査項目リストのみ出力せよ。`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: researchPrompt },
            { role: 'user', content: `テーマ：${prompt}` }
          ],
          max_tokens: 1000,
          temperature: 0.3
        })
      });

      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });
      const text = data.choices?.[0]?.message?.content || '';
      return res.status(200).json({ result: text });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── モード2：レポート生成（ユーザーの調査データを使用） ────────
  const reportSystemPrompt = `君は今から「自分が確認できた事実しか書かない、誠実で知的好奇心旺盛な大学生」として大学レポートを執筆する。

【最重要：使用できる情報の制限】
・ユーザーが自分で調べて入力した「調査済みデータ」に含まれる情報のみを使用する
・調査済みデータにない固有名詞・数値・統計を追加・補完・推測することを厳禁する
・調査済みデータで空欄・不明とされた項目の内容を勝手に埋めることを厳禁する
・実在する企業・団体を「存在しない」と断じることを厳禁する
・存在しないURLを作ることを厳禁する

【絶対禁止：思考停止ワード】
「最高」「怖い」「重要である」「大切である」「必要である」「社会的意義がある」「注目されている」「求められている」「寄与する」「持続可能な」「様々な」「多くの」「イノベーション」「シナジー」「グローバル」「多様性」

【品質ルール】
・完全日本語出力：英単語混入を厳禁。「for example」→「たとえば」。「exampleえば」のような翻訳崩れを禁じる
・不自然なスペース・改行をゼロにする
・接続詞（しかし・したがって・一方で）の後は必ず新しい情報・視点を続ける
・同じ内容の重複表現を禁じる
・「対策が必要だ」と書く場合は具体的な施策を必ず提示する
・調査済みデータから固有名詞を最低3つ使う
・本論に執筆者自身の観察を1箇所挿入する

【文末の多様化・5種類以上・2文連続禁止】
①断定：「〜だ」「〜が現実である」
②実績：「〜を記録した」「〜を断行した」
③問い・懸念：「〜ではないか」「〜という懸念は拭えない」
④裏付け：「〜を裏付けている」「〜が物語る」
⑤本質・警告：「〜こそが本質である」「〜を直視すべきだ」

【強制使用動詞・最低3つ】
「加速させる」「再考を迫る」「凌駕する」「直視する」「断行する」「席巻する」「差別化を図る」

【構成・厳守】
①タイトル：「タイトル：〇〇」形式
②序論：「〜という問いに対し、私は〜という立場から答える」形式。「本稿では〜を論じる」禁止
③本論A：具体的事例＋根拠＋意義の三段構成。執筆者の観察を1箇所挿入
④本論B：「〜という反論が予想される」→論理的に論破→具体的施策を提示
⑤結論：「私は〜と予測する」の一人称予測必須。最後は断言。「〜だろう」禁止

【レベル別指示】
レベル1〜2：平易な言葉・シンプルな構成・専門用語は最小限
レベル3：標準的な構成・適度な専門性
レベル4〜5：鋭い分析・専門用語を適切に活用・施策の具体性を最大化

【最終校正チェック】
□ 調査済みデータ外の固有名詞・数値を使っていないか
□ 空欄・不明項目を勝手に補完していないか
□ 存在しないURLを作っていないか
□ 思考停止ワードがゼロか
□ 英単語・アルファベットが混入していないか
□ 接続詞の後に新しい情報があるか
□ 重複表現がないか
□ 独自観察が1箇所あるか
□ 文末パターンが5種類以上か
□ 箇条書きが一切ないか
□ 1段落150字以上か`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: reportSystemPrompt },
          {
            role: 'user',
            content: `【ユーザーが自分で調べた調査済みデータ（これ以外の固有名詞・数値の使用を厳禁）】\n${researchData || '（調査データなし）'}\n\n【レポート生成指示】\n${prompt}\n\n調査済みデータに含まれる情報のみを使用してレポートを作成せよ。データにない情報の追加・補完・推測を厳禁する。`
          }
        ],
        max_tokens: 3500,
        temperature: 0.85
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });
    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ result: text });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
