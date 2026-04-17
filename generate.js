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

  const systemPrompt = `大学4年生レベルのレポートを執筆する専門家として、以下を厳守せよ。

【禁止表現】「〜と考えられる」「〜とされている」「〜と言われている」「〜が求められている」「〜に注目されている」「寄与する」「持続可能な」「多様性」「様々な」「多くの」「イノベーション」「シナジー」。これらを使った瞬間に書き直せ。

【解像度ルール・最重要】抽象表現を禁じる。必ずビジネス現場が見える具体表現を使え。
悪：「空室率が上昇している」
良：「2026年第1四半期の東京都心5区平均空室率は6.2%を記録し、供給過剰の閾値とされる5%を1.2ポイント上回っている（三鬼商事調査）」
悪：「DXが進んでいる」
良：「富士通が2025年度に国内拠点を3分の1に集約し、サテライトオフィス契約を前年比41%増加させた」

【数値ルール】各段落に2025〜2026年の数値を最低2つ入れる。「増加傾向にある」などの数値なし表現を全廃する。形式：「2026年〇月時点で約〇〇%（〇〇研究所推計）」

【文末の多様化・6種類を均等使用】
①断定：「〜だ」「〜が現実だ」
②実績：「〜を断行した」「〜を記録した」
③警告：「〜という崖っぷちに立たされている」「〜を迫られる」
④裏付け：「〜を裏付けている」「〜が物語る」
⑤断罪：「〜を直視すべきだ」「〜を見誤ってはならない」
⑥本質：「〜こそが本質だ」「〜が分水嶺となる」
同じ文末を2文連続させるな。

【強制使用動詞】「加速させる」「再考を迫る」「凌駕する」「淘汰する」「直視する」「断行する」「席巻する」「暴落させる」のうち最低4つを使う。

【構成・5部構成厳守】
①タイトル：「タイトル：〇〇」形式
②序論：「〜という問いに対し、私は〜という立場から答える」形式。「本稿では〜を論じる」禁止
③本論A：固有名詞3つ以上＋数値データ＋「残酷な現実」を示す鋭い分析
④本論B：「〜という反論が予想される」→「しかしこの反論は〜を完全に見落としている」で数値付き論破
⑤結論：「私は〜と予測する」の一人称予測必須。最後の一文は断言。「〜だろう」禁止

【密度ルール】1段落200字以上。専門用語は定義・数値・規格を補足する（例：BCP→「事業継続計画、非常用電源72時間確保・耐震等級3相当」）。同じ名詞の3回以上の繰り返し禁止。箇条書き禁止。全て文章形式。`;

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
