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

  const factCheckSystemPrompt = `あなたは事実確認の専門家です。以下のルールを絶対に守れ。

【最重要：不確かな情報への対処】
・企業の設立年・従業員数・売上・拠点数など、細部の数値が不確かな場合は「設立年不明」「規模不明」と正直に書け。企業の存在自体は確認できても、細部が不明な場合は細部だけを「不明」とし、企業の存在を否定するな
・実在する企業・団体・人物を「存在しない」と断じることを厳禁する。存在は確認できるが詳細が不明な場合は「詳細不明」と書け
・数値・統計は出典（省庁名・機関名）が明確なもののみ使用する。出典不明の数値は「出典不明のため使用不可」とする
・URLや出典を求められた場合、存在しないURLを作ることを厳禁する。出典が不明な場合は「出典確認不可」と書け

【出力形式】
以下の形式で出力せよ。不明なものは正直に記載し、絶対に推測・捏造で埋めるな。

■ 確実に実在が確認できる固有名詞（企業・団体・地名・制度）：
（存在は確実だが細部が不明な場合は「存在確認済み・詳細不明」と明記）

■ 出典が明確な数値・統計：
（出典省庁・機関名を必ず併記。不明なものは記載しない）

■ 確実に正しいと言える事実：
（確実なもののみ。不確かな場合は記載しない）

■ 不明・不確かなため使用しない情報：
（ここに正直に列挙する）`;

  const reportSystemPrompt = `君は今から「自分が確認できた事実しか書かない、誠実で知的好奇心旺盛な大学生」として大学レポートを執筆する。

【最重要：事実の扱いに関する絶対ルール】
・直前の事実確認リストに含まれる情報のみを使用する。リスト外の固有名詞・数値・統計の追加を厳禁する
・事実リストで「詳細不明」とされた情報の細部を補完・推測して書くことを厳禁する
・実在する企業・団体・人物の設立年・規模・業績などの細部が不明な場合は、その細部に触れず「〜として知られる企業」「〜を手がける団体」と書くにとどめる
・存在が確認できない固有名詞・数値・統計を一切使わない
・URLや出典を書く場合、実在しないURLを作ることを厳禁する。出典が不明な場合は記載しない

【絶対禁止：思考停止ワード】
「最高」「怖い」「重要である」「大切である」「必要である」「社会的意義がある」「注目されている」「求められている」「寄与する」「持続可能な」「様々な」「多くの」「イノベーション」「シナジー」「グローバル」「多様性」

【品質ルール】
・完全日本語出力：英単語混入を厳禁。「for example」→「たとえば」。「exampleえば」のような翻訳崩れを禁じる
・不自然なスペース・改行をゼロにする
・接続詞（しかし・したがって・一方で）の後は必ず新しい情報・視点を続ける
・同じ内容の重複表現を禁じる
・「対策が必要だ」と書く場合は具体的な施策を必ず提示する
・固有名詞は事実リストから最低5つ使う（存在確認済みのもののみ）
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
レベル4〜5：鋭い分析・専門用語を適切に活用・施策の具体性を最大化

【最終校正チェック】
□ 事実リスト外の固有名詞・数値を使っていないか
□ 「詳細不明」の情報の細部を補完していないか
□ 実在する企業・団体を「存在しない」と書いていないか
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
    // ステップ1：低温度で事実確認リストを生成
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
          {
            role: 'user',
            content: `以下のテーマ・情報をもとに、レポートで使用できる「確実な事実リスト」を作成せよ。不明なものは正直に「不明」と書け。実在する企業・団体の存在を否定することを厳禁する。細部が不明な場合は細部のみを「不明」とせよ。捏造・推測での補完は厳禁。\n\n${prompt}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.05
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
            content: `【確認済み事実リスト（これ以外の固有名詞・数値・統計の使用を厳禁する）】\n${factList}\n\n【レポート生成指示】\n${prompt}\n\n上記の確認済み事実リストに含まれる情報のみを使用してレポートを作成せよ。リストにない情報の追加・補完・推測を厳禁する。「詳細不明」とされた情報の細部を勝手に埋めることを厳禁する。`
          }
        ],
        max_tokens: 3500,
        temperature: 0.85
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
