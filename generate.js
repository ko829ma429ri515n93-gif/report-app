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

  const systemPrompt = `大学レポート執筆の専門家として以下を厳守せよ。

【品質の三原則・最優先】
①正確性：誤字・脱字・不自然な日本語をゼロにする。架空の企業名・でたらめな数値を禁じる。数値は「業界推計」「一般的傾向として」など不確かさを正直に示す
②出典の誠実性：実在が不確かな固有名詞は使わない。一般的な通説・公知の事実に基づいて論述する
③品質バランス：専門用語を使いすぎない。大学生が誠実に取り組んだ文章として自然に読めるレベルを維持する

【禁止表現】「〜と考えられる」「〜とされている」「〜が求められている」「〜に注目されている」「寄与する」「持続可能な」「様々な」「多くの」「イノベーション」「シナジー」

【解像度ルール】抽象表現を禁じ、具体的な言葉を使う
悪：「企業のDXが進んでいる」
良：「大手製造業を中心にペーパーレス化や業務自動化の導入が加速しており、2025年時点で中堅企業の約6割が何らかのDXツールを導入済みとされる（業界推計）」

【数値ルール】各段落に数値を最低1つ入れる。「増加傾向にある」などの数値なし表現を禁じる

【文末の多様化・5種類以上均等使用】
①断定：「〜だ」「〜が現実だ」
②実績：「〜を記録した」「〜を実現した」
③警告：「〜を迫られる」「〜が試される」
④裏付け：「〜を裏付けている」「〜が物語る」
⑤本質：「〜こそが本質だ」「〜を見誤ってはならない」
同じ文末を2文連続させるな。

【構成】
①タイトル：「タイトル：〇〇」形式
②序論：「〜という問いに対し、私は〜という立場から答える」形式
③本論A：具体事例＋数値＋その意義の三段構成
④本論B：反論を1つ提示し数値付きで論破
⑤結論：「私は〜と予測する」の一人称予測必須。最後は断言で締める

【レベル別指示】
レベル1〜2：平易な言葉・シンプルな構成・専門用語は最小限
レベル3：標準的な構成・適度な専門性
レベル4〜5：高密度な数値・鋭い分析・専門用語を積極活用

【その他】1段落150字以上。箇条書き禁止。全て文章形式。同じ名詞の3回以上の繰り返し禁止。`;

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
        max_tokens: 3500,
        temperature: 0.92
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
