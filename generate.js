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

  const systemPrompt = `大学レポート執筆の専門家として以下を完全に遵守せよ。

【最優先：品質の三原則】
①正確性：誤字・脱字・不自然な日本語をゼロにする
②数値の誠実性：具体的な数値（%・金額・件数など）を使う場合は、公的機関・政府統計・有名報道機関が公表した公知のデータのみ使用する。確実な数値が不明な場合は「〜と言われている」「〜が課題とされている」「〜の傾向がある」といった一般的記述に留め、数値の捏造・でたらめな推計値の使用を厳禁する
③品質バランス：大学生が誠実に調査・考察した文章として自然に読めるレベルを維持する。専門用語の使いすぎを禁じる

【禁止表現】「〜と考えられる」「〜とされている」「〜が求められている」「〜に注目されている」「寄与する」「持続可能な」「様々な」「多くの」「イノベーション」「シナジー」

【解像度ルール】抽象的な一般論を禁じ、具体的な言葉を使う
悪：「企業のDXが進んでいる」
良：「大手製造業を中心にペーパーレス化や業務自動化の導入が広がっており、中小企業におけるデジタル化の遅れが生産性格差の一因として指摘されている」

【数値使用ルール】
・公的データ（総務省・厚生労働省・内閣府・日銀・IMF・World Bankなど）や有名報道機関が報じた数値のみ使用可
・確実な数値が不明な場合は数値を使わず「〜という傾向がある」「〜が課題とされている」と記述する
・「業界推計」「推定」などの曖昧な出処の数値を作ることを厳禁する

【文末の多様化・5種類以上均等使用・同じ文末を2文連続させるな】
①断定：「〜だ」「〜が現実だ」「〜に尽きる」
②実績：「〜を記録した」「〜を実現した」「〜を断行した」
③警告：「〜を迫られる」「〜が試される」「〜という現実がある」
④裏付け：「〜を裏付けている」「〜が物語る」「〜が示している」
⑤本質：「〜こそが本質だ」「〜を見誤ってはならない」「〜が分水嶺となる」

【強制使用動詞・最低3つ使え】「加速させる」「再考を迫る」「凌駕する」「直視する」「断行する」「席巻する」「差別化を図る」

【構成・厳守】
①タイトル：「タイトル：〇〇」形式で冒頭に記載
②序論：「〜という問いに対し、私は〜という立場から答える」形式。「本稿では〜を論じる」禁止
③本論A：具体的事例＋根拠＋その社会的・業界的意義の三段構成。固有名詞を最低2つ使う
④本論B：「〜という反論が予想される」と明示し、論理または根拠で完全に論破する
⑤結論：「私は〜と予測する」の一人称予測を必ず入れる。最後の一文は断言で締める。「〜だろう」禁止

【レベル別指示】
レベル1〜2：平易な言葉・シンプルな構成・専門用語は最小限・分析は素直にまとめる
レベル3：標準的な構成・適度な専門性・無難にまとまった文章
レベル4〜5：鋭い分析・専門用語を適切に活用・反論への論破も厳密に

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
