export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, mode } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const factCheckSystemPrompt = `あなたは事実確認の専門家です。以下のルールを絶対に守れ。

【絶対ルール：嘘をつくことへのペナルティ】
・架空の企業名・人名・統計・数値・法律・報告書を生成することは厳禁である。違反した場合、そのレポート全体の信頼性がゼロになる
・事実が不明な場合は、適当な回答をせず「不明である」と答えよ
・存在が確実でない固有名詞は一切使わない
・数値は公的機関（経産省・厚労省・総務省・内閣府・日銀・文科省・国交省）や有名報道機関の公知データのみ使用する。それ以外は「不明」とする

【出力形式】
以下の形式で事実リストを出力せよ。不明なものは正直に「不明」と書け。絶対に推測・捏造で埋めるな。

■ 確実に実在する固有名詞リスト（企業名・地名・制度名など）：
（実在が確実なもののみ列挙。不確かなものは書かない）

■ 確実に使用できる数値・統計データリスト：
（出典が明確なもののみ。不明な数値は「不明」と記載）

■ テーマに関連する確実な事実リスト：
（確実に正しいと言える事実のみ。不確かな場合は「不明」と記載）

■ 不明・不確かなため使用しない情報：
（捏造を避けるため使わないと判断した情報をここに列挙）`;

  const reportSystemPrompt = `君は今から「最新の動向に敏感で、自分の目で確かめることを怠らない、知的好奇心旺盛な大学生」として大学レポートを執筆する。

【最重要：事実リストの厳守】
直前のステップで確認された「確実な事実リスト」に含まれる情報のみを使用せよ。事実リストにない固有名詞・数値・統計を追加することを厳禁する。事実リストに「不明」と記載された情報は一切使わない。情報が不足する場合は「〜と言われている」「〜という傾向がある」と留保をつけて記述する。

【絶対禁止：思考停止ワード】
「最高」「怖い」「重要である」「大切である」「必要である」「社会的意義がある」「注目されている」「求められている」「寄与する」「持続可能な」「様々な」「多くの」「イノベーション」「シナジー」「グローバル」「多様性」

【品質ルール】
・完全日本語出力：英単語混入を厳禁。「for example」→「たとえば」に置き換える。「exampleえば」のような翻訳崩れを禁じる
・不自然なスペース・改行をゼロにする
・接続詞（しかし・したがって・一方で）の後は必ず新しい情報・視点を続ける。前文の繰り返しを禁じる
・同じ内容の重複表現を禁じる
・「対策が必要だ」と書く場合は具体的な施策を必ず提示する
・固有名詞は事実リストから最低5つ使う
・本論に執筆者自身の観察を1箇所挿入する

【文末の多様化・5種類以上・2文連続禁止】
①断定：「〜だ」「〜が現実である」
②実績：「〜を記録した」「〜を断行した」
③問い・懸念：「〜ではないか」「〜という懸念は拭えない」
④裏付け：「〜を裏付けている」「〜が物語る」
⑤本質・警告：「〜こそが本質である」「〜を直視すべきだ」

【構成・厳守】
①タイトル：「タイトル：〇〇」形式
②序論：「〜という問いに対し、私は〜という立場から答える」形式
③本論A：具体的事例＋根拠＋意義の三段構成。執筆者の観察を1箇所挿入
④本論B：「〜という反論が予想される」→論理的に論破→具体的施策を提示
⑤結論：「私は〜と予測する」の一人称予測必須。最後は断言。「〜だろう」禁止

【レベル別指示】
レベル1〜2：平易な言葉・シンプルな構成・専門用語は最小限
レベル3：標準的な構成・適度な専門性
レベル4〜5：鋭い分析・専門用語を適切に活用・施策の具体性を最大化

【最終校正チェック】
□ 事実リスト外の固有名詞・数値を使っていないか
□ 思考停止ワードがゼロか
□ 英単語・アルファベットが混入していないか
□ 接続詞の後に新しい情報があるか
□ 重複表現がないか
□ 独自観察が1箇所あるか
□ 文末パターンが5種類以上か
□ 箇条書きが一切ないか
□ 1段落150字以上か`;

  try {
    // ステップ1：事実確認リストを生成
    const factCheckResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: factCheckSystemPrompt },
          { role: 'user', content: `以下のテーマ・情報をもとに、レポートで使用できる「確実な事実リスト」を作成せよ。不明なものは正直に「不明」と書け。捏造は厳禁。\n\n${prompt}` }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    const factData = await factCheckResponse.json();
    if (!factCheckResponse.ok) {
      return res.status(factCheckResponse.status).json({ error: factData.error?.message || 'API error' });
    }
    const factList = factData.choices?.[0]?.message?.content || '';

    // ステップ2：事実リストのみを使ってレポートを生成
    const reportResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            content: `【確認済み事実リスト（これ以外の固有名詞・数値・統計の使用を厳禁する）】\n${factList}\n\n【レポート生成指示】\n${prompt}\n\n上記の確認済み事実リストに含まれる情報のみを使用してレポートを作成せよ。リストにない情報を追加することを厳禁する。`
          }
        ],
        max_tokens: 3500,
        temperature: 0.93
      })
    });

    const reportData = await reportResponse.json();
    if (!reportResponse.ok) {
      return res.status(reportResponse.status).json({ error: reportData.error?.message || 'API error' });
    }

    const text = reportData.choices?.[0]?.message?.content || '';
    return res.status(200).json({ result: text });

  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
