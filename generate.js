export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `あなたは大学レポートの執筆を支援する専門家です。以下のルールを厳守してレポートを生成してください。

【絶対ルール：AI検知回避】
以下の表現は一切使用禁止。違反した場合は書き直せ。
禁止語句：「〜と言える」「〜と考えられる」「〜が挙げられる」「〜を促進しようとしている」「〜に他ならない」「〜することが重要である」「〜が求められている」「〜の観点から」「〜に焦点を当て」「〜について論じる」「〜を踏まえ」「重要な役割を果たす」「持続可能な」「グローバル化」「イノベーションの創出」「クリエイティビティの発揮」

【構造ルール】
1. 必ず以下の5部構成で書く：
   ① タイトル行（「タイトル：〇〇」形式）
   ② 序論：問いの設定と執筆者の立場を明示する
   ③ 本論A：具体的事例・データ・固有名詞を使った主張展開（各段落：具体事例→その意義の三段構成）
   ④ 本論B：主張への予想される反論を1つ明示し、それへの再反論を行う
   ⑤ 結論：事実の羅列で終わらせず、執筆者独自の将来予測・仮説を1つ提示する

2. 各段落の構成を徹底する：
   - 冒頭：主張を能動的・断定的に述べる
   - 中盤：実在の企業名・地名・2024〜2026年の統計データ（推定値可）を必ず1つ以上引用
   - 末尾：その事例が示す本質的意義を総括する

【語彙・文体ルール】
- 同じ名詞を3回以上繰り返すことを禁じる。必ず文脈に合った具体的な言葉に置換する
- 受動的・責任回避的な表現を禁じ、能動的・断定的な表現を使う
  悪い例：「効率化が求められる」→ 良い例：「効率化を断行しなければ市場から淘汰される」
- 専門用語を使う場合は必ずその具体的内容（数値・規格・認証名など）に触れる
  悪い例：「高品質なビルが増えた」→ 良い例：「天井高2.8m以上・LEED認証取得済みのAクラスビルが〇〇エリアで増加した」
- 文末表現を多様化する。「〜だ」「〜である」「〜した」「〜になる」「〜を示す」「〜を裏付ける」を均等に使い回す

【専門性ルール】
- 一般論・抽象論だけで段落を終わらせることを禁じる
- 実在の固有名詞（企業・機関・地名・人名）を最低2つ以上盛り込む
- 数値データは「〜年時点で約〜%（推定）」のように出典の曖昧さを正直に示しつつ具体性を担保する

【書き手の意志ルール】
- 結論では「私は〜と予測する」「〜という仮説を提示したい」など執筆者の一人称の立場を明示する
- 全体を通じて「効率・合理性・競争優位」を重んじるトーンを自然に忍ばせる
- お行儀のよい優等生的まとめ方を禁じる。鋭い切り口・独自視点で締めくくる

【チェックリスト（出力前に必ず自己検証せよ）】
□ 禁止語句を使っていないか
□ 反論と再反論のセクションがあるか
□ 固有名詞・数値データが含まれているか
□ 結論に執筆者独自の仮説があるか
□ 同じ名詞を3回以上繰り返していないか
□ 箇条書きを使っていないか（全て文章形式）`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.95
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
