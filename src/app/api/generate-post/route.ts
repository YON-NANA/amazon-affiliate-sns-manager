import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GeneratedVariation, ToneId } from '@/lib/types';
import { buildAffiliateReplyText, replaceReplyLinkLine } from '@/lib/reply-builder';
import { convertToRakutenAffiliateUrl } from '@/lib/rakuten';

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
  includeNoLinkPost?: boolean;
  targetMode?: 'direct' | 'pattern_b_all';
  userExemplars?: string[];
  rakutenAffiliateId?: string;
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();
    const {
      asin,
      title,
      category,
      genre,
      targetAudience,
      affiliateUrl,
      platform,
      benefits,
      customNotes,
      includeNoLinkPost,
      targetMode,
      userExemplars,
      rakutenAffiliateId,
    } = body;

    if (!title) {
      return NextResponse.json({ error: '商品名は必須です。' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    // 宿・ホテル判定
    const isTravel =
      category === 'pet_travel' ||
      /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション/i.test(`${title} ${category}`);

    // 宿・旅行の場合は、素のURL（travel.rakuten.co.jp）が渡されても確実に楽天アフィリエイトリンクに自動変換
    const effectiveAffiliateUrl = isTravel && affiliateUrl
      ? convertToRakutenAffiliateUrl(affiliateUrl, rakutenAffiliateId || process.env.RAKUTEN_AFFILIATE_ID)
      : affiliateUrl;

    // 厳守ルール：メイン投稿は常にリンク無し・ROOM/リプ誘導、リプライにリンク・PR集約
    const effectiveTargetMode = 'pattern_b_all';
    const effectiveIncludeNoLink = true;

    // If Gemini API Key is available, generate using Gemini
    if (apiKey && apiKey !== '【Google AI Studioで取得したGemini APIキー】' && !apiKey.startsWith('your_')) {
      try {
        const generatedVariations = await generateWithGemini(apiKey, {
          asin,
          title,
          category,
          genre,
          targetAudience: targetAudience || (genre === 'pet' ? '愛犬・愛猫の飼い主' : '暮らしを快適にしたい人'),
          affiliateUrl: effectiveAffiliateUrl,
          platform,
          benefits: benefits || [],
          customNotes: customNotes || '',
          includeNoLinkPost: effectiveIncludeNoLink,
          targetMode: effectiveTargetMode,
          userExemplars: userExemplars || [],
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
      affiliateUrl: effectiveAffiliateUrl,
      platform,
      benefits: benefits || [],
      customNotes: customNotes || '',
      includeNoLinkPost: effectiveIncludeNoLink,
      targetMode: effectiveTargetMode,
    });

    return NextResponse.json({
      variations: fallbackVariations,
      source: apiKey ? 'template_fallback' : 'template_mode',
      note: apiKey ? 'Gemini API呼び出しでフォールバックしました' : '高品質テンプレート生成で動作中',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateWithGemini(
  apiKey: string,
  params: {
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
    targetMode?: 'direct' | 'pattern_b_all';
    userExemplars?: string[];
  }
): Promise<GeneratedVariation[]> {
  const ai = new GoogleGenAI({ apiKey });
  const isTravel =
    params.category === 'pet_travel' ||
    /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション/i.test(`${params.title} ${params.category}`);

  const prompt = isTravel
    ? `あなたは「犬や猫と心から寄り添って暮らす飼い主」です。
愛犬・愛猫と一緒に過ごすかけがえのない時間や、家族水入らずのお出かけ・お泊まりを大切にしています。

以下の【ペットと泊まれる宿・ホテル（楽天トラベル）】について、指定の【投稿文の作成ルール（厳守事項）】を100%遵守し、読者が「わかるなぁ、連れて行ってあげたい」「安心してくつろげそう」と心温まる共感を抱くSNS投稿文（4パターン）を日本語で作成し、指定のJSON形式で出力してください。

【宿・宿泊施設情報】
- 宿・ホテル名: ${params.title}
- カテゴリ: ペットと泊まれる宿・ホテル（楽天トラベル）
- ターゲット読者層: ${params.targetAudience}
- 推しポイント/魅力/設備: ${params.benefits.join(', ') || '愛犬歓迎・高評価・充実の設備'}
- 追記メモ: ${params.customNotes || 'なし'}
- 楽天トラベルリンク: ${params.affiliateUrl}

============================================================
【投稿文の作成ルール（厳守事項）】
============================================================

1. 文字数の上限（Xの文字切れ防止）
・メイン投稿（content）の文字数は、改行やスペースも含めて【全角110〜130文字以内】で絶対に収めること（140文字を絶対に超えないこと）。
・110文字未満や131文字以上は不可。必ず「110文字以上・130文字以内」に着地させてください。

2. トーン＆マナー（文体）
・過度なボケやツッコミ、自虐、テンションの高い煽り文句（「〜呼ぶ（知らんがな）」「ギャ〜…！」「オホホ^^」「白目剥いた」「あ〜爆死」「誰の〇〇やねん」「下僕」など）は【一切禁止】。
・犬や猫と暮らす飼い主の、リアルで飾らない「素直な日常の愛おしさ・共感」を落ち着いた優しいトーンで書くこと。

3. 写真との関連性
・添付写真の動物の表情、寝姿、仕草、くつろぐ様子にそのまま寄り添う、日常の一コマを切り取った描写にすること。
（例：旅先で安心しきって無防備にすやすや眠る寝顔、お部屋やお庭を楽しそうにくつろぐ表情、初めての場所に興味津々でトコトコ歩く愛らしい仕草など）

4. 構成ルール
・メイン投稿（content）:
  日常のほのぼのした描写・共感の一言 ＋ 最後にプロフ誘導を入れること
  （例：今回お世話になったお宿はプロフのリンク（楽天トラベル）にまとめてます🐾 #PR）
  ※メイン投稿にはURLは含めないでください（末尾のプロフ誘導の「#PR」は必須です）。
・リプライ（replyContent / 1通目）:
  宿名、設備や安心ポイントの具体的な紹介、楽天トラベルリンク（${params.affiliateUrl}）、ハッシュタグ（#PR）を配置すること（140文字以内）。

【出力してほしい4つの切り口】
- パターン1: tone="daily_moment" (初めてのお泊まりでの安心感・ほのぼの切り口)
- パターン2: tone="comfort_care" (客室温泉や専用ドッグランでくつろぐ様子切り口)
- パターン3: tone="cherished_time" (部屋食で家族水入らずで過ごす愛おしい時間切り口)
- パターン4: tone="gentle_empathy" (旅先で安心しきってぐっすり眠る寝姿への共感切り口)

【出力形式】
JSONオブジェクトのみを出力してください（Markdownコードブロック \`\`\`json も可）。
{
  "variations": [
    {
      "id": "var_1",
      "tone": "daily_moment",
      "toneName": "🌿 初めてのお泊まり・安心感",
      "headline": "短く穏やかな見出し",
      "content": "メイン投稿本文（写真に寄り添うほのぼの描写＋共感＋プロフ誘導#PR。改行・スペース含め全角110〜130文字以内厳守！）",
      "replyContent": "リプライ本文（宿名・特徴・楽天トラベルリンク・#PR。140字以内）",
      "tags": ["犬連れ旅行", "ペットと泊まれる宿", "愛犬とお出かけ", "犬のいる暮らし"],
      "featuresUsed": ["使用した特徴1"],
      "isNoLink": true
    }
  ]
}`
    : `あなたは「犬や猫と心から寄り添って暮らす飼い主」です。
愛犬・愛猫と一緒に暮らす、飾らない日常のかけがえのないひとコマを大切にしています。

以下の商品について、指定の【投稿文の作成ルール（厳守事項）】を100%遵守し、読者が「わかるなぁ」「うちの子にも使ってあげたい」と心温まる共感を抱くSNS投稿文（4パターン）を日本語で作成し、指定のJSON形式で出力してください。

【商品情報】
- 商品名: ${params.title}
- ASIN: ${params.asin}
- ジャンル: ${params.genre === 'pet' ? 'ペット用品・愛犬愛猫グッズ' : '暮らし・日用品・アウトドア・防災'}
- カテゴリ: ${params.category}
- ターゲット読者層: ${params.targetAudience}
- 推しポイント/スペック: ${params.benefits.join(', ') || '高評価レビュー多数'}
- 追記メモ: ${params.customNotes || 'なし'}
- トラッキングリンク: ${params.affiliateUrl}

============================================================
【投稿文の作成ルール（厳守事項）】
============================================================

1. 文字数の上限（Xの文字切れ防止）
・メイン投稿（content）の文字数は、改行やスペースも含めて【全角110〜130文字以内】で絶対に収めること（140文字を絶対に超えないこと）。
・110文字未満や131文字以上は不可。必ず「110文字以上・130文字以内」に着地させてください。

2. トーン＆マナー（文体）
・過度なボケやツッコミ、自虐、テンションの高い煽り文句（「〜呼ぶ（知らんがな）」「ギャ〜…！」「オホホ^^」「白目剥いた」「あ〜爆死」「誰の〇〇やねん」「下僕」など）は【一切禁止】。
・犬や猫と暮らす飼い主の、リアルで飾らない「素直な日常の愛おしさ・共感」を落ち着いた優しいトーンで書くこと。

3. 写真との関連性
・添付写真の動物の表情、寝姿、仕草、くつろぐ様子にそのまま寄り添う、日常の一コマを切り取った描写にすること。
（例：気持ちよさそうに目を細めている表情、サラサラの場所ですやすや眠る寝姿、美味しそうに水分補給している仕草、満足そうにくつろぐ様子など）

4. 構成ルール
・メイン投稿（content）:
  日常のほのぼのした描写・共感の一言 ＋ 最後にプロフ誘導を入れること
  （例：我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR）
  ※メイン投稿にはURLは含めないでください（末尾のプロフ誘導の「#PR」は必須です）。
・リプライ（replyContent / 1通目）:
  商品の詳細な紹介、具体的な使い心地やおすすめポイント、楽天ROOM等のリンク（${params.affiliateUrl}）、ハッシュタグ（#PR）を配置すること（140文字以内）。

【出力してほしい4つの切り口】
- パターン1: tone="daily_moment" (日常のくつろぎ・ほのぼの切り口)
- パターン2: tone="comfort_care" (心地よさ・お手入れの安心感切り口)
- パターン3: tone="cherished_time" (かけがえのない時間・愛おしさ切り口)
- パターン4: tone="gentle_empathy" (飼い主同士の優しい共感切り口)

【出力形式】
JSONオブジェクトのみを出力してください（Markdownコードブロック \`\`\`json も可）。
{
  "variations": [
    {
      "id": "var_1",
      "tone": "daily_moment",
      "toneName": "🌿 日常のくつろぎ・ほのぼの型",
      "headline": "短く穏やかな見出し",
      "content": "メイン投稿本文（写真に寄り添う日常描写＋共感＋プロフ誘導#PR。改行・スペース含め全角110〜130文字以内厳守！）",
      "replyContent": "リプライ本文（商品名・詳細紹介・リンク・#PR。140字以内）",
      "tags": ["ペットのいる暮らし", "愛犬愛猫", "買ってよかった"],
      "featuresUsed": ["使用した特徴1"],
      "isNoLink": true
    }
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
        const defaultReply = buildAffiliateReplyText({
          productName: params.title,
          reviewText: params.benefits.join('。') + '。',
          affiliateUrl: params.affiliateUrl,
        });

        // 1. 禁止ワード・古い煽りフレーズの完全除去・サニタイズ（※末尾の #PR は保持）
        let cleanMainContent = (v.content || '').trim()
          .replace(/オホホ\^*[~〜♡]*/gi, '')
          .replace(/…人はそれを[^と]+と呼ぶ[。、]?（知らんがな）/g, '')
          .replace(/（知らんがな）/g, '')
          .replace(/ギャ〜[…！!~〜]*/g, '')
          .replace(/白目剥いた[。！!]*/g, '')
          .replace(/白目剥き(?:ました|ます)[。！!]*/g, '')
          .replace(/あ〜[、\s]*爆死[。！!]*？?/g, '')
          .replace(/誰[がの][^思]+思とんねん[！!笑\s]*/g, '')
          .replace(/勘弁して〜[！!笑\s]*/g, '')
          .replace(/下僕/g, '飼い主')
          .replace(/しめるぞ|ゴルァ|しばく|殺す|殴る|ぶっ飛ばす|死ね/g, '')
          .replace(/https?:\/\/[^\s]+/g, '')
          .replace(/👇[^\n]*\n?/g, '')
          .replace(/★\s*\d+(\.\d+)?(\s*（[^）]+）)?/g, '')
          .replace(/レビュー\s*[\d,]+件[^\n]*\n?/g, '')
          .replace(/【商品名】[^\n]*\n?/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        // 2. 全角110〜130文字以内への厳格な整形ガード
        cleanMainContent = enforcePostLength(cleanMainContent, isTravel);

        // リプライ本文のリンク保証（Geminiが素URLを出力した場合でも確実にアフィリリンクに置換・保証）
        let safeReplyContent = (v.replyContent?.trim() || defaultReply);
        if (params.affiliateUrl) {
          safeReplyContent = replaceReplyLinkLine(
            safeReplyContent,
            isTravel ? 'direct_rakuten' : 'direct_rakuten',
            params.affiliateUrl
          );
        }

        return {
          id: v.id || `var_${idx + 1}`,
          tone: (v.tone as ToneId) || (idx === 0 ? 'daily_moment' : idx === 1 ? 'comfort_care' : idx === 2 ? 'cherished_time' : 'gentle_empathy'),
          toneName: v.toneName || (isTravel
            ? (idx === 0 ? '🌿 初めてのお泊まり・安心感' : idx === 1 ? '♨️ 客室温泉・専用ドッグラン' : idx === 2 ? '🍱 部屋食・家族団らん' : '🐾 旅先すやすや寝顔')
            : (idx === 0 ? '🌿 日常のくつろぎ・ほのぼの' : idx === 1 ? '✨ 心地よさ・お手入れ安心' : idx === 2 ? '💖 かけがえのない時間' : '🐾 飼い主の優しい共感')),
          headline: v.headline || (isTravel ? 'おすすめの愛犬同伴宿' : 'おすすめポイント'),
          content: cleanMainContent,
          replyContent: safeReplyContent,
          characterCount: cleanMainContent.length,
          tags: v.tags || (isTravel
            ? ['犬連れ旅行', 'ペットと泊まれる宿', '愛犬とお出かけ', 'ペットのいる暮らし']
            : (params.genre === 'pet' ? ['ペットのいる暮らし', '愛犬愛猫', '買ってよかった'] : ['暮らしを整える', '時短家事', '便利グッズ'])),
          featuresUsed: v.featuresUsed || params.benefits,
          isNoLink: true,
        };
      });
    }
  }

  throw new Error('Failed to parse Gemini response as JSON');
}

/**
 * メイン投稿の文字数を【全角110〜130文字以内】に厳密に収めるヘルパー
 * プロフ誘導（+ #PR）を確実に配置し、140文字超えを絶対に防止する
 */
function enforcePostLength(text: string, isTravel: boolean): string {
  const guide = isTravel
    ? '\n今回お世話になったお宿はプロフのリンク（楽天トラベル）にまとめてます🐾 #PR'
    : '\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR';

  let target = text.trim();

  // プロフ誘導のフレーズが全く含まれていない場合は付与を試みる
  if (!target.includes('プロフ')) {
    if ((target + guide).length <= 130) {
      target = (target + guide).trim();
    } else {
      // 130文字に収まるよう前段を切り詰めてガイドを付与
      const maxLead = 130 - guide.length;
      if (maxLead > 30) {
        target = target.slice(0, maxLead).replace(/[、,\s]+$/, '') + '…' + guide;
      }
    }
  }

  // プロフ誘導はあるが #PR が抜けている場合は付与
  if (!target.includes('#PR')) {
    if ((target + ' #PR').length <= 130) {
      target = target + ' #PR';
    } else {
      target = target.slice(0, 125).replace(/[、,\s]+$/, '') + ' #PR';
    }
  }

  // 130文字を超えている場合は安全にトリミング（末尾の #PR は死守）
  if (target.length > 130) {
    if (target.endsWith('#PR')) {
      const bodyPart = target.slice(0, -4).trim();
      target = bodyPart.slice(0, 125).replace(/[、,\s]+$/, '') + ' #PR';
    } else {
      target = target.slice(0, 127).replace(/[、,\s]+$/, '') + '…';
    }
  }

  // 110文字未満で短すぎる場合は共感の一言を補完
  if (target.length < 110) {
    const padding = isTravel
      ? '\n愛犬との温かい思い出になりました🐶'
      : '\n毎日大切に使っています🌿';
    
    // プロフ誘導の直前に挿入を試みる
    if (target.includes('\n') && (target.length + padding.length) <= 130) {
      const lastLineIdx = target.lastIndexOf('\n');
      target = target.slice(0, lastLineIdx) + padding + target.slice(lastLineIdx);
    } else if ((target + padding).length <= 130) {
      target = (target + padding).trim();
    }
  }

  // 最終安全ガード（絶対に130文字以内・140文字超え完全防止）
  if (target.length > 130) {
    if (target.includes('#PR')) {
      const withoutPr = target.replace(/\s*#PR$/, '');
      target = withoutPr.slice(0, 125).replace(/[、,\s]+$/, '') + ' #PR';
    } else {
      target = target.slice(0, 127).replace(/[、,\s]+$/, '') + '…';
    }
  }

  return target;
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
  targetMode?: 'direct' | 'pattern_b_all';
}): GeneratedVariation[] {
  const isTravel =
    params.category === 'pet_travel' ||
    /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション/i.test(`${params.title} ${params.category}`);
  const isPet = isTravel || params.genre === 'pet';
  const benefit1 = params.benefits[0] || (isTravel ? '愛犬同伴歓迎＆充実のアメニティ完備' : isPet ? '愛犬・愛猫のストレス解消＆お手入れ快適' : '日々の暮らしが心地よく整う安心設計');
  const benefit2 = params.benefits[1] || (isTravel ? '客室露天風呂・天然温泉や専用ドッグラン付き' : isPet ? 'やさしい使い心地でリラックス' : '使い勝手抜群の便利アイテム');

  const scenario = getScenarioByProduct(params.title, params.category, isPet);

  // 4つのバリエーションを作成（全角110〜130文字以内厳守・優しいトーン）
  const configs = [
    {
      tone: 'daily_moment' as ToneId,
      toneName: isTravel ? '🌿 初めてのお泊まり・安心感' : '🌿 日常のくつろぎ・ほのぼの型',
      story: scenario.story1,
    },
    {
      tone: 'comfort_care' as ToneId,
      toneName: isTravel ? '♨️ 客室温泉・専用ドッグラン' : '✨ 心地よさ・お手入れ安心型',
      story: scenario.story2,
    },
    {
      tone: 'cherished_time' as ToneId,
      toneName: isTravel ? '🍱 部屋食・家族団らん' : '💖 かけがえのない時間型',
      story: scenario.story3,
    },
    {
      tone: 'gentle_empathy' as ToneId,
      toneName: isTravel ? '🐾 旅先すやすや寝顔' : '🐾 飼い主の優しい共感型',
      story: scenario.story4,
    },
  ];

  return configs.map((cfg, idx) => {
    const mainContent = enforcePostLength(cfg.story.main, isTravel);
    const replyContent = buildAffiliateReplyText({
      productName: params.title,
      reviewText: `${benefit1}。${benefit2}。`,
      affiliateUrl: params.affiliateUrl,
    });

    return {
      id: `var_fallback_${idx + 1}`,
      tone: cfg.tone,
      toneName: cfg.toneName,
      headline: `${scenario.topic}（${cfg.story.tag}）`,
      content: mainContent,
      replyContent: replyContent,
      characterCount: mainContent.length,
      tags: isTravel
        ? ['犬連れ旅行', 'ペットと泊まれる宿', cfg.story.tag, 'ペットのいる暮らし']
        : (isPet ? ['ペットのいる暮らし', cfg.story.tag, '買ってよかった'] : ['暮らしを整える', cfg.story.tag, '買ってよかった']),
      featuresUsed: [benefit1, benefit2],
      isNoLink: true,
    };
  });
}

function getScenarioByProduct(title: string, category: string, isPet: boolean) {
  const text = `${title} ${category}`.toLowerCase();

  if (isPet) {
    if (category === 'pet_travel' || /宿|ホテル|温泉|旅館|ヴィラ|コテージ|宿泊|トラベル|ペンション/i.test(text)) {
      return {
        type: 'travel',
        topic: 'ペットと泊まれる宿・ホテル旅行',
        story1: {
          main: `愛犬と初めてのお泊まり旅行、行く前は「粗相しないかな」とドキドキでした。\nでも着いた瞬間から温かく迎えてくれて不安がふわっと消えました。\n安心しきった愛犬の笑顔が宝物です。\n今回お世話になったお宿はプロフのリンク（楽天トラベル）にまとめてます🐾 #PR`,
          tag: '初めての愛犬旅行',
        },
        story2: {
          main: `客室温泉と専用ドッグラン付きのお宿へ。\n扉を開けた瞬間、お庭を楽しそうに駆け回って満面の笑顔を見せてくれました。\n旅先で嬉しそうにくつろぐ姿を見られて幸せです。\n今回お世話になったお宿はプロフのリンク（楽天トラベル）にまとめてます🐾 #PR`,
          tag: '客室温泉＆ドッグラン',
        },
        story3: {
          main: `愛犬とのお泊まりで一番嬉しかったお部屋食。\n専用プレートを美味しそうに食べて、見上げて目を細める姿に胸が温かくなりました。\n家族で過ごす旅時間は宝物です。\n今回お世話になったお宿はプロフのリンク（楽天トラベル）にまとめてます🐾 #PR`,
          tag: '部屋食で家族団らん',
        },
        story4: {
          main: `日中たくさん遊んで満足したのか、お部屋のベッドで丸くなってすやすや眠る愛犬。\n旅先でも安心しきって無防備に寝息を立てる横顔に、こちらまで癒やされました。\n泊まって本当によかったです。\n今回お世話になったお宿はプロフのリンク（楽天トラベル）にまとめてます🐾 #PR`,
          tag: '旅先で爆睡',
        },
      };
    }

    if (/ブラシ|コーム|抜け毛|ファーミネーター|グルーミング|毛取り|アンダーコート/i.test(text)) {
      return {
        type: 'brush',
        topic: '抜け毛・ブラッシング',
        story1: {
          main: `換毛期のお手入れ中、気持ちよさそうに目を細めて喉を鳴らしてくれる姿が愛おしいです。\n優しく撫でるだけでふわふわの毛がすっきり整って、毎日の大切なスキンシップに。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: '抜け毛ケア',
        },
        story2: {
          main: `ブラッシングを始めると、安心したように私の膝の上でぺたんとくつろぐ愛猫。\n手櫛だと取りきれない抜け毛も、優しく撫でるだけでサラサラになって心地いい時間です。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: '心地よいケア',
        },
        story3: {
          main: `撫でるたびにふわふわ舞う抜け毛。\n優しくブラッシングしてあげると、毛並みがつやつやに整って本人もなんだか誇らしげな表情に。\n喜んでくれる姿を見ると嬉しくなります。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: 'サラサラ毛並み',
        },
        story4: {
          main: `ブラッシングの時間が終わると、満足そうにスリスリ甘えてきてくれる愛猫。\nお手入れ後のふわふわな抱き心地がたまらなく愛おしくて、今日もたくさん癒やされました。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: '大切なスキンシップ',
        },
      };
    }

    if (/シーツ|シート|トイレ|消臭|おしっこ|オシッコ|砂|うんち/i.test(text)) {
      return {
        type: 'sheet',
        topic: 'トイレ・シートのお手入れ',
        story1: {
          main: `トイレの後、すっきりした顔でトコトコ戻ってくる姿がたまらなく愛らしい日常。\n足元が濡れることもなく、いつも快適そうにくつろいでくれる姿にホッと安心しています。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: '快適トイレ',
        },
        story2: {
          main: `敷き替えたばかりのふかふかシーツ。\n気持ちよさそうに匂いを嗅いだあと、その場にコテンと横たわって満足そうな表情に。\n清潔な環境で気持ちよく過ごしてくれるのが一番です。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: '清潔な毎日',
        },
        story3: {
          main: `お留守番の後も、お部屋が清潔で嫌なニオイもなくサラサラに保たれていると安心します。\n迎えてくれた時の元気いっぱいの笑顔と、安心しきった寝姿を見るたびにホッとします。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: 'お留守番の安心',
        },
        story4: {
          main: `トイレ周りを清潔に整えてあげると、愛猫も気持ちよさそうにリラックスして伸びをしています。\n家族みんなが心地よく過ごせる空間づくりはやっぱり大切ですね。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: '心地よい暮らし',
        },
      };
    }

    if (/水|ウォーター|給水|水飲み|ボウル/i.test(text)) {
      return {
        type: 'water',
        topic: '水飲み・給水ケア',
        story1: {
          main: `トコトコ歩いてきて、美味しそうにお水をペロペロ飲んでいる愛猫の横顔。\nいつでも新鮮で綺麗なお水をごくごく飲んでくれる姿を見るだけで、飼い主としてとても安心します。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: '美味しいお水',
        },
        story2: {
          main: `お散歩から帰ってきて、夢中でお水を飲んでいる愛犬の満足そうな表情。\nお口周りや床も汚れず、いつでも清潔なお水を飲める環境を整えてあげられて本当によかったです。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: 'お散歩後の水分補給',
        },
        story3: {
          main: `お留守番中もたっぷり新鮮なお水が飲めるように準備しておくと、安心して外出できます。\n帰宅してご機嫌にお出迎えしてくれる姿に、今日もたくさん癒やされています。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: 'お留守番の水分補給',
        },
        story4: {
          main: `流れるお水に興味津々で、ちょこんと座って静かに見つめている愛らしい後ろ姿。\n美味しそうに喉を潤したあと、満足そうに丸くなってお昼寝する姿に心がほっこり和みます。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
          tag: '優しいひととき',
        },
      };
    }

    // デフォルト（ペット全般・おもちゃ・ベッドなど）
    return {
      type: 'general_pet',
      topic: '愛犬愛猫と過ごす穏やかな日常',
      story1: {
        main: `新しいアイテムをそっと置いてみたら、すぐに気に入ってくれたようで安心しました。\n気持ちよさそうに丸くなってすやすや眠る姿を見ていると、日々の疲れも吹き飛びます。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        tag: '穏やかな寝顔',
      },
      story2: {
        main: `お気に入りの居場所でまったりくつろぎながら、穏やかな表情で見つめてくる愛猫。\n言葉は通じなくても、満足そうに喉を鳴らす仕草に深い絆を感じて温かい気持ちになります。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        tag: 'お気に入りの居場所',
      },
      story3: {
        main: `大好きな居場所で安心しきって無防備に寝転がる愛犬の姿。\n家族のそばで穏やかに呼吸を合わせている日常の何気ない一コマが、一番のかけがえのない時間ですね。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        tag: '安心のひととき',
      },
      story4: {
        main: `日頃のお手入れや日用品を使い心地のいいものに変えてから、うちの子も毎日とてもご機嫌です。\nリラックスして伸び伸びと過ごす姿にいつもたくさんの癒やしをもらっています。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        tag: 'ご機嫌な毎日',
      },
    };
  }

  // アウトドア・キャンプ
  if (/テント|タープ|ペグ|チェア|寝袋|シュラフ|焚き火|ランタン|マット|キャンプ/i.test(text)) {
    return {
      type: 'camp',
      topic: '自然の中で過ごす癒やしの時間',
      story1: {
        main: `愛犬と一緒に自然の澄んだ空気を感じながら過ごす穏やかな休日。\n木漏れ日の下で気持ちよさそうに寄り添ってうとうとする姿に、心から癒やされるひとときでした。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        tag: '自然の中の休日',
      },
      story2: {
        main: `大自然の静寂の中で迎える朝のひととき。\n鳥のさえずりを聞きながら温かいコーヒーを飲む時間は、日々の忙しさを忘れさせてくれる大切なリセット時間です。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        tag: '心地よい朝',
      },
      story3: {
        main: `家族みんなで焚き火を囲みながらゆっくり語り合う夜の時間。\n澄んだ星空の下で穏やかに流れる時間は何よりの宝物。パチパチとはぜる炎に心癒やされます。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        tag: '焚き火の温もり',
      },
      story4: {
        main: `準備や設営がスムーズにいくと、そのぶん大自然を満喫する時間がたっぷり持てますね。\n心地よい風を感じながら過ごす、最高のリフレッシュのひとときでした。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
        tag: '快適アウトドア',
      },
    };
  }

  // 防災・一般暮らし
  return {
    type: 'life_disaster',
    topic: '大切な家族を守る暮らしの備え',
    story1: {
      main: `愛犬や愛猫と暮らしているからこそ、もしもの時の備えはいつも万全にしておきたいもの。\n普段から使える安心アイテムを準備しておくだけで、日々の安心感がぐっと深まります。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
      tag: '家族のための備え',
    },
    story2: {
      main: `毎日の暮らしを整えるちょっとした便利アイテム。\n家事の手間が少し軽くなるだけで、家族やペットと笑顔で向き合える時間が増えるのが本当に嬉しいですね。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
      tag: '心地いい暮らし',
    },
    story3: {
      main: `突然の停電や災害の時でも、落ち着いて愛する家族を守れるように普段から準備。\n使い慣れたものがお家にあるだけで、言葉を話せないペットにとっても大きな安心感に。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
      tag: '安心の備え',
    },
    story4: {
      main: `日頃から使う日用品を少し見直すだけで、暮らしの居心地の良さがぐんと変わります。\n家族みんなが気持ちよく笑顔で過ごせる毎日を、これからも大切にしていきたいですね。\n我が家の愛用アイテムはプロフのリンク（ROOM）にまとめてます🐾 #PR`,
      tag: '丁寧な暮らし',
    },
  };
}
