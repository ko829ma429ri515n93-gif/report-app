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

  // ── モード1：調査項目リストの生成 ──────────────────────
  if (mode === 'research') {
    const systemPrompt = `あなたはレポート執筆の調査設計の専門家です。

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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
        model: mode === 'generate' ? 'llama-3.3-70b-versatile' : 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: mode === 'generate' ? 3500 : 2000,
        temperature: 0.93
      })
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });
      return res.status(200).json({ result: data.choices?.[0]?.message?.content || '' });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── モード2：AI検知テスト ────────────────────────────
  if (mode === 'detect') {
    const detectPrompt = `あなたは大学教授として、提出されたレポートがAIで生成されたものかどうかを厳しく評価します。以下の評価基準で採点し、必ず指定のJSON形式のみで出力してください。

【評価基準】
①AI特有の語彙・表現パターン（25点）
・「〜と考えられる」「〜が求められている」「〜に他ならない」「重要な役割を果たす」などの頻出
・文末表現の単調な繰り返し
・「多様な」「持続可能な」「イノベーション」などの抽象語の多用

②論理構造の自然さ（25点）
・接続詞の後が前文の繰り返しになっていないか
・重複表現・同語反復がないか
・論理の飛躍・唐突な展開がないか

③情報の具体性・解像度（25点）
・固有名詞（企業名・地名・人名）が実在感を持って使われているか
・数値データに出典・文脈があるか
・「中学生でも書ける抽象表現」で終わっていないか

④書き手の個性・体験（25点）
・執筆者自身の観察・体験が含まれているか
・独自の視点・仮説・予測があるか
・「調べた苦労」が文章に滲み出ているか

【採点方法】
各項目を0〜25点で採点。合計点が「人間らしさスコア」（100点満点）。
スコアが低いほどAIらしい。スコアが高いほど人間らしい。

【出力形式】必ずこのJSON形式のみで出力。前後に説明文を入れるな。
{
  "score": 合計点（数値）,
  "grade": "判定（A/B/C/D/F）",
  "verdict": "一言判定（例：AIの影が濃厚、ほぼ人間らしい など）",
  "items": [
    {"name": "AI特有の語彙・表現パターン", "score": 点数, "max": 25, "comment": "具体的な指摘"},
    {"name": "論理構造の自然さ", "score": 点数, "max": 25, "comment": "具体的な指摘"},
    {"name": "情報の具体性・解像度", "score": 点数, "max": 25, "comment": "具体的な指摘"},
    {"name": "書き手の個性・体験", "score": 点数, "max": 25, "comment": "具体的な指摘"}
  ],
  "risks": ["バレやすいポイント1", "バレやすいポイント2", "バレやすいポイント3"],
  "improvements": ["改善提案1", "改善提案2", "改善提案3"]
}`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: detectPrompt }, { role: 'user', content: `以下のレポートを評価せよ：\n\n${prompt}` }],
          max_tokens: 1500, temperature: 0.3
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });
      const raw = data.choices?.[0]?.message?.content || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      try {
        const parsed = JSON.parse(clean);
        return res.status(200).json({ result: parsed });
      } catch {
        return res.status(200).json({ result: null, raw });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── モード3：レポート生成 ────────────────────────────
  const reportSystemPrompt = `君は今から「自分が確認できた事実しか書かない、誠実で知的好奇心旺盛な大学生」として大学レポートを執筆する。

【最重要：事実の扱い】
・調査済みデータが提供された場合、そのデータに含まれる情報のみを使用する
・調査済みデータにない固有名詞・数値・統計を追加・補完・推測することを厳禁する
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
・固有名詞を最低3つ使う
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
②序論：「〜という問いに対し、私は〜という立場から答える」形式
③本論A：具体的事例＋根拠＋意義の三段構成。執筆者の観察を1箇所挿入
④本論B：「〜という反論が予想される」→論理的に論破→具体的施策を提示
⑤結論：「私は〜と予測する」の一人称予測必須。最後は断言。「〜だろう」禁止

【レベル別指示】
レベル1〜2：平易な言葉・シンプルな構成・専門用語は最小限
レベル3：標準的な構成・適度な専門性
レベル4〜5：鋭い分析・専門用語を適切に活用・施策の具体性を最大化`;

  try {
    const userContent = researchData
      ? `【調査済みデータ（これ以外の固有名詞・数値の使用を厳禁）】\n${researchData}\n\n【レポート指示】\n${prompt}`
      : prompt;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: reportSystemPrompt }, { role: 'user', content: userContent }],
        max_tokens: 3500, temperature: 0.93
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });
    return res.status(200).json({ result: data.choices?.[0]?.message?.content || '' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
