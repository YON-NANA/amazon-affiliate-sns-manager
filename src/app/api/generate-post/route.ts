import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GeneratedVariation, ToneId } from '@/lib/types';
import { appendPrDisclosure } from '@/lib/amazon';

interface RequestBody {
  asin: string;
  title: string;
  category: string;
  genre: 'life' | 'pet';
  targetAudience?: string;
  affiliateUrl: string;
  platform: 'x' | 'threads' | 'both';
  benefits?: string[];
  customNotes?: string;
  includeNoLinkPost?: boolean; // アカバン防止用のリンクなし共感ポストを生成するか
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();
    const { asin, title, category, genre, targetAudience, affiliateUrl, platform, benefits, customNotes, includeNoLinkPost } = body;

    if (!title) {
      return NextResponse.json({ error: '商品名は必須です。' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    // If Gemini API Key is available, generate using Gemini
    if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
      try {
        const generatedVariations = await generateWithGemini(apiKey, {
          asin,
          title,
          category,
          genre,
          targetAudience: targetAudience || (genre === 'pet' ? '愛犬・愛猫の飼い主' : '暮らしを快適にしたい人'),
          affiliateUrl,
          platform,
          benefits: benefits || [],
          customNotes: customNotes || '',
          includeNoLinkPost: !!includeNoLinkPost,
        });

        if (generatedVariations && generatedVariations.length > 0) {
          return NextResponse.json({
            variations: generatedVariations,
            source: 'gemini',
          });
        }
      } catch (geminiError) {
        console.warn('Gemini API execution error, fallback to algorithmic template generator:', geminiError);
      }
    }

    // High-quality fallback generator (ensures zero downtime & works out-of-the-box before API key is set)
    const fallbackVariations = generateFallbackVariations({
      asin,
      title,
      category,
      genre,
      targetAudience: targetAudience || (genre === 'pet' ? 'ペットオーナー' : '日々の暮らしを整えたい人'),
      affiliateUrl,
      platform,
      benefits: benefits || [],
      customNotes: customNotes || '',
      includeNoLinkPost: !!includeNoLinkPost,
    });

    return NextResponse.json({
      variations: fallbackVariations,
      source: apiKey ? 'template_fallback' : 'template_mode',
      note: apiKey ? 'Gemini API呼び出しでフォールバックしました' : 'GEMINI_API_KEY未設定のため高品質テンプレート生成で動作中',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateWithGemini(apiKey: string, params: {
  asin: string;
  title: string;
  category: string;
  genre: 'life' | 'pet';
  targetAudience: string;
  affiliateUrl: string;
  platform: 'x' | 'threads' | 'both';
  benefits: string[];
  customNotes: string;
  includeNoLinkPost?: boolean;
}): Promise<GeneratedVariation[]> {
  const ai = new GoogleGenAI({ apiKey });

  const isX = params.platform === 'x' || params.platform === 'both';

  const prompt = `あなたは「12年間で1,000頭超の犬猫をレスキュー・譲渡してきた動物保護活動の現場経験者であり、現在も保護犬20頭・保護猫30頭と暮らしながら被災地の愛護団体取材で電源と水の過酷さを痛感した専門家」です。
以下のAmazon商品について、読者が「我が子の命を守る備えとして絶対に必要だ」「普段の暮らしでも役立つ（フェーズフリー）」と強く納得し、思わずタップしたくなるSNS投稿文（4パターン：リンク付き3種 ＋ アカバン防止用のリンク無し共感ポスト1種）を日本語で作成し、指定のJSON形式で出力してください。

【商品情報】
- 商品名: ${params.title}
- ASIN: ${params.asin}
- ジャンル: ${params.genre === 'pet' ? 'ペット用品・ペット防災・保護現場愛用品' : '暮らし・日用品・フェーズフリー防災'}
- カテゴリ: ${params.category}
- ターゲット読者層: ${params.targetAudience}
- 推しポイント/特徴: ${params.benefits.join(', ') || '高評価レビュー多数'}
- 追記メモ: ${params.customNotes || 'なし'}
- トラッキングリンク: ${params.affiliateUrl}

【投稿の作成要件】
1. 投稿プラットフォーム: ${params.platform === 'both' ? 'X (Twitter) および Threads 最適' : params.platform === 'x' ? 'X (Twitter) 最適' : 'Threads 最適'}
2. 単なるアフィリエイト・おすすめ紹介ではなく、「命を守る備え」「多頭現場で試行錯誤して辿り着いた本当に役立つ知恵・消耗品」として語ること。
3. 「普段の暮らしに馴染み、災害時にはペットと家族を守る」という【フェーズフリー】の視点を必ず組み込むこと。
4. 「ペットがいると避難所に行きづらい（在宅・車中泊避難になりやすい）」という現実的な課題に寄り添う共感文にすること。
5. 冒頭1行目（フック）は保護現場や被災現場のリアルな視点で強烈に引きつけること。
6. 通常パターン(1〜3)は、本文の最後に必ずトラッキングリンク「${params.affiliateUrl}」と「#PR」を含めること。
7. 🛡️ パターン4 (tone="no_link_tips") は【アカバン防止専用ポスト】です！
   リンクおよび #PR を一切含めず、純粋に「命を守るペット防災・在宅避難の知恵」「多頭現場の消臭・衛生・換毛期ハック」としてフォロワーの共感と保存を獲得する有益ポストにしてください。
8. 長さ:
   ${isX ? '- X向け: 140字以内を目安。要点を研ぎ澄ます。' : '- Threads向け: 200〜300字程度。現場のエピソードや共感を交えた温かく真摯な語り口。'}

【出力してほしい4つの切り口】
- パターン1: tone="problem_solving" (命を守る備え・停電断水・お悩み解決型)
- パターン2: tone="honest_review" (多頭現場愛用・フェーズフリー検証・本音レビュー型)
- パターン3: tone="empathy_story" (在宅避難共感・被災現場の教訓・ストーリー型)
- パターン4: tone="no_link_tips" (アカバン防止: リンク無しの純粋な有益知恵袋ポスト)

【出力形式】
JSONオブジェクトのみを出力してください（Markdownコードブロック \`\`\`json も可）。
キー:
{
  "variations": [
    {
      "id": "var_1",
      "tone": "problem_solving",
      "toneName": "お悩み解決型",
      "headline": "短くキャッチーな見出し",
      "content": "投稿本文（リンクと #PR を含む）",
      "tags": ["タグ1", "タグ2"],
      "featuresUsed": ["使用した特徴1"],
      "isNoLink": false
    },
    ...
  ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const text = response.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.variations && Array.isArray(parsed.variations)) {
      return parsed.variations.map((v: Partial<GeneratedVariation>, idx: number) => {
        const isNoLink = v.tone === 'no_link_tips' || v.isNoLink;
        return {
          id: v.id || `var_${idx + 1}`,
          tone: (v.tone as ToneId) || (idx === 0 ? 'problem_solving' : idx === 1 ? 'honest_review' : idx === 2 ? 'empathy_story' : 'no_link_tips'),
          toneName: v.toneName || (isNoLink ? '🛡️ アカバン防止（リンク無し知恵袋）' : idx === 0 ? 'お悩み解決型' : idx === 1 ? 'リアル愛用者型' : '共感ストーリー型'),
          headline: v.headline || 'おすすめポイント',
          content: isNoLink ? (v.content || '') : appendPrDisclosure(v.content || ''),
          characterCount: (v.content || '').length,
          tags: v.tags || (params.genre === 'pet' ? ['ペットのいる暮らし', '買ってよかった'] : ['暮らしを整える', '時短家事']),
          featuresUsed: v.featuresUsed || params.benefits,
          isNoLink: !!isNoLink,
        };
      });
    }
  }

  throw new Error('Failed to parse Gemini response as JSON');
}

function generateFallbackVariations(params: {
  asin: string;
  title: string;
  category: string;
  genre: 'life' | 'pet';
  targetAudience: string;
  affiliateUrl: string;
  platform: 'x' | 'threads' | 'both';
  benefits: string[];
  customNotes: string;
  includeNoLinkPost?: boolean;
}): GeneratedVariation[] {
  const isPet = params.genre === 'pet';
  const benefit1 = params.benefits[0] || (isPet ? '愛犬・愛猫のストレス解消＆健康サポート' : '家事の手間が劇的に激減して時短');
  const benefit2 = params.benefits[1] || (isPet ? 'お手入れ簡単で長持ち' : '丸洗いできて使い勝手バツグン');

  const variations: GeneratedVariation[] = [];

  // Pattern 1: Problem solving
  const content1 = isPet
    ? `もっと早く買えばよかった…！🐾\n${params.title}\n\n${benefit1}で日々の悩みが一気に解消された。${benefit2}なのも本当に助かる。\nペットと暮らしてる人には全力でおすすめしたい！\n\n👇詳細・セール確認\n${params.affiliateUrl} #PR`
    : `家事のストレスが半分になった神アイテム…！✨\n${params.title}\n\n${benefit1}から準備も後片付けも一瞬で終わる。\n${benefit2}なのもQOL上がりすぎて感動した。\n\n👇チェックしてみて\n${params.affiliateUrl} #PR`;

  variations.push({
    id: 'var_fallback_1',
    tone: 'problem_solving',
    toneName: 'お悩み解決型（フック重視）',
    headline: isPet ? 'ペットの困りごとを即解決' : '家事ストレス激減＆時短',
    content: content1,
    characterCount: content1.length,
    tags: isPet ? ['ペットのいる暮らし', '買ってよかった', '猫好きさんと繋がりたい'] : ['暮らしを整える', '時短家事', 'QOL向上'],
    featuresUsed: [benefit1, benefit2],
    isNoLink: false,
  });

  // Pattern 2: Honest review
  const content2 = isPet
    ? `正直レビュー。SNSでよく見かけて半信半疑だった「${params.title}」を試したら想像以上によかった…！\n\nうちの子も大喜びで夢中になってくれてるし、${benefit1}。買い替えや追加にもリピート確定。\n\n気になる人は今のうちに👇\n${params.affiliateUrl} #PR`
    : `正直、もっと早く知りたかった…！\n「${params.title}」を使い始めてから自炊・掃除のハードルがガタ落ちしました。\n\n特に${benefit1}のが最高すぎる。耐久性もあってコスパも抜群◎\n\n👇Amazonリンク\n${params.affiliateUrl} #PR`;

  variations.push({
    id: 'var_fallback_2',
    tone: 'honest_review',
    toneName: 'リアル愛用者レビュー型',
    headline: '本音の買ってよかったレビュー',
    content: content2,
    characterCount: content2.length,
    tags: isPet ? ['愛用品紹介', 'ペットグッズ', '正直レビュー'] : ['愛用品', '暮らしの知恵', '便利グッズ'],
    featuresUsed: [benefit1],
    isNoLink: false,
  });

  // Pattern 3: Relatable / Deal
  const content3 = isPet
    ? `【${params.targetAudience}必見】\n日々の小さなストレス、これ1つでゼロになりました🐶🐱\n\n「${params.title}」\n・${benefit1}\n・${benefit2}\n\n在庫あるうちにチェックしてみてね👇\n${params.affiliateUrl} #PR`
    : `【${params.targetAudience}に伝えたい】\n暮らしの質を上げたいならまずこれ試してほしい…！🌿\n\n「${params.title}」\n✔ ${benefit1}\n✔ ${benefit2}\n\nタイムセールやクーポン出てる時が狙い目👇\n${params.affiliateUrl} #PR`;

  variations.push({
    id: 'var_fallback_3',
    tone: 'empathy_story',
    toneName: 'ターゲット特化・箇条書き型',
    headline: '要点がすぐ伝わる箇条書き訴求',
    content: content3,
    characterCount: content3.length,
    tags: isPet ? ['ペットとの暮らし', 'おすすめグッズ'] : ['買ってよかったもの', '一人暮らし', '生活便利品'],
    featuresUsed: [benefit1, benefit2],
    isNoLink: false,
  });

  // Pattern 4: Anti-ban No-link Tips
  const content4 = isPet
    ? `【猫・犬飼いの豆知識】🐾\n換毛期や部屋の掃除でコロコロを使いすぎる人は、まずゴム手袋で撫でてみて！静電気で毛が驚くほど一瞬で集まる。\nそのあとにブラッシングすると抜け毛の散らかりが激減します。\nペットとの暮らしをもっと快適にする知恵があればぜひ教えてください✨`
    : `【暮らしの時短ハック】💡\nキッチンの油汚れやシンクの水垢は、「溜めてから落とす」より「寝る前の1分リセット」が一番ラク。\n中性洗剤をサッと吹きかけてマイクロファイバーでひと拭きするだけで、毎週末のゴシゴシ掃除から一生解放されます🌿`;

  variations.push({
    id: 'var_fallback_4',
    tone: 'no_link_tips',
    toneName: '🛡️ アカバン防止（リンク無し知恵袋）',
    headline: 'アカウントの健康を保つ共感ポスト',
    content: content4,
    characterCount: content4.length,
    tags: isPet ? ['ペットの豆知識', '猫のいる暮らし', '犬のいる暮らし'] : ['暮らしの知恵', '時短家事', '片付けのコツ'],
    featuresUsed: ['知恵袋ハック'],
    isNoLink: true,
  });

  return variations;
}
