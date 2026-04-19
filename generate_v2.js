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

  // モデルの優先順位リスト（廃止されたら自動で次を試す）
  const mainModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ];

  const lightModels = [
    'llama-3.1-8b-instant',
    'llama3-groq-8b-8192-tool-use-preview',
    'gemma2-9b-it'
  ];

  const isGenerate = mode === 'generate';
  const models = isGenerate ? mainModels : lightModels;

  const systemPrompt = isGenerate ? `君は今から「最新の動向に敏感で、自分の目で確かめることを怠らない、知的好奇心旺盛な大学生」として大学レポートを執筆する。

【最重要：品質の三原則】
①正確な日本語：誤字・脱字・不自然なスペース・改行をゼロにする
②完全日本語出力：英単語混入を厳禁。「for example」→「たとえば」。「exampleえば」のような翻訳崩れを禁じる
③数値の誠実性：数値は公的機関や有名報道機関の公知データのみ使用。不明な数値は「〜と言われている」に置き換える

【絶対禁止】「最高」「怖い」「重要である」「寄与する」「持続可能な」「様々な」「多くの」「イノベーション」「シナジー」

【構成】①タイトル：「タイトル：〇〇」形式 ②序論 ③本論A ④本論B（反論と論破） ⑤結論（一人称予測必須）

【文末の多様化・5種類以上・2文連続禁止】断定・実績・問い・裏付け・本質の5種類を均等使用

【独自観察】本論に執筆者自身の具体的な観察を1箇所挿入する

【数値・固有名詞】確実な数値のみ使用。架空の統計・企業名を作ることを厳禁する。固有名詞は5つ以上使う

【重複排除】同じ内容を二度書くことを禁じる。接続詞の後は必ず新しい情報を続ける

【具体的施策】「対策が必要だ」と書く場合は具体的な施策を提示する

【校正】不自然なスペース・改行・英単語混入がないか出力前に確認する` : `あなたは調査・評価の専門家です。指示に従い、簡潔で正確な日本語で回答してください。架空の情報を作ることを厳禁します。`;

  // モデルを順番に試してエラーなら次を使う
  async function tryWithFallback(models, body) {
    for (const model of models) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ ...body, model })
        });
        const data = await response.json();

        // モデル廃止・非対応エラーの場合は次のモデルを試す
        if (!response.ok) {
          const errMsg = data.error?.message || '';
          if (errMsg.includes('decommissioned') ||
              errMsg.includes('not supported') ||
              errMsg.includes('deprecated') ||
              errMsg.includes('does not exist')) {
            continue; // 次のモデルへ
          }
          return { ok: false, error: errMsg };
        }

        const text = data.choices?.[0]?.message?.content || '';
        return { ok: true, text };
      } catch (err) {
        continue; // ネットワークエラーなら次のモデルへ
      }
    }
    return { ok: false, error: '利用可能なモデルが見つかりませんでした。しばらく待ってから再試行してください。' };
  }

  if (mode === 'research') {
    const researchSystemPrompt = `あなたはレポート執筆の調査設計の専門家です。ユーザーが以下のテーマでレポートを書こうとしています。このレポートを「事実に基づいた信頼性の高いもの」にするために、ユーザー自身が事前に調べて確認すべき項目をリストアップしてください。

【ルール】
・各項目には「どこで調べられるか（調査先）」を併記する
・項目は5〜8個程度
・以下の形式で出力する

【このレポートに必要な調査項目】

①【項目名】
・調べる内容：
・調査先の例：
・記入欄：（ユーザーが後で記入する空欄）

余計な説明は不要。調査項目リストのみ出力せよ。`;

    const result = await tryWithFallback(lightModels, {
      messages: [
        { role: 'system', content: researchSystemPrompt },
        { role: 'user', content: `テーマ：${prompt}` }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    if (!result.ok) return res.status(500).json({ error: result.error });
    return res.status(200).json({ result: result.text });
  }

  // レポート生成・AI検査
  const result = await tryWithFallback(models, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: researchData
          ? `【調査済みデータ（これ以外の固有名詞・数値の使用を厳禁）】\n${researchData}\n\n${prompt}`
          : prompt
      }
    ],
    max_tokens: isGenerate ? 3500 : 2000,
    temperature: isGenerate ? 0.93 : 0.5
  });

  if (!result.ok) return res.status(500).json({ error: result.error });
  return res.status(200).json({ result: result.text });
}
